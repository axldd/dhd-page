/**
 * One-shot WordPress -> Astro importer. ALREADY RUN — DO NOT RUN AGAIN.
 *
 * Kept as the record of how the content was converted. Re-running it would
 * overwrite everything in src/content/ from the cached REST API snapshot,
 * discarding every edit made since the migration (the Impressum rewrite for the
 * e.V., promoted cover images, ...). The guard below refuses to run.
 *
 * Pulls posts and pages from the live WP REST API, converts the rendered HTML to
 * markdown, and copies every referenced media file out of the local backup
 * (migration/uploads, extracted from the tar.gz) into the new site.
 *
 * Rules this script must never break (see CLAUDE.md):
 *   - wording is copied verbatim, never rewritten
 *   - PDFs keep their exact original path under public/wp-content/uploads/, and
 *     stay byte-identical, because those links get shared around
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://downhilldeutschland.de';
const UPLOADS_SRC = path.join(ROOT, 'migration/uploads');
// Non-image files (PDFs) keep their exact legacy path and stay byte-identical.
const FILES_DEST = path.join(ROOT, 'public/wp-content/uploads');
// Images are downscaled into src/assets so Astro can optimize them and serve them
// as hashed files. Their old /wp-content/uploads/ URLs are deliberately not kept.
// Note the dated subfolders are load-bearing: two photos are both named open.jpg.
const IMAGES_DEST = path.join(ROOT, 'src/assets/uploads');
/** Web-sane ceiling; the untouched originals live on in the tar.gz backup. */
const MAX_EDGE = 2200;
const RAW = path.join(ROOT, 'migration/raw');

/** Pages that exist in WP but are not migrated (WooCommerce / ticketing cruft). */
const SKIP_PAGES = new Set(['shop', 'my-account', 'ticket-checkout', 'order-complete']);

/** Pages that get a hand-written Astro route instead of a markdown file. */
const STRUCTURED_PAGES = new Set(['kalender', 'ranking', 'uber-downhill-deutschland']);

// ---------------------------------------------------------------------------
// fetching
// ---------------------------------------------------------------------------

async function fetchAll(endpoint) {
  const cache = path.join(RAW, `${endpoint}.json`);
  if (fs.existsSync(cache)) {
    return JSON.parse(fs.readFileSync(cache, 'utf8'));
  }
  const out = [];
  for (let page = 1; ; page++) {
    const url = `${SITE}/wp-json/wp/v2/${endpoint}?per_page=100&_embed&page=${page}`;
    const res = await fetch(url);
    if (res.status === 400) break; // WP's "page out of range"
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const batch = await res.json();
    out.push(...batch);
    if (batch.length < 100) break;
  }
  fs.mkdirSync(RAW, { recursive: true });
  fs.writeFileSync(cache, JSON.stringify(out, null, 2));
  return out;
}

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

/** WP thumbnail suffixes we resolve back to the original file. */
const SIZE_SUFFIX = /-\d+x\d+(?=\.[a-z0-9]+$)/i;

const copiedMedia = new Set();
const missingMedia = new Set();

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;

/**
 * Copy an upload out of the backup.
 *
 * Non-images land in public/ byte-identical at their original path. Images are
 * downscaled into src/assets/uploads/ (same relative path) so Astro can optimize
 * them; callers turn that into a markdown-relative reference.
 *
 * Returns the path relative to the uploads root, or null if it isn't in the backup.
 */
async function copyUpload(relPath) {
  const clean = decodeURIComponent(relPath).replace(/^\/+/, '');
  const src = path.join(UPLOADS_SRC, clean);
  if (!fs.existsSync(src)) {
    missingMedia.add(clean);
    return null;
  }
  if (copiedMedia.has(clean)) return clean;
  copiedMedia.add(clean);

  const isImage = IMAGE_EXT.test(clean);
  const dest = path.join(isImage ? IMAGES_DEST : FILES_DEST, clean);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (!isImage || /\.gif$/i.test(clean)) {
    fs.copyFileSync(src, dest);
    return clean;
  }

  const image = sharp(src, { animated: false });
  const { width = 0, height = 0 } = await image.metadata();
  const pipeline =
    Math.max(width, height) > MAX_EDGE
      ? image.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      : image;
  await (/\.png$/i.test(clean)
    ? pipeline.png({ compressionLevel: 9, palette: true })
    : pipeline.jpeg({ quality: 84, mozjpeg: true })
  ).toFile(dest);
  return clean;
}

