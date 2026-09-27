import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * Wishlist — "tell me when it's back".
 *
 * A bakery sells out; that is the business. What matters is that the sold-out moment
 * doesn't lose the customer: they ask to be told, and the next restock is a queue of
 * people who already wanted the thing.
 */

async function listFor(userId) {
  return prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          category: true,
          basePrice: true,
          inStock: true,
          stock: true,
          images: true,
          icon: true,
          badge: true,
          isActive: true,
        },
      },
    },
  });
}

// GET /api/wishlist
router.get('/', requireAuth, async (req, res) => {
  try {
    res.json({ items: await listFor(req.user.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load your saved items' });
  }
});

// GET /api/wishlist/ids — just the product ids, so the storefront can draw hearts
router.get('/ids', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.wishlistItem.findMany({
      where: { userId: req.user.id },
      select: { productId: true },
    });
    res.json({ productIds: rows.map((r) => r.productId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load your saved items' });
  }
});

// POST /api/wishlist { productId }
router.post('/', requireAuth, async (req, res) => {
  try {
    const { productId } = req.body || {};
    if (!productId) return res.status(400).json({ error: 'A product is required' });

    const product = await prisma.product.findFirst({ where: { id: String(productId), isActive: true } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const item = await prisma.wishlistItem.upsert({
      where: { userId_productId: { userId: req.user.id, productId: product.id } },
      update: { notifiedAt: null },
      create: { userId: req.user.id, productId: product.id },
    });

    res.status(201).json({
      item,
      // Tell the customer exactly what happens next, depending on stock right now.
      message: product.inStock
        ? `Saved ${product.name} to your list.`
        : `We'll email you the moment ${product.name} is back in stock.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save that product' });
  }
});

// DELETE /api/wishlist/:productId
router.delete('/:productId', requireAuth, async (req, res) => {
  try {
    await prisma.wishlistItem.deleteMany({
      where: { userId: req.user.id, productId: req.params.productId },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove that product' });
  }
});

export default router;
