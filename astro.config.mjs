// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import rehypeDemoteH1 from './src/plugins/rehype-demote-h1.mjs';

export default defineConfig({
  site: 'https://downhilldeutschland.de',
  base: '/',
  // WordPress served every URL with a trailing slash - keep that for URL parity.
  trailingSlash: 'always',
  integrations: [
    mdx(),
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
