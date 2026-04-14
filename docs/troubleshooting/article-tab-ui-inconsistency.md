# 기사 탭별 UI 불일치 (전체 vs 제출 기사/RSS 피드)

> "전체" 탭과 "제출 기사"/"RSS 피드" 탭의 기사 카드 UI가 서로 달랐던 문제 해결

## 증상

`/articles/?origin=submitted` 또는 `/articles/?origin=feed`에서 기사 카드 UI가 "전체" 탭과 다르게 표시됨:
- 북마크 버튼(❤️) 없음
- 댓글 카운트(💬) 없음
- `article-footer` 영역 없음
- 카드 스타일(간격, 폰트, 레이아웃) 미적용

**재현 환경**: 모든 브라우저, `/articles/` 페이지에서 탭 전환 시

## 원인

두 가지 근본 원인:

1. **SSR vs 클라이언트 렌더링 구조 차이**: "전체" 탭은 Astro SSR `ArticleCard.astro` 컴포넌트로 렌더링되어 `BookmarkButton`, 댓글 인디케이터, `article-footer`가 포함됨. 반면 "제출 기사"/"RSS 피드" 탭은 `TagFilter.astro`의 클라이언트 JS `renderCard()` 함수로 동적 렌더링되는데, 이 함수에 해당 요소들이 누락되어 있었음.

2. **Astro 스코프드 스타일 미적용**: `ArticleCard.astro`와 `BookmarkButton.astro`의 `<style>` 태그가 Astro 기본 스코프드 모드로 동작하여, SSR 렌더링된 카드에만 스타일이 적용되고 JS로 동적 생성된 카드에는 적용되지 않음.

## 해결 방법

### 1. 스타일을 글로벌로 전환

`ArticleCard.astro`와 `BookmarkButton.astro`의 `<style>`을 `<style is:global>`로 변경하여 동적 카드에도 스타일 적용.

```diff
- <style>
+ <style is:global>
```

### 2. renderCard()에 누락된 UI 요소 추가

`TagFilter.astro`의 `renderCard()` 함수에 `article-footer`, 북마크 버튼, 댓글 인디케이터 HTML 추가.

### 3. 초기화 함수 글로벌 노출

동적 렌더링 후 북마크·댓글 기능이 동작하도록 초기화 함수를 `window` 객체에 노출:
- `BookmarkButton.astro`: `window.__initBookmarkButtons`
- `ArticleCard.astro`: `window.__initCommentCounts`

`TagFilter.astro`의 `applyFilters()`에서 동적 렌더링 후 호출.

### 4. 제목 색상 (필터 영역만 오렌지)

ArticleCard의 기본 제목 색상은 `var(--color-text)` (어두운 색) 유지. 필터 결과 영역(`#tag-filtered-grid`)에만 `var(--color-primary)` (오렌지) 오버라이드를 TagFilter.astro 스코프드 스타일로 적용. 이렇게 하면 홈페이지 등 다른 페이지의 ArticleCard 제목 색상에 영향을 주지 않음.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/ArticleCard.astro` | `<style is:global>`, 제목 색상 `var(--color-text)` 유지, 댓글 observer 글로벌 노출 |
| `src/components/BookmarkButton.astro` | `<style is:global>`, `initBookmarkButtons` 글로벌 노출 |
| `src/components/TagFilter.astro` | `renderCard()`에 북마크·댓글·footer 추가, 동적 렌더링 후 init 호출, `#tag-filtered-grid` 제목 오렌지 오버라이드 |

## 예방 조치

- 클라이언트 JS로 동적 렌더링하는 `renderCard()` 함수를 수정할 때는 반드시 SSR `ArticleCard.astro`와 구조를 동기화할 것.
- Astro 컴포넌트 스타일이 동적 생성 요소에도 필요한 경우 `<style is:global>`을 사용할 것.
- Astro 컴포넌트 스타일이 동적 생성 요소에도 필요한 경우 `<style is:global>`을 사용할 것.
- 글로벌 스타일 변경 시 홈페이지 등 다른 페이지에 의도치 않은 영향이 없는지 확인할 것.

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-14 | 최초 작성 |
