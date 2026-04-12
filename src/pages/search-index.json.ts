import { getCollection } from 'astro:content';

export async function GET() {
  const curated = await getCollection('curated', (e: any) => e.data.status === 'approved').catch(() => []);
  const feeds = await getCollection('feeds').catch(() => []);

  const index = [
    ...curated.map((e: any) => ({
      id: e.id,
      title: e.data.title,
      url: e.data.url,
      description: e.data.description || '',
      source: e.data.source,
      type: 'curated' as const,
    })),
    ...feeds.map((e: any) => ({
      id: e.id,
      title: e.data.title,
      url: e.data.url,
      description: e.data.description || '',
      source: e.data.source,
      type: 'feed' as const,
    })),
  ];

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
}
