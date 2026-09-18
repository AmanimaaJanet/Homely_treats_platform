import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Seo from './components/Seo.jsx';

/**
 * Per-page SEO. A single-page app serves one <head> for every route, so a broken Seo
 * component means every page shares the homepage's title — and a product shared on
 * WhatsApp shows the shop's name instead of the cake. These tests pin the contract.
 */
describe('Seo (per-page meta tags)', () => {
  beforeEach(() => {
    cleanup();
    document.title = 'Homely Treats';
    document.head
      .querySelectorAll(
        'meta[name="description"], meta[property^="og:"], meta[name="robots"], meta[name="twitter:card"], link[rel="canonical"], script[type="application/ld+json"]',
      )
      .forEach((el) => el.remove());
  });

  it('titles a page with the shop name appended', () => {
    render(<Seo title="Menu" description="The menu" />);
    expect(document.title).toBe('Menu — Homely Treats');
  });

  it('does not append the shop name twice when the title already has it', () => {
    render(<Seo title="Homely Treats — home" description="The homepage" />);
    expect(document.title).toBe('Homely Treats — home');
  });

  it('writes the description, Open Graph tags and a canonical link', () => {
    render(<Seo title="Menu" description="The full menu" image="https://example.com/cake.jpg" />);
    expect(document.head.querySelector('meta[name="description"]').content).toBe('The full menu');
    expect(document.head.querySelector('meta[property="og:title"]').content).toBe('Menu — Homely Treats');
    expect(document.head.querySelector('meta[property="og:description"]').content).toBe('The full menu');
    expect(document.head.querySelector('meta[property="og:image"]').content).toBe('https://example.com/cake.jpg');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeTruthy();
  });

  it('indexes public pages and refuses indexing on private ones', () => {
    const { rerender } = render(<Seo title="Menu" description="d" />);
    expect(document.head.querySelector('meta[name="robots"]').content).toBe('index, follow');
    rerender(<Seo title="Your Cart" description="d" noindex />);
    expect(document.head.querySelector('meta[name="robots"]').content).toBe('noindex, nofollow');
  });

  it('injects structured data once per page and removes it when the next page has none', () => {
    const { rerender } = render(<Seo title="Cake" description="d" jsonLd={{ '@type': 'Product', name: 'Cake' }} />);
    rerender(<Seo title="Cake" description="d" jsonLd={{ '@type': 'Product', name: 'Cake' }} />);
    const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0].textContent).name).toBe('Cake');
    rerender(<Seo title="Menu" description="d" />);
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  });
});
