# 카드 미리보기 — 빈 첫 섹션 폴백이 헤딩 라벨 누출 + nested bold parity 깨짐

> [card-preview-overview-prefix](./card-preview-overview-prefix.md) 후속 수정. Oracle 리뷰에서 발견된 두 가지 잔여 이슈 해결: (1) `## 개요` 첫 섹션이 비어있으면 전체 평탄화로 폴백되어 `주요 내용` 같은 헤딩 라벨이 카드에 다시 노출됨. (2) 5개 stripMd 구현이 평면 케이스에서만 일치하고 nested `**outer *inner* outer**`에서는 분기됨(parity 주장 부분적으로 거짓).

## 증상

### 이슈 1: 빈 첫 섹션 → 헤딩 라벨 노출

```
입력 description: "## 개요\n\n## 주요 내용\n실제 내용"
이전 출력 (PR #121): "주요 내용 실제 내용"   ← "주요 내용" 헤딩 라벨 노출
기대 출력           : "실제 내용"            ← 본문만
```

### 이슈 2: nested bold+italic parity 분기

```
입력: "**outer *inner* outer**"
src/lib/render-summary.ts (stripMarkdownForPreview): "outer inner outer"   ← 정상
functions/lib/escape.ts (stripMd)                  : "**outer inner outer**" ← 외곽 ** 잔존
public/scripts/must-read-page.js (stripMd)         : "**outer inner outer**" ← 동일
src/components/InterestTagPanel.astro (stripMd)    : "**outer inner outer**" ← 동일
src/pages/admin/must-read.astro (stripMd)          : "**outer inner outer**" ← 동일
```

**재현 환경**: PR #121 머지 직후 모든 환경. parity 코퍼스에 nested 케이스가 없어서 CI 통과했지만 실제 동작은 분기됨.

## 원인

### 이슈 1: 폴백 로직이 잘못됨

PR #121 코드:

```ts
if (/^##\s+/m.test(trimmed)) {
  const match = trimmed.match(/^##\s+[^\n]*\n+([\s\S]*?)(?=\n##\s+|$)/);
  if (match && match[1].trim()) {
    return flattenMarkdown(match[1]);
  }
}
return flattenMarkdown(trimmed);  // ← 빈 첫 섹션이면 여기로 폴백, 전체를 평탄화하면서 헤딩 라벨 누출
```

첫 섹션이 비어있으면(`## 개요\n\n## 주요 내용\n…`) `match[1].trim()`이 false → `flattenMarkdown(trimmed)` 실행 → `^##\s+` 마커는 제거되지만 `개요`/`주요 내용` 텍스트는 남음.

### 이슈 2: 4개 sibling이 nested * 차단하는 regex 사용

`render-summary.ts`는 `stripInlineMarkdown`에서 placeholder 패턴(`\u0000BOLD0\u0001`)으로 outer bold를 먼저 격리한 후 inner italic 처리. 4개 sibling은 단순 chained `.replace()`이므로:

```ts
.replace(/\*\*([^*\n]+?)\*\*/g, '$1')   // [^*\n]+? — 본문에 * 포함 불가 → '**outer *inner* outer**' 매칭 실패
.replace(/(^|[^*A-Za-z0-9_])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![A-Za-z0-9_])/g, '$1$2')  // 내부 *inner* 만 제거
// 결과: '**outer inner outer**' (외곽 ** 잔존)
```

PR #121의 parity 테스트는 이 분기를 `BOLD_PATTERN_OPTIONS` 배열로 명시적 허용했지만, 실제로 같은 입력에 대한 출력이 달라지므로 "5개 구현 동작 일치"라는 contract는 거짓이었음.

## 해결 방법

### 1. `stripMd`/`stripMarkdownForPreview` — 섹션 단위 iteration

`match()` (첫 매칭만 잡음) 대신 `split()`으로 섹션 분해 후 첫 비어있지 않은 섹션 본문 반환:

