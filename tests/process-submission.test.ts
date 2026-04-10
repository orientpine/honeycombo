import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import {
  fetchYouTubeOEmbed,
  generateId,
  isDuplicateUrl,
  isSpam,
  parseIssueBody,
  processSubmission,
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
      note: '훌륭한 AI 기사입니다.',
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
    expect(parseIssueBody('### 유형\n\n기사')).toBeNull();
  });

  it('limits tags to five entries', () => {
    const body = '### URL\n\nhttps://example.com\n\n### 유형\n\n기사\n\n### 태그 (쉼표 구분, 최대 5개)\n\na, b, c, d, e, f\n\n### 한줄 소개\n\ntest';
    const result = parseIssueBody(body);

    expect(result?.tags).toEqual(['a', 'b', 'c', 'd', 'e']);
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
    await expect(isDuplicateUrl('https://astro.build/blog/astro-5/')).resolves.toBe(true);
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
      status: 'pending',
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
      body: '### URL\n\nnot-a-url\n\n### 유형\n\n기사\n\n### 태그 (쉼표 구분, 최대 5개)\n\ntest\n\n### 한줄 소개\n\ntest',
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
      body: '### 유형\n\n기사',
      labels: [{ name: 'submission' }],
      user: { login: 'testuser' },
    };

    const result = await processSubmission(issue);

    expect(result).toEqual({ success: false, message: 'Could not parse issue body' });
  });
});
