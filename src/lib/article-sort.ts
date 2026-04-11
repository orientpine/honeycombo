/**
 * Shared article sort comparator.
 * Used by index.astro, articles/index.astro, and articles/page/[...page].astro.
 *
 * Sort order: date descending, curated wins on ties.
 */

export type SortableArticle = {
  _type: 'curated' | 'feed';
  submitted_at?: Date | string;
  published_at?: Date | string;
};

function getArticleDate(a: SortableArticle): number {
  const raw = a._type === 'curated' ? a.submitted_at : a.published_at;
  return new Date(raw ?? 0).getTime();
}

export function compareArticles(a: SortableArticle, b: SortableArticle): number {
  const dateA = getArticleDate(a);
  const dateB = getArticleDate(b);
  if (dateB !== dateA) return dateB - dateA;
  if (a._type === 'curated' && b._type !== 'curated') return -1;
  if (b._type === 'curated' && a._type !== 'curated') return 1;
  return 0;
}
