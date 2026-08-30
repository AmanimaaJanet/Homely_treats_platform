import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';

export default function Promos() {
  const { toast } = useApp();
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState({ code: '', type: 'PERCENT', value: '', active: true, usageLimit: '' });

  const load = () => api.get('/admin/promos', { auth: true }).then((d) => setPromos(d.promos)).catch(() => {});

  useEffect(load, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/promos', { ...form, value: Number(form.value), usageLimit: form.usageLimit || null }, { auth: true });
      toast('Promo created', 'success');
      setForm({ code: '', type: 'PERCENT', value: '', active: true, usageLimit: '' });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (id) => {
    await api.del(`/admin/promos/${id}`, { auth: true });
    toast('Promo deleted', 'success');
    load();
  };

  return (
    <div>
      <h2 className="admin-title">Promo Codes</h2>

      <div className="section" style={{ maxWidth: 560 }}>
        <h3 className="form-heading">Create Promo</h3>
        <form onSubmit={save}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Code</label>
              <input className="form-input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SUMMER20" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed amount (GH₵)</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Value</label>
              <input type="number" step="0.01" className="form-input" required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Usage limit (blank = unlimited)</label>
              <input type="number" className="form-input" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
            </div>
          </div>
          <div className="check-row">
            <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          </div>
          <button className="btn btn-primary">Create Promo</button>
        </form>
      </div>

      <table className="table" style={{ marginTop: '1.5rem' }}>
        <thead>
          <tr><th>Code</th><th>Type</th><th>Value</th><th>Used</th><th>Limit</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {promos.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.code}</strong></td>
              <td>{p.type === 'PERCENT' ? 'Percentage' : 'Fixed'}</td>
              <td>{p.type === 'PERCENT' ? `${p.value}%` : `GH₵ ${p.value}`}</td>
              <td>{p.usageCount}</td>
              <td>{p.usageLimit || '∞'}</td>
              <td><span className={p.active ? 'success' : 'muted'}>{p.active ? 'Active' : 'Inactive'}</span></td>
              <td><button className="btn-link danger" onClick={() => remove(p.id)}>Delete</button></td>
            </tr>
          ))}
          {promos.length === 0 && <tr><td colSpan="7" className="centered muted">No promos yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
