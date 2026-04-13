import { describe, expect, it } from 'vitest';
import {
  analyzeChangeCoverage,
  getDocType,
  validateCommonFormat,
  validateDecision,
  validateFeature,
  validateTroubleshooting,
} from '../../scripts/validate-docs';

const validCommonDoc = `# 문서 제목

> 한 줄 요약

## 본문

내용

---

## 관련 문서

- [관련 문서](../path/to/doc.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
`;

const validFeatureDoc = `# 기능 문서

> 한 줄 요약

## 개요

설명

## 동작 흐름

설명

## 관련 파일

설명

## 설정값

설명

## 제약 사항

설명

---

## 관련 문서

- [관련 문서](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
`;

const validDecisionDoc = `# 0002: 결정 문서

> 상태: **제안**

## 맥락

설명

## 결정

설명

## 고려한 대안

설명

## 결과

설명

## 관련 문서

- [관련 문서](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
`;

const validTroubleshootingDoc = `# 문제 해결 문서

> 한 줄 요약

## 증상

설명

## 원인

설명

## 해결 방법

설명

## 관련 파일

설명

## 예방 조치

설명

## 관련 문서

- [관련 문서](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
`;

describe('validateCommonFormat', () => {
  it('passes valid doc with all required sections', () => {
    expect(validateCommonFormat(validCommonDoc)).toEqual([]);
  });

  it('fails when title heading is missing', () => {
    expect(validateCommonFormat(validCommonDoc.replace('# 문서 제목', '문서 제목'))).toContain('제목 (# )');
  });

  it('fails when summary blockquote is missing', () => {
    expect(validateCommonFormat(validCommonDoc.replace('> 한 줄 요약', '한 줄 요약'))).toContain('요약 (> )');
  });

  it('fails when 관련 문서 section is missing', () => {
    expect(validateCommonFormat(validCommonDoc.replace('## 관련 문서', '## 참고'))).toContain('관련 문서');
  });

  it('fails when 변경 이력 section is missing', () => {
    expect(validateCommonFormat(validCommonDoc.replace('## 변경 이력', '## 히스토리'))).toContain('변경 이력');
  });

  it('returns multiple errors when multiple sections missing', () => {
    expect(validateCommonFormat(`# 문서 제목\n\n본문`)).toEqual(['요약 (> )', '관련 문서', '변경 이력']);
  });
});

describe('validateFeature', () => {
  it('passes valid feature doc', () => {
    expect(validateFeature(validFeatureDoc)).toEqual([]);
  });

  it('fails when 개요 section is missing', () => {
    expect(validateFeature(validFeatureDoc.replace('## 개요', '## 소개'))).toContain('개요');
  });

  it('fails when 동작 흐름 section is missing', () => {
    expect(validateFeature(validFeatureDoc.replace('## 동작 흐름', '## 흐름'))).toContain('동작 흐름');
  });

  it('fails when 관련 파일 section is missing', () => {
    expect(validateFeature(validFeatureDoc.replace('## 관련 파일', '## 파일'))).toContain('관련 파일');
  });

  it('fails when 설정값 section is missing', () => {
    expect(validateFeature(validFeatureDoc.replace('## 설정값', '## 환경변수'))).toContain('설정값');
  });

  it('fails when 제약 사항 section is missing', () => {
    expect(validateFeature(validFeatureDoc.replace('## 제약 사항', '## 제한 사항'))).toContain('제약 사항');
  });
});

describe('validateDecision', () => {
  it('passes valid decision doc', () => {
    expect(validateDecision(validDecisionDoc)).toEqual([]);
  });

  it('fails when 맥락 section is missing', () => {
    expect(validateDecision(validDecisionDoc.replace('## 맥락', '## 배경'))).toContain('맥락');
  });

  it('fails when 결정 section is missing', () => {
    expect(validateDecision(validDecisionDoc.replace('## 결정', '## 선택'))).toContain('결정');
  });

  it('fails when 고려한 대안 section is missing', () => {
    expect(validateDecision(validDecisionDoc.replace('## 고려한 대안', '## 대안'))).toContain('고려한 대안');
  });

  it('fails when 결과 section is missing', () => {
    expect(validateDecision(validDecisionDoc.replace('## 결과', '## 영향'))).toContain('결과');
  });

  it('fails when status keyword is missing', () => {
    expect(validateDecision(validDecisionDoc.replace('> 상태: **제안**', '> 상태: **검토 중**'))).toContain(
      '상태 키워드 (제안/승인/폐기/대체됨)',
    );
  });

  it('passes with 승인 status', () => {
    expect(validateDecision(validDecisionDoc.replace('제안', '승인'))).toEqual([]);
  });

  it('passes with 폐기 status', () => {
    expect(validateDecision(validDecisionDoc.replace('제안', '폐기'))).toEqual([]);
  });

  it('passes with 대체됨 status', () => {
    expect(validateDecision(validDecisionDoc.replace('제안', '대체됨'))).toEqual([]);
  });
});

