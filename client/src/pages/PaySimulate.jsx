import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

/**
 * Demo payment screen — shown only when Paystack keys are NOT configured.
 * Simulates the MoMo prompt experience and marks the order paid locally.
 */
export default function PaySimulate() {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const navigate = useNavigate();
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!orderId) navigate('/');
  }, [orderId, navigate]);

  const pay = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/${orderId}/simulate`);
      toast('Payment received! Confirmation sent.', 'success');
      navigate(`/track?ref=${orderId}`);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="auth-card section centered">
          <div className="auth-logo"><Smartphone size={44} strokeWidth={1.6} /></div>
          <h2>Simulated Payment</h2>
          <p className="muted">
            This is a <strong>demo payment screen</strong> — Paystack keys aren't configured yet, so
            this simulates an MTN MoMo payment.
          </p>

          <div className="sim-prompt">
            <p className="small muted">Order</p>
            <p><strong>{orderId}</strong></p>
            <div className="sim-divider" />
            <p className="small muted">Simulating</p>
            <p><Smartphone size={16} /> MTN Mobile Money prompt → confirm payment</p>
          </div>

          <button className="btn btn-primary btn-block" onClick={pay} disabled={busy}>
            {busy ? 'Confirming…' : 'Confirm Payment (Simulate)'}
          </button>
          <button className="btn btn-secondary btn-block" style={{ marginTop: '0.75rem' }} onClick={() => navigate('/cart')}>
            ← Back to Cart
          </button>
          <p className="muted small" style={{ marginTop: '1rem' }}>
            To go live, add your Paystack keys to <code>server/.env</code> — this screen is replaced by Paystack's hosted checkout.
          </p>
        </div>
      </div>
    </div>
  );
}
