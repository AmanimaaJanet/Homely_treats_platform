import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../api.js';

/**
 * Landing page after Paystack redirects the customer back.
 * Verifies the transaction server-side, then shows the tracking page.
 */
export default function PayCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState('Verifying your payment…');

  useEffect(() => {
    const reference = params.get('reference');
    const orderId = params.get('order');
    if (!reference) {
      setMessage('No payment reference found.');
      return;
    }
    api
      .post('/payments/verify', { reference })
      .then((res) => navigate(`/track?ref=${res.orderId || orderId}`))
      .catch((err) => {
        setMessage(err.message);
        if (orderId) setTimeout(() => navigate(`/track?ref=${orderId}`), 2500);
      });
  }, [params, navigate]);

  return (
    <div className="page">
      <div className="container">
        <div className="auth-card section centered">
          <div className="auth-logo"><Loader2 size={44} strokeWidth={1.6} className="spin" /></div>
          <h2>{message}</h2>
        </div>
      </div>
    </div>
  );
}
