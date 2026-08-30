import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailCheck, CheckCircle2, TriangleAlert } from 'lucide-react';
import { api } from '../api.js';

export default function Verify() {
  const [params] = useSearchParams();
  const [state, setState] = useState('verifying'); // verifying | ok | error

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('error');
      return;
    }
    api
      .get(`/auth/verify?token=${token}`)
      .then(() => setState('ok'))
      .catch(() => setState('error'));
  }, [params]);

  return (
    <div className="page">
      <div className="container">
        <div className="auth-card section centered">
          {state === 'verifying' && (
            <>
              <div className="auth-logo"><MailCheck size={44} strokeWidth={1.6} /></div>
              <h2>Verifying your email…</h2>
            </>
          )}
          {state === 'ok' && (
            <>
              <div className="auth-logo ok"><CheckCircle2 size={44} strokeWidth={1.6} /></div>
              <h2>Email verified!</h2>
              <p className="muted">Your account is now fully active.</p>
              <Link to="/signin" className="btn btn-primary" style={{ marginTop: '1rem' }}>Continue to Sign In →</Link>
            </>
          )}
          {state === 'error' && (
            <>
              <div className="auth-logo warn"><TriangleAlert size={44} strokeWidth={1.6} /></div>
              <h2>Verification failed</h2>
              <p className="muted">This link is invalid or has expired.</p>
              <Link to="/signin" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Sign In</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
