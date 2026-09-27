import React, { useEffect, useState } from 'react';
import { MessageCircle, Copy, Check, Send, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';

/**
 * WhatsApp template manager (Admin → Settings).
 *
 * WhatsApp only allows free-form text within 24 hours of the customer's last
 * message; every other update must use a template Meta has approved. This panel
 * shows each template's exact name, language, variable order and the body text to
 * paste into Meta Business Manager, plus a test send so the bakery can prove it
 * works before relying on it.
 */
export default function WhatsAppTemplates() {
  const { toast } = useApp();
  const [data, setData] = useState(null);
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('ORDER_CONFIRMED');
  const [sending, setSending] = useState(false);
  const [openType, setOpenType] = useState(null);
  const [copied, setCopied] = useState(null);

  const load = () =>
    api
      .get('/admin/whatsapp/templates', { auth: true })
      .then(setData)
      .catch(() => setData(null));

  useEffect(() => {
    load();
  }, []);

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast('Copy failed — select the text manually.', 'error');
    }
  };

  const sendTest = async () => {
    if (!phone) return toast('Enter the phone number to send the test to.', 'error');
    setSending(true);
    try {
      const res = await api.post('/admin/whatsapp/test', { phone, type }, { auth: true });
      toast(
        res.simulated
          ? `Simulated send of “${res.template}” to ${res.to}. Add WHATSAPP_TOKEN to send for real.`
          : `Test message “${res.template}” sent to ${res.to}.`,
        'success'
      );
      setOpenType(type);
    } catch (err) {
      toast(err.message, 'error');
      setOpenType(type);
    } finally {
      setSending(false);
    }
  };

  if (!data) return null;

  return (
    <div className="section">
      <h3 className="form-heading">
        <MessageCircle size={15} /> WhatsApp templates
      </h3>

      <p className="muted small">
        WhatsApp only allows plain replies within <strong>24 hours</strong> of the customer's last message.
        Everything else — “your order is ready”, “out for delivery” — must use an approved template, which is
        why the app sends templates by default and falls back to plain text automatically.
      </p>

      <div className={`wa-status ${data.enabled ? 'on' : 'off'}`}>
        {data.enabled ? (
          <>
            <Check size={15} /> <strong>Connected.</strong> WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set,
            so messages go out through the Cloud API.
          </>
        ) : (
          <>
            <AlertTriangle size={15} /> <strong>Not connected yet.</strong> Without{' '}
            <code>WHATSAPP_TOKEN</code> and <code>WHATSAPP_PHONE_NUMBER_ID</code> in <code>server/.env</code>{' '}
            every message is simulated and printed to the server console — nothing is sent to customers.
          </>
        )}
      </div>

      <p className="muted small">
        Full setup steps, including the exact text to paste into Meta Business Manager, are in{' '}
        <code>WHATSAPP_TEMPLATES.md</code> at the top of the project.
      </p>

      <div className="wa-test">
        <label className="form-label" htmlFor="wa-phone">Send a test message</label>
        <div className="row-actions">
          <input
            id="wa-phone"
            className="form-input"
            placeholder="0551234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ maxWidth: '200px' }}
          />
          <select aria-label="Message template to send" className="form-select" value={type} onChange={(e) => setType(e.target.value)} style={{ maxWidth: '240px' }}>
            {data.templates.map((t) => (
              <option key={t.type} value={t.type}>{t.type.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={sendTest} disabled={sending}>
            <Send size={14} /> {sending ? 'Sending…' : 'Send test'}
          </button>
        </div>
      </div>

      <div className="wa-list">
        {data.templates.map((t) => {
          const open = openType === t.type;
          return (
            <div className={`wa-row ${open ? 'open' : ''}`} key={t.type}>
              <button
                type="button"
                className="wa-row-head"
                onClick={() => setOpenType(open ? null : t.type)}
                aria-expanded={open}
              >
                <span className="wa-row-title">
                  <strong>{t.type.replace(/_/g, ' ').toLowerCase()}</strong>
                  <code className="wa-name">{t.name}</code>
                  <span className="wa-lang">{t.language}</span>
                </span>
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {open && (
                <div className="wa-row-body">
                  <div className="wa-field">
                    <span className="print-label">Template name for Meta</span>
                    <div className="row-actions">
                      <code className="wa-code">{t.name}</code>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => copy(t.name, `${t.type}-name`)}
                      >
                        {copied === `${t.type}-name` ? <Check size={14} /> : <Copy size={14} />}
                        {copied === `${t.type}-name` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="wa-field">
                    <span className="print-label">
                      Body text to paste into Meta ({t.vars.length} variable{t.vars.length === 1 ? '' : 's'}, in order)
                    </span>
                    <div className="wa-body">
                      <code>{t.body}</code>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => copy(t.body, `${t.type}-body`)}
                      >
                        {copied === `${t.type}-body` ? <Check size={14} /> : <Copy size={14} />}
                        {copied === `${t.type}-body` ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <ol className="wa-vars">
                      {t.vars.map((v, i) => (
                        <li key={v}><code>{`{{${i + 1}}}`}</code> {v}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="wa-field">
                    <span className="print-label">What the customer sees (sample values)</span>
                    <div className="wa-bubble">
                      <p>{t.preview}</p>
                    </div>
                    <p className="muted small">
                      Category to choose in Meta: <strong>{t.category}</strong> — utility templates keep the
                      cost down and are approved without marketing review.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
