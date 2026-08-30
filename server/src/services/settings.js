import { prisma } from '../prisma.js';

const DEFAULTS = {
  businessName: 'Homely Treats',
  businessEmail: 'orders@homelytreats.gh',
  businessPhone: '055 123 4567',
  businessAddress: 'Airport Residential, Accra',
  deliveryFee: 30,
  minLeadDays: 2,
  acceptOrders: true,
  allowPickup: true,
  enableMomo: true,
  enableAtl: true,
  enableCard: true,
  enableCod: true,
  enableWhatsapp: true,
  enableLoyalty: true,
  enableReviews: true,
  smsOrderConfirmed: true,
  emailOrderConfirmed: true,
  adminAlertNewOrder: true,
};

let cache = null;

export async function getSettings(force = false) {
  if (cache && !force) return cache;
  const rows = await prisma.setting.findMany();
  const map = {};
  for (const r of rows) {
    try {
      map[r.key] = JSON.parse(r.value);
    } catch {
      map[r.key] = r.value;
    }
  }
  cache = { ...DEFAULTS, ...map };
  return cache;
}

export async function saveSettings(patch) {
  const current = await getSettings(true);
  const merged = { ...current, ...patch };
  const entries = Object.entries(merged).map(([key, value]) => ({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value) },
  }));
  await prisma.$transaction(entries.map((e) => prisma.setting.upsert(e)));
  cache = merged;
  return merged;
}
