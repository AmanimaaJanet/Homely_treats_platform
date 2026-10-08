import { Router } from 'express';
import { prisma } from '../prisma.js';
import { applyStatus } from '../services/orderEvents.js';
import { broadcastOrder } from '../services/realtime.js';
import { updateRiderLocation } from '../services/riderLocation.js';
import { requireRider } from '../middleware/auth.js';

const router = Router();

/**
 * Rider app endpoints — fully authenticated.
 *
 * Riders are real accounts (role RIDER) created by an admin; there is no rider
 * self-signup. Every route below requires a valid token belonging to an ACTIVE
 * rider, so customer names, phone numbers and addresses are never exposed to
 * anonymous callers.
 *
 * Privacy detail: an unclaimed delivery shows only the zone, order value and
 * item count — enough to decide whether to take it. The customer's exact address
 * and phone number are revealed only once that rider has accepted the job.
 */

// Fields a rider may see BEFORE accepting a job.
const OPEN_ORDER_SELECT = {
  id: true,
  status: true,
  deliveryZone: true,
  deliveryFee: true,
  total: true,
  readyDate: true,
  createdAt: true,
  notes: true,
  items: { select: { name: true, quantity: true } },
};

// Full detail for a job this rider owns.
const OWN_ORDER_SELECT = {
  id: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  deliveryZone: true,
  deliveryAddress: true,
  deliveryFee: true,
  total: true,
  readyDate: true,
  createdAt: true,
  notes: true,
  guestName: true,
  guestPhone: true,
  riderAcceptedAt: true,
  items: true,
  user: { select: { fullName: true, phone: true } },
};

// GET /api/rider/orders — jobs available to claim + jobs this rider is running
router.get('/orders', requireRider, async (req, res) => {
  try {
    const [available, mine, completed] = await Promise.all([
      prisma.order.findMany({
        where: {
          deliveryMethod: 'DELIVERY',
          status: 'READY',
          riderId: null, // unclaimed only
        },
        orderBy: { createdAt: 'asc' },
        select: OPEN_ORDER_SELECT,
      }),
      prisma.order.findMany({
        where: { riderId: req.user.id, status: 'OUT_FOR_DELIVERY' },
        orderBy: { riderAcceptedAt: 'asc' },
        select: OWN_ORDER_SELECT,
      }),
      prisma.order.findMany({
        where: { riderId: req.user.id, status: 'DELIVERED' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { id: true, deliveryZone: true, deliveryFee: true, total: true, updatedAt: true },
      }),
    ]);
    res.json({ available, mine, completed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load deliveries' });
  }
});

// POST /api/rider/:id/location — the rider app's live position while running a delivery
//
// The rider page sends this every ~10s while it has an OUT_FOR_DELIVERY job. It is
// stored in memory only (see services/riderLocation.js) and broadcast to the
// customer's tracking page. Accepted only from the rider who owns the delivery,
// only while the delivery is actually out for delivery.
router.post('/:id/location', requireRider, async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body || {};
    if (typeof lat !== 'number' || typeof lng !== 'number'
      || !Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'lat and lng must be valid coordinates' });
    }
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.riderId !== req.user.id) {
      return res.status(403).json({ error: 'This delivery is assigned to another rider' });
    }
    if (order.status !== 'OUT_FOR_DELIVERY') {
      // Not an error worth alarming the rider over (they may just have marked it
      // delivered) — but nothing is stored or broadcast.
      return res.status(409).json({ error: 'Order is not out for delivery' });
    }
    const position = updateRiderLocation(order.id, {
      lat,
      lng,
      accuracy: Number.isFinite(accuracy) ? Math.max(0, accuracy) : undefined,
      riderName: order.riderName || req.user.fullName,
    });
    res.json({ ok: true, updatedAt: position.updatedAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// GET /api/rider/earnings — this rider's delivery history, with the delivery fees
// attached to the orders they completed. What a rider is actually paid is between
// them and the bakery; the numbers here are the honest underlying facts.
router.get('/earnings', requireRider, async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [allTime, week, recent] = await Promise.all([
      prisma.order.aggregate({
        where: { riderId: req.user.id, status: 'DELIVERED' },
        _count: { id: true },
        _sum: { deliveryFee: true },
      }),
      prisma.order.aggregate({
        where: { riderId: req.user.id, status: 'DELIVERED', updatedAt: { gte: weekAgo } },
        _count: { id: true },
        _sum: { deliveryFee: true },
      }),
      prisma.order.findMany({
        where: { riderId: req.user.id, status: 'DELIVERED' },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { id: true, deliveryZone: true, deliveryFee: true, total: true, updatedAt: true },
      }),
    ]);
    const deliveries = allTime._count.id;
    const fees = allTime._sum.deliveryFee || 0;
    res.json({
      allTime: { deliveries, deliveryFees: fees, averageFee: deliveries ? fees / deliveries : 0 },
      thisWeek: {
        deliveries: week._count.id,
        deliveryFees: week._sum.deliveryFee || 0,
      },
      recent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load earnings' });
  }
});

// GET /api/rider/me — the signed-in rider's profile
router.get('/me', requireRider, (req, res) => {
  const { id, fullName, email, phone, role } = req.user;
  res.json({ rider: { id, fullName, email, phone, role } });
});

// POST /api/rider/:id/accept
// Claims an unclaimed READY delivery. The rider's name/phone come from their own
// authenticated profile — never from the request body, so a rider cannot
// impersonate someone else.
router.post('/:id/accept', requireRider, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'READY') {
      return res.status(409).json({ error: 'This delivery is no longer available' });
    }
    if (order.riderId && order.riderId !== req.user.id) {
      return res.status(409).json({ error: 'Another rider has already taken this delivery' });
    }
    if (order.deliveryMethod !== 'DELIVERY') {
      return res.status(400).json({ error: 'This order is a pickup, not a delivery' });
    }

    // Conditional update: only succeeds while the job is still unclaimed, so two
    // riders tapping "Accept" at the same moment can't both win it.
    const claimed = await prisma.order.updateMany({
      where: { id: order.id, status: 'READY', riderId: null },
      data: {
        riderId: req.user.id,
        riderName: req.user.fullName,
        riderPhone: req.user.phone,
        riderAcceptedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      return res.status(409).json({ error: 'Another rider has already taken this delivery' });
    }

    const updated = await applyStatus(order.id, 'OUT_FOR_DELIVERY', `Accepted by ${req.user.fullName}`);
    broadcastOrder(order.id, {
      riderName: req.user.fullName,
      riderPhone: req.user.phone,
      status: 'OUT_FOR_DELIVERY',
    });
    res.json({ order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to accept delivery' });
  }
});

// POST /api/rider/:id/deliver — only the rider running this delivery (or admin)
router.post('/:id/deliver', requireRider, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.riderId !== req.user.id) {
      return res.status(403).json({ error: 'This delivery is assigned to another rider' });
    }
    if (order.status !== 'OUT_FOR_DELIVERY') {
      return res.status(400).json({ error: 'Order is not out for delivery' });
    }
    const updated = await applyStatus(order.id, 'DELIVERED', 'Delivered by rider');
    res.json({ order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark delivered' });
  }
});

export default router;