describe('validateTroubleshooting', () => {
  it('passes valid troubleshooting doc', () => {
    expect(validateTroubleshooting(validTroubleshootingDoc)).toEqual([]);
  });

  it('fails when 증상 section is missing', () => {
    expect(validateTroubleshooting(validTroubleshootingDoc.replace('## 증상', '## 현상'))).toContain('증상');
  });

  it('fails when 원인 section is missing', () => {
    expect(validateTroubleshooting(validTroubleshootingDoc.replace('## 원인', '## 이유'))).toContain('원인');
  });

  it('fails when 해결 방법 section is missing', () => {
    expect(validateTroubleshooting(validTroubleshootingDoc.replace('## 해결 방법', '## 해결책'))).toContain('해결 방법');
  });

  it('fails when 관련 파일 section is missing', () => {
    expect(validateTroubleshooting(validTroubleshootingDoc.replace('## 관련 파일', '## 파일'))).toContain('관련 파일');
  });
});

describe('getDocType', () => {
  it('returns feature for docs/features/xxx.md', () => {
    expect(getDocType('docs/features/example.md')).toBe('feature');
  });

  it('returns decision for docs/decisions/xxx.md', () => {
    expect(getDocType('docs/decisions/example.md')).toBe('decision');
  });

  it('returns troubleshooting for docs/troubleshooting/xxx.md', () => {
    expect(getDocType('docs/troubleshooting/example.md')).toBe('troubleshooting');
  });

  it('returns architecture for docs/architecture/xxx.md', () => {
    expect(getDocType('docs/architecture/example.md')).toBe('architecture');
  });

  it('returns guide for docs/guides/xxx.md', () => {
    expect(getDocType('docs/guides/example.md')).toBe('guide');
  });

  it('returns general for other docs paths', () => {
    expect(getDocType('docs/other/example.md')).toBe('general');
  });
});

describe('analyzeChangeCoverage', () => {
  it('warns when src/ files changed without docs/', () => {
    expect(analyzeChangeCoverage(['src/pages/index.astro'])).toEqual([
      { message: '코드 변경이 감지됐지만 docs/ 변경이 없습니다.' },
    ]);
  });

  it('warns when functions/ files changed without docs/', () => {
    expect(analyzeChangeCoverage(['functions/api/auth.ts'])).toEqual([
      { message: '코드 변경이 감지됐지만 docs/ 변경이 없습니다.' },
    ]);
  });

  it('warns when scripts/ files changed without docs/', () => {
    expect(analyzeChangeCoverage(['scripts/rss-collect.ts'])).toEqual([
      { message: '코드 변경이 감지됐지만 docs/ 변경이 없습니다.' },
    ]);
  });

  it('no warning when src/data/feeds/ only changed', () => {
    expect(analyzeChangeCoverage(['src/data/feeds/article.json'])).toEqual([]);
  });

  it('no warning when src/data/trending/ only changed', () => {
    expect(analyzeChangeCoverage(['src/data/trending/article.json'])).toEqual([]);
  });


  it('warns when src/data/influencers/ changed without docs/', () => {
    expect(analyzeChangeCoverage(['src/data/influencers/profile.json'])).toEqual([
      { message: '코드 변경이 감지됐지만 docs/ 변경이 없습니다.' },
    ]);
  });

  it('no warning when both code and docs changed', () => {
    expect(analyzeChangeCoverage(['src/pages/index.astro', 'docs/features/home.md'])).toEqual([]);
  });

  it('no warning when no code changed', () => {
    expect(analyzeChangeCoverage(['README.md'])).toEqual([]);
  });

  it('warns for mixed: excluded data + non-excluded src changes without docs', () => {
    expect(analyzeChangeCoverage(['src/data/feeds/article.json', 'src/lib/articles.ts'])).toEqual([
      { message: '코드 변경이 감지됐지만 docs/ 변경이 없습니다.' },
    ]);
  });
});
