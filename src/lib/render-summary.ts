/**
 * Lightweight markdown rendering for structured article summaries.
 *
 * Supports the Korean summary format: ## headings, bullet lists, paragraphs.
 * No external dependency — handles only the subset used by the submission spec.
 *
 * Security: all input is HTML-escaped before markdown transformation,
 * preventing XSS from user-submitted content.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Validate that a URL uses an allowed protocol.
 * Prevents javascript:, data:, vbscript: XSS injection via [text](url) syntax.
 *
 * Allowed: http(s)://..., site-relative /path, fragment #anchor.
 */
function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/|\/|#)/i.test(url);
}

/**
 * Apply inline markdown transformations to already-HTML-escaped text.
 *
 * Supported subset (CommonMark inline only):
 *   `code`             -> <code>code</code>
 *   **bold**           -> <strong>bold</strong>
 *   *italic*  _italic_ -> <em>italic</em>
 *   [text](url)        -> <a href="url" target="_blank" rel="noopener noreferrer">text</a>
 *
 * Order of operations matters:
 * 1. Code first (its content must NOT be re-processed for emphasis).
 * 2. Bold (**) before italic (*) to avoid greedy match conflicts.
 * 3. Italic with word-boundary lookarounds to skip mid-word _ in identifiers.
 * 4. Links last with protocol whitelist.
 *
 * INPUT MUST BE HTML-ESCAPED ALREADY. This function only injects safe tag
 * pairs and never introduces new HTML-significant characters from user input.
 */
