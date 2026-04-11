#!/usr/bin/env bun

import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { influencerSchema, type Influencer } from '../src/schemas/influencer';

const ROOT = process.cwd();
const SOURCES_CONFIG = join(ROOT, 'src/config/influencer-sources.json');
const INFLUENCERS_DIR = join(ROOT, 'src/data/influencers');
const MAX_OPINIONS = 10;
const EXA_API_URL = 'https://api.exa.ai/search';
const COLLECTION_WINDOW_DAYS = 14;
const REQUEST_DELAY_MS = 1000;
const MIN_TEXT_LENGTH = 20;

export interface InfluencerSource {
  id: string;
  name: string;
  platform: 'x' | 'threads' | 'blog' | 'youtube';
  handle: string;
  bio: string;
  search_query: string;
  enabled: boolean;
}

export interface ExaResult {
  url: string;
  title: string;
  text?: string;
  highlights?: string[];
  publishedDate: string;
  author?: string;
}

interface ExaResponse {
  results: ExaResult[];
}

export interface CollectResult {
  updated: number;
  skipped: number;
  errors: string[];
}

export interface CollectOptions {
  sourcesConfigPath?: string;
  outputDir?: string;
  apiKey?: string;
  now?: Date;
  searchFn?: (query: string, apiKey: string, startDate: string) => Promise<ExaResult[]>;
}

const TOPIC_KEYWORDS: [string, string[]][] = [
  ['LLM', ['llm', 'language model', 'gpt', 'chatgpt', 'claude', 'gemini', 'transformer', 'token']],
  ['AGI', ['agi', 'artificial general intelligence', 'superintelligence', 'human-level']],
  ['AI Agent', ['agent', 'agentic', 'autonomous agent', 'tool use', 'mcp']],
  ['Robotics', ['robot', 'robotics', 'embodied', 'humanoid']],
  ['Coding', ['code', 'coding', 'programming', 'software', 'vibe coding', 'developer', 'engineer']],
  ['Research', ['paper', 'research', 'arxiv', 'benchmark', 'dataset', 'preprint']],
  ['AI', ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural', 'model']],
];

export function detectTopic(text: string): string {
  const lower = text.toLowerCase();

  for (const [topic, keywords] of TOPIC_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) {
      return topic;
    }
  }

  return 'Tech';
}

export function cleanText(value: string, max: number): string {
  const clean = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  if (clean.length <= max) {
    return clean;
  }

  return `${clean.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function searchExa(
  query: string,
  apiKey: string,
  startDate: string,
): Promise<ExaResult[]> {
  const response = await fetch(EXA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query,
      type: 'auto',
      numResults: 10,
      startPublishedDate: startDate,
      contents: { highlights: { numSentences: 3 } },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Exa API ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as ExaResponse;
  return data.results || [];
}

export async function loadExistingInfluencer(
  id: string,
  dir = INFLUENCERS_DIR,
): Promise<Influencer | null> {
  const filePath = join(dir, `${id}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = JSON.parse(await readFile(filePath, 'utf-8')) as unknown;
    return influencerSchema.parse(content);
  } catch {
    return null;
  }
}

export function mergeOpinions(
  existing: Influencer['opinions'],
  incoming: Influencer['opinions'],
  max = MAX_OPINIONS,
): Influencer['opinions'] {
  const seenUrls = new Set(existing.map((o) => o.source_url));
  const merged = [...existing];

  for (const opinion of incoming) {
    if (!seenUrls.has(opinion.source_url)) {
      merged.push(opinion);
      seenUrls.add(opinion.source_url);
    }
  }

  merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return merged.slice(0, max);
}

export async function collectInfluencers(options: CollectOptions = {}): Promise<CollectResult> {
  const {
    sourcesConfigPath = SOURCES_CONFIG,
    outputDir = INFLUENCERS_DIR,
    apiKey = process.env.EXA_API_KEY || '',
    now = new Date(),
    searchFn = searchExa,
  } = options;

  if (!apiKey) {
    throw new Error('EXA_API_KEY environment variable is required');
  }

  const sources = JSON.parse(await readFile(sourcesConfigPath, 'utf-8')) as InfluencerSource[];
  const enabledSources = sources.filter((s) => s.enabled);

  const startDate = new Date(now);
  startDate.setUTCDate(startDate.getUTCDate() - COLLECTION_WINDOW_DAYS);
  const startDateStr = startDate.toISOString().split('T')[0];

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  await mkdir(outputDir, { recursive: true });

  for (const source of enabledSources) {
    try {
      const results = await searchFn(source.search_query, apiKey, startDateStr);

      const newOpinions: Influencer['opinions'] = results
        .filter((r) => r.url && ((r.highlights && r.highlights.length > 0) || (r.text && r.text.length >= MIN_TEXT_LENGTH)))
        .map((r) => {
          const raw = r.highlights ? r.highlights.join(' ') : (r.text ?? '');
          return {
            text: cleanText(raw, 500),
            source_url: r.url,
            date: new Date(r.publishedDate || now.toISOString()),
            topic: detectTopic(raw),
          };
        })
        .filter((o) => o.text.length >= MIN_TEXT_LENGTH);

      if (newOpinions.length === 0) {
        skipped += 1;
        continue;
      }

      const existing = await loadExistingInfluencer(source.id, outputDir);
      const mergedOpinions = mergeOpinions(existing?.opinions || [], newOpinions);

      const influencer = influencerSchema.parse({
        id: source.id,
        name: source.name,
        platform: source.platform,
        handle: source.handle,
        bio: source.bio,
        opinions: mergedOpinions,
      });

      const filePath = join(outputDir, `${source.id}.json`);
      await writeFile(filePath, `${JSON.stringify(influencer, null, 2)}\n`, 'utf-8');
      updated += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const message = `Skipped ${source.id}: ${reason}`;
      console.error(message);
      errors.push(message);
    }

    await delay(REQUEST_DELAY_MS);
  }

  return { updated, skipped, errors };
}

if (import.meta.main) {
  if (!process.env.EXA_API_KEY) {
    console.error('Error: EXA_API_KEY environment variable is required');
    process.exit(1);
  }

  const result = await collectInfluencers();
  console.log(`✅ Influencer collection complete: ${result.updated} updated, ${result.skipped} skipped`);

  if (result.errors.length > 0) {
    console.error(`⚠️  ${result.errors.length} source(s) failed`);
  }
}
