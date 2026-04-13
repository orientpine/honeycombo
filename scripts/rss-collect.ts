#!/usr/bin/env bun

import Parser from 'rss-parser';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { feedArticleSchema, type FeedArticle } from '../src/schemas/feed-article';
import { listJsonFiles } from './utils/list-json-files';

const ROOT = process.cwd();
const FEEDS_CONFIG = join(ROOT, 'src/config/feeds.json');
const SPAM_KEYWORDS_PATH = join(ROOT, 'src/config/spam-keywords.json');
const AI_KEYWORDS_PATH = join(ROOT, 'src/config/ai-keywords.json');
const FEEDS_OUTPUT_DIR = join(ROOT, 'src/data/feeds');
const MAX_ARTICLES_PER_RUN = 50;
const FEED_TIMEOUT_MS = 30_000;
const FETCH_RETRIES = 1;

export interface FeedConfig {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
}

type ParsedFeed = Awaited<ReturnType<Parser['parseURL']>>;

export interface CollectFeedsOptions {
  feedsConfigPath?: string;
  spamKeywordsPath?: string;
  aiKeywordsPath?: string;
  outputDir?: string;
  parser?: Parser;
  now?: Date;
  fetchFeedData?: (feedConfig: FeedConfig, parser: Parser) => Promise<ParsedFeed>;
}

export interface CollectFeedsResult {
  saved: number;
  skipped: number;
  errors: string[];
}

export function generateId(title: string, url: string): string {
  return createHash('sha256').update(`${title}${url}`).digest('hex').slice(0, 16);
}

export function truncateText(value: string | undefined, max: number): string {
  if (!value) {
    return '';
  }

  const clean = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) {
    return clean;
  }

  return `${clean.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

export function isSpam(title: string, description: string, keywords: string[]): boolean {
  const haystack = `${title} ${description}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

