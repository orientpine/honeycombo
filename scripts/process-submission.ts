#!/usr/bin/env bun

import { createHash } from 'crypto';
import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, extname } from 'path';
import { curatedArticleSchema } from '../src/schemas/curated-article';

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

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.json') {
        continue;
      }

      const parentPath = 'parentPath' in entry ? entry.parentPath : undefined;
      const basePath = typeof parentPath === 'string' ? parentPath : dir;
      files.push(join(basePath, entry.name));
    }

    return files;
  } catch {
    return [];
  }
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
  } catch {
    return null;
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
  } catch {
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
      } catch {
        // Ignore unreadable JSON files while scanning for duplicates.
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
  } catch {
    return false;
  }
}

export function generateId(url: string, issueNumber: number): string {
  return `submission-${issueNumber}-${createHash('sha256').update(url).digest('hex').slice(0, 8)}`;
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
  } catch {
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
    labels: [{ name: 'submission' }],
    user: { login: issueUser },
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const mockIssueFlag = args.indexOf('--mock-issue');

  const issue =
    mockIssueFlag !== -1 && args[mockIssueFlag + 1]
      ? await readMockIssue(args[mockIssueFlag + 1])
      : await readIssueFromEnvironment();

  if (!issue) {
    console.error('Missing ISSUE_NUMBER or ISSUE_BODY environment variables');
    process.exit(1);
  }

  const result = await processSubmission(issue);
  console.log(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);

  if (!result.success) {
    process.exit(1);
  }
}
