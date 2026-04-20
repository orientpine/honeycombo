# 기사 제목 검색 (ArticleSearch)

> `/articles/` 페이지 상단의 검색바로 기사 제목을 즉시 검색하고, SourceFilter 탭으로 검색 범위(전체/제출 기사/RSS 피드)를 제한할 수 있다.

## 개요

기존 `/articles/`에서는 600+개 기사 중에서 원하는 제목을 찾으려면 페이지네이션을 일일이 넘겨야 했다. ArticleSearch는 페이지에 임베드된 `#all-articles-data` JSON을 활용해 전체 기사를 클라이언트 사이드에서 즉시 검색한다.

검색은 SourceFilter와 양방향 연동된다.

- **검색 → SourceFilter**: 검색어 입력 시 SourceFilter의 카운트가 검색 결과 기준으로 갱신된다 (예: "rust" 검색 → 제출 기사 3, RSS 피드 12).
- **SourceFilter → 검색**: 활성 검색어가 있는 상태에서 SourceFilter 탭을 누르면 그 출처로 한정된 결과만 다시 보여 준다.

## 동작 흐름

```
[빌드 시점]
  serializeArticles(allArticles) → <script id="all-articles-data"> JSON 임베드

[런타임 - 검색어 입력]
  사용자 입력 → 150ms debounce
    → searchArticles(query, origin) (제목 substring, case-insensitive)
    → CustomEvent('article-search-changed', { query, origin, results })
    → URL ?q= 갱신 (history.replaceState)

[InterestTagPanel 수신]
  → 활성 태그 필터와 교집합으로 필터링
  → 동적 결과 컨테이너에 렌더링 (SSR 카드 + 페이지네이션 숨김)
  → SourceFilter 카운트를 검색 결과 기준으로 갱신

[검색어 클리어]
  → 빈 결과 이벤트 dispatch
  → InterestTagPanel: 활성 태그 필터/origin이 없으면 SSR 뷰 복원
  → SourceFilter: 원본 카운트 복원 (data-original-count)
```

### 이벤트 계약

| 이벤트 이름 | 발행 주체 | 페이로드 | 수신 주체 |
|------------|----------|----------|----------|
| `article-search-changed` | ArticleSearch | `{ query, origin, results }` | InterestTagPanel |
| `source-filter-changed` | SourceFilter | `{ origin }` | ArticleSearch, InterestTagPanel |
| `source-counts-update` | InterestTagPanel | `{ all, submitted, feed }` 또는 `{ reset: true }` | SourceFilter |

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/components/ArticleSearch.astro` | 검색 입력 UI + debounce + 이벤트 발행 + URL 동기화 |
| `src/components/InterestTagPanel.astro` | `article-search-changed` 수신 → 결과 렌더링 + 카운트 갱신 |
| `src/components/SourceFilter.astro` | `source-counts-update` 수신 → 카운트 동적 갱신 |
| `src/lib/article-search.ts` | 순수 검색 로직 (`searchArticles`, `getFilteredPool`) — 필터 파이프라인 계약의 단일 진실 공급원. 인라인 컴포넌트 스크립트는 동일 로직을 미러링하며, 계약 검증은 `tests/article-search.test.ts`의 `getFilteredPool` 서브를 통해 이뤄진다. |
| `src/lib/serialize-articles.ts` | 빌드 시 모든 기사를 클라이언트 JSON으로 직렬화 |
| `tests/article-search.test.ts` | 검색·관심사 헬퍼 단위 테스트 |
| `src/pages/articles/index.astro` | ArticleSearch 컴포넌트 마운트 (1페이지) |
| `src/pages/articles/page/[...page].astro` | ArticleSearch 컴포넌트 마운트 (2페이지+) |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `DEBOUNCE_MS` | `src/components/ArticleSearch.astro` (인라인 상수 `150`) | `150` | 입력 후 검색 발행까지 지연 (ms) |
| `?q=` | URL 쿼리 파라미터 | (없음) | 검색어 (페이지 새로고침 시 복원) |

## 제약 사항

- 검색은 **제목 substring** 매칭만 수행한다. 본문(description)·태그·소스명은 검색 대상이 아니다.
- 검색은 **클라이언트 사이드**에서 동작한다. JS가 비활성화된 환경에서는 SSR 뷰만 노출된다.
- `serializeArticles()`가 임베드하는 JSON 크기에 제한이 있다 (~244건 기준 ~135KB raw, gzip 후 ~30KB). 기사 수가 크게 늘면 인덱스 분리/지연 로드를 검토해야 한다.
- URL은 `history.replaceState`로 갱신되어 브라우저 뒤로 가기에 검색 단계가 누적되지 않는다.

---

## 관련 문서

- [관심사 & 태그 패널 (InterestTagPanel)](./interest-tag-panel.md)
- [기사 소스 필터 (SourceFilter)](./source-filter.md)
- [크로스 페이지 태그 필터 (폐기됨)](./cross-page-tag-filter.md)
- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 — `/articles/` 페이지에 제목 검색 기능 추가 |
| 2026-04-20 | Oracle 검증 대응 — ArticleSearch 입력 리스너와 `source-filter-changed` 도큐먼트 리스너에 누적 방지 가드(`__articleSearchState`) 추가. 페이지 네비게이션 시 검색 캐시 초기화. `getFilteredPool` 통합 테스트 10건 추가. |
