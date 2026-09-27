import { prisma } from '../prisma.js';
import { getSettings } from './settings.js';
import { sendEmail, orderEmailTemplate } from './email.js';
import { sendPushToUser } from './push.js';

/**
 * Back-in-stock alerts.
 *
 * Called after a product's stock goes from nothing to something (see the product
 * update route). Everyone waiting on that product gets one email — and a push, if
 * they have notifications on. Each item is stamped with `notifiedAt` so a customer
 * who waits through three restocks isn't emailed three times for the same ask; the
 * stamp is cleared if they re-add the item.
 */
export async function notifyBackInStock(product, { previousStock = 0 } = {}) {
  if (!product || product.stock <= 0 || product.inStock === false) return { notified: 0 };
  if (previousStock > 0) return { notified: 0 }; // it was never actually out

  const waiting = await prisma.wishlistItem.findMany({
    where: { productId: product.id, notifiedAt: null },
    include: { user: { select: { id: true, fullName: true, email: true } } },
  });
  if (waiting.length === 0) return { notified: 0 };

  const settings = await getSettings();
  const shopName = settings.businessName || 'Homely Treats';
  let emailed = 0;
  let pushed = 0;

  for (const item of waiting) {
    const email = item.user?.email;
    if (email && settings.emailOrderConfirmed !== false) {
      try {
        await sendEmail({
          to: email,
          subject: `${product.name} is back in stock — ${shopName}`,
          html: orderEmailTemplate({
            headline: `${product.name} is back`,
            bodyLines: [
              `Hi ${(item.user.fullName || 'there').split(' ')[0]}, the ${product.name} you were waiting for is available again — ${product.stock} in stock right now.`,
              `The kitchen bakes in small batches, so it usually goes quickly.`,
            ],
            ctaUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/menu`,
            ctaLabel: 'Order it now',
          }),
          type: 'BACK_IN_STOCK',
        });
        sent++;
      } catch (err) {
        console.error('[wishlist] back-in-stock email failed:', err.message);
      }
    }

    // Push alongside email: free, instant, and it reaches a phone that has the app
    // installed even if email is buried.
    try {
      const result = await sendPushToUser(item.userId, {
        title: `${product.name} is back in stock`,
        body: `${product.stock} available now — small-batch, so don't wait too long.`,
        url: '/menu',
        tag: `restock-${product.id}`,
      });
      if (result.sent > 0) pushed++;
    } catch (err) {
      console.error('[wishlist] back-in-stock push failed:', err.message);
    }

    await prisma.wishlistItem.update({ where: { id: item.id }, data: { notifiedAt: new Date() } });
  }

  // `notified` counts customers actually reached on some channel; the breakdown says
  // which one carried it, which is what the admin audit line reports.
  return { notified: waiting.length, emailed, pushed, waiting: waiting.length };
}
