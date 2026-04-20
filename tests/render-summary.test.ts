import { describe, expect, it } from 'vitest';
import { renderSummaryHtml, stripMarkdownForPreview } from '../src/lib/render-summary';

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
  it('strips heading markers from structured summary', () => {
    const md = '## 개요\nAI 에이전트를 프로덕션 환경에서 활용\n\n## 주요 내용\n- 설계 패턴';
    const result = stripMarkdownForPreview(md);

    expect(result).not.toContain('##');
    expect(result).toContain('개요');
    expect(result).toContain('AI 에이전트를 프로덕션 환경에서 활용');
    expect(result).toContain('주요 내용');
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
});
