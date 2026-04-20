import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import {
  fetchYouTubeOEmbed,
  extractTitleFromNote,
  generateId,
  isDuplicateUrl,
  isSpam,
  parseBulkIssueBody,
  parseIssueBody,
  processBulkSubmission,
  processSubmission,
  type BulkResult,
  type IssueData,
} from '../scripts/process-submission';

const ROOT = process.cwd();
const FIXTURES_DIR = join(ROOT, 'tests/fixtures');
const createdFiles: string[] = [];
const originalFetch = globalThis.fetch;

async function readFixture(name: string): Promise<IssueData> {
  return JSON.parse(await readFile(join(FIXTURES_DIR, name), 'utf-8')) as IssueData;
}

afterEach(async () => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;

  await Promise.all(
    createdFiles.splice(0).map((filePath) => rm(filePath, { force: true })),
  );
});

describe('parseIssueBody', () => {
  it('parses valid issue body fixture', async () => {
    const issue = await readFixture('valid-issue.json');
    const result = parseIssueBody(issue.body);

    expect(result).not.toBeNull();
    expect(result).toEqual({
      url: 'https://example.com/great-article',
      type: 'article',
      tags: ['ai', 'llm'],
      note: 'A great AI article.',
    });
  });

  it('auto-detects youtube urls from fixture', async () => {
    const issue = await readFixture('youtube-issue.json');
    const result = parseIssueBody(issue.body);

    expect(result?.type).toBe('youtube');
    expect(result?.tags).toEqual(['video', 'tutorial']);
  });

  it('returns null for malformed bodies', () => {
    expect(parseIssueBody('')).toBeNull();
    expect(parseIssueBody('### Type\n\nArticle')).toBeNull();
  });

  it('limits tags to five entries', () => {
    const body = '### URL\n\nhttps://example.com\n\n### Type\n\nArticle\n\n### Tags (comma-separated, max 5)\n\na, b, c, d, e, f\n\n### Short Description\n\ntest';
    const result = parseIssueBody(body);

    expect(result?.tags).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('parses multiline "### Summary" section', () => {
    const body = '### URL\n\nhttps://example.com/summary-test\n\n### Type\n\nArticle\n\n### Tags (comma-separated, max 5)\n\nai, agents\n\n### Summary\n\n## 개요\nAI 에이전트 활용에 대한 실전 가이드';
    const result = parseIssueBody(body);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://example.com/summary-test');
    expect(result?.type).toBe('article');
    expect(result?.tags).toEqual(['ai', 'agents']);
    expect(result?.note).toBe('## 개요\nAI 에이전트 활용에 대한 실전 가이드');
  });

  it('parses full structured Summary with multiple sub-sections', () => {
    const body = [
      '### URL', '', 'https://example.com/full-summary',
      '### Type', '', 'Article',
      '### Tags (comma-separated, max 5)', '', 'ai, agents',
      '### Summary', '',
      '## 개요', 'AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사',
      '', '## 주요 내용', '- 에이전트 아키텍처 설계 패턴', '- 프로덕션 배포 시 고려사항',
      '', '## 시사점', '실무에서 바로 적용 가능한 에이전트 구축 가이드',
    ].join('\n');
    const result = parseIssueBody(body);

    expect(result).not.toBeNull();
    expect(result?.note).toContain('## 개요');
    expect(result?.note).toContain('## 주요 내용');
    expect(result?.note).toContain('## 시사점');
    expect(result?.note).toContain('에이전트 아키텍처 설계 패턴');
    expect(result?.note).toContain('실무에서 바로 적용 가능한 에이전트 구축 가이드');
  });

  it('still parses legacy "### Short Description" for backward compatibility', () => {
    const body = '### URL\n\nhttps://example.com/legacy\n\n### Type\n\nArticle\n\n### Tags (comma-separated, max 5)\n\ntest\n\n### Short Description\n\nlegacy note';
    const result = parseIssueBody(body);

    expect(result).not.toBeNull();
    expect(result?.note).toBe('legacy note');
  });
});

describe('extractTitleFromNote', () => {
  it('returns first non-heading line as title', () => {
    const note = '## 개요\nAI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사\n\n## 주요 내용\n- 설계 패턴';
    expect(extractTitleFromNote(note)).toBe('AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사');
  });

  it('strips heading prefix when no content line exists', () => {
    expect(extractTitleFromNote('## 개요')).toBe('개요');
    expect(extractTitleFromNote('# Title')).toBe('Title');
  });

  it('returns plain text as-is for single-line notes', () => {
    expect(extractTitleFromNote('A great AI article.')).toBe('A great AI article.');
  });

  it('returns empty string for empty note', () => {
    expect(extractTitleFromNote('')).toBe('');
  });
});

describe('parseBulkIssueBody', () => {
  it('parses valid bulk issue body fixture', async () => {
    const issue = await readFixture('bulk-issue.json');
    const result = parseBulkIssueBody(issue.body);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      url: 'https://example.com/bulk-article-1',
      type: 'article',
      tags: ['ai', 'llm'],
      note: 'First article',
    });
    expect(result[1].type).toBe('youtube');
    expect(result[2].type).toBe('other');
  });

  it('skips invalid lines in partial fixture', async () => {
    const issue = await readFixture('bulk-issue-partial.json');
    const result = parseBulkIssueBody(issue.body);

    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array for empty body', () => {
    expect(parseBulkIssueBody('')).toEqual([]);
  });

  it('returns empty array when section not found', () => {
    expect(parseBulkIssueBody('### 다른 섹션\n\nsome text')).toEqual([]);
  });

  it('limits items to 20', () => {
    const lines = Array.from({ length: 25 }, (_, i) =>
      `https://example.com/item-${i} | Article | tag${i} | note ${i}`,
    ).join('\n');
    const body = `### Link List\n\n${lines}`;
    const result = parseBulkIssueBody(body);

    expect(result).toHaveLength(20);
  });

  it('handles lines with missing optional fields', () => {
    const body = '### Link List\n\nhttps://example.com/minimal | Article | |';
    const result = parseBulkIssueBody(body);

    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual(['general']);
    expect(result[0].note).toBe('');
  });
});

