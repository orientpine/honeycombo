import { describe, expect, it } from 'vitest';
import {
  renderInlineMarkdown,
  renderSummaryHtml,
  stripInlineMarkdown,
  stripMarkdownForPreview,
} from '../src/lib/render-summary';

describe('renderSummaryHtml', () => {
  it('renders full structured Korean summary as HTML', () => {
    const md = [
      '## 개요',
      'AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사',
      '',
      '## 주요 내용',
      '- 에이전트 아키텍처 설계 패턴',
      '- 프로덕션 배포 시 고려사항',
      '',
      '## 시사점',
      '실무에서 바로 적용 가능한 에이전트 구축 가이드',
    ].join('\n');
    const html = renderSummaryHtml(md);

    expect(html).toContain('<h3 class="summary-heading">개요</h3>');
    expect(html).toContain('<p>AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사</p>');
    expect(html).toContain('<h3 class="summary-heading">주요 내용</h3>');
    expect(html).toContain('<li>에이전트 아키텍처 설계 패턴</li>');
    expect(html).toContain('<li>프로덕션 배포 시 고려사항</li>');
    expect(html).toContain('<h3 class="summary-heading">시사점</h3>');
    expect(html).toContain('<p>실무에서 바로 적용 가능한 에이전트 구축 가이드</p>');
  });

  it('renders single-line plain description as paragraph', () => {
    expect(renderSummaryHtml('A great AI article.')).toBe('<p>A great AI article.</p>');
  });

  it('returns empty string for empty input', () => {
    expect(renderSummaryHtml('')).toBe('');
  });

  it('escapes HTML entities to prevent XSS', () => {
    const html = renderSummaryHtml('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('handles heading-only block without body text', () => {
    const html = renderSummaryHtml('## 제목만');
    expect(html).toBe('<h3 class="summary-heading">제목만</h3>');
  });

  it('handles standalone bullet list', () => {
    const html = renderSummaryHtml('- 항목 1\n- 항목 2\n- 항목 3');
    expect(html).toContain('<ul class="summary-list">');
    expect(html).toContain('<li>항목 1</li>');
    expect(html).toContain('<li>항목 2</li>');
    expect(html).toContain('<li>항목 3</li>');
  });
});

describe('stripMarkdownForPreview', () => {
  it('extracts only the body of the first ## section, omitting heading labels', () => {
    const md = '## 개요\nAI 에이전트를 프로덕션 환경에서 활용\n\n## 주요 내용\n- 설계 패턴';
    const result = stripMarkdownForPreview(md);

    // Heading markers AND heading labels (개요, 주요 내용) must NOT leak into preview.
    // Every article starts with "## 개요" so showing the label is awkward visual noise.
    expect(result).not.toContain('##');
    expect(result).not.toContain('개요');
    expect(result).not.toContain('주요 내용');
    // The body of the first section IS the canonical summary.
    expect(result).toBe('AI 에이전트를 프로덕션 환경에서 활용');
  });

  it('converts bullet markers to bullet symbols', () => {
    const result = stripMarkdownForPreview('- item 1\n- item 2');
    expect(result).toContain('• item 1');
    expect(result).toContain('• item 2');
  });

  it('returns plain text as-is', () => {
    expect(stripMarkdownForPreview('A great article.')).toBe('A great article.');
  });

  it('returns empty string for empty input', () => {
    expect(stripMarkdownForPreview('')).toBe('');
  });

  it('collapses multiline into single line', () => {
    const result = stripMarkdownForPreview('Line 1\n\nLine 2\nLine 3');
    expect(result).not.toContain('\n');
  });

  it('falls through to the next section when the first section body is empty', () => {
    // Defensive: if a malformed summary has an empty first section,
    // we should still surface SOMETHING useful rather than an empty string.
    const result = stripMarkdownForPreview('## 개요\n\n## 주요 내용\n실제 내용');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('실제 내용');
  });

  it('handles structured summary with bullet body', () => {
    const md = '## 개요\n- 첫번째 포인트\n- 두번째 포인트\n\n## 시사점\n결론';
    const result = stripMarkdownForPreview(md);
    expect(result).not.toContain('개요');
    expect(result).not.toContain('시사점');
    expect(result).toContain('• 첫번째 포인트');
    expect(result).toContain('• 두번째 포인트');
  });

  it('preserves single-section structured summary body', () => {
    const result = stripMarkdownForPreview('## 개요\n첫번째 섹션 내용입니다.');
    expect(result).toBe('첫번째 섹션 내용입니다.');
  });
});

describe('renderInlineMarkdown', () => {
  it('renders **bold** as <strong>', () => {
    expect(renderInlineMarkdown('Hello **world**')).toBe('Hello <strong>world</strong>');
  });

  it('renders Korean **bold** as <strong>', () => {
    expect(renderInlineMarkdown('**디지털 증거 인증의 어려움**: AI 딥페이크')).toBe(
      '<strong>디지털 증거 인증의 어려움</strong>: AI 딥페이크',
    );
  });

  it('renders *italic* as <em>', () => {
    expect(renderInlineMarkdown('Hello *world*')).toBe('Hello <em>world</em>');
  });

  it('renders _italic_ as <em>', () => {
    expect(renderInlineMarkdown('Hello _world_')).toBe('Hello <em>world</em>');
  });

  it('does NOT match _ inside identifiers (snake_case_var)', () => {
    expect(renderInlineMarkdown('snake_case_var stays')).toBe('snake_case_var stays');
  });

  it('renders inline `code` as <code>', () => {
    expect(renderInlineMarkdown('Run `bun test` to verify')).toBe(
      'Run <code>bun test</code> to verify',
    );
  });

  it('protects code content from emphasis processing', () => {
    // The * inside code must NOT become italic
    expect(renderInlineMarkdown('use `*ptr` to deref')).toBe('use <code>*ptr</code> to deref');
  });

  it('renders [text](https://...) as anchor with target=_blank', () => {
    const html = renderInlineMarkdown('See [docs](https://example.com/docs)');
    expect(html).toContain('<a href="https://example.com/docs"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('>docs</a>');
  });

  it('renders site-relative [text](/path) link', () => {
    const html = renderInlineMarkdown('Go to [home](/)');
    expect(html).toContain('<a href="/"');
  });

  it('REJECTS [text](javascript:...) URL (XSS protection)', () => {
    const input = '[click](javascript:alert(1))';
    const html = renderInlineMarkdown(input);
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('href=');
    expect(html).toBe(input);
  });

  it('combines bold + italic + code in one line', () => {
    expect(renderInlineMarkdown('**bold** and *italic* and `code`')).toBe(
      '<strong>bold</strong> and <em>italic</em> and <code>code</code>',
    );
  });

  it('returns empty string for empty input', () => {
    expect(renderInlineMarkdown('')).toBe('');
  });

  it('integration: full structured Korean summary with inline bold renders correctly', () => {
    const md = [
      '## 주요 내용',
      '- **디지털 증거 인증의 어려움**: AI 딥페이크 기술로 인해 비디오 진위 입증이 어려움',
      '- **법원의 증거 인증 요구 사항**: FRE 901(b)(9) 적용',
    ].join('\n');
    const html = renderSummaryHtml(md);
    expect(html).toContain('<strong>디지털 증거 인증의 어려움</strong>');
    expect(html).toContain('<strong>법원의 증거 인증 요구 사항</strong>');
    expect(html).toContain('<h3 class="summary-heading">주요 내용</h3>');
    expect(html).toContain('<ul class="summary-list">');
  });

  it('handles nested **outer *inner* outer** bold-with-italic', () => {
    expect(renderInlineMarkdown('**outer *inner* outer**')).toBe(
      '<strong>outer <em>inner</em> outer</strong>',
    );
  });

  it('does NOT mangle unmatched ** markers', () => {
    // Unmatched bold survives as raw text rather than producing broken HTML.
    expect(renderInlineMarkdown('**foo')).toBe('**foo');
  });

  it('does NOT render [label]() with empty url', () => {
    // Empty URL fails the protocol whitelist (isSafeUrl returns false).
    expect(renderInlineMarkdown('[label]()')).toBe('[label]()');
  });

  it('handles bold containing _underscore italic_', () => {
    expect(renderInlineMarkdown('**bold with _italic_ inside**')).toBe(
      '<strong>bold with <em>italic</em> inside</strong>',
    );
  });

  it('does not break **a** **b** **c** sequence (idempotent multi-bold)', () => {
    expect(renderInlineMarkdown('**a** **b** **c**')).toBe(
      '<strong>a</strong> <strong>b</strong> <strong>c</strong>',
    );
  });
});

describe('stripInlineMarkdown', () => {
  it('strips **bold** markers', () => {
    expect(stripInlineMarkdown('Hello **world**')).toBe('Hello world');
  });

  it('strips *italic* markers', () => {
    expect(stripInlineMarkdown('Hello *world*')).toBe('Hello world');
  });

  it('strips `code` backticks', () => {
    expect(stripInlineMarkdown('Run `bun test`')).toBe('Run bun test');
  });

  it('strips [label](url) keeping only label text', () => {
    expect(stripInlineMarkdown('See [docs](https://example.com)')).toBe('See docs');
  });

  it('preserves snake_case identifiers', () => {
    expect(stripInlineMarkdown('use snake_case_name')).toBe('use snake_case_name');
  });

  it('returns empty string for empty input', () => {
    expect(stripInlineMarkdown('')).toBe('');
  });

  it('strips nested **outer *inner* outer** completely (no leftover markers)', () => {
    // Two-pass placeholder strategy ensures BOTH outer bold and inner italic markers are removed.
    expect(stripInlineMarkdown('**outer *inner* outer**')).toBe('outer inner outer');
  });

  it('strips multiple bold + inline code combo cleanly', () => {
    expect(stripInlineMarkdown('**bold** and `code` and **more**')).toBe(
      'bold and code and more',
    );
  });
});

describe('stripMarkdownForPreview integration with inline markers', () => {
  it('strips both block headings and inline bold for clean card preview', () => {
    const md = '## 주요 내용\n- **핵심 포인트**: 중요한 내용\n- **두 번째 포인트**: 추가 설명';
    const result = stripMarkdownForPreview(md);
    expect(result).not.toContain('##');
    expect(result).not.toContain('**');
    // Heading labels are stripped from previews — only first-section body content remains.
    expect(result).not.toContain('주요 내용');
    expect(result).toContain('• 핵심 포인트: 중요한 내용');
    expect(result).toContain('• 두 번째 포인트: 추가 설명');
  });

  it('strips inline code from previews', () => {
    expect(stripMarkdownForPreview('Run the `bun test` command.')).toContain('Run the bun test command.');
  });

  it('strips link syntax keeping label', () => {
    expect(stripMarkdownForPreview('Read [the docs](https://example.com) carefully.')).toBe(
      'Read the docs carefully.',
    );
  });
});
