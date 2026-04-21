#!/usr/bin/env bun

import { execSync } from 'child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { extname, join } from 'path';

const ROOT = process.cwd();
const CURATED_DIR = join(ROOT, 'src/content/curated');
const WRANGLER_CONFIG_PATH = join(ROOT, 'wrangler.jsonc');
const DEFAULT_BATCH_SIZE = 50;

type JsonObject = Record<string, unknown>;

export interface SubmissionInsertValues {
  articleId: string;
  submittedById: string;
  title: string;
  url: string;
  createdAt: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getRequiredString(article: JsonObject, key: string): string {
  const value = article[key];
  if (!isNonEmptyString(value)) {
    throw new Error(`Missing required string field: ${key}`);
  }

  return value;
}

export function extractSubmissionInsertValues(article: JsonObject): SubmissionInsertValues | null {
  if (!isNonEmptyString(article.submitted_by_id)) {
    return null;
  }

  return {
    articleId: getRequiredString(article, 'id'),
    submittedById: article.submitted_by_id,
    title: getRequiredString(article, 'title'),
    url: getRequiredString(article, 'url'),
    createdAt: getRequiredString(article, 'submitted_at'),
  };
}

function escapeSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildInsertStatement(values: SubmissionInsertValues): string {
  return [
    'INSERT OR IGNORE INTO submissions (article_id, submitted_by_id, title, url, synced_to_playlist, created_at)',
    `VALUES (${escapeSqlString(values.articleId)}, ${escapeSqlString(values.submittedById)}, ${escapeSqlString(values.title)}, ${escapeSqlString(values.url)}, 0, ${escapeSqlString(values.createdAt)});`,
  ].join(' ');
}

export function chunkSubmissionValues(values: SubmissionInsertValues[], batchSize = DEFAULT_BATCH_SIZE): SubmissionInsertValues[][] {
  if (batchSize <= 0) {
    throw new Error('batchSize must be greater than 0');
  }

  const chunks: SubmissionInsertValues[][] = [];
  for (let index = 0; index < values.length; index += batchSize) {
    chunks.push(values.slice(index, index + batchSize));
  }
  return chunks;
}

async function listCuratedJsonFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listCuratedJsonFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && extname(entry.name).toLowerCase() === '.json') {
      files.push(fullPath);
    }
  }

  return files;
}

async function loadSubmissionValuesFromFiles(files: string[]): Promise<SubmissionInsertValues[]> {
  const inserts: SubmissionInsertValues[] = [];

  for (const filePath of files) {
    const raw = await readFile(filePath, 'utf-8');
    const article = JSON.parse(raw) as JsonObject;
    const values = extractSubmissionInsertValues(article);
    if (values) {
      inserts.push(values);
    }
  }

  return inserts;
}

function getDatabaseName(configText: string): string {
  const databaseNameMatch = configText.match(/"database_name"\s*:\s*"([^"]+)"/);
  if (!databaseNameMatch) {
    throw new Error('Could not find d1_databases[0].database_name in wrangler.jsonc');
  }

  return databaseNameMatch[1];
}

function buildWranglerArgs(databaseName: string, remote: boolean): string[] {
  return ['d1', 'execute', databaseName, remote ? '--remote' : '--local'];
}

function runWranglerCommand(args: string[]): string {
  const command = `bunx wrangler ${args.join(' ')}`;
  return execSync(command, {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function extractCountFromWranglerJson(rawOutput: string): number {
  const parsed = JSON.parse(rawOutput) as unknown;

  function visit(value: unknown): number | null {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found !== null) {
          return found;
        }
      }
      return null;
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.count === 'number') {
        return record.count;
      }

      if (typeof record.count === 'string') {
        const numericCount = Number(record.count);
        if (Number.isFinite(numericCount)) {
          return numericCount;
        }
      }

      for (const child of Object.values(record)) {
        const found = visit(child);
        if (found !== null) {
          return found;
        }
      }
    }

    return null;
  }

  const count = visit(parsed);
  if (count === null) {
    throw new Error(`Could not parse submissions count from wrangler output: ${rawOutput}`);
  }

  return count;
}

async function getSubmissionCount(databaseName: string, remote: boolean): Promise<number> {
  const output = runWranglerCommand([
    ...buildWranglerArgs(databaseName, remote),
    '--json',
    '--command',
    '"SELECT COUNT(*) AS count FROM submissions;"',
  ]);

  return extractCountFromWranglerJson(output);
}

async function executeInsertBatches(databaseName: string, remote: boolean, inserts: SubmissionInsertValues[]): Promise<void> {
  if (inserts.length === 0) {
    return;
  }

  const batchDir = await mkdtemp(join(tmpdir(), 'honeycombo-backfill-'));

  try {
    const batches = chunkSubmissionValues(inserts, DEFAULT_BATCH_SIZE);

    for (const [index, batch] of batches.entries()) {
      const sql = `${batch.map(buildInsertStatement).join('\n')}\n`;
      const sqlFilePath = join(batchDir, `batch-${index + 1}.sql`);
      await writeFile(sqlFilePath, sql, 'utf-8');

      runWranglerCommand([
        ...buildWranglerArgs(databaseName, remote),
        `--file="${sqlFilePath}"`,
      ]);
    }
  } finally {
    await rm(batchDir, { recursive: true, force: true });
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const remote = argv.includes('--remote');
  const wranglerConfig = await readFile(WRANGLER_CONFIG_PATH, 'utf-8');
  const databaseName = getDatabaseName(wranglerConfig);
  const files = await listCuratedJsonFiles(CURATED_DIR);
  const inserts = await loadSubmissionValuesFromFiles(files);

  const beforeCount = await getSubmissionCount(databaseName, remote);
  await executeInsertBatches(databaseName, remote, inserts);
  const afterCount = await getSubmissionCount(databaseName, remote);

  const inserted = Math.max(afterCount - beforeCount, 0);
  const skipped = Math.max(inserts.length - inserted, 0);

  console.log(
    `Scanned: ${files.length} files | With submitted_by_id: ${inserts.length} | Inserted: ${inserted} | Skipped (already exist): ${skipped}`,
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('Unexpected error:', message);
    process.exit(1);
  });
}