export function isAIRelated(title: string, description: string, tags: string[], keywords: string[]): boolean {
  const haystack = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
  return keywords.some((keyword) => {
    const kw = keyword.toLowerCase();
    // Short keywords (<=3 chars) use word-boundary matching to avoid
    // false positives (e.g. "ai" matching "email", "rag" matching "storage").
    if (kw.length <= 3) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`).test(haystack);
    }
    return haystack.includes(kw);
  });
}

function toIsoDate(value: string | undefined, now: Date): string {
  if (!value) {
    return now.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return now.toISOString();
  }

  return parsed.toISOString();
}

export function normalizeFeedItem(
  item: ParsedFeed['items'][number],
  feedConfig: FeedConfig,
  now = new Date(),
): FeedArticle | null {
  const title = truncateText(item.title, 200);
  const url = item.link || item.guid || '';

  if (!title || !url) {
    return null;
  }

  const description = truncateText(item.contentSnippet || item.content || item.summary, 1000);
  const baseTags = [feedConfig.category];
  const itemTags = (item.categories || []).map((category) => String(category).toLowerCase());
  const tags = [...new Set([...baseTags, ...itemTags])].slice(0, 5);
  const thumbnailUrl =
    typeof (item as { enclosure?: { url?: unknown } }).enclosure?.url === 'string'
      ? (item as { enclosure?: { url?: string } }).enclosure?.url
      : undefined;

  return feedArticleSchema.parse({
    id: generateId(title, url),
    title,
    url,
    source: feedConfig.name,
    type: 'article',
    thumbnail_url: thumbnailUrl,
    description: description || undefined,
    tags,
    published_at: toIsoDate(item.pubDate, now),
    feed_id: feedConfig.id,
  });
}

export async function loadExistingIds(outputDir = FEEDS_OUTPUT_DIR): Promise<Set<string>> {
  const ids = new Set<string>();
  const files = await listJsonFiles(outputDir);

  for (const filePath of files) {
    try {
      const content = JSON.parse(await readFile(filePath, 'utf-8')) as { id?: unknown };
      if (typeof content.id === 'string' && content.id.length > 0) {
        ids.add(content.id);
      }
    } catch (error) {
      console.warn(`Failed to read existing feed JSON: ${filePath}`, error);
    }
  }

  return ids;
}

export async function loadSpamKeywords(spamKeywordsPath = SPAM_KEYWORDS_PATH): Promise<string[]> {
  try {
    const content = await readFile(spamKeywordsPath, 'utf-8');
    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch (error) {
    console.warn(`Failed to load spam keywords: ${spamKeywordsPath}`, error);
    return [];
  }
}

export async function loadAIKeywords(aiKeywordsPath = AI_KEYWORDS_PATH): Promise<string[]> {
  try {
    const content = await readFile(aiKeywordsPath, 'utf-8');
    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch (error) {
    console.warn(`Failed to load AI keywords: ${aiKeywordsPath}`, error);
    return [];
  }
}

async function fetchFeedData(feedConfig: FeedConfig, parser: Parser): Promise<ParsedFeed> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    try {
      return await parser.parseURL(feedConfig.url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function fetchFeedArticles(
  feedConfig: FeedConfig,
  parser: Parser,
  now = new Date(),
  fetcher: (feedConfig: FeedConfig, parser: Parser) => Promise<ParsedFeed> = fetchFeedData,
): Promise<FeedArticle[]> {
  const feed = await fetcher(feedConfig, parser);

  return (feed.items || [])
    .slice(0, MAX_ARTICLES_PER_RUN)
    .map((item) => normalizeFeedItem(item, feedConfig, now))
    .filter((article): article is FeedArticle => article !== null);
}

export async function saveArticle(article: FeedArticle, outputDir = FEEDS_OUTPUT_DIR): Promise<string> {
  const publishedAt = new Date(article.published_at);
  const year = publishedAt.getUTCFullYear();
  const month = String(publishedAt.getUTCMonth() + 1).padStart(2, '0');
  const directory = join(outputDir, String(year), month);
  const filePath = join(directory, `${article.id}.json`);

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(article, null, 2)}\n`, 'utf-8');

  return filePath;
}

export async function collectFeeds(options: CollectFeedsOptions = {}): Promise<CollectFeedsResult> {
  const {
    feedsConfigPath = FEEDS_CONFIG,
    spamKeywordsPath = SPAM_KEYWORDS_PATH,
    aiKeywordsPath = AI_KEYWORDS_PATH,
    outputDir = FEEDS_OUTPUT_DIR,
    parser = new Parser({ timeout: FEED_TIMEOUT_MS }),
    now = new Date(),
    fetchFeedData: customFetchFeedData,
  } = options;

  const feedConfigs = JSON.parse(await readFile(feedsConfigPath, 'utf-8')) as FeedConfig[];
  const enabledFeeds = feedConfigs.filter((feed) => feed.enabled);
  const existingIds = await loadExistingIds(outputDir);
  const spamKeywords = await loadSpamKeywords(spamKeywordsPath);
  const aiKeywords = await loadAIKeywords(aiKeywordsPath);

  let saved = 0;
  let skipped = 0;
  const errors: string[] = [];

  const results = await Promise.allSettled(
    enabledFeeds.map((feed) => fetchFeedArticles(feed, parser, now, customFetchFeedData ?? fetchFeedData)),
  );

  for (const [index, result] of results.entries()) {
    const feed = enabledFeeds[index];

    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      const message = `Skipped feed ${feed.id}: ${reason}`;
      console.error(message);
      errors.push(message);
      continue;
    }

    for (const article of result.value) {
      if (existingIds.has(article.id)) {
        skipped += 1;
        continue;
      }

      if (isSpam(article.title, article.description ?? '', spamKeywords)) {
        console.warn(`Spam filtered: ${article.title}`);
        skipped += 1;
        continue;
      }

      if (aiKeywords.length > 0 && !isAIRelated(article.title, article.description ?? '', article.tags, aiKeywords)) {
        skipped += 1;
        continue;
      }

      await saveArticle(article, outputDir);
      existingIds.add(article.id);
      saved += 1;
    }
  }

  return { saved, skipped, errors };
}

if (import.meta.main) {
  const result = await collectFeeds();
  console.log(`✅ RSS collection complete: ${result.saved} saved, ${result.skipped} skipped`);

  if (result.errors.length > 0) {
    console.error(`⚠️  ${result.errors.length} feed(s) failed`);
  }
}
