# 트렌딩 좋아요 버튼이 회색 사각형으로 보이는 문제

> `/trending` 페이지의 좋아요 버튼이 누르기 전 상태에서 회색 네모 박스로 보여 모던 사이트 톤과 어울리지 않던 문제를 pill-shape 모던 디자인으로 재설계해 해결한 기록.

## 증상

`/trending` 페이지의 카드 우측 하단 좋아요 버튼이 다음과 같이 보였다:

- 둥글지 않은 직사각형 박스
- 패딩이 작고 hover 마이크로-인터랙션 없음
- `좋아요` 텍스트만 표시되고, 카운트는 옆에 분리된 `❤️ 5` 스팬으로 따로 표시됨
- 누르기 전 상태(default)에서 색상 톤이 거의 없어 사이트 전체 디자인 언어와 이질적

```html
<!-- 이전: 두 요소가 분리되어 있고 .btn 베이스 스타일이 누락됨 -->
<span class="like-count">❤️ 5</span>
<button class="btn like-button">
  <span class="like-button-icon">♡</span>
  <span class="like-button-label">좋아요</span>
</button>
```

```css
/* 이전: padding/radius/transition만 약간 정의, hover 변화 없음 */
.like-button {
  font-size: 0.8rem;
  font-weight: 700;
  padding: var(--space-xs) var(--space-sm);
}
```

**재현 환경**: Production (`https://honeycombo.pages.dev/trending/`), 모든 브라우저.

## 원인

1. **글로벌 `.btn` 클래스가 정의되지 않음** — `src/pages/trending.astro`는 마크업에서 `class="btn like-button"`을 사용했지만 글로벌 `src/styles/global.css`에는 `.btn` 셀렉터가 없다(각 페이지의 scoped style에서만 정의). 따라서 사실상 `.like-button` 자체 스타일만 적용되어 텍스트 글리프 박스 모양이 됨.
2. **누르기 전(default) 시각 상태 부재** — `.like-button.is-liked`만 색상이 있고, default 상태는 색/효과가 거의 없어 단조로움.
3. **하트 아이콘이 `♡`/`♥` 텍스트 글리프** — 폰트 의존, 크기/정렬이 일관되지 않음.
4. **좋아요 카운트가 별도 스팬** — 정보가 분리되어 시각 노이즈 증가.

## 해결 방법

좋아요 버튼을 self-contained 모던 컴포넌트로 재설계:

```diff
- <span class="like-count">❤️ 5</span>
- <button class="btn like-button">
-   <span class="like-button-icon">♡</span>
-   <span class="like-button-label">좋아요</span>
- </button>
+ <button class="like-button">
+   <span class="like-button-icon">
+     <svg class="icon-outline">...</svg>
+     <svg class="icon-filled">...</svg>
+   </span>
+   <span class="like-button-count">5</span>
+ </button>
```

```diff
- .like-button {
-   font-size: 0.8rem;
-   font-weight: 700;
-   padding: var(--space-xs) var(--space-sm);
- }
+ .like-button {
+   /* pill shape, generous padding, smooth cubic-bezier transitions */
+   border-radius: 999px;
+   padding: 0.375rem 0.875rem;
+   border: 1px solid var(--color-border);
+   background: var(--color-bg);
+   transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
+ }
+ .like-button:hover:not(:disabled) {
+   color: #e74c6f;
+   border-color: #f4b6c4;
+   background: #fff5f7;
+   transform: translateY(-1px);
+   box-shadow: var(--shadow-sm);
+ }
+ .like-button.is-liked {
+   background: linear-gradient(135deg, #ff5a7a 0%, #e74c6f 100%);
+   color: #fff;
+   box-shadow: 0 2px 8px rgba(231, 76, 111, 0.25);
+ }
+ .like-button.is-liked .icon-filled {
+   animation: like-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
+ }
```

추가 개선:
- `aria-label`에 현재 카운트 포함 (`"좋아요 (현재 248개)"`) — 스크린리더에서 즉시 카운트 확인 가능
- `:focus-visible` 링 추가
- `@media (prefers-reduced-motion: reduce)` 미디어 쿼리로 모션 민감 사용자 보호
- 빨간 톤(`#e74c6f`)은 사이트 내 BookmarkButton과 동일한 색상 컨벤션을 따라 일관성 유지
- BookmarkButton의 SVG path를 재사용해 아이콘 일관성 확보

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/pages/trending.astro` | `.like-button` 모던 pill 디자인, `.like-count` 숨김, 스켈레톤 모양/크기 갱신, `prefers-reduced-motion` 지원 |
| `public/scripts/trending-page.js` | 마크업 갱신 (SVG 하트 아이콘, 카운트 통합), `aria-label`에 카운트 포함, 별도 `like-count` 스팬 제거, `updateLikeButton`이 통합 카운트만 갱신 |
| `docs/features/trending-playlists.md` | 좋아요 버튼 UI 섹션 추가, 변경 이력 추가 |

## 예방 조치

- **글로벌이 아닌 클래스를 마크업에서 의존하지 말 것** — `.btn`은 페이지별 scoped style에만 정의되어 있다. 새 컴포넌트의 버튼은 글로벌 토큰(`var(--color-*)`, `var(--radius-*)`, `var(--shadow-*)`)과 자체 셀렉터로만 스타일을 완성해야 한다.
- **default(누르기 전) 상태도 시각 디자인 1급 시민으로 다룰 것** — hover/focus/active/liked 모든 상태가 명확히 구분되어야 한다.
- **텍스트 글리프(♡♥) 대신 SVG 아이콘 사용** — 폰트/플랫폼별 렌더링 차이가 큼. 사이트 내 다른 SVG 아이콘(BookmarkButton 등)과 일관된 패턴을 따른다.
- **카운트와 액션은 한 버튼에 통합** — 트위터/유튜브/GitHub 등 모던 패턴. 시각 노이즈를 줄이고 hit target을 키운다.

---

## 관련 문서

- [트렌딩 플레이리스트 기능](../features/trending-playlists.md)
- [페이지 타이틀 표준화 ADR](../decisions/0004-page-title-standardization.md)
- [BookmarkButton 컴포넌트](../../src/components/BookmarkButton.astro) — 동일한 빨간 톤(`#e74c6f`) 컨벤션 출처

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — 좋아요 버튼 회색 박스 → 모던 pill 디자인 재설계 |
