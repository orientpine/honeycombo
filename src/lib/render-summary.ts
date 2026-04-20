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
            `<ul class="summary-list">${rest.map((l) => `<li>${l.trimStart().slice(2)}</li>`).join('')}</ul>`,
          );
        } else {
          html.push(`<p>${rest.join('<br>')}</p>`);
        }
      }
      continue;
    }

    // Standalone list block
    if (lines.every((l) => l.trimStart().startsWith('- '))) {
      html.push(
        `<ul class="summary-list">${lines.map((l) => `<li>${l.trimStart().slice(2)}</li>`).join('')}</ul>`,
      );
      continue;
    }

    // Plain paragraph (including single-line legacy descriptions)
    html.push(`<p>${lines.join('<br>')}</p>`);
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
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}
