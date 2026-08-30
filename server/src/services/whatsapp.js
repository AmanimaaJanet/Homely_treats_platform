import { config } from '../config.js';
import { prisma } from '../prisma.js';

/**
 * WhatsApp notifications via Meta's WhatsApp Cloud API.
 *  - Business-initiated messages need an approved template; for the free test
 *    number you can message yourself freely. Set WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID.
 *  - Falls back to console logging when not configured / on failure.
 */
export async function sendWhatsApp({ phone, message, orderId, type }) {
  const to = normalizeGhPhone(phone);
  if (!to) {
    await logNotification(orderId, 'WHATSAPP', type, 'FAILED', 'invalid phone');
    return { ok: false, error: 'invalid phone number' };
  }
  if (!config.whatsapp.enabled) {
    console.log(`\n💬 [SIMULATED WHATSAPP] to: ${to}\n   ${message}\n`);
    await logNotification(orderId, 'WHATSAPP', type, 'SIMULATED', to);
    return { ok: true, simulated: true };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${config.whatsapp.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `WhatsApp error ${res.status}`);
    await logNotification(orderId, 'WHATSAPP', type, 'SENT', to);
    return { ok: true };
  } catch (err) {
    console.warn(`[whatsapp] send failed for ${to}:`, err.message);
    await logNotification(orderId, 'WHATSAPP', type, 'FAILED', `${to} — ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/** Convert Ghana local formats to E.164 (international WhatsApp format). */
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
    console.error('[whatsapp] failed to log notification:', err.message);
  }
}
