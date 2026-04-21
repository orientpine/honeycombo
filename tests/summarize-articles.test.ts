import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  clearStaleDescription,
  findArticlesNeedingSummary,
  hasSelfReferentialOpening,
  looksLikeKoreanStructuredSummary,
  summarizeArticles,
} from '../scripts/summarize-articles';
import { readFile } from 'fs/promises';

const ROOT = process.cwd();
const TEST_DIR = join(ROOT, 'tests/tmp-summarize-test');
const CURATED_DIR = join(TEST_DIR, 'curated');
const FEEDS_DIR = join(TEST_DIR, 'feeds');

describe('looksLikeKoreanStructuredSummary', () => {
  it('returns true for full structured summary with all three headings', () => {
    const text = [
      '## 개요',
      '',
      '오픈소스 LLM 프레임워크 분석',
      '',
      '## 주요 내용',
      '',
      '- TypeScript 기반',
      '- MIT 라이선스',
      '',
      '## 시사점',
      '',
      '에이전트 오케스트레이션 표준화 가능성',
    ].join('\n');

    expect(looksLikeKoreanStructuredSummary(text)).toBe(true);
  });

  it('returns true when 개요 heading is omitted (model variance)', () => {
    // 사용자가 보여준 reference 예시처럼 ## 개요 없이 시작하는 케이스
    const text = [
      'Dance of Tal 기반의 로컬 비주얼 에디터로, Figma처럼 캔버스 위에서 AI 퍼포머를 배치',
      '',
      '## 주요 내용',
      '- Tal(정체성), Dance(스킬), Performer(에이전트), Act(협업 규칙) 4가지 빌딩 블록',
      '- 드래그&드롭으로 캔버스에 배치',
      '',
      '## 시사점',
      '에이전트 오케스트레이션을 시각적으로 설계',
    ].join('\n');

    expect(looksLikeKoreanStructuredSummary(text)).toBe(true);
  });

  it('returns true with only 주요 내용 heading present', () => {
    const text = '## 주요 내용\n- 포인트 1';
    expect(looksLikeKoreanStructuredSummary(text)).toBe(true);
  });

  it('returns true with only 시사점 heading present', () => {
    const text = '## 시사점\n핵심 결론';
    expect(looksLikeKoreanStructuredSummary(text)).toBe(true);
  });

  it('tolerates whitespace variations in headings', () => {
    expect(looksLikeKoreanStructuredSummary('##주요내용\n- a')).toBe(true);
    expect(looksLikeKoreanStructuredSummary('##  주요  내용\n- a')).toBe(true);
    expect(looksLikeKoreanStructuredSummary('## 시사점')).toBe(true);
  });

  it('returns false for raw English RSS contentSnippet', () => {
    const text =
      "Chain of Custody for Digital Evidence: How to Prove Your Video Wasn't Faked An insurance adjuster receives dashcam footage from a policyholder claiming another driver ran a red light. The video looks authentic. The timestamp shows it was recorded before the claim was filed.";

    expect(looksLikeKoreanStructuredSummary(text)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(looksLikeKoreanStructuredSummary('')).toBe(false);
  });

  it('returns false for plain Korean prose without structured headings', () => {
    const text = 'AI 기술이 빠르게 발전하고 있습니다. 다양한 분야에서 응용되고 있습니다.';
    expect(looksLikeKoreanStructuredSummary(text)).toBe(false);
  });
});

describe('hasSelfReferentialOpening', () => {
  // Positive cases: these MUST be detected as self-referential
  it.each([
    ['이 콘텐츠는 AI 기술을 다룬다'],
    ['본 콘텐츠는 새로운 도구를 소개한다'],
    ['이 기사는 중요한 내용이다'],
    ['본 기사는 핵심 기술을 소개한다'],
    ['해당 기사는 분석 내용입니다'],
    ['이 글은 LLM을 설명한다'],
    ['본 글은 분석입니다'],
    ['해당 글은 추첵할 만한 내용이다'],
    ['이 아티클은 새 도구를 다룬다'],
    ['본 아티클은 핵심을 설명한다'],
    ['이 영상은 튜토리얼이다'],
    ['본 영상은 핵심을 다룬다'],
    ['이 포스트는 가이드다'],
    ['본 포스트는 가이드입니다'],
    ['이 뉴스는 놓칠 수 없다'],
    ['이 내용은 중요하다'],
    ['본 문서는 정리된 내용을 담는다'],
    // whitespace variations
    ['이  콘텐츠는 마지막 문장'], // double space
    ['이콘텐츠는 없으므로'], // no space at all
    // adjacent to leading whitespace
    ['   이 기사는 서부러 공백'],
  ])('detects self-referential opening in "%s"', (text) => {
    expect(hasSelfReferentialOpening(text)).toBe(true);
  });

  // Negative cases: these MUST NOT be flagged
  it.each([
    ['Vercel 블로그가 발표한 새 실험은 Next.js 16 API 대상 평가에서 높은 정확도를 기록했다'],
    ['AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석'],
    ['OpenAI의 새 API는 중요한 변화를 가져온다'],
    ['2026년 AI 동향을 살펴본다'],
    // "이" / "본" + non-article noun (not self-referential)
    ['이 기술은 혁신적이다'], // 기술 is the TOPIC, not the article
    ['본 프레임워크는 구성 요소가 많다'], // 프레임워크 is the topic
    ['이 제품은 출시되었다'], // 제품 is the topic
    ['이 회사는 생성형 AI에 집중한다'], // 회사 is the topic
    ['해당 연구는 새로운 방법론을 제시한다'], // 연구 is the topic
    // word boundary edge cases
    ['글자가 큰 폰트를 사용한다'], // 글자 starts with 글 but is different word
    ['자료산이 풍부한 국가의 경제 전략'], // 자료산 starts with 자료 but different word
    // empty/whitespace
    [''],
    ['   '],
    ['\n\n'],
  ])('does not flag non-self-referential text "%s"', (text) => {
    expect(hasSelfReferentialOpening(text)).toBe(false);
  });

  it('ignores markdown headings even if they contain the pattern', () => {
    // "## 이 기사" as a heading is unusual but not prose; ignored by rule
    const text = [
      '## 이 기사의 핵심',
      '',
      '주제에 대한 내용',
    ].join('\n');
    expect(hasSelfReferentialOpening(text)).toBe(false);
  });

  it('ignores bullet items even if they start with the pattern', () => {
    const text = [
      '## 주요 내용',
      '- 이 기사에서 언급된 포인트',
    ].join('\n');
    expect(hasSelfReferentialOpening(text)).toBe(false);
  });

  it('detects self-referential opening inside a ## 개요 section body', () => {
    const text = [
      '## 개요',
      '',
      '이 콘텐츠는 AI 도구를 소개한다',
      '',
      '## 주요 내용',
      '- 포인트',
    ].join('\n');
    expect(hasSelfReferentialOpening(text)).toBe(true);
  });

  it('detects self-referential opening inside a ## 시사점 section body', () => {
    const text = [
      '## 개요',
      '저자가 발표한 실험',
      '',
      '## 주요 내용',
      '- 포인트 1',
      '',
      '## 시사점',
      '본 기사는 중요한 통찰을 제공한다',
    ].join('\n');
    expect(hasSelfReferentialOpening(text)).toBe(true);
  });

  it('passes a clean structured summary with subject-first openings', () => {
    const text = [
      '## 개요',
      '',
      'Vercel이 발표한 새 실험은 AGENTS.md 구조가 Skills보다 높은 정확도를 보였음을 입증했다.',
      '',
      '## 주요 내용',
      '- AGENTS.md 접근법은 70% 통과율을 기록',
      '- Skills 접근법은 53% 통과율',
      '',
      '## 시사점',
      '예측 가능한 문서가 에이전트 성능을 높인다는 점에서 설계 관점을 제시한다.',
    ].join('\n');
    expect(hasSelfReferentialOpening(text)).toBe(false);
  });
});

describe('findArticlesNeedingSummary', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(CURATED_DIR, { recursive: true });
    await mkdir(FEEDS_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  async function writeArticle(dir: string, name: string, data: Record<string, unknown>): Promise<void> {
    await writeFile(join(dir, name), JSON.stringify(data, null, 2));
  }

  it('picks up articles with no description field', async () => {
    await writeArticle(FEEDS_DIR, 'a.json', {
      id: 'a',
      title: 'Article A',
      url: 'https://example.com/a',
    });

    const result = await findArticlesNeedingSummary(CURATED_DIR, FEEDS_DIR);

    expect(result).toHaveLength(1);
    expect(result[0].data.id).toBe('a');
  });

  it('picks up articles with raw English description (RSS leakage)', async () => {
    await writeArticle(FEEDS_DIR, 'b.json', {
      id: 'b',
      title: 'Article B',
      url: 'https://example.com/b',
      description:
        'Chain of Custody for Digital Evidence: How to Prove Your Video Wasn\'t Faked. An insurance adjuster receives dashcam footage from a policyholder.',
    });

    const result = await findArticlesNeedingSummary(CURATED_DIR, FEEDS_DIR);

    expect(result).toHaveLength(1);
    expect(result[0].data.id).toBe('b');
  });

  it('skips articles with valid Korean structured summary', async () => {
    await writeArticle(FEEDS_DIR, 'c.json', {
      id: 'c',
      title: 'Article C',
      url: 'https://example.com/c',
      description: '## 개요\n로컬 비주얼 에디터\n\n## 주요 내용\n- 포인트 1\n\n## 시사점\n결론',
    });

    const result = await findArticlesNeedingSummary(CURATED_DIR, FEEDS_DIR);

    expect(result).toHaveLength(0);
  });

  it('skips articles with structured summary missing 개요 heading', async () => {
    await writeArticle(FEEDS_DIR, 'd.json', {
      id: 'd',
      title: 'Article D',
      url: 'https://example.com/d',
      description:
        'Dance of Tal 기반의 로컬 비주얼 에디터\n\n## 주요 내용\n- TypeScript 기반\n\n## 시사점\n에이전트 오케스트레이션 표준화',
    });

    const result = await findArticlesNeedingSummary(CURATED_DIR, FEEDS_DIR);

    expect(result).toHaveLength(0);
  });

  it('skips articles missing url even if description is missing', async () => {
    await writeArticle(FEEDS_DIR, 'e.json', {
      id: 'e',
      title: 'Article E',
      // url intentionally missing
    });

    const result = await findArticlesNeedingSummary(CURATED_DIR, FEEDS_DIR);

    expect(result).toHaveLength(0);
  });

  it('processes curated articles only when description is empty (preserves user-authored descriptions)', async () => {
    // Curated는 사용자가 직접 적은 곧이므로 재요약 대상이 아니다.
    // description이 완전히 없을 때만 첫 생성으로 잡는다.
    await writeArticle(CURATED_DIR, 'curated-empty.json', {
      id: 'curated-empty',
      title: 'Curated with empty description',
      url: 'https://example.com/curated-empty',
      // description 없음
    });
    await writeArticle(CURATED_DIR, 'curated-short-en.json', {
      id: 'curated-short-en',
      title: 'Curated with short English description',
      url: 'https://example.com/curated-short-en',
      description: 'multica: Managed platform running coding agents as real team members',
    });
    await writeArticle(CURATED_DIR, 'curated-short-ko.json', {
      id: 'curated-short-ko',
      title: 'Curated with short Korean description',
      url: 'https://example.com/curated-short-ko',
      description: '쇼트 한 줄짜리 사용자 설명',
    });

    await writeArticle(FEEDS_DIR, 'feed-leak.json', {
      id: 'feed-leak',
      title: 'Feed with leaked English RSS content',
      url: 'https://example.com/feed-leak',
      description: 'Raw English text from RSS feed without Korean structured headings.',
    });
    await writeArticle(FEEDS_DIR, 'feed-good.json', {
      id: 'feed-good',
      title: 'Feed already correctly summarized',
      url: 'https://example.com/feed-good',
      description: '## 주요 내용\n- 포인트',
    });

    const result = await findArticlesNeedingSummary(CURATED_DIR, FEEDS_DIR);
    const ids = result.map((a) => a.data.id).sort();

    // 재요약 대상: curated-empty (비어있으니 첫 생성) + feed-leak (영문 누수)
    // 보호됨: curated-short-en, curated-short-ko (사용자 입력), feed-good (이미 정상)
    expect(ids).toEqual(['curated-empty', 'feed-leak']);
  });

  it('NEVER overwrites user-authored curated descriptions even when they look like raw English', async () => {
    // 이번 회귀 방지의 핵심 테스트.
    // 사용자가 curated에 직접 적은 description이 우연히 영문이고 구조화 형식이 아니더라도
    // 절대 덮어쓰면 안 된다. (명시적 사용자 동의 없이 데이터 변경 금지)
    await writeArticle(CURATED_DIR, 'user-pasted-english.json', {
      id: 'user-pasted-english',
      title: 'User pasted English snippet',
      url: 'https://example.com/user-en',
      description:
        'OAuth vs. API Keys for Agentic AI. This blog was originally published on Descope. If you\'re a senior developer or architect, you\'ve likely weighed the OAuth vs. API key tradeoffs.',
    });

    const result = await findArticlesNeedingSummary(CURATED_DIR, FEEDS_DIR);

    expect(result).toHaveLength(0);
  });

  it('handles malformed JSON files gracefully', async () => {
    await writeFile(join(FEEDS_DIR, 'broken.json'), '{ not valid json');
    await writeArticle(FEEDS_DIR, 'good.json', {
      id: 'good',
      title: 'Good',
      url: 'https://example.com/good',
    });

    const result = await findArticlesNeedingSummary(CURATED_DIR, FEEDS_DIR);

    expect(result).toHaveLength(1);
    expect(result[0].data.id).toBe('good');
  });
});

describe('clearStaleDescription', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(FEEDS_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('removes the description field when called on stale article', async () => {
    const filePath = join(FEEDS_DIR, 'stale.json');
    const data = {
      id: 'stale',
      title: 'Stale article',
      url: 'https://example.com/stale',
      description: 'Long raw English RSS contentSnippet that is not Korean structured summary.',
    };
    await writeFile(filePath, JSON.stringify(data, null, 2));

    await clearStaleDescription(filePath, data);

    const updated = JSON.parse(await readFile(filePath, 'utf-8'));
    expect(updated.description).toBeUndefined();
    // Other fields preserved
    expect(updated.id).toBe('stale');
    expect(updated.title).toBe('Stale article');
    expect(updated.url).toBe('https://example.com/stale');
  });

  it('is a no-op when description is already missing', async () => {
    const filePath = join(FEEDS_DIR, 'empty.json');
    const data = {
      id: 'empty',
      title: 'No description article',
      url: 'https://example.com/empty',
    };
    await writeFile(filePath, JSON.stringify(data, null, 2));

    await clearStaleDescription(filePath, data);

    const updated = JSON.parse(await readFile(filePath, 'utf-8'));
    // File should be unchanged structurally
    expect(updated.description).toBeUndefined();
    expect(updated.id).toBe('empty');
  });
});

describe('findArticlesNeedingSummary (self-referential backfill)', () => {
  // Separate describe block to verify feed articles with existing
  // self-referential openings are re-queued for re-summarization.
  const BACKFILL_TEST_DIR = join(ROOT, 'tests/tmp-backfill-test');
  const BACKFILL_CURATED_DIR = join(BACKFILL_TEST_DIR, 'curated');
  const BACKFILL_FEEDS_DIR = join(BACKFILL_TEST_DIR, 'feeds');

  beforeEach(async () => {
    await rm(BACKFILL_TEST_DIR, { recursive: true, force: true });
    await mkdir(BACKFILL_CURATED_DIR, { recursive: true });
    await mkdir(BACKFILL_FEEDS_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(BACKFILL_TEST_DIR, { recursive: true, force: true });
  });

  async function writeArticle(dir: string, name: string, data: Record<string, unknown>): Promise<void> {
    await writeFile(join(dir, name), JSON.stringify(data, null, 2));
  }

  it('picks up feed articles with self-referential opening (backfill existing bad summaries)', async () => {
    // Existing feed summaries already containing "이 콘텐츠는" must be re-queued
    // so the fix applies retroactively, not only to new articles.
    await writeArticle(BACKFILL_FEEDS_DIR, 'self-ref.json', {
      id: 'self-ref',
      title: 'Article with self-referential opening',
      url: 'https://example.com/self-ref',
      description: [
        '## 개요',
        '',
        '이 콘텐츠는 AI 도구를 소개한다',
        '',
        '## 주요 내용',
        '- 포인트 1',
        '',
        '## 시사점',
        '중요한 통찰을 제공한다',
      ].join('\n'),
    });

    const result = await findArticlesNeedingSummary(BACKFILL_CURATED_DIR, BACKFILL_FEEDS_DIR);

    expect(result).toHaveLength(1);
    expect(result[0].data.id).toBe('self-ref');
  });

  it('picks up feed articles when ONLY the 시사점 section has a self-referential opening', async () => {
    // Validates the regex catches openings in any section body, not only 개요
    await writeArticle(BACKFILL_FEEDS_DIR, 'sijachom-ref.json', {
      id: 'sijachom-ref',
      title: 'Only 시사점 is self-referential',
      url: 'https://example.com/sijachom-ref',
      description: [
        '## 개요',
        '',
        'Vercel이 발표한 실험',
        '',
        '## 주요 내용',
        '- 포인트 1',
        '',
        '## 시사점',
        '본 기사는 중요한 통찰을 제공한다',
      ].join('\n'),
    });

    const result = await findArticlesNeedingSummary(BACKFILL_CURATED_DIR, BACKFILL_FEEDS_DIR);

    expect(result).toHaveLength(1);
    expect(result[0].data.id).toBe('sijachom-ref');
  });

  it('NEVER picks up curated articles with self-referential opening (user-authored preserved)', async () => {
    // Even if a curated description starts with "이 기사는", it is user input.
    // allowResummarize=false protects it from any Gemini overwrite.
    await writeArticle(BACKFILL_CURATED_DIR, 'user-self-ref.json', {
      id: 'user-self-ref',
      title: 'User wrote self-referential intentionally',
      url: 'https://example.com/user-self-ref',
      description: '이 기사는 사용자가 직접 적은 내용이다',
    });

    const result = await findArticlesNeedingSummary(BACKFILL_CURATED_DIR, BACKFILL_FEEDS_DIR);

    expect(result).toHaveLength(0);
  });

  it('does NOT pick up feed articles with clean subject-first opening', async () => {
    // Regression guard: clean summaries must not be re-queued
    await writeArticle(BACKFILL_FEEDS_DIR, 'clean.json', {
      id: 'clean',
      title: 'Clean article',
      url: 'https://example.com/clean',
      description: [
        '## 개요',
        '',
        'Vercel이 발표한 실험은 AGENTS.md 구조의 우수성을 입증했다',
        '',
        '## 주요 내용',
        '- 포인트 1',
        '',
        '## 시사점',
        '문서 기반 접근의 실용성을 검증',
      ].join('\n'),
    });

    const result = await findArticlesNeedingSummary(BACKFILL_CURATED_DIR, BACKFILL_FEEDS_DIR);

    expect(result).toHaveLength(0);
  });
});

describe('summarizeArticles (integration)', () => {
  const INT_TEST_DIR = join(ROOT, 'tests/tmp-integration');
  const INT_CURATED_DIR = join(INT_TEST_DIR, 'curated');
  const INT_FEEDS_DIR = join(INT_TEST_DIR, 'feeds');

  beforeEach(async () => {
    await rm(INT_TEST_DIR, { recursive: true, force: true });
    await mkdir(INT_CURATED_DIR, { recursive: true });
    await mkdir(INT_FEEDS_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(INT_TEST_DIR, { recursive: true, force: true });
  });

  it('rejects Gemini response starting with self-referential opening and clears stale description', async () => {
    const filePath = join(INT_FEEDS_DIR, 'test.json');
    await writeFile(
      filePath,
      JSON.stringify({ id: 'test', title: 'Test Article', url: 'https://example.com/test' }, null, 2),
    );

    const mockFetch = async () => 'A'.repeat(500);
    const mockGenerate = async () =>
      [
        '## 개요',
        '이 기사는 중요한 내용을 다룬다',
        '',
        '## 주요 내용',
        '- 포인트 1',
        '',
        '## 시사점',
        '결론',
      ].join('\n');

    const result = await summarizeArticles({
      curatedDir: INT_CURATED_DIR,
      feedsDir: INT_FEEDS_DIR,
      apiKey: 'fake-key',
      fetchContentFn: mockFetch,
      generateSummaryFn: mockGenerate,
      maxArticles: 1,
    });

    expect(result.updated).toBe(0);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some((e) => e.includes('Rejected self-referential opening'))).toBe(true);

    // File description should be cleared so it gets re-queued next run
    const updated = JSON.parse(await readFile(filePath, 'utf-8'));
    expect(updated.description).toBeUndefined();
  }, 30_000);

  it('accepts Gemini response with subject-first opening and writes summary', async () => {
    const filePath = join(INT_FEEDS_DIR, 'test.json');
    await writeFile(
      filePath,
      JSON.stringify({ id: 'test', title: 'Test Article', url: 'https://example.com/test' }, null, 2),
    );

    const cleanSummary = [
      '## 개요',
      'Vercel이 발표한 실험은 AGENTS.md 구조가 높은 정확도를 보였음을 입증했다',
      '',
      '## 주요 내용',
      '- AGENTS.md 접근법은 70% 통과율',
      '',
      '## 시사점',
      '항상 보이는 문서가 성능을 높인다',
    ].join('\n');

    const result = await summarizeArticles({
      curatedDir: INT_CURATED_DIR,
      feedsDir: INT_FEEDS_DIR,
      apiKey: 'fake-key',
      fetchContentFn: async () => 'A'.repeat(500),
      generateSummaryFn: async () => cleanSummary,
      maxArticles: 1,
    });

    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(0);

    const updated = JSON.parse(await readFile(filePath, 'utf-8'));
    expect(updated.description).toBe(cleanSummary);
  }, 30_000);

  it('skips curated articles with non-empty description even when self-referential', async () => {
    // Defense: even though user-written curated description has "이 기사는",
    // allowResummarize=false means summarizeArticles never touches it.
    const filePath = join(INT_CURATED_DIR, 'user.json');
    await writeFile(
      filePath,
      JSON.stringify(
        {
          id: 'user',
          title: 'User authored',
          url: 'https://example.com/user',
          description: '이 기사는 사용자가 적은 설명',
        },
        null,
        2,
      ),
    );

    let generateCallCount = 0;
    const result = await summarizeArticles({
      curatedDir: INT_CURATED_DIR,
      feedsDir: INT_FEEDS_DIR,
      apiKey: 'fake-key',
      fetchContentFn: async () => 'A'.repeat(500),
      generateSummaryFn: async () => {
        generateCallCount += 1;
        return 'never called';
      },
      maxArticles: 1,
    });

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(generateCallCount).toBe(0); // Gemini never invoked for curated with description

    // User's description must remain untouched
    const preserved = JSON.parse(await readFile(filePath, 'utf-8'));
    expect(preserved.description).toBe('이 기사는 사용자가 적은 설명');
  }, 30_000);
});
