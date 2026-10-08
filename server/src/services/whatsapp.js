import { config } from '../config.js';
import { prisma } from '../prisma.js';
import { getSettings } from './settings.js';
import { buildTemplate, templateFor, templateComponents } from './whatsappTemplates.js';

/**
 * WhatsApp notifications via Meta's WhatsApp Cloud API.
 *
 * Two ways to send, and the difference matters in production:
 *   • **Template** (default): an approved template with ordered variables. This is
 *     the only thing WhatsApp allows outside the 24 hours after the customer last
 *     messaged the business — which is exactly when most of our updates are sent.
 *   • **Free-form text**: allowed inside that 24-hour window, and used as the
 *     fallback when a template send is refused (template still in review, name
 *     changed in Meta, parameter mismatch). If that also fails, the notification
 *     is logged FAILED — SMS and email still carry the message, so the customer is
 *     never left uninformed.
 *
 * Without WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID everything is simulated and
 * printed to the console, so the app works end to end during development.
 */
export async function sendWhatsApp({ phone, message, orderId, type, order, baseUrl }) {
  const to = normalizeGhPhone(phone);
  if (!to) {
    await logNotification(orderId, 'WHATSAPP', type, 'FAILED', 'invalid phone');
    return { ok: false, error: 'invalid phone number' };
  }

  const settings = await getSettings();
  const useTemplates = settings.whatsappTemplates !== false;
  const tpl = templateFor(type);
  const language = settings.whatsappTemplateLanguage || (tpl ? tpl.language : 'en');
  let payload = null;
  let mode = 'text';

  if (useTemplates && tpl && order) {
    try {
      const built = buildTemplate(type, order, {
        trackUrl: `${baseUrl || config.clientUrl}/track?ref=${order.id}`,
        businessPhone: settings.businessPhone,
      });
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: built.name,
          language: { code: language },
          components: templateComponents(built.parameters),
        },
      };
      mode = 'template';
    } catch (err) {
      // A bad variable count is a bug in our own registry, not the network: keep
      // going with free-form text and leave a loud trace.
      console.error('[whatsapp] template build failed:', err.message);
    }
  }

  if (!config.whatsapp.enabled) {
    const label = mode === 'template' ? payload.template.name : 'free-form text';
    console.log(
      `\n[SIMULATED WHATSAPP ${mode}] to: ${to}\n` +
        (mode === 'template'
          ? `   template: ${payload.template.name} (${language})\n   params: ${JSON.stringify(
              payload.template.components[0].parameters.map((p) => p.text)
            )}\n`
          : `   ${message}\n`)
    );
    await logNotification(orderId, 'WHATSAPP', type, 'SIMULATED', `${to} — ${label}`);
    return { ok: true, simulated: true, mode, template: payload?.template?.name || null };
  }

  // 1) Template send (the path that works in production).
  if (mode === 'template') {
    const result = await post(payload);
    if (result.ok) {
      await logNotification(orderId, 'WHATSAPP', type, 'SENT', `${to} — template ${payload.template.name}`);
      return { ok: true, mode: 'template', template: payload.template.name, messageId: result.id };
    }
    console.warn(
      `[whatsapp] template "${payload.template.name}" refused (${result.error}) — falling back to free-form text`
    );
    await logNotification(
      orderId,
      'WHATSAPP',
      type,
      'SIMULATED',
      `${to} — template ${payload.template.name} refused: ${result.error}`
    );
  }

  // 2) Free-form text (works inside the 24-hour customer window).
  const textResult = await post({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message },
  });
  if (textResult.ok) {
    await logNotification(orderId, 'WHATSAPP', type, 'SENT', `${to}${mode === 'template' ? ' — free-form fallback' : ''}`);
    return { ok: true, mode: 'text', messageId: textResult.id };
  }

  // 3) Both refused — SMS and email already went out; record why here.
  console.warn(`[whatsapp] free-form send failed for ${to}:`, textResult.error);
  await logNotification(orderId, 'WHATSAPP', type, 'FAILED', `${to} — ${textResult.error}`);
  return { ok: false, error: textResult.error };
}

/** POST to the Cloud API messages endpoint; never throws. */
async function post(body) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${config.whatsapp.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      const detail = data?.error?.message || `WhatsApp error ${res.status}`;
      const code = data?.error?.code ? ` (code ${data.error.code})` : '';
      return { ok: false, error: `${detail}${code}` };
    }
    return { ok: true, id: data?.messages?.[0]?.id || null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send a template to any number with sample values — used by the admin
 * "test send" button so the bakery can prove a template is approved and wired up
 * before it matters. Works in simulation mode too, reporting what it would send.
 */
export async function sendTemplateTest({ phone, type, order = null }) {
  const to = normalizeGhPhone(phone);
  if (!to) return { ok: false, error: 'Enter a phone number in Ghanaian format, e.g. 0551234567' };

  const tpl = templateFor(type);
  if (!tpl) return { ok: false, error: `Unknown notification type: ${type}` };

  const settings = await getSettings();
  const language = settings.whatsappTemplateLanguage || tpl.language;
  const preview = tpl.body.replace(/\{\{(\d+)\}\}/g, (_, n) => tpl.sample[Number(n) - 1] ?? '');
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: tpl.name,
      language: { code: language },
      components: templateComponents(tpl.sample),
    },
  };

  if (!config.whatsapp.enabled) {
    console.log(`\n[SIMULATED WHATSAPP TEST] to: ${to}\n   template: ${tpl.name} (${language})\n   ${preview}\n`);
    return {
      ok: true,
      simulated: true,
      to,
      template: tpl.name,
      language,
      parameters: tpl.sample,
      preview,
    };
  }

  const result = await post(payload);
  return {
    ok: result.ok,
    simulated: false,
    to,
    template: tpl.name,
    language,
    parameters: tpl.sample,
    preview,
    messageId: result.id || null,
    error: result.error || null,
  };
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
