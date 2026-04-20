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

/** Strip markdown markers for plain-text contexts (search previews, must-read cards). */
export function stripMd(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    // Inline markdown markers — keep for plain-text consistency with src/lib/render-summary.ts.
    // Order: code first, then **bold**, then *italic* / _italic_, then [text](url).
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\s][^*\n]*?)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g, '$1$2')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .trim();
}
