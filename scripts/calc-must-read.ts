#!/usr/bin/env bun

import { existsSync } from 'fs';
import { mkdir, readFile, readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { mustReadSchema, type MustRead } from '../src/schemas/must-read';

const ROOT = process.cwd();
const MUST_READ_DIR = join(ROOT, 'src/data/must-read');
const TRENDING_DIR = join(ROOT, 'src/data/trending');

interface TrendingFile {
  items?: Array<{ top_articles?: string[] }>;
}

export async function getLatestTrending(): Promise<TrendingFile | null> {
  if (!existsSync(TRENDING_DIR)) {
    return null;
  }

  try {
    const files = await readdir(TRENDING_DIR);
    const jsonFiles = files.filter((file) => file.endsWith('.json')).sort().reverse();
    if (jsonFiles.length === 0) {
      return null;
    }

    return JSON.parse(await readFile(join(TRENDING_DIR, jsonFiles[0]), 'utf-8')) as TrendingFile;
  } catch {
    return null;
  }
}

export async function generateMustRead(today = new Date()): Promise<{ filePath: string; data: MustRead }> {
  const date = today.toISOString().split('T')[0] ?? today.toISOString();
  const trending = await getLatestTrending();
  const topArticleIds: string[] = [];

  for (const item of trending?.items?.slice(0, 3) ?? []) {
    topArticleIds.push(...(item.top_articles ?? []));
  }

  const data = mustReadSchema.parse({
    id: `must-read-${date}`,
    date,
    items: [...new Set(topArticleIds)].slice(0, 10),
    pinned_by: undefined,
  });

  await mkdir(MUST_READ_DIR, { recursive: true });
  const filePath = join(MUST_READ_DIR, `${date}.json`);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  return { filePath, data };
}

if (import.meta.main) {
  const { filePath } = await generateMustRead();
  console.log(`✅ Must-read generated: ${filePath}`);
}
