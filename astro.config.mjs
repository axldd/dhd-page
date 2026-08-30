// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import rehypeDemoteH1 from './src/plugins/rehype-demote-h1.mjs';
import previewBase from './src/integrations/preview-base.mjs';

/**
 * Temporary GitHub Pages preview. Set PREVIEW_BASE=/dhd-page to build a copy
 * that works at https://axldd.github.io/dhd-page/. Unset (production) the site
 * is served from the domain root exactly as before.
 */
const PREVIEW_BASE = process.env.PREVIEW_BASE;

export default defineConfig({
  site: PREVIEW_BASE ? 'https://axldd.github.io' : 'https://downhilldeutschland.de',
  base: PREVIEW_BASE ?? '/',
  // WordPress served every URL with a trailing slash - keep that for URL parity.
  trailingSlash: 'always',
  integrations: [
    mdx(),
    ...(PREVIEW_BASE ? [previewBase(PREVIEW_BASE)] : []),
    sitemap({
      // Redirect stubs don't belong in the sitemap.
      // Match on the exact path — /community/downhill-konstanz/ is a real page.
      filter: (page) =>
        !['/feed/', '/downhill-konstanz/'].includes(
          new URL(page).pathname,
        ),
    }),
  ],
  markdown: {
    rehypePlugins: [rehypeDemoteH1],
  },
  image: {
    responsiveStyles: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
