# 기사 소스 필터 (SourceFilter)

> 기사 목록 페이지에서 에디터 추천 / 제출 기사 / RSS 피드를 탭으로 구분하여 보여주는 기능.

## 개요

기사 목록(`/articles/`)에 모든 기사가 뒤섞여 표시되어 사용자가 원하는 유형의 기사를 찾기 어려웠다. SourceFilter 컴포넌트를 추가하여 기사 출처별(에디터 추천, 제출 기사, RSS 피드)로 필터링할 수 있도록 했다.

## 동작 흐름

```
articles 페이지 로드
  → curated(approved) + curated(pending) + feeds 컬렉션 로드
  → _type 태깅: 'curated' / 'submitted' / 'feed'
  → SourceFilter 탭에 카운트 표시
  → 클릭 시 data-origin 속성 기반 클라이언트 필터링
  → URL ?origin= 파라미터로 상태 유지
```

### 3가지 기사 유형

| 유형 | `_type` | `data-origin` | 소스 | 뱃지 |
|------|---------|--------------|------|------|
| 에디터 추천 | `curated` | `curated` | `src/content/curated/` (status: approved) | 노란색 "에디터 추천" |
| 제출 기사 | `submitted` | `submitted` | `src/content/curated/` (status: pending) | 초록색 "검토 중" |
| RSS 피드 | `feed` | `feed` | `src/data/feeds/` | 없음 (소스명만 표시) |

### 필터 탭 순서

`전체` → `에디터 추천` → `제출 기사` → `RSS 피드`

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/components/SourceFilter.astro` | 필터 탭 UI + 클라이언트 필터링 스크립트 |
| `src/components/ArticleCard.astro` | `articleOrigin` prop으로 뱃지 구분 표시, `data-origin` 속성 |
| `src/pages/articles/index.astro` | curated(approved/pending) + feeds 로드, 카운트 계산 |
| `src/pages/articles/page/[...page].astro` | 페이지네이션 페이지에 동일 적용 |
| `src/styles/global.css` | `.badge-curated`, `.badge-submitted` 스타일 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `ITEMS_PER_PAGE` | `src/pages/articles/index.astro` | `20` | 페이지당 기사 수 |

## 제약 사항

- 필터링은 클라이언트 사이드(DOM display toggle)로 동작. 페이지네이션은 서버 사이드(SSG)이므로, 필터를 걸면 한 페이지에 표시되는 기사 수가 줄어들 수 있다.
- 제출 기사(pending)는 아직 에디터 검토를 거치지 않은 상태이므로, 콘텐츠 품질이 보장되지 않는다.

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 — 3탭(전체/에디터추천/RSS) → 4탭(+제출기사) 구조 |
