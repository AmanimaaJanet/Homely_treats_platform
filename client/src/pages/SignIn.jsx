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

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token, user } = await api.post('/auth/login', { email, password });
      login(token, user);
      toast(`Welcome back, ${user.fullName.split(' ')[0]}!`, 'success');
      navigate(user.role === 'ADMIN' ? '/admin' : '/account');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
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
