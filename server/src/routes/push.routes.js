import { Router } from 'express';
import { prisma } from '../prisma.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import {
  publicKey,
  pushEnabled,
  saveSubscription,
  removeSubscription,
  sendPushToUser,
} from '../services/push.js';

const router = Router();

// GET /api/push/public-key — the browser needs this to subscribe (public by design)
router.get('/public-key', (req, res) => {
  res.json({ enabled: pushEnabled(), publicKey: publicKey() });
});

// POST /api/push/subscribe { endpoint, keys: { p256dh, auth } }
// Works signed-in (tied to the account, so every device that customer uses is covered)
// or signed-out (device-only, still useful for a guest waiting on a restock).
router.post('/subscribe', optionalAuth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    const sub = await saveSubscription({
      userId: req.user?.id || null,
      endpoint,
      keys,
      userAgent: req.get('user-agent') || null,
    });
    res.status(201).json({ ok: true, id: sub.id, personal: !!req.user });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to save the subscription' });
  }
});

// POST /api/push/unsubscribe { endpoint }
router.post('/unsubscribe', async (req, res) => {
  try {
    const { count } = await removeSubscription(req.body?.endpoint);
    res.json({ ok: true, removed: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove the subscription' });
  }
});

// GET /api/push/status — is this account subscribed, and is push configured at all?
router.get('/status', requireAuth, async (req, res) => {
  try {
    const devices = await prisma.pushSubscription.count({ where: { userId: req.user.id } });
    res.json({ enabled: pushEnabled(), devices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check the notification status' });
  }
});

// POST /api/push/test — send yourself one, to prove the setup works end to end
router.post('/test', requireAuth, async (req, res) => {
  try {
    const devices = await prisma.pushSubscription.count({ where: { userId: req.user.id } });
    if (devices === 0) {
      return res
        .status(400)
        .json({ error: 'No device is subscribed yet — turn notifications on first.', devices: 0 });
    }
    const result = await sendPushToUser(req.user.id, {
      title: 'Homely Treats notifications are on',
      body: 'This is what a "your cake is ready" alert looks like.',
      url: '/account',
      tag: 'push-test',
    });
    res.json({ ok: true, ...result, devices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send the test notification' });
  }
});

export default router;
