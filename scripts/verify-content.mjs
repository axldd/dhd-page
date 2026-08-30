/**
 * Content fidelity check.
 *
 *   node scripts/verify-content.mjs
 *
 * Compares the visible text of every built page against the same page in the
 * WordPress snapshot (migration/snapshot, the wget mirror taken before the
 * migration) and reports words that were dropped or added.
 *
 * Some differences are expected and listed as such: navigation and footer
 * chrome differ by design, and structured pages (/kalender/, /ranking/) were
 * deliberately rebuilt. Anything else is a migration bug.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SNAPSHOT = path.join(ROOT, 'migration/snapshot');

/** Pages whose content was intentionally restructured rather than copied. */
const RESTRUCTURED = new Set(['/kalender/', '/ranking/', '/community/', '/kontakt/']);

/**
 * Pages the club has deliberately edited since the migration. The snapshot is no
 * longer the source of truth for these, so a diff here is expected — but the
 * reason is spelled out so a real regression still stands out.
 */
const EDITED = new Map([
  [
    '/impressum/',
    'responsible party changed to Downhill Deutschland e.V.; the previous ' +
      'private address was removed on request (2026-08-30)',
  ],
]);

const PATHS = [
  '/champions-2026/',
  '/rasen-in-wasen-2026/',
  '/grosserlach-2026-registration/',
  '/die-deutschen-meisterinnen-und-meister-2025/',
  '/jahresumfrage-2024/',
  '/world-skate-games-2024/',
  '/die-deutschen-meisterinnen-und-meister-2024/',
  '/groserlach-race-2024/',
  '/deutsche-meisterschaft-2024/',
  '/ranking-fur-2023-qualifikation-fur-die-wm-2024-in-italien/',
  '/regeln/',
  '/impressum/',
  '/uber-downhill-deutschland/',
  '/grosserlach-2026/',
  '/community/castle-hill-community/',
  '/community/dopamania-hamburg/',
  '/community/downhill-konstanz/',
  '/community/frankendh/',
  '/community/freiburg-freeride-crew/',
  '/community/rollrunde-reutlingen/',
  '/community/sektorf-skating/',
  '/community/team-schwabenteuer/',
  '/kalender/',
  '/ranking/',
  '/community/',
];

/**
 * Vocabulary that only ever appeared in WordPress furniture we deliberately did
 * not migrate (the comment form, the duplicated "Download" button of the file
 * block, WP's abbreviated month names) plus the new site's own chrome words.
 */
const CHROME = new Set(
  `comments comment leave reply cancel your you email address will not be published
   required fields are marked name website save and this browser for the next time
   download jan feb mar apr may jun jul aug sep oct nov dec mai okt dez mär
   antworten kommentar schreiben abbrechen
   alle news weiterlesen zurück gruppen menü zum inhalt springen
   rss-feed sport verband rechtliches impressum datenschutz kontakt`
    .split(/\s+/)
    .filter(Boolean),
);

const words = (text) =>
  text
    .toLowerCase()
    .replace(/[‘’“”]/g, '')
    .split(/[^\p{L}\p{N}äöüß@.-]+/u)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((w) => w.length > 2 && !CHROME.has(w));

/** Compare <main> only: both the old theme and the new site wrap content in it. */
function mainOf(html) {
  const m = html.match(/<main[\s\S]*?>([\s\S]*)<\/main>/i);
  return m ? m[1] : html;
}

function visibleText(html) {
  return mainOf(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&(lt|gt|quot|#039);/g, ' ')
    .replace(/\s+/g, ' ');
}

/** WP also served this page from the root; that's where wget mirrored it. */
const SNAPSHOT_ALIAS = { '/community/downhill-konstanz/': '/downhill-konstanz/' };

const read = (base, urlPath) => {
  const candidates =
    base === SNAPSHOT && SNAPSHOT_ALIAS[urlPath] ? [urlPath, SNAPSHOT_ALIAS[urlPath]] : [urlPath];
  for (const candidate of candidates) {
    const file = path.join(base, candidate.replace(/^\//, ''), 'index.html');
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  }
  return null;
};

let problems = 0;
const rows = [];

for (const urlPath of PATHS) {
  const oldHtml = read(SNAPSHOT, urlPath);
  const newHtml = read(DIST, urlPath);

  if (!oldHtml) {
    rows.push([urlPath, 'no snapshot', '-', '-']);
    continue;
  }
  if (!newHtml) {
    rows.push([urlPath, 'MISSING in dist', '-', '-']);
    problems++;
    continue;
  }

  const oldWords = new Set(words(visibleText(oldHtml)));
  const newWords = new Set(words(visibleText(newHtml)));

  const lost = [...oldWords].filter((w) => !newWords.has(w));
  const added = [...newWords].filter((w) => !oldWords.has(w));

  const expected = RESTRUCTURED.has(urlPath) || EDITED.has(urlPath);
  const status =
    lost.length === 0 ? 'ok' : EDITED.has(urlPath) ? 'edited' : RESTRUCTURED.has(urlPath) ? 'restructured' : 'CHECK';
  if (status === 'CHECK') problems++;

  rows.push([urlPath, status, `-${lost.length}`, `+${added.length}`]);

  if (EDITED.has(urlPath) && lost.length) {
    rows.push(['', '  reason:', EDITED.get(urlPath), '']);
  }
  if (lost.length && !expected) {
    rows.push(['', '  lost:', lost.slice(0, 25).join(' '), '']);
  }
  if (added.length && !expected && process.env.SHOW_ADDED) {
    rows.push(['', '  added:', added.slice(0, 25).join(' '), '']);
  }
}

const w0 = Math.max(...rows.map((r) => r[0].length));
console.log('\nContent fidelity — built pages vs. WordPress snapshot\n');
for (const [a, b, c, d] of rows) {
  console.log(`${a.padEnd(w0)}  ${String(b).padEnd(16)} ${String(c).padStart(5)} ${String(d).padStart(5)}`);
}
console.log(
  problems === 0
    ? '\nOK — no page lost content that the snapshot had.\n'
    : `\n${problems} page(s) need a look.\n`,
);

process.exit(problems ? 1 : 0);
