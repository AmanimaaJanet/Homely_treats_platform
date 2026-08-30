import { prisma } from '../prisma.js';
import { sendEmail, orderEmailTemplate } from './email.js';
import { sendSms } from './sms.js';
import { sendWhatsApp } from './whatsapp.js';
import { broadcastOrder } from './realtime.js';
import { getSettings } from './settings.js';
import { config } from '../config.js';

/**
 * Central place for recording order status events, notifying the customer
 * (SMS + email + WhatsApp), and broadcasting real-time updates over WebSockets.
 */

export async function recordEvent(orderId, status, note) {
  return prisma.orderEvent.create({ data: { orderId, status, note } });
}

export async function notifyCustomer(order, type, { note = '' } = {}) {
  const phone = order.user?.phone || order.guestPhone;
  const email = order.user?.email || order.guestEmail;
  const name = order.user?.fullName || order.guestName || 'Customer';
  const trackUrl = `${config.clientUrl}/track?ref=${order.id}`;

  const messages = {
    ORDER_CONFIRMED: {
      sms: `Homely Treats: Order ${order.id} confirmed! Total GH₵ ${Number(order.total).toFixed(2)}. We'll notify you when it's ready. Track: ${trackUrl}`,
      email: {
        headline: 'Order confirmed — thank you!',
        bodyLines: [
          `Hi ${name}, your order <strong>${order.id}</strong> has been received and confirmed.`,
          note ? `<strong>${note}</strong>` : '',
          `We'll start baking soon and keep you updated by SMS, WhatsApp and email.`,
        ].filter(Boolean),
      },
    },
    PAYMENT_VERIFIED: {
      sms: `Homely Treats: Payment received for order ${order.id}. GH₵ ${Number(order.total).toFixed(2)}. Thank you! ${trackUrl}`,
      email: {
        headline: 'Payment received',
        bodyLines: [
          `Hi ${name}, we've received your payment of <strong>GH₵ ${Number(order.total).toFixed(2)}</strong> for order <strong>${order.id}</strong>.`,
        ],
      },
    },
    IN_PROGRESS: {
      sms: `Homely Treats: Your order ${order.id} is now being prepared. We'll message you when it's ready. ${trackUrl}`,
      email: {
        headline: 'Your treats are being prepared',
        bodyLines: [`Hi ${name}, order <strong>${order.id}</strong> is now being prepared fresh.`],
      },
    },
    READY: {
      sms: `Homely Treats: Great news! Order ${order.id} is ready for ${order.deliveryMethod === 'DELIVERY' ? 'delivery' : 'pickup'}. ${trackUrl}`,
      email: {
        headline: 'Your order is ready!',
        bodyLines: [
          `Hi ${name}, order <strong>${order.id}</strong> is ready.`,
          order.deliveryMethod === 'DELIVERY'
            ? `Our rider is on the way to: ${order.deliveryAddress || 'your address'}.`
            : `Please collect it from our Airport Residential shop.`,
        ],
      },
    },
    OUT_FOR_DELIVERY: {
      sms: `Homely Treats: ${order.riderName || 'Your order'} is on the way! Track: ${trackUrl}`,
      email: {
        headline: 'Out for delivery',
        bodyLines: [
          `Hi ${name}, order <strong>${order.id}</strong> is out for delivery with ${order.riderName || 'our rider'}.`,
          order.riderPhone ? `Rider contact: ${order.riderPhone}` : '',
        ].filter(Boolean),
      },
    },
    DELIVERED: {
      sms: `Homely Treats: Order ${order.id} delivered/collected. Enjoy! Thanks for choosing us.`,
      email: {
        headline: 'Delivered — enjoy!',
        bodyLines: [`Hi ${name}, order <strong>${order.id}</strong> has been delivered. Thank you for choosing Homely Treats!`],
      },
    },
    CANCELLED: {
      sms: `Homely Treats: Order ${order.id} has been cancelled. Questions? Call 055 123 4567.`,
      email: {
        headline: 'Order cancelled',
        bodyLines: [`Hi ${name}, order <strong>${order.id}</strong> has been cancelled. Contact us if this was unexpected.`],
      },
    },
  };

  const m = messages[type] || messages.ORDER_CONFIRMED;
  const settings = await getSettings();

  if (phone) {
    if (settings.smsOrderConfirmed !== false) {
      await sendSms({ phone, message: m.sms, orderId: order.id, type });
    }
    if (settings.enableWhatsapp !== false) {
      await sendWhatsApp({ phone, message: m.sms, orderId: order.id, type });
    }
  }
  if (email && settings.emailOrderConfirmed !== false) {
    await sendEmail({
      to: email,
      subject: `Homely Treats — ${m.email.headline} (${order.id})`,
      html: orderEmailTemplate({ ...m.email, order, ctaUrl: trackUrl }),
      orderId: order.id,
      type,
    });
  }
}

export async function applyStatus(orderId, status, note) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status, updatedAt: new Date() },
    include: { user: true, items: true },
  });
  await recordEvent(orderId, status, note);

  const typeMap = {
    CONFIRMED: 'ORDER_CONFIRMED',
    IN_PROGRESS: 'IN_PROGRESS',
    READY: 'READY',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
  };
  if (typeMap[status]) {
    await notifyCustomer(order, typeMap[status], { note });
  }
  broadcastOrder(orderId, { status });
  return order;
}
