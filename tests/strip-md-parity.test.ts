/**
 * Anti-drift safeguard for the markdown stripping logic that is duplicated
 * across 5 runtimes:
 *
 *   - src/lib/render-summary.ts          stripMarkdownForPreview() (Astro SSG)
 *   - functions/lib/escape.ts            stripMd()                 (Cloudflare Functions)
 *   - public/scripts/must-read-page.js   stripMd()                 (Browser must-read)
 *   - src/components/InterestTagPanel.astro stripMd()                 (Browser articles page)
 *   - src/pages/admin/must-read.astro    stripMd()                 (Browser admin)
 *
 * This test file does TWO things:
 * 1. Behavioural parity — runs each implementation against a shared corpus and
 *    asserts identical outputs.
 * 2. Source-code parity — extracts the 7 critical regex lines from each file
 *    and asserts byte-for-byte equality, so drift fails the CI BEFORE causing
 *    a runtime regression.
 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { stripMarkdownForPreview } from '../src/lib/render-summary';
import { stripMd as cfStripMd } from '../functions/lib/escape';

const ROOT = process.cwd();

// Shared corpus covering production-realistic patterns.
const CORPUS: Array<{ name: string; input: string; expected: string }> = [
  {
    name: 'plain text untouched',
    input: 'A simple description without any markdown.',
    expected: 'A simple description without any markdown.',
  },
  {
    name: 'block heading stripped',
    input: '## 개요\n본문',
    expected: '개요 본문',
  },
  {
    name: 'bullet markers normalized',
    input: '- 첫째\n- 둘째',
    expected: '\u2022 첫째 \u2022 둘째',
  },
  {
    name: 'inline **bold** marker stripped (Korean — user complaint)',
    input: '**디지털 증거 인증의 어려움**: AI 딥페이크',
    expected: '디지털 증거 인증의 어려움: AI 딥페이크',
  },
  {
    name: 'inline `code` backticks stripped',
    input: 'Run `bun test` to verify.',
    expected: 'Run bun test to verify.',
  },
  {
    name: '*italic* marker stripped',
    input: 'Hello *world*',
    expected: 'Hello world',
  },
  {
    name: '[link](url) keeps only label',
    input: 'See [docs](https://example.com).',
    expected: 'See docs.',
  },
  {
    name: 'snake_case identifier preserved',
    input: 'use snake_case_var here',
    expected: 'use snake_case_var here',
  },
  {
    name: 'mixed structured Korean summary collapsed to clean preview',
    input: '## 주요 내용\n- **핵심 포인트**: 중요한 내용',
    expected: '주요 내용 \u2022 핵심 포인트: 중요한 내용',
  },
];

/**
 * Browser implementations are vanilla JS / Astro <script> blocks. Rather than
 * import them through a runtime (which would require a DOM), we extract the
 * stripMd function source from each file with a regex and `eval` it inside a
 * sandbox to compare behaviour. This is test-only code; never used at runtime.
 */
async function loadStripMdFromFile(relativePath: string, options: { wrappedInAstroScript?: boolean } = {}): Promise<(text: string) => string> {
  const source = await readFile(join(ROOT, relativePath), 'utf-8');
  // Match `function stripMd(text: string): string { ... }` or `function stripMd(text) { ... }`
  // Each file uses 2 or 4 space indentation, so be permissive.
  const match = source.match(/function\s+stripMd\s*\([^)]*\)(?:\s*:\s*string)?\s*\{[\s\S]*?\n\s*\}/);
  if (!match) {
    throw new Error(`Could not extract stripMd from ${relativePath}`);
  }
  // Strip the optional ': string' return type annotation and ': string' parameter type
  // so eval() in plain JS context succeeds.
  const stripped = match[0]
    .replace(/:\s*string/g, '')
    .replace(/\bString\(text\)/g, 'text');
  // Wrap as expression returning the function.
  // eslint-disable-next-line no-new-func
  const factory = new Function(`${stripped}; return stripMd;`);
  return factory() as (text: string) => string;
}

