import { config } from '../config.js';

/**
 * Cloudflare Turnstile — free bot protection for the public forms that cost us
 * money or create accounts (register, sign in, password reset).
 *
 * Opt-in: with no TURNSTILE_SECRET_KEY configured this is a pass-through, so the
 * app works out of the box in development and testing. Add the keys and the
 * check becomes mandatory automatically.
 *
 * Verification is done server-side against Cloudflare, so a bot cannot simply
 * fake the widget.
 */
export async function verifyTurnstile(req) {
  if (!config.turnstile.enabled) return true;

  const token = req.body?.turnstileToken;
  if (!token || typeof token !== 'string') return false;

  try {
    const body = new URLSearchParams({
      secret: config.turnstile.secretKey,
      response: token,
    });
    if (req.ip) body.set('remoteip', req.ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    if (!data.success) {
      console.warn('[turnstile] rejected:', JSON.stringify(data['error-codes'] || []));
      return false;
    }
    return true;
  } catch (err) {
    // Fail closed: if Cloudflare is unreachable we cannot tell a human from a
    // bot, and these endpoints are the ones worth protecting.
    console.error('[turnstile] verification error:', err.message);
    return false;
  }
}
