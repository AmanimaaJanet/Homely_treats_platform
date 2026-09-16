import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Send } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { pushSupported, pushState, enablePush, disablePush } from '../lib/push.js';

/**
 * "Turn on order alerts" switch (customer account page).
 *
 * Push is the free channel — no SMS credits, no phone number needed — so it is offered
 * plainly rather than buried: one tap, and "your cake is ready" arrives on the lock
 * screen. The test button exists because a notification you never saw is not proof the
 * setup works.
 */
export default function PushToggle({ compact = false }) {
  const { user, toast } = useApp();
  const [state, setState] = useState({ loading: true, supported: true, configured: false, subscribed: false });
  const [busy, setBusy] = useState(false);

  const refresh = () => pushState().then((s) => setState({ loading: false, ...s }));

  useEffect(() => {
    refresh();
  }, [user]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (state.subscribed) {
        await disablePush();
        toast('Order alerts turned off on this device.', 'success');
      } else {
        await enablePush();
        toast('Order alerts are on — we will ping this device when your order is ready.', 'success');
      }
      await refresh();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const res = await api.post('/push/test', {}, { auth: true });
      toast(
        res.simulated
          ? 'Test prepared — add VAPID keys on the server to deliver it for real.'
          : `Test sent to ${res.devices} device${res.devices === 1 ? '' : 's'}.`,
        'success'
      );
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) return null;

  if (!state.supported) {
    return (
      <p className="muted small">
        <BellOff size={14} /> This browser can't show notifications. On iPhone, add Homely Treats to your home
        screen first (Share → Add to Home Screen), then turn alerts on.
      </p>
    );
  }

  if (!state.configured) {
    return (
      <div className="push-panel">
        <p className="muted small" style={{ margin: 0 }}>
          <Bell size={14} /> Order alerts need VAPID keys on the server — generate them with{' '}
          <code>npm run push:keys</code> in <code>server/</code> and add them to <code>.env</code>.
        </p>
      </div>
    );
  }

  return (
    <div className={`push-panel ${compact ? 'compact' : ''}`}>
      <div>
        <strong>
          {state.subscribed ? <BellRing size={16} /> : <Bell size={16} />}{' '}
          {state.subscribed ? 'Order alerts are on for this device' : 'Get order alerts on this device'}
        </strong>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          Free, instant, and no phone number needed: we ping you when the order is confirmed, ready and out for
          delivery.
        </p>
      </div>
      <div className="row-actions">
        <button className={`btn ${state.subscribed ? 'btn-secondary' : 'btn-primary'} btn-sm`} onClick={toggle} disabled={busy}>
          {state.subscribed ? 'Turn off' : 'Turn on alerts'}
        </button>
        {state.subscribed && (
          <button className="btn btn-ghost btn-sm" onClick={sendTest} disabled={busy}>
            <Send size={14} /> Send a test
          </button>
        )}
      </div>
    </div>
  );
}
