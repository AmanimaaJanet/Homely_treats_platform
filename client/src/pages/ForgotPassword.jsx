import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cake, Check, Mail, KeyRound } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

const PERKS = [
  'The reset link expires in 30 minutes',
  'Each link works only once',
  'Your order history stays safe',
];

export default function ForgotPassword() {
  const { toast } = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      // The API always answers the same way, so we show the same confirmation
      // whether or not the address exists (no account enumeration).
      setSent(true);
    } catch (err) {
      toast(err.message || 'Could not send the reset email. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <Link to="/" className="logo">Homely Treats</Link>
        <div className="auth-logo"><KeyRound size={44} strokeWidth={1.6} /></div>
        <p>Forgot your password? It happens. We&apos;ll help you back into your account.</p>
        <ul className="auth-perks">
          {PERKS.map((p) => (
            <li key={p}><Check size={15} /> {p}</li>
          ))}
        </ul>
      </div>

      <div className="auth-main">
        <div className="auth-card">
          {sent ? (
            <>
              <div className="auth-logo ok"><Mail size={40} strokeWidth={1.6} /></div>
              <h2>Check your email</h2>
              <p className="muted" style={{ marginBottom: '2rem' }}>
                If <strong>{email}</strong> is registered with us, a reset link is on its way.
                Please check your spam folder too.
              </p>
              <Link to="/signin" className="btn btn-primary btn-block">Back to sign in</Link>
              <p className="muted small" style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button className="btn-link" onClick={() => { setSent(false); setEmail(''); }}>
                  Use a different email
                </button>
              </p>
            </>
          ) : (
            <>
              <h2>Reset your password</h2>
              <p className="muted" style={{ marginBottom: '2rem' }}>
                Enter your email address and we&apos;ll send you a link to choose a new password.
              </p>

              <form onSubmit={submit}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    autoFocus
                  />
                </div>
                <button className="btn btn-primary btn-block" disabled={busy || !email}>
                  {busy ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="muted small" style={{ textAlign: 'center', marginTop: '1.25rem' }}>
                Remembered it? <Link to="/signin" className="btn-link">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
