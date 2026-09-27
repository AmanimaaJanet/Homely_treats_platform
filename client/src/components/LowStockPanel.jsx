import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, PackageCheck, Mail, RefreshCw } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

/**
 * Live low-stock panel for the admin dashboard.
 *
 * The server also emails a daily digest (see services/stockAlerts.js), but the
 * digest is easy to miss and a sleeping free-tier host may skip a tick, so the
 * dashboard always shows the current list and offers a manual "email me now".
 */
export default function LowStockPanel() {
  const { toast } = useApp();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, products: [], threshold: 5 });
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const data = await api.get('/admin/alerts/low-stock', { auth: true });
      setState({ loading: false, products: data.products, threshold: data.threshold });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sendNow = async () => {
    setSending(true);
    try {
      const res = await api.post('/admin/alerts/low-stock/send', {}, { auth: true });
      toast(
        res.count > 0
          ? `Stock alert emailed for ${res.count} item${res.count === 1 ? '' : 's'}.`
          : 'All items are well stocked — a test email was sent.',
        'success'
      );
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  if (state.loading) return null;

  if (state.products.length === 0) {
    return (
      <div className="stock-alert">
        <div className="stock-alert-head">
          <h3><PackageCheck size={17} /> Stock levels are healthy</h3>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <p className="stock-ok">Nothing is at or below the reorder threshold of {state.threshold}.</p>
      </div>
    );
  }

  const soldOut = state.products.filter((p) => p.stock <= 0).length;

  return (
    <div className="stock-alert">
      <div className="stock-alert-head">
        <h3>
          <AlertTriangle size={17} />
          {state.products.length} item{state.products.length === 1 ? '' : 's'} need restocking
        </h3>
        <div className="row-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/products')}>
            Update stock
          </button>
          <button className="btn btn-primary btn-sm" onClick={sendNow} disabled={sending}>
            <Mail size={14} /> {sending ? 'Sending…' : 'Email me now'}
          </button>
        </div>
      </div>
      <p>
        At or below the reorder threshold of {state.threshold}
        {soldOut > 0 ? ` — ${soldOut} already sold out and hidden from customers.` : '.'}
      </p>
      <div className="stock-list">
        {state.products.slice(0, 12).map((p) => (
          <span key={p.id} className={`stock-chip ${p.stock <= 0 ? 'sold-out' : ''}`}>
            {p.name}
            <strong>{p.stock <= 0 ? 'sold out' : `${p.stock} left`}</strong>
          </span>
        ))}
        {state.products.length > 12 && (
          <span className="stock-chip"><span className="muted">+{state.products.length - 12} more</span></span>
        )}
      </div>
    </div>
  );
}
