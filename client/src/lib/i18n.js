import { createContext, useCallback, useContext } from 'react';

/**
 * Bilingual UI dictionary and hook (see i18n.jsx for the provider).
 *
 * Design choice: the dictionary is keyed by the *English string itself*. A component
 * writes `t('Menu')` — if a Twi translation exists the customer sees it, and if it
 * doesn't, they see the English key. No missing-translation crash, no placeholder keys
 * to keep in sync; adding a translation later means adding one line to TW below — no
 * component changes.
 *
 * Scope honesty: this is a *starter* dictionary covering the parts of the storefront a
 * customer meets (navigation, home, menu, product cards, footer, the common actions).
 * Deeper pages fall back to English until translated — a page in half-translated
 * pidgin reads worse than a page in English. Before launching to Twi speakers, have a
 * native speaker review the phrases in TW; it is one file.
 */

const TW = {
  // Navigation
  'Home': 'Fie',
  'Menu': 'Aduan',
  'Custom Orders': "Hyɛ W'ankasa",
  'Track Order': "Di W'Hyɛde Akyi",
  'My Account': 'Me Akaunt',
  'Sign In': 'Hyɛ Mu',
  'Sign out': 'Firi Mu',
  'Toggle menu': 'Bue Akontena',

  // Home
  'Every Bite Made': 'Anomuw Biara',
  'Just for': 'Wɔyɛ Maa',
  'You': 'Wo',
  'Order Now': 'Hyɛ Seesei',
  'View Menu': 'Hwɛ Aduan',
  'Featured Products': 'Nneɛma a Wɔagye Din',
  'What Our Customers Say': 'Deɛ Akwadufoɔ Ka',
  'How It Works': 'Ɛyɛ Dɛn',

  // Menu / product cards
  'Search treats…': 'Hwehwɛ Aduane…',
  'Sort: Popular': 'Nsɛso: Nkorɔfoɔ Dodoɔ',
  'Sort: Price (low to high)': 'Nsɛso: Ka (Kakra kɔ Kɛse)',
  'Sort: Price (high to low)': 'Nsɛso: Ka (Kɛse kɔ Kakra)',
  'All Products': 'Aduan Nyinaa',
  'Details': 'Nkyerɛkyerɛmu',
  'Sold out': 'Wɔatɔ Nyinaa',
  'No products found': 'Aduan Biara Nni Hɔ',

  // Footer
  'Shop': 'Duka',
  'Account': 'Akaunt',
  'Contact': 'Frɛ Yɛn',
};

const DICTS = { tw: TW };

export const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'tw', label: 'Twi' },
];

export const STORAGE_KEY = 'ht-lang';

export const LanguageContext = createContext(null);

/** The customer's language tools: `lang`, `setLang(code)`, and `t(englishString)`. */
export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>');
  const { lang, setLang } = ctx;
  // Missing keys return the English key itself — translation gaps degrade to English,
  // never to a blank or a crash.
  const t = useCallback((en) => DICTS[lang]?.[en] ?? en, [lang]);
  return { lang, setLang, t };
}
