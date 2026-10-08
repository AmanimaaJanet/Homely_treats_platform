import { prisma } from '../prisma.js';
import { sendEmail, orderEmailTemplate } from './email.js';
import { sendSms } from './sms.js';
import { sendWhatsApp } from './whatsapp.js';
import { broadcastOrder } from './realtime.js';
import { clearRiderLocation } from './riderLocation.js';
import { getSettings } from './settings.js';
import { restoreStock } from './stock.js';
import { sendPushToUser } from './push.js';
import { config } from '../config.js';
import { refundTransaction } from './paystack.js';

/**
 * Central place for recording order status events, notifying the customer
 * (SMS + email + WhatsApp), and broadcasting real-time updates over WebSockets.
 */

export async function recordEvent(orderId, status, note) {
  return prisma.orderEvent.create({ data: { orderId, status, note } });
}

export async function notifyCustomer(order, type, { note = '', baseUrl } = {}) {
  const phone = order.user?.phone || order.guestPhone;
  const email = order.user?.email || order.guestEmail;
  const name = order.user?.fullName || order.guestName || 'Customer';
  const trackUrl = `${baseUrl || config.clientUrl}/track?ref=${order.id}`;

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
      pushBody: order.deliveryMethod === 'DELIVERY'
        ? `Order ${order.id} is ready — our rider is on the way.`
        : `Order ${order.id} is ready. Please collect it${order.pickupLocation ? ` from ${order.pickupLocation}` : ''}.`,
      sms: `Homely Treats: Great news! Order ${order.id} is ready for ${order.deliveryMethod === 'DELIVERY' ? 'delivery' : 'pickup'}${order.deliveryMethod === 'PICKUP' && order.pickupLocation ? ` from ${order.pickupLocation}` : ''}. ${trackUrl}`,
      email: {
        headline: 'Your order is ready!',
        bodyLines: [
          `Hi ${name}, order <strong>${order.id}</strong> is ready.`,
          order.deliveryMethod === 'DELIVERY'
            ? `Our rider is on the way to: ${order.deliveryAddress || 'your address'}.`
            : `Please collect it from <strong>${order.pickupLocation || 'our shop'}</strong>.`,
        ],
      },
    },
    OUT_FOR_DELIVERY: {
      pushBody: `Order ${order.id} is on the way with ${order.riderName || 'our rider'}.`,
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
    REFUNDED: {
      pushBody: `Refund of GH₵ ${Number(order.refundAmount || order.total).toFixed(2)} issued for ${order.id}.`,
      sms: `Homely Treats: A refund of GH₵ ${Number(order.refundAmount || order.total).toFixed(2)} has been issued for order ${order.id}. It can take a few working days to reflect.`,
      email: {
        headline: 'Refund issued',
        bodyLines: [
          `Hi ${name}, we've issued a refund of <strong>GH₵ ${Number(order.refundAmount || order.total).toFixed(2)}</strong> for order <strong>${order.id}</strong>.`,
          order.refundReason ? `Reason: ${order.refundReason}` : '',
          `Mobile money and card refunds usually appear within a few working days, depending on your provider.`,
        ].filter(Boolean),
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
      // The order travels with the call so WhatsApp can fill an approved template's
      // variables (name, order number, total, tracking link).
      await sendWhatsApp({ phone, message: m.sms, orderId: order.id, type, order, baseUrl });
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

  // Web push, for customers who installed the app: free, instant, and it lands on the
  // lock screen — the channel that actually gets read for "your cake is ready".
  if (order.userId && settings.enablePush !== false) {
    try {
      await sendPushToUser(order.userId, {
        title: m.email.headline,
        body: (m.pushBody || m.sms || '').slice(0, 160),
        url: `/track?ref=${order.id}`,
        tag: `order-${order.id}`,
      });
    } catch (err) {
      console.error('[push] order notification failed:', err.message);
    }
  }
}

/**
 * Move an order to a new status. This is the ONLY path that changes status, so
 * cancellation side-effects (stock restore, loyalty refund) can never be missed.
 */
export async function applyStatus(orderId, status, note) {
  const before = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!before) throw Object.assign(new Error('Order not found'), { status: 404 });

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status, updatedAt: new Date() },
    include: { user: true, items: true },
  });
  await recordEvent(orderId, status, note);

  // The rider's live position stops the moment the order is no longer out for
  // delivery — delivered, cancelled, anything else. Where the rider goes next is
  // not the customer's business.
  if (before.status === 'OUT_FOR_DELIVERY' && status !== 'OUT_FOR_DELIVERY') {
    clearRiderLocation(orderId);
  }

  // --- Cancellation side-effects (guarded so they run exactly once) ---------
  const cancelledNow = status === 'CANCELLED' && before.status !== 'CANCELLED';
  if (cancelledNow) {
    // Return the reserved stock so the items can be sold again.
    try {
      await restoreStock(before.items);
    } catch (err) {
      console.error('[stock] failed to restore stock for', orderId, err.message);
    }
    // Refund loyalty points the customer spent on this order.
    if (before.pointsRedeemed > 0 && before.userId) {
      try {
        await prisma.user.update({
          where: { id: before.userId },
          data: { loyaltyPoints: { increment: before.pointsRedeemed } },
        });
      } catch (err) {
        console.error('[loyalty] failed to refund points for', orderId, err.message);
      }
    }
    // A cancelled order must not count towards its promo code's usage limit.
    if (before.promoCode) {
      try {
        await prisma.promo.updateMany({
          where: { code: before.promoCode, usageCount: { gt: 0 } },
          data: { usageCount: { decrement: 1 } },
        });
        await prisma.promoRedemption.deleteMany({ where: { orderId } });
      } catch (err) {
        console.error('[promo] failed to release promo usage for', orderId, err.message);
      }
    }
  }
  // Points earned on a cancelled/delivered-then-reversed order are also undone.
  if (cancelledNow && before.pointsEarned > 0 && before.userId) {
    try {
      await prisma.user.update({
        where: { id: before.userId },
        data: { loyaltyPoints: { decrement: before.pointsEarned } },
      });
    } catch (err) {
      console.error('[loyalty] failed to reverse earned points for', orderId, err.message);
    }
  }

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


