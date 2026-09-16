import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cake, Check } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

const PERKS = [
  'Track all your orders in real time',
  'Save custom order templates',
  'Get exclusive deals & notifications',
];

export default function SignIn() {
  const navigate = useNavigate();
  const { login, toast } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [unverified, setUnverified] = useState(null);
  const [resending, setResending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setUnverified(null);
    setBusy(true);
    try {
      const { token, user } = await api.post('/auth/login', { email, password });
      login(token, user);
      toast(`Welcome back, ${user.fullName.split(' ')[0]}!`, 'success');
      navigate(user.role === 'ADMIN' ? '/admin' : user.role === 'RIDER' ? '/rider' : '/account');
    } catch (err) {
      // The address exists but hasn't been confirmed yet — offer to resend the
      // link rather than leaving the customer stuck.
      if (err.code === 'EMAIL_NOT_VERIFIED') setUnverified(err.email || email);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      await api.post('/auth/resend-verification', { email: unverified });
      toast('Verification email sent — please check your inbox', 'success');
    } catch {
      toast('Could not send the email. Please sign in again to retry.', 'error');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <Link to="/" className="logo">Homely Treats</Link>
        <div className="auth-logo"><Cake size={44} strokeWidth={1.6} /></div>
        <p>Sign in to manage your orders, track deliveries, and save your favourite customisations.</p>
        <ul className="auth-perks">
          {PERKS.map((p) => (
            <li key={p}><Check size={15} /> {p}</li>
          ))}
        </ul>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <h2>Welcome Back</h2>
          <p className="muted" style={{ marginBottom: '2rem' }}>Sign in to your account to continue</p>

          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {unverified && (
            <div className="alert alert-error" style={{ marginTop: '1rem' }} role="alert">
              <div>
                <strong>Please confirm your email</strong>
                <p className="small" style={{ margin: '4px 0 8px' }}>
                  We sent a verification link to <strong>{unverified}</strong>.
                </p>
                <button className="btn-link" onClick={resendVerification} disabled={resending}>
                  {resending ? 'Sending…' : 'Resend the link'}
                </button>
              </div>
            </div>
          )}

          <p className="centered" style={{ marginTop: '1.25rem' }}>
            <Link to="/forgot-password" className="link">Forgot your password?</Link>
          </p>

          <p className="centered" style={{ marginTop: '1.5rem' }}>
            Don't have an account? <Link to="/register" className="link">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
