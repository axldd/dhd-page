# CLAUDE.md

Operating manual for this repository. Read fully before doing anything. You (Claude Code) have broad access; the guardrails below protect the club's content and public URLs — treat them as hard rules.

---

## 1. What this project is

**downhilldeutschland.de** — the website of Downhill Deutschland, the organisation for downhill skateboarding and streetluge in Germany. It is being migrated from a live WordPress install (currently on a cloud VM) to a **static Astro site hosted on GitHub Pages**, with a **design refresh** along the way.

The site is purely informational: a news blog (~10 posts), five main pages, PDF ranking downloads, one external calendar embed, and an Impressum. There are no logins, comments, or forms. After migration, WordPress and the VM are decommissioned entirely; content lives as markdown and data files in this repo.

```
markdown/data in git  →  push to main  →  Action builds Astro  →  GitHub Pages serves it
```

## 2. Golden rules (hard guardrails)

- **Migrate content verbatim.** Posts contain real race results, champions' names, dates, and points. Never paraphrase, "improve", translate, or invent any of it. After migration, verify migrated text against the snapshot (§5 Phase 0).
- **Preserve public URLs.** Every URL in the inventory (§4) must resolve on the new site with the same path. Deep-linked files (especially the ranking PDFs under `/wp-content/uploads/...`) keep their exact original paths.
- **Don't touch the old site.** The live WordPress and its VM are read-only reference until the user confirms decommissioning. Never modify, log into, or load-test it.
- The `migration/` snapshot (the wget mirror of the old WordPress site) was **deleted on 2026-08-31** at Alex's request, after the cutover was verified — he keeps his own backups. `npm run check:content` is therefore retired and exits non-zero. Keep `migration/url-inventory.txt` and `migration/raw/*.json`: they are the remaining record of what the old site contained.
- **No secrets in git.** Deploys use the built-in `GITHUB_TOKEN`; there should be no other credentials in this project.
- **Cutover is the user's call.** Build and deploy freely to the default `*.github.io` URL, but do not add the custom-domain CNAME or instruct DNS changes until the user approves (§5 Phase 6).
- **Language:** site chrome and navigation are German (`lang="de"`). Posts are a mix of German and English — keep each post in its original language.
- **Legal:** the responsible entity is **Downhill Deutschland e.V.**, Reinhold-Maier-Str. 25, 71642 Ludwigsburg — Amtsgericht Stuttgart, VR 727763. Per the register the two Vorsitzende represent the club **jointly**, so both must be named: Ulrich Becker (1.) and Sabrina Luci (2.). Alex's private address was removed everywhere on 2026-08-30. The Impressum is now complete; keep `src/content/pages/impressum.md` and the Verantwortlicher block in `src/pages/datenschutz.astro` in sync. Never publish the dates of birth or home towns that appear on the register extract — an Impressum needs names only. The Datenschutzerklärung was approved by the club on 2026-08-30 and is no longer a draft. It describes the site as it is today: if the site ever starts loading something it doesn't now (an embed, a form, a CDN font, analytics), update that text in the same change.

## 3. Tech stack (decided — don't relitigate)

- **Astro** (latest stable) + **Tailwind CSS**. Content collections for posts and pages; a typed data collection for event seasons.
- **@astrojs/sitemap** and **@astrojs/rss** (the WP site exposed feeds; keep RSS available at `/rss.xml`).
- **GitHub Pages** via GitHub Actions (official Astro deploy workflow: build on push to `main`, publish with `configure-pages` / `upload-pages-artifact` / `deploy-pages`).
- `astro.config.mjs`: `site: 'https://downhilldeutschland.de'`, `base: '/'`, `trailingSlash: 'always'` (WordPress used trailing slashes; keep them for URL parity).
- Node LTS, npm. Standard commands: `npm run dev`, `npm run build`, `npm run preview`.

## 4. Site inventory (verified against the live sitemap on 2026-08-29)

