#!/usr/bin/env bun

export interface CliArgs {
  url?: string;
  type?: string;
  tags?: string;
  note?: string;
  bulkFile?: string;
  repo: string;
  dryRun?: boolean;
  help?: boolean;
}

const DEFAULT_REPO = 'orientpine/honeycombo';
const DEFAULT_TYPE = 'Article';
const SINGLE_TITLE = '📎 Submit Link';
const BULK_TITLE = '📦 Bulk Submit';
const VALID_TYPES = new Set(['Article', 'YouTube', 'X Thread', 'Threads', 'Other']);
const MAX_BULK_ITEMS = 20;
const MAX_TAGS = 5;

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { repo: DEFAULT_REPO };

  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--url':
        args.url = argv[++i];
        break;
      case '--type':
        args.type = argv[++i];
        break;
      case '--tags':
        args.tags = argv[++i];
        break;
      case '--note':
        args.note = argv[++i];
        break;
      case '--bulk':
        args.bulkFile = argv[++i];
        break;
      case '--repo':
        args.repo = argv[++i];
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--help':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }

  return args;
}

function printUsage(): void {
  console.log(`
Usage: bun run scripts/submit-cli.ts [options]

Single submission:
  --url <url>        URL to submit (required)
  --type <type>      Content type: Article, YouTube, X Thread, Threads, Other (default: Article)
  --tags <태그>      Comma-separated tags, in English (max 5)
  --note <메모>      요약 / Summary (한국어 가능)

Bulk submission:
  --bulk <file>      Path to file with multiple items (pipe-delimited)

Options:
  --repo <repo>      GitHub repo (default: orientpine/honeycombo)
  --dry-run          Print gh command without executing
  --help             Show this help

Note: Tags must be written in English. Summaries can be in Korean.
`);
}

async function checkGhCli(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['gh', 'auth', 'status'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

function normalizeType(type: string | undefined): string {
  if (!type) {
    return DEFAULT_TYPE;
  }

  return VALID_TYPES.has(type) ? type : DEFAULT_TYPE;
}

function normalizeTags(tags: string | undefined): string {
  if (!tags) {
    return '';
  }

  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS)
    .join(', ');
}

function quoteShellArg(value: string): string {
  if (value.length === 0) {
    return '""';
  }

  if (!/[\s"'`$\\]/.test(value)) {
    return value;
  }

  return `"${value.replace(/(["\\])/g, '\\$1')}"`;
}

function formatCommandForDisplay(cmd: string[]): string {
  return cmd.map((part) => quoteShellArg(part)).join(' ');
}

async function createIssue(args: {
  repo: string;
  title: string;
  body: string;
  dryRun?: boolean;
}): Promise<string | null> {
  const cmd = ['gh', 'issue', 'create', '--repo', args.repo];

  cmd.push('--title', args.title, '--body', args.body);

  if (args.dryRun) {
    console.log('Dry run — would execute:');
    console.log(formatCommandForDisplay(cmd));
    return null;
  }

  console.log(`Creating issue in ${args.repo}...`);
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  if (exitCode !== 0) {
    console.error(`Failed: ${stderr.trim() || 'Unknown gh error'}`);
    return null;
  }

  return stdout.trim();
}

async function submitSingle(args: CliArgs): Promise<void> {
  if (!args.url) {
    console.error('Error: --url is required for single submission');
    process.exit(1);
  }

  console.log('Preparing single submission...');

  const body = [
    '### URL',
    '',
    args.url,
    '',
    '### Type',
    '',
    normalizeType(args.type),
    '',
    '### Tags (comma-separated, max 5)',
    '',
    normalizeTags(args.tags),
    '',
    '### Summary',
    '',
    args.note ?? '',
  ].join('\n');

  const issueUrl = await createIssue({
    repo: args.repo,
    title: SINGLE_TITLE,
    body,
    dryRun: args.dryRun,
  });

  if (issueUrl) {
    console.log(`✅ Issue created: ${issueUrl}`);
    return;
  }

  if (!args.dryRun) {
    process.exit(1);
  }
}

async function submitBulk(args: CliArgs): Promise<void> {
  if (!args.bulkFile) {
    console.error('Error: --bulk requires a file path');
    process.exit(1);
  }

  console.log(`Reading bulk file: ${args.bulkFile}`);

  let content: string;
  try {
    content = await Bun.file(args.bulkFile).text();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: failed to read bulk file: ${message}`);
    process.exit(1);
  }

  const lines = content
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !line.trim().startsWith('#'));

  if (lines.length === 0) {
    console.error('Error: bulk file is empty or has no valid lines');
    process.exit(1);
  }

  if (lines.length > MAX_BULK_ITEMS) {
    console.warn(`Warning: ${lines.length} items found, limiting to ${MAX_BULK_ITEMS}`);
  }

  const limitedLines = lines.slice(0, MAX_BULK_ITEMS);
  console.log(`Preparing bulk submission with ${limitedLines.length} item(s)...`);

  const body = ['### Link List', '', ...limitedLines].join('\n');

  const issueUrl = await createIssue({
    repo: args.repo,
    title: BULK_TITLE,
    body,
    dryRun: args.dryRun,
  });

  if (issueUrl) {
    console.log(`✅ Bulk issue created with ${limitedLines.length} items: ${issueUrl}`);
    return;
  }

  if (!args.dryRun) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  let args: CliArgs;

  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    printUsage();
    process.exit(1);
  }

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.bulkFile && args.url) {
    console.error('Error: --bulk cannot be used together with --url');
    process.exit(1);
  }

  if (!args.dryRun) {
    console.log('Checking gh CLI authentication...');
    const ghOk = await checkGhCli();
    if (!ghOk) {
      console.error('Error: gh CLI is not installed or not authenticated.');
      console.error('Run: gh auth login');
      process.exit(1);
    }
  }

  if (args.bulkFile) {
    await submitBulk(args);
    return;
  }

  await submitSingle(args);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('Unexpected error:', message);
    process.exit(1);
  });
}
