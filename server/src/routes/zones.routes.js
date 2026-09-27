import { Router } from 'express';
import { prisma } from '../prisma.js';

const router = Router();

// GET /api/zones — active delivery zones (public)
router.get('/', async (req, res) => {
  try {
    const zones = await prisma.deliveryZone.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      // minOrder / freeOver / etaNote travel with the fee so the basket can explain
      // the rule before the customer reaches the payment step.
    });
    res.json({ zones });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load delivery zones' });
  }
});

export default router;
