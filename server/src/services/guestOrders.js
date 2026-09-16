import { prisma } from '../prisma.js';

/**
 * Guest → account conversion.
 *
 * A guest order used to be a dead end: the customer got their cake and the shop never
 * saw them again. When a guest signs up, they want to see what they ordered last time —
 * so we attach their earlier orders to the new account.
 *
 * Safety matters more than convenience here, because an order carries a home address
 * and a phone number. An order is only attached when we can reasonably say it is the
 * same person:
 *
 *   - the account's email is confirmed AND matches the order's email, or
 *   - the account's email AND phone both match the order's guest details.
 *
 * Someone who merely guesses an email address gets nothing; typing the phone number too
 * means they already knew both, which is what the real customer knows.
 */
export async function linkGuestOrders(user) {
  if (!user?.email) return { claimed: 0, orders: [] };

  const email = String(user.email).toLowerCase().trim();
  const phone = String(user.phone || '').replace(/\s+/g, '');
  const matches = [];

  if (user.emailVerified) {
    matches.push({ guestEmail: email });
  }
  if (phone) {
    matches.push({ guestEmail: email, guestPhone: { in: [phone, phone.replace(/^0/, '233'), phone.replace(/^\+?233/, '0')] } });
  }
  if (matches.length === 0) return { claimed: 0, orders: [] };

  const unclaimed = await prisma.order.findMany({
    where: { userId: null, OR: matches },
    select: { id: true, total: true, createdAt: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  if (unclaimed.length === 0) return { claimed: 0, orders: [] };

  await prisma.order.updateMany({
    where: { id: { in: unclaimed.map((o) => o.id) } },
    data: { userId: user.id },
  });

  // Loyalty points for those past orders were never credited (a guest has no wallet to
  // credit), so the history is joined up rather than re-scored: the customer sees the
  // orders, and future orders earn points normally.
  return { claimed: unclaimed.length, orders: unclaimed };
}

/**
 * The prompt shown after checkout: "keep track of this order".
 * Returns nothing sensitive — just whether the email already has an account, so the
 * customer is pointed at sign-in instead of being asked to register twice.
 */
export async function guestConversionHint(email) {
  const normalized = String(email || '').toLowerCase().trim();
  if (!normalized) return { hasAccount: false };
  const existing = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } });
  return { hasAccount: Boolean(existing), signInUrl: '/signin' };
}
