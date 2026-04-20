#!/usr/bin/env bun

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Readability } from '@mozilla/readability';
import { readFile, writeFile } from 'fs/promises';
import { parseHTML } from 'linkedom';
import { join } from 'path';
import { listJsonFiles } from './utils/list-json-files';

const ROOT = process.cwd();
const CURATED_DIR = join(ROOT, 'src/content/curated');
const FEEDS_DIR = join(ROOT, 'src/data/feeds');
const MODEL_NAME = 'gemini-2.5-flash-lite';
const MAX_DESCRIPTION_LENGTH = 5000;
const REQUEST_DELAY_MS = 1500;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_CONTENT_CHARS = 30_000;
const MAX_ARTICLES_PER_RUN = 100;

interface ArticleFile {
  filePath: string;
  data: Record<string, unknown>;
}

export interface SummarizeResult {
  updated: number;
  skipped: number;
  errors: string[];
}

export interface SummarizeOptions {
  curatedDir?: string;
  feedsDir?: string;
  apiKey?: string;
  modelName?: string;
  maxArticles?: number;
  dryRun?: boolean;
  fetchContentFn?: (url: string) => Promise<string | null>;
  generateSummaryFn?: (content: string, title: string) => Promise<string | null>;
}

/**
 * description이 Gemini가 생성한 한국어 구조화 요약 형식인지 판정한다.
 *
 * 정상 형식 예시:
 *   ## 주요 내용
 *   - ...
 *   ## 시사점
 *   ...
 *
 * '## 개요'는 모델이 종종 생략하므로 체크하지 않는다.
 * '## 주요 내용' 또는 '## 시사점' 중 하나라도 있으면 AI 요약이 완료된 것으로 간주한다.
 * 공백 변동을 허용하기 위해 regex를 사용한다.
 *
 * 이 가드는 RSS 수집 단계에서 잘못 채워진 영문 원문을 자동으로 감지해
 * 재요약하도록 한다. 자세한 배경: docs/troubleshooting/rss-summary-english-fallback.md
 */
export function looksLikeKoreanStructuredSummary(text: string): boolean {
  return /##\s*주요\s*내용|##\s*시사점/.test(text);
}

const SUMMARIZE_PROMPT = `당신은 기술 콘텐츠 요약 전문가입니다. 아래 기사/영상의 핵심 내용을 한국어로 구조화된 요약을 작성해주세요.

규칙:
- 아래 형식을 반드시 따를 것
- 전문 용어는 원문 그대로 유지 (예: API, SDK, LLM, React 등)
- 주관적 평가 없이 사실만 전달
- 최대 ${MAX_DESCRIPTION_LENGTH}자 이내

형식:
## 개요

(1~2문장으로 이 콘텐츠가 무엇인지 설명)

## 주요 내용

- (핵심 포인트 1)
- (핵심 포인트 2)
- (핵심 포인트 3)
- (필요 시 추가)

## 시사점

(이 콘텐츠의 의의, 결론, 또는 실무 적용 가능성을 1~2문장으로 정리)

기사 제목: {title}

기사 본문:
{content}

한국어 구조화 요약:`;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchArticleContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HoneyCombo/1.0; +https://honeycombo.orientpine.workers.dev)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`  HTTP ${response.status} for ${url}`);
      return null;
    }

    const html = await response.text();
    const { document } = parseHTML(html);
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article?.textContent) {
      console.warn(`  Could not extract text from ${url}`);
      return null;
    }

    const cleaned = article.textContent.replace(/\s+/g, ' ').trim();
    return cleaned.slice(0, MAX_CONTENT_CHARS);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`  Fetch failed for ${url}: ${reason}`);
    return null;
  }
}

export function createSummaryGenerator(apiKey: string, modelName = MODEL_NAME) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  return async function generateSummary(content: string, title: string): Promise<string | null> {
    const prompt = SUMMARIZE_PROMPT.replace('{title}', title).replace('{content}', content);

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      if (!text || text.length < 20) {
        console.warn('  Gemini returned empty or too-short response');
        return null;
      }

      return text.slice(0, MAX_DESCRIPTION_LENGTH);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`  Gemini API error: ${reason}`);
      return null;
    }
  };
}

