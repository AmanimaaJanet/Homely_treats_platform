import { Router } from 'express';
import { prisma } from '../prisma.js';
import { applyStatus } from '../services/orderEvents.js';
import { broadcastOrder } from '../services/realtime.js';

const router = Router();

/**
 * Lightweight rider app endpoints.
 * NOTE: for a real deployment, gate these behind rider authentication
 * (a rider account role + login). For this demo, the rider self-identifies
 * with name/phone when accepting a delivery.
 */

// GET /api/rider/orders — deliveries awaiting pickup or out for delivery
router.get('/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        deliveryMethod: 'DELIVERY',
        status: { in: ['READY', 'OUT_FOR_DELIVERY'] },
      },
      orderBy: { createdAt: 'asc' },
      include: { items: true, user: true },
    });
    res.json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load deliveries' });
  }
});

// POST /api/rider/:id/accept  { riderName, riderPhone }
router.post('/:id/accept', async (req, res) => {
  try {
    const { riderName, riderPhone } = req.body || {};
    if (!riderName) return res.status(400).json({ error: 'Rider name is required' });
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!['READY', 'OUT_FOR_DELIVERY'].includes(order.status)) {
      return res.status(400).json({ error: 'Order is not available for delivery' });
    }
    await prisma.order.update({
      where: { id: order.id },
      data: { riderName, riderPhone: riderPhone || null },
    });
    const updated = await applyStatus(order.id, 'OUT_FOR_DELIVERY', `Accepted by ${riderName}`);
    broadcastOrder(order.id, { riderName, status: 'OUT_FOR_DELIVERY' });
    res.json({ order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to accept delivery' });
  }
});

// POST /api/rider/:id/deliver
router.post('/:id/deliver', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'OUT_FOR_DELIVERY') {
      return res.status(400).json({ error: 'Order is not out for delivery' });
    }
    const updated = await applyStatus(order.id, 'DELIVERED', 'Delivered by rider');
    res.json({ order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to mark delivered' });
  }
});

export default router;
