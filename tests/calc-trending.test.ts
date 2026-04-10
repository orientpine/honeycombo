import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { calculateTrending, getWeekNumber, type Article, type RankingOverrides } from '../scripts/calc-trending';

const ROOT = process.cwd();
const TEST_DIR = join(ROOT, 'tests/tmp-calc-trending');
const OVERRIDES_PATH = join(TEST_DIR, 'ranking-overrides.json');
const NOW = new Date('2026-04-10T12:00:00.000Z');

const defaultOverrides: RankingOverrides = {
  week: '',
  pin: [],
  suppress: [],
  boost: {},
  audit_log: [],
};

function mockArticles(count: number, tags: string[][]): Article[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `article-${index}`,
    title: `Article ${index}`,
    url: `https://example.com/${index}`,
    tags: tags[index % tags.length] || ['general'],
    submitted_at: NOW.toISOString(),
  }));
}

async function writeOverrides(overrides: Partial<RankingOverrides> = {}): Promise<void> {
  const merged = {
    ...defaultOverrides,
    ...overrides,
    boost: { ...defaultOverrides.boost, ...(overrides.boost ?? {}) },
    audit_log: overrides.audit_log ?? defaultOverrides.audit_log,
  } satisfies RankingOverrides;

  await writeFile(OVERRIDES_PATH, JSON.stringify(merged, null, 2));
}

describe('calculateTrending', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
    await writeOverrides();
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('returns not_enough_data when fewer than 20 articles', async () => {
    const articles = mockArticles(5, [['AI'], ['LLM']]);
    const result = await calculateTrending(articles, OVERRIDES_PATH, NOW);

    expect(result.not_enough_data).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it('calculates ranking with sufficient articles', async () => {
    const tags = [['AI'], ['AI'], ['AI'], ['LLM'], ['LLM'], ['startup']];
    const articles = mockArticles(30, tags);
    const result = await calculateTrending(articles, OVERRIDES_PATH, NOW);

    expect(result.not_enough_data).toBeUndefined();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.keyword).toBe('ai');
    expect(result.items[0]?.rank).toBe(1);
  });

  it('assigns sequential ranks', async () => {
    const tags = [['AI'], ['LLM'], ['startup'], ['web'], ['rust']];
    const articles = mockArticles(25, tags);
    const result = await calculateTrending(articles, OVERRIDES_PATH, NOW);

    result.items.forEach((item, index) => {
      expect(item.rank).toBe(index + 1);
    });
  });

  it('includes article_count and top_articles', async () => {
    const articles = mockArticles(25, [['AI', 'LLM']]);
    const result = await calculateTrending(articles, OVERRIDES_PATH, NOW);

    const aiItem = result.items.find((item) => item.keyword === 'ai');
    expect(aiItem).toBeDefined();
    expect(aiItem?.article_count).toBeGreaterThan(0);
    expect(Array.isArray(aiItem?.top_articles)).toBe(true);
  });

  it('generates week string in YYYY-WNN format', async () => {
    const articles = mockArticles(25, [['AI']]);
    const result = await calculateTrending(articles, OVERRIDES_PATH, NOW);

    expect(result.week).toBe(getWeekNumber(NOW));
    expect(result.week).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('applies pin, suppress, and boost overrides', async () => {
    const articles = mockArticles(30, [['AI'], ['AI'], ['LLM'], ['startup'], ['startup'], ['startup']]);
    await writeOverrides({
      week: getWeekNumber(NOW),
      pin: ['llm'],
      suppress: ['startup'],
      boost: { ai: 1.5 },
    });

    const result = await calculateTrending(articles, OVERRIDES_PATH, NOW);

    expect(result.items[0]?.keyword).toBe('llm');
    expect(result.items.some((item) => item.keyword === 'startup')).toBe(false);
    expect(result.items.find((item) => item.keyword === 'ai')?.score).toBeGreaterThan(0);
  });
});
