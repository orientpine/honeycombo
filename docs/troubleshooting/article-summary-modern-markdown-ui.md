# 기사 요약 탭 UI를 모던 마크다운 스타일로 개선

> 기사 상세페이지의 "요약" 탭이 크림색 박스 형태로 표시되어 답답해 보이던 문제를 GitHub 스타일의 모던 마크다운 레이아웃으로 개선

## 증상

`/articles/{id}/`의 "요약" 탭에 표시되는 콘텐츠가 다음과 같은 시각적 문제를 가지고 있었다:

- 크림색 배경(`--color-bg-secondary: #FFF8F0`) + 왼쪽 오렌지 테두리(`border-left: 4px solid var(--color-primary)`) 박스로 묶여 있어 가독성을 저해함
- "개요", "주요 내용", "시사점" 섹션 헤딩이 1rem 크기로 본문과 거의 구분되지 않음
- 섹션 간 시각적 구분선이 없어 정보 위계가 약함
- 카드 안에 가둬둔 듯한 답답한 느낌

```
.article-summary {
  background: var(--color-bg-secondary);   /* 크림 박스 */
  border-left: 4px solid var(--color-primary);
  padding: var(--space-md) var(--space-lg);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.article-summary .summary-heading {
  font-size: 1rem;   /* 본문과 거의 동일 */
  margin: var(--space-md) 0 var(--space-xs);
}
```

**재현 환경**: 모든 브라우저, `/articles/{id}/` 상세 페이지 "요약" 탭

## 원인

초기 디자인이 "강조된 인용 박스" 컨셉으로 설계되어 노란색 배경 + 좌측 컬러 바를 사용했으나, 실제 사용 패턴(긴 구조화된 마크다운 요약)에서는 다음 이유로 부적합했다:

1. **좁아 보이는 본문 폭**: 박스 패딩이 본문 폭을 시각적으로 줄여 정보 밀도를 높이는 효과
2. **약한 헤딩 위계**: 섹션 헤딩이 본문 텍스트와 거의 동일한 크기여서 스캐닝(빠른 훑어보기) 어려움
3. **사이트 다른 영역과의 톤 불일치**: 현대 콘텐츠 사이트(GitHub, Notion 등)는 마크다운 본문에 과한 배경/테두리를 두지 않음

## 해결 방법

`src/components/ContentTabs.astro`의 `.article-summary` 스타일을 GitHub 스타일 마크다운 렌더링 패턴으로 재작성:

1. **배경/좌측 테두리/border-radius 제거** — 박스를 없애고 본문이 페이지 폭을 자연스럽게 사용하도록 변경
2. **섹션 헤딩 강화** — `font-size: 1.35rem`, `border-bottom: 1px solid var(--color-border)`로 GitHub `<h2>` 스타일 적용
3. **여백 확장** — 단락/리스트 마진을 `var(--space-lg)` 수준으로 늘려 호흡감 확보
4. **줄 간격 강화** — `line-height: 1.75`로 한국어 가독성 향상
5. **리스트 마커 색상** — `::marker { color: var(--color-text-muted) }`로 콘텐츠와 시각적 분리

```diff
  /* Summary panel */
- .article-summary {
-   background: var(--color-bg-secondary);
-   border-left: 4px solid var(--color-primary);
-   padding: var(--space-md) var(--space-lg);
-   border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
-   margin-bottom: var(--space-lg);
- }
+ /* Summary panel — modern markdown style (GitHub-like) */
+ .article-summary {
+   padding: var(--space-sm) 0 var(--space-lg);
+   margin-bottom: var(--space-lg);
+   color: var(--color-text);
+   line-height: 1.75;
+   font-size: 1rem;
+ }

  .article-summary .summary-heading {
-   font-size: 1rem;
-   font-weight: 700;
-   color: var(--color-text);
-   margin: var(--space-md) 0 var(--space-xs);
+   font-size: 1.35rem;
+   font-weight: 700;
+   color: var(--color-text);
+   margin: var(--space-xl) 0 var(--space-md);
+   padding-bottom: var(--space-sm);
+   border-bottom: 1px solid var(--color-border);
+   letter-spacing: -0.01em;
+   line-height: 1.3;
  }
```

