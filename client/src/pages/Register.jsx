import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cake } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

export default function Register() {
  const navigate = useNavigate();
  const { login, toast } = useApp();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
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
    <div className="page">
      <div className="container">
        <div className="auth-card section">
          <div className="centered">
            <div className="auth-logo"><Cake size={44} strokeWidth={1.6} /></div>
            <h2>Homely Treats</h2>
            <p className="muted">Join thousands of satisfied Homely Treats customers.</p>
          </div>

          <h3 className="form-heading">Your Details</h3>
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
              <input type="password" className="form-input" required minLength={6} value={form.password} onChange={set('password')} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-input" required minLength={6} value={form.confirm} onChange={set('confirm')} />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Creating…' : 'Create Account →'}
            </button>
          </form>

          <p className="centered" style={{ marginTop: '1.5rem' }}>
            Already have an account? <Link to="/signin" className="link">Sign in →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