describe('stripMd parity across all 5 implementations', () => {
  let implementations: Array<{ name: string; fn: (text: string) => string }>;

  it('loads all implementations successfully', async () => {
    const browserMustRead = await loadStripMdFromFile('public/scripts/must-read-page.js');
    const tagFilter = await loadStripMdFromFile('src/components/InterestTagPanel.astro');
    const adminMustRead = await loadStripMdFromFile('src/pages/admin/must-read.astro');

    implementations = [
      { name: 'src/lib/render-summary.ts (stripMarkdownForPreview)', fn: stripMarkdownForPreview },
      { name: 'functions/lib/escape.ts (stripMd)', fn: cfStripMd },
      { name: 'public/scripts/must-read-page.js (stripMd)', fn: browserMustRead },
      { name: 'src/components/InterestTagPanel.astro (stripMd)', fn: tagFilter },
      { name: 'src/pages/admin/must-read.astro (stripMd)', fn: adminMustRead },
    ];

    expect(implementations).toHaveLength(5);
  });

  for (const testCase of CORPUS) {
    it(`all 5 implementations agree on: ${testCase.name}`, async () => {
      // Lazy-load if first test in the suite hasn't populated `implementations` yet.
      if (!implementations) {
        const browserMustRead = await loadStripMdFromFile('public/scripts/must-read-page.js');
        const tagFilter = await loadStripMdFromFile('src/components/InterestTagPanel.astro');
        const adminMustRead = await loadStripMdFromFile('src/pages/admin/must-read.astro');
        implementations = [
          { name: 'src/lib/render-summary.ts', fn: stripMarkdownForPreview },
          { name: 'functions/lib/escape.ts', fn: cfStripMd },
          { name: 'public/scripts/must-read-page.js', fn: browserMustRead },
          { name: 'src/components/InterestTagPanel.astro', fn: tagFilter },
          { name: 'src/pages/admin/must-read.astro', fn: adminMustRead },
        ];
      }

      const results = implementations.map(({ name, fn }) => ({ name, output: fn(testCase.input) }));

      // All implementations must produce the same output.
      const distinct = new Set(results.map((r) => r.output));
      if (distinct.size > 1) {
        const debug = results.map((r) => `  - ${r.name}: ${JSON.stringify(r.output)}`).join('\n');
        throw new Error(
          `stripMd implementations diverged for "${testCase.name}":\n${debug}\n\nKeep all 5 implementations in sync. See docs/troubleshooting/inline-markdown-rendering.md`,
        );
      }

      // And that single output must equal the expected value.
      expect(results[0].output).toBe(testCase.expected);
    });
  }
});

describe('stripMd source-regex byte parity (catches drift before runtime)', () => {
  // Tokens that MUST appear byte-equal in EVERY one of the 5 stripMd implementations.
  // If you change any of these, you must change ALL FIVE files.
  // Source of truth: src/lib/render-summary.ts (stripMarkdownForPreview / stripInlineMarkdown).
  const REQUIRED_TOKENS_ALL = [
    String.raw`/^#{1,6}\s+/gm`,
    String.raw`/^[-*]\s+/gm`,
    String.raw`/\n{2,}/g`,
    '/`([^`\\n]+)`/g',
    String.raw`/(^|[^*A-Za-z0-9_])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![A-Za-z0-9_])/g`,
    String.raw`/(^|[^A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g`,
    String.raw`/\[([^\]\n]+)\]\([^)\s]+\)/g`,
  ];

  // Bold pattern intentionally diverges:
  //   render-summary.ts uses /\*\*([^\n]+?)\*\*/g (allows internal *) for nested bold support
  //     via two-pass placeholder strategy.
  //   Other 4 files use /\*\*([^*\n]+?)\*\*/g (single-line strict) because they don't
  //     run a placeholder pass; nested bold passes through to plain text via stripMarkdownForPreview.
  // Both are accepted, but each file must use exactly one of these forms.
  const BOLD_PATTERN_OPTIONS = [
    String.raw`/\*\*([^\n]+?)\*\*/g`,         // render-summary.ts only
    String.raw`/\*\*([^*\n]+?)\*\*/g`,        // simple form for the other 4 files
  ];

  const FILES = [
    'src/lib/render-summary.ts',
    'functions/lib/escape.ts',
    'public/scripts/must-read-page.js',
    'src/components/InterestTagPanel.astro',
    'src/pages/admin/must-read.astro',
  ];

  for (const file of FILES) {
    it(`${file} contains all required regex tokens (byte parity)`, async () => {
      const source = await readFile(join(ROOT, file), 'utf-8');
      const missing = REQUIRED_TOKENS_ALL.filter((token) => !source.includes(token));
      const hasSomeBold = BOLD_PATTERN_OPTIONS.some((token) => source.includes(token));

      const errors: string[] = [];
      if (missing.length > 0) {
        errors.push(
          `Missing ${missing.length} required regex token(s):\n` +
            missing.map((t) => `  - ${t}`).join('\n'),
        );
      }
      if (!hasSomeBold) {
        errors.push(
          `Missing a recognized bold-strip pattern. Must contain ONE of:\n` +
            BOLD_PATTERN_OPTIONS.map((t) => `  - ${t}`).join('\n'),
        );
      }
      if (errors.length > 0) {
        throw new Error(
          `${file} drifted:\n${errors.join('\n')}\n\n` +
            `Update this file to match the source of truth (src/lib/render-summary.ts).\n` +
            `See docs/troubleshooting/inline-markdown-rendering.md`,
        );
      }
      expect(missing).toEqual([]);
      expect(hasSomeBold).toBe(true);
    });
  }
});
