#!/usr/bin/env node
/**
 * Bundle check — runs after `npm run build` (locally and in CI).
 *
 * Two jobs:
 *
 * 1. **Integrity.** Every chunk a chunk imports must exist, and the entry must not
 *    reference anything missing. This catches the one failure mode that code-splitting
 *    introduces and that nothing else here would notice: a stale or partially uploaded
 *    deploy where the HTML points at files that are not there. A customer hitting that
 *    sees a dead page.
 *
 * 2. **Budget.** The first load (entry + everything it preloads) has a size limit. The
 *    whole point of splitting by route is that a visitor on mobile data gets the shop,
 *    not the admin panel; a limit here means the next feature cannot quietly put it all
 *    back. Raise the budget deliberately, with a reason, or fix the regression.
 *
 * Usage:  node scripts/check-bundle.mjs [--budget-kb 260]
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');

const budgetArg = process.argv.indexOf('--budget-kb');
const BUDGET_KB = budgetArg > -1 ? Number(process.argv[budgetArg + 1]) : 260;

if (!existsSync(dist)) {
  console.error('✖ dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const indexHtml = readFileSync(join(dist, 'index.html'), 'utf8');

// --- 1. integrity: every referenced file exists ----------------------------------------
const referenced = [...indexHtml.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1]);
const missing = referenced.filter((f) => !existsSync(join(dist, 'assets', f)));

// Follow the import graph one level deeper: entry chunks statically import siblings.
const seen = new Set();
const queue = [...referenced];
while (queue.length) {
  const file = queue.shift();
  if (seen.has(file)) continue;
  seen.add(file);
  const path = join(dist, 'assets', file);
  if (!existsSync(path)) continue;
  const code = readFileSync(path, 'utf8');
  const specifiers = [
    ...code.matchAll(/(?:from\s*|import\s*\(\s*)["']\.\/([A-Za-z0-9_.-]+\.(?:js|css))["']/g),
    ...code.matchAll(/["']\.\/([A-Za-z0-9_.-]+\.js)["']/g),
  ].map((m) => m[1]);
  for (const s of specifiers) if (!seen.has(s)) queue.push(s);
}

const broken = [...seen].filter((f) => !existsSync(join(dist, 'assets', f)));
const allBroken = [...new Set([...missing, ...broken])];

if (allBroken.length) {
  console.error('✖ The build references files that do not exist:');
  for (const f of allBroken) console.error('   - dist/assets/' + f);
  process.exit(1);
}

// --- 2. budget: size of the first load -------------------------------------------------
const firstLoad = new Set(referenced);
const sizeOf = (f) => {
  const path = join(dist, 'assets', f);
  return existsSync(path) ? statSync(path).size : 0;
};
const gzipOf = (f) => {
  const path = join(dist, 'assets', f);
  return existsSync(path) ? gzipSync(readFileSync(path), { level: 9 }).length : 0;
};

const jsFiles = [...firstLoad].filter((f) => f.endsWith('.js'));
const cssFiles = [...firstLoad].filter((f) => f.endsWith('.css'));
const jsRaw = jsFiles.reduce((n, f) => n + sizeOf(f), 0);
const jsGzip = jsFiles.reduce((n, f) => n + gzipOf(f), 0);
const cssGzip = cssFiles.reduce((n, f) => n + gzipOf(f), 0);

// Route chunks are fetched on demand; report the heaviest few so growth is visible.
const routeChunks = readdirSync(join(dist, 'assets'))
  .filter((f) => f.endsWith('.js') && !firstLoad.has(f))
  .map((f) => ({ f, kb: sizeOf(f) / 1024 }))
  .sort((a, b) => b.kb - a.kb);

const kb = (n) => (n / 1024).toFixed(1);
const budgetBytes = BUDGET_KB * 1024;

console.log('First load (what a visitor on the homepage downloads):');
console.log(`  JavaScript : ${kb(jsRaw)} kB raw / ${kb(jsGzip)} kB gzipped across ${jsFiles.length} file(s)`);
console.log(`  CSS        : ${kb(cssFiles.reduce((n, f) => n + sizeOf(f), 0))} kB raw / ${kb(cssGzip)} kB gzipped`);
console.log(`  Total JS   : ${kb(jsRaw)} kB against a ${BUDGET_KB} kB budget`);
console.log(`\nOn-demand route chunks (${routeChunks.length}):`);
for (const c of routeChunks.slice(0, 5)) console.log(`  ${c.f}  ${c.kb.toFixed(1)} kB`);
console.log('\n✓ Every referenced chunk exists and the first load is within budget.');

if (jsRaw > budgetBytes) {
  console.error(
    `\n✖ First-load JavaScript is ${kb(jsRaw)} kB, over the ${BUDGET_KB} kB budget by ${kb(jsRaw - budgetBytes)} kB.\n` +
      '  Either move the new weight behind a lazy route (see App.jsx) or raise the budget in\n' +
      '  client/scripts/check-bundle.mjs with a note saying why.'
  );
  process.exit(1);
}