마크다운 파싱 로직(`src/lib/render-summary.ts`)은 변경하지 않았다 — 출력 HTML 구조(`<h3 class="summary-heading">`, `<ul class="summary-list">`, `<p>`)는 그대로 유지되며 스타일만 교체된다.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/ContentTabs.astro` | `.article-summary` 및 자식 요소 스타일을 모던 마크다운 스타일로 재작성 (lines 171-222) |

## 예방 조치

- **마크다운 스타일링 원칙**: 사용자가 작성한 구조화 콘텐츠(요약, 본문 등)는 박스/테두리/배경으로 가두기보다 GitHub/Notion 스타일의 깨끗한 타이포그래피 우선 접근을 사용한다.
- **헤딩 위계 검증**: 새 컴포넌트에서 섹션 헤딩을 추가할 때 본문 대비 최소 1.3배 이상 크기 차이를 두고, 여백·구분선으로 위계를 명확히 한다.
- **디자인 토큰 재사용**: 색상·간격은 `--color-*`, `--space-*` 디자인 토큰만 사용하고 하드코딩 금지 (AGENTS.md UI 디자인 원칙 준수).
- **참조 디자인 연결**: 동일한 톤의 UI를 여러 곳에서 사용한다면 디자인 결정을 `docs/decisions/`로 승격해 일관성 유지.

## 후속 이슈: 동적 innerHTML 자식에 scoped CSS 미적용

최초 적용 후 사용자 피드백으로 "헤딩 아래 구분선이 안 보이고 헤딩-본문 간격이 좁다"는 문제가 보고됐다. 원인은 Astro scoped CSS 동작:

- `<div class="article-summary">`는 Astro 정적 요소 → `data-astro-cid-xutx2pvd` 부여됨
- 그 안의 `<h3 class="summary-heading">`, `<p>`, `<ul>` 등은 `set:html={summaryHtml}`로 주입되는 raw HTML 문자열 → `data-astro-cid-*` 미부여
- 컴파일된 셀렉터 `.article-summary[data-astro-cid-xutx2pvd] .summary-heading[data-astro-cid-xutx2pvd]`가 **자식에 매칭 실패** → border-bottom, font-size, margin 등이 모두 무시됨
- 결과: 헤딩이 그냥 브라우저 기본 `<h3>` 스타일로 보이고 단락 마진도 사라짐

### 해결: 자식 셀렉터에 `:global()` 적용

[astro-scoped-css-dynamic-innerhtml.md](./astro-scoped-css-dynamic-innerhtml.md)에 정리된 패턴을 그대로 적용:

```diff
- .article-summary .summary-heading { ... }
+ .article-summary :global(.summary-heading) { ... }
- .article-summary p { ... }
+ .article-summary :global(p) { ... }
- .article-summary .summary-list li { ... }
+ .article-summary :global(.summary-list li) { ... }
```

정적 부모(`.article-summary`)는 scoped 유지, 동적 자식만 `:global()`로 unscoped 매칭. 컴파일 결과 `.article-summary[data-astro-cid-*] .summary-heading`가 되어 동적 주입 요소에도 정상 적용된다.

**교훈**: `set:html`로 마크다운 등 raw HTML을 렌더링하는 모든 Astro 컴포넌트에서, 그 자식 요소를 스타일링할 때는 반드시 `:global()` 래퍼를 사용한다. 단순히 `<style is:global>`로 전환하는 것도 가능하지만, 글로벌 오염을 피하려면 부모-자식 패턴이 더 안전하다.

---

## 관련 문서

- [Astro Scoped CSS가 동적 innerHTML 요소에 적용되지 않는 문제](./astro-scoped-css-dynamic-innerhtml.md)
- [기사 탭별 UI 불일치](./article-tab-ui-inconsistency.md)
- [멀티라인 요약 파싱](./multiline-summary-parsing.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 — 요약 카드를 모던 마크다운 스타일로 개선 |
| 2026-04-20 | scoped CSS 관련 후속 이슈 명시 — 동적 innerHTML 자식에 :global() 적용 |
