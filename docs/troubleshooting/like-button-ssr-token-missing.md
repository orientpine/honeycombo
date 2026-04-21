# SSR 페이지에서 좋아요 버튼 토큰이 빈 값으로 평가되는 문제

> PR #131~#147로 `src/styles/global.css`에 `--color-like-*` 토큰 10개를 추가했지만, **Cloudflare Functions SSR 페이지(`functions/p/[id].ts`, `functions/trending.ts`)는 Astro 컴파일 CSS가 아닌 별도의 `functions/lib/layout.ts :: BASE_STYLES`를 사용**한다. 그 base에 like 토큰이 빠져 있어 라이브 `/p/[id]`에서 `var(--color-like-default-icon)` 같은 참조가 모두 빈 값으로 평가되어 CSS가 기본값(`currentColor` → 진한 회갈색 `#2F2B31`)으로 fallback되었다. 원본 사용자 불만 "회색이야"가 `/p/[id]` 경로에서 완전히 해소되지 않은 근본 원인.

## 증상

PR #147로 CSS nesting 버그를 수정한 뒤에도 라이브 `/p/QpPyDksJqZnb`의 좋아요 버튼이 여전히 `/trending`과 다르게 보였다:

- default 아이콘 color: `rgb(47, 43, 49)` (`--color-text`의 값) — rose `#d67a8d`가 아님
- 테두리 width: `0px` (border가 적용되지 않음)
- hover 배경: `rgba(0, 0, 0, 0)` (transparent — `--color-like-hover-bg` 비어서 fallback)
- `getComputedStyle(document.documentElement).getPropertyValue('--color-like-default-icon')`: **빈 문자열**

반면 `/trending` (Astro 정적 페이지)는 정상 렌더링. 모두 같은 CSS selector를 쓰지만 토큰을 어디서 가져오느냐가 달랐다.

```
재현 환경: 모든 브라우저, master HEAD (commit 672648d, PR #147 머지 후)
재현 URL: https://honeycombo.pages.dev/p/QpPyDksJqZnb
발견자: Oracle 8차 검증 (Playwright live computed style 확인)
```

## 원인

HoneyCombo의 페이지 렌더링 파이프라인은 **2 갈래**다:

1. **Astro 정적 페이지** (`src/pages/**/*.astro`)
   - `src/styles/global.css`가 BaseLayout에 포함되어 빌드 시 `dist/_astro/BaseLayout.*.css`로 컴파일됨
   - `/trending`, `/`, `/playlists` 등 대부분의 페이지가 이 경로

2. **Cloudflare Functions SSR 페이지** (`functions/**/*.ts`)
   - `functions/lib/layout.ts`의 `BASE_STYLES` 상수(템플릿 리터럴)를 가져와 HTML `<style>` 태그에 직접 삽입
   - Astro 빌드와 무관하게 Cloudflare edge 런타임에서 페이지를 만듦
   - `/p/[id]` (플레이리스트 상세), `/trending` 일부 fallback이 이 경로

두 경로는 **토큰 정의를 공유하지 않는다**. `src/styles/global.css`에 새 토큰을 추가해도 Functions 경로는 자동으로 영향을 받지 않는다. PR #131~#147 동안 이 이중성을 놓쳐서 다음 PR들이:
- Astro 경로 (`/trending`): 정상 작동 ✓
- Functions 경로 (`/p/[id]`): `var(--color-like-*)` 참조만 있고 정의는 없음 — **CSS 빈 값 fallback**

CSS에서 custom property가 정의되지 않았을 때의 fallback:
- `color: var(--color-like-default-icon)` → 값이 없음 → **inherit** (부모의 `currentColor`) → 결국 `--color-text` (`#2F2B31`)
- `border: 1px solid var(--color-like-default-border)` → 값이 없음 → border shorthand **parse fail** → border width 0
- `background: linear-gradient(..., var(--color-like-gradient-from) ...)` → 값이 없음 → gradient 무효 → transparent

