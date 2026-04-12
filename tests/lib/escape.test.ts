import { describe, expect, it } from 'vitest';
import { escapeAttr, escapeHtml } from '../../functions/lib/escape';

describe('escapeHtml', () => {
  it('escapes script tags', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('escapes normal strings only where needed', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('handles empty strings and unicode', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml('안녕 & <세상>')).toBe('안녕 &amp; &lt;세상&gt;');
  });
});

describe('escapeAttr', () => {
  it('escapes attribute payloads', () => {
    expect(escapeAttr('" onerror="alert(1)')).toBe('&quot; onerror=&quot;alert(1)');
  });

  it('escapes javascript urls and apostrophes safely', () => {
    expect(escapeAttr("javascript:alert('xss')")).toBe('javascript:alert(&#39;xss&#39;)');
  });

  it('preserves safe unicode text', () => {
    expect(escapeAttr('데이터-속성')).toBe('데이터-속성');
  });
});