/**
 * Refund a paid order.
 *
 * Two paths, because Ghanaian bakeries take money in two ways:
 *   • Paid through Paystack — the refund is sent back to the original mobile-money
 *     wallet or card and we keep Paystack's refund reference.
 *   • Paid offline (cash, or a bank transfer the bakery confirmed by hand) — there is
 *     nothing to reverse electronically, so the refund is recorded as settled offline
 *     and the customer is told it has been issued.
 *
 * Refunds are full-order only: keeping a partially refunded order in the "paid"
 * bucket would quietly overstate revenue in every report.
 */
export async function refundOrder(orderId, { reason } = {}) {
  const before = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });
  if (!before) throw Object.assign(new Error('Order not found'), { status: 404 });

  if (before.paymentStatus === 'REFUNDED') {
    throw Object.assign(new Error('This order has already been refunded'), { status: 409 });
  }
  if (!['PAID', 'SIMULATED'].includes(before.paymentStatus)) {
    throw Object.assign(
      new Error('Only paid orders can be refunded — this one has no captured payment'),
      { status: 400 }
    );
  }

  // Simulation-mode payments (and any reference Paystack never issued) are settled offline.
  const viaPaystack = config.paystack.enabled && before.paymentRef && !String(before.paymentRef).startsWith('SIM-');

  let refundStatus = 'OFFLINE';
  let refundRef = 'offline';
  if (viaPaystack) {
    const result = await refundTransaction(before.paymentRef);
    if (!result.refunded && result.error) {
      // Record the failed attempt but leave the order paid — the money is still ours
      // until Paystack confirms otherwise, and the bakery must retry or handle it by hand.
      await prisma.order.update({
        where: { id: orderId },
        data: { refundStatus: 'FAILED', refundReason: `${reason || 'Refund failed'} — ${result.error}` },
      });
      throw Object.assign(new Error(`Paystack refused the refund: ${result.error}`), { status: 502 });
    }
    refundStatus = 'PAYSTACK_REFUNDED';
    refundRef = String(result.refundRef || before.paymentRef);
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'REFUNDED',
      refundStatus,
      refundAmount: before.total,
      refundReason: reason ? String(reason).slice(0, 500) : null,
      refundRef,
      refundedAt: new Date(),
    },
    include: { user: true, items: true },
  });

  await recordEvent(
    orderId,
    'REFUNDED',
    `Refund of GH₵ ${Number(order.refundAmount).toFixed(2)} issued (${refundStatus === 'OFFLINE' ? 'settled offline' : `Paystack ref ${refundRef}`})${reason ? ` — ${reason}` : ''}`
  );

  // Free the stock back up: a refunded cake never left the shop, or came back.
  try {
    await restoreStock(before.items);
  } catch (err) {
    console.error('[stock] failed to restore stock after refund for', orderId, err.message);
  }

  await notifyCustomer(order, 'REFUNDED');
  broadcastOrder(orderId, { status: order.status, paymentStatus: 'REFUNDED' });
  return order;
}
