import React, { useEffect, useState } from 'react';
import { Bike, Plus, X, ShieldOff, ShieldCheck, Phone, Mail, Package } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import { fmtDate } from '../../lib/format.js';

const emptyForm = { fullName: '', email: '', phone: '', password: '' };

export default function AdminRiders() {
  const { toast } = useApp();
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get('/admin/riders', { auth: true })
      .then((d) => setRiders(d.riders))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/riders', form, { auth: true });
      toast(`${form.fullName} can now sign in to the rider app`, 'success');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (rider, active) => {
    try {
      await api.patch(`/admin/riders/${rider.id}`, { active }, { auth: true });
      toast(active ? `${rider.fullName} reinstated` : `${rider.fullName} suspended`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Riders</h1>
          <p className="muted small">
            Rider accounts are created here — riders cannot sign themselves up. Deliveries they
            accept show the customer&apos;s address and phone number only to them.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New rider</>}
        </button>
      </div>

      {showForm && (
        <form className="section" onSubmit={create}>
          <h2 className="section-title" style={{ fontSize: 20, textAlign: 'left' }}>Add a rider</h2>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input
                className="form-input"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                placeholder="024 000 0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Temporary password</label>
              <input
                type="text"
                className="form-input"
                placeholder="Min 8 chars, letters + numbers"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={8}
                required
              />
            </div>
          </div>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Share these sign-in details with the rider. Ask them to change the password after their
            first delivery.
          </p>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create rider account'}
          </button>
        </form>
      )}

      <div className="section">
        {loading ? (
          <p className="muted">Loading riders…</p>
        ) : riders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Bike size={44} strokeWidth={1.4} /></div>
            <p className="empty-state-text">No riders yet</p>
            <p className="muted">Create an account for each rider so they can accept deliveries.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Rider</th>
                  <th>Contact</th>
                  <th>On the road</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {riders.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.fullName}</strong>
                      <div className="muted small">Joined {fmtDate(r.createdAt)}</div>
                    </td>
                    <td>
                      <div className="small"><Mail size={13} /> {r.email}</div>
                      <div className="small"><Phone size={13} /> {r.phone}</div>
                    </td>
                    <td>
                      <span className="pill-count"><Package size={13} /> {r.activeDeliveries || 0}</span>
                    </td>
                    <td>
                      {r.active ? (
                        <span className="status-badge status-ready">ACTIVE</span>
                      ) : (
                        <span className="status-badge status-cancelled">SUSPENDED</span>
                      )}
                    </td>
                    <td>
                      {r.active ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => setActive(r, false)}>
                          <ShieldOff size={14} /> Suspend
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => setActive(r, true)}>
                          <ShieldCheck size={14} /> Reinstate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
