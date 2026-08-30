import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('posts')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: 'Downhill Deutschland',
    description:
      'News rund um Downhill Skateboarding und Streetluge in Deutschland: Rennen, Ergebnisse und Ranking.',
    site: context.site!,
    trailingSlash: true,
    customData: '<language>de-DE</language>',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      author: post.data.author,
      link: `/${post.id}/`,
    })),
  });
}