export function renderInlineMarkdown(escapedText: string): string {
  if (!escapedText) return '';

  // Two-pass placeholder strategy keeps already-matched ranges (code, bold)
  // from being re-interpreted by later passes (italic). Critical for cases
  // like `**outer *inner* outer**` where the outer bold must win.
  const codePlaceholders: string[] = [];
  const boldPlaceholders: string[] = [];

  // 1. Inline code FIRST. Backticks dominate everything inside them.
  let text = escapedText.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    const idx = codePlaceholders.length;
    codePlaceholders.push(code);
    return `\u0000CODE${idx}\u0001`;
  });

  // 2. Bold (**...**) BEFORE italic, placeholder-protected so the outer bold
  //    tag pair survives intact. Bold body may contain a single * (italic),
  //    so we run the italic transform on the body BEFORE storing it.
  text = text.replace(/\*\*([^\n]+?)\*\*/g, (_match, content: string) => {
    const innerWithItalic = content
      .replace(/(^|[^*A-Za-z0-9_])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![A-Za-z0-9_])/g, '$1<em>$2</em>')
      .replace(/(^|[^A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g, '$1<em>$2</em>');
    const idx = boldPlaceholders.length;
    boldPlaceholders.push(innerWithItalic);
    return `\u0000BOLD${idx}\u0001`;
  });

  // 3. Italic (*...* or _..._). Stricter rules to avoid mid-word matches
  //    and to skip * with leading/trailing whitespace.
  text = text.replace(/(^|[^*A-Za-z0-9_])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![A-Za-z0-9_])/g, '$1<em>$2</em>');
  text = text.replace(/(^|[^A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g, '$1<em>$2</em>');

  // 4. Links: [text](url) with protocol whitelist + non-empty url.
  text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
    if (!isSafeUrl(url)) return match;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // 5. Restore bold placeholders. Their content may contain <em> from step 3,
  //    which is intended (nested italic inside bold).
  text = text.replace(/\u0000BOLD(\d+)\u0001/g, (_match, idx: string) => {
    return `<strong>${boldPlaceholders[Number(idx)]}</strong>`;
  });

  // 6. Restore code placeholders last so their content stays untouched.
  text = text.replace(/\u0000CODE(\d+)\u0001/g, (_match, idx: string) => {
    return `<code>${codePlaceholders[Number(idx)]}</code>`;
  });

  return text;
}

/**
 * Strip inline markdown markers for plain-text contexts.
 *
 * **bold** -> bold, *italic* -> italic, `code` -> code, [label](url) -> label.
 * Used by stripMarkdownForPreview to keep RSS / meta tags / card previews clean.
 */
export function stripInlineMarkdown(text: string): string {
  if (!text) return '';
  // Mirror renderInlineMarkdown's two-pass placeholder strategy so nested
  // patterns like `**outer *inner* outer**` lose BOTH outer and inner markers.
  const codePlaceholders: string[] = [];
  const boldPlaceholders: string[] = [];

  let result = text.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    const idx = codePlaceholders.length;
    codePlaceholders.push(code);
    return `\u0000CODE${idx}\u0001`;
  });

  result = result.replace(/\*\*([^\n]+?)\*\*/g, (_match, content: string) => {
    const innerStripped = content
      .replace(/(^|[^*A-Za-z0-9_])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![A-Za-z0-9_])/g, '$1$2')
      .replace(/(^|[^A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g, '$1$2');
    const idx = boldPlaceholders.length;
    boldPlaceholders.push(innerStripped);
    return `\u0000BOLD${idx}\u0001`;
  });

  result = result
    .replace(/(^|[^*A-Za-z0-9_])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![A-Za-z0-9_])/g, '$1$2')
    .replace(/(^|[^A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g, '$1$2')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1');

  result = result.replace(/\u0000BOLD(\d+)\u0001/g, (_match, idx: string) => {
    return boldPlaceholders[Number(idx)];
  });
  result = result.replace(/\u0000CODE(\d+)\u0001/g, (_match, idx: string) => {
    return codePlaceholders[Number(idx)];
  });
  return result;
}

/**
 * Convert structured summary markdown to HTML for the detail view.
 *
 * Input format (from agent-submission spec):
 *   ## 개요
 *   AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사
 *   ## 주요 내용
 *   - 에이전트 아키텍처 설계 패턴
 *   - 프로덕션 배포 시 고려사항
 *   ## 시사점
 *   실무에서 바로 적용 가능한 에이전트 구축 가이드
 *
 * Also handles plain single-line descriptions for backward compatibility.
 */
export function renderSummaryHtml(markdown: string): string {
  if (!markdown) return '';

  const escaped = escapeHtml(markdown);
  const blocks = escaped.split(/\n\n+/);
  const html: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');

    // Heading block: starts with ## (level-2 heading)
    if (lines[0].startsWith('## ')) {
      html.push(`<h3 class="summary-heading">${lines[0].slice(3)}</h3>`);
      // Remaining lines in the same block are body text
      const rest = lines.slice(1).filter((l) => l.trim());
      if (rest.length > 0) {
        if (rest.every((l) => l.trimStart().startsWith('- '))) {
          html.push(
            `<ul class="summary-list">${rest.map((l) => `<li>${renderInlineMarkdown(l.trimStart().slice(2))}</li>`).join('')}</ul>`,
          );
        } else {
          html.push(`<p>${renderInlineMarkdown(rest.join('<br>'))}</p>`);
        }
      }
      continue;
    }

    // Standalone list block
    if (lines.every((l) => l.trimStart().startsWith('- '))) {
      html.push(
        `<ul class="summary-list">${lines.map((l) => `<li>${renderInlineMarkdown(l.trimStart().slice(2))}</li>`).join('')}</ul>`,
      );
      continue;
    }

    // Plain paragraph (including single-line legacy descriptions)
    html.push(`<p>${renderInlineMarkdown(lines.join('<br>'))}</p>`);
  }

  return html.join('');
}

/**
 * Strip markdown markers for plain-text contexts (card previews, meta tags, RSS).
 *
 * Converts structured markdown to a clean single-line text suitable for
 * <meta> tags, RSS descriptions, and 2-line card previews.
 */
export function stripMarkdownForPreview(markdown: string): string {
  if (!markdown) return '';
  const blockStripped = markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
  return stripInlineMarkdown(blockStripped);
}
