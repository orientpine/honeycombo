import { describe, expect, it } from 'vitest';
import {
  getFilteredPool,
  getInterestMatches,
  getTopTags,
  pinInterestMatches,
  searchArticles,
  type SearchableArticle,
} from '../src/lib/article-search';

const sample: SearchableArticle[] = [
  { _id: '1', title: 'Hello World', tags: ['javascript'], articleOrigin: 'curated' },
  { _id: '2', title: 'TypeScript tips', tags: ['typescript', 'javascript'], articleOrigin: 'submitted' },
  { _id: '3', title: 'Rust async basics', tags: ['rust', 'async'], articleOrigin: 'feed' },
  { _id: '4', title: 'Hello Astro', tags: ['astro', 'javascript'], articleOrigin: 'feed' },
  { _id: '5', title: 'Korean: 안녕하세요', tags: ['korea'], articleOrigin: 'submitted' },
];

describe('searchArticles', () => {
  it('returns empty array for empty/whitespace query', () => {
    expect(searchArticles(sample, '')).toEqual([]);
    expect(searchArticles(sample, '   ')).toEqual([]);
  });

  it('matches case-insensitively on title substring', () => {
    const out = searchArticles(sample, 'HELLO');
    expect(out.map((a) => a._id)).toEqual(['1', '4']);
  });

  it('handles unicode (Korean) substrings', () => {
    const out = searchArticles(sample, '안녕');
    expect(out.map((a) => a._id)).toEqual(['5']);
  });

  it('scopes by origin when not "all"', () => {
    const submitted = searchArticles(sample, 'tip', 'submitted');
    expect(submitted.map((a) => a._id)).toEqual(['2']);
    const feed = searchArticles(sample, 'tip', 'feed');
    expect(feed).toEqual([]);
  });

  it('returns all matches across origins by default ("all")', () => {
    const out = searchArticles(sample, 'a');
    // 'a' appears in: TypeScript tips, Rust async basics, Hello Astro, Korean: 안녕하세요
    expect(out.length).toBeGreaterThanOrEqual(3);
  });

  it('does not mutate the input array', () => {
    const snapshot = sample.slice();
    searchArticles(sample, 'rust');
    expect(sample).toEqual(snapshot);
  });

  it('returns nothing when no titles match', () => {
    expect(searchArticles(sample, 'xyzpdq-no-match')).toEqual([]);
  });
});

