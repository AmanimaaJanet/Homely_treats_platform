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

export default function Register() {
  const navigate = useNavigate();
  const { login, toast } = useApp();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast('Password must be at least 8 characters', 'error');
      return;
    }
    if (form.password !== form.confirm) {
      toast('Passwords do not match', 'error');
      return;
    }
    setBusy(true);
    try {
      const { token, user } = await api.post('/auth/register', {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      login(token, user);
      toast('Account created! Check your email to verify.', 'success');
      navigate('/account');
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
        <p>Create an account to manage your orders, track deliveries, and save your favourite customisations.</p>
        <ul className="auth-perks">
          {PERKS.map((p) => (
            <li key={p}><Check size={15} /> {p}</li>
          ))}
        </ul>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <h2>Create Account</h2>
          <p className="muted" style={{ marginBottom: '2rem' }}>Join Homely Treats — it takes less than a minute</p>

          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" required value={form.fullName} onChange={set('fullName')} />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" required value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="tel" className="form-input" required value={form.phone} onChange={set('phone')} placeholder="055 123 4567" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-input" required minLength={8} value={form.confirm} onChange={set('confirm')} />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Creating…' : 'Create Account'}
            </button>
          </form>

          <p className="centered" style={{ marginTop: '1.5rem' }}>
            Already have an account? <Link to="/signin" className="link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
