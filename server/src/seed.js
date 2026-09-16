import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Homely Treats seed.
 *
 * Default  → creates ONLY the store admin account. The storefront starts empty
 *            on purpose so the live site never shows demo/fake content; the
 *            admin builds the real catalog from Admin → Products.
 * --demo   → additionally creates a small *sample* catalogue, Accra delivery
 *            zones and one promo code, so you can click through every screen
 *            (and screenshot/preview the design) before entering real products.
 *            These sample rows are ordinary records — edit or delete them in
 *            Admin → Products / Settings / Promos at any time.
 *
 * Idempotent — safe to run repeatedly (uses upserts).
 */
const DEMO = process.argv.includes('--demo');

const SAMPLE_PRODUCTS = [
  {
    name: 'Celebration Chocolate Cake',
    category: 'CAKE',
    description: 'Rich chocolate sponge layered with fudge frosting — our most requested celebration cake.',
    basePrice: 320,
    icon: 'Cake',
    badge: 'Bestseller',
    flavors: ['Chocolate', 'Vanilla', 'Red Velvet'],
    featured: true,
    stock: 12,
    sizes: [
      { label: '6 inch (serves 6)', serves: 6, price: 320 },
      { label: '8 inch (serves 14)', serves: 14, price: 480 },
      { label: '10 inch (serves 24)', serves: 24, price: 690 },
    ],
  },
  {
    name: 'Vanilla Cupcakes (Box of 6)',
    category: 'CUPCAKE',
    description: 'Soft vanilla cupcakes with swirled buttercream — boxed and ready to share.',
    basePrice: 95,
    icon: 'Cookie',
    flavors: ['Vanilla', 'Strawberry', 'Chocolate'],
    featured: true,
    stock: 30,
    sizes: [
      { label: 'Box of 6', serves: 6, price: 95 },
      { label: 'Box of 12', serves: 12, price: 175 },
    ],
  },
  {
    name: 'Butter Croissants (Pack of 4)',
    category: 'PASTRY',
    description: 'Laminated overnight and baked each morning for a flaky, buttery finish.',
    basePrice: 70,
    icon: 'Croissant',
    badge: 'Baked daily',
    flavors: ['Plain', 'Chocolate', 'Almond'],
    featured: true,
    stock: 24,
    sizes: [
      { label: 'Pack of 4', serves: 4, price: 70 },
      { label: 'Pack of 8', serves: 8, price: 130 },
    ],
  },
  {
    name: 'Fruit Tart Selection',
    category: 'PASTRY',
    description: 'Crisp pastry shells filled with vanilla crème and topped with fresh seasonal fruit.',
    basePrice: 120,
    icon: 'Citrus',
    flavors: ['Seasonal fruit', 'Berry'],
    featured: true,
    stock: 18,
    sizes: [
      { label: 'Box of 4', serves: 4, price: 120 },
      { label: 'Box of 9', serves: 9, price: 250 },
    ],
  },
  {
    name: 'Macaron Gift Box',
    category: 'CONFECTIONERY',
    description: 'Delicate almond macarons in assorted flavours, presented in a gift box.',
    basePrice: 150,
    icon: 'Cherry',
    flavors: ['Pistachio', 'Rose', 'Lemon', 'Chocolate'],
    stock: 20,
    sizes: [
      { label: 'Box of 6', serves: 6, price: 150 },
      { label: 'Box of 12', serves: 12, price: 280 },
    ],
  },
  {
    name: 'Cheesecake Slice Tray',
    category: 'CAKE',
    description: 'Baked vanilla cheesecake on a biscuit base, cut into sharing slices.',
    basePrice: 260,
    icon: 'CakeSlice',
    flavors: ['Classic', 'Strawberry', 'Caramel'],
    stock: 10,
    sizes: [
      { label: 'Tray of 8 slices', serves: 8, price: 260 },
      { label: 'Tray of 16 slices', serves: 16, price: 480 },
    ],
  },
];

const SAMPLE_ZONES = [
  { name: 'Airport Residential', fee: 0 },
  { name: 'East Legon', fee: 35 },
  { name: 'Cantonments', fee: 30 },
  { name: 'Labone', fee: 30 },
  { name: 'Osu', fee: 35 },
  { name: 'Madina', fee: 55 },
  { name: 'Achimota', fee: 50 },
  { name: 'Spintex', fee: 45 },
  { name: 'Dansoman', fee: 55 },
  { name: 'Tema', fee: 80 },
];

async function main() {
  console.log(
    DEMO
      ? 'Seeding Homely Treats (admin + sample catalogue)…'
      : 'Seeding Homely Treats (admin account only)…'
  );

  const adminHash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@homelytreats.gh' },
    update: { role: 'ADMIN' },
    create: {
      fullName: 'Store Admin',
      email: 'admin@homelytreats.gh',
      phone: '055 123 4567',
      passwordHash: adminHash,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  if (DEMO) {
    for (const p of SAMPLE_PRODUCTS) {
      const { sizes, ...fields } = p;
      const existing = await prisma.product.findFirst({ where: { name: p.name } });
      const data = {
        ...fields,
        emoji: p.icon, // legacy field — stores the Lucide icon name
        sizes: sizes.map((s) => s.label),
        sizeOptions: { create: sizes },
      };
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { ...fields, sizes: data.sizes, sizeOptions: { deleteMany: {}, create: sizes } },
        });
      } else {
        await prisma.product.create({ data });
      }
    }

    for (const z of SAMPLE_ZONES) {
      await prisma.deliveryZone.upsert({
        where: { name: z.name },
        update: { fee: z.fee, active: true },
        create: { name: z.name, fee: z.fee, active: true },
      });
    }

    await prisma.promo.upsert({
      where: { code: 'WELCOME10' },
      update: { active: true },
      create: { code: 'WELCOME10', type: 'PERCENT', value: 10, active: true, usageLimit: 100 },
    });
  }

  console.log('\nSeed complete.');
  console.log('  Admin login: admin@homelytreats.gh / admin123  (change the password after first login)');
  if (DEMO) {
    console.log(`  Sample catalogue: ${SAMPLE_PRODUCTS.length} products, ${SAMPLE_ZONES.length} Accra delivery zones, promo WELCOME10`);
    console.log('  These are ordinary records — edit or delete them in Admin → Products / Settings / Promos.');
  } else {
    console.log('  Catalog, delivery zones and promos are empty — create them in Admin > Products / Settings.');
    console.log('  Want sample content to click through the design? Run: npm run db:seed:demo');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
