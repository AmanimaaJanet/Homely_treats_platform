import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Session cookies + CSRF protection.
 *
 * The browser keeps its session in an **httpOnly** cookie, so an injected script
 * (XSS) cannot read the token the way it could when it lived in localStorage.
 * API clients (the rider app's fetch layer, scripts, the test suite) can still
 * use `Authorization: Bearer <token>` — CSRF only applies to cookie sessions,
 * because only cookies are attached automatically by the browser.
 *
 * CSRF defence is double-submit: a random value is stored in a readable cookie
 * and must be echoed in the `X-CSRF-Token` header on any state-changing request.
 * A cross-site attacker can make the browser send the cookie but cannot read it
 * to set the matching header.
 */

export const SESSION_COOKIE = 'ht_session';
export const CSRF_COOKIE = 'ht_csrf';
export const CSRF_HEADER = 'x-csrf-token';

const isProd = process.env.NODE_ENV === 'production';

const baseCookie = {
  // Lax still sends the cookie on top-level navigation (so a bookmarked link
  // works) but not on cross-site POSTs — the main CSRF vector.
  sameSite: 'lax',
  // Secure cookies are required in production. Locally we must allow http, or
  // nothing would work on http://localhost.
  secure: isProd,
  path: '/',
};

/** Issue a fresh session + CSRF cookie pair. Returns the CSRF value. */
export function setSessionCookies(res, token) {
  const csrf = crypto.randomBytes(24).toString('hex');
  res.cookie(SESSION_COOKIE, token, {
    ...baseCookie,
    httpOnly: true, // not readable by JavaScript — the whole point
    maxAge: config.session.maxAgeMs,
  });
  res.cookie(CSRF_COOKIE, csrf, {
    ...baseCookie,
    httpOnly: false, // the client must read this to echo it back
    maxAge: config.session.maxAgeMs,
  });
  return csrf;
}

/** Clear both cookies (sign-out). */
export function clearSessionCookies(res) {
  res.clearCookie(SESSION_COOKIE, { ...baseCookie, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...baseCookie, httpOnly: false });
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Reject state-changing requests that carry a session cookie but no matching
 * CSRF header. Runs globally; anything authenticated by Bearer token — or not
 * authenticated at all — passes straight through.
 */
export function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!config.session.csrfEnabled) return next();

  const hasSessionCookie = Boolean(req.cookies?.[SESSION_COOKIE]);
  // No cookie session → nothing for a cross-site attacker to abuse.
  if (!hasSessionCookie) return next();
  // Bearer-authenticated clients cannot be driven by a victim's browser.
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  const sent = req.headers[CSRF_HEADER];
  const expected = req.cookies?.[CSRF_COOKIE];
  if (!expected || !sent || sent !== expected) {
    return res.status(403).json({
      error: 'Your session security check failed. Please refresh the page and try again.',
      code: 'CSRF_FAILED',
    });
  }
  next();
}

/**
 * Read the session token from the httpOnly cookie, falling back to the
 * Authorization header for API clients.
 */
export function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[SESSION_COOKIE] || null;
}
