import { Router } from 'express';
import { prisma } from '../prisma.js';
import { verifyTransaction, verifyWebhook } from '../services/paystack.js';
import { recordEvent, notifyCustomer } from '../services/orderEvents.js';
import { broadcastOrder } from '../services/realtime.js';
import { earnPoints } from '../services/loyalty.js';
import { config } from '../config.js';

const router = Router();

/** Award loyalty points to a signed-in customer (once per order). */
async function awardPoints(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.userId || order.pointsEarned > 0) return;
  const points = earnPoints(order.total);
  await prisma.order.update({ where: { id: orderId }, data: { pointsEarned: points } });
  if (points > 0) {
    await prisma.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: points } } });
  }
}

async function markPaid(orderId, { method, reference } = {}) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true, items: true } });
  if (!order) throw new Error('Order not found');
  if (order.paymentStatus === 'PAID') return order;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: method === 'SIMULATED' ? 'SIMULATED' : 'PAID',
      paymentRef: reference || order.paymentRef,
      status: order.status === 'PENDING' ? 'CONFIRMED' : order.status,
      updatedAt: new Date(),
    },
    include: { user: true, items: true },
  });

  await recordEvent(orderId, 'PAID', `Payment verified via ${method}`);
  if (updated.status === 'CONFIRMED') {
    await recordEvent(orderId, 'CONFIRMED', 'Order confirmed');
  }
  await notifyCustomer(updated, 'PAYMENT_VERIFIED');
  await awardPoints(orderId);
  broadcastOrder(orderId, { status: updated.status, paymentStatus: updated.paymentStatus });
  return updated;
}

// ---------------------------------------------------------------------------
// POST /api/payments/verify  { reference }
// ---------------------------------------------------------------------------
router.post('/verify', async (req, res) => {
  try {
    const { reference } = req.body || {};
    if (!reference) return res.status(400).json({ error: 'Reference required' });
    if (!config.paystack.enabled) return res.status(400).json({ error: 'Paystack is not configured' });

    const result = await verifyTransaction(reference);
    if (!result.paid) return res.status(400).json({ error: 'Payment not successful' });

    const order = await prisma.order.findFirst({ where: { paymentRef: reference } });
    if (!order) return res.status(404).json({ error: 'Order not found for this payment' });

    const updated = await markPaid(order.id, { method: 'PAYSTACK', reference });
    res.json({ ok: true, orderId: updated.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Verification failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/payments/:orderId/simulate  — demo only (no Paystack keys)
// ---------------------------------------------------------------------------
router.post('/:orderId/simulate', async (req, res) => {
  if (config.paystack.enabled) return res.status(403).json({ error: 'Simulation disabled when Paystack is configured' });
  try {
    const updated = await markPaid(req.params.orderId, { method: 'SIMULATED' });
    res.json({ ok: true, orderId: updated.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Simulation failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/payments/webhook  — Paystack server-to-server callback
// ---------------------------------------------------------------------------
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  if (!verifyWebhook(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  try {
    const payload = JSON.parse(req.body.toString());
    if (payload.event === 'charge.success') {
      const reference = payload.data?.reference;
      const order = await prisma.order.findFirst({ where: { paymentRef: reference } });
      if (order) await markPaid(order.id, { method: 'PAYSTACK', reference });
    }
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

export default router;
