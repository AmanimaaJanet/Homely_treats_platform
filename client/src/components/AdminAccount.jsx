import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, KeyRound, LogOut } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

/**
 * "Your admin account" panel (Admin → Settings).
 *
 * The seed prints a published password (`admin123`) so the first sign-in is possible
 * without a database console — which means the very first thing a new bakery should
 * do is change it. This panel is that step, in the place an admin actually looks, and
 * it keeps warning until the default is gone.
 */
export default function AdminAccount() {
  const { user, toast, logout } = useApp();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [stillDefault, setStillDefault] = useState(false);

  useEffect(() => {
    // /auth/me flags the seeded password; the store may hold a stale copy, so ask.
    api
      .get('/auth/me', { auth: true })
      .then((d) => setStillDefault(!!d.user?.usesDefaultPassword))
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) return toast('The two new passwords do not match.', 'error');
    if (pw.next.length < 8) return toast('Use at least 8 characters.', 'error');
    if (!/[A-Za-z]/.test(pw.next) || !/[0-9]/.test(pw.next)) {
      return toast('Include at least one letter and one number.', 'error');
    }
    setSaving(true);
    try {
      await api.put('/auth/password', { currentPassword: pw.current, newPassword: pw.next }, { auth: true });
      setPw({ current: '', next: '', confirm: '' });
      setStillDefault(false);
      toast('Password changed. Any outstanding reset link is now void.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section">
      <h3 className="form-heading">
        <KeyRound size={15} /> Your admin account
      </h3>

      {stillDefault ? (
        <div className="wa-status off" style={{ marginBottom: '14px' }}>
          <ShieldAlert size={16} />
          <span>
            <strong>This account still uses the password printed by the installer.</strong> Anyone who has seen
            the project files can sign in. Change it now — it takes ten seconds.
          </span>
        </div>
      ) : (
        <div className="wa-status on" style={{ marginBottom: '14px' }}>
          <ShieldCheck size={16} />
          <span>Signed in as <strong>{user?.email}</strong> ({user?.role}). Password is not the published default.</span>
        </div>
      )}

      <form onSubmit={submit} className="admin-account-form">
        <div className="form-group">
          <label className="form-label" htmlFor="pw-current">Current password</label>
          <input
            id="pw-current"
            className="form-input"
            type="password"
            autoComplete="current-password"
            required
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pw-next">New password</label>
          <input
            id="pw-next"
            className="form-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pw-confirm">Confirm new password</label>
          <input
            id="pw-confirm"
            className="form-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
        </div>

        <div className="row-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving…' : 'Change password'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            <LogOut size={14} /> Sign out
          </button>
        </div>

        <p className="muted small" style={{ marginTop: '12px' }}>
          Forgot it instead? Sign out and use <strong>Forgot password</strong> on the sign-in screen — with{' '}
          <code>RESEND_API_KEY</code> set, the reset link arrives by email; without it, the link is printed to the
          server console.
        </p>
      </form>
    </div>
  );
}
