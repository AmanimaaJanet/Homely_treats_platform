import { prisma } from '../prisma.js';

/**
 * Stock handling.
 *
 * `stock` is authoritative: an order cannot be placed for more units than are on
 * hand, so the bakery can never oversell. Products that are made-to-order should
 * carry a generous stock figure (or be restocked routinely); setting a product's
 * stock to 0 marks it sold out automatically.
 *
 * Decrements use a conditional `updateMany` (stock >= quantity) rather than a
 * read-then-write, so two customers checking out at the same instant can't both
 * claim the last cake.
 */

/** Thrown when a line item can't be fulfilled; carries a customer-safe message. */
export class StockError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StockError';
    this.status = 409;
  }
}

/**
 * Atomically reserve stock for every line item.
 * Call this INSIDE a transaction together with the order insert — if any line
 * fails, the whole transaction rolls back and no stock is lost.
 *
 * @param {Array<{productId: string, name: string, quantity: number}>} items
 */
export async function reserveStock(tx, items) {
  // Aggregate first: the same product can appear on two lines (different sizes),
  // and both lines must be satisfied from the same stock pool.
  const needed = new Map();
  for (const it of items) {
    if (!it.productId) continue;
    needed.set(it.productId, (needed.get(it.productId) || 0) + Number(it.quantity || 1));
  }

  for (const [productId, qty] of needed) {
    const res = await tx.product.updateMany({
      where: { id: productId, inStock: true, stock: { gte: qty } },
      data: { stock: { decrement: qty } },
    });
    if (res.count !== 1) {
      // Either not enough stock or someone bought it a moment ago.
      const p = await tx.product.findUnique({ where: { id: productId } });
      if (!p) throw new StockError('One or more products are no longer available');
      if (!p.inStock) throw new StockError(`"${p.name}" just sold out`);
      throw new StockError(
        `Only ${p.stock} × "${p.name}" left in stock — please reduce the quantity`
      );
    }
  }

  // Any product that hit zero is now sold out.
  for (const productId of needed.keys()) {
    await tx.product.updateMany({
      where: { id: productId, stock: { lte: 0 } },
      data: { inStock: false },
    });
  }
}

/**
 * Put stock back (order cancelled before it was baked/collected) and re-list any
 * product that had been marked sold out. Runs in a transaction for consistency.
 */
export async function restoreStock(items) {
  const byProduct = new Map();
  for (const it of items || []) {
    if (!it.productId) continue;
    byProduct.set(it.productId, (byProduct.get(it.productId) || 0) + Number(it.quantity || 1));
  }
  if (byProduct.size === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const [productId, qty] of byProduct) {
      await tx.product.updateMany({
        where: { id: productId },
        data: { stock: { increment: qty }, inStock: true },
      });
    }
  });
}
