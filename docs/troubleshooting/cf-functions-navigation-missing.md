# Cloudflare Functions 페이지에서 Navigation(목차) 사라지는 문제

> Cloudflare Pages Functions로 렌더링되는 페이지(/trending, /p/[id])에서 Navigation 바가 누락되어 사이트 내 이동이 불가능했던 문제

## 증상

`/trending` 페이지에 접속하면 상단 Navigation 바(Home, Articles, Trending, Must-read, Playlists, Influencers, Submit 링크)가 보이지 않고, 로고만 표시됨. `/p/[id]` 페이지도 동일 증상.

다른 Astro 정적 페이지(/, /articles, /must-read 등)에서는 Navigation이 정상 표시됨.

**재현 환경**: 모든 브라우저, 모든 디바이스. Cloudflare Pages 프로덕션 환경.

## 원인

`/trending`과 `/p/[id]` 페이지는 Cloudflare Pages Functions (SSR)으로 렌더링됨. 이 함수들은 Astro 빌드 시스템을 사용하지 않고 자체적으로 완전한 HTML 문서를 생성하므로 `BaseLayout.astro`에 포함된 `Navigation.astro` 컴포넌트가 적용되지 않음.

각 함수 파일(`functions/trending.ts`, `functions/p/[id].ts`)이 독립적인 `renderDocument()` 함수를 갖고 있었으며, 이 함수는 로고만 포함한 최소 헤더(`<header class="site-header">`)를 렌더링했음.

```html
<!-- 문제의 최소 헤더 — Navigation 없음 -->
<header class="site-header">
  <div class="site-header-inner">
    <a href="/" class="brand">🍯 HoneyCombo</a>
  </div>
</header>
```

## 해결 방법

공유 레이아웃 모듈(`functions/lib/layout.ts`)을 생성하여 Navigation HTML, CSS, JavaScript를 한 곳에서 관리하도록 리팩토링함.

### 핵심 변경:

1. **`functions/lib/layout.ts` 신규 생성** — `Navigation.astro`와 동일한 구조의 Navigation을 렌더링하는 공유 `renderDocument()` 함수. 디자인 토큰, Navigation, Auth 영역, 햄버거 메뉴, Footer 포함.

2. **`functions/trending.ts` 리팩토링** — 로컬 `renderDocument()` 제거, 공유 모듈의 `renderDocument()` 임포트. 페이지 고유 CSS만 유지.

3. **`functions/p/[id].ts` 리팩토링** — 동일. 추가로 불일치했던 색상 토큰(파란색 → 사이트 테마 주황색)도 공유 토큰으로 통일.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `functions/lib/layout.ts` | 신규 — 공유 레이아웃 (Navigation + 디자인 토큰 + Footer) |
| `functions/trending.ts` | 로컬 `renderDocument` 제거, 공유 레이아웃 사용 |
| `functions/p/[id].ts` | 로컬 `renderDocument` 제거, 공유 레이아웃 사용 |
| `src/components/Navigation.astro` | 변경 없음 — Astro 정적 페이지용 (참조 원본) |
| `src/layouts/BaseLayout.astro` | 변경 없음 — Astro 정적 페이지용 (참조 원본) |

## 예방 조치

1. **새 Cloudflare Function 페이지 추가 시** 반드시 `functions/lib/layout.ts`의 `renderDocument()`를 사용할 것. 자체 HTML 템플릿을 만들지 않는다.

2. **Navigation 항목 변경 시** 두 곳을 동시에 수정해야 함:
   - `src/components/Navigation.astro` — Astro 정적 페이지용
   - `functions/lib/layout.ts`의 `NAV_ITEMS` 배열 — Cloudflare Functions 페이지용

3. **디자인 토큰 변경 시** 세 곳을 동시에 수정해야 함:
   - `src/styles/global.css`
   - `functions/lib/layout.ts`의 `BASE_STYLES`
   - (향후 단일 소스로 통합 검토 필요)

---

## 관련 문서

- [트렌딩 플레이리스트 기능](../features/trending-playlists.md)
- [트렌딩 페이지 전환 결정](../decisions/0002-trending-repurpose.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 |
