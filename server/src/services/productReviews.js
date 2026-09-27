import { prisma } from '../prisma.js';

/**
 * Reviews, read through products.
 *
 * A review belongs to an order, not to a single product — a customer rates the whole
 * basket. Asking "what do people say about the chocolate cake?" therefore means: take
 * the approved reviews of every order that contained it. That keeps one review per
 * order (no double-counting, no asks after every line item) while still giving each
 * product a real rating and real quotes.
 *
 * Scale note: this walks approved reviews in memory. A bakery has hundreds of reviews,
 * not millions; if that ever changes, this becomes a materialised rating column.
 */
export async function ratingsByProduct() {
  const reviews = await prisma.review.findMany({
    where: { status: 'APPROVED' },
    select: {
      rating: true,
      order: { select: { items: { select: { productId: true } } } },
    },
  });

  const map = new Map();
  for (const r of reviews) {
    const seen = new Set();
    for (const item of r.order?.items || []) {
      if (!item.productId || seen.has(item.productId)) continue; // one vote per order
      seen.add(item.productId);
      const entry = map.get(item.productId) || { total: 0, count: 0 };
      entry.total += r.rating;
      entry.count += 1;
      map.set(item.productId, entry);
    }
  }

  const out = {};
  for (const [productId, { total, count }] of map) {
    out[productId] = { average: Math.round((total / count) * 10) / 10, count };
  }
  return out;
}

/** Approved reviews for one product, newest first, with the reviewer's name. */
export async function reviewsForProduct(productId, { take = 20 } = {}) {
  const reviews = await prisma.review.findMany({
    where: { status: 'APPROVED', order: { items: { some: { productId } } } },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: { select: { fullName: true } },
      order: { select: { id: true } },
    },
  });
  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    // First name + initial only: a review is public, the customer's full identity is not.
    author: shortName(r.user?.fullName),
    verified: true, // every review in this app comes from a delivered order
    orderId: r.order?.id || null,
  }));
}

export function shortName(fullName) {
  const parts = String(fullName || 'Customer').trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** The single-product view used by the product page. */
export async function productReviewSummary(productId) {
  const [reviews, ratings] = await Promise.all([
    reviewsForProduct(productId),
    ratingsByProduct(),
  ]);
  const rating = ratings[productId] || { average: 0, count: 0 };
  const histogram = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
  }));
  return { rating, reviews, histogram };
}
