import { describe, expect, it } from 'vitest';
import { buildInsertStatement, extractSubmissionInsertValues } from '../scripts/backfill-submissions';

describe('backfill-submissions', () => {
  it('extracts submission SQL values from a submitted article', () => {
    const article = {
      id: 'submission-149-8d20db04',
      title: 'What Is Yann LeCun Cooking? JEPA Explained Simply',
      url: 'https://www.youtube.com/watch?v=oM4neOyZOi0',
      submitted_by_id: '32758428',
      submitted_at: '2026-04-21T02:03:09.291Z',
    };

    expect(extractSubmissionInsertValues(article)).toEqual({
      articleId: 'submission-149-8d20db04',
      submittedById: '32758428',
      title: 'What Is Yann LeCun Cooking? JEPA Explained Simply',
      url: 'https://www.youtube.com/watch?v=oM4neOyZOi0',
      createdAt: '2026-04-21T02:03:09.291Z',
    });
  });

  it('filters out articles without submitted_by_id', () => {
    const article = {
      id: 'submission-200-abc12345',
      title: 'No submitter',
      url: 'https://example.com/article',
      submitted_at: '2026-04-21T03:00:00.000Z',
    };

    expect(extractSubmissionInsertValues(article)).toBeNull();
  });

  it('uses INSERT OR IGNORE for idempotent SQL', () => {
    const sql = buildInsertStatement({
      articleId: 'submission-149-8d20db04',
      submittedById: '32758428',
      title: 'What Is Yann LeCun Cooking? JEPA Explained Simply',
      url: 'https://www.youtube.com/watch?v=oM4neOyZOi0',
      createdAt: '2026-04-21T02:03:09.291Z',
    });

    expect(sql).toContain('INSERT OR IGNORE INTO submissions');
    expect(sql).toContain("'submission-149-8d20db04'");
    expect(sql).toContain("'32758428'");
    expect(sql).toContain("'2026-04-21T02:03:09.291Z'");
    expect(sql).toContain(', 0,');
  });
});