**Navigation:** Events (`/kalender/`) · Ranking (`/ranking/`) · Regelwerk (`/regeln/`) · Community (`/community/`) · Organisation (`/uber-downhill-deutschland/`) · Instagram link (https://www.instagram.com/downhilldeutschland)

**Pages:** `/` (home: hero + news feed), `/kalender/`, `/ranking/`, `/regeln/`, `/community/`, `/uber-downhill-deutschland/`, `/kontakt/`, `/impressum/`, `/datenschutz/` (new), `/grosserlach-2026/`

**Community sub-pages (one per local crew, all under `/community/<slug>/`):**
`castle-hill-community`, `dopamania-hamburg`, `downhill-konstanz`, `frankendh`, `freiburg-freeride-crew`, `rollrunde-reutlingen`, `sektorf-skating`, `team-schwabenteuer`
`/downhill-konstanz/` (without the `/community/` prefix) was a 301 on WordPress and is kept as a redirect page.

**Posts (slug = path, keep exactly):**
`/champions-2026/`, `/rasen-in-wasen-2026/`, `/grosserlach-2026-registration/`, `/die-deutschen-meisterinnen-und-meister-2025/`, `/jahresumfrage-2024/`, `/world-skate-games-2024/`, `/die-deutschen-meisterinnen-und-meister-2024/`, `/groserlach-race-2024/`, `/deutsche-meisterschaft-2024/`, `/ranking-fur-2023-qualifikation-fur-die-wm-2024-in-italien/`

**Authors:** Alex (alex-dehmel), Brini, Chris — plus Ulrich, who has no posts. Author names stay on posts; the `/author/...` archives and `/category/news/` are dropped (see `migration/REPORT.md` §3 for the full drop list awaiting sign-off).

**Dropped WordPress leftovers:** `/shop/`, `/my-account/`, `/ticket-checkout/`, `/order-complete/` (WooCommerce / Event Tickets), `/events/` (The Events Calendar), all per-object `/feed/` URLs, `/wp-json/**`.

**Special elements:**
- `/kalender/` — the old "Eventkalender" (the `ics-calendar` WP plugin rendering an ICS feed from skatedownhills.com via `admin-ajax.php`) was **dropped on Alex's instruction on 2026-08-29** — it is not needed any more. The page is the season timeline only. Don't reintroduce the embed without asking.
- `/ranking/` links season PDFs, e.g. `/wp-content/uploads/2026/01/2025-german-champs.pdf` and `/wp-content/uploads/2024/09/Gesamtwertung-DM-2024.pdf` — these exact paths must keep working. All 20 migrated PDFs are byte-identical to the backup.
- Logo assets in `src/assets/`: `dd-logo-horizontal-white.png` (header), `dd-logo-white.png` (footer, red mark + white wordmark), `dd-logo.png` (full colour). Brand red is `#CA4748`, sampled from the logo.
- Media: images live in `src/assets/uploads/<year>/<month>/` (downscaled to 2200 px on import) and Astro optimizes them into hashed files. **Legacy image URLs are deliberately not preserved** — dropped on 2026-08-29 to save ~18 MB per deploy and a build hook; only PDFs are pinned to their WordPress paths. New photos go straight into `src/assets/`. Keep the dated subfolders for migrated media: two different photos are both named `open.jpg`.

## 5. Migration plan — execute in phases, commit per phase

### Phase 0 — Snapshot & inventory
1. `wget --mirror --page-requisites --adjust-extension --no-host-directories -P migration/snapshot https://downhilldeutschland.de/` (throttle politely: `--wait=1`).
2. Fetch the WP sitemap (`/wp-sitemap.xml`) and write a complete URL inventory to `migration/url-inventory.txt`.
3. Download all of `/wp-content/uploads/` that the site references (pages, posts, PDFs, logo) into `migration/uploads/`.
4. Commit. This snapshot is the ground truth for content verification and the parity check.

### Phase 1 — Scaffold
Create the Astro project (structure in §6), Tailwind, sitemap + RSS integrations, base layout with header/nav/footer (placeholder styling), 404 page, and `.github/workflows/deploy.yml`. Verify a successful Pages deploy to the `*.github.io` URL. In repo settings the user must set Pages → Source = GitHub Actions (tell them when it's time).

### Phase 2 — Content migration (scripted)
Write `migration/import.mjs` (run once via `npm run migrate`) that pulls from the live REST API:
- `GET https://downhilldeutschland.de/wp-json/wp/v2/posts?per_page=100&_embed`
- `GET https://downhilldeutschland.de/wp-json/wp/v2/pages?per_page=100&_embed`
- Convert `content.rendered` HTML → markdown (turndown). Keep raw HTML inline where markdown can't express it (iframes, galleries) — Astro markdown allows raw HTML.
- Frontmatter per post: `title`, `date` (ISO), `author`, `description` (from excerpt), `cover` (featured image path), original `slug`.
- Download every referenced image/PDF. **PDFs and any file that might be deep-linked keep their original path under `public/wp-content/uploads/...`.** Post images may additionally be copied to `src/assets/` for Astro optimization in templates.
- Strip WP cruft (shortcodes that rendered to nothing, inline style attributes) but never alter wording.
- Output: `src/content/posts/<slug>.md`, `src/content/pages/<slug>.md`.
After the run, diff each migrated post's text against the snapshot version and fix discrepancies.

### Phase 3 — Content modeling
- **Events:** replace the hand-written `/kalender/` text with structured data in `src/data/seasons.yaml`, rendered as a season timeline. Schema per season: `year`, `title`, optional `note` (e.g. "Es gibt ein Streichergebnis"), `events[]` with `name`, `location`, `dates`, `points`, `status` (`upcoming|completed|canceled`). Seed it faithfully from the current page (2024–2026, including the canceled Großerlach 2026). Keep the skatedownhills.com embed below the timeline.
- **Rankings:** page lists seasons with PDF download buttons (original URLs). Optional later enhancement (ask first): render top results as HTML tables alongside the PDFs.
- **Regelwerk / Community / Organisation / Impressum:** markdown pages from Phase 2.
- Scaffold `/datenschutz/` with a clearly marked placeholder for the user's legal text; add to footer next to Impressum.

### Phase 4 — Design refresh
Direction: dark, photography-led, action-sport. The club has strong race photos — use them. Big full-bleed hero on the home page, card grid for news, bold display type for headings, the white DD logo in the header, accent color sampled from the logo/brand material. Mobile-first (most visitors come from Instagram), fast: Astro image optimization for all photos (current originals are multi-MB), no client-side JS unless something needs it. `lang="de"`, proper OpenGraph/meta per page (post cover as OG image). Aim for Lighthouse ≥95 across the board on mobile. Show the user a preview and iterate before calling this phase done.

### Phase 5 — Parity & QA
Automated check (`npm run check:urls`): after `npm run build`, verify every path in `migration/url-inventory.txt` exists in `dist/` (accounting for trailing-slash → `index.html`). Report: OK / missing / intentionally dropped. Fix all misses; get user sign-off on drops. Also verify: RSS valid, sitemap generated, 404 page works, all images load, PDFs downloadable at original paths.

### Phase 6 — Cutover (user-approved, step by step with the user)
1. Add `public/CNAME` containing `downhilldeutschland.de`; set the custom domain in repo Pages settings.
2. User updates DNS: apex A records to GitHub Pages IPs + `www` CNAME (give them the current values from GitHub's docs — verify, don't recite from memory). Enforce HTTPS once the cert is issued.
3. Confirm the live domain serves the new site; spot-check the inventory URLs on production.
4. Old VM: keep it off DNS but running for ~1 week as fallback, then the user takes a final backup and deletes it. (Done for the snapshot: pruned 2026-08-31.)

## 6. Repo layout (target)

```
.
├── CLAUDE.md / README.md
├── astro.config.mjs, package.json, tailwind config
├── .github/workflows/deploy.yml     # build + deploy to Pages on push to main
├── src/
│   ├── content/
│   │   ├── posts/                   # news posts (markdown, slug = filename)
│   │   ├── pages/                   # regeln, community, organisation, impressum, datenschutz
│   │   └── config.ts                # collection schemas (zod)
│   ├── data/seasons.yaml            # event seasons (structured)
│   ├── layouts/ + components/ + pages/ + styles/
│   └── assets/                      # optimized images
├── public/
│   ├── wp-content/uploads/...       # legacy paths preserved (PDFs, hotlinked files)
│   └── CNAME                        # only after Phase 6 approval
└── migration/
    ├── snapshot/                    # wget mirror (ground truth, temporary)
    ├── uploads/                     # raw media pulled from WP
    ├── url-inventory.txt            # parity checklist (keep)
    └── import.mjs                   # one-shot REST importer
```

## 7. Day-to-day after migration

- **New news post:** create `src/content/posts/<slug>.md` with frontmatter (`title`, `date`, `author`, `description`, `cover`), drop the cover image into `src/assets/`, push to `main`. The Action deploys in ~1–2 min.
- **Add/adjust an event:** edit `src/data/seasons.yaml` (set `status: canceled` instead of deleting).
- **New season ranking:** add the PDF under `public/wp-content/uploads/<year>/...` and list it on the ranking page.
- You may draft posts when asked, but factual claims (results, names, dates, points) must come from the user — never fill in results you don't have.
- Before every push: `npm run build` must pass; keep the parity of existing URLs.

## 8. Open decisions (ask, don't assume)

1. **Editor UX:** if non-technical members (Alex/Brini) will publish posts themselves, add a git-based CMS (Decap / Sveltia / PagesCMS) on top later. Until decided, GitHub web editing + Claude Code is the workflow.
2. **Author/category archive pages:** keep or drop (Phase 5 sign-off).
3. **Rankings as HTML tables** in addition to PDFs.
