import React, { useEffect, useState } from 'react';
import {
  Activity, CheckCircle2, CircleSlash, RefreshCw, BellRing, Trash2, ShieldAlert,
  Server, KeyRound, MessageCircle, Send, Smartphone,
} from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import { fmtDateTime } from '../../lib/format.js';

/**
 * Diagnostics — the answer to "is anything broken right now?"
 *
 * Two panels worth their weight:
 *  1. **What is switched on.** A silent integration (no Paystack key, no VAPID keys, no
 *     WhatsApp token) looks exactly like a working shop until a customer expects a
 *     notification that never comes. This says it plainly.
 *  2. **What has been failing.** The last errors the server saw, each with the request id
 *     that ties it to the full log line, plus any notification that failed to send in the
 *     last week — usually the first sign a customer is about to phone.
 */

const INTEGRATIONS = [
  { key: 'paystack', label: 'Paystack (mobile money & cards)', hint: 'PAYSTACK_SECRET_KEY + PAYSTACK_PUBLIC_KEY' },
  { key: 'resend', label: 'Email (Resend)', hint: 'RESEND_API_KEY' },
  { key: 'whatsapp', label: 'WhatsApp Cloud API', hint: 'WHATSAPP_TOKEN + WHATSAPP_PHONE_ID' },
  { key: 'push', label: 'Web push (PWA alerts)', hint: 'VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY' },
  { key: 'turnstile', label: 'Cloudflare Turnstile (bot check)', hint: 'TURNSTILE_SECRET_KEY' },
  { key: 'cloudinary', label: 'Cloudinary (photo storage)', hint: 'CLOUDINARY_* — optional, local disk is fine' },
];

function StatusDot({ ok, label }) {
  return ok ? (
    <span className="status-pill completed"><CheckCircle2 size={11} /> {label || 'on'}</span>
  ) : (
    <span className="status-pill pending"><CircleSlash size={11} /> {label || 'not set'}</span>
  );
}

export default function Diagnostics() {
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get('/admin/diagnostics', { auth: true })
      .then(setData)
      .catch((err) => toast(err.message, 'error'));

  useEffect(() => {
    load();
  }, []);

  const sendTest = async () => {
    setBusy(true);
    try {
      const res = await api.post('/admin/diagnostics/test-alert', {}, { auth: true });
      toast(
        res.sentryConfigured
          ? 'Test error captured and sent to Sentry.'
          : 'Test error captured. Add SENTRY_DSN to also ship these to Sentry.',
        'success'
      );
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const clearList = async () => {
    setBusy(true);
    try {
      const res = await api.del('/admin/diagnostics/errors', { auth: true });
      toast(`Cleared ${res.cleared} error${res.cleared === 1 ? '' : 's'}.`, 'success');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="empty-state"><p>Checking the shop…</p></div>;

  const { integrations } = data;

  return (
    <div>
      <div className="section-head-row">
        <h2 className="admin-title"><Activity size={20} /> Diagnostics</h2>
        <div className="row-actions">
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={busy}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-secondary btn-sm" onClick={sendTest} disabled={busy}>
            <BellRing size={14} /> Send a test alert
          </button>
        </div>
      </div>

      <div className="diag-grid">
        <div className="section">
          <h3 className="form-heading"><Server size={16} /> Server</h3>
          <dl className="diag-list">
            <div><dt>Release</dt><dd>{data.release}</dd></div>
            <div><dt>Environment</dt><dd>{data.environment}</dd></div>
            <div>
              <dt>Up for</dt>
              <dd>
                {Math.floor(data.uptimeSeconds / 3600)}h {Math.floor((data.uptimeSeconds % 3600) / 60)}m
              </dd>
            </div>
            <div>
              <dt>Error reporting</dt>
              <dd>
                <StatusDot ok={data.monitoring.sentryConfigured} label={data.monitoring.sentryConfigured ? 'Sentry' : 'log + this screen'} />
              </dd>
            </div>
            <div>
              <dt>Errors buffered</dt>
              <dd>{data.monitoring.bufferedErrors} of 50</dd>
            </div>
          </dl>
        </div>

        <div className="section">
          <h3 className="form-heading"><KeyRound size={16} /> Integrations</h3>
          <dl className="diag-list">
            {INTEGRATIONS.map((i) => (
              <div key={i.key}>
                <dt title={i.hint}>{i.label}</dt>
                <dd><StatusDot ok={Boolean(integrations[i.key])} /></dd>
              </div>
            ))}
            <div>
              <dt>SMS ({integrations.sms?.provider || 'none'})</dt>
              <dd><StatusDot ok={integrations.sms?.configured} label={integrations.sms?.configured ? 'key set' : 'console only'} /></dd>
            </div>
          </dl>
          <p className="muted small">
            Anything showing “not set” still works — it prints what it would have sent to the server
            log. Set the key before the shop goes live.
          </p>
        </div>

        <div className="section">
          <h3 className="form-heading"><Send size={16} /> Notifications (last 7 days)</h3>
          {Object.keys(data.notifications.channels).length === 0 ? (
            <p className="muted small">Nothing sent in the last week.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Channel</th><th>Sent</th><th>Simulated</th><th>Failed</th></tr>
              </thead>
              <tbody>
                {Object.entries(data.notifications.channels).map(([channel, counts]) => (
                  <tr key={channel}>
                    <td>{channel}</td>
                    <td>{counts.sent}</td>
                    <td>{counts.simulated}</td>
                    <td className={counts.failed > 0 ? 'danger-text' : ''}>{counts.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.notifications.failedLast7Days > 0 && (
            <p className="small danger-text">
              <ShieldAlert size={13} /> {data.notifications.failedLast7Days} notification
              {data.notifications.failedLast7Days === 1 ? '' : 's'} could not be delivered. A customer may be
              waiting on a message that never arrived — check Admin → Orders for the order, or the phone number
              used.
            </p>
          )}
          <p className="muted small">
            <Smartphone size={12} /> SMS and WhatsApp fail first when a key is missing or a number is wrong;
            email and push are independent, so the customer usually still hears.
          </p>
        </div>

        <div className="section">
          <h3 className="form-heading"><ShieldAlert size={16} /> Recent errors</h3>
          {data.recentErrors.length === 0 ? (
            <p className="muted small">
              <CheckCircle2 size={13} /> Nothing has failed since the server started.
            </p>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={clearList} disabled={busy}>
                <Trash2 size={13} /> Clear this list
              </button>
              <div className="error-list">
                {data.recentErrors.map((e, i) => (
                  <div className="error-item" key={`${e.at}-${i}`}>
                    <div className="error-item-head">
                      <span className="error-badge">{e.status || 500}</span>
                      <strong>{e.message}</strong>
                    </div>
                    <p className="muted small">
                      {fmtDateTime(e.at)}
                      {e.method ? ` · ${e.method} ${e.route || ''}` : ''}
                      {e.requestId ? ` · ref ${e.requestId}` : ''}
                    </p>
                    {e.stack && <pre className="error-stack">{e.stack.split('\n').slice(0, 3).join('\n')}</pre>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
