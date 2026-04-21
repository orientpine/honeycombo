# 좋아요 버튼 — 토큰화 및 사이트 전체 일관성 확보 후속

> PR #131 (`/trending` pill 재디자인) 직후 Oracle 검토에서 지적된 (1) 하드코딩 색상, (2) `/p/[id]` 상세 페이지 누락, (3) `functions/trending.ts` legacy fallback 누락의 3가지 결함을 한 번에 해결한 기록.

## 증상

PR #131이 머지된 직후, Oracle의 비판적 검토 결과 다음 결함이 확인됐다:

1. **하드코딩 색상이 저장소 UI 규칙 위반**
   `src/pages/trending.astro`의 `.like-button:hover`, `.like-button.is-liked` 등에 `#e74c6f`, `#f4b6c4`, `#fff5f7`, `#ff5a7a`, `rgba(231, 76, 111, 0.25)` 같은 리터럴 색상이 사용됨. AGENTS.md UI 디자인 원칙은 "색상 하드코딩 금지 (CSS custom property 사용)"를 명시.

2. **`/p/[id]` 플레이리스트 상세 페이지의 좋아요 버튼이 여전히 구형**
   `functions/p/[id].ts`는 `class="btn like-btn"` + `♡♥` 텍스트 글리프 + 별도 카운트 표시(`❤️ N명이 좋아합니다`) + 텍스트 라벨(`좋아요`)이라는 구형 구조 유지. 라이브 `https://honeycombo.pages.dev/p/QpPyDksJqZnb`에서 직접 확인됨.

3. **`functions/trending.ts` legacy SSR fallback도 구형 유지**
   같은 `/trending` 라우트의 SSR fallback 경로가 별도 `<span class="like-count">❤️ N</span>` + 글리프 버튼 구조로 남음.

```
재현 환경: 모든 브라우저, master 브랜치 commit 9ebe46c (PR #131 squash merge) 이후
```

## 원인

PR #131이 `/trending` Astro 정적 shell 한 군데만 수정한 결과, **같은 좋아요 액션이 페이지마다 다른 디자인 언어를 갖게 되어 일관성이 깨졌다**. 또한 시급한 시각 개선을 우선했더니 디자인 토큰 추출이 누락됐다.

좋아요 UI는 3곳에 중복 정의되어 있다:
- `src/pages/trending.astro` (Astro SSG, 메인 경로)
- `functions/trending.ts` (Cloudflare Pages Functions SSR fallback)
- `functions/p/[id].ts` (플레이리스트 상세 SSR)

PR #131은 첫 번째만 갱신했다.

## 해결 방법

### 1) 디자인 토큰 추출 (`src/styles/global.css`)

좋아요 액션 전용 CSS custom property 6개 + shadow 2개를 `:root`에 추가:

```diff
+ /* Like button — modern pill design tokens.
+    Reds (not orange primary) signal an emotional/affinity action. */
+ --color-like: #e74c6f;
+ --color-like-hover-text: #e74c6f;
+ --color-like-hover-bg: #fff5f7;
+ --color-like-hover-border: #f4b6c4;
+ --color-like-gradient-from: #ff5a7a;
+ --color-like-gradient-to: #e74c6f;
+ --color-like-gradient-from-hover: #ff4870;
+ --color-like-gradient-to-hover: #d6395d;
+ --shadow-like: 0 2px 8px rgba(231, 76, 111, 0.25);
+ --shadow-like-hover: 0 4px 14px rgba(231, 76, 111, 0.35);
```

장점: 다크 모드 도입 시 `:root[data-theme="dark"]` 등에서 토큰만 재정의하면 좋아요 UI 전체가 자동 반영됨. 사이트 내 색상 일관성 단일 출처.

### 2) `src/pages/trending.astro`에서 토큰 사용

