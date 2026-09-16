import { Router } from 'express';
import { prisma } from '../prisma.js';
import { ratingsByProduct, productReviewSummary } from '../services/productReviews.js';

const router = Router();

// GET /api/products?category=&search=&sort=&featured=
router.get('/', async (req, res) => {
  try {
    const { category, search, sort, featured } = req.query;
    const where = { isActive: true };
    if (category && category !== 'ALL') where.category = category;
    if (featured === 'true') where.featured = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    let orderBy = [{ featured: 'desc' }, { createdAt: 'asc' }];
    if (sort === 'price-asc') orderBy = [{ basePrice: 'asc' }];
    if (sort === 'price-desc') orderBy = [{ basePrice: 'desc' }];
    if (sort === 'name') orderBy = [{ name: 'asc' }];

    const products = await prisma.product.findMany({
      where,
      orderBy,
      include: { sizeOptions: { orderBy: { price: 'asc' } } },
    });
    // Stars on the menu cards, from approved reviews only.
    const ratings = await ratingsByProduct();
    res.json({
      products: products.map((p) => ({ ...p, rating: ratings[p.id] || { average: 0, count: 0 } })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { sizeOptions: { orderBy: { price: 'asc' } } },
    });
    // De-listed products stay visible to anyone holding the link (and to admin screens)
    // so a shared URL doesn't 404, but the storefront checks `isActive` before ordering.
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // What customers say about it, from approved reviews of orders that contained it.
    const reviews = await productReviewSummary(product.id);
    res.json({ product: { ...product, ...reviews } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

export default router;
