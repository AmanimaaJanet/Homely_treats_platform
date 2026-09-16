import React, { useEffect, useState } from 'react';
import { Ticket, Plus, X, Info } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import { ghs, fmtDate } from '../../lib/format.js';

const emptyForm = {
  code: '',
  type: 'PERCENT',
  value: '',
  active: true,
  usageLimit: '',
  minSpend: '',
  perCustomerLimit: '',
  firstOrderOnly: false,
  expiresAt: '',
};

export default function Promos() {
  const { toast } = useApp();
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get('/admin/promos', { auth: true })
      .then((d) => setPromos(d.promos))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(
        '/admin/promos',
        {
          code: form.code,
          type: form.type,
          value: Number(form.value),
          active: form.active,
          usageLimit: form.usageLimit || null,
          minSpend: form.minSpend || 0,
          perCustomerLimit: form.perCustomerLimit || null,
          firstOrderOnly: form.firstOrderOnly,
          expiresAt: form.expiresAt || null,
        },
        { auth: true }
      );
      toast(`Promo ${form.code.toUpperCase()} created`, 'success');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id, code) => {
    try {
      await api.del(`/admin/promos/${id}`, { auth: true });
      toast(`Promo ${code} deleted`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const describeRules = (p) => {
    const bits = [];
    if (p.minSpend > 0) bits.push(`min ${ghs(p.minSpend)}`);
    if (p.perCustomerLimit) bits.push(`${p.perCustomerLimit}× per customer`);
    if (p.firstOrderOnly) bits.push('first order only');
    if (p.expiresAt) bits.push(`expires ${fmtDate(p.expiresAt)}`);
    return bits.length ? bits.join(' · ') : 'No extra conditions';
  };

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Promo Codes</h1>
          <p className="muted small">
            Discounts apply at checkout. Add conditions to stop a code being shared and reused
            indefinitely.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> New promo</>}
        </button>
      </div>

      {showForm && (
        <form className="section" onSubmit={save}>
          <h2 className="section-title" style={{ fontSize: 20, textAlign: 'left' }}>Create a promo code</h2>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Code</label>
              <input
                className="form-input"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME10"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed amount (GH₵)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Value {form.type === 'PERCENT' ? '(%)' : '(GH₵)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={form.type === 'PERCENT' ? 100 : undefined}
                className="form-input"
                required
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total uses allowed (blank = unlimited)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Minimum order value (GH₵, blank = none)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={form.minSpend}
                onChange={(e) => setForm({ ...form, minSpend: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Uses per customer (blank = unlimited)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={form.perCustomerLimit}
                onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Expiry date (blank = never)</label>
              <input
                type="date"
                className="form-input"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <label className="check-row toggle">
                <input
                  type="checkbox"
                  checked={form.firstOrderOnly}
                  onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })}
                />
                <span>First order only</span>
              </label>
              <label className="check-row toggle" style={{ marginTop: 10 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>
          </div>

          <p className="muted small" style={{ marginBottom: 14 }}>
            <Info size={13} /> If an order is cancelled, that use is released — the customer can use
            the code again.
          </p>

          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create promo'}
          </button>
        </form>
      )}

      <div className="section">
        {loading ? (
          <p className="muted">Loading promos…</p>
        ) : promos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Ticket size={44} strokeWidth={1.4} /></div>
            <p className="empty-state-text">No promo codes yet</p>
            <p className="muted">Create one to run a discount or a seasonal offer.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Conditions</th>
                  <th>Used</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.code}</strong></td>
                    <td>{p.type === 'PERCENT' ? `${p.value}%` : ghs(p.value)}</td>
                    <td className="small muted">{describeRules(p)}</td>
                    <td>
                      <span className="pill-count">
                        {p.usageCount}{p.usageLimit ? ` / ${p.usageLimit}` : ''}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${p.active ? 'status-ready' : 'status-cancelled'}`}>
                        {p.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td>
                      <button className="btn-link danger" onClick={() => remove(p.id, p.code)}>
                        Delete
                      </button>
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