/** Path to reference an imported image from a markdown file in src/content/<dir>/. */
const assetRef = (clean) => `../../assets/uploads/${clean.split('/').map(encodeURIComponent).join('/')}`;

/**
 * For images we want Astro to optimize we prefer the full-size original over
 * whatever resized variant the WP markup happened to reference.
 */
function preferOriginal(relPath) {
  const full = relPath.replace(SIZE_SUFFIX, '');
  return fs.existsSync(path.join(UPLOADS_SRC, decodeURIComponent(full))) ? full : relPath;
}

const UPLOAD_URL = new RegExp(
  `(?:${SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})?/wp-content/uploads/([^"'\\s)>]+)`,
  'g',
);

// ---------------------------------------------------------------------------
// html -> markdown
// ---------------------------------------------------------------------------

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
});

// <s> / <del> -> markdown strikethrough (used for canceled events).
turndown.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (content) => `~~${content}~~`,
});

// WP wraps images in <figure><img><figcaption>. Emit a plain image (plus caption
// as italic text) so Astro's markdown image optimization picks it up.
turndown.addRule('figure', {
  filter: 'figure',
  replacement: (_content, node) => {
    const img = node.querySelector('img');
    const link = node.querySelector('a');
    const caption = node.querySelector('figcaption');
    if (!img) return _content;
    const src = img.getAttribute('src') || '';
    const alt = (img.getAttribute('alt') || '').replace(/[[\]]/g, '');
    let md = `![${alt}](${src})`;
    if (link && link.getAttribute('href') && !/\.(jpe?g|png|gif|webp|avif)$/i.test(link.getAttribute('href'))) {
      md = `[${md}](${link.getAttribute('href')})`;
    }
    const cap = caption ? caption.textContent.trim() : '';
    return `\n\n${md}${cap ? `\n\n_${cap}_` : ''}\n\n`;
  },
});

// The WP "file" block renders a hidden <object> PDF preview plus two links.
// Collapse it to a single download link.
turndown.addRule('fileBlock', {
  filter: (node) => node.nodeName === 'DIV' && node.classList?.contains('wp-block-file'),
  replacement: (_content, node) => {
    const a = node.querySelector('a[href]');
    if (!a) return '';
    const label = a.textContent.trim() || 'Download';
    return `\n\n[${label}](${a.getAttribute('href')})\n\n`;
  },
});

// Turndown's default <br> is "two spaces + newline", which our trailing-whitespace
// cleanup would eat - and losing a <br> silently reflows race results into prose.
// Use the backslash hard break instead; it survives trimming.
turndown.addRule('hardBreak', {
  filter: 'br',
  replacement: () => '\\\n',
});

// Spacer / separator blocks carry no content.
turndown.addRule('dropEmptyBlocks', {
  filter: (node) =>
    node.classList?.contains('wp-block-spacer') ||
    (node.nodeName === 'P' && !node.textContent.trim() && !node.querySelector('img')),
  replacement: () => '',
});

function htmlToMarkdown(html) {
  return turndown
    .turndown(html)
    // turndown keeps stray whitespace inside <...> autolinks, which breaks them
    .replace(/<(https?:\/\/[^>\s]+)\s+>/g, '<$1>')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const decode = (s = '') =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&nbsp;/g, ' ')
    .trim();

const yamlStr = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * One-line description for <meta> and cards.
 *
 * WP's auto-excerpt strips tags without inserting spaces, so an address written
 * with <br> comes back as "DehmelWolfhaldenstrasse 79500". Derive it from the
 * migrated markdown instead — same words, correctly spaced.
 */
