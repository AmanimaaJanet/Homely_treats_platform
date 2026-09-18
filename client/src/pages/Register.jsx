import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cake, Check } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import Seo from '../components/Seo.jsx';

const PERKS = [
  'Track all your orders in real time',
  'Past guest orders are added to your history automatically',
  'Save custom order templates',
  'Get exclusive deals and restock alerts',
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
      const { token, user, claimedOrders } = await api.post('/auth/register', {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      login(token, user);
      // Orders placed as a guest are attached to the new account, so say so — otherwise
      // a returning customer has no way of knowing their history came with them.
      toast(
        claimedOrders > 0
          ? `Account created — we found ${claimedOrders} earlier order${claimedOrders === 1 ? '' : 's'} and added them here.`
          : 'Account created! Check your email to verify.',
        'success'
      );
      navigate('/account');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
    <Seo title="Create an Account" description="Create a Homely Treats account to order faster and earn loyalty points." noindex />
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
              <label className="form-label">
                <span className="form-label-text">Full Name</span>
                <input className="form-input" required value={form.fullName} onChange={set('fullName')} />
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">
                <span className="form-label-text">Email Address</span>
                <input type="email" className="form-input" required value={form.email} onChange={set('email')} />
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">
                <span className="form-label-text">Phone Number</span>
                <input type="tel" className="form-input" required value={form.phone} onChange={set('phone')} placeholder="055 123 4567" />
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">
                <span className="form-label-text">Password</span>
                <input type="password" className="form-input" required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">
                <span className="form-label-text">Confirm Password</span>
                <input type="password" className="form-input" required minLength={8} value={form.confirm} onChange={set('confirm')} />
              </label>
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
