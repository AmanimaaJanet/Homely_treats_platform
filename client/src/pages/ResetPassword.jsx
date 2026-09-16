import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Cake, Check, ShieldCheck, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

const PERKS = [
  'At least 8 characters',
  'A mix of letters and numbers',
  'Something only you would know',
];

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useApp();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Use at least 8 characters, including a letter and a number.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      toast('Password updated — please sign in', 'success');
      setTimeout(() => navigate('/signin'), 2200);
    } catch (err) {
      setError(err.message || 'This reset link is invalid or has expired.');
    } finally {
      setBusy(false);
    }
  };

  // No token in the URL at all — nothing to reset.
  if (!token) {
    return (
      <div className="auth-wrap">
        <div className="auth-side">
          <Link to="/" className="logo">Homely Treats</Link>
          <div className="auth-logo warn"><AlertTriangle size={44} strokeWidth={1.6} /></div>
          <p>That reset link is incomplete.</p>
        </div>
        <div className="auth-main">
          <div className="auth-card">
            <h2>Link not valid</h2>
            <p className="muted" style={{ marginBottom: '2rem' }}>
              This page needs a reset link from your email. Request a fresh one and try again.
            </p>
            <Link to="/forgot-password" className="btn btn-primary btn-block">Request a new link</Link>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-wrap">
        <div className="auth-side">
          <Link to="/" className="logo">Homely Treats</Link>
          <div className="auth-logo ok"><ShieldCheck size={44} strokeWidth={1.6} /></div>
          <p>Your new password is saved. Taking you to sign in…</p>
        </div>
        <div className="auth-main">
          <div className="auth-card">
            <h2>Password updated</h2>
            <p className="muted" style={{ marginBottom: '2rem' }}>
              You can now sign in with your new password.
            </p>
            <Link to="/signin" className="btn btn-primary btn-block">Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <Link to="/" className="logo">Homely Treats</Link>
        <div className="auth-logo"><Cake size={44} strokeWidth={1.6} /></div>
        <p>Choose a new password for your account.</p>
        <ul className="auth-perks">
          {PERKS.map((p) => (
            <li key={p}><Check size={15} /> {p}</li>
          ))}
        </ul>
      </div>

      <div className="auth-main">
        <div className="auth-card">
          <h2>Choose a new password</h2>
          <p className="muted" style={{ marginBottom: '2rem' }}>
            Pick something strong — you&apos;ll use it every time you order.
          </p>

          {error && (
            <div className="alert alert-error" role="alert">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">New password</label>
              <div className="input-affix">
                <input
                  type={show ? 'text' : 'password'}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="input-affix-btn"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm new password</label>
              <input
                type={show ? 'text' : 'password'}
                className="form-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy || !password || !confirm}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </form>

          <p className="muted small" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            Link not working? <Link to="/forgot-password" className="btn-link">Request a new one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