function bodyToDescription(markdown) {
  const text = markdown
    .replace(/^#+\s+/gm, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[*_~`>]/g, '')
    .replace(/\\$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 180) return text;
  return text.slice(0, 180).replace(/\s+\S*$/, '') + '…';
}

function frontmatter(fields) {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(v) ? yamlStr(v) : v}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

/**
 * Rewrite every wp-content/uploads reference in a chunk of HTML so it points at
 * a file we've imported, resolving WP thumbnails back to the original.
 * Images become markdown-relative asset paths; PDFs keep their legacy URL.
 */
async function rewriteUploads(html) {
  const resolved = new Map();
  for (const [, rel] of html.matchAll(UPLOAD_URL)) {
    if (resolved.has(rel)) continue;
    const isImage = IMAGE_EXT.test(rel);
    const clean = await copyUpload(isImage ? preferOriginal(rel) : rel);
    resolved.set(rel, clean === null ? null : isImage ? assetRef(clean) : uploadUrl(clean));
  }
  return html.replace(UPLOAD_URL, (match, rel) => resolved.get(rel) ?? match);
}

/** Site-absolute legacy URL for a file kept under public/wp-content/uploads/. */
const uploadUrl = (clean) => `/wp-content/uploads/${clean.split('/').map(encodeURIComponent).join('/')}`;

/** Internal links: strip the origin so they stay relative to the new site. */
function rewriteInternalLinks(md) {
  return md
    // WP's editor pasted Instagram's emoji CDN images; the alt text is the emoji
    // itself, so drop the hotlink and keep the character.
    .replace(/!\[([^\]]*)]\(https:\/\/static\.cdninstagram\.com\/images\/emoji[^)]*\)/g, '$1')
    .replace(new RegExp(`\\]\\(${SITE}/`, 'g'), '](/')
    // WP served /downhill-konstanz/ as a 301 to the real /community/ path.
    .replace(/\]\(\/downhill-konstanz\/\)/g, '](/community/downhill-konstanz/)');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

// The media source was deleted on 2026-08-31 once the site was live. Its absence
// is a reliable signal that the migration is finished, so use it to refuse a
// re-run rather than silently clobbering hand-edited content.
if (!fs.existsSync(UPLOADS_SRC)) {
  console.error(
    '\nThe import has already been run and the site is live.\n\n' +
      `Its media source is gone (${path.relative(ROOT, UPLOADS_SRC)}), and re-running would\n` +
      'overwrite src/content/ from the cached REST API export — discarding the\n' +
      'Impressum rewrite and every cover image picked since.\n\n' +
      'To genuinely re-import, restore migration/uploads/ from the tar.gz backup\n' +
      'first, and expect to redo the edits made since 2026-08-29.\n',
  );
  process.exit(2);
}

const authorById = new Map();

function authorOf(entity) {
  const embedded = entity._embedded?.author?.[0];
  if (embedded?.name) {
    authorById.set(entity.author, embedded.name);
    return embedded.name;
  }
  return authorById.get(entity.author) ?? null;
}

async function coverOf(entity) {
  const media = entity._embedded?.['wp:featuredmedia']?.[0];
  if (!media?.source_url) return null;
  const rel = media.source_url.replace(`${SITE}/wp-content/uploads/`, '');
  const clean = await copyUpload(preferOriginal(rel));
  return clean === null ? null : assetRef(clean);
}

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  return path.relative(ROOT, file);
}

const written = [];

/**
 * Not every WP entry had a featured image, but most open with a photo. When
 * there's no cover, promote that leading image so cards and social previews have
 * something real to show, and drop it from the body to avoid showing it twice.
 */
function promoteLeadImage(cover, body) {
  if (cover) return [cover, body];
  const IMG = /!\[[^\]]*]\((\.\.\/\.\.\/assets\/uploads\/[^)]+)\)/;
  const lead = body.match(new RegExp(`^${IMG.source}\\s*`));
  // If the post opens with the photo, it becomes the hero and leaves the body.
  if (lead) return [lead[1], body.slice(lead[0].length).trimStart()];
  // Otherwise borrow the first photo for cards and social previews only, and
  // leave it where the author put it.
  const first = body.match(IMG);
  return first ? [first[1], body] : [cover, body];
}

