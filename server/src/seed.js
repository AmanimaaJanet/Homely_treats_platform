import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clean production seed — creates ONLY the store admin account.
 *
 * The storefront intentionally starts empty: the admin builds the catalog
 * (products, delivery zones, promos) from the Admin Dashboard. This keeps the
 * live site free of demo/fake content.
 *
 * Idempotent — safe to run on every deploy (Render runs it after migrate).
 */
async function main() {
  console.log('Seeding Homely Treats database (admin account only)...');

  const adminHash = await bcrypt.hash('admin123', 10);
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

  console.log('Seed complete.');
  console.log('  Admin login: admin@homelytreats.gh / admin123  (change the password after first login)');
  console.log('  Catalog, delivery zones and promos are empty — create them in Admin > Products / Settings.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
