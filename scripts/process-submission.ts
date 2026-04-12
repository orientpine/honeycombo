#!/usr/bin/env bun

import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { curatedArticleSchema } from '../src/schemas/curated-article';
import { listJsonFiles } from './utils/list-json-files';

const ROOT = process.cwd();
const CURATED_DIR = join(ROOT, 'src/content/curated');
const FEEDS_DIR = join(ROOT, 'src/data/feeds');
const SPAM_KEYWORDS_PATH = join(ROOT, 'src/config/spam-keywords.json');

export interface IssueData {
  number: number;
  title: string;
  body: string;
  labels: Array<{ name: string }>;
  user: { login: string };
}

export interface ParsedSubmission {
  url: string;
  type: 'article' | 'youtube' | 'x_thread' | 'threads' | 'other';
  tags: string[];
  note: string;
}

export interface OEmbedData {
  title?: string;
  thumbnail_url?: string;
  author_name?: string;
}

export interface BulkResult {
  total: number;
  succeeded: Array<{ url: string; filePath: string }>;
  failed: Array<{ url: string; reason: string }>;
}

function normalizeType(value: string): ParsedSubmission['type'] {
  const typeMap: Record<string, ParsedSubmission['type']> = {
    기사: 'article',
    YouTube: 'youtube',
    'X 스레드': 'x_thread',
    Threads: 'threads',
    기타: 'other',
  };

  return typeMap[value] ?? 'article';
}

export function parseIssueBody(body: string): ParsedSubmission | null {
  try {
    const lines = body.split('\n').map((line) => line.trim());

    let url = '';
    let typeLabel = '';
    let tags: string[] = [];
    let note = '';
    let currentSection = '';

    for (const line of lines) {
      if (line === '### URL') {
        currentSection = 'url';
        continue;
      }

      if (line === '### 유형') {
        currentSection = 'type';
        continue;
      }

      if (line.startsWith('### 태그')) {
        currentSection = 'tags';
        continue;
      }

      if (line === '### 한줄 소개') {
        currentSection = 'note';
        continue;
      }

      if (line.startsWith('###')) {
        currentSection = '';
        continue;
      }

      if (!line || line === '_No response_') {
        continue;
      }

      if (currentSection === 'url' && !url) {
        url = line;
        continue;
      }

      if (currentSection === 'type' && !typeLabel) {
        typeLabel = line;
        continue;
      }

      if (currentSection === 'tags' && tags.length === 0) {
        tags = line
          .split(',')
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 5);
        continue;
      }

      if (currentSection === 'note' && !note) {
        note = line;
      }
    }

    if (!url) {
      return null;
    }

    let type = normalizeType(typeLabel);
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      type = 'youtube';
    }

    return {
      url,
      type,
      tags: tags.length > 0 ? tags : ['general'],
      note,
    };
  } catch (error) {
    console.warn('Failed to parse issue body', error);
    return null;
  }
}

export function parseBulkIssueBody(body: string): ParsedSubmission[] {
  try {
    if (!body) {
      return [];
    }

    const lines = body.split('\n').map((line) => line.trim());
    const sectionIndex = lines.findIndex((line) => line === '### 링크 목록');

    if (sectionIndex === -1) {
      return [];
    }

    const submissions: ParsedSubmission[] = [];

    for (const line of lines.slice(sectionIndex + 1)) {
      if (line.startsWith('###')) {
        break;
      }

      if (!line || line === '_No response_') {
        continue;
      }

      const [rawUrl = '', rawType = '', rawTags = '', ...rawNoteParts] = line
        .split('|')
        .map((part) => part.trim());

      if (!rawUrl) {
        console.warn(`Skipping bulk submission line without URL: ${line}`);
        continue;
      }

      const tags = rawTags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 5);

      let type = normalizeType(rawType);
      if (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be')) {
        type = 'youtube';
      }

      submissions.push({
        url: rawUrl,
        type,
        tags: tags.length > 0 ? tags : ['general'],
        note: rawNoteParts.join(' | '),
      });

      if (submissions.length === 20) {
        console.warn('Bulk submission item limit reached (20); truncating remaining lines');
        break;
      }
    }

    return submissions;
  } catch (error) {
    console.warn('Failed to parse bulk issue body', error);
    return [];
  }
}

