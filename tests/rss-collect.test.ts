import Parser from 'rss-parser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  collectFeeds,
  generateId,
  isSpam,
  normalizeFeedItem,
  truncateText,
  type FeedConfig,
} from '../scripts/rss-collect';

const ROOT = process.cwd();
const TEST_DIR = join(ROOT, 'tests/tmp-rss-test');
const OUTPUT_DIR = join(TEST_DIR, 'output');
const FEEDS_CONFIG_PATH = join(TEST_DIR, 'feeds.json');
const SPAM_KEYWORDS_PATH = join(TEST_DIR, 'spam-keywords.json');
const VALID_RSS_PATH = join(ROOT, 'tests/fixtures/valid-rss.xml');
const MALFORMED_RSS_PATH = join(ROOT, 'tests/fixtures/malformed-rss.xml');

const TEST_FEED: FeedConfig = {
  id: 'test-feed',
  name: 'Test Feed',
  url: 'https://example.com/rss.xml',
  category: 'tech',
  enabled: true,
};

async function readJson(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(join(OUTPUT_DIR, relativePath), 'utf-8')) as unknown;
}

describe('rss-collect', () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(FEEDS_CONFIG_PATH, JSON.stringify([TEST_FEED], null, 2));
    await writeFile(SPAM_KEYWORDS_PATH, JSON.stringify(['viral', 'buy now'], null, 2));
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('generates consistent IDs from title and url', () => {
    const first = generateId('AI Breakthrough', 'https://example.com/story');
    const second = generateId('AI Breakthrough', 'https://example.com/story');

    expect(first).toBe(second);
    expect(first).toHaveLength(16);
  });

  it('truncates html content to schema limits', () => {
    const result = truncateText(`<p>${'a'.repeat(210)}</p>`, 200);

    expect(result).toHaveLength(200);
    expect(result.endsWith('...')).toBe(true);
    expect(result.includes('<p>')).toBe(false);
  });

  it('normalizes parsed feed items into feed article shape', async () => {
    const parser = new Parser();
    const xml = await readFile(VALID_RSS_PATH, 'utf-8');
    const parsed = await parser.parseString(xml);
    const article = normalizeFeedItem(parsed.items[0], TEST_FEED, new Date('2026-04-10T12:00:00.000Z'));

    expect(article).not.toBeNull();
    expect(article).toMatchObject({
      title: 'AI Breakthrough in 2026',
      url: 'https://example.com/ai-breakthrough',
      source: 'Test Feed',
      type: 'article',
      feed_id: 'test-feed',
      tags: ['tech', 'ai'],
    });
    expect(article?.published_at.toISOString()).toBe('2026-04-10T08:00:00.000Z');
  });

  it('collects fixture articles, saves files, and deduplicates on repeat runs', async () => {
    const parser = new Parser();
    const xml = await readFile(VALID_RSS_PATH, 'utf-8');

    const firstRun = await collectFeeds({
      feedsConfigPath: FEEDS_CONFIG_PATH,
      spamKeywordsPath: SPAM_KEYWORDS_PATH,
      outputDir: OUTPUT_DIR,
      parser,
      now: new Date('2026-04-10T12:00:00.000Z'),
      fetchFeedData: async () => parser.parseString(xml),
    });

    expect(firstRun).toEqual({ saved: 2, skipped: 0, errors: [] });

    const firstId = generateId('AI Breakthrough in 2026', 'https://example.com/ai-breakthrough');
    const secondId = generateId('New JavaScript Framework Released', 'https://example.com/new-js-framework');

    expect(await readJson(`2026/04/${firstId}.json`)).toMatchObject({
      id: firstId,
      title: 'AI Breakthrough in 2026',
    });
    expect(await readJson(`2026/04/${secondId}.json`)).toMatchObject({
      id: secondId,
      title: 'New JavaScript Framework Released',
    });

    const secondRun = await collectFeeds({
      feedsConfigPath: FEEDS_CONFIG_PATH,
      spamKeywordsPath: SPAM_KEYWORDS_PATH,
      outputDir: OUTPUT_DIR,
      parser,
      now: new Date('2026-04-10T12:00:00.000Z'),
      fetchFeedData: async () => parser.parseString(xml),
    });

    expect(secondRun).toEqual({ saved: 0, skipped: 2, errors: [] });
  });

  it('filters spam articles before saving', async () => {
    const parser = new Parser();
    const spamXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Spam Feed</title>
          <item>
            <title>Viral buy now AI secret</title>
            <link>https://example.com/spam</link>
            <description>Buy now for a viral secret.</description>
            <pubDate>Fri, 10 Apr 2026 08:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    const result = await collectFeeds({
      feedsConfigPath: FEEDS_CONFIG_PATH,
      spamKeywordsPath: SPAM_KEYWORDS_PATH,
      outputDir: OUTPUT_DIR,
      parser,
      fetchFeedData: async () => parser.parseString(spamXml),
    });

    expect(result).toEqual({ saved: 0, skipped: 1, errors: [] });
    expect(isSpam('Viral buy now AI secret', 'Buy now for a viral secret.', ['viral', 'buy now'])).toBe(true);
  });

  it('handles malformed RSS without crashing', async () => {
    const parser = new Parser();
    const malformedXml = await readFile(MALFORMED_RSS_PATH, 'utf-8');

    const result = await collectFeeds({
      feedsConfigPath: FEEDS_CONFIG_PATH,
      spamKeywordsPath: SPAM_KEYWORDS_PATH,
      outputDir: OUTPUT_DIR,
      parser,
      fetchFeedData: async () => parser.parseString(malformedXml),
    });

    expect(result.saved).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Skipped feed test-feed');
  });
});
