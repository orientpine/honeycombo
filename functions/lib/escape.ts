const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_ESCAPE_REGEX = /[&<>"']/g;

export function escapeHtml(s: string): string {
  return s.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char]);
}

export function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/**
 * Strip markdown markers for plain-text contexts (search previews, must-read cards).
 *
 * For structured Korean summaries (## 개요 / ## 주요 내용 / ## 시사점), returns the
 * body of the FIRST section only — every article shares the same overview heading,
 * so the label "개요" is visual noise on cards. Mirrors
 * src/lib/render-summary.ts stripMarkdownForPreview().
 */
export function stripMd(text: string): string {
  if (!text) return '';
  // Structured summary path: split on ## boundaries, return first non-empty body.
  if (/^##\s+/m.test(text)) {
    const sections = text.split(/(?:^|\n)##\s+[^\n]*\n?/);
    for (const section of sections) {
      if (section.trim()) {
        return flattenMd(section);
      }
    }
    return '';
  }
  return flattenMd(text);
}

function flattenMd(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    // Inline markdown markers — keep for plain-text consistency with src/lib/render-summary.ts.
    // Order: code first, then **bold**, then *italic* / _italic_, then [text](url).
    .replace(/`([^`\n]+)`/g, '$1')
    // Bold uses [^\n]+? (allows internal *) so nested **outer *inner* outer** strips fully
    // — all 5 implementations must use this form for parity.
    .replace(/\*\*([^\n]+?)\*\*/g, '$1')
    .replace(/(^|[^*A-Za-z0-9_])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![A-Za-z0-9_])/g, '$1$2')
    .replace(/(^|[^A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g, '$1$2')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .trim();
}
