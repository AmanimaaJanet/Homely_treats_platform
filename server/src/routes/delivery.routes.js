import { Router } from 'express';
import { deliveryOptions } from '../services/delivery.js';

const router = Router();

/**
 * GET /api/delivery/options?date=YYYY-MM-DD
 *
 * Public. Checkout calls it every time the customer changes the date, so the zone
 * fees, pickup counters and slot availability shown are always the live ones — a
 * window that filled up a minute ago can no longer be selected.
 */
router.get('/options', async (req, res) => {
  try {
    const options = await deliveryOptions({ date: req.query.date });
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load delivery options' });
  }
});

export default router;
