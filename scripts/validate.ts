#!/usr/bin/env bun

import { readdir, readFile } from 'fs/promises';
import type { Dirent } from 'fs';
import { extname, join, relative } from 'path';
import { curatedArticleSchema } from '../src/schemas/curated-article';
import { feedArticleSchema } from '../src/schemas/feed-article';
import type { ZodTypeAny } from 'zod';

const ROOT = process.cwd();

type ValidationResult =
  | { file: string; valid: true; data: unknown }
  | { file: string; valid: false; errors: string[] };

type Collection = {
  name: string;
  dir: string;
  schema: ZodTypeAny;
};

const collections: Collection[] = [
  {
    name: 'curated articles',
    dir: join(ROOT, 'src/content/curated'),
    schema: curatedArticleSchema,
  },
  {
    name: 'feed articles',
    dir: join(ROOT, 'src/data/feeds'),
    schema: feedArticleSchema,
  },
];

function displayPath(filePath: string): string {
  return relative(ROOT, filePath) || filePath;
}

async function scanJsonFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await scanJsonFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && extname(entry.name).toLowerCase() === '.json' && !entry.name.startsWith('.')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function validateFile(filePath: string, schema: ZodTypeAny): Promise<ValidationResult> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content) as unknown;
    const result = schema.safeParse(parsed);

    if (result.success) {
      return { file: filePath, valid: true, data: result.data };
    }

    return {
      file: filePath,
      valid: false,
      errors: result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `  ${path}: ${issue.message}`;
      }),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { file: filePath, valid: false, errors: [`  Parse error: ${message}`] };
  }
}

async function main(): Promise<void> {
  let hasErrors = false;
  let totalFiles = 0;
  let duplicateCount = 0;
  const seenUrls = new Map<string, string>();

  for (const collection of collections) {
    const files = await scanJsonFiles(collection.dir);

    for (const file of files) {
      totalFiles += 1;

      const result = await validateFile(file, collection.schema);
      if (!result.valid) {
        hasErrors = true;
        console.error(`❌ ${displayPath(file)} (${collection.name})`);
        for (const error of result.errors) {
          console.error(error);
        }
        continue;
      }

      const url = typeof result.data === 'object' && result.data !== null ? (result.data as { url?: unknown }).url : undefined;
      if (typeof url !== 'string') {
        continue;
      }

      const firstSeenAt = seenUrls.get(url);
      if (firstSeenAt) {
        duplicateCount += 1;
        console.warn(`⚠️  Duplicate URL: ${url}`);
        console.warn(`   First seen in: ${firstSeenAt}`);
        console.warn(`   Duplicate in:   ${displayPath(file)}`);
        continue;
      }

      seenUrls.set(url, displayPath(file));
    }
  }

  if (hasErrors) {
    console.error(`\n❌ Validation failed: ${totalFiles} files checked`);
    process.exit(1);
  }

  if (duplicateCount > 0) {
    console.warn(`\n⚠️  URL deduplication check found ${duplicateCount} duplicate${duplicateCount === 1 ? '' : 's'}.`);
  }

  console.log(`✅ All ${totalFiles} files valid`);
  process.exit(0);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error('Unexpected error:', message);
  process.exit(1);
});
