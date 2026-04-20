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
    name: 'block heading body extracted (heading label dropped)',
    // Structured Korean summaries always start with "## 개요"; the heading label
    // is visual noise on cards. We surface only the first section's body.
    input: '## 개요\n본문',
    expected: '본문',
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
    // "주요 내용" heading label is dropped; only first section body remains.
    input: '## 주요 내용\n- **핵심 포인트**: 중요한 내용',
    expected: '• 핵심 포인트: 중요한 내용',
  },
  {
    name: 'first section empty falls through to next non-empty section body',
    // Defensive: malformed summaries with empty 개요 must still surface SOMETHING useful.
    // The body of the next non-empty section is returned, never the heading label.
    input: '## 개요\n\n## 주요 내용\n실제 내용',
    expected: '실제 내용',
  },
  {
    name: 'nested **outer *inner* outer** bold-with-italic strips fully',
    // All 5 implementations must agree: both outer bold AND inner italic markers go away.
    input: '**outer *inner* outer**',
    expected: 'outer inner outer',
  },
  {
    name: 'nested bold+italic inside structured summary first section',
    input: '## 개요\n**핵심 *개념* 설명**: 본문',
    expected: '핵심 개념 설명: 본문',
  },
  {
    name: 'all sections empty returns empty string',
    input: '## 개요\n\n## 주요 내용\n\n',
    expected: '',
  },
];

/**
 * Browser implementations are vanilla JS / Astro <script> blocks. Rather than
 * import them through a runtime (which would require a DOM), we extract the
 * stripMd function source from each file with a regex and `eval` it inside a
 * sandbox to compare behaviour. This is test-only code; never used at runtime.
 */
function extractFunctionSource(source: string, name: string): string | null {
  // Locate `function NAME(...) {` then walk forward, counting braces, until balanced.
  // Robust against nested braces inside the function body (regex literals, if blocks, etc.).
  const headerRegex = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)(?:\\s*:\\s*string)?\\s*\\{`);
  const headerMatch = source.match(headerRegex);
  if (!headerMatch || headerMatch.index === undefined) return null;
  let depth = 1;
  let i = headerMatch.index + headerMatch[0].length;
  let inString: string | null = null;
  let inRegex = false;
  let inLineComment = false;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    const prev = source[i - 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
    } else if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
    } else if (inRegex) {
      if (ch === '/' && prev !== '\\') inRegex = false;
    } else {
      if (ch === '/' && source[i + 1] === '/') {
        inLineComment = true;
      } else if (ch === '\'' || ch === '"' || ch === '`') {
        inString = ch;
      } else if (ch === '/' && (prev === '(' || prev === ',' || prev === '=' || prev === ' ')) {
        inRegex = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return source.slice(headerMatch.index, i + 1);
        }
      }
    }
    i++;
  }
  return null;
}

async function loadStripMdFromFile(relativePath: string): Promise<(text: string) => string> {
  const source = await readFile(join(ROOT, relativePath), 'utf-8');
  const stripSrc = extractFunctionSource(source, 'stripMd');
  if (!stripSrc) {
    throw new Error(`Could not extract stripMd from ${relativePath}`);
  }
  // stripMd delegates to a flattenMd helper for the regex pipeline. Pull it in too,
  // otherwise the eval sandbox sees an undefined reference.
  const flattenSrc = extractFunctionSource(source, 'flattenMd');
  if (!flattenSrc) {
    throw new Error(`Could not extract flattenMd from ${relativePath}`);
  }
  // Strip the optional ': string' return type annotation and ': string' parameter type
  // so eval() in plain JS context succeeds.
  const sanitize = (s: string) => s.replace(/:\s*string/g, '').replace(/\bString\(text\)/g, 'text');
  const combined = `${sanitize(stripSrc)}\n${sanitize(flattenSrc)}`;
  // Wrap as expression returning the function.
  // eslint-disable-next-line no-new-func
  const factory = new Function(`${combined}; return stripMd;`);
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
    // Bold uses [^\n]+? (allows internal *) so nested **outer *inner* outer** strips fully.
    // ALL 5 implementations now use this form — no divergence.
    String.raw`/\*\*([^\n]+?)\*\*/g`,
    String.raw`/(^|[^*A-Za-z0-9_])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![A-Za-z0-9_])/g`,
    String.raw`/(^|[^A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g`,
    String.raw`/\[([^\]\n]+)\]\([^)\s]+\)/g`,
  ];

  // Section-split token — must appear in all 5 implementations to enforce the
  // first-non-empty-section extraction logic. If a runtime forgets this, cards
  // will start showing the "개요" heading label again.
  const SECTION_SPLIT_TOKEN = String.raw`/(?:^|\n)##\s+[^\n]*\n?/`;

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
      const hasSectionSplit = source.includes(SECTION_SPLIT_TOKEN);

      const errors: string[] = [];
      if (missing.length > 0) {
        errors.push(
          `Missing ${missing.length} required regex token(s):\n` +
            missing.map((t) => `  - ${t}`).join('\n'),
        );
      }
      if (!hasSectionSplit) {
        errors.push(
          `Missing the section-split token. Must contain:\n  - ${SECTION_SPLIT_TOKEN}`,
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
      expect(hasSectionSplit).toBe(true);
    });
  }
});
