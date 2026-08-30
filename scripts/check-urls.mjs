/**
 * URL parity check.
 *
 *   npm run build && npm run check:urls
 *
 * Every path marked KEEP or REDIR in migration/url-inventory.txt must exist in
 * dist/. Exits non-zero if anything is missing, so the deploy workflow fails
 * before a live URL can break.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const INVENTORY = path.join(ROOT, 'migration/url-inventory.txt');

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const lines = fs.readFileSync(INVENTORY, 'utf8').split('\n');

const keep = [];
const dropped = [];

for (const raw of lines) {
  const line = raw.replace(/#.*$/, '').trim();
  if (!line) continue;
  const [status, urlPath] = line.split(/\s+/, 2);
  if (!urlPath) continue;
  if (status === 'KEEP' || status === 'REDIR') keep.push(urlPath);
  else if (status === 'DROP') dropped.push(urlPath);
}

/**
 * A preview build serves everything under a sub-path, but `base` is a URL prefix
 * - the files still sit at the root of dist/. Strip it before resolving.
 */
const BASE = (process.env.PREVIEW_BASE ?? '').replace(/\/+$/, '');

/** Map a public path to the file dist/ should contain. */
function distFile(urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (BASE && (rel === BASE || rel.startsWith(`${BASE}/`))) rel = rel.slice(BASE.length) || '/';
  rel = rel.replace(/^\//, '');
  if (rel === '' || rel.endsWith('/')) return path.join(DIST, rel, 'index.html');
  return path.join(DIST, rel);
}

const missing = [];
for (const urlPath of keep) {
  if (!fs.existsSync(distFile(urlPath))) missing.push(urlPath);
}

/**
 * Second pass: every /wp-content/uploads/... and every internal link the built
 * HTML points at must also exist, so a renamed image can't slip through.
 */
const htmlFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
})(DIST);

const brokenRefs = new Map();
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const refs = new Set(
    [...html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)]
      .map((m) => m[1])
      .filter((href) => !href.startsWith('//')),
  );
  for (const ref of refs) {
    if (fs.existsSync(distFile(ref))) continue;
    const where = path.relative(DIST, file);
    if (!brokenRefs.has(ref)) brokenRefs.set(ref, new Set());
    brokenRefs.get(ref).add(where);
  }
}

const pad = (s, n) => String(s).padEnd(n);

console.log(`\nURL parity check — ${htmlFiles.length} pages built\n`);
console.log(`${pad('checked (KEEP/REDIR)', 26)} ${keep.length}`);
console.log(`${pad('missing', 26)} ${missing.length}`);
console.log(`${pad('broken internal refs', 26)} ${brokenRefs.size}`);
console.log(`${pad('intentionally dropped', 26)} ${dropped.length}  (signed off)`);

if (missing.length) {
  console.log('\nMISSING — these legacy URLs would 404:');
  for (const m of missing) console.log('  ' + m);
}

if (brokenRefs.size) {
  console.log('\nBROKEN LINKS in the built HTML:');
  for (const [ref, pages] of brokenRefs) {
    console.log(`  ${ref}\n      from: ${[...pages].slice(0, 3).join(', ')}${pages.size > 3 ? ` (+${pages.size - 3})` : ''}`);
  }
}

if (!missing.length && !brokenRefs.size) {
  console.log('\nOK — every kept URL resolves and no internal link is broken.');
}

if (process.env.SHOW_DROPPED) {
  console.log('\nDropped URLs (signed off 2026-08-29):');
  for (const d of dropped) console.log('  ' + d);
}
console.log('');

process.exit(missing.length || brokenRefs.size ? 1 : 0);