결과: 토큰 누락이 연쇄적으로 스타일 전체를 무너뜨림. Oracle 8차 검증이 `document.documentElement`의 computed property를 확인해 빈 문자열임을 직접 증명.

## 해결 방법

`functions/lib/layout.ts`의 `BASE_STYLES :root`에 `src/styles/global.css`와 동일한 like 토큰 10개를 추가:

```diff
  :root {
    --color-bg: #FFFFFF;
    ...
    --color-danger: #ef4444;
+   /* Like button — modern pill design tokens (DESIGN.md §2 Like Family).
+      MUST stay in sync with src/styles/global.css :root. SSR pages
+      (functions/p/[id].ts, functions/trending.ts) pull tokens from
+      this block instead of the Astro-compiled CSS. */
+   --color-like-default-icon: #d67a8d;
+   --color-like-default-border: #f0dde2;
+   --color-like-default-count: var(--color-text);
+   --color-like-hover-text: #e74c6f;
+   --color-like-hover-bg: #fff5f7;
+   --color-like-hover-border: #f4b6c4;
+   --color-like-gradient-from: #ff5a7a;
+   --color-like-gradient-to: #e74c6f;
+   --color-like-gradient-from-hover: #ff4870;
+   --color-like-gradient-to-hover: #d6395d;
+   --color-like-contrast-text: #ffffff;
+   --shadow-like: 0 2px 8px rgba(231, 76, 111, 0.25);
+   --shadow-like-hover: 0 4px 14px rgba(231, 76, 111, 0.35);
    ...
  }
```

주석으로 **"MUST stay in sync with src/styles/global.css :root"**를 명시해 미래 수정 시 두 파일 동기화를 잊지 않도록 가이드.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `functions/lib/layout.ts` | `BASE_STYLES :root`에 like 토큰 10개(+ 주석) 추가 |
| `docs/troubleshooting/like-button-ssr-token-missing.md` | 이 트러블슈팅 기록 |
| `docs/features/trending-playlists.md` | 변경 이력 추가 |

## 예방 조치

- **토큰 정의의 Single Source of Truth를 코드 레벨에서 강제할 것**: 이상적으로는 `functions/lib/layout.ts`가 `src/styles/global.css`의 `:root` 블록을 빌드 시점에 import하는 구조가 안전하다. 현재는 두 곳에 수동 중복이 있어 토큰 추가 시 휴먼 에러 가능.
- **SSR 페이지의 computed style을 배포 후 반드시 확인**: 소스에 토큰 참조만 있고 정의가 없으면 browser devtools에서 빈 문자열로 보인다. Playwright/devtools로 라이브 computed style을 확인하는 것이 `grep`보다 강력.
- **DESIGN.md가 토큰 출처를 명시할 것**: `§2 Like Family` 같은 섹션에서 "이 토큰들은 `src/styles/global.css`와 `functions/lib/layout.ts` 양쪽에 정의되어야 한다"고 기재하는 것이 안전. 이번 PR에서는 주석으로 대체했지만 후속 작업에서 DESIGN.md 보강을 권장.
- **Functions 경로와 Astro 경로의 diff 테스트**: 같은 UI를 두 경로에서 렌더하는 기능에 한해, 둘의 computed style이 일치하는지 자동 검증하는 테스트가 있으면 이 종류 불일치를 조기 탐지 가능.

---

## 관련 문서

- [트렌딩 플레이리스트 기능](../features/trending-playlists.md)
- [좋아요 버튼 default 상태 soft rose tint](./like-button-default-state-rose-tint.md) — PR #140 (토큰 도입)
- [좋아요 버튼 liked 하트 가시성 수정](./like-button-liked-heart-invisible.md) — PR #142
- [`/p/[id]` 좋아요 버튼 CSS nesting 버그](./like-button-p-detail-css-nesting-bug.md) — PR #147 (직전 수정)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — Oracle 8차 검증이 Playwright computed style로 발견한 SSR 토큰 누락 버그 해결 |
