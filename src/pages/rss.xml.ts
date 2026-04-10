import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const curatedArticles = await getCollection('curated', (entry) => entry.data.status === 'approved');
  const feedArticles = await getCollection('feeds');

  const allArticles = [
    ...curatedArticles.map((entry) => ({
      title: entry.data.title,
      link: entry.data.url,
      description: entry.data.description || entry.data.title,
      pubDate: new Date(entry.data.submitted_at),
      categories: entry.data.tags,
    })),
    ...feedArticles.map((entry) => ({
      title: entry.data.title,
      link: entry.data.url,
      description: entry.data.description || entry.data.title,
      pubDate: new Date(entry.data.published_at),
      categories: entry.data.tags,
    })),
  ]
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, 50);

  return rss({
    title: 'HoneyCombo — 기술 뉴스 큐레이션',
    description: '개발자를 위한 기술 뉴스 큐레이션 사이트',
    site: context.site!,
    items: allArticles,
    customData: '<language>ko</language>',
  });
}
