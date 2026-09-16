import { prisma } from '../prisma.js';
import { getSettings } from './settings.js';
import { sendEmail } from './email.js';

/**
 * Low-stock alerts.
 *
 * The bakery should hear about a product running out *before* a customer tries to
 * order it, not after. Two mechanisms:
 *   1. `lowStockProducts()` lists everything at or below the reorder threshold —
 *      the admin dashboard shows this live.
 *   2. `sendLowStockDigest()` emails the bakery, at most once a day, listing what
 *      needs restocking. A daily digest rather than an email per sale, so the
 *      inbox stays usable.
 *
 * The scheduler lives in startStockAlerts(); note that on a host which sleeps
 * idle instances (e.g. Render's free tier) a scheduled tick may be missed while
 * the service is asleep. That is why the admin screen also shows the list live
 * and offers a "send now" button — the digest is a convenience, not the only line
 * of defence.
 */

const DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000; // once a day
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // look every hour

/**
 * Products that are on sale but running low.
 * A product with stock 0 is already marked out of stock by reserveStock(), so it
 * still appears here (with 0) — that is exactly what needs restocking.
 */
export async function lowStockProducts(settings) {
  const threshold = Number(settings?.lowStockThreshold ?? 5);
  return prisma.product.findMany({
    where: {
      isActive: true,
      stock: { lte: threshold },
    },
    orderBy: [{ stock: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, stock: true, inStock: true, category: true, basePrice: true },
  });
}

function digestHtml({ products, threshold, businessName }) {
  const rows = products
    .map(
      (p) => `
      <tr>
        <td style="padding:9px 12px; border-bottom:1px solid #E8D5C0; color:#2C1A0E;">
          ${p.name}
        </td>
        <td style="padding:9px 12px; border-bottom:1px solid #E8D5C0; text-align:right; font-weight:700; color:${p.stock === 0 ? '#991B1B' : '#92400E'};">
          ${p.stock === 0 ? 'Sold out' : `${p.stock} left`}
        </td>
      </tr>`
    )
    .join('');

  return `
  <div style="font-family: 'DM Sans', Helvetica, Arial, sans-serif; max-width:560px; margin:auto; background:#FDF8F3; border:1px solid #E8D5C0; border-radius:14px; overflow:hidden;">
    <div style="background:#2C1A0E; padding:22px 24px; color:#fff;">
      <p style="margin:0; font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:#E8B86D;">${businessName || 'Homely Treats'}</p>
      <h1 style="margin:8px 0 0; font-family: Georgia, serif; font-size:21px;">Stock needs restocking</h1>
    </div>
    <div style="padding:22px 24px;">
      <p style="margin:0 0 14px; color:#7A5C44; line-height:1.6;">
        ${products.length} item${products.length === 1 ? '' : 's'} at or below your reorder
        threshold of ${threshold}. Restock these so customers don't find them sold out.
      </p>
      <table style="width:100%; border-collapse:collapse; background:#fff; border-radius:10px; overflow:hidden;">
        ${rows}
      </table>
      <p style="margin:18px 0 0; color:#7A5C44; font-size:12px;">
        Update stock in Admin → Products. You can change the threshold in Admin → Settings.
      </p>
    </div>
  </div>`;
}

/**
 * Email the digest. Returns { sent, count, skipped }.
 * `force` bypasses the once-a-day rule (used by the "send now" admin button) —
 * and, importantly, sends even when the list is empty, so an admin testing the
 * setup gets clear feedback rather than silence.
 */
export async function sendLowStockDigest({ force = false } = {}) {
  const settings = await getSettings();
  const products = await lowStockProducts(settings);

  if (settings.lowStockAlerts === false) {
    return { sent: false, count: products.length, skipped: 'alerts-disabled' };
  }
  if (products.length === 0 && !force) {
    return { sent: false, count: 0, skipped: 'nothing-low' };
  }
  if (!force) {
    const last = globalThis.__lastLowStockDigest;
    if (last && Date.now() - last < DIGEST_INTERVAL_MS) {
      return { sent: false, count: products.length, skipped: 'already-sent-today' };
    }
  }

  const to = settings.businessEmail;
  if (!to) return { sent: false, count: products.length, skipped: 'no-business-email' };

  await sendEmail({
    to,
    subject:
      products.length > 0
        ? `Stock alert — ${products.length} item${products.length === 1 ? '' : 's'} running low`
        : 'Stock alert — test email (all items are well stocked)',
    html: digestHtml({
      products,
      threshold: settings.lowStockThreshold ?? 5,
      businessName: settings.businessName,
    }),
    type: 'STOCK_ALERT',
  });

  if (!force) globalThis.__lastLowStockDigest = Date.now();
  return { sent: true, count: products.length, skipped: null };
}

/** Hourly tick that sends the digest at most once a day. */
export function startStockAlerts() {
  const tick = async () => {
    try {
      const result = await sendLowStockDigest();
      if (result.sent) {
        console.log(`[stock] low-stock digest sent (${result.count} product(s))`);
      }
    } catch (err) {
      // Never let a background job take the server down.
      console.error('[stock] digest failed:', err.message);
    }
  };
  // First check shortly after boot, then hourly.
  setTimeout(tick, 60 * 1000);
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref?.(); // don't hold the process open
  return timer;
}
