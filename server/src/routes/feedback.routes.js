import { Router } from 'express';
import { prisma } from '../prisma.js';
import { feedbackLimiter } from '../middleware/security.js';
import { verifyTurnstile } from '../services/turnstile.js';

const router = Router();

/**
 * Public feedback channel — "what did you think of the shop?"
 *
 * Distinct from product reviews (which a customer earns by receiving an order):
 * anyone can leave feedback, and the bakery chooses which notes are published on
 * the homepage. Submissions start PENDING and are never shown until approved.
 */

// POST /api/feedback  { name, rating, message }
router.post('/', feedbackLimiter, async (req, res) => {
  try {
    const captchaOk = await verifyTurnstile(req);
    if (!captchaOk) return res.status(400).json({ error: 'Verification failed. Please try again.' });

    const name = String(req.body?.name || '').trim().slice(0, 80) || 'A Homely Treats customer';
    const rating = Number(req.body?.rating);
    const message = String(req.body?.message || '').trim().slice(0, 600);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Please choose a rating from 1 to 5 stars.' });
    }
    if (message.length < 10) {
      return res.status(400).json({ error: 'Please write a few words — at least 10 characters.' });
    }

    await prisma.feedback.create({ data: { name, rating, message } });
    res.status(201).json({
      ok: true,
      message: 'Thank you! Your feedback has reached the bakery — we read every note.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save your feedback. Please try again.' });
  }
});

// GET /api/feedback/public — approved notes for the homepage, newest first.
router.get('/public', async (req, res) => {
  try {
    const items = await prisma.feedback.findMany({
      where: { status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, name: true, rating: true, message: true, createdAt: true },
    });
    res.json({ feedback: items });
  } catch (err) {
    console.error(err);
    res.json({ feedback: [] });
  }
});

export default router;