describe('fetchYouTubeOEmbed', () => {
  it('returns oEmbed metadata when fetch succeeds', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          title: 'Example Video',
          thumbnail_url: 'https://img.youtube.com/example.jpg',
          author_name: 'Creator',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as typeof fetch;

    const result = await fetchYouTubeOEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    expect(result).toMatchObject({
      title: 'Example Video',
      thumbnail_url: 'https://img.youtube.com/example.jpg',
      author_name: 'Creator',
    });
  });
});

describe('generateId', () => {
  it('generates consistent ids', () => {
    const id1 = generateId('https://example.com', 42);
    const id2 = generateId('https://example.com', 42);

    expect(id1).toBe(id2);
    expect(id1).toMatch(/^submission-42-/);
  });

  it('generates different ids for different urls', () => {
    expect(generateId('https://example.com/a', 1)).not.toBe(generateId('https://example.com/b', 1));
  });
});

describe('isDuplicateUrl', () => {
  it('detects existing url from sample article', async () => {
    await expect(isDuplicateUrl('https://arstechnica.com/tech-policy/2026/04/californians-sue-over-ai-tool-that-records-doctor-visits/')).resolves.toBe(true);
  });

  it('returns false for new urls', async () => {
    await expect(isDuplicateUrl('https://totally-new-url-xyz-12345.com/article')).resolves.toBe(false);
  });
});

describe('isSpam', () => {
  it('detects configured spam keywords', async () => {
    await expect(isSpam('This is a shocking limited offer')).resolves.toBe(true);
  });

  it('allows normal submissions', async () => {
    await expect(isSpam('Thoughtful article about Astro content collections')).resolves.toBe(false);
  });
});

