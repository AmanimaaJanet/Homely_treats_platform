/**
 * WhatsApp Cloud API message templates.
 *
 * Why this exists: WhatsApp only allows a business to send *free-form* text to a
 * customer for 24 hours after that customer last messaged the business. Every
 * other message — "your cake is ready", "your order is on the way" — must use a
 * template that Meta has approved in advance. Sending plain text outside that
 * window fails silently from the bakery's point of view, which is why the app
 * keeps the free-form text as a fallback and sends an approved template the rest
 * of the time.
 *
 * Each entry below is the single source of truth for one template:
 *   name      — the template name you create in Meta Business Manager
 *   language  — the template's language code
 *   category  — what to select when creating it (UTILITY keeps it cheap/free tier)
 *   body      — the exact body text to paste into Meta, {{1}} {{2}} … in order
 *   vars      — what each numbered variable means, in order (shown in the admin UI)
 *   build     — how to fill those variables for a real order
 *   sample    — values used by the "test send" button, so you can check the
 *               template without waiting for a real order
 *
 * If you rename a template in Meta, change `name` here to match — the app sends
 * whatever name this file says, and Meta's error is surfaced in the notification
 * log when a name doesn't exist or isn't approved yet.
 */

const money = (n) => Number(n || 0).toFixed(2);

export const WHATSAPP_TEMPLATES = {
  ORDER_CONFIRMED: {
    name: 'order_confirmed',
    language: 'en',
    category: 'UTILITY',
    body:
      "Hi {{1}}, your Homely Treats order {{2}} is confirmed. Total GH₵ {{3}}. " +
      "We'll let you know as soon as it's ready.",
    vars: ['customer first name', 'order number', 'order total'],
    build: (o) => [firstName(o), o.id, money(o.total)],
    sample: ['Ama', 'HT-20260916-0001', '320.00'],
  },
  PAYMENT_VERIFIED: {
    name: 'payment_received',
    language: 'en',
    category: 'UTILITY',
    body: 'Hi {{1}}, we have received your payment of GH₵ {{2}} for order {{3}}. Thank you!',
    vars: ['customer first name', 'amount paid', 'order number'],
    build: (o) => [firstName(o), money(o.total), o.id],
    sample: ['Ama', '320.00', 'HT-20260916-0001'],
  },
  IN_PROGRESS: {
    name: 'order_being_prepared',
    language: 'en',
    category: 'UTILITY',
    body: "Hi {{1}}, order {{2}} is now being prepared fresh in our kitchen. We'll message you when it's ready.",
    vars: ['customer first name', 'order number'],
    build: (o) => [firstName(o), o.id],
    sample: ['Ama', 'HT-20260916-0001'],
  },
  READY: {
    name: 'order_ready',
    language: 'en',
    category: 'UTILITY',
    body: 'Hi {{1}}, good news — order {{2}} is ready. {{3}}',
    vars: ['customer first name', 'order number', 'pickup or delivery instruction'],
    build: (o) => [
      firstName(o),
      o.id,
      o.deliveryMethod === 'DELIVERY'
        ? 'Our rider will be on the way shortly.'
        : 'Please collect it from our shop in Airport Residential.',
    ],
    sample: ['Ama', 'HT-20260916-0001', 'Please collect it from our shop in Airport Residential.'],
  },
  OUT_FOR_DELIVERY: {
    name: 'order_out_for_delivery',
    language: 'en',
    category: 'UTILITY',
    body: 'Hi {{1}}, order {{2}} is on the way with {{3}}. Track it here: {{4}}',
    vars: ['customer first name', 'order number', 'rider name', 'tracking link'],
    build: (o, ctx) => [firstName(o), o.id, o.riderName || 'our rider', `${ctx.trackUrl}`],
    sample: ['Ama', 'HT-20260916-0001', 'Kwesi', 'https://homelytreats.gh/track?ref=HT-20260916-0001'],
  },
  DELIVERED: {
    name: 'order_delivered',
    language: 'en',
    category: 'UTILITY',
    body: 'Hi {{1}}, order {{2}} has been delivered. We hope you enjoy it — thank you for choosing Homely Treats!',
    vars: ['customer first name', 'order number'],
    build: (o) => [firstName(o), o.id],
    sample: ['Ama', 'HT-20260916-0001'],
  },
  CANCELLED: {
    name: 'order_cancelled',
    language: 'en',
    category: 'UTILITY',
    body: 'Hi {{1}}, order {{2}} has been cancelled. If this was not expected, please call us on {{3}}.',
    vars: ['customer first name', 'order number', 'business phone'],
    build: (o, ctx) => [firstName(o), o.id, ctx.businessPhone],
    sample: ['Ama', 'HT-20260916-0001', '055 123 4567'],
  },
  REFUNDED: {
    name: 'refund_issued',
    language: 'en',
    category: 'UTILITY',
    body:
      'Hi {{1}}, we have issued a refund of GH₵ {{2}} for order {{3}}. ' +
      'It can take a few working days to reflect, depending on your provider.',
    vars: ['customer first name', 'refund amount', 'order number'],
    build: (o) => [firstName(o), money(o.refundAmount || o.total), o.id],
    sample: ['Ama', '320.00', 'HT-20260916-0001'],
  },
};

/** Customers are greeted by first name; long names are trimmed for the header. */
function firstName(order) {
  const full = order?.user?.fullName || order?.guestName || 'there';
  return String(full).trim().split(/\s+/)[0].slice(0, 40);
}

export const TEMPLATE_TYPES = Object.keys(WHATSAPP_TEMPLATES);

/** The template for a notification type, or null when that type has none. */
export function templateFor(type) {
  return WHATSAPP_TEMPLATES[type] || null;
}

/**
 * Fill a template's variables for a real order.
 * Returns { name, language, parameters } or null when the type has no template.
 */
export function buildTemplate(type, order, ctx = {}) {
  const tpl = templateFor(type);
  if (!tpl) return null;
  const parameters = tpl.build(order, {
    trackUrl: ctx.trackUrl || '',
    businessPhone: ctx.businessPhone || '055 123 4567',
  });
  // Meta rejects a template call whose parameter count doesn't match the approved
  // body, so fail loudly here rather than silently at 2am.
  if (parameters.length !== tpl.vars.length) {
    throw new Error(
      `Template ${tpl.name} expects ${tpl.vars.length} variable(s) but ${parameters.length} were built`
    );
  }
  return { name: tpl.name, language: tpl.language, parameters };
}

/** The Meta `components` array for a template send. */
export function templateComponents(parameters) {
  return [
    {
      type: 'body',
      parameters: parameters.map((text) => ({ type: 'text', text: String(text) })),
    },
  ];
}

/** The exact body text with sample values filled in — what the admin UI previews. */
export function renderPreview(type) {
  const tpl = templateFor(type);
  if (!tpl) return null;
  return tpl.body.replace(/\{\{(\d+)\}\}/g, (_, n) => tpl.sample[Number(n) - 1] ?? '');
}

/** Everything the admin screen needs, with the current settings applied. */
export function describeTemplates({ useTemplates = true, language = 'en', enabled = false } = {}) {
  return {
    enabled,
    useTemplates,
    language,
    templates: TEMPLATE_TYPES.map((type) => {
      const tpl = WHATSAPP_TEMPLATES[type];
      return {
        type,
        name: tpl.name,
        language: tpl.language,
        category: tpl.category,
        body: tpl.body,
        vars: tpl.vars,
        sample: tpl.sample,
        preview: renderPreview(type),
      };
    }),
  };
}
