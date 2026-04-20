# 관심사 & 태그 패널 (InterestTagPanel)

> 기존의 분리된 PersonalizationBar(관심사)와 TagFilter(태그 필터)를 하나의 UI로 통합한 컴포넌트. 칩 본문 클릭은 hard 필터, 별표 클릭은 localStorage 관심사 저장으로 의미를 분리하고, 인기 태그 6개만 항상 노출하여 시각적 부담을 줄였다.

## 개요

기존 구조는 두 컴포넌트가 같은 태그 풀을 각각 다른 동작 모델로 다뤘다.

- **PersonalizationBar (관심사)**: localStorage에 저장 → 매칭 카드 상단 정렬 + `border-color` 변경 (사용자가 효과를 인지하기 어려움)
- **TagFilter (태그 필터)**: URL 파라미터 → 해당 태그만 표시 (cross-page) + 모든 241개 태그가 화면에 노출되어 시각적 과부하

문제:

1. 두 UI가 모두 전체 태그(241개)를 평면적으로 노출 → 화면이 매우 복잡함
2. 관심사 효과가 너무 미묘하여 사용자가 동작 여부를 인지하지 못함 ("아무런 차이가 없어")
3. 두 기능이 의미상 겹치지만 (동일한 태그 풀, 동일한 클릭 인터랙션) 시각적·기능적으로 분리되어 있어 학습 비용 발생

InterestTagPanel은 다음과 같이 통합한다.

- **하나의 칩 = 두 가지 액션**: 본문 클릭 = hard 태그 필터, 별표(☆) 클릭 = 관심사 토글
- **인기 태그 6개만 상시 노출**: "모든 태그 보기" 토글로 전체 241개 펼쳐 보기
- **저장된 관심사는 항상 우선 노출**: 상시 노출 6개 슬롯에 관심사가 먼저 들어가고, 남은 자리를 인기 태그가 채움
- **관심사 매칭을 강조 표시**: 매칭 카드에 `⭐ 관심` 코너 뱃지 + 노란 배경 그라데이션 + 노란 그림자 → "차이 없어" 문제 해결
- **헤더에 "관심사 일치 N건" 카운트 뱃지**: 정량 피드백 제공

## 동작 흐름

```
[페이지 로드]
  InterestTagPanel mount
    → getInterests() (localStorage)
    → applyInterestHighlights() (SSR 카드에 .interest-match 클래스 부여)
    → pinInterestMatchesInList() (매칭 카드 상단 정렬)
    → URL ?tag= 있으면 applyTagFilter() (cross-page)

[칩 본문 클릭]
  → setActiveTagChip(tag) → URL ?tag= 갱신
  → renderFilteredView()
      ├── getFilteredArticles() (검색 결과 ∩ 활성 태그 ∩ 활성 origin)
      ├── pinInterestMatches() (관심사 매칭 카드 상단 정렬)
      ├── renderCard() × N (.interest-match 포함)
      ├── __initAddToPlaylistContainers() / __initBookmarkButtons() / __initCommentCounts()
      └── source-counts-update event (검색 활성 시 검색 결과 기준 카운트)

[칩 별표(☆) 클릭]
  → toggleInterest(tag) → localStorage 저장
  → CustomEvent('interests-changed', { interests })
  → refreshInterestsUI() (상단 라벨, 펼침 패널의 관심사 pill, 모든 별표 상태)
  → applyInterestHighlights() (SSR 카드)
  → 동적 결과가 활성이면 renderFilteredView() 재실행 (재정렬)

[펼침 토글]
  → #itp-expanded.hidden toggle
  → "모든 태그 보기 ▼" ↔ "접기 ▲"
```

### 동시 활성 필터 우선순위

검색 / origin / tag / 관심사가 모두 동시에 적용 가능하다. 우선순위는:

1. **검색** (있으면 풀이 됨; ArticleSearch가 origin을 미리 적용한 결과)
2. **origin** (검색이 없을 때 풀에서 origin으로 필터)
3. **tag** (위 풀에서 태그 필터)
4. **관심사** (위 결과 내에서 매칭 카드를 상단으로 pin + 시각 강조)

검색·origin·tag 중 하나라도 활성이면 SSR 카드 + 페이지네이션이 숨겨지고 동적 결과 컨테이너가 표시된다.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/components/InterestTagPanel.astro` | 통합 패널 컴포넌트 (UI + 모든 클라이언트 로직) |
| `src/components/ArticleSearch.astro` | 제목 검색. `article-search-changed` 이벤트로 결과 전달 |
| `src/components/SourceFilter.astro` | 출처 필터 탭. `source-counts-update` 수신 |
| `src/lib/article-search.ts` | 순수 헬퍼 (`getTopTags`, `getInterestMatches`, `pinInterestMatches`) — 단위 테스트의 단일 진실 공급원 |
| `tests/article-search.test.ts` | 헬퍼 단위 테스트 |
| `src/pages/articles/index.astro` | InterestTagPanel 마운트 + `tagCounts` prop 계산 |
| `src/pages/articles/page/[...page].astro` | InterestTagPanel 마운트 (페이지네이션) |
| `src/components/ArticleCard.astro` | `data-tags` / `data-origin` 속성 제공. SSR 카드의 `.interest-match` 시각 효과 적용 대상 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `STORAGE_KEY` | `src/components/InterestTagPanel.astro` (인라인 상수) | `'honeycombo_interests'` | localStorage 키. 기존 PersonalizationBar와 동일 → 마이그레이션 불필요 |
| `TOP_N` | `src/components/InterestTagPanel.astro` (frontmatter) | `6` | 상시 노출 칩 슬롯 개수 |
| `?tag=` | URL 쿼리 파라미터 | (없음) | 활성 태그 필터 (페이지 새로고침 시 복원) |

## 제약 사항

- 칩 클릭은 항상 cross-page hard 필터로 동작한다 (현재 페이지에 매칭이 없어도 전체 기사에서 찾아 표시).
- 관심사 매칭 강조(`.interest-match` 클래스)는 ArticleCard의 `<style is:global>`과 InterestTagPanel의 글로벌 스타일을 함께 사용한다. 다른 페이지에서 ArticleCard를 사용해도 InterestTagPanel이 마운트되지 않으면 `.interest-match` 클래스가 부여되지 않으므로 효과는 발생하지 않는다.
- `serializeArticles()`가 임베드한 JSON에 의존한다. 페이지에 `<script id="all-articles-data">`가 없으면 cross-page 필터는 빈 결과를 반환한다.
- `getInterests()`는 손상된 localStorage 값을 만나면 빈 배열로 fallback한다 (사용자 데이터 손실 가능성 차단).
- 펼침 패널의 전체 태그 리스트는 SSR로 렌더링되므로 페이지 HTML 크기가 태그 수에 비례한다 (현재 ~241개 기준 영향 미미).

---

## 관련 문서

- [기사 제목 검색 (ArticleSearch)](./article-search.md)
- [기사 소스 필터 (SourceFilter)](./source-filter.md)
- [크로스 페이지 태그 필터 (폐기됨)](./cross-page-tag-filter.md)
- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 — PersonalizationBar + TagFilter 통합, 인기 태그 6개 상시 노출 + 관심사 매칭 시각 강조 추가 |
