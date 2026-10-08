/**
 * The storefront's public base URL — the one true source for every link the server
 * puts in the outside world: Paystack's after-payment return URL, track links in
 * SMS/WhatsApp/email, verification and password-reset links, sitemap URLs.
 *
 * The old behaviour used CLIENT_URL with a hard default of http://localhost:5173.
 * On a host where CLIENT_URL was never set (easy to miss — Render gives you a URL,
 * it does not tell you to copy it into an env var), every one of those links sent
 * customers to their own laptop after payment: "localhost:5173 — web page is not
 * available". This helper makes that impossible:
 *
 * - A real CLIENT_URL (non-localhost) always wins — explicit configuration is best.
 * - In development, the localhost default is exactly right, as before.
 * - In production without a real CLIENT_URL, the URL is derived from each request
 *   (the browser's own Origin when it matches the host the request arrived on —
 *   an Origin that does not match is ignored, so a forged header cannot rewrite
 *   links — otherwise the Host the request actually arrived on).
 */
const DEV_FALLBACK = 'http://localhost:5173';

const trim = (u) => String(u || '').replace(/\/+$/, '');

const isLocalUrl = (u) => {
  try { return /^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(trim(u)); }
  catch { return true; }
};

export function publicUrl(req) {
  const configured = trim(process.env.CLIENT_URL);

  // Development, or a production that set a real CLIENT_URL: trust the config.
  if (process.env.NODE_ENV !== 'production') return configured || DEV_FALLBACK;
  if (configured && !isLocalUrl(configured)) return configured;

  // Production without a usable CLIENT_URL: ask the request where the site is.
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  const origin = trim(req?.headers?.origin);
  if (origin && host && origin.replace(/^https?:\/\//, '') === String(host).replace(/:\d+$/, '')) {
    return origin; // the browser's own spelling — scheme included
  }
  if (host) {
    const proto = req?.headers?.['x-forwarded-proto'] || (req?.socket?.encrypted ? 'https' : 'http');
    return `${proto}://${host}`;
  }
  return configured || DEV_FALLBACK;
}
