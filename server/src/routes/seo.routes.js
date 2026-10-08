import { Router } from 'express';
import { publicUrl } from '../services/publicUrl.js';
import { prisma } from '../prisma.js';
import { getSettings } from '../services/settings.js';

/**
 * Public crawler files: /robots.txt, /sitemap.xml and /structured-data.json.
 *
 * Why serve these from the API rather than as static files:
 *
 * - The sitemap should list the *actual* menu, with each product's real last-modified
 *   date. A hand-written file goes stale the first time a product is added or renamed,
 *   and a sitemap that promises pages which no longer exist is worse than none.
 * - The structured data should describe the real business — name, address, phone,
 *   opening hours and today's price for each item — which lives in the database, not in
 *   a build artefact. Nothing here is invented: if a detail is not set in Admin → Settings,
 *   it is left out rather than guessed.
 *
 * In production the client is served by this same server, so mounting this router
 * before the static handler puts these paths at the site root where crawlers look.
 * The structured data is also served at /api/structured-data.json so the client can
 * fetch it through the same /api prefix the dev-server proxy knows about.
 */

const router = Router();



/** A page worth indexing, with how often it changes and how much it matters. */
const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/menu', changefreq: 'daily', priority: '0.9' },
  { path: '/custom-order', changefreq: 'monthly', priority: '0.8' },
  { path: '/track', changefreq: 'monthly', priority: '0.5' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

/** Nothing behind a sign-in, and nothing personal, belongs in a search result. */
const DISALLOW = ['/admin', '/rider', '/account', '/cart', '/pay', '/verify', '/reset-password', '/forgot-password', '/api'];

router.get('/robots.txt', (req, res) => {
  const siteUrl = publicUrl(req);
  const lines = [
    'User-agent: *',
    'Allow: /',
    ...DISALLOW.map((p) => `Disallow: ${p}`),
    '',
    '# Product photos and videos are content, not clutter.',
    'Allow: /media/',
    'Allow: /uploads/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ];
  res.type('text/plain').send(lines.join('\n'));
});

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const siteUrl = publicUrl(req);
    const products = await prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    const url = ({ loc, lastmod, changefreq, priority }) => [
      '  <url>',
      `    <loc>${siteUrl}${loc}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
      priority ? `    <priority>${priority}</priority>` : null,
      '  </url>',
    ].filter(Boolean).join('\n');

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...STATIC_PAGES.map((p) => url({ loc: p.path, changefreq: p.changefreq, priority: p.priority })),
      // One entry per product still on the menu — out-of-stock and withdrawn items are
      // deliberately absent, so a customer never lands on something they cannot order.
      ...products.map((p) => url({
        loc: `/menu/${p.id}`,
        lastmod: p.createdAt.toISOString().slice(0, 10),
        changefreq: 'weekly',
        priority: '0.7',
      })),
      '</urlset>',
      '',
    ].join('\n');

    res.type('application/xml').send(xml);
  } catch (err) {
    next(err);
  }
});

/**
 * schema.org data describing the bakery and its current menu.
 *
 * `Bakery` (a LocalBusiness), not `Restaurant`: it is accurate, and it is what local
 * results expect for a shop that takes orders for collection and delivery. Prices come
 * from the live menu; anything unknown is omitted rather than filled with a
 * placeholder, because structured data that lies gets a site penalised.
 */
const structuredData = async (req, res, next) => {
  try {
    const [settings, products, reviews] = await Promise.all([
      getSettings(),
      prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, description: true, basePrice: true, images: true, category: true },
        orderBy: { featured: 'desc' },
        take: 50,
      }),
      prisma.review.aggregate({
        where: { status: 'APPROVED' },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const siteUrl = publicUrl(req);

    const business = {
      '@type': 'Bakery',
      '@id': `${siteUrl}/#bakery`,
      name: settings?.businessName || 'Homely Treats',
      url: siteUrl,
      image: `${siteUrl}/og.jpg`,
      logo: `${siteUrl}/brand.png`,
      servesCuisine: 'Cakes, pastries and confectionery',
      currenciesAccepted: 'GHS',
      paymentAccepted: 'Cash, Mobile Money, Card',
      ...(settings?.businessAddress
        ? { address: { '@type': 'PostalAddress', streetAddress: settings.businessAddress, addressLocality: 'Accra', addressCountry: 'GH' } }
        : {}),
      ...(settings?.businessPhone ? { telephone: settings.businessPhone } : {}),
      ...(settings?.businessEmail ? { email: settings.businessEmail } : {}),
      // Only claimed when customers have actually rated the bakery and the reviews were
      // approved — an invented rating is a lie that Google penalises.
      ...(reviews._count.rating > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(reviews._avg.rating.toFixed(1)),
              reviewCount: reviews._count.rating,
              bestRating: 5,
            },
          }
        : {}),
      makesOffer: products.map((p) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Product',
          name: p.name,
          ...(p.description ? { description: p.description } : {}),
          ...(p.images?.length ? { image: p.images[0].startsWith('http') ? p.images[0] : `${siteUrl}${p.images[0]}` } : {}),
          ...(p.category ? { category: p.category } : {}),
        },
        price: p.basePrice,
        priceCurrency: 'GHS',
        availability: 'https://schema.org/InStock',
        url: `${siteUrl}/menu/${p.id}`,
      })),
    };

    res.json({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${siteUrl}/#website`,
          url: siteUrl,
          name: settings?.businessName || 'Homely Treats',
          publisher: { '@id': `${siteUrl}/#bakery` },
          inLanguage: 'en-GH',
        },
        business,
      ],
    });
  } catch (err) {
    next(err);
  }
};

router.get(['/structured-data.json', '/api/structured-data.json'], structuredData);

export default router;
