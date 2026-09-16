import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma } from '../prisma.js';

// JWT verification options — algorithm is pinned (never allow alg:none or RS256),
// and issuer/audience must match what signToken() sets.
const VERIFY_OPTS = {
  algorithms: ['HS256'],
  issuer: 'homely-treats',
  audience: 'homely-treats-client',
};

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const payload = jwt.verify(token, config.jwtSecret, VERIFY_OPTS);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return res.status(401).json({ error: 'Account not found' });
    // Deactivated accounts (staff or riders who left) lose access immediately,
    // even while an old token is still within its 24h lifetime.
    if (user.active === false) return res.status(403).json({ error: 'This account has been deactivated' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Role gate. Use AFTER requireAuth. Accounts can be deactivated (staff who leave,
 * compromised rider phones) — a deactivated account is rejected even with a
 * still-valid token.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this area' });
    }
    next();
  };
}

/** Rider-only routes: authenticated, role RIDER, active account. */
export const requireRider = [requireAuth, requireRole('RIDER')];

/** Optional auth — populates req.user if a valid token exists, else continues. */
export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      const payload = jwt.verify(token, config.jwtSecret, VERIFY_OPTS);
      const user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (user) req.user = user;
    }
  } catch {
    /* ignore */
  }
  next();
}
