#!/usr/bin/env bun

import { existsSync } from 'fs';
import { mkdir, readFile, readdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { trendingSchema, type Trending } from '../src/schemas/trending';

const ROOT = process.cwd();
const TRENDING_DIR = join(ROOT, 'src/data/trending');
const OVERRIDES_PATH = join(ROOT, 'src/config/ranking-overrides.json');
const CURATED_DIR = join(ROOT, 'src/content/curated');
const FEEDS_DIR = join(ROOT, 'src/data/feeds');
export const MIN_ARTICLES_FOR_TRENDING = 20;

export interface Article {
  id: string;
  title: string;
  url: string;
  tags: string[];
  published_at?: string;
  submitted_at?: string;
}

export interface RankingOverrides {
  week: string;
  pin: string[];
  suppress: string[];
  boost: Record<string, number>;
  audit_log: Array<{ action: string; topic: string; by: string; reason: string; timestamp: string }>;
}

export interface TrendingItem {
  rank: number;
  keyword: string;
  score: number;
  direction: 'rising' | 'stable' | 'falling';
  velocity: number;
  article_count: number;
  top_articles: string[];
}

export interface TrendingResult {
  week: string;
  items: TrendingItem[];
  not_enough_data?: boolean;
}

interface TagAggregate {
  count: number;
  articles: string[];
}

function normalizeKeyword(value: string): string {
  return value.toLowerCase().trim();
}

export function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

async function listJsonFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) {
    return [];
  }

  const files: string[] = [];
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.json') {
      continue;
    }

    const parentPath = 'parentPath' in entry ? entry.parentPath : undefined;
    const basePath = typeof parentPath === 'string' ? parentPath : dir;
    files.push(join(basePath, entry.name));
  }

  return files;
}

function isRecentArticle(article: Article, now: Date): boolean {
  const dateStr = article.published_at || article.submitted_at;
  if (!dateStr) {
    return false;
  }

  const articleDate = new Date(dateStr);
  if (Number.isNaN(articleDate.getTime())) {
    return false;
  }

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  return articleDate >= sevenDaysAgo;
}

export async function loadAllArticles(now = new Date()): Promise<Article[]> {
  const articles: Article[] = [];

  for (const dir of [CURATED_DIR, FEEDS_DIR]) {
    const files = await listJsonFiles(dir);

    for (const filePath of files) {
      try {
        const parsed = JSON.parse(await readFile(filePath, 'utf-8')) as Article;
        if (isRecentArticle(parsed, now)) {
          articles.push(parsed);
        }
      } catch {
        // Skip unreadable JSON files while collecting recent articles.
      }
    }
  }

  return articles;
}

async function loadOverrides(overridesPath: string): Promise<RankingOverrides> {
  try {
    const parsed = JSON.parse(await readFile(overridesPath, 'utf-8')) as Partial<RankingOverrides>;
    return {
      week: typeof parsed.week === 'string' ? parsed.week : '',
      pin: Array.isArray(parsed.pin) ? parsed.pin.map(normalizeKeyword).filter(Boolean) : [],
      suppress: Array.isArray(parsed.suppress) ? parsed.suppress.map(normalizeKeyword).filter(Boolean) : [],
      boost:
        parsed.boost && typeof parsed.boost === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.boost).flatMap(([key, value]) =>
                typeof value === 'number' && Number.isFinite(value) ? [[normalizeKeyword(key), value]] : [],
              ),
            )
          : {},
      audit_log: Array.isArray(parsed.audit_log)
        ? parsed.audit_log.filter(
            (entry): entry is RankingOverrides['audit_log'][number] =>
              typeof entry === 'object' &&
              entry !== null &&
              typeof entry.action === 'string' &&
              typeof entry.topic === 'string' &&
              typeof entry.by === 'string' &&
              typeof entry.reason === 'string' &&
              typeof entry.timestamp === 'string',
          )
        : [],
    };
  } catch {
    return { week: '', pin: [], suppress: [], boost: {}, audit_log: [] };
  }
}

function shouldApplyOverrides(overrides: RankingOverrides, week: string): boolean {
  return overrides.week === '' || overrides.week === week;
}

