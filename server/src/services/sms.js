import { config } from '../config.js';
import { prisma } from '../prisma.js';

/**
 * SMS service with pluggable providers:
 *  - textbelt: free tier (1/day) — note: free tier is blocked for some countries (incl. Ghana)
 *  - arkesel: Ghana-based, free signup with trial credits (recommended for GH numbers)
 * When no usable key is present (or delivery fails), messages fall back to the
 * server console so order flows never break.
 */
export async function sendSms({ phone, message, orderId, type }) {
  const to = normalizeGhPhone(phone);
  if (!to) {
    await logNotification(orderId, 'SMS', type, 'FAILED', 'invalid phone');
    return { ok: false, error: 'invalid phone number' };
  }

  let result;
  try {
    if (config.sms.provider === 'arkesel' && config.sms.arkeselKey) {
      result = await sendArkesel(to, message);
    } else {
      result = await sendTextbelt(to, message);
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  if (result.ok) {
    await logNotification(orderId, 'SMS', type, 'SENT', to);
    return { ok: true };
  }
  // Quota/network/provider failure — log and continue (never crash the order).
  console.warn(`[sms] provider error for ${to} (${config.sms.provider}):`, result.error);
  console.log(`[sms] message: ${message}`);
  await logNotification(orderId, 'SMS', type, 'FAILED', `${to} — ${result.error}`);
  return { ok: false, error: result.error };
}

async function sendTextbelt(to, message) {
  const res = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: to, message, key: config.sms.apiKey, sender: config.sms.sender }),
  });
  const data = await res.json();
  if (data.success) return { ok: true };
  return { ok: false, error: data.error || 'textbelt error' };
}

async function sendArkesel(to, message) {
  const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: { 'api-key': config.sms.arkeselKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: config.sms.sender,
      message,
      recipients: [to],
    }),
  });
  const data = await res.json();
  if (res.ok && data.status === 'ok') return { ok: true };
  return { ok: false, error: data.message || `arkesel error ${res.status}` };
}

/** Convert Ghana local formats (0551234567 / 055 123 4567 / +233...) to E.164. */
export function normalizeGhPhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('233') && p.length === 12) return p;
  if (p.startsWith('0') && p.length === 10) return '233' + p.slice(1);
  if (p.length === 9) return '233' + p;
  return null;
}

async function logNotification(orderId, channel, type, status, detail) {
  if (!orderId) return;
  try {
    await prisma.notification.create({
      data: { orderId, channel, type, status, detail },
    });
  } catch (err) {
    console.error('[sms] failed to log notification:', err.message);
  }
}
