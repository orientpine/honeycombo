# Inline 마크다운(`**bold**`, `` `code` ``, 링크 등) raw 노출 문제

> Gemini 요약과 사용자 큐레이션의 inline markdown이 화면에 raw 마커 그대로 표시되던 문제

## 증상

Gemini로 생성된 한국어 구조화 요약은 종종 `**굵은 글씨**`, `` `inline code` ``, `[링크](url)` 같은 inline markdown을 포함한다. 그러나 description 렌더링 파이프라인이 block-level(`## headings`, `- bullets`)만 처리하고 있어, 사용자 화면에는 raw 마커가 그대로 노출되었다.

**대표 사례** (`src/data/feeds/2026/04/20b6b53922ca9538.json`):

```
**디지털 증거 인증의 어려움**: AI 딥페이크 기술로 인해 비디오, 오디오, 사진 등 디지털 증거의 조작 가능성이 높아져...
**법원의 증거 인증 요구 사항**: 연방 증거 규칙 901(b)(9)에 따라...
```

→ `**` 별표가 그대로 노출되어 가독성이 떨어졌다.

production 데이터 측정: feed article 274개 중 76개(28%)가 `**bold**` 사용, 일부에 `` `inline code` `` 존재.

**재현 환경**: 모든 description 노출 surface (article 상세, 카드 미리보기, RSS feed, meta tag, Cloudflare functions, 클라이언트 vanilla JS).

## 원인

`src/lib/render-summary.ts`의 `renderSummaryHtml()`은 block-level markdown만 처리하고, inline markdown은 `escapeHtml()` 후 그대로 통과시켰다.

- `## 개요` → `<h3>` 로 변환됨 ✅
- `- bullet` → `<ul><li>` 로 변환됨 ✅
- `**bold**` → `**bold**` 그대로 노출됨 ❌

`stripMarkdownForPreview()`도 `^#` 헤딩 마커와 `^-` bullet 마커만 제거하여 inline 마커는 plain-text 표면에서도 raw로 노출되었다.

`functions/lib/escape.ts`의 `stripMd()`와 `public/scripts/must-read-page.js`의 동일 함수도 같은 한계를 공유했다.

## 해결 방법

`render-summary.ts`에 inline-only pass를 추가한 뒤, block parser가 `<p>`/`<li>`를 만드는 시점에 적용한다. plain-text surface에는 마커 제거 helper를 적용한다.

### 1. `renderInlineMarkdown(escapedText)` 신규

이미 HTML-escape된 텍스트에 대해 4가지 inline 패턴을 변환:

| 패턴 | 변환 |
|---|---|
| `` `code` `` | `<code>code</code>` |
| `**bold**` | `<strong>bold</strong>` |
| `*italic*` / `_italic_` | `<em>italic</em>` |
| `[label](url)` | `<a href="url" target="_blank" rel="noopener noreferrer">label</a>` |

**처리 순서가 중요**:
1. **Code 먼저** — 본문이 다른 마커로 재해석되지 않도록 placeholder로 빼둔 뒤 마지막에 복원
2. **Bold(`**`) 다음** — italic(`*`)보다 먼저, 그렇지 않으면 greedy 충돌
3. **Italic** — `_`는 word-boundary lookaround로 `snake_case_var` 같은 식별자 보호
4. **Link 마지막** — protocol whitelist (`http(s):`, `/`, `#`)로 `javascript:` URL 차단

### 2. `stripInlineMarkdown(text)` 신규

plain-text surface(카드, RSS, meta tag)에서 마커만 제거하여 평문화한다. 동일한 4가지 패턴에 대해 태그 없이 본문만 남긴다.

### 3. 적용 위치

```
src/lib/render-summary.ts        → renderInlineMarkdown / stripInlineMarkdown / stripMarkdownForPreview
functions/lib/escape.ts          → stripMd() (Cloudflare Functions)
public/scripts/must-read-page.js → stripMd() (브라우저 must-read 페이지)
src/components/TagFilter.astro   → stripMd() (브라우저 태그 필터 클라이언트 렌더)
src/pages/admin/must-read.astro  → stripMd() (브라우저 admin 페이지)
```

