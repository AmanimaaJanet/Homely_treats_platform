import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LanguageProvider, } from './lib/i18n.jsx';
import { useLang } from './lib/i18n.js';

/**
 * Bilingual UI. The promise to keep: switching to Twi translates the strings a
 * customer meets, a missing translation shows English (never a blank), and the
 * choice survives the page being reloaded.
 */
function Probe() {
  const { lang, setLang, t } = useLang();
  return (
    <div>
      <p data-testid="lang">{lang}</p>
      <p data-testid="menu">{t('Menu')}</p>
      <p data-testid="unknown">{t('A phrase never translated')}</p>
      <button type="button" onClick={() => setLang('tw')}>twi</button>
    </div>
  );
}

describe('i18n (English / Twi)', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('defaults to English', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('menu').textContent).toBe('Menu');
  });

  it('translates known strings and falls back to English for the rest', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    fireEvent.click(screen.getByText('twi'));
    expect(screen.getByTestId('menu').textContent).toBe('Aduan');
    // A string with no Twi entry shows the English key, not a blank — gaps degrade
    // gracefully while the dictionary grows.
    expect(screen.getByTestId('unknown').textContent).toBe('A phrase never translated');
  });

  it('remembers the choice and tells screen readers the language', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    fireEvent.click(screen.getByText('twi'));
    expect(window.localStorage.getItem('ht-lang')).toBe('tw');
    expect(document.documentElement.lang).toBe('ak');
  });

  it('restores a saved choice on next visit', () => {
    window.localStorage.setItem('ht-lang', 'tw');
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('menu').textContent).toBe('Aduan');
  });
});