```diff
  .like-button:hover:not(:disabled) {
-   color: #e74c6f;
-   border-color: #f4b6c4;
-   background: #fff5f7;
+   color: var(--color-like-hover-text);
+   border-color: var(--color-like-hover-border);
+   background: var(--color-like-hover-bg);
  }
  .like-button.is-liked {
-   background: linear-gradient(135deg, #ff5a7a 0%, #e74c6f 100%);
-   box-shadow: 0 2px 8px rgba(231, 76, 111, 0.25);
+   background: linear-gradient(135deg, var(--color-like-gradient-from) 0%, var(--color-like-gradient-to) 100%);
+   box-shadow: var(--shadow-like);
  }
```

### 3) `functions/trending.ts` SSR fallback 마이그레이션

같은 모던 pill 패턴(SVG 하트, 통합 카운트, 3-state, `aria-label`에 카운트 포함, `:focus-visible`, `prefers-reduced-motion`)으로 카드 마크업 + `PAGE_STYLES` 인라인 CSS + `<script>` 갱신. `data-like-count-for` 외부 셀렉터 의존도 제거.

### 4) `functions/p/[id].ts` 플레이리스트 상세 마이그레이션

좋아요 버튼만 동일한 모던 pill 패턴으로 교체. 단, `<span class="like-count-display">❤️ N명이 좋아합니다</span>`라는 **풀 텍스트 카운트 표시는 의도적으로 유지** — 상세 페이지에서는 헤더 영역에 더 넉넉한 공간이 있고 의미적 정보(누적 인기도)가 가치 있기 때문. 트렌딩 카드와 달리 상세 페이지에서는 숫자만 보여주면 임팩트가 약하다는 UX 판단.

버튼 자체는 trending과 동일한 디자인 토큰/구조 사용:
- pill shape (border-radius: 999px)
- SVG 하트 (icon-outline / icon-filled)
- 텍스트 라벨(`좋아요`/`좋아요 취소`)은 유지 (상세 페이지는 공간 여유 있음)
- 동일한 hover/liked/disabled state + `prefers-reduced-motion`

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/styles/global.css` | 좋아요 전용 디자인 토큰 10개 추가 (`--color-like-*`, `--shadow-like-*`) |
| `src/pages/trending.astro` | 모든 하드코딩 색상/그림자를 토큰 참조로 교체 |
| `functions/trending.ts` | legacy SSR fallback의 카드 마크업, `PAGE_STYLES` CSS, `<script>`를 모던 pill 패턴으로 갱신 (`data-like-count-for` 외부 selector 제거) |
| `functions/p/[id].ts` | 플레이리스트 상세 페이지 좋아요 버튼/CSS/JS를 동일 모던 패턴으로 교체. 풀 텍스트 카운트 표시(`❤️ N명이 좋아합니다`)는 의도적으로 유지 |
| `docs/features/trending-playlists.md` | 변경 이력에 후속 항목 추가 |

## 예방 조치

- **UI 변경 시 같은 컴포넌트가 여러 경로에 중복 정의되어 있는지 먼저 grep**: 우리 저장소는 Astro SSG와 Cloudflare Functions SSR fallback이 공존하는 구조라 같은 UI가 2~3곳에 중복되는 패턴이 흔하다. (`grep -rn "<className>" src/ functions/`)
- **하드코딩 색상은 PR 시점에 즉시 토큰으로 추출**: 한 번에 처리하지 않으면 다른 곳에서 토큰 없이 같은 리터럴이 복사돼 부채가 누적된다.
- **Oracle 검토를 사후가 아닌 사전에 활용**: 이번처럼 사후에 결함을 잡으면 후속 PR이 필요하다. 비자명 UI 변경은 implementation 전에 Oracle 컨설팅을 권장.

---

## 관련 문서

- [트렌딩 플레이리스트 기능](../features/trending-playlists.md)
- [좋아요 버튼 회색 박스 → 모던 pill 재디자인](./like-button-gray-square-redesign.md) — 선행 작업 (PR #131)
- [페이지 타이틀 표준화 ADR](../decisions/0004-page-title-standardization.md) — 디자인 토큰 사용 원칙

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — Oracle 후속 수정으로 토큰화 + 사이트 전체 좋아요 UI 일관성 확보 |
