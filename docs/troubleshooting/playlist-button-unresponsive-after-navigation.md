# 페이지 이동 후 "플레이리스트에 추가" 버튼 무반응

> View Transitions(ClientRouter) 환경에서 AddToPlaylist 버튼이 페이지 이동 후 클릭해도 반응하지 않던 문제

## 증상

`/articles/` 목록에서 기사 세부 페이지(`/articles/[slug]`)로 이동한 뒤, "➕ 플레이리스트에 추가" 버튼을 클릭하면 아무 반응이 없음. 브라우저 새로고침 후에는 정상 동작.

**재현 조건**:
1. `/articles/` 페이지 접속
2. 기사 카드 클릭하여 세부 페이지로 이동 (View Transitions 사용)
3. "플레이리스트에 추가" 버튼 클릭 → 무반응

**재현 환경**: 모든 브라우저, Astro 6.x + ClientRouter (View Transitions)

## 원인

`AddToPlaylist.astro`의 초기화 코드가 `document.readyState` 체크를 사용하여 조건부로 `astro:page-load` 리스너를 등록했으나, Astro의 모듈 스크립트는 deferred로 실행되어 `readyState`가 항상 `'interactive'` 이상이므로 리스너가 등록되지 않았음.

```javascript
// 문제 코드
if (document.readyState === 'loading') {
  // 이 분기는 deferred 스크립트에서 절대 실행되지 않음
  document.addEventListener('astro:page-load', () => initAddToPlaylistContainers());
} else {
  // 항상 이 분기 → 최초 1회만 실행, 이후 페이지 이동 시 재초기화 안 됨
  initAddToPlaylistContainers();
}
```

Astro의 `ClientRouter`(View Transitions) 환경에서 `<script>` 태그는 **1회만 실행**된다. 따라서 `astro:page-load` 이벤트 리스너를 등록하지 않으면 이후 페이지 이동 시 새로운 DOM의 버튼에 이벤트 핸들러가 바인딩되지 않는다.

## 해결 방법

`readyState` 체크 없이 `astro:page-load` 리스너를 직접 등록. 이 이벤트는 최초 로드와 View Transitions 이동 모두에서 발생한다.

```diff
- if (document.readyState === 'loading') {
-   document.addEventListener('astro:page-load', () => initAddToPlaylistContainers());
- } else {
-   initAddToPlaylistContainers();
- }
+ document.addEventListener('astro:page-load', () => initAddToPlaylistContainers());
```

`BookmarkButton.astro`, `SourceFilter.astro`, `TagFilter.astro` 등 다른 컴포넌트는 이미 이 패턴을 사용 중이었다.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/AddToPlaylist.astro` | 초기화 패턴을 `astro:page-load` 직접 등록으로 변경 |

## 예방 조치

Astro + ClientRouter 환경에서 클라이언트 스크립트 초기화 시 **항상 `document.addEventListener('astro:page-load', ...)` 패턴을 사용**할 것. `readyState` 체크, `DOMContentLoaded`, `window.onload` 등은 View Transitions에서 작동하지 않는다.

기존 컴포넌트의 정상 패턴 참고:
- `BookmarkButton.astro`: `document.addEventListener('astro:page-load', initBookmarkButtons);`
- `SourceFilter.astro`: `document.addEventListener('astro:page-load', initSourceFilter);`
- `TagFilter.astro`: `document.addEventListener('astro:page-load', initTagFilter);`

## 관련 문서

- [소스 필터 기능](../features/source-filter.md)

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-14 | 최초 작성 |
