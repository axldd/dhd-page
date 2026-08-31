# Migration report — WordPress → Astro

Status: **live.** downhilldeutschland.de has served the new site since 2026-08-31.
All 53 preserved URLs return 200 on the live domain, the Let's Encrypt certificate
covers the apex and `www`, and the old VM is kept off DNS as a fallback.

Alex signed off on 2026-08-29: the dropped URLs in §3 are fine as they are, the
international event calendar was dropped entirely. The Datenschutzerklärung was
approved on 2026-08-30 (§4).

Generated 2026-08-29 from:

- `backup-downhilldeutschland-de-2026-08-29T03-05-00.tar.gz` (WordPress files + raw MariaDB datadir)
- a `wget` mirror of the live site (`migration/snapshot/`, local only)
- the live WP REST API (`migration/raw/*.json`, committed — this is the content ground truth once the VM is gone)

---

## 1. What was checked automatically

```bash
npm run build && npm run check:urls   # every legacy URL resolves, no broken internal links
```

Final results, the content check as of its last run on 2026-08-31 immediately
before the snapshot was deleted:

| check | result |
| --- | --- |
| Legacy URLs that must resolve | **53 / 53 OK** (also verified live on the domain) |
| Broken internal links in the built HTML | **0** |
| Pages compared word-for-word against the snapshot | **25** |
| Pages that lost any content | **0** |
| PDFs byte-identical to the backup | **20 / 20** |
| Client-side JavaScript shipped | **0 bytes** |

Two pages differ from WordPress on purpose and are recorded as such:
`/impressum/` (rewritten for the e.V.) and the restructured `/kalender/`,
`/ranking/`, `/community/`, `/kontakt/`.

`check:urls` runs in the deploy workflow, so a change that would break an old URL
fails the build before it can go live. **`npm run check:content` is retired**: the
wget mirror it compared against was deleted on 2026-08-31 at Alex's request (he
keeps his own backups). The script now exits non-zero with an explanation rather
than reporting a false pass.

## 2. The inventory was bigger than we thought

`CLAUDE.md` §4 listed 7 pages. The live sitemap has **21**. Newly found and migrated:

- `/community/castle-hill-community/`, `/community/dopamania-hamburg/`,
  `/community/downhill-konstanz/`, `/community/frankendh/`,
  `/community/freiburg-freeride-crew/`, `/community/rollrunde-reutlingen/`,
  `/community/sektorf-skating/`, `/community/team-schwabenteuer/` — eight local crews
- `/grosserlach-2026/` — the canceled event page
- `/kontakt/` — see §4

`/downhill-konstanz/` (no `/community/` prefix) was a 301 on WordPress. GitHub Pages
can't serve a 301, so it's now a small redirect page pointing at the real URL.

## 3. Dropped URLs — **signed off 2026-08-29**

| URL | why |
| --- | --- |
| `/author/alex-dehmel/`, `/author/brini/`, `/author/chris/` | WP author archives; author names still appear on every post |
| `/category/news/` | the only category — identical to the home feed |
| `/shop/`, `/my-account/`, `/ticket-checkout/`, `/order-complete/` | WooCommerce / Event Tickets. There is no shop on a static site |
| `/events/` | The Events Calendar plugin archive; replaced by `/kalender/` |
| `/<post>/feed/`, `/author/<x>/feed/`, `/category/news/feed/`, `/comments/feed/` | per-object feeds; the site feed lives at `/rss.xml` and `/feed/` redirects there |
| `/wp-json/**` | the WordPress REST API |
| `/?p=<id>` | query-string permalinks; every one had a pretty equivalent that is kept |

All of the above confirmed as fine to drop.

## 4. Decisions I made that you should look at

**The event calendar is gone — dropped on request.** `CLAUDE.md` described it as an
iframe; it was actually the `ics-calendar` WordPress plugin rendering an ICS feed
through `admin-ajax.php`, with the feed URL stored in the WP database. Alex
confirmed it is no longer needed, so `/kalender/` is now the season timeline only.

**`/kontakt/` was an empty page** (its form plugin was removed at some point). Rather
than ship a blank page at a live URL, it now lists the five contact addresses that
the Organisation page already publishes. Tell me if you'd rather have it blank, or
with different addresses.

