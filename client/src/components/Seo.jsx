import React, { useEffect } from 'react';

/**
 * Per-page SEO: <Seo title="…" description="…" image="…" noindex jsonLd={{…}} />.
 *
 * A single-page app serves one <head> for every route, so without this every page
 * shares the homepage's title and description — meaning a product page shared on
 * WhatsApp shows "Homely Treats — Custom Bakery Ordering" instead of the cake the
 * customer actually wanted to show their family. This component rewrites the relevant
 * tags whenever the route's page mounts:
 *
 *   - document.title and the meta description (what a search result shows);
 *   - the Open Graph / Twitter tags (what a WhatsApp or X share card shows);
 *   - a canonical link (the page's one true address, so /menu/abc and /menu/abc?x=1
 *     are not treated as two pages);
 *   - the robots tag — private pages (cart, account, admin, rider) ask not to be
 *     indexed instead of relying on robots.txt alone, which is only a suggestion;
 *   - optional JSON-LD structured data (one script tag, replaced on each page).
 *
 * Nothing is removed on unmount because the next page always sets its own values;
 * every mount writes every tag this component manages.
 */

const SITE_NAME = 'Homely Treats';
const JSON_LD_ID = 'page-json-ld';

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export default function Seo({ title, description, image, noindex = false, jsonLd }) {
  // Stringify once so a parent re-rendering (state changes, polling) with an equal
  // object does not re-run the effect every time.
  const jsonLdText = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
    const url = window.location.href;

    document.title = fullTitle;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    if (image) upsertMeta('property', 'og:image', image);
    upsertCanonical(url);
    // "noindex" in a page's own head is the instruction crawlers actually honour;
    // robots.txt only stops crawling, not indexing of a URL someone else links to.
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    const existing = document.getElementById(JSON_LD_ID);
    if (existing) existing.remove();
    if (jsonLdText) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = JSON_LD_ID;
      script.textContent = jsonLdText;
      document.head.appendChild(script);
    }
  }, [title, description, image, noindex, jsonLdText]);

  return null;
}