describe('getTopTags', () => {
  const counts = { javascript: 10, rust: 5, typescript: 3, astro: 2, korea: 1, html: 0 };

  it('promotes saved interests first, in saved order', () => {
    const out = getTopTags(['rust', 'korea'], counts, 6);
    expect(out.slice(0, 2)).toEqual(['rust', 'korea']);
  });

  it('fills remaining slots with most-used tags by count', () => {
    const out = getTopTags(['rust'], counts, 4);
    // rust pinned, then javascript (10), typescript (3), astro (2)
    expect(out).toEqual(['rust', 'javascript', 'typescript', 'astro']);
  });

  it('breaks count ties alphabetically', () => {
    const out = getTopTags([], { alpha: 5, beta: 5, gamma: 5 }, 2);
    expect(out).toEqual(['alpha', 'beta']);
  });

  it('respects the limit', () => {
    const out = getTopTags([], counts, 2);
    expect(out).toHaveLength(2);
    expect(out).toEqual(['javascript', 'rust']);
  });

  it('does not duplicate when an interest is also among popular tags', () => {
    const out = getTopTags(['javascript'], counts, 3);
    expect(new Set(out).size).toEqual(out.length);
    expect(out[0]).toEqual('javascript');
  });

  it('returns empty array when both interests and counts are empty', () => {
    expect(getTopTags([], {}, 6)).toEqual([]);
  });

  it('caps interests at the limit even when they exceed it', () => {
    const out = getTopTags(['a', 'b', 'c', 'd', 'e', 'f', 'g'], counts, 4);
    expect(out).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('getInterestMatches', () => {
  it('returns empty when there are no interests', () => {
    expect(getInterestMatches(sample, [])).toEqual([]);
  });

  it('returns articles sharing at least one tag with interests', () => {
    const out = getInterestMatches(sample, ['javascript']);
    expect(out.map((a) => a._id).sort()).toEqual(['1', '2', '4']);
  });

  it('treats interests as a set (no duplicate matches)', () => {
    const out = getInterestMatches(sample, ['javascript', 'typescript']);
    expect(out.map((a) => a._id).sort()).toEqual(['1', '2', '4']);
  });

  it('returns empty when no article matches', () => {
    expect(getInterestMatches(sample, ['no-such-tag'])).toEqual([]);
  });
});

describe('pinInterestMatches', () => {
  it('returns a copy when interests is empty', () => {
    const out = pinInterestMatches(sample, []);
    expect(out).toEqual(sample);
    expect(out).not.toBe(sample); // new array
  });

  it('moves matched articles to the front, keeping relative order', () => {
    const out = pinInterestMatches(sample, ['rust']);
    // Article 3 (rust) should come first; rest in original order
    expect(out.map((a) => a._id)).toEqual(['3', '1', '2', '4', '5']);
  });

  it('preserves order within matched and unmatched groups', () => {
    const out = pinInterestMatches(sample, ['javascript']);
    // Matched (in input order): 1, 2, 4. Unmatched: 3, 5.
    expect(out.map((a) => a._id)).toEqual(['1', '2', '4', '3', '5']);
  });

  it('does not mutate the input array', () => {
    const snapshot = sample.slice();
    pinInterestMatches(sample, ['javascript']);
    expect(sample).toEqual(snapshot);
  });
});

/**
 * Integration-style tests for the full filter pipeline (search ∩ origin ∩ tag).
 * Cover the combined contract that SourceFilter / ArticleSearch / InterestTagPanel
 * all depend on so that future refactors can't silently change semantics.
 */
describe('getFilteredPool', () => {
  const corpus: SearchableArticle[] = [
    { _id: 'c1', title: 'Hello World', tags: ['javascript', 'web'], articleOrigin: 'curated' },
    { _id: 'c2', title: 'Editor Pick', tags: ['ai'], articleOrigin: 'curated' },
    { _id: 's1', title: 'Submitted Hello', tags: ['javascript'], articleOrigin: 'submitted' },
    { _id: 's2', title: 'TypeScript Tips', tags: ['typescript', 'javascript'], articleOrigin: 'submitted' },
    { _id: 's3', title: 'Rust Async Basics', tags: ['rust'], articleOrigin: 'submitted' },
    { _id: 'f1', title: 'Hello Astro', tags: ['astro', 'javascript'], articleOrigin: 'feed' },
    { _id: 'f2', title: 'AI Models', tags: ['ai'], articleOrigin: 'feed' },
    { _id: 'f3', title: 'Hello Rust', tags: ['rust'], articleOrigin: 'feed' },
  ];

  it('no filters: returns the full corpus and full per-origin breakdown', () => {
    const out = getFilteredPool(corpus, '', 'all', 'all');
    expect(out.all).toHaveLength(8);
    expect(out.perOrigin).toEqual({ curated: 2, submitted: 3, feed: 3 });
  });

  it('search only: per-origin reflects search results across ALL origins', () => {
    const out = getFilteredPool(corpus, 'hello', 'all', 'all');
    expect(out.all.map((a) => a._id).sort()).toEqual(['c1', 'f1', 'f3', 's1']);
    expect(out.perOrigin).toEqual({ curated: 1, submitted: 1, feed: 2 });
  });

  it('search + tag: per-origin counts reflect intersection (not search alone)', () => {
    const out = getFilteredPool(corpus, 'hello', 'all', 'javascript');
    expect(out.all.map((a) => a._id).sort()).toEqual(['c1', 'f1', 's1']);
    expect(out.perOrigin).toEqual({ curated: 1, submitted: 1, feed: 1 });
  });

  it('search + tag + origin: applies origin filter LAST', () => {
    const out = getFilteredPool(corpus, 'hello', 'submitted', 'javascript');
    expect(out.all.map((a) => a._id)).toEqual(['s1']);
    expect(out.perOrigin).toEqual({ curated: 1, submitted: 1, feed: 1 });
  });

  it('tag only (no search): per-origin reflects tag pool', () => {
    const out = getFilteredPool(corpus, '', 'all', 'rust');
    expect(out.all.map((a) => a._id).sort()).toEqual(['f3', 's3']);
    expect(out.perOrigin).toEqual({ curated: 0, submitted: 1, feed: 1 });
  });

  it('tag + origin only (no search): origin scoping works without search', () => {
    const out = getFilteredPool(corpus, '', 'feed', 'rust');
    expect(out.all.map((a) => a._id)).toEqual(['f3']);
    expect(out.perOrigin).toEqual({ curated: 0, submitted: 1, feed: 1 });
  });

  it('origin only: per-origin still computed from full pool', () => {
    const out = getFilteredPool(corpus, '', 'submitted', 'all');
    expect(out.all.map((a) => a._id).sort()).toEqual(['s1', 's2', 's3']);
    expect(out.perOrigin).toEqual({ curated: 2, submitted: 3, feed: 3 });
  });

  it('search is case-insensitive and trims whitespace', () => {
    const out = getFilteredPool(corpus, '  HELLO  ', 'all', 'all');
    expect(out.all.map((a) => a._id).sort()).toEqual(['c1', 'f1', 'f3', 's1']);
  });

  it('no matches: returns empty pool with zero per-origin counts', () => {
    const out = getFilteredPool(corpus, 'xyzpdq-no-match', 'all', 'all');
    expect(out.all).toEqual([]);
    expect(out.perOrigin).toEqual({ curated: 0, submitted: 0, feed: 0 });
  });

  it('does not mutate the input array', () => {
    const snapshot = corpus.slice();
    getFilteredPool(corpus, 'hello', 'submitted', 'javascript');
    expect(corpus).toEqual(snapshot);
  });
});
