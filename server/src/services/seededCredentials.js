/**
 * The credentials `npm run db:seed` creates.
 *
 * Kept in one place because three things care about them:
 *   • the seed script, which creates the account;
 *   • the API, which warns the admin when the password is still the default;
 *   • the docs, which tell you to change it.
 *
 * The password is a bootstrap credential, not a secret: it is published in the
 * README and printed by the seed. The moment the bakery is live, changing it (or
 * deleting the account) is the first thing to do — which is why the app nags about
 * it in the admin portal until it happens.
 */
export const SEED_ADMIN_EMAIL = 'admin@homelytreats.gh';
export const SEED_ADMIN_NAME = 'Store Admin';
export const SEED_ADMIN_PASSWORD = 'admin123';

/** True when the account still uses the published seed password. */
export async function usesSeedPassword(bcrypt, passwordHash) {
  if (!passwordHash) return false;
  try {
    return await bcrypt.compare(SEED_ADMIN_PASSWORD, passwordHash);
  } catch {
    return false;
  }
}
