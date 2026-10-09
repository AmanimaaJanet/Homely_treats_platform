import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Check, EyeOff, RotateCcw, Search, MessageSquareQuote, Printer, Trash2, MessageSquareHeart } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import { fmtDate } from '../../lib/format.js';

const TABS = [
  { key: 'PENDING', label: 'Awaiting review' },
  { key: 'APPROVED', label: 'Published' },
  { key: 'HIDDEN', label: 'Hidden' },
  { key: 'ALL', label: 'All' },
  // Site feedback is its own thing: no order, no product — the bakery decides which
  // of these notes appear on the homepage's "What Our Customers Say" section.
  { key: 'FEEDBACK', label: 'Site feedback' },
];

function Stars({ n }) {
  return (
    <span className="stars-inline" aria-label={`${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14} className={i <= n ? 'star-fill-inline' : 'star-empty-inline'} />
      ))}
    </span>
  );
}

export default function Reviews() {
  const { toast } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [state, setState] = useState({ reviews: [], summary: { PENDING: 0, APPROVED: 0, HIDDEN: 0, ALL: 0 } });
  const [busy, setBusy] = useState(null);

  const load = async (which = tab, term = search) => {
    try {
      if (which === 'FEEDBACK') {
        const data = await api.get('/admin/feedback?status=ALL', { auth: true });
        const summary = { ...(data.summary || {}), FEEDBACK: data.summary?.PENDING || 0 };
        setState({ reviews: data.items || [], summary });
        return;
      }
      const params = new URLSearchParams({ status: which });
      if (term) params.set('search', term);
      const data = await api.get(`/admin/reviews?${params}`, { auth: true });
      setState({ reviews: data.reviews, summary: data.summary });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  useEffect(() => {
    load(tab, '');
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const moderate = async (review, status) => {
    setBusy(review.id);
    try {
      await api.patch(`/admin/reviews/${review.id}`, { status }, { auth: true });
      const verb = status === 'APPROVED' ? 'published' : status === 'HIDDEN' ? 'hidden' : 'moved back to the queue';
      toast(`Review ${verb}.`, 'success');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const feedbackAct = async (item, action) => {
    setBusy(item.id);
    try {
      if (action === 'DELETE') {
        await api.del(`/admin/feedback/${item.id}`, { auth: true });
        toast('Feedback deleted.', 'success');
      } else {
        await api.put(`/admin/feedback/${item.id}`, { status: action }, { auth: true });
        toast(action === 'APPROVED' ? 'Published on the homepage.' : 'Removed from the homepage.', 'success');
      }
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const counts = state.summary || {};

  return (
    <div>
      <h2 className="admin-title">Reviews</h2>

      <div className="admin-toolbar">
        <div className="filter-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`filter-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {counts[t.key] > 0 && <span className="tab-count">{counts[t.key]}</span>}
            </button>
          ))}
        </div>
        <input aria-label="Search reviews"
          className="form-input"
          placeholder="Search review, customer or order…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button className="btn btn-secondary" onClick={() => load()}>
          <Search size={15} /> Search
        </button>
      </div>

      {tab === 'PENDING' && counts.PENDING === 0 && (
        <div className="section empty-state">
          <MessageSquareQuote size={30} />
          <p>Nothing waiting. Every review has been dealt with.</p>
          <p className="muted small">
            New reviews land here when “Hold reviews for approval” is switched on in Settings.
          </p>
        </div>
      )}

      {tab === 'FEEDBACK' && (
        <div className="review-queue">
          {state.reviews.length === 0 && (
            <div className="section empty-state">
              <MessageSquareHeart size={30} />
              <p>No site feedback yet.</p>
              <p className="muted small">
                Customers can leave feedback from the “Share your feedback” link in the footer —
                it lands here, and you choose which notes appear on the homepage.
              </p>
            </div>
          )}
          {state.reviews.map((f) => (
            <div className={`review-card status-${f.status.toLowerCase()}`} key={f.id}>
              <div className="review-main">
                <div className="review-head">
                  <Stars n={f.rating} />
                  <strong>{f.name}</strong>
                  <span className={`status-pill ${f.status.toLowerCase()}`}>
                    {f.status === 'PENDING' ? 'Awaiting approval' : f.status === 'APPROVED' ? 'On the homepage' : 'Removed'}
                  </span>
                </div>
                <p className="review-comment">“{f.message}”</p>
                <p className="muted small">{fmtDate(f.createdAt)}</p>
              </div>
              <div className="review-actions">
                {f.status !== 'APPROVED' && (
                  <button className="btn btn-primary btn-sm" disabled={busy === f.id} onClick={() => feedbackAct(f, 'APPROVED')}>
                    <Check size={15} /> Publish
                  </button>
                )}
                {f.status === 'APPROVED' && (
                  <button className="btn btn-secondary btn-sm" disabled={busy === f.id} onClick={() => feedbackAct(f, 'REJECTED')}>
                    <EyeOff size={15} /> Remove from homepage
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" disabled={busy === f.id} onClick={() => feedbackAct(f, 'DELETE')}>
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab !== 'FEEDBACK' && (
      <div className="review-queue">
        {state.reviews.map((r) => (
          <div className={`review-card status-${r.status.toLowerCase()}`} key={r.id}>
            <div className="review-main">
              <div className="review-head">
                <Stars n={r.rating} />
                <strong>{r.user?.fullName || 'Customer'}</strong>
                <span className={`status-pill ${r.status.toLowerCase()}`}>
                  {r.status === 'PENDING' ? 'Awaiting approval' : r.status === 'APPROVED' ? 'Published' : 'Hidden'}
                </span>
              </div>
              <p className="review-comment">
                {r.comment ? `“${r.comment}”` : <span className="muted">No written comment — rating only.</span>}
              </p>
              <p className="muted small">
                Order{' '}
                <button className="btn-link" onClick={() => navigate('/admin/orders')}>
                  {r.orderId}
                </button>{' '}
                · {fmtDate(r.order?.createdAt || r.createdAt)} · {r.user?.email}
                {r.moderatedAt ? ` · moderated ${fmtDate(r.moderatedAt)}${r.moderatedBy ? ` by ${r.moderatedBy}` : ''}` : ''}
              </p>
            </div>

            <div className="review-actions">
              {r.status !== 'APPROVED' && (
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy === r.id}
                  onClick={() => moderate(r, 'APPROVED')}
                >
                  <Check size={15} /> Publish
                </button>
              )}
              {r.status !== 'HIDDEN' && (
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={busy === r.id}
                  onClick={() => moderate(r, 'HIDDEN')}
                >
                  <EyeOff size={15} /> Hide
                </button>
              )}
              {r.status !== 'PENDING' && (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy === r.id}
                  onClick={() => moderate(r, 'PENDING')}
                >
                  <RotateCcw size={15} /> Re-queue
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate(`/admin/print/${r.orderId}?doc=receipt`)}
              >
                <Printer size={15} /> Receipt
              </button>
            </div>
          </div>
        ))}

        {state.reviews.length === 0 && tab !== 'PENDING' && (
          <div className="empty-state">
            <p>Nothing to show here yet.</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
