import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../prisma.js';
import { signToken, publicUser } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';
import {
  loginLimiter,
  registerLimiter,
  verifyLimiter,
  forgotLimiter,
  resetLimiter,
} from '../middleware/security.js';
import { sendEmail } from '../services/email.js';
import { config } from '../config.js';

const router = Router();

const BCRYPT_COST = 12;

/** Enforce a strong password: ≥8 chars, at least one letter and one digit. */
function passwordError(password) {
  const p = String(password || '');
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(p)) return 'Password must contain at least one letter';
  if (!/[0-9]/.test(p)) return 'Password must contain at least one number';
  return null;
}

/** Basic validation/normalisation helpers to keep stored data tidy & bounded. */
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || ''));

// POST /api/auth/register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body || {};
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'Full name, email, phone and password are required' });
    }
    if (!validEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
    const pwErr = passwordError(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const normalized = String(email).toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const verificationToken = crypto.randomBytes(24).toString('hex');

    const user = await prisma.user.create({
      data: {
        fullName: clean(fullName, 80),
        email: normalized,
        phone: clean(phone, 30),
        passwordHash,
        verificationToken,
      },
    });

    // Send verification email (real via Resend, or simulated to console)
    const verifyUrl = `${config.clientUrl}/verify?token=${verificationToken}`;
    await sendEmail({
      to: normalized,
      subject: 'Homely Treats — verify your email',
      html: `<h2>Welcome to Homely Treats</h2><p>Hi ${clean(fullName, 80)}, please confirm your email address:</p>
             <p><a href="${verifyUrl}" style="background:#C4763B;color:#fff;padding:12px 24px;border-radius:24px;text-decoration:none;">Verify my email</a></p>
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
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    // Suspended staff/rider accounts cannot sign in.
    if (user.active === false) {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact us.' });
    }

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
router.post('/resend-verification', verifyLimiter, requireAuth, async (req, res) => {
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
        fullName: fullName ? clean(fullName, 80) : req.user.fullName,
        phone: phone ? clean(phone, 30) : req.user.phone,
      },
    });
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/forgot-password  { email }
//
// Always answers 200 with the same body, whether or not the address exists, so
// the endpoint can't be used to discover which emails have accounts.
// Only a SHA-256 hash of the token is stored; the raw token exists solely in the
// email we send.
// ---------------------------------------------------------------------------
const RESET_TOKEN_TTL_MINUTES = 30;

const hashToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');

router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const generic = { ok: true, message: 'If that email is registered, a reset link is on its way.' };
  try {
    const email = clean(req.body?.email, 160).toLowerCase();
    if (!validEmail(email)) return res.json(generic);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.active === false) return res.json(generic);

    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashToken(rawToken),
        resetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      },
    });

    const link = `${config.clientUrl}/reset-password?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Homely Treats — reset your password',
      html: `
        <h2>Reset your password</h2>
        <p>Hello ${user.fullName}, we received a request to reset your Homely Treats password.</p>
        <p><a href="${link}" style="background:#C4763B;color:#fff;padding:12px 22px;border-radius:100px;text-decoration:none;">Choose a new password</a></p>
        <p style="color:#7A5C44;font-size:13px;">This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes and can only be used once.
        If you didn't ask for this, you can safely ignore this email — your password stays unchanged.</p>`,
      type: 'PASSWORD_RESET',
    });

    res.json(generic);
  } catch (err) {
    console.error(err);
    // Still generic: never reveal whether the address exists.
    res.json(generic);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/reset-password  { token, password }
// ---------------------------------------------------------------------------
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    if (!token) return res.status(400).json({ error: 'Reset link is invalid' });

    const pwErr = passwordError(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const user = await prisma.user.findFirst({ where: { resetTokenHash: hashToken(token) } });
    // Single generic message: don't distinguish "unknown token" from "expired".
    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenExpires: null,
        // A completed reset proves control of the inbox, so treat the email as
        // verified too (and clear any pending verification token).
        emailVerified: true,
        verificationToken: null,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// PUT /api/auth/password
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    const pwErr = passwordError(newPassword);
    if (pwErr) return res.status(400).json({ error: pwErr });
    const ok = await bcrypt.compare(String(currentPassword), req.user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        passwordHash,
        // Changing the password invalidates any outstanding reset link.
        resetTokenHash: null,
        resetTokenExpires: null,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password change failed' });
  }
});

export default router;