다섯 구현은 동일한 regex를 공유하여 SSG / CF Functions / 3종 브라우저 코드 어디서든 일관된 결과를 보장한다. drift 방지는 `tests/strip-md-parity.test.ts`에서 공유 코퍼스로 자동 검증된다.

### 4. XSS 방어

- **escape-first 패턴 유지**: `renderInlineMarkdown`은 항상 `escapeHtml()` 결과에만 호출됨. 사용자 입력의 HTML-significant 문자는 모두 entity로 변환된 뒤 inline 처리가 일어나므로 XSS 가능성 없음.
- **link protocol whitelist**: `[click](javascript:alert(1))` 같은 입력은 anchor로 변환되지 않고 raw 마크다운 텍스트 그대로 출력됨 (테스트로 검증).
- **code 내용 보호**: 백틱 안의 텍스트는 다른 inline 변환 단계에서 placeholder로 격리되어 emphasis 처리되지 않음.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/render-summary.ts` | `renderInlineMarkdown()`, `stripInlineMarkdown()`, `isSafeUrl()` 추가; `renderSummaryHtml`/`stripMarkdownForPreview`에 적용 |
| `functions/lib/escape.ts` | `stripMd()`에 inline 마커 제거 4줄 추가 |
| `public/scripts/must-read-page.js` | 동일한 inline 마커 제거 추가 (브라우저용) |
| `tests/render-summary.test.ts` | inline markdown 시나리오 22개 추가 (XSS protection, 한국어 bold, snake_case 보호 포함) |
| `src/components/TagFilter.astro` | drift되어 있던 stripMd를 neighbour 구현과 동기화 |
| `src/pages/admin/must-read.astro` | drift되어 있던 stripMd를 neighbour 구현과 동기화 |
| `tests/strip-md-parity.test.ts` (신규) | 다섯 구현 parity 검증 — drift 발생 시 CI 차단 |

## 예방 조치

- **Five-source consistency**: 다섯 구현의 inline regex는 항상 동일해야 한다. 한 곳을 바꾸면 나머지 네 곳도 같이 갱신해야 한다. parity 테스트가 자동으로 잡아준다.
- **escape-first 강제**: `renderInlineMarkdown`은 절대 raw 사용자 입력에 직접 호출하지 말 것. 항상 `escapeHtml()` 결과에 대해서만 사용한다. JSDoc에 명시되어 있음.
- **link protocol whitelist 유지**: `isSafeUrl()`이 `http(s):`, `/`, `#`만 허용. 새 protocol 추가는 보안 검토 필수.
- **회귀 테스트**: 신규 inline 마커 추가 시 XSS 시나리오와 한국어/식별자 충돌 시나리오 테스트 필수.
- **Anti-drift safeguard**: `tests/strip-md-parity.test.ts`가 다섯 구현의 stripMd 함수를 공유 코퍼스로 검증한다. 한 곳이 drift하면 CI 차단.

---

## 관련 문서

- [RSS 요약 영문 누수 트러블슈팅](./rss-summary-english-fallback.md) — 사실상 같은 description 파이프라인의 선행 이슈
- [멀티라인 Summary 파싱 트러블슈팅](./multiline-summary-parsing.md) — block-level 한국어 요약 렌더링 선행 이슈
- [src/lib/render-summary.ts](../../src/lib/render-summary.ts)
- [functions/lib/escape.ts](../../functions/lib/escape.ts)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 — inline markdown(`**bold**`, `` `code` ``, italic, link)을 모든 description 표면에서 정확히 렌더/평문화하도록 수정 |
| 2026-04-20 | drift 방지 — TagFilter.astro/admin/must-read.astro의 누락된 stripMd 동기화, nested `**outer *inner* outer**` 처리 개선, 다섯 구현 parity 테스트 추가 |
| 2026-04-20 | Oracle gap closure — stripInlineMarkdown에 nested bold placeholder 전략 적용, summarize-articles에 clearStaleDescription() 추가 (요약 실패 시 stale 영문 description 자동 제거), parity test에 source-regex byte parity 검증 추가 |
