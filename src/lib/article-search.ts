/**
 * Pure helpers shared by ArticleSearch and InterestTagPanel client scripts.
 *
 * The Astro components themselves run in the browser as inline scripts and cannot
 * import this module at runtime — instead they keep mirror copies of these
 * functions. Centralizing the logic here gives us a single source of truth that
 * we can unit test, and any divergence between this file and the inline copies
 * will be caught by `tests/article-search.test.ts`.
 */

export interface SearchableArticle {
  _id: string;
  title: string;
  tags: string[];
  articleOrigin: 'curated' | 'submitted' | 'feed';
}

/**
 * Filter articles by case-insensitive title substring + optional origin scope.
 * Empty/whitespace-only query returns an empty array (callers should treat
 * "no query" as "no active search" rather than "show everything").
 */
export function searchArticles<T extends SearchableArticle>(
  articles: readonly T[],
  query: string,
  origin: 'all' | 'curated' | 'submitted' | 'feed' = 'all',
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  const scoped = origin === 'all' ? articles : articles.filter((a) => a.articleOrigin === origin);
  return scoped.filter((a) => a.title.toLowerCase().includes(trimmed));
}

/**
 * Pick the top N tags to surface in the always-visible chip row.
 *
 * Order:
 *   1. User's saved interests (in the order they were saved), capped at limit
 *   2. Then the most-used tags by article count (alphabetical tiebreaker)
 *
 * Duplicates are de-duplicated. Tags not present in `tagCounts` are included
 * (count=0) only when they come from `interests`, so that saved interests are
 * always promoted even if they have zero matching articles in this build.
 */
export function getTopTags(
  interests: readonly string[],
  tagCounts: Record<string, number>,
  limit = 6,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const tag of interests) {
    if (seen.has(tag) || result.length >= limit) continue;
    seen.add(tag);
    result.push(tag);
  }
  if (result.length >= limit) return result.slice(0, limit);

  const sorted = Object.keys(tagCounts).sort((a, b) => {
    const diff = (tagCounts[b] || 0) - (tagCounts[a] || 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });

  for (const tag of sorted) {
    if (seen.has(tag) || result.length >= limit) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result.slice(0, limit);
}

/**
 * Return the subset of articles that share at least one tag with the saved
 * interests set. Used both for the "관심사 일치 N건" badge and to pin matched
 * articles to the top of the rendered grid.
 */
export function getInterestMatches<T extends SearchableArticle>(
  articles: readonly T[],
  interests: readonly string[],
): T[] {
  if (interests.length === 0) return [];
  const set = new Set(interests);
  return articles.filter((a) => a.tags.some((t) => set.has(t)));
}

/**
 * Reorder articles so that interest-matched articles come first, preserving the
 * relative order within each group. Returns a new array — the input is not mutated.
 */
export function pinInterestMatches<T extends SearchableArticle>(
  articles: readonly T[],
  interests: readonly string[],
): T[] {
  if (interests.length === 0) return articles.slice();
  const set = new Set(interests);
  const matched: T[] = [];
  const unmatched: T[] = [];
  for (const a of articles) {
    if (a.tags.some((t) => set.has(t))) matched.push(a);
    else unmatched.push(a);
  }
  return [...matched, ...unmatched];
}

/**
 * Compute the filtered article pool given the active search query, origin scope,
 * and tag filter. The per-origin breakdown is computed BEFORE applying the origin
 * filter so that SourceFilter can show truthful per-tab counts (e.g. "Submitted: 3,
 * RSS: 12") that reflect the active search/tag, not the global SSR totals.
 *
 * This mirrors the in-component logic in InterestTagPanel.astro and is the single
 * source of truth for the filter pipeline contract.
 */
export function getFilteredPool<T extends SearchableArticle>(
  articles: readonly T[],
  query: string,
  origin: 'all' | 'curated' | 'submitted' | 'feed',
  tag: string,
): {
  all: T[];
  perOrigin: { submitted: number; feed: number; curated: number };
} {
  const trimmed = query.trim().toLowerCase();
  let pool: T[] = articles.slice();
  if (trimmed) pool = pool.filter((a) => a.title.toLowerCase().includes(trimmed));
  if (tag !== 'all') pool = pool.filter((a) => a.tags.includes(tag));

  const perOrigin = {
    submitted: pool.filter((a) => a.articleOrigin === 'submitted').length,
    feed: pool.filter((a) => a.articleOrigin === 'feed').length,
    curated: pool.filter((a) => a.articleOrigin === 'curated').length,
  };

  const all = origin === 'all' ? pool : pool.filter((a) => a.articleOrigin === origin);
  return { all, perOrigin };
}