export async function fetchYouTubeOEmbed(url: string): Promise<OEmbedData | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as OEmbedData;
  } catch (error) {
    console.warn(`Failed to fetch YouTube oEmbed: ${url}`, error);
    return null;
  }
}

export async function isDuplicateUrl(url: string): Promise<boolean> {
  for (const dir of [CURATED_DIR, FEEDS_DIR]) {
    const files = await listJsonFiles(dir);

    for (const filePath of files) {
      try {
        const content = JSON.parse(await readFile(filePath, 'utf-8')) as { url?: unknown };
        if (content.url === url) {
          return true;
        }
      } catch (error) {
        console.warn(`Failed to read submission source JSON: ${filePath}`, error);
      }
    }
  }

  return false;
}

export async function isSpam(text: string): Promise<boolean> {
  try {
    const keywords = JSON.parse(await readFile(SPAM_KEYWORDS_PATH, 'utf-8')) as unknown;
    const normalizedKeywords = Array.isArray(keywords)
      ? keywords.filter((keyword): keyword is string => typeof keyword === 'string')
      : [];
    const lowerText = text.toLowerCase();
    return normalizedKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()));
  } catch (error) {
    console.warn(`Failed to load spam keywords: ${SPAM_KEYWORDS_PATH}`, error);
    return false;
  }
}

export function generateId(url: string, issueNumber: number): string {
  return `submission-${issueNumber}-${createHash('sha256').update(url).digest('hex').slice(0, 8)}`;
}

function buildSubmissionFilePath(submittedAt: string, id: string): string {
  const date = new Date(submittedAt);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return join(CURATED_DIR, String(year), month, `${id}.json`);
}

export async function processSubmission(
  issue: IssueData,
  options: { dryRun?: boolean } = {},
): Promise<{ success: boolean; message: string; filePath?: string }> {
  const parsed = parseIssueBody(issue.body);
  if (!parsed) {
    return { success: false, message: 'Could not parse issue body' };
  }

  const { url, type, tags, note } = parsed;

  try {
    new URL(url);
  } catch (error) {
    console.warn(`Invalid submission URL: ${url}`, error);
    return { success: false, message: `Invalid URL: ${url}` };
  }

  if (await isSpam(`${url} ${note}`)) {
    return { success: false, message: 'Spam detected in submission' };
  }

  if (await isDuplicateUrl(url)) {
    console.warn(`Duplicate URL detected: ${url}`);
    return { success: false, message: `Duplicate URL: ${url}` };
  }

  let title = note || url;
  let thumbnailUrl: string | undefined;

  if (type === 'youtube') {
    const oembed = await fetchYouTubeOEmbed(url);
    if (oembed) {
      title = oembed.title || title;
      thumbnailUrl = oembed.thumbnail_url;
    }
  }

  const id = generateId(url, issue.number);
  const submittedAt = new Date().toISOString();
  const article = curatedArticleSchema.parse({
    id,
    title: title.slice(0, 200),
    url,
    source: type === 'youtube' ? 'YouTube' : 'User Submission',
    type,
    thumbnail_url: thumbnailUrl,
    description: note.slice(0, 1000) || undefined,
    tags,
    submitted_by: issue.user.login,
    submitted_at: submittedAt,
    status: 'pending',
  });

  if (options.dryRun) {
    return { success: true, message: 'Dry run — article would be created' };
  }

  const date = new Date(article.submitted_at);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dir = join(CURATED_DIR, String(year), month);
  const filePath = join(dir, `${id}.json`);

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, `${JSON.stringify(article, null, 2)}\n`, 'utf-8');

  return { success: true, message: `Article created: ${filePath}`, filePath };
}