**Photos were downscaled to max 2200 px on import.** The originals ran to 17 MB each;
the whole uploads folder was 212 MB, which does not belong in a Git repo. The
untouched originals stay in the tar.gz backup. PDFs were *not* touched — all 20 are
byte-identical.

**Legacy *image* URLs were dropped on 2026-08-29** (Alex's call). Photos had been
mirrored back to their old `/wp-content/uploads/…` paths by a build hook; that cost
a 46-line integration and ~18 MB of duplicated images in every deploy, to protect
the least likely thing anyone deep-linked. `dist/` went from 62 MB to 44 MB and
`src/integrations/legacy-uploads.mjs` is gone. Photos now live only in
`src/assets/uploads/<year>/<month>/` and are served as optimized, hashed files.

What is still pinned to its exact WordPress path: **the 20 PDFs**, plus every page
and post URL. Those are the ones that actually get pasted into chats and sit in
Google's index.

A full flatten of `src/assets/uploads/` into `src/assets/` was considered and
rejected: `2024/09/open.jpg` and `2026/07/open.jpg` are different photos with the
same filename, so flattening would silently clobber one. New photos still go
straight into `src/assets/`.

**Event statuses in `seasons.yaml` are derived from the dates**, since the old page
didn't state them. Both 2026 races are marked `completed`, Großerlach 2026
`canceled` (as the old page said). 2024 has no dates or points because the old page
didn't list any — I did not fill them in from elsewhere.

**Posts with no featured image borrow their first photo** for cards and social
previews. Exactly two entries contain no photo at all and fall back to a logo
placeholder: the post `ranking-fur-2023-qualifikation-fur-die-wm-2024-in-italien`
and the crew page `dopamania-hamburg`. Send me a photo for either and they'll look
like the rest.

**`/datenschutz/` — there was nothing to copy 1:1, so it is now a written draft.**
The old site never published a Datenschutzerklärung. Verified three ways: it is
absent from `wp-sitemap.xml` and the wget mirror, `/datenschutz/`,
`/datenschutzerklaerung/` and `/privacy-policy/` all return 404 on the live site,
and the REST API finds no such page. The database does contain one **unpublished
draft** titled "Privacy Policy" (`wp_options.wp_page_for_privacy_policy` → post 3),
but it is WordPress's untouched English boilerplate: every paragraph still carries
`<strong class="privacy-policy-tutorial">Suggested text:</strong>`, and it describes
comments, Gravatar, logins and password resets — none of which exist on the new
site. Copying it would be worse than the placeholder.

On Alex's instruction the page now carries a German Datenschutzerklärung written
from the site's verified technical behaviour: responsible party from the Impressum,
GitHub Pages hosting and its server logs plus the US transfer, self-hosted fonts, no
cookies/tracking/JS, external links only as links, e-mail contact, and the data
subject rights. The claims were checked against the built output — no `<script>`, no
`<iframe>`, no cookies or `localStorage`, no remote `src`/`srcset`, no preconnect.

It is **not legal advice**. The page shows a notice box and is `noindex` while
`DRAFT = true` in `src/pages/datenschutz.astro`. After the review: set `DRAFT` to
`false` and remove `/datenschutz/` from the sitemap filter in `astro.config.mjs`.
Re-check the text whenever the site starts loading something it doesn't today (an
embed, a form, a CDN font, analytics).

## 5. Deliberately different from the old site

- **`/kalender/`** — the hand-written event list is now structured data
  (`src/data/seasons.yaml`) rendered as a timeline. Same names, dates, locations and
  points; canceled events stay visible, struck through.
- **`/ranking/`** — the same two PDFs at the same URLs, as download cards instead of
  embedded PDF viewers.
- **`/community/`** — same intro text and same region grouping, rendered as a card
  grid with each crew's own photo.
- **Comments are gone.** They were enabled but unused; there is no backend to run them.

## 6. Still open

1. Custom domain / DNS cutover — not touched, waiting for your go-ahead (`CLAUDE.md` §5 Phase 6).
2. Whether non-technical members should get a git-based CMS (Decap/Sveltia/PagesCMS).
3. Whether to render ranking results as HTML tables next to the PDFs.
4. Legal review of the Datenschutzerklärung draft (§4), then flip `DRAFT` to `false`.
