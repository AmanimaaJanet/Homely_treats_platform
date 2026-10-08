import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { sendEmail, orderEmailTemplate } from './email.js';
import { getSettings } from './settings.js';

/**
 * Per-account sign-in throttling.
 *
 * The per-IP limiter cannot do this job on its own. Half of Accra browses from behind
 * carrier-grade NAT, so "20 attempts per IP" is simultaneously too loose (a bot farm on
 * one IP gets 20 guesses at *every* account it can name) and too tight (a household
 * where someone forgot their password can lock out their neighbours). Counting failures
 * against the account itself is what actually protects a customer's password.
 *
 * The shape:
 *   • N failures (default 10, `AUTH_MAX_FAILED_ATTEMPTS`) locks the account for
 *     M minutes (default 15, `AUTH_LOCKOUT_MINUTES`).
 *   • The window slides: failures older than M minutes don't count, so a customer who
 *     mistypes twice a week for a month never gets locked out.
 *   • The lock lifts by itself when the time passes. It is a speed bump for a guessing
 *     machine, not a life sentence for the owner.
 *   • A successful sign-in or a **password reset** clears it in full. That is the escape
 *     hatch for the one real risk of account lockout: someone hammering a victim's email
 *     to keep them out. They can always get back in through "forgot password".
 *   • The owner is emailed once per lock, and the lock lands in the audit log, so a
 *     sustained attack is visible instead of silent.
 */

const DEFAULTS = { maxAttempts: 10, lockoutMinutes: 15 };

function settings() {
  const maxAttempts = Number(config.auth?.maxFailedAttempts) || DEFAULTS.maxAttempts;
  const lockoutMinutes = Number(config.auth?.lockoutMinutes) || DEFAULTS.lockoutMinutes;
  return {
    maxAttempts: Math.max(3, maxAttempts),
    lockoutMinutes: Math.max(1, lockoutMinutes),
  };
}

/** Still locked? (Also reports how long is left, for the customer-facing message.) */
export function lockState(user) {
  if (!user?.lockedUntil) return { locked: false };
  const msLeft = new Date(user.lockedUntil).getTime() - Date.now();
  if (msLeft <= 0) return { locked: false, expired: true };
  return { locked: true, minutesLeft: Math.max(1, Math.ceil(msLeft / 60000)) };
}

/**
 * Record a failed sign-in. Returns the state the caller should report.
 * Called on a wrong password *and* on an unknown email — the caller keeps the response
 * identical either way, so this never becomes an account-enumeration oracle.
 */
export async function recordFailure(user, { baseUrl } = {}) {
  if (!user) return { locked: false };
  const { maxAttempts, lockoutMinutes } = settings();
  const now = new Date();

  // Slide the window: a failure older than the lockout period starts a fresh count.
  const withinWindow =
    user.lastFailedLoginAt && now.getTime() - new Date(user.lastFailedLoginAt).getTime() < lockoutMinutes * 60000;
  const attempts = (withinWindow ? user.failedLoginAttempts : 0) + 1;
  const shouldLock = attempts >= maxAttempts;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: shouldLock ? 0 : attempts,
      lastFailedLoginAt: now,
      lockedUntil: shouldLock ? new Date(now.getTime() + lockoutMinutes * 60000) : user.lockedUntil,
      lockoutNoticeSentAt: shouldLock ? null : user.lockoutNoticeSentAt, // fresh notice per lock
    },
  });

  if (shouldLock) {
    await alertOwnerOfLock(updated, attempts, baseUrl).catch((err) =>
      console.error('[auth] lockout alert failed:', err.message)
    );
  }

  return {
    locked: shouldLock,
    attemptsLeft: shouldLock ? 0 : Math.max(0, maxAttempts - attempts),
    minutesLeft: shouldLock ? lockoutMinutes : 0,
    user: updated,
  };
}

/** A good sign-in clears the counter and records when the account was last used. */
export async function recordSuccess(user) {
  return prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      lockoutNoticeSentAt: null,
      lastLoginAt: new Date(),
    },
  });
}

/** Called after a password reset: a legitimate owner proving control clears the lock. */
export async function clearLock(userId) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      lockoutNoticeSentAt: null,
    },
  });
}

/**
 * Tell the bakery (and the customer) that an account was just locked.
 *
 * Two emails on purpose: the owner hears "someone is guessing at your account" — which
 * is exactly the alert item 33 asks for — and the customer is told how to get back in,
 * because a locked customer who doesn't know why is a lost customer.
 */
async function alertOwnerOfLock(user, attempts, baseUrl) {
  const { lockoutMinutes } = settings();
  const businessName = 'Homely Treats';

  // Where the bakery actually reads its mail: the business address in Settings, with an
  // environment override for shops that route alerts somewhere else.
  const shop = await getSettings().catch(() => ({}));
  const owner = process.env.ALERT_EMAIL || shop.businessEmail || null;

  if (owner) {
    await sendEmail({
      to: owner,
      subject: `${businessName} — account locked after ${attempts} failed sign-ins`,
      html: orderEmailTemplate({
        headline: 'Sign-in lockout triggered',
        bodyLines: [
          `${user.fullName || 'An account'} (${user.email}) was locked for ${lockoutMinutes} minutes after ${attempts} wrong passwords.`,
          'If this was not them, someone is guessing at the account. The lock lifts by itself, and they can also reset the password to get straight back in.',
          `When: ${new Date().toUTCString()}`,
        ],
        ctaUrl: `${baseUrl || process.env.CLIENT_URL || 'http://localhost:5173'}/admin/audit`,
        ctaLabel: 'Open the activity log',
      }),
      type: 'ACCOUNT_LOCKED',
    }).catch((err) => console.error('[auth] owner lockout email failed:', err.message));
  }

  await sendEmail({
    to: user.email,
    subject: `${businessName} — we locked your account for a few minutes`,
    html: orderEmailTemplate({
      headline: 'Too many wrong passwords',
      bodyLines: [
        `Hi ${(user.fullName || 'there').split(' ')[0]}, we locked sign-in on your account for ${lockoutMinutes} minutes after several wrong passwords.`,
        'Nothing has changed about your orders or your points. Wait a few minutes and try again — or reset your password now and you can sign in straight away.',
        'If this was not you, resetting your password is the safest next step.',
      ],
      ctaUrl: `${baseUrl || process.env.CLIENT_URL || 'http://localhost:5173'}/forgot-password`,
      ctaLabel: 'Reset my password',
    }),
    type: 'ACCOUNT_LOCKED',
  }).catch((err) => console.error('[auth] customer lockout email failed:', err.message));

  await prisma.user.update({
    where: { id: user.id },
    data: { lockoutNoticeSentAt: new Date() },
  });
}

/** For admin screens: is any account locked right now? */
export async function currentlyLocked() {
  return prisma.user.findMany({
    where: { lockedUntil: { gt: new Date() } },
    select: { id: true, fullName: true, email: true, role: true, lockedUntil: true, failedLoginAttempts: true },
    orderBy: { lockedUntil: 'desc' },
  });
}
