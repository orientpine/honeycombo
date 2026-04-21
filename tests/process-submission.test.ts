import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile, rm } from 'fs/promises';
import { join } from 'path';
import {
  buildUrlIndex,
  deriveShortTitle,
  extractTitleFromNote,
  fetchYouTubeOEmbed,
  findDuplicateUrl,
  generateId,
  isDuplicateUrl,
  isSpam,
  parseBulkIssueBody,
  parseIssueBody,
  processBulkSubmission,
  processSubmission,
  resolveSubmissionTitle,
  type BulkResult,
  type IssueData,
  type OEmbedData,
  type ParsedSubmission,
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

  it('captures Summary at EOF with no following ### section', () => {
    const body = '### URL\n\nhttps://example.com/eof-test\n\n### Type\n\nArticle\n\n### Tags (comma-separated, max 5)\n\nai\n\n### Summary\n\n전체 요약 텍스트';
    const result = parseIssueBody(body);

    expect(result).not.toBeNull();
    expect(result?.note).toBe('전체 요약 텍스트');
  });

  it('returns empty note when Summary section has only _No response_', () => {
    const body = '### URL\n\nhttps://example.com/no-response\n\n### Type\n\nArticle\n\n### Tags (comma-separated, max 5)\n\nai\n\n### Summary\n\n_No response_';
    const result = parseIssueBody(body);

    expect(result).not.toBeNull();
    expect(result?.note).toBe('');
  });

  it('returns empty note when Summary section is empty', () => {
    const body = '### URL\n\nhttps://example.com/empty-summary\n\n### Type\n\nArticle\n\n### Tags (comma-separated, max 5)\n\nai\n\n### Summary\n\n### Some Other Section\n\nignored';
    const result = parseIssueBody(body);

    expect(result).not.toBeNull();
    expect(result?.note).toBe('');
  });

  it('preserves internal blank lines in multiline Summary', () => {
    const body = [
      '### URL', '', 'https://example.com/blank-lines',
      '### Type', '', 'Article',
      '### Tags (comma-separated, max 5)', '', 'ai',
      '### Summary', '',
      '첫 번째 단락', '', '', '두 번째 단락',
    ].join('\n');
    const result = parseIssueBody(body);

    expect(result).not.toBeNull();
    expect(result?.note).toContain('첫 번째 단락');
    expect(result?.note).toContain('두 번째 단락');
    expect(result?.note).toBe('첫 번째 단락\n\n\n두 번째 단락');
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

describe('deriveShortTitle', () => {
  it('skips section heading lines when finding the first real content line', () => {
    // First meaningful content line has TWO sentences, so deriveShortTitle
    // returns only the first sentence and is therefore distinct from the
    // underlying content line (no title==description overlap).
    const note = ['## 개요', '이것은 추출될 제목입니다. 나머지 문장은 무시됩니다.', '', '## 주요 내용', '- 포인트 1'].join('\n');
    expect(deriveShortTitle(note)).toBe('이것은 추출될 제목입니다.');
  });

  it('returns null when derivation would equal the first content line (prevents title==description)', () => {
    const note = ['## 개요', 'AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사', '', '## 주요 내용', '- 설계 패턴'].join('\n');
    expect(deriveShortTitle(note)).toBeNull();
  });

  it('extracts only the first sentence from a multi-sentence paragraph', () => {
    const note = '첫 번째 문장입니다. 두 번째 문장은 무시되어야 합니다. 세 번째 문장.';
    expect(deriveShortTitle(note)).toBe('첫 번째 문장입니다.');
  });

  it('truncates grapheme-aware at 80 characters with ellipsis', () => {
    const longLine = '가'.repeat(120);
    const result = deriveShortTitle(longLine);
    expect(result).not.toBeNull();
    expect(Array.from(result!).length).toBeLessThanOrEqual(81); // 80 + 1 ellipsis
    expect(result!.endsWith('…')).toBe(true);
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(deriveShortTitle('')).toBeNull();
    expect(deriveShortTitle('   \n  \t ')).toBeNull();
  });

  it('skips URL-only lines and uses the next content line', () => {
    // Two sentences in the content line so truncation differs from the full line.
    const note = 'https://example.com/first-line\n실제 콘텐츠의 첫 문장. 다음 문장.';
    expect(deriveShortTitle(note)).toBe('실제 콘텐츠의 첫 문장.');
  });
});

describe('resolveSubmissionTitle', () => {
  const parsedBase: ParsedSubmission = {
    url: 'https://example.com/resolve',
    type: 'article',
    tags: ['test'],
    note: 'First meaningful content line.',
  };

  it('prefers parsed.title when set', () => {
    const parsed: ParsedSubmission = { ...parsedBase, title: 'Explicit Title' };
    expect(resolveSubmissionTitle(parsed, null, parsed.url)).toBe('Explicit Title');
  });

  it('falls through to oEmbed title when parsed.title is missing', () => {
    const oembed: OEmbedData = { title: 'From oEmbed' };
    expect(resolveSubmissionTitle(parsedBase, oembed, parsedBase.url)).toBe('From oEmbed');
  });

  it('falls through to deriveShortTitle when oEmbed is null and content has multiple sentences', () => {
    const parsed: ParsedSubmission = { ...parsedBase, note: '첫 문장. 두번째 문장.' };
    expect(resolveSubmissionTitle(parsed, null, parsed.url)).toBe('첫 문장.');
  });

  it('falls back to hostname when everything else would equal description', () => {
    const parsed: ParsedSubmission = { ...parsedBase, note: ['## 개요', 'Only one content line.'].join('\n') };
    expect(resolveSubmissionTitle(parsed, null, parsed.url)).toBe('example.com');
  });
});

describe('parseBulkIssueBody 5-column format', () => {
  it('parses optional title column when 5 pipe-separated fields are present', () => {
    const body = [
      '### Link List', '',
      'https://example.com/a | Article | Hand Title | ai, llm | 요약 내용',
    ].join('\n');
    const result = parseBulkIssueBody(body);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Hand Title');
    expect(result[0].tags).toEqual(['ai', 'llm']);
    expect(result[0].note).toBe('요약 내용');
  });

  it('still parses legacy 4-column format with no title', () => {
    const body = [
      '### Link List', '',
      'https://example.com/b | Article | ai, llm | 요약 내용',
    ].join('\n');
    const result = parseBulkIssueBody(body);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBeUndefined();
    expect(result[0].tags).toEqual(['ai', 'llm']);
    expect(result[0].note).toBe('요약 내용');
  });

  it('ignores TITLE field when line has malformed extra pipes (client responsibility to sanitize)', () => {
    // Pipe inside title breaks column alignment on the server; server cannot
    // recover the intended title unambiguously. We accept the line but the
    // client-side wrapper is responsible for rejecting pipe-in-title before submit.
    const body = [
      '### Link List', '',
      'https://example.com/c | Article | Bad|Title | ai | 요약',
    ].join('\n');
    const result = parseBulkIssueBody(body);
    // Server still parses something (not ideal, but documented):
    expect(result).toHaveLength(1);
    // rawTitle="Bad", rawTags="Title" — demonstrates the ambiguity:
    expect(result[0].title).toBe('Bad');
  });
});

describe('findDuplicateUrl', () => {
  it('returns the matching file path for a known duplicate URL', async () => {
    const result = await findDuplicateUrl('https://arstechnica.com/tech-policy/2026/04/californians-sue-over-ai-tool-that-records-doctor-visits/');
    expect(result).not.toBeNull();
    expect(result).toContain('src');
    expect(result).toMatch(/\.json$/);
  });

  it('returns null for a URL not in the repo', async () => {
    await expect(findDuplicateUrl('https://totally-new-url-xyz-12345.com/article')).resolves.toBeNull();
  });
});

describe('buildUrlIndex', () => {
  it('builds an index mapping existing URLs to their file paths', async () => {
    const index = await buildUrlIndex();
    expect(index.size).toBeGreaterThan(0);
    const match = index.get('https://arstechnica.com/tech-policy/2026/04/californians-sue-over-ai-tool-that-records-doctor-visits/');
    expect(match).toBeDefined();
    expect(match).toMatch(/\.json$/);
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

  it('avoids title == description by falling back to hostname when the only content line IS the description', async () => {
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

    // Previously title was copied from the note's first content line,
    // which ended up identical to description. Now it falls back to hostname
    // so title and description stay visually distinct.
    expect(saved.title).toBe('example.com');
    expect(saved.description).toContain('## 개요');
    expect(saved.description).toContain('## 주요 내용');
  });

  it('uses explicit parsed.title when bulk submission provides a title column', async () => {
    const issue: IssueData = {
      number: 301,
      title: '📦 Bulk Submit',
      body: [
        '### Link List', '',
        'https://example.com/explicit-title | Article | Hand-Crafted Title | ai | AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사',
      ].join('\n'),
      labels: [{ name: 'submission' }, { name: 'bulk' }],
      user: { login: 'testuser', id: 2 },
    };

    const result = await processBulkSubmission(issue);
    expect(result.succeeded).toHaveLength(1);
    expect(result.failed).toHaveLength(0);

    createdFiles.push(result.succeeded[0].filePath);
    const saved = JSON.parse(await readFile(result.succeeded[0].filePath, 'utf-8')) as {
      title: string;
      description?: string;
    };
    expect(saved.title).toBe('Hand-Crafted Title');
    expect(saved.description).toContain('AI 에이전트');
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
