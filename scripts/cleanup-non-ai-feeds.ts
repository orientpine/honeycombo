#!/usr/bin/env bun

/**
 * One-time cleanup script: removes existing feed articles that don't pass the AI keyword filter.
 * Uses the same isAIRelated logic from rss-collect.ts (with word-boundary matching for short keywords).
 *
 * Usage: bun run scripts/cleanup-non-ai-feeds.ts [--dry-run]
 */

import { readFile, unlink, readdir, rmdir } from 'fs/promises';
import { join } from 'path';

const ROOT = process.cwd();
const FEEDS_DIR = join(ROOT, 'src/data/feeds');
const AI_KEYWORDS_PATH = join(ROOT, 'src/config/ai-keywords.json');
const dryRun = process.argv.includes('--dry-run');

function isAIRelated(title: string, description: string, tags: string[], keywords: string[]): boolean {
  const haystack = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
  return keywords.some((keyword) => {
    const kw = keyword.toLowerCase();
    if (kw.length <= 3) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`).test(haystack);
    }
    return haystack.includes(kw);
  });
}

async function findJsonFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await findJsonFiles(full));
      } else if (entry.name.endsWith('.json')) {
        results.push(full);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results;
}

async function cleanupEmptyDirs(dir: string): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await cleanupEmptyDirs(join(dir, entry.name));
      }
    }
    const remaining = await readdir(dir);
    if (remaining.length === 0 && dir !== FEEDS_DIR) {
      await rmdir(dir);
    }
  } catch {
    // Ignore
  }
}

async function main() {
  const keywords: string[] = JSON.parse(await readFile(AI_KEYWORDS_PATH, 'utf-8'));
  const files = await findJsonFiles(FEEDS_DIR);

  let kept = 0;
  let removed = 0;

  for (const filePath of files) {
    const article = JSON.parse(await readFile(filePath, 'utf-8')) as {
      title?: string;
      description?: string;
      tags?: string[];
    };

    const title = article.title ?? '';
    const description = article.description ?? '';
    const tags = article.tags ?? [];

    if (isAIRelated(title, description, tags, keywords)) {
      kept++;
    } else {
      if (dryRun) {
        console.log(`[DRY-RUN] Would remove: ${title}`);
      } else {
        await unlink(filePath);
      }
      removed++;
    }
  }

  if (!dryRun) {
    await cleanupEmptyDirs(FEEDS_DIR);
  }

  console.log(`\n${dryRun ? '[DRY-RUN] ' : ''}Cleanup complete: ${kept} kept, ${removed} removed (total: ${files.length})`);
}

await main();
