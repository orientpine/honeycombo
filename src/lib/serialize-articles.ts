/**
 * Serialize merged article data for client-side tag filtering.
 *
 * The articles page uses SSG pagination (20 items/page), but the tag filter
 * needs access to ALL articles so that every tag always has matching results.
 * This serializer produces a lightweight JSON blob embedded in the page HTML.
 */

export interface ClientArticle {
  _id: string;
  title: string;
  url: string;
  source: string;
  type: string;
  description?: string;
  tags: string[];
  date: string;
  thumbnail_url?: string;
  articleOrigin: 'curated' | 'submitted' | 'feed';
  slug?: string;
  isExternal: boolean;
}

export function serializeArticles(
  articles: Array<{
    _id: string;
    _type: 'curated' | 'submitted' | 'feed';
    title: string;
    url: string;
    source: string;
    type: string;
    description?: string;
    tags: string[];
    submitted_at?: Date | string;
    published_at?: Date | string;
    thumbnail_url?: string;
  }>,
): string {
  const serialized: ClientArticle[] = articles.map((a) => {
    const date = 'submitted_at' in a && a.submitted_at ? a.submitted_at : a.published_at;
    return {
      _id: a._id,
      title: a.title,
      url: a.url,
      source: a.source,
      type: a.type,
      ...(a.description ? { description: a.description } : {}),
      tags: a.tags,
      date: new Date(date as string | Date).toISOString(),
      ...(a.thumbnail_url ? { thumbnail_url: a.thumbnail_url } : {}),
      articleOrigin: a._type === 'curated' ? 'curated' : a._type === 'submitted' ? 'submitted' : 'feed',
      ...(a._type === 'curated' ? { slug: a._id } : {}),
      isExternal: a._type === 'feed' || a._type === 'submitted',
    };
  });

  return JSON.stringify(serialized);
}