const posts = await fetchAll('posts');
for (const post of posts) {
  const html = await rewriteUploads(post.content.rendered);
  const [cover, body] = promoteLeadImage(
    await coverOf(post),
    rewriteInternalLinks(htmlToMarkdown(html)),
  );
  const fm = frontmatter({
    title: decode(post.title.rendered),
    date: post.date,
    author: authorOf(post),
    description: bodyToDescription(body),
    cover,
    wpId: post.id,
  });
  written.push(write(path.join(ROOT, 'src/content/posts', `${post.slug}.md`), `${fm}\n${body}\n`));
}

const pages = await fetchAll('pages');
const pageById = new Map(pages.map((p) => [p.id, p]));

for (const page of pages) {
  if (SKIP_PAGES.has(page.slug)) continue;
  const parent = page.parent ? pageById.get(page.parent) : null;
  const isCommunity = parent?.slug === 'community';
  const html = await rewriteUploads(page.content.rendered);
  const body = rewriteInternalLinks(htmlToMarkdown(html));
  const [cover, pageBody] = promoteLeadImage(await coverOf(page), body);
  const fm = frontmatter({
    title: decode(page.title.rendered),
    description: bodyToDescription(pageBody),
    cover,
    wpId: page.id,
  });
  // /kalender/ and /ranking/ become structured routes; keep their original
  // markdown next to them as a reference for the parity check.
  const dir = STRUCTURED_PAGES.has(page.slug)
    ? path.join(ROOT, 'migration/original-pages')
    : isCommunity
      ? path.join(ROOT, 'src/content/community')
      : path.join(ROOT, 'src/content/pages');
  written.push(write(path.join(dir, `${page.slug}.md`), `${fm}\n${pageBody}\n`));
}

// Deep-linked PDFs that no page happens to <a href> any more, but that people
// have shared on Instagram / in chats. These must keep resolving at their exact
// WordPress path. (Legacy *image* URLs are not preserved - see migration/REPORT.md.)
for (const extra of [
  '2024/06/Regelwerk_final.pdf',
  '2024/08/DM-Wertung-2024-1.pdf',
  '2024/08/Deutsche-Meisterschaft-2024.pdf',
  '2025/02/Skateboarding-Men-Race-results.pdf',
  '2025/02/Skateboarding-Men-Time-trials.pdf',
  '2025/02/Skateboarding-Men-Time-trials-1.pdf',
  '2025/02/Skateboarding-Women-Race-results.pdf',
  '2025/02/Skateboarding-Women-Time-trials.pdf',
  '2025/02/Streetluge-Men-Race-results.pdf',
  '2025/02/Streetluge-Men-Time-trials.pdf',
  '2025/02/Streetluge-Women-Race-results.pdf',
  '2025/02/Streetluge-Women-Time-trials.pdf',
  '2026/04/RiW-26-K.O.-German-Open-Results.pdf',
  '2026/04/RiW-26-K.O.-German-Open-Results-1.pdf',
  '2026/04/RiW-26-K.O.-Finta-Results.xlsx.pdf',
  '2026/04/RiW-26-K.O.-Masters-Results.xlsx.pdf',
  '2026/04/RiW-26-K.O.-Open-International-Results.pdf',
]) {
  await copyUpload(extra);
}

console.log(`\nWrote ${written.length} content files:`);
for (const f of written.sort()) console.log('  ' + f);
console.log(`\nImported ${copiedMedia.size} media files (images -> src/assets/uploads, PDFs -> public/wp-content/uploads)`);
if (missingMedia.size) {
  console.log(`\n!! ${missingMedia.size} referenced files are NOT in the backup:`);
  for (const m of [...missingMedia].sort()) console.log('  ' + m);
}
