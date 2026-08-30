import { config } from '../config.js';
import { prisma } from '../prisma.js';

/**
 * Email service powered by Resend.
 * When RESEND_API_KEY is not set, emails are "simulated": printed to the
 * server console and recorded as SIMULATED so the app still works end-to-end
 * for demos without any credentials.
 */
export async function sendEmail({ to, subject, html, orderId, type }) {
  if (config.resend.enabled) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.resend.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.resend.from,
          to: [to],
          subject,
          html,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `Resend error ${res.status}`);
      await logNotification(orderId, 'EMAIL', type, 'SENT', to);
      return { ok: true, simulated: false };
    } catch (err) {
      console.error('[email] send failed:', err.message);
      await logNotification(orderId, 'EMAIL', type, 'FAILED', `${to} — ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  // Simulation mode
  console.log(
    `\n📧 [SIMULATED EMAIL] to: ${to}\n   subject: ${subject}\n` +
      `   body: ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)}…\n`
  );
  await logNotification(orderId, 'EMAIL', type, 'SIMULATED', to);
  return { ok: true, simulated: true };
}

async function logNotification(orderId, channel, type, status, detail) {
  if (!orderId) return;
  try {
    await prisma.notification.create({
      data: { orderId, channel, type, status, detail },
    });
  } catch (err) {
    console.error('[email] failed to log notification:', err.message);
  }
}

export function orderEmailTemplate({ subject, headline, bodyLines, order, ctaUrl }) {
  const items = (order.items || [])
    .map((i) => `<li>${i.emoji} ${i.name} × ${i.quantity} — GH₵ ${fmt(i.price * i.quantity)}</li>`)
    .join('');
  return `
  <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; background:#fff; border:1px solid #eee; border-radius:12px; overflow:hidden;">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2); padding:24px; color:#fff;">
      <h1 style="margin:0;">Homely Treats</h1>
      <p style="margin:6px 0 0; opacity:.9;">${headline}</p>
    </div>
    <div style="padding:24px;">
      ${bodyLines.map((l) => `<p style="margin:8px 0; color:#333;">${l}</p>`).join('')}
      <div style="background:#f8f9fa; border-radius:8px; padding:16px; margin:16px 0;">
        <ul style="margin:0; padding-left:18px;">${items}</ul>
        <p style="margin:8px 0 0;"><strong>Total: GH₵ ${fmt(order.total)}</strong></p>
      </div>
      ${
        ctaUrl
          ? `<a href="${ctaUrl}" style="display:inline-block; background:#e91e63; color:#fff; padding:12px 24px; border-radius:24px; text-decoration:none; font-weight:bold;">Track your order →</a>`
          : ''
      }
      <p style="margin-top:20px; color:#888; font-size:12px;">Homely Treats · Airport Residential, Accra · ${order.id}</p>
    </div>
  </div>`;
}

export function fmt(n) {
  return Number(n || 0).toFixed(2);
}
