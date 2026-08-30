import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { getSettings } from '../services/settings.js';

const router = Router();

// POST /api/reviews  { orderId, rating, comment }  — only for delivered orders you own
router.post('/', requireAuth, async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings.enableReviews) return res.status(403).json({ error: 'Reviews are currently disabled' });

    const { orderId, rating, comment } = req.body || {};
    const r = Math.round(Number(rating));
    if (!orderId || !r || r < 1 || r > 5) {
      return res.status(400).json({ error: 'A rating between 1 and 5 is required' });
    }
    const order = await prisma.order.findUnique({ where: { id: String(orderId) } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.userId !== req.user.id) return res.status(403).json({ error: 'This order does not belong to you' });
    if (order.status !== 'DELIVERED') return res.status(400).json({ error: 'You can only review delivered orders' });

    const existing = await prisma.review.findUnique({ where: { orderId: order.id } });
    if (existing) return res.status(409).json({ error: 'You have already reviewed this order' });

    const review = await prisma.review.create({
      data: {
        orderId: order.id,
        userId: req.user.id,
        rating: r,
        comment: comment ? String(comment).slice(0, 1000) : null,
      },
    });

    // Small thank-you bonus for reviewing
    await prisma.user.update({ where: { id: req.user.id }, data: { loyaltyPoints: { increment: 5 } } });

    res.status(201).json({ review, bonusPoints: 5 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to save review' });
  }
});

// GET /api/reviews/recent — latest approved reviews (public, for homepage testimonials)
router.get('/recent', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: {
        user: { select: { fullName: true } },
        order: { select: { id: true } },
      },
    });
    res.json({ reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

// GET /api/reviews/stats — average rating + count (public)
router.get('/stats', async (req, res) => {
  try {
    const agg = await prisma.review.aggregate({ _avg: { rating: true }, _count: true });
    res.json({ average: Math.round((agg._avg.rating || 0) * 10) / 10, count: agg._count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load review stats' });
  }
});

export default router;
