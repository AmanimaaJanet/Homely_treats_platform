import rateLimit from 'express-rate-limit';

/**
 * Security rate limiters.
 * `trust proxy: 1` is set so that, behind Render's reverse proxy,
 * the client IP (X-Forwarded-For) is used instead of the proxy's IP.
 *
 * Testing note: set DISABLE_RATE_LIMITS=true to run the E2E suite repeatedly
 * from one IP without tripping the limiter. This is deliberately ignored in
 * production, so a misconfigured environment variable can never weaken a
 * deployed site.
 */
const LIMITS_DISABLED =
  process.env.DISABLE_RATE_LIMITS === 'true' && process.env.NODE_ENV !== 'production';

/** Wrap a limiter so it becomes a pass-through when limits are disabled locally. */
const guard = (limiter) => (LIMITS_DISABLED ? (req, res, next) => next() : limiter);

// Strict limiter for authentication endpoints (brute-force protection).
// 20 attempts/15 min balances brute-force defence against the reality that many
// Ghanaian customers share mobile-network IPs (carrier-grade NAT).
const loginLimiterRaw = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 attempts per IP
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});

const registerLimiterRaw = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // 10 account creations per IP per hour
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-ups from this device. Please try again later.' },
});

// General API limiter — throttles abuse without affecting normal browsing.
const apiLimiterRaw = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Extra-strict limiter for email verification resends (spam protection).
const verifyLimiterRaw = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many verification emails requested. Please wait.' },
});

// Photo uploads are guest-accessible, so cap them to prevent disk abuse.
const uploadLimiterRaw = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please try again later.' },
});

// Password reset requests send an email, so keep them tight: 5 per hour per IP.
// (Prevents using the endpoint to spam a victim's inbox or burn Resend quota.)
const forgotLimiterRaw = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Please try again later.' },
});

// Guessing a reset token is computationally hopeless, but throttle anyway.
const resetLimiterRaw = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please request a new reset link.' },
});

// Public review submission — stops one person flooding a product with reviews.
const reviewLimiterRaw = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many reviews submitted. Please try again later.' },
});

// ---------------------------------------------------------------------------
// Public exports — each limiter wrapped so DISABLE_RATE_LIMITS works in dev.
// ---------------------------------------------------------------------------
export const loginLimiter = guard(loginLimiterRaw);
export const registerLimiter = guard(registerLimiterRaw);
export const apiLimiter = guard(apiLimiterRaw);
export const verifyLimiter = guard(verifyLimiterRaw);
export const uploadLimiter = guard(uploadLimiterRaw);
export const forgotLimiter = guard(forgotLimiterRaw);
export const resetLimiter = guard(resetLimiterRaw);
export const reviewLimiter = guard(reviewLimiterRaw);
export const rateLimitsDisabled = LIMITS_DISABLED;
