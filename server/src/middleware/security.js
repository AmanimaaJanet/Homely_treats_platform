import rateLimit from 'express-rate-limit';

/**
 * Security rate limiters.
 * `trust proxy: 1` is set so that, behind Render's reverse proxy,
 * the client IP (X-Forwarded-For) is used instead of the proxy's IP.
 */

// Strict limiter for authentication endpoints (brute-force protection).
// 20 attempts/15 min balances brute-force defence against the reality that many
// Ghanaian customers share mobile-network IPs (carrier-grade NAT).
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 20 attempts per IP
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10, // 10 account creations per IP per hour
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-ups from this device. Please try again later.' },
});

// General API limiter — throttles abuse without affecting normal browsing.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Extra-strict limiter for email verification resends (spam protection).
export const verifyLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many verification emails requested. Please wait.' },
});

// Photo uploads are guest-accessible, so cap them to prevent disk abuse.
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please try again later.' },
});
