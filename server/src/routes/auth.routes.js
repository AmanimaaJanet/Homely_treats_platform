import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../prisma.js';
import { signToken, publicUser } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import { sendEmail } from '../services/email.js';
import { config } from '../config.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body || {};
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'Full name, email, phone and password are required' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const normalized = String(email).toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(24).toString('hex');

    const user = await prisma.user.create({
      data: {
        fullName: String(fullName).trim(),
        email: normalized,
        phone: String(phone).trim(),
        passwordHash,
        verificationToken,
      },
    });

    // Send verification email (real via Resend, or simulated to console)
    const verifyUrl = `${config.clientUrl}/verify?token=${verificationToken}`;
    await sendEmail({
      to: normalized,
      subject: 'Homely Treats — verify your email',
      html: `<h2>Welcome to Homely Treats</h2><p>Hi ${fullName}, please confirm your email address:</p>
             <p><a href="${verifyUrl}" style="background:#e91e63;color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;">Verify my email</a></p>
             <p>Or open this link: ${verifyUrl}</p>`,
      type: 'ORDER_CONFIRMED', // reused channel, logged generically
    });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user), verifyUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// GET /api/auth/verify?token=...
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.query;
    const user = await prisma.user.findFirst({ where: { verificationToken: String(token || '') } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null },
    });
    res.json({ ok: true, message: 'Email verified successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
    const verificationToken = crypto.randomBytes(24).toString('hex');
    await prisma.user.update({ where: { id: user.id }, data: { verificationToken } });
    const verifyUrl = `${config.clientUrl}/verify?token=${verificationToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Homely Treats — verify your email',
      html: `<h2>Homely Treats</h2><p>Confirm your email: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
      type: 'ORDER_CONFIRMED',
    });
    res.json({ ok: true, verifyUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resend verification' });
  }
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { fullName, phone } = req.body || {};
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName: fullName ? String(fullName).trim() : req.user.fullName,
        phone: phone ? String(phone).trim() : req.user.phone,
      },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// PUT /api/auth/password
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password change failed' });
  }
});

export default router;
