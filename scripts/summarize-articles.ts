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

const SELF_REFERENTIAL_PATTERN = /^\s*(이|본|해당)\s*(콘텐츠|기사|글|아티클|포스트|영상|문서|뉴스|내용|자료|텍스트)\s*(은|는|이|가|을|를|의|에서)/;

/**
 * Detects self-referential openings like "이 콘텐츠는", "본 기사는", "해당 글은".
 *
 * Uses a regex pattern (not a brittle phrase list) to catch the article-like
 * noun family: 이/본/해당 + 콘텐츠/기사/글/아티클/포스트/영상/문서/뉴스/내용/자료/텍스트 + 조사.
 *
 * Scans prose lines only — markdown headings (##) and bullet items (-) are
 * ignored because they describe structure/sub-points, not the article itself.
 *
 * The user explicitly marked these openings as unwanted filler. The Gemini
 * prompt already instructs the model to avoid them, but this validator acts
 * as defense-in-depth: regressed prompt outputs are rejected at runtime and
 * the article is re-queued for summarization on the next run.
 *
 * Related: docs/troubleshooting/rss-summary-self-referential-opening.md
 */
export function hasSelfReferentialOpening(text: string): boolean {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#+\s/.test(trimmed)) continue; // skip markdown headings
    if (/^[-*]\s/.test(trimmed)) continue; // skip bullet items
    if (SELF_REFERENTIAL_PATTERN.test(trimmed)) {
      return true;
    }
  }
  return false;
}

const SUMMARIZE_PROMPT = `당신은 기술 콘텐츠 요약 전문가입니다. 아래 기사/영상의 핵심 내용을 한국어로 구조화된 요약을 작성해주세요.

규칙:
- 아래 형식을 반드시 따를 것
- 전문 용어는 원문 그대로 유지 (예: API, SDK, LLM, React 등)
- 주관적 평가 없이 사실만 전달
- 최대 ${MAX_DESCRIPTION_LENGTH}자 이내
- **자기 지시적 서두 절대 금지.** 각 섹션의 첫 문장을 "이 콘텐츠는", "본 콘텐츠는", "이 기사는", "본 기사는", "해당 기사는", "이 글은", "본 글은", "해당 글은", "이 아티클은", "본 아티클은", "이 영상은", "본 영상은", "이 포스트는", "본 포스트는", "이 내용은", "본 내용은" 등 자기 지시적 표현으로 시작하지 마시오. 기사·영상이 다루는 **주제·대상(주어)**으로 바로 시작하시오.
  - ✅ 올바른 예: "Vercel이 발표한 새 실험은 ...", "OpenAI의 o1 모델은 ...", "AGENTS.md 문서는 ..."
  - ❌ 잘못된 예: "이 기사는 Vercel 실험을 다룬다", "본 콘텐츠는 o1 모델을 소개한다"

형식:
## 개요

(1~2문장. 주제·대상을 주어로 하여 핵심 내용을 요약. 주제로 바로 시작하고, 자기 지시적 서두 사용 금지.)

## 주요 내용

- (핵심 포인트 1)
- (핵심 포인트 2)
- (핵심 포인트 3)
- (필요 시 추가)

## 시사점

(1~2문장. 주제·대상이 갖는 의의, 결론, 또는 실무 적용 가능성. 주어로 바로 시작하고, 자기 지시적 서두 사용 금지.)

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
  //   비어 있거나, RSS 원문이 누수된 경우(구조화 형식 아님)
  //   또는 자기 지시적 서두("이 콘텐츠는", "본 기사는" 등)로 시작하는 경우
  //   모두 재요약한다. 자기 지시적 서두 검사는 고집들인 기존 선약 데이터도
  //   다음 run에서 자동으로 재요약되도록 하는 백필 장치 역할을 격한다.
  //
  // 자세한 배경:
  // - docs/troubleshooting/rss-summary-english-fallback.md (구조 검증 배경)
  // - docs/troubleshooting/rss-summary-self-referential-opening.md (스타일 검증 배경)
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
          ? !description ||
            !looksLikeKoreanStructuredSummary(description) ||
            hasSelfReferentialOpening(description)
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

      // Step 2.5: Validate no self-referential openings (user preference).
      // Even though the prompt explicitly forbids them, Gemini sometimes regresses.
      // Reject and re-queue for re-summarization on next run.
      if (hasSelfReferentialOpening(summary)) {
        const message = `Rejected self-referential opening for: ${title}`;
        console.warn(`  ⚠️  ${message}`);
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