function calculateScore(data: TagAggregate, totalArticles: number, boostMultiplier: number): number {
  const sourceCount = new Set(data.articles).size;
  const rawScore =
    (data.count * 0.3 + sourceCount * 0.3 + ((data.count / totalArticles) * 100) * 0.4) * boostMultiplier;
  return Math.round(rawScore * 100) / 100;
}

export async function calculateTrending(
  articles?: Article[],
  overridesPath = OVERRIDES_PATH,
  now = new Date(),
): Promise<TrendingResult> {
  const allArticles = articles ?? (await loadAllArticles(now));
  const week = getWeekNumber(now);

  if (allArticles.length < MIN_ARTICLES_FOR_TRENDING) {
    return { week, items: [], not_enough_data: true };
  }

  const overrides = await loadOverrides(overridesPath);
  const activeOverrides = shouldApplyOverrides(overrides, week)
    ? overrides
    : { week: overrides.week, pin: [], suppress: [], boost: {}, audit_log: overrides.audit_log };

  const tagCounts = new Map<string, TagAggregate>();
  for (const article of allArticles) {
    const uniqueTags = [...new Set((article.tags || []).map(normalizeKeyword).filter(Boolean))];
    for (const tag of uniqueTags) {
      const existing = tagCounts.get(tag) ?? { count: 0, articles: [] };
      existing.count += 1;
      if (existing.articles.length < 5) {
        existing.articles.push(article.id);
      }
      tagCounts.set(tag, existing);
    }
  }

  const ranked: TrendingItem[] = [];
  for (const [keyword, data] of tagCounts.entries()) {
    if (activeOverrides.suppress.includes(keyword)) {
      continue;
    }

    ranked.push({
      rank: 0,
      keyword,
      score: calculateScore(data, allArticles.length, activeOverrides.boost[keyword] ?? 1),
      direction: 'stable',
      velocity: data.count,
      article_count: data.count,
      top_articles: data.articles.slice(0, 3),
    });
  }

  ranked.sort((a, b) => b.score - a.score || b.article_count - a.article_count || a.keyword.localeCompare(b.keyword));

  const pinnedSet = new Set(activeOverrides.pin.filter((keyword) => ranked.some((item) => item.keyword === keyword)));
  const pinnedItems = activeOverrides.pin
    .map((keyword) => ranked.find((item) => item.keyword === keyword))
    .filter((item): item is TrendingItem => Boolean(item));
  const unpinnedItems = ranked.filter((item) => !pinnedSet.has(item.keyword));
  const items = [...pinnedItems, ...unpinnedItems].slice(0, 30).map((item, index) => ({ ...item, rank: index + 1 }));

  if (
    shouldApplyOverrides(overrides, week) &&
    (activeOverrides.pin.length > 0 ||
      activeOverrides.suppress.length > 0 ||
      Object.keys(activeOverrides.boost).length > 0)
  ) {
    overrides.audit_log.push({
      action: 'calculated',
      topic: week,
      by: 'system',
      reason: `Applied ${activeOverrides.pin.length} pins, ${activeOverrides.suppress.length} suppressions, ${Object.keys(activeOverrides.boost).length} boosts`,
      timestamp: new Date().toISOString(),
    });

    try {
      await writeFile(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, 'utf-8');
    } catch {
      // Non-fatal: calculation should still succeed even if audit log persistence fails.
    }
  }

  return { week, items };
}

export async function saveTrendingResult(result: TrendingResult): Promise<string> {
  await mkdir(TRENDING_DIR, { recursive: true });
  const filePath = join(TRENDING_DIR, `week-${result.week}.json`);

  const output: Trending = trendingSchema.parse({
    id: `trending-${result.week}`,
    week: result.week,
    generated_at: new Date().toISOString(),
    not_enough_data: result.not_enough_data,
    items: result.items,
  });

  await writeFile(filePath, `${JSON.stringify(output, null, 2)}\n`, 'utf-8');
  return filePath;
}

if (import.meta.main) {
  const result = await calculateTrending();
  const filePath = await saveTrendingResult(result);

  if (result.not_enough_data) {
    console.log(`⚠️  Not enough data for trending (< ${MIN_ARTICLES_FOR_TRENDING} articles). Generated placeholder: ${filePath}`);
  } else {
    console.log(`✅ Trending calculated: ${result.items.length} topics → ${filePath}`);
  }
}
