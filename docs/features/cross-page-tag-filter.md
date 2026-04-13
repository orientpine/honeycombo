# 크로스 페이지 태그 필터

> 태그 필터 클릭 시 현재 페이지뿐 아니라 전체 기사에서 매칭되는 결과를 보여주는 기능

## 개요

기존 태그 필터는 SSG 페이지네이션(20건/페이지)에 의해 현재 페이지의 기사만 필터링했다.
전체 기사에서 수집한 241개 태그가 필터 UI에 표시되지만, 실제로 현재 페이지에 해당 태그 기사가 없으면 0건이 노출되어 "기사에 없는 태그"처럼 보이는 문제가 있었다.

이 기능은 빌드 시점에 전체 기사 데이터를 JSON으로 직렬화하여 페이지에 인라인 삽입하고, 태그 필터 클릭 시 해당 JSON에서 전체 기사를 검색하여 동적으로 카드를 렌더링한다. "전체" 클릭 시 원래 SSR 카드 + 페이지네이션 뷰로 복원된다.

## 동작 흐름

```
[빌드 시점]
allArticles → serializeArticles() → JSON 문자열
  → <script type="application/json" id="all-articles-data"> 에 삽입

[런타임 - 태그 클릭]
태그 버튼 클릭
  → getAllArticles()로 인라인 JSON 파싱 (1회, 캐시됨)
  → 태그 매칭 기사 필터링
  → renderCard()로 HTML 생성
  → SSR 카드 목록 & 페이지네이션 숨기기
  → 동적 결과 컨테이너에 렌더링 + 건수 표시

[런타임 - "전체" 클릭]
  → 동적 결과 컨테이너 숨기기
  → SSR 카드 목록 & 페이지네이션 복원
  → SourceFilter 상태 재적용
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/serialize-articles.ts` | 기사 데이터를 클라이언트용 JSON으로 직렬화 |
| `src/components/TagFilter.astro` | 태그 필터 UI + 크로스 페이지 필터링 로직 |
| `src/pages/articles/index.astro` | 1페이지 - JSON 데이터 임베드 |
| `src/pages/articles/page/[...page].astro` | 2페이지+ - JSON 데이터 임베드 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `ITEMS_PER_PAGE` | `src/pages/articles/index.astro` | `20` | SSR 페이지당 기사 수 |

## 제약 사항

- 인라인 JSON 크기는 기사 수에 비례 (~244건 기준 ~135KB raw, gzip 후 ~30KB)
- `escapeHtml()`로 XSS 방지 처리됨
- 동적 렌더링 카드의 `AddToPlaylist` 버튼은 `window.__initAddToPlaylistContainers()`를 통해 JS 재초기화됨

---

## 관련 문서

- [소스 필터](./source-filter.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 |
| 2026-04-13 | AddToPlaylist 미포함 제약 해소 — renderCard()에 HTML 삽입 + JS 재초기화 |
