import { Router } from 'express';
import { prisma } from '../prisma.js';

const router = Router();

// POST /api/promos/validate  { code, subtotal }
router.post('/validate', async (req, res) => {
  try {
    const { code, subtotal } = req.body || {};
    const promo = await prisma.promo.findUnique({
      where: { code: String(code || '').toUpperCase().trim() },
    });
    if (!promo || !promo.active) return res.status(404).json({ error: 'Invalid promo code' });
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'This promo code has expired' });
    }
    if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
      return res.status(400).json({ error: 'This promo code has reached its usage limit' });
    }
    const discount =
      promo.type === 'PERCENT'
        ? Math.round(Number(subtotal) * (promo.value / 100) * 100) / 100
        : Math.min(Number(promo.value), Number(subtotal));
    res.json({
      promo: { id: promo.id, code: promo.code, type: promo.type, value: promo.value },
      discount: Math.round(discount * 100) / 100,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to validate promo' });
  }
});

export default router;
