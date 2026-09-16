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
    `\n[SIMULATED EMAIL] to: ${to}\n   subject: ${subject}\n` +
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

/**
 * Branded order email — matches the storefront theme
 * (terracotta #C4763B · cream #FDF8F3 · dark chocolate #2C1A0E · gold #E8B86D).
 * Icons are intentionally omitted: email clients can't render the Lucide SVG set.
 */
export function orderEmailTemplate({ subject, headline, bodyLines, order, ctaUrl }) {
  const items = (order.items || [])
    .map(
      (i) =>
        `<li style="margin:4px 0; color:#2C1A0E;">${i.name} × ${i.quantity} — GH₵ ${fmt(
          i.price * i.quantity
        )}</li>`
    )
    .join('');
  return `
  <div style="font-family: 'DM Sans', Helvetica, Arial, sans-serif; max-width: 560px; margin: auto; background:#FDF8F3; border:1px solid #E8D5C0; border-radius:14px; overflow:hidden;">
    <div style="background:#2C1A0E; padding:26px 24px; color:#fff;">
      <p style="margin:0; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:#E8B86D;">Homely Treats</p>
      <h1 style="margin:8px 0 0; font-family: Georgia, 'Times New Roman', serif; font-size:23px; font-weight:700;">${headline}</h1>
    </div>
    <div style="padding:24px;">
      ${bodyLines.map((l) => `<p style="margin:8px 0; color:#7A5C44; line-height:1.6;">${l}</p>`).join('')}
      <div style="background:#F5E6D0; border-radius:10px; padding:16px; margin:18px 0;">
        <ul style="margin:0; padding-left:18px;">${items}</ul>
        <p style="margin:10px 0 0; color:#7B3F1A;"><strong>Total: GH₵ ${fmt(order.total)}</strong></p>
      </div>
      ${
        ctaUrl
          ? `<a href="${ctaUrl}" style="display:inline-block; background:#C4763B; color:#fff; padding:13px 26px; border-radius:100px; text-decoration:none; font-weight:bold;">Track your order</a>`
          : ''
      }
      <p style="margin-top:22px; color:#7A5C44; font-size:12px; border-top:1px solid #E8D5C0; padding-top:14px;">
        Homely Treats · Airport Residential, Accra<br />Order ${order.id}
      </p>
    </div>
  </div>`;
}

export function fmt(n) {
  return Number(n || 0).toFixed(2);
}
