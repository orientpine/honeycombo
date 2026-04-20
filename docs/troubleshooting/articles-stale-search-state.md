# /articles/ 페이지: View Transitions 네비게이션 후 검색어가 사라지지 않는 문제

> Astro view-transition 네비게이션 시, 이전 페이지에서 활성화된 검색 필터가 새 페이지에 잘못 유지되는 회귀 버그.

## 증상

`/articles/` (1페이지)에서 제목 검색을 한 뒤 `/articles/page/2`로 view-transition 네비게이션을 하면:

- 새 URL에는 `?q=` 파라미터가 없음에도 불구하고
- 이전 검색어로 필터링된 동적 결과 컨테이너가 계속 표시됨
- SSR 카드와 페이지네이션이 숨겨진 상태 유지
- SourceFilter 카운트도 이전 검색 결과 기준으로 표시됨

## 원인

PR #120에서 `astro:page-load` 리스너 누적을 방지하기 위해 도입한 `window.__itpState`(InterestTagPanel)와 `window.__articleSearchState`(ArticleSearch)가 **view transition 간에 살아남는다**.

```
[PR #120 이후 흐름 — 버그 발생]

페이지 A: ?q=hello
  → ArticleSearch.applySearch('hello') → __itpState.activeSearchResults = [...]
  → InterestTagPanel.renderFilteredView() (필터된 그리드 표시)

[View Transition 네비게이션 → 페이지 B (?q= 없음)]

페이지 B: astro:page-load 발화
  → ArticleSearch.initArticleSearch():
      - URL에 ?q= 없음 → input.value = '' 만 처리
      - InterestTagPanel에 알림을 보내지 않음 ← 버그
  → InterestTagPanel.initInterestTagPanel():
      - state.activeSearchResults가 여전히 [...] (이전 페이지 값)
      - renderFilteredView() 호출 → 잘못된 필터 상태 유지 ← 버그
```

## 해결 방법

두 곳에서 동시에 처리한다 (belt-and-suspenders):

### 1. InterestTagPanel — URL을 진실 공급원으로 사용

`initInterestTagPanel()`의 가장 처음에 URL에서 `?q=`를 읽어 검색 상태를 동기화한다. 새 페이지에 `?q=`가 없으면 persisted `activeSearchQuery` / `activeSearchResults`를 강제로 리셋한다.

```ts
// src/components/InterestTagPanel.astro:706
const urlQuery = new URLSearchParams(window.location.search).get('q') || '';
if (!urlQuery) {
  state.activeSearchQuery = '';
  state.activeSearchResults = null;
}
// 추가로 articles/tagCounts 캐시도 리셋 (페이지마다 다른 #all-articles-data 가능성 대비)
state.allArticles = null;
state.tagCounts = null;
```

### 2. ArticleSearch — 이전 페이지에 쿼리가 있었다면 클리어 이벤트 디스패치

`initArticleSearch()`에서 새 URL에 `?q=`가 없는데 이전 `lastQuery`가 비어있지 않다면, 빈 쿼리로 `article-search-changed` 이벤트를 발화하여 다른 컴포넌트에 알린다.

```ts
// src/components/ArticleSearch.astro:137
const hadQuery = sstate.lastQuery.trim() !== '';
sstate.lastQuery = '';
if (hadQuery) {
  setTimeout(() => applySearch(''), 0);
}
```

### 3. SSR 뷰 강제 복원

URL에 필터가 전혀 없는데 동적 결과 컨테이너가 여전히 표시 중이면, `renderFilteredView()`를 호출해 SSR 뷰로 명시적으로 복원한다.

```ts
} else {
  const filteredContainer = document.getElementById('itp-filtered-results');
  if (filteredContainer && filteredContainer.style.display !== 'none') {
    renderFilteredView();  // isFilteredViewActive() === false → SSR 복원 분기
  }
}
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/components/InterestTagPanel.astro` | `initInterestTagPanel()`에서 URL 기반 상태 리셋 (line 706~) |
| `src/components/ArticleSearch.astro` | `initArticleSearch()`에서 이전 쿼리가 있으면 클리어 이벤트 디스패치 (line 137~) |

## 교훈

- `window.__state` 패턴은 listener 누적을 막을 때 강력하지만, view transitions 환경에서 **state도 누적된다**는 점에 주의해야 한다.
- "리스너는 1번만 바인딩, 단 state는 매 navigation마다 URL 기준으로 재동기화"가 안전한 패턴.
- Oracle 검증 시 단위 테스트와 빌드 통과만으로는 view-transition 시나리오를 잡을 수 없으므로, 향후 Playwright 등으로 brower-driven 통합 테스트를 추가할 가치가 있다.

---

## 관련 문서

- [관심사 & 태그 패널 (InterestTagPanel)](../features/interest-tag-panel.md)
- [기사 제목 검색 (ArticleSearch)](../features/article-search.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 — Oracle 재검증에서 발견된 view-transition stale state 회귀 수정 |
