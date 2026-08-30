import { defineCollection, type SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';
import { load as parseYaml } from 'js-yaml';

/** News posts. The filename is the slug and therefore the public URL. */
const posts = defineCollection({
  loader: glob({ base: 'src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      author: z.string().optional(),
      description: z.string().optional(),
      /** Path relative to the markdown file, e.g. ../../assets/uploads/2026/07/x.jpg */
      cover: image().optional(),
      /** Original WordPress post ID, kept for traceability against the backup. */
      wpId: z.number().optional(),
    }),
});

const pageSchema = (image: SchemaContext['image']) =>
  z.object({
    title: z.string(),
    description: z.string().optional(),
    cover: image().optional(),
    wpId: z.number().optional(),
  });

/** Standalone pages: Regelwerk, Impressum, Organisation, ... */
const pages = defineCollection({
  loader: glob({ base: 'src/content/pages', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) => pageSchema(image),
});

/** Local crews, rendered under /community/<slug>/. */
const community = defineCollection({
  loader: glob({ base: 'src/content/community', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    pageSchema(image).extend({
      region: z.enum(['Südwest', 'Südost', 'Nord', 'Ost', 'West']).optional(),
      links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
    }),
});

/** Race seasons, rendered as the timeline on /kalender/. */
const seasons = defineCollection({
  // seasons.yaml is authored as a plain list; key each entry by its year so the
  // file loader has the `id` it needs.
  loader: file('src/data/seasons.yaml', {
    parser: (text) =>
      (parseYaml(text) as Array<Record<string, unknown>>).map((season) => ({
        ...season,
        id: String(season.year),
      })),
  }),
  schema: z.object({
    year: z.number(),
    title: z.string(),
    note: z.string().optional(),
    events: z.array(
      z.object({
        name: z.string(),
        location: z.string().optional(),
        dates: z.string().optional(),
        points: z.string().optional(),
        status: z.enum(['upcoming', 'completed', 'canceled']),
        url: z.string().optional(),
      }),
    ),
  }),
});

export const collections = { posts, pages, community, seasons };
