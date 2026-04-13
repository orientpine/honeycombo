# 제출 기사 미노출 및 페이지 네비게이션 후 버튼 비반응

> 제출 기사가 source filter 카운트에는 잡히지만 카드가 렌더링되지 않고, 페이지 2 이동 후 필터 버튼이 반응하지 않는 버그

## 증상

1. `/articles/?origin=submitted` 접속 시 "제출 기사 1" 카운트는 표시되지만 "이 페이지에 해당하는 기사가 없습니다" 메시지 출력
2. `/articles/` → "다음 →" 클릭으로 `/articles/page/2/` 이동 후, SourceFilter/TagFilter/PersonalizationBar 버튼 클릭 무반응

**재현 환경**: Astro SSG + ClientRouter (View Transitions), Cloudflare Pages

## 원인

### 버그 1: 제출 기사 정렬 오류

`article-sort.ts`의 `SortableArticle._type`이 `'curated' | 'feed'`만 허용하고 `'submitted'`를 누락.
`getArticleDate()`가 `_type === 'curated'`일 때만 `submitted_at`을 사용하므로, submitted 기사는 `published_at`(존재하지 않음)을 참조 → `new Date(0)` = epoch 1970 → 전체 기사 중 최하단 정렬 → 마지막 페이지로 밀림.

### 버그 2: SourceFilter DOM-only 필터링

`SourceFilter.astro`가 `document.querySelectorAll('[data-testid="article-card"]')`로 현재 페이지 DOM 카드만 필터링.
서버 사이드 pagination으로 페이지당 20개만 렌더되므로, 다른 페이지의 기사는 필터 불가.
카운트는 전체 기사 기준(서버 사이드)이라 "1"이지만, DOM에 해당 카드가 없어 0건 표시.

### 버그 3: astro:page-load 조건부 등록

```javascript
// 문제 패턴
if (document.readyState === 'loading') {
  document.addEventListener('astro:page-load', initFn);
} else {
  initFn();
}
```

`document.readyState`가 `'loading'`이 아닌 경우(캐시된 페이지 등) `astro:page-load` 리스너가 등록되지 않아, ClientRouter의 클라이언트 사이드 네비게이션 후 init 함수 미실행.

## 해결 방법

### 1. article-sort.ts

```diff
- _type: 'curated' | 'feed';
+ _type: 'curated' | 'submitted' | 'feed';

- const raw = a._type === 'curated' ? a.submitted_at : a.published_at;
+ const raw = (a._type === 'curated' || a._type === 'submitted') ? a.submitted_at : a.published_at;
```

### 2. SourceFilter → TagFilter 이벤트 위임

SourceFilter가 직접 DOM 카드를 조작하는 대신, `source-filter-changed` CustomEvent를 dispatch.
TagFilter가 이 이벤트를 수신하여 내장 JSON 데이터에서 origin 필터를 적용한 크로스 페이지 렌더링 수행.

### 3. astro:page-load 무조건 등록

```diff
- if (document.readyState === 'loading') {
-   document.addEventListener('astro:page-load', initFn);
- } else {
-   initFn();
- }
+ document.addEventListener('astro:page-load', initFn);
```

Astro ClientRouter 환경에서 `astro:page-load`는 초기 로드 시에도 발생하므로 조건 분기 불필요.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/article-sort.ts` | `'submitted'` 타입 추가, `getArticleDate` 수정 |
| `src/components/SourceFilter.astro` | DOM 필터링 → 이벤트 dispatch 방식으로 변경, `astro:page-load` 패턴 수정 |
| `src/components/TagFilter.astro` | origin 필터링 로직 추가, `source-filter-changed` 이벤트 리스너, `astro:page-load` 패턴 수정 |
| `src/components/PersonalizationBar.astro` | `astro:page-load` 패턴 수정 |

## 예방 조치

1. Astro ClientRouter 사용 시 스크립트 초기화는 **항상** `document.addEventListener('astro:page-load', ...)` 패턴 사용. `readyState` 조건 분기 금지.
2. 클라이언트 사이드 필터링이 서버 사이드 pagination과 공존할 때, JSON 데이터 기반 크로스 페이지 렌더링 방식 사용. DOM 카드 show/hide는 현재 페이지만 커버.
3. `SortableArticle` 등 타입 정의 변경 시, 해당 타입을 참조하는 모든 함수 동시 검토.

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [제출 CLI 가이드](../guides/agent-submission.md)

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 |
