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
    .replace(/^[-*]\s+/gm, '\u2022 ')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}
