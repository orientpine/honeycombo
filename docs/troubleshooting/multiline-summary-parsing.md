# 멀티라인 Summary 파싱 오류 — 제목과 요약이 `## 개요`로 표시됨

> `parseIssueBody`가 `### Summary` 섹션의 첫 줄만 캡처하여 멀티라인 요약 내용이 유실되고, 제목과 요약 모두 `## 개요`로 표시되는 문제.

## 증상

link-curator 플러그인으로 구조화된 한국어 요약(개요/주요 내용/시사점)을 포함하여 기사를 제출하면, HoneyCombo에 표시되는 제목과 요약이 모두 `## 개요`로 나타남. 실제 요약 내용은 완전히 유실됨.

```
제출한 Summary:
## 개요
AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사
## 주요 내용
- 에이전트 아키텍처 설계 패턴
## 시사점
실무에서 바로 적용 가능한 에이전트 구축 가이드

표시된 결과:
제목: ## 개요
요약: ## 개요
```

**재현 환경**: 모든 환경 (파서 로직 문제)

## 원인

세 가지 문제가 복합적으로 작용:

1. **`parseIssueBody`가 첫 줄만 캡처**: `### Summary` 섹션 파싱 시 `if (currentSection === 'note' && !note)` 조건으로 인해 첫 번째 비어있지 않은 줄(`## 개요`)만 `note`에 할당되고 이후 줄은 전부 무시됨.

2. **빈 줄 전역 스킵**: `if (!line || line === '_No response_') continue;` 가 note 섹션 처리보다 먼저 실행되어, 멀티라인 요약 내의 빈 줄(단락 구분)도 스킵됨.

3. **`note` 값이 제목으로 직접 사용**: `processSubmission`에서 `let title = note || url;`로 note 전체를 제목으로 사용하여, 멀티라인이든 아니든 `## 개요`가 그대로 제목이 됨.

## 해결 방법

### 1. `parseIssueBody` — 멀티라인 note 수집

note 섹션 처리를 빈 줄 스킵보다 먼저 배치하고, 배열로 전체 라인을 수집하도록 변경:

```diff
+ const noteLines: string[] = [];
  // ...
  for (const line of lines) {
    // 섹션 헤더 감지 (기존 동일)...

+   if (currentSection === 'note') {
+     if (line !== '_No response_') {
+       noteLines.push(line);
+     }
+     continue;
+   }

    if (!line || line === '_No response_') { continue; }
    // 기타 섹션 처리 (기존 동일)...
-   if (currentSection === 'note' && !note) {
-     note = line;
-   }
  }

+ note = noteLines.join('\n').trim();
```

### 2. `extractTitleFromNote` — 제목 파생 로직 추가

멀티라인 note에서 첫 번째 비-헤딩 콘텐츠 줄을 제목으로 추출:

```typescript
export function extractTitleFromNote(note: string): string {
  if (!note) return '';
  const lines = note.split('\n').map((l) => l.trim()).filter(Boolean);
  const contentLine = lines.find((line) => !line.startsWith('#'));
  if (contentLine) return contentLine;
  return lines[0]?.replace(/^#+\s*/, '') || '';
}
```

### 3. `processSubmission` / `processBulkSubmission` — 제목 파생 변경

```diff
- let title = note || url;
+ let title = extractTitleFromNote(note) || url;
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `scripts/process-submission.ts` | `parseIssueBody` 멀티라인 note 수집, `extractTitleFromNote` 함수 추가, `processSubmission`/`processBulkSubmission` 제목 파생 변경 |
| `tests/process-submission.test.ts` | 멀티라인 Summary 테스트, 구조화 Summary 테스트, `extractTitleFromNote` 단위 테스트, 제목 파생 통합 테스트 추가 |

## 예방 조치

- `### Summary` 섹션은 `### URL`, `### Type`, `### Tags`와 달리 단일 값이 아닌 자유 형식 텍스트를 받는 섹션이므로, 향후 유사한 자유 형식 섹션 추가 시 동일한 멀티라인 수집 패턴을 적용해야 함.
- 대량 제출(`parseBulkIssueBody`)은 파이프 구분 단일 행 포맷이므로 이 문제와 무관함.

---

## 관련 문서

- [에이전트 제출 가이드](../guides/agent-submission.md)
- [대량 제출 기능](../features/bulk-submission.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 |
