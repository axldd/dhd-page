# downhilldeutschland.de

The website of **Downhill Deutschland** — the organisation for downhill skateboarding and streetluge in Germany.

The site is fully static: content lives as plain text files (Markdown) in this repository. Every push triggers GitHub to build the site automatically and serve it for free via GitHub Pages. There is no server, no database, and nothing to maintain or get hacked.

```
edit a file → push (or save on GitHub) → live about 2 minutes later
```

Tech: [Astro](https://astro.build) + Tailwind CSS. You don't need to understand either to publish content.

---

## Publishing a news post

This works entirely in the browser on GitHub (phone included), no local setup needed:

1. Create a new file under `src/content/posts/`, e.g. `teichfest-2027.md`. The filename becomes the URL (`/teichfest-2027/`).
2. Start the file with the header block, then write your text below it:

   ```markdown
   ---
   title: "Teichfest DH 2027"
   date: 2027-07-05
   author: "Alex"
   description: "Short teaser shown on the homepage."
   cover: "../../assets/teichfest-2027.jpg"
   ---

   The post goes here. Just normal text.
   Images: ![description](../../assets/photo.jpg)
   ```

3. Upload photos to `src/assets/` (the cover image and any images used in the text).
4. Save / commit to `main` — done. You can watch the deploy in the **Actions** tab.

Tip: you can also just ask Claude Code: "Write a post about XYZ with these results and publish it." Always provide and double-check results, names, and dates yourself.

## Maintaining events

The events page is generated from one file: `src/data/seasons.yaml`. To add a season or event, just extend it:

```yaml
- year: 2027
  title: "Deutsche Meisterschaft 2027"
  events:
    - name: "Rasen in Wasen"
      location: "Wasenweiler"
      dates: "17.–19. April"
      points: "<1000P"
      status: upcoming     # upcoming | completed | canceled
```

Don't delete canceled events — set `status: canceled` instead, and they'll be shown struck through.

## Updating rankings

Add an entry at the top of the list in `src/pages/ranking.astro`. There are two kinds:

**Tracked on another site** (like r4wrun.com, which is how it works from 2026 on):

```js
{
  year: '2027',
  label: 'Deutsche Meisterschaft 2027',
  kind: 'external',
  href: 'https://r4wrun.com/championships/…',
  meta: 'Ergebnisse auf r4wrun.com',
},
```

**As a PDF:** put the file under `public/wp-content/uploads/<year>/` first (any year
folder works — the path just has to stay stable forever), then:

```js
{
  year: '2027',
  label: 'German Champs 2027',
  kind: 'pdf',
  href: '/wp-content/uploads/2027/01/….pdf',
  meta: 'PDF herunterladen',
},
```

Old PDF links keep working because their paths never change.

## Editing pages

- **Regelwerk, Impressum, Kontakt** and the **local crew pages** are Markdown under `src/content/pages/` and `src/content/community/`. Edit and push.
- **Organisation** (the team) is `src/data/team.yaml` — name, e-mail, photo, bio per person.
- **Community** groups the crews by region in `src/pages/community/index.astro`.
- **Impressum und Datenschutz:** the responsible entity is Downhill Deutschland e.V. (Amtsgericht Stuttgart, VR 727763). The same address block appears in both `src/content/pages/impressum.md` and `src/pages/datenschutz.astro` — if anything changes (address, Vorstand, register entry), change them together. The Datenschutzerklärung describes the site as it is today; if we ever embed something, add a form, or load a font from a CDN, update that text in the same change.

## Working locally (optional)

Only needed if you're working on design/code or want a live preview:

```
npm install
npm run dev          # preview at http://localhost:4321
npm run build        # checks that the site builds without errors
npm run check:urls   # checks that no old URL broke (also runs in CI)
```

Requires Node.js (LTS). For plain text changes, the GitHub web editor is enough.

## How publishing works

Every push to `main` runs the workflow in `.github/workflows/deploy.yml`: Astro builds the site and GitHub Pages publishes it. If something is broken, the build fails and the previous version stays online — so it's hard to really break anything.

## Photos

Drop images into `src/assets/` and reference them relatively from the post
(`![](../../assets/my-photo.jpg)`). Astro resizes and converts them at build
time, so upload the good version — you don't need to shrink anything by hand.
Please don't put photos in `public/`; images there are served unoptimised.

The photos carried over from WordPress sit in `src/assets/uploads/<year>/<month>/`.
Leave them where they are — a couple of them share a filename, so moving them
together into one folder would overwrite one of them.

## Common issues

- **Post doesn't appear:** check the **Actions** tab — usually a typo in the header block (check the `---` lines and quotes). The error message names the affected file.
- **Image not showing:** check the path — images live in `src/assets/`, and the reference in the post is relative (`../../assets/...`).
- **Old links from Instagram etc.:** every page, post and PDF URL from the previous WordPress site keeps working — please never rename the filenames/slugs of existing posts, or move a PDF out of `public/wp-content/uploads/`. `npm run check:urls` runs on every push and fails the build if one would break. (Direct links to *image files* on the old site are the one exception — those were intentionally not carried over.)
- **Everything is broken:** when in doubt, revert to the last working commit on GitHub — the site rebuilds from that state automatically.
