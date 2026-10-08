import React, { useEffect, useState } from 'react';
import { LanguageContext, STORAGE_KEY } from './i18n.js';

/**
 * Language provider: remembers the customer's choice (localStorage) and keeps
 * <html lang> in step so screen readers pick the right pronunciation rules.
 * The dictionary and the useLang() hook live in ./i18n.js.
 */
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved === 'tw' ? 'tw' : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang === 'tw' ? 'ak' : 'en';
  }, [lang]);

  const setLang = (next) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch { /* private browsing: this session only */ }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}
