import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cake, Check } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

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
    <div className="page">
      <div className="container">
        <div className="auth-card section">
          <div className="centered">
            <div className="auth-logo"><Cake size={44} strokeWidth={1.6} /></div>
            <h2>Homely Treats</h2>
            <p className="muted">Sign in to manage your orders, track deliveries, and save your favourite customisations.</p>
            <ul className="auth-perks">
              <li><Check size={15} /> Track all your orders in real time</li>
              <li><Check size={15} /> Save custom order templates</li>
              <li><Check size={15} /> Get exclusive deals & notifications</li>
            </ul>
          </div>

          <h3 className="form-heading">Welcome Back</h3>
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
              {busy ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <p className="centered" style={{ marginTop: '1.5rem' }}>
            Don't have an account? <Link to="/register" className="link">Create one →</Link>
          </p>

          <div className="demo-cred">
            <p className="muted small">Demo accounts:</p>
            <p className="small"><strong>Customer:</strong> janet@homelytreats.gh / password123</p>
            <p className="small"><strong>Admin:</strong> admin@homelytreats.gh / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
