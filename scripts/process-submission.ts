#!/usr/bin/env bun

/// <reference types="bun" />

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
  user: { login: string; id: number };
}

export interface ParsedSubmission {
  url: string;
  type: 'article' | 'youtube' | 'x_thread' | 'threads' | 'other';
  tags: string[];
  note: string;
  title?: string;
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
    Article: 'article',
    YouTube: 'youtube',
    'X Thread': 'x_thread',
    Threads: 'threads',
    Other: 'other',
  };

  return typeMap[value] ?? 'article';
}

export function extractTitleFromNote(note: string): string {
  if (!note) return '';
  const lines = note.split('\n').map((l) => l.trim()).filter(Boolean);
  const contentLine = lines.find((line) => !line.startsWith('#'));
  if (contentLine) return contentLine;
  return lines[0]?.replace(/^#+\s*/, '') || '';
}

const SECTION_HEADINGS = new Set([
  '개요',
  '주요 내용',
  '시사점',
  '핵심 내용',
  '요약',
  'TL;DR',
  'Overview',
  'Summary',
  'Background',
  'Context',
]);

function normalizeForComparison(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

/**
 * Derive a short (<= 80 grapheme) title from a structured note.
 *
 * Returns null when the derivation would produce a title that is effectively
 * identical to the first meaningful content line (which would lead to
 * `title === description` in downstream storage). Callers must fall back to
 * another source (oEmbed, URL hostname) in that case.
 */
export function deriveShortTitle(note: string): string | null {
  if (!note) return null;

  const candidates = note
    .split('\n')
    .map((line) => line.replace(/^[#>*_`\s-]+/, '').trim())
    .filter(Boolean)
    .filter((line) => !SECTION_HEADINGS.has(line))
    .filter((line) => !/^https?:\/\//i.test(line));

  const first = candidates[0];
  if (!first) return null;

  // Extract the first sentence (ASCII + CJK terminators).
  const sentenceMatch = first.match(/^[^.!?。]*[.!?。]/u);
  const firstSentence = sentenceMatch ? sentenceMatch[0].trim() : first;

  // Grapheme-aware truncation at 80 characters.
  const graphemes = Array.from(firstSentence);
  const truncated = graphemes.slice(0, 80).join('').trim();
  if (!truncated) return null;

  // Reject if the result is effectively identical to the first content line —
  // that case would make `title` overlap with `description` once stored.
  if (normalizeForComparison(truncated) === normalizeForComparison(first)) {
    return null;
  }

  return graphemes.length > 80 ? `${truncated}…` : truncated;
}

function hostnameFallback(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

/**
 * Resolve the final `title` for a submission using a deterministic fallback
 * chain: explicit parsed.title → oEmbed title → deriveShortTitle(note) →
 * URL hostname. This is shared by single and bulk flows to prevent drift.
 */
export function resolveSubmissionTitle(
  parsed: ParsedSubmission,
  oembed: OEmbedData | null,
  url: string,
): string {
  const fromSubmission = parsed.title?.trim();
  if (fromSubmission) return fromSubmission;

  const fromOembed = oembed?.title?.trim();
  if (fromOembed) return fromOembed;

  const fromDerivation = deriveShortTitle(parsed.note);
  if (fromDerivation) return fromDerivation;

  return hostnameFallback(url);
}

export function parseIssueBody(body: string): ParsedSubmission | null {
  try {
    const lines = body.split('\n').map((line) => line.trim());

    let url = '';
    let typeLabel = '';
    let tags: string[] = [];
    let note = '';
    const noteLines: string[] = [];
    let currentSection = '';

    for (const line of lines) {
      if (line === '### URL') {
        currentSection = 'url';
        continue;
      }

      if (line === '### Type') {
        currentSection = 'type';
        continue;
      }

      if (line.startsWith('### Tags')) {
        currentSection = 'tags';
        continue;
      }

      if (line === '### Short Description' || line === '### Summary') {
        currentSection = 'note';
        continue;
      }

      if (line.startsWith('###')) {
        currentSection = '';
        continue;
      }

      if (currentSection === 'note') {
        if (line !== '_No response_') {
          noteLines.push(line);
        }
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

    }

    note = noteLines.join('\n').trim();

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
    const sectionIndex = lines.findIndex((line) => line === '### Link List');

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

      const parts = line.split('|').map((part) => part.trim());
      let rawUrl = '';
      let rawType = '';
      let rawTitle = '';
      let rawTags = '';
      let rawNoteParts: string[] = [];

      if (parts.length >= 5) {
        // 5-column format (v2): URL | Type | Title | Tags | Summary+
        [rawUrl = '', rawType = '', rawTitle = '', rawTags = '', ...rawNoteParts] = parts;
      } else {
        // 4-column format (v1, legacy): URL | Type | Tags | Summary+
        [rawUrl = '', rawType = '', rawTags = '', ...rawNoteParts] = parts;
      }

      if (!rawUrl) {
        console.warn(`Skipping bulk submission line without URL: ${line}`);
        continue;
      }

      // TITLE must not contain the column delimiter or line-breaking chars.
      if (rawTitle && /[|\t\r\n]/.test(rawTitle)) {
        console.warn(`Skipping bulk submission line with forbidden char in title: ${rawTitle}`);
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
        title: rawTitle || undefined,
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

/**
 * Find the file path of an already-curated article with the same URL.
 * Returns the absolute path when a match exists; otherwise null.
 */
export async function findDuplicateUrl(url: string): Promise<string | null> {
  for (const dir of [CURATED_DIR, FEEDS_DIR]) {
    const files = await listJsonFiles(dir);

    for (const filePath of files) {
      try {
        const content = JSON.parse(await readFile(filePath, 'utf-8')) as { url?: unknown };
        if (content.url === url) {
          return filePath;
        }
      } catch (error) {
        console.warn(`Failed to read submission source JSON: ${filePath}`, error);
      }
    }
  }

  return null;
}

/**
 * Backward-compatible boolean wrapper around findDuplicateUrl.
 * Prefer findDuplicateUrl in new code so callers can surface the matching path.
 */
export async function isDuplicateUrl(url: string): Promise<boolean> {
  return (await findDuplicateUrl(url)) !== null;
}

/**
 * Build a single `url -> filePath` index over curated + feed JSON files.
 * Used by bulk submission to avoid rescanning the repo once per item.
 */
export async function buildUrlIndex(): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  for (const dir of [CURATED_DIR, FEEDS_DIR]) {
    const files = await listJsonFiles(dir);
    for (const filePath of files) {
      try {
        const content = JSON.parse(await readFile(filePath, 'utf-8')) as { url?: unknown };
        if (typeof content.url === 'string' && !index.has(content.url)) {
          index.set(content.url, filePath);
        }
      } catch (error) {
        console.warn(`Failed to read submission source JSON: ${filePath}`, error);
      }
    }
  }
  return index;
}

function formatRelativePath(absolutePath: string): string {
  const normalizedRoot = ROOT.replace(/\\/g, '/');
  const normalized = absolutePath.replace(/\\/g, '/');
  if (normalized.startsWith(`${normalizedRoot}/`)) {
    return normalized.slice(normalizedRoot.length + 1);
  }
  return normalized;
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

  const duplicatePath = await findDuplicateUrl(url);
  if (duplicatePath) {
    const relPath = formatRelativePath(duplicatePath);
    console.warn(`Duplicate URL detected: ${url} (already in ${relPath})`);
    return { success: false, message: `Duplicate URL: ${url} (already in ${relPath})` };
  }

  let oembed: OEmbedData | null = null;
  let thumbnailUrl: string | undefined;

  if (type === 'youtube') {
    oembed = await fetchYouTubeOEmbed(url);
    if (oembed) {
      thumbnailUrl = oembed.thumbnail_url;
    }
  }

  const title = resolveSubmissionTitle(parsed, oembed, url);

  const id = generateId(url, issue.number);
  const submittedAt = new Date().toISOString();
  const article = curatedArticleSchema.parse({
    id,
    title: title.slice(0, 200),
    url,
    source: type === 'youtube' ? 'YouTube' : 'User Submission',
    type,
    thumbnail_url: thumbnailUrl,
      description: note.slice(0, 5000) || undefined,
    tags,
    submitted_by: issue.user.login,
    submitted_by_id: String(issue.user.id),
    submitted_at: submittedAt,
    status: 'approved',
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

  const urlIndex = await buildUrlIndex();
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

    const duplicatePath = urlIndex.get(url);
    if (duplicatePath) {
      const relPath = formatRelativePath(duplicatePath);
      console.warn(`Duplicate URL detected in bulk submission: ${url} (already in ${relPath})`);
      failed.push({ url, reason: `Duplicate URL: ${url} (already in ${relPath})` });
      continue;
    }

    let oembed: OEmbedData | null = null;
    let thumbnailUrl: string | undefined;

    if (type === 'youtube') {
      oembed = await fetchYouTubeOEmbed(url);
      if (oembed) {
        thumbnailUrl = oembed.thumbnail_url;
      }
    }

    const title = resolveSubmissionTitle(parsed, oembed, url);

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
      description: note.slice(0, 5000) || undefined,
        tags,
        submitted_by: issue.user.login,
        submitted_by_id: String(issue.user.id),
        submitted_at: submittedAt,
        status: 'approved',
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
  const issueUserId = Number.parseInt(process.env.ISSUE_USER_ID || '0', 10);
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
      .map((label: string) => label.trim())
      .filter(Boolean)
      .map((name: string) => ({ name })),
    user: { login: issueUser, id: issueUserId },
  };
}

function requireIssue(issue: IssueData | null): IssueData {
  if (issue) {
    return issue;
  }

  console.error('Missing ISSUE_NUMBER or ISSUE_BODY environment variables');
  process.exit(1);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const mockIssueFlag = args.indexOf('--mock-issue');
  const isBulkFlag = args.includes('--bulk');

  const issue =
    mockIssueFlag !== -1 && args[mockIssueFlag + 1]
      ? await readMockIssue(args[mockIssueFlag + 1])
      : await readIssueFromEnvironment();

  const resolvedIssue = requireIssue(issue);

  const isBulkIssue = isBulkFlag || resolvedIssue.labels.some((label) => label.name === 'bulk');

  if (isBulkIssue) {
    const result = await processBulkSubmission(resolvedIssue);
    console.log(`✅ ${result.succeeded.length}/${result.total} succeeded, ❌ ${result.failed.length}/${result.total} failed`);

    if (result.failed.length > 0) {
      for (const failure of result.failed) {
        console.warn(`Bulk item failed: ${failure.url} — ${failure.reason}`);
      }
    }

    // Write a machine-readable summary for the workflow comment step.
    const reportPayload = {
      issueNumber: resolvedIssue.number,
      total: result.total,
      succeeded: result.succeeded.map((item) => ({
        url: item.url,
        filePath: formatRelativePath(item.filePath),
      })),
      failed: result.failed,
    };
    await writeFile(
      join(ROOT, 'bulk-result.json'),
      `${JSON.stringify(reportPayload, null, 2)}\n`,
      'utf-8',
    );

    // Partial success keeps exit 0 so downstream steps (PR, auto-merge) run
    // for the items that DID succeed. Only a total failure fails the job.
    if (result.total > 0 && result.succeeded.length === 0) {
      process.exit(1);
    }

    process.exit(0);
  }

  const result = await processSubmission(resolvedIssue);
  console.log(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);

  if (!result.success) {
    process.exit(1);
  }
}
