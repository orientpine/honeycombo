# 카드 미리보기에 모든 기사가 "개요"로 시작하는 문제

> AI 생성 요약 양식이 항상 `## 개요`로 시작하기 때문에 모든 기사 카드가 `개요 …`로 시작해 시각적 노이즈가 됨. `stripMarkdownForPreview`가 첫 섹션의 본문만 노출하도록 수정.

## 증상

`/`(home), `/articles`, RSS 피드, `<meta name="description">` 등 카드/평문 미리보기 표면에서 모든 기사가 `개요 …`로 시작함.

```
실제 표시:
┌─────────────────────────────────────┐
│ Chain of Custody for Digital ...    │
│ 개요 이 콘텐츠는 AI 기반 딥페이크... │   ← 모든 카드가 "개요"로 시작
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│ OAuth vs. API Keys for Agentic AI   │
│ 개요 이 콘텐츠는 Agentic AI...       │   ← 동일
└─────────────────────────────────────┘
```

**재현 환경**: 모든 환경. `scripts/summarize-articles.ts`의 `SUMMARIZE_PROMPT`로 자동 생성된 description 또는 link-curator 수동 제출 description을 가진 모든 기사.

## 원인

1. **양식의 일관성**: 자동 요약(`scripts/summarize-articles.ts:42-71`)과 수동 제출 가이드 모두 다음 구조를 강제함:
   ```
   ## 개요
   (1~2문장 요약)

   ## 주요 내용
   - …

   ## 시사점
   …
   ```

2. **이전 수정의 한계**: [멀티라인 Summary 파싱 오류](./multiline-summary-parsing.md) 수정에서 도입된 `stripMarkdownForPreview()`는 `##` 마커만 제거하고 헤딩 텍스트(`개요`, `주요 내용`, `시사점`)는 그대로 남김:
   ```ts
   // 이전 동작
   .replace(/^#{1,6}\s+/gm, '')   // "## 개요" → "개요" (마커만 제거, 텍스트는 유지)
   .replace(/\n{2,}/g, ' ')        // 줄바꿈 → 공백
   ```
   결과: `"개요 이 콘텐츠는 … 주요 내용 • 첫 포인트 • 둘째 … 시사점 결론"` — 헤딩 라벨이 본문 사이에 평문으로 끼어들어 매우 어색함.

3. **첫 섹션이 곧 요약**: 양식 정의상 `## 개요` 본문이 1~2문장 요약(canonical summary)이며, `## 주요 내용`/`## 시사점`은 상세 페이지에서 풀 마크다운으로 별도 렌더링됨. 카드 미리보기는 첫 섹션 본문만 보여주는 것이 원래 의도에 부합.

## 해결 방법

`stripMarkdownForPreview()`가 구조화된 요약(`##` 헤딩이 1개 이상 있는 경우)을 만나면 **첫 번째 섹션의 본문만** 추출하도록 변경. 평문/비구조화 description은 기존 동작 유지(하위호환).

```diff
 export function stripMarkdownForPreview(markdown: string): string {
   if (!markdown) return '';
-  return markdown
-    .replace(/^#{1,6}\s+/gm, '')
-    .replace(/^[-*]\s+/gm, '• ')
-    .replace(/\n{2,}/g, ' ')
-    .replace(/\n/g, ' ')
-    .trim();
+
+  const trimmed = markdown.trim();
+
+  // Structured summary path: extract body of the first ## section.
+  if (/^##\s+/m.test(trimmed)) {
+    const match = trimmed.match(/^##\s+[^\n]*\n+([\s\S]*?)(?=\n##\s+|$)/);
+    if (match && match[1].trim()) {
+      return flattenMarkdown(match[1]);
+    }
+  }
+
+  // Legacy/fallback path: plain text or unstructured markdown.
+  return flattenMarkdown(trimmed);
+}
+
+function flattenMarkdown(text: string): string {
+  return text
+    .replace(/^#{1,6}\s+/gm, '')
+    .replace(/^[-*]\s+/gm, '• ')
+    .replace(/\n{2,}/g, ' ')
+    .replace(/\n/g, ' ')
+    .trim();
 }
```

**적용 효과**:

| 입력 description | 이전 출력 | 신규 출력 |
|---|---|---|
| `## 개요\n이 콘텐츠는 …\n## 주요 내용\n- A` | `개요 이 콘텐츠는 … 주요 내용 • A` | `이 콘텐츠는 …` |
| `A simple plain description.` | `A simple plain description.` | `A simple plain description.` (변동 없음) |
| `- bullet 1\n- bullet 2` | `• bullet 1 • bullet 2` | `• bullet 1 • bullet 2` (변동 없음) |
| `## 개요\n\n## 주요 내용\n실제` (빈 첫 섹션) | `개요 주요 내용 실제` | `주요 내용 실제` (다음 섹션으로 폴백) |

상세 페이지(`ContentTabs.astro` → `renderSummaryHtml()`)는 변경 없음. 풀 마크다운(개요/주요 내용/시사점 모두) 그대로 렌더링됨.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/render-summary.ts` | `stripMarkdownForPreview` 로직 수정 — 구조화 요약은 첫 섹션 본문만 추출. `flattenMarkdown` 헬퍼로 공통 로직 분리. |
| `functions/lib/escape.ts` | `stripMd` 동일 수정 (Cloudflare Functions 런타임). |
| `public/scripts/must-read-page.js` | 브라우저 must-read 페이지 `stripMd` 동일 수정. |
| `src/components/InterestTagPanel.astro` | 브라우저 관심사 태그 패널 `stripMd` 동일 수정. |
| `src/pages/admin/must-read.astro` | 관리자 must-read 페이지 `stripMd` 동일 수정. |
| `tests/render-summary.test.ts` | 기존 헤딩 라벨 보존 테스트를 "헤딩 라벨 제거" 테스트로 갱신 + 신규 케이스 4종 + 통합 테스트 조정. |
| `tests/strip-md-parity.test.ts` | 5개 구현 파리티 테스트 업데이트 — 코퍼스 기대값 수정, `stripMd`/`flattenMd` 구조에 대응하는 괄호-매칭 소스 추출기 재작성. |

## 예방 조치

- 5개 구현(`render-summary.ts` / `escape.ts` / `must-read-page.js` / `InterestTagPanel.astro` / `admin/must-read.astro`)는 `tests/strip-md-parity.test.ts`로 **동작 + 소스 패리티**가 강제됨. 한 곳만 수정하면 CI가 즉시 실패하므로 구조적으로 드리프트 방지 가능.
- 향후 양식 헤딩이 추가/변경되면(예: `## 핵심 인사이트` 추가) **자동으로 동작**함. 헤딩 라벨을 하드코딩하지 않고 `^##\s+` 정규식으로 감지하므로 강건함.
- `## 개요` 첫 섹션이 비어있으면 다음 섹션의 헤딩+본문이 노출됨(섹션 단위로 잘리지 않고 `\n##` 직전까지 모두 캐프쳐). 의도된 폴백.
- 풀 마크다운을 카드에 노출하고 싶은 경우(예: 향후 펼침 미리보기), `flattenMarkdown(trimmed)`을 직접 호출하는 별도 함수 추가 가능.

---

## 관련 문서

- [멀티라인 Summary 파싱 오류](./multiline-summary-parsing.md) — 본 수정의 직전 단계. 마크다운 마커 제거를 도입한 시점.
- [에이전트 제출 가이드](../guides/agent-submission.md) — 요약 양식 정의 출처.

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 |
