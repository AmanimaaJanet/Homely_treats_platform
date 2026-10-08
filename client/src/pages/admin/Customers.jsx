import React, { useEffect, useState } from 'react';
import { Users, ShoppingCart, Coins, Lock, Unlock, ShieldAlert } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import { ghs, fmtDate, fmtDateTime, initials } from '../../lib/format.js';

export default function Customers() {
  const { toast } = useApp();
  const [customers, setCustomers] = useState([]);
  // Sign-in lockouts are shown here rather than buried in a log: a locked customer is
  // usually on the phone right now, and the fix is one click.
  const [lockouts, setLockouts] = useState([]);
  const [lockSettings, setLockSettings] = useState(null);

  const load = () =>
    api.get('/admin/customers', { auth: true }).then((d) => setCustomers(Array.isArray(d.customers) ? d.customers : [])).catch(() => {});
  const loadLockouts = () =>
    api
      .get('/admin/security/lockouts', { auth: true })
      .then((d) => {
        setLockouts(d.lockouts || []);
        setLockSettings(d.settings);
      })
      .catch(() => {});

  useEffect(() => {
    load();
    loadLockouts();
  }, []);

  const lockedIds = new Set(lockouts.map((l) => l.id));

  const unlock = async (id, email) => {
    try {
      await api.post(`/admin/security/lockouts/${id}/clear`, {}, { auth: true });
      toast(`${email} can sign in again.`, 'success');
      await loadLockouts();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0);

  return (
    <div>
      <h2 className="admin-title">Customer Management</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon"><Users size={26} /></div>
          <div className="stat-card-value">{customers.length}</div>
          <div className="stat-card-label">Total Customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><ShoppingCart size={26} /></div>
          <div className="stat-card-value">{customers.filter((c) => c.totalOrders > 0).length}</div>
          <div className="stat-card-label">Active Buyers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Coins size={26} /></div>
          <div className="stat-card-value">{ghs(totalSpent)}</div>
          <div className="stat-card-label">Customer Lifetime Value</div>
        </div>
      </div>

      {lockouts.length > 0 && (
        <div className="alert warn">
          <strong><ShieldAlert size={15} /> {lockouts.length} account{lockouts.length === 1 ? '' : 's'} paused after failed sign-ins</strong>
          <p className="small">
            An account locks for {lockSettings?.lockoutMinutes ?? 15} minutes after{' '}
            {lockSettings?.maxFailedAttempts ?? 10} wrong passwords. The lock lifts by itself, the
            customer can reset their password to get straight back in, or you can clear it now:
          </p>
          {lockouts.map((l) => (
            <p className="small" key={l.id}>
              {l.fullName} ({l.email}) — until {fmtDateTime(l.lockedUntil)}{' '}
              <button className="btn btn-ghost btn-sm" onClick={() => unlock(l.id, l.email)}>
                <Unlock size={13} /> Let them in
              </button>
            </p>
          ))}
        </div>
      )}

      <table className="table">
        <thead>
          <tr><th scope="col">Customer</th><th scope="col">Email</th><th scope="col">Phone</th><th scope="col">Orders</th><th scope="col">Total Spent</th><th scope="col">Member Since</th><th scope="col">Sign-in</th></tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id}>
              <td><strong className="customer-cell"><span className="avatar avatar-sm">{initials(c.fullName)}</span> {c.fullName}</strong></td>
              <td>{c.email}</td>
              <td>{c.phone}</td>
              <td>{c.totalOrders}</td>
              <td>{ghs(c.totalSpent)}</td>
              <td>{fmtDate(c.createdAt)}</td>
              <td>
                {lockedIds.has(c.id) ? (
                  <span className="status-pill pending"><Lock size={11} /> Locked</span>
                ) : (
                  <span className="muted small">OK</span>
                )}
              </td>
            </tr>
          ))}
          {customers.length === 0 && <tr><td colSpan="7" className="centered muted">No customers yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
