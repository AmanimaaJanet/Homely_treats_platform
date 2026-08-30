import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

/** Generate a human-friendly order id: HT-YYYYMMDD-#### */
export async function nextOrderId(prisma) {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
    today.getDate()
  ).padStart(2, '0')}`;
  const prefix = `HT-${ymd}-`;
  const count = await prisma.order.count({
    where: { id: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

export function orderRefValidator(value) {
  return /^HT-\d{8}-\d{4}$/.test(String(value || ''));
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, verificationToken, ...rest } = user;
  return rest;
}
