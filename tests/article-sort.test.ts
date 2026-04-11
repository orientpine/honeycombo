import { describe, expect, it } from 'vitest';
import { compareArticles, type SortableArticle } from '../src/lib/article-sort';

describe('compareArticles', () => {
  it('sorts by date descending', () => {
    const articles: SortableArticle[] = [
      { _type: 'feed', published_at: '2026-04-01' },
      { _type: 'feed', published_at: '2026-04-10' },
      { _type: 'feed', published_at: '2026-04-05' },
    ];
    const sorted = [...articles].sort(compareArticles);
    expect(sorted[0].published_at).toBe('2026-04-10');
    expect(sorted[1].published_at).toBe('2026-04-05');
    expect(sorted[2].published_at).toBe('2026-04-01');
  });

  it('curated wins on date ties', () => {
    const articles: SortableArticle[] = [
      { _type: 'feed', published_at: '2026-04-10' },
      { _type: 'curated', submitted_at: '2026-04-10' },
    ];
    const sorted = [...articles].sort(compareArticles);
    expect(sorted[0]._type).toBe('curated');
    expect(sorted[1]._type).toBe('feed');
  });

  it('newer feed beats older curated', () => {
    const articles: SortableArticle[] = [
      { _type: 'curated', submitted_at: '2026-04-01' },
      { _type: 'feed', published_at: '2026-04-10' },
    ];
    const sorted = [...articles].sort(compareArticles);
    expect(sorted[0]._type).toBe('feed');
    expect(sorted[1]._type).toBe('curated');
  });

  it('stable sort for same type and date', () => {
    const a: SortableArticle = { _type: 'feed', published_at: '2026-04-10' };
    const b: SortableArticle = { _type: 'feed', published_at: '2026-04-10' };
    expect(compareArticles(a, b)).toBe(0);
  });

  it('handles mixed curated/feed dataset with correct pagination boundaries', () => {
    const articles: SortableArticle[] = [];
    // 15 feed articles (April 1-15)
    for (let i = 1; i <= 15; i++) {
      articles.push({ _type: 'feed', published_at: `2026-04-${String(i).padStart(2, '0')}` });
    }
    // 10 curated articles (April 3-12, overlapping with feeds)
    for (let i = 3; i <= 12; i++) {
      articles.push({ _type: 'curated', submitted_at: `2026-04-${String(i).padStart(2, '0')}` });
    }

    const sorted = [...articles].sort(compareArticles);

    // Total 25 articles
    expect(sorted).toHaveLength(25);

    // First article should be April 15 (latest date, feed)
    expect(sorted[0]._type).toBe('feed');

    // April 12 has both curated and feed — curated should come first
    const apr12Items = sorted.filter(a => {
      const date = a._type === 'curated' ? a.submitted_at : a.published_at;
      return date === '2026-04-12';
    });
    expect(apr12Items[0]._type).toBe('curated');
    expect(apr12Items[1]._type).toBe('feed');

    // Page 1 (first 20) and page 2 (last 5) should follow same order
    const page1 = sorted.slice(0, 20);
    const page2 = sorted.slice(20);
    const lastPage1Date = new Date(page1[19]._type === 'curated' ? page1[19].submitted_at! : page1[19].published_at!).getTime();
    const firstPage2Date = new Date(page2[0]._type === 'curated' ? page2[0].submitted_at! : page2[0].published_at!).getTime();
    // Page boundary: last of page 1 should be >= first of page 2 (date descending)
    expect(lastPage1Date).toBeGreaterThanOrEqual(firstPage2Date);
  });
});