```diff
 export function stripMarkdownForPreview(markdown: string): string {
   if (!markdown) return '';
-  const trimmed = markdown.trim();
-  if (/^##\s+/m.test(trimmed)) {
-    const match = trimmed.match(/^##\s+[^\n]*\n+([\s\S]*?)(?=\n##\s+|$)/);
-    if (match && match[1].trim()) {
-      return flattenMarkdown(match[1]);
-    }
-  }
-  return flattenMarkdown(trimmed);
+  if (/^##\s+/m.test(markdown)) {
+    const sections = markdown.split(/(?:^|\n)##\s+[^\n]*\n?/);
+    for (const section of sections) {
+      if (section.trim()) {
+        return flattenMarkdown(section);
+      }
+    }
+    // All sections empty — return empty rather than leaking heading labels.
+    return '';
+  }
+  return flattenMarkdown(markdown);
 }
```

### 2. 4개 sibling: bold regex `[^*\n]+?` → `[^\n]+?`

내부 `*` 허용으로 변경하면 lazy `+?` 덕분에 nested bold도 한 번에 매칭됨. 두 번째 inner italic regex가 캡처 그룹의 `*inner*`를 처리.

```diff
-.replace(/\*\*([^*\n]+?)\*\*/g, '$1')
+.replace(/\*\*([^\n]+?)\*\*/g, '$1')
```

검증: `'**outer *inner* outer**'`
1. `/\*\*([^\n]+?)\*\*/g` 매칭 → outer ** 제거 → `'outer *inner* outer'`
2. `/(^|[^*A-Za-z0-9_])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![A-Za-z0-9_])/g` 매칭 → inner * 제거 → `'outer inner outer'` ✅

### 3. parity 테스트 corpus +4 케이스

```ts
{ name: 'first section empty falls through to next non-empty section body', ... },
{ name: 'nested **outer *inner* outer** bold-with-italic strips fully', ... },
{ name: 'nested bold+italic inside structured summary first section', ... },
{ name: 'all sections empty returns empty string', ... },
```

### 4. parity 테스트 byte-parity 단순화

- `BOLD_PATTERN_OPTIONS` 제거(분기 허용 종료) — `/\*\*([^\n]+?)\*\*/g` 토큰을 `REQUIRED_TOKENS_ALL`에 추가
- `SECTION_SPLIT_TOKEN` 신규 — `/(?:^|\n)##\s+[^\n]*\n?/`이 5개 파일 모두에 존재해야 통과

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/render-summary.ts` | `stripMarkdownForPreview` 섹션 iteration으로 재작성. all-empty면 `''` 반환. |
| `functions/lib/escape.ts` | `stripMd` 동일 변경 + bold regex `[^*\n]+?` → `[^\n]+?`. |
| `public/scripts/must-read-page.js` | 동일. |
| `src/components/InterestTagPanel.astro` | 동일. |
| `src/pages/admin/must-read.astro` | 동일. |
| `tests/render-summary.test.ts` | 빈 첫 섹션 테스트를 `toBe('실제 내용')`으로 strict화 + multi-empty iteration + all-empty 케이스 추가. |
| `tests/strip-md-parity.test.ts` | 코퍼스 +4종(빈 섹션, nested, nested in 첫 섹션, all-empty). `BOLD_PATTERN_OPTIONS` 제거, `SECTION_SPLIT_TOKEN` 신규. |

## 예방 조치

- nested bold/italic 같은 edge case는 corpus에 명시적으로 추가해야 parity가 깨지지 않음. 단순 케이스만 테스트하면 분기 가능.
- 폴백 동작은 항상 "사용자 의도 위반 가능성"을 먼저 검토. 이 케이스에서는 헤딩 라벨 노출 = 원래 사용자가 제거하고 싶었던 것이므로 폴백은 `''`이어야 함.
- Oracle 등 외부 리뷰어에게 자기 검증 요청 시 corpus의 완전성도 함께 검토 요청.

---

## 관련 문서

- [card-preview-overview-prefix](./card-preview-overview-prefix.md) — 본 수정의 직전 단계 (PR #121).
- [멀티라인 Summary 파싱 오류](./multiline-summary-parsing.md) — 마크다운 마커 제거 도입.

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 (Oracle 리뷰 피드백 반영) |
