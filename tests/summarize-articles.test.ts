import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  findArticlesNeedingSummary,
  looksLikeKoreanStructuredSummary,
} from '../scripts/summarize-articles';

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

  it('processes both curated and feed directories', async () => {
    await writeArticle(CURATED_DIR, 'curated-a.json', {
      id: 'curated-a',
      title: 'Curated A',
      url: 'https://example.com/curated-a',
    });
    await writeArticle(FEEDS_DIR, 'feed-a.json', {
      id: 'feed-a',
      title: 'Feed A',
      url: 'https://example.com/feed-a',
      description: 'Raw English text from RSS feed without Korean structured headings.',
    });
    await writeArticle(FEEDS_DIR, 'feed-b.json', {
      id: 'feed-b',
      title: 'Feed B (already summarized)',
      url: 'https://example.com/feed-b',
      description: '## 주요 내용\n- 포인트',
    });

    const result = await findArticlesNeedingSummary(CURATED_DIR, FEEDS_DIR);
    const ids = result.map((a) => a.data.id).sort();

    expect(ids).toEqual(['curated-a', 'feed-a']);
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
