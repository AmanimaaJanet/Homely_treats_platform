import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { nextOrderId, round2 } from '../utils.js';
import { getSettings } from '../services/settings.js';
import { initializeTransaction } from '../services/paystack.js';
import { recordEvent, notifyCustomer } from '../services/orderEvents.js';
import { earnPoints, maxRedeemablePoints, discountForPoints } from '../services/loyalty.js';
import { sendEmail } from '../services/email.js';
import { config } from '../config.js';

const router = Router();

// ---------------------------------------------------------------------------
// Build a canonical tracking timeline from order status + payment + events
// ---------------------------------------------------------------------------
function buildTimeline(order, events) {
  const paid = ['PAID', 'SIMULATED', 'COD'].includes(order.paymentStatus);
  const eventAt = (status) => {
    const e = [...events].reverse().find((ev) => ev.status === status);
    return e ? e.createdAt : null;
  };
  const done = (statuses) => statuses.includes(order.status);
  const steps = [
    { key: 'PLACED', label: 'Order Placed & Confirmed', done: true, at: eventAt('PENDING') || order.createdAt },
    { key: 'PAID', label: 'Payment Verified', done: paid, at: paid ? eventAt('PAID') || order.updatedAt : null },
    { key: 'IN_PROGRESS', label: 'Being Prepared', done: done(['IN_PROGRESS', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']), at: eventAt('IN_PROGRESS') },
  ];
  if (order.deliveryMethod === 'DELIVERY') {
    steps.push({
      key: 'READY',
      label: 'Ready for Dispatch',
      done: done(['READY', 'OUT_FOR_DELIVERY', 'DELIVERED']),
      at: eventAt('READY'),
    });
    steps.push({
      key: 'OUT_FOR_DELIVERY',
      label: `Out for Delivery${order.riderName ? ' — ' + order.riderName : ''}`,
      done: done(['OUT_FOR_DELIVERY', 'DELIVERED']),
      at: eventAt('OUT_FOR_DELIVERY'),
    });
    steps.push({ key: 'DELIVERED', label: 'Delivered', done: order.status === 'DELIVERED', at: eventAt('DELIVERED') });
  } else {
    steps.push({
      key: 'READY',
      label: 'Ready for Pickup',
      done: done(['READY', 'DELIVERED']),
      at: eventAt('READY'),
    });
    steps.push({ key: 'DELIVERED', label: 'Collected', done: order.status === 'DELIVERED', at: eventAt('DELIVERED') });
  }
  if (order.status === 'CANCELLED') {
    steps.forEach((s) => { s.done = false; });
    steps[0].done = true;
  }
  return steps;
}

async function resolveUnitPrice(product, sizeLabel) {
  if (!sizeLabel) return product.basePrice;
  const opt = await prisma.productSize.findFirst({
    where: { productId: product.id, label: sizeLabel },
  });
  return opt ? opt.price : product.basePrice;
}

// ---------------------------------------------------------------------------
// POST /api/orders  — create an order (guest or signed-in)
// ---------------------------------------------------------------------------
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      items,
      deliveryMethod = 'PICKUP',
      deliveryAddress,
      deliveryZone,
      readyDate,
      notes,
      paymentMethod = 'MOMO',
      promoCode,
      pointsToRedeem = 0,
      photos = [],
      guest = {},
    } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your order has no items' });
    }
    if (!['DELIVERY', 'PICKUP'].includes(deliveryMethod)) {
      return res.status(400).json({ error: 'Invalid delivery method' });
    }
    if (!['MOMO', 'ATL', 'CARD', 'COD'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const user = req.user || null;
    const guestName = guest.name || null;
    const guestEmail = guest.email || null;
    const guestPhone = guest.phone || null;
    if (!user && (!guestName || !guestEmail || !guestPhone)) {
      return res.status(400).json({ error: 'Please provide your name, email and phone (or sign in)' });
    }

    const settings = await getSettings();

    // ---- Store open / payment method enabled? ----
    if (settings.acceptOrders === false) {
      return res.status(400).json({ error: "We're not accepting new orders at the moment. Please check back soon." });
    }
    const payEnabled = {
      MOMO: settings.enableMomo !== false,
      ATL: settings.enableAtl !== false,
      CARD: settings.enableCard !== false,
      COD: settings.enableCod !== false,
    };
    if (!payEnabled[paymentMethod]) {
      return res.status(400).json({ error: 'This payment method is currently unavailable. Please choose another.' });
    }
    if (deliveryMethod === 'PICKUP' && settings.allowPickup === false) {
      return res.status(400).json({ error: 'Pickup is currently unavailable. Please choose home delivery.' });
    }

    // ---- Delivery zone & fee ----
    let deliveryFee = 0;
    let zoneName = null;
    if (deliveryMethod === 'DELIVERY') {
      if (!deliveryZone) {
        return res.status(400).json({ error: 'Please select your delivery zone' });
      }
      const zone = await prisma.deliveryZone.findFirst({
        where: {
          OR: [{ id: String(deliveryZone) }, { name: { equals: String(deliveryZone), mode: 'insensitive' } }],
          active: true,
        },
      });
      if (!zone) return res.status(400).json({ error: 'Delivery zone not found or unavailable' });
      deliveryFee = Number(zone.fee || 0);
      zoneName = zone.name;
    }

    // ---- Minimum lead time ----
    const minLeadDays = settings.minLeadDays ?? 2;
    if (readyDate) {
      const rd = new Date(readyDate);
      const earliest = new Date();
      earliest.setDate(earliest.getDate() + minLeadDays);
      earliest.setHours(0, 0, 0, 0);
      if (rd < earliest) {
        return res.status(400).json({ error: `We need at least ${minLeadDays} days advance notice. Please pick a later date.` });
      }
    }

    // ---- Resolve products & prices (size-based pricing) ----
    const ids = items.map((i) => i.productId).filter(Boolean);
    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      include: { sizeOptions: true },
    });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
    let subtotal = 0;
    const orderItems = [];
    for (const it of items) {
      const product = productMap[it.productId];
      if (!product) return res.status(400).json({ error: 'One or more products no longer exist' });
      if (!product.inStock) return res.status(400).json({ error: `"${product.name}" is currently out of stock` });
      const qty = Math.max(1, parseInt(it.quantity || 1, 10));
      const price = await resolveUnitPrice(product, it.size || null);
      subtotal += price * qty;
      orderItems.push({
        productId: product.id,
        name: product.name,
        emoji: product.icon || product.emoji, // stores the Lucide icon name
        price,
        quantity: qty,
        flavor: it.flavor || null,
        size: it.size || null,
        icing: it.icing || null,
        inscription: it.inscription || null,
      });
    }
    subtotal = round2(subtotal);

    // ---- Promo ----
    let discount = 0;
    if (promoCode) {
      const promo = await prisma.promo.findUnique({ where: { code: String(promoCode).toUpperCase().trim() } });
      if (!promo || !promo.active) return res.status(400).json({ error: 'Invalid promo code' });
      if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return res.status(400).json({ error: 'Promo code has expired' });
      if (promo.usageLimit && promo.usageCount >= promo.usageLimit) return res.status(400).json({ error: 'Promo code limit reached' });
      discount =
        promo.type === 'PERCENT' ? round2(subtotal * (promo.value / 100)) : Math.min(Number(promo.value), subtotal);
      discount = round2(discount);
      await prisma.promo.update({ where: { id: promo.id }, data: { usageCount: { increment: 1 } } });
    }

    // ---- Loyalty points redemption (signed-in users only) ----
    let loyaltyDiscount = 0;
    let redeemed = 0;
    if (user && settings.enableLoyalty && Number(pointsToRedeem) > 0) {
      const requested = Math.floor(Number(pointsToRedeem));
      const base = subtotal - discount;
      const maxPoints = maxRedeemablePoints(user.loyaltyPoints, base);
      redeemed = Math.min(requested, maxPoints);
      if (redeemed > 0) {
        loyaltyDiscount = round2(discountForPoints(redeemed));
        loyaltyDiscount = Math.min(loyaltyDiscount, base);
        await prisma.user.update({
          where: { id: user.id },
          data: { loyaltyPoints: { decrement: redeemed } },
        });
      }
    }

    const total = round2(subtotal - discount - loyaltyDiscount + deliveryFee);
    if (total < 0) return res.status(400).json({ error: 'Order total cannot be negative' });

    const isCod = paymentMethod === 'COD';
    const id = await nextOrderId(prisma);

    const order = await prisma.order.create({
      data: {
        id,
        userId: user?.id || null,
        guestName,
        guestEmail,
        guestPhone,
        status: 'PENDING',
        paymentStatus: isCod ? 'COD' : 'PENDING',
        paymentMethod,
        subtotal,
        discount,
        loyaltyDiscount,
        pointsRedeemed: redeemed,
        deliveryFee,
        deliveryZone: zoneName,
        total,
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'DELIVERY' ? deliveryAddress || null : null,
        readyDate: readyDate ? new Date(readyDate) : null,
        notes: notes || null,
        promoCode: promoCode ? String(promoCode).toUpperCase().trim() : null,
        items: { create: orderItems },
        photos: {
          create: (Array.isArray(photos) ? photos : [])
            .filter((u) => typeof u === 'string' && u.length > 0)
            .map((url) => ({ url })),
        },
      },
      include: { items: true, user: true, photos: true },
    });

    await recordEvent(id, 'PENDING', 'Order placed');
    await notifyCustomer(order, 'ORDER_CONFIRMED', {
      note: isCod ? 'Pay in cash on delivery / pickup.' : 'Complete payment to confirm your order.',
    });

    // ---- Admin new-order alert ----
    if (settings.adminAlertNewOrder !== false) {
      const itemsList = orderItems.map((i) => `${i.name} ×${i.quantity}`).join(', ');
      await sendEmail({
        to: settings.businessEmail || 'admin@homelytreats.gh',
        subject: `New order ${id} — GH₵ ${total.toFixed(2)}`,
        html: `<h2>New order received</h2>
               <p>Order <strong>${id}</strong>: ${itemsList}</p>
               <p>Total: <strong>GH₵ ${total.toFixed(2)}</strong> · ${deliveryMethod === 'DELIVERY' ? `Delivery to ${zoneName || deliveryAddress}` : 'Pickup'}</p>
               <p>Customer: ${user?.fullName || guestName} (${user?.phone || guestPhone})</p>`,
        type: 'ORDER_CONFIRMED',
      });
    }

    // ---- Payment initialisation ----
    let authorizationUrl = null;
    if (!isCod) {
      const init = await initializeTransaction({
        email: user?.email || guestEmail,
        amountGhs: total,
        orderId: id,
        paymentMethod,
        phone: user?.phone || guestPhone,
        callbackUrl: `${config.clientUrl}/pay/callback?order=${id}`,
      });
      authorizationUrl = init.authorizationUrl;
      await prisma.order.update({ where: { id }, data: { paymentRef: init.reference } });
    }

    res.status(201).json({ order: { ...order }, authorizationUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create order' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/orders/my  — current user's orders
// ---------------------------------------------------------------------------
router.get('/my', requireAuth, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true, review: true },
    });
    res.json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/orders/track/:ref  — public order tracking
// ---------------------------------------------------------------------------
router.get('/track/:ref', async (req, res) => {
  try {
    const ref = String(req.params.ref || '').trim();
    const order = await prisma.order.findUnique({
      where: { id: ref },
      include: {
        items: true,
        photos: true,
        review: true,
        events: { orderBy: { createdAt: 'asc' } },
        notifications: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found. Check the reference and try again.' });
    const timeline = buildTimeline(order, order.events);
    res.json({ order, timeline });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load order' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/orders/:id/cancel  — owner or admin cancels an order
// ---------------------------------------------------------------------------
router.post('/:id/cancel', optionalAuth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const isOwner = req.user && order.userId === req.user.id;
    const isAdmin = req.user && req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Not allowed' });
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
      return res.status(400).json({ error: 'Order can no longer be cancelled' });
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', updatedAt: new Date() },
      include: { items: true, user: true },
    });
    // Refund redeemed loyalty points
    if (order.pointsRedeemed > 0 && order.userId) {
      await prisma.user.update({
        where: { id: order.userId },
        data: { loyaltyPoints: { increment: order.pointsRedeemed } },
      });
    }
    await recordEvent(order.id, 'CANCELLED', 'Order cancelled');
    await notifyCustomer(updated, 'CANCELLED');
    res.json({ order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

export default router;