export async function findArticlesNeedingSummary(
  curatedDir = CURATED_DIR,
  feedsDir = FEEDS_DIR,
): Promise<ArticleFile[]> {
  const articles: ArticleFile[] = [];

  // curated와 feeds는 완전히 다른 처리 대상이다.
  //
  // - curated/ (사용자 제출 콘텐츠)
  //   description은 사용자가 직접 적은 값이다. 명시적 동의 없이 덮어쓰면 안 된다.
  //   따라서 description이 완전히 비어 있을 때만 생성한다(기존 동작 유지).
  //
  // - feeds/ (RSS 자동 수집)
  //   description은 Gemini가 생성한 한국어 구조화 요약 전용이다.
  //   비어 있거나 RSS 원문이 누수된 경우(구조화 형식 아님) 모두 재요약한다.
  //
  // 자세한 배경: docs/troubleshooting/rss-summary-english-fallback.md
  const targets: Array<{ dir: string; allowResummarize: boolean }> = [
    { dir: curatedDir, allowResummarize: false },
    { dir: feedsDir, allowResummarize: true },
  ];

  for (const { dir, allowResummarize } of targets) {
    const files = await listJsonFiles(dir);

    for (const filePath of files) {
      try {
        const raw = await readFile(filePath, 'utf-8');
        const data = JSON.parse(raw) as Record<string, unknown>;

        if (typeof data.url !== 'string' || data.url.length === 0) {
          continue;
        }

        const description = typeof data.description === 'string' ? data.description : '';

        const needsSummary = allowResummarize
          ? !description || !looksLikeKoreanStructuredSummary(description)
          : !description;

        if (needsSummary) {
          articles.push({ filePath, data });
        }
      } catch {
        // skip malformed files
      }
    }
  }

  return articles;
}

export async function updateArticleFile(filePath: string, data: Record<string, unknown>, description: string): Promise<void> {
  const updated = { ...data, description };
  await writeFile(filePath, `${JSON.stringify(updated, null, 2)}\n`, 'utf-8');
}

/**
 * Remove a stale description so the article does not keep showing raw English /
 * RSS contentSnippet to users while it waits for a future summarize run.
 *
 * Called when the article currently has a non-Korean-structured description AND
 * we failed to produce a fresh Korean summary (fetch returned too little content,
 * or Gemini returned an error).
 *
 * The article will be picked up again by `findArticlesNeedingSummary` on the next
 * run because the description is now empty.
 */
export async function clearStaleDescription(filePath: string, data: Record<string, unknown>): Promise<void> {
  if (!data.description) return; // already empty, nothing to do
  const cleaned = { ...data };
  delete cleaned.description;
  await writeFile(filePath, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf-8');
}

export async function summarizeArticles(options: SummarizeOptions = {}): Promise<SummarizeResult> {
  const {
    curatedDir = CURATED_DIR,
    feedsDir = FEEDS_DIR,
    apiKey = process.env.GEMINI_API_KEY || '',
    modelName = MODEL_NAME,
    maxArticles = MAX_ARTICLES_PER_RUN,
    dryRun = false,
    fetchContentFn = fetchArticleContent,
  } = options;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  const generateSummaryFn = options.generateSummaryFn ?? createSummaryGenerator(apiKey, modelName);

  const allArticles = await findArticlesNeedingSummary(curatedDir, feedsDir);
  const articles = allArticles.slice(0, maxArticles);

  console.log(`Found ${allArticles.length} articles needing summary (processing ${articles.length})`);

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const { filePath, data } of articles) {
    const title = String(data.title || 'Untitled');
    const url = String(data.url);

    console.log(`\nProcessing: ${title}`);
    console.log(`  URL: ${url}`);

    try {
      // Step 1: Fetch and extract content
      const content = await fetchContentFn(url);

      if (!content || content.length < 100) {
        console.warn('  Skipped: insufficient content extracted');
        // Clear any stale RSS contentSnippet so users do not keep seeing the raw
        // English/non-Korean text while we cannot produce a fresh summary.
        if (!dryRun) {
          await clearStaleDescription(filePath, data);
        }
        skipped += 1;
        continue;
      }

      console.log(`  Extracted ${content.length} chars`);

      // Step 2: Generate summary via Gemini
      const summary = await generateSummaryFn(content, title);

      if (!summary) {
        const message = `Failed to generate summary for: ${title}`;
        console.error(`  ${message}`);
        // Same fallback as the fetch-failure branch: clear stale description so it
        // does not linger in the UI between summarize runs.
        if (!dryRun) {
          await clearStaleDescription(filePath, data);
        }
        errors.push(message);
        continue;
      }

      console.log(`  Summary (${summary.length} chars): ${summary.slice(0, 80)}...`);

      // Step 3: Update JSON file
      if (!dryRun) {
        await updateArticleFile(filePath, data, summary);
        console.log(`  ✅ Updated: ${filePath}`);
      } else {
        console.log(`  [DRY RUN] Would update: ${filePath}`);
      }

      updated += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const message = `Error processing ${title}: ${reason}`;
      console.error(`  ${message}`);
      errors.push(message);
    }

    await delay(REQUEST_DELAY_MS);
  }

  return { updated, skipped, errors };
}

if (import.meta.main) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is required');
    console.error('Usage: GEMINI_API_KEY=your-key bun run scripts/summarize-articles.ts');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('🔍 Running in DRY RUN mode (no files will be modified)\n');
  }

  const result = await summarizeArticles({ dryRun });
  console.log(`\n✅ Summarization complete: ${result.updated} updated, ${result.skipped} skipped`);

  if (result.errors.length > 0) {
    console.error(`⚠️  ${result.errors.length} article(s) failed`);
  }
}