export async function processBulkSubmission(
  issue: IssueData,
  options: { dryRun?: boolean } = {},
): Promise<BulkResult> {
  const parsedSubmissions = parseBulkIssueBody(issue.body);

  if (parsedSubmissions.length === 0) {
    return { total: 0, succeeded: [], failed: [] };
  }

  const succeeded: BulkResult['succeeded'] = [];
  const failed: BulkResult['failed'] = [];

  for (const parsed of parsedSubmissions) {
    const { url, type, tags, note } = parsed;

    try {
      new URL(url);
    } catch (error) {
      console.warn(`Invalid bulk submission URL: ${url}`, error);
      failed.push({ url, reason: `Invalid URL: ${url}` });
      continue;
    }

    if (await isSpam(`${url} ${note}`)) {
      failed.push({ url, reason: 'Spam detected in submission' });
      continue;
    }

    if (await isDuplicateUrl(url)) {
      console.warn(`Duplicate URL detected in bulk submission: ${url}`);
      failed.push({ url, reason: `Duplicate URL: ${url}` });
      continue;
    }

    let title = note || url;
    let thumbnailUrl: string | undefined;

    if (type === 'youtube') {
      const oembed = await fetchYouTubeOEmbed(url);
      if (oembed) {
        title = oembed.title || title;
        thumbnailUrl = oembed.thumbnail_url;
      }
    }

    try {
      const id = generateId(url, issue.number);
      const submittedAt = new Date().toISOString();
      const article = curatedArticleSchema.parse({
        id,
        title: title.slice(0, 200),
        url,
        source: type === 'youtube' ? 'YouTube' : 'User Submission',
        type,
        thumbnail_url: thumbnailUrl,
        description: note.slice(0, 1000) || undefined,
        tags,
        submitted_by: issue.user.login,
        submitted_at: submittedAt,
        status: 'pending',
      });

      const filePath = buildSubmissionFilePath(article.submitted_at.toISOString(), id);

      if (!options.dryRun) {
        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, `${JSON.stringify(article, null, 2)}\n`, 'utf-8');
      }

      succeeded.push({ url, filePath });
    } catch (error) {
      console.warn(`Failed to process bulk submission item: ${url}`, error);
      failed.push({ url, reason: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  return {
    total: succeeded.length + failed.length,
    succeeded,
    failed,
  };
}

async function readMockIssue(filePath: string): Promise<IssueData> {
  return JSON.parse(await readFile(filePath, 'utf-8')) as IssueData;
}

async function readIssueFromEnvironment(): Promise<IssueData | null> {
  const issueNumber = Number.parseInt(process.env.ISSUE_NUMBER || '0', 10);
  const issueBody = process.env.ISSUE_BODY || '';
  const issueUser = process.env.ISSUE_USER || 'anonymous';
  const issueTitle = process.env.ISSUE_TITLE || '';

  if (!issueNumber || !issueBody) {
    return null;
  }

  return {
    number: issueNumber,
    title: issueTitle,
    body: issueBody,
    labels: (process.env.ISSUE_LABELS || 'submission')
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean)
      .map((name) => ({ name })),
    user: { login: issueUser },
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const mockIssueFlag = args.indexOf('--mock-issue');
  const isBulkFlag = args.includes('--bulk');

  const issue =
    mockIssueFlag !== -1 && args[mockIssueFlag + 1]
      ? await readMockIssue(args[mockIssueFlag + 1])
      : await readIssueFromEnvironment();

  if (!issue) {
    console.error('Missing ISSUE_NUMBER or ISSUE_BODY environment variables');
    process.exit(1);
  }

  const isBulkIssue = isBulkFlag || issue.labels.some((label) => label.name === 'bulk');

  if (isBulkIssue) {
    const result = await processBulkSubmission(issue);
    console.log(`✅ ${result.succeeded.length}/${result.total} succeeded, ❌ ${result.failed.length}/${result.total} failed`);

    if (result.failed.length > 0) {
      for (const failure of result.failed) {
        console.warn(`Bulk item failed: ${failure.url} — ${failure.reason}`);
      }
    }

    if (result.succeeded.length === 0) {
      process.exit(1);
    }

    process.exit(0);
  }

  const result = await processSubmission(issue);
  console.log(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);

  if (!result.success) {
    process.exit(1);
  }
}