describe('processSubmission', () => {
  it('processes a valid submission in dry run', async () => {
    const issue = await readFixture('valid-issue.json');

    const result = await processSubmission(issue, { dryRun: true });

    expect(result).toEqual({
      success: true,
      message: 'Dry run — article would be created',
    });
  });

  it('uses youtube oembed metadata for youtube submissions', async () => {
    const issue = await readFixture('youtube-issue.json');
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          title: 'Never Gonna Give You Up',
          thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as typeof fetch;

    const result = await processSubmission(issue);

    expect(result.success).toBe(true);
    expect(result.filePath).toBeDefined();

    createdFiles.push(result.filePath as string);
    const saved = JSON.parse(await readFile(result.filePath as string, 'utf-8')) as {
      title: string;
      source: string;
      type: string;
      thumbnail_url?: string;
      status: string;
    };

    expect(saved).toMatchObject({
      title: 'Never Gonna Give You Up',
      source: 'YouTube',
      type: 'youtube',
      thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      status: 'approved',
    });
  });

  it('rejects duplicate urls', async () => {
    const issue = await readFixture('duplicate-issue.json');

    const result = await processSubmission(issue, { dryRun: true });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Duplicate URL');
  });

  it('rejects invalid urls', async () => {
    const issue: IssueData = {
      number: 101,
      title: 'Submit: not-a-url',
      body: '### URL\n\nnot-a-url\n\n### Type\n\nArticle\n\n### Tags (comma-separated, max 5)\n\ntest\n\n### Short Description\n\ntest',
      labels: [{ name: 'submission' }],
      user: { login: 'testuser' },
    };

    const result = await processSubmission(issue, { dryRun: true });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid URL');
  });

  it('rejects malformed issue bodies without crashing', async () => {
    const issue: IssueData = {
      number: 102,
      title: 'Submit: broken',
      body: '### Type\n\nArticle',
      labels: [{ name: 'submission' }],
      user: { login: 'testuser' },
    };

    const result = await processSubmission(issue);

    expect(result).toEqual({ success: false, message: 'Could not parse issue body' });
  });

  it('derives title from first content line of multiline note', async () => {
    const issue: IssueData = {
      number: 300,
      title: '📎 Submit Link',
      body: [
        '### URL', '', 'https://example.com/multiline-title-test',
        '### Type', '', 'Article',
        '### Tags (comma-separated, max 5)', '', 'ai',
        '### Summary', '',
        '## 개요', 'AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사',
        '', '## 주요 내용', '- 설계 패턴',
      ].join('\n'),
      labels: [{ name: 'submission' }],
      user: { login: 'testuser', id: 1 },
    };

    const result = await processSubmission(issue);
    expect(result.success).toBe(true);
    expect(result.filePath).toBeDefined();

    createdFiles.push(result.filePath as string);
    const saved = JSON.parse(await readFile(result.filePath as string, 'utf-8')) as {
      title: string;
      description?: string;
    };

    expect(saved.title).toBe('AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사');
    expect(saved.description).toContain('## 개요');
    expect(saved.description).toContain('## 주요 내용');
  });
});

describe('processBulkSubmission', () => {
  it('processes valid bulk submission in dry run', async () => {
    const issue = await readFixture('bulk-issue.json');
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ title: 'Test Video' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch;

    const result: BulkResult = await processBulkSubmission(issue, { dryRun: true });
    expect(result.total).toBe(3);
    expect(result.succeeded).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
  });

  it('handles partial failures gracefully', async () => {
    const issue = await readFixture('bulk-issue-partial.json');
    globalThis.fetch = vi.fn(async () =>
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as typeof fetch;

    const result = await processBulkSubmission(issue, { dryRun: true });
    expect(result.succeeded.length).toBeGreaterThanOrEqual(1);
    expect(result.failed.length).toBeGreaterThanOrEqual(1);
    expect(result.total).toBe(result.succeeded.length + result.failed.length);
  });

  it('returns empty result for unparseable body', async () => {
    const issue: IssueData = {
      number: 200,
      title: 'Bulk',
      body: 'no valid content',
      labels: [{ name: 'submission' }, { name: 'bulk' }],
      user: { login: 'testuser' },
    };
    const result = await processBulkSubmission(issue, { dryRun: true });
    expect(result.total).toBe(0);
    expect(result.succeeded).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });
});
