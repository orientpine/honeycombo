# HoneyCombo — Design System

> UI 일관성 확보를 위한 **단일 소스 (Single Source of Truth)**. 어떤 UI 작업이든 이 문서를 먼저 읽고, 새 토큰·패턴·색·간격·컴포넌트 타입이 필요하면 **반드시 이 문서를 먼저 편집**한 뒤 코드를 작성한다.

이 문서는 HoneyCombo 프로젝트의 **현행 코드베이스(`src/styles/global.css` + 모든 `src/components/*.astro`, `src/pages/**/*.astro`의 `<style>` 블록)**에서 실제 사용 중인 디자인 토큰과 패턴을 증거 기반으로 캡처한 것이다. 향후 새 UI 작업은 이 문서를 유일한 진실로 삼아, 문서와 코드의 괴리가 생기면 문서를 먼저 갱신해 진실을 일원화한다.

---

## 1. Visual Theme & Atmosphere

### 무드 (Mood)

**따뜻한 미니멀리즘 + 웜 액센트 CTA (Warm Minimalism with Energetic Hero)** — 개발자 큐레이션 서비스답게 정보 밀도는 확보하되, 기본 표면은 화이트/샌드톤으로 정갈하고, 주요 CTA와 브랜드 포인트에는 오렌지→앰버 그라데이션으로 에너지를 부여한다. GitHub/Linear의 기계적 미니멀리즘보다는, Substack/Dev.to에 가까운 "읽고 싶은 뉴스룸" 톤.

### 밀도 (Density)

- **Medium density**: 카드 그리드(`.grid-2`/`.grid-3`)로 2~3열 정보 나열이 주된 패턴. 각 카드는 `--space-md`(16px) 내부 여백 + `--space-sm`(8px) 요소 gap.
- 섹션 간 여백은 `--space-xl`(32px) 이상으로 넓게 — **여백을 줄이지 말 것**.
- 텍스트 line-height 1.6(본문), 1.4(카드 타이틀), 1.2(히어로/페이지 타이틀) — 가독성 우선.

### 디자인 철학 (Philosophy)

| 원칙 | 설명 |
|------|------|
| **Content-first** | UI가 콘텐츠를 가리지 않는다. 화려한 장식 대신 타이포그래피·간격으로 위계 표현. |
| **Token-driven** | 모든 색·간격·반경은 `var(--*)` CSS custom property로만 사용. HEX/px 하드코딩 금지(예외: §6의 warm shadow rgba). |
| **Energetic CTAs, calm surfaces** | 주요 CTA(`.btn-primary`), 브랜드 로고, nav bottom border, 좋아요 버튼 활성 상태 등 **핵심 포인트에는 `linear-gradient(135deg, var(--color-primary), var(--color-accent))`** 그라데이션을 의도적으로 사용. 그 외 일반 카드·배경·보조 버튼은 solid 색 유지. **그라데이션 남용 금지** — §4에 열거된 패턴 외에는 solid 우선. |
| **Micro-interaction** | interactive 요소는 `transition` (0.15s ~ 0.2s) 필수. Primary CTA는 hover 시 `translateY(-2px)` + 그림자 확대로 lift. |
| **Warm shadow on primary** | Primary 버튼/활성 상태에는 검정 대신 **오렌지 rgba 그림자**(`rgba(245, 124, 34, *)`, `rgba(252, 185, 36, *)`)를 사용해 브랜드 톤 유지. 일반 카드는 중립 검정 rgba. |
| **Light-only** | 현재 dark mode 미구현 — `color-scheme: light` 고정(`BaseLayout.astro` meta + `:root`). 다크모드 추가 시 반드시 이 문서부터 갱신. |

---

## 2. Color Palette & Roles

모든 색은 `src/styles/global.css :root`에 정의됨. 추가 색 사용 시 여기부터 업데이트하고 코드 반영.

### Brand & Neutrals

| 색상명 | HEX | Token | 역할 |
|--------|-----|-------|------|
| Honey Orange | `#F57C22` | `--color-primary` | 주요 액션, 링크, 활성 상태(`.nav-link.active`, `.tag:hover`, `.badge-primary`, `.btn-primary` 기본색), primary 그림자 rgba 기저색 |
| Deep Orange | `#EE7320` | `--color-primary-hover` | Primary 호버, solid primary 버튼 hover 배경 |
| Amber Accent | `#FCB924` | `--color-accent` | 그라데이션 종점 색상(`nav-logo`, `.nav` border-image, `.btn-primary`, `.hero-headline-accent`). **solid 단독 배경으로는 사용하지 않는다 — 반드시 primary와 쌍으로 사용.** |
| Ink | `#2F2B31` | `--color-text` | 본문·제목 텍스트 |
| Smoke | `#6B6168` | `--color-text-muted` | 메타데이터, 설명, 비활성 텍스트, footer 링크, muted 뱃지 |
| Snow | `#FFFFFF` | `--color-bg` | 페이지·카드 기본 배경, `.btn-secondary` 배경 |
| Cream | `#FFF8F0` | `--color-bg-secondary` | 배지 기본 배경, 링크 hover, 드롭다운 호버 |
| Sand | `#E8DDD4` | `--color-border` | 카드·버튼·입력 테두리, 구분선 |

### Semantic

| 색상명 | HEX | Token | 역할 |
|--------|-----|-------|------|
| Success Green | `#10b981` | `--color-success` | 제출 완료 배지(`.badge-submitted`), 성공 상태 |
| Danger Red | `#ef4444` | `--color-danger` | 로그아웃 버튼 텍스트, 위험 액션 (`.text-danger`), 에러 메시지 |

### Affinity Action (Like)

좋아요(감정적 affinity) 액션 전용 palette. primary(orange)가 브랜드 액션을, accent(amber)가 그라데이션 종점을 담당할 때, **like는 별도의 감정 채널(red/pink)**을 쓴다. `src/pages/trending.astro`, `functions/trending.ts`, `functions/p/[id].ts` 3경로에 적용된 동일한 모던 pill 패턴(§4.6).

| 역할 | HEX | Token | 사용 위치 |
|------|-----|-------|----------|
| Icon tint (default) | `#d67a8d` | `--color-like-default-icon` | 정지 상태 SVG 하트 아이콘 — "dead gray"를 피하면서 음성적 Like 신호 |
| Border (default) | `#f0dde2` | `--color-like-default-border` | 정지 상태 pill 테두리 — 은은한 pink-beige |
| Count text (default) | `var(--color-text)` | `--color-like-default-count` | 카운트 숫자 (가독성 우선) |
| Hover text | `#e74c6f` | `--color-like-hover-text` | hover 시 버튼 color — `BookmarkButton:hover`와 동일 톤 |
| Hover bg | `#fff5f7` | `--color-like-hover-bg` | hover 배경 |
| Hover border | `#f4b6c4` | `--color-like-hover-border` | hover 테두리 (pink 강조) |
| Liked gradient start | `#ff5a7a` | `--color-like-gradient-from` | is-liked 배경 그라데이션 시작 |
| Liked gradient end | `#e74c6f` | `--color-like-gradient-to` | is-liked 배경 그라데이션 끝 |
| Liked hover gradient start | `#ff4870` | `--color-like-gradient-from-hover` | is-liked + hover 그라데이션 시작 |
| Liked hover gradient end | `#d6395d` | `--color-like-gradient-to-hover` | is-liked + hover 그라데이션 끝 |
| Contrast text (liked) | `#ffffff` | `--color-like-contrast-text` | is-liked 상태의 카운트/아이콘 흰색 |
| Glow (liked) | `0 2px 8px rgba(231, 76, 111, 0.25)` | `--shadow-like` | is-liked 버튼 주변 소프트 글로우 |
| Glow hover (liked) | `0 4px 14px rgba(231, 76, 111, 0.35)` | `--shadow-like-hover` | is-liked + hover 강화된 글로우 |

**사용 규칙**

- like 전용 토큰이므로 좋아요 버튼 외 다른 컴포넌트에 재사용 금지 — brand orange 채널과 혼동할 수 있음.
- like 액션은 항상 하트 SVG(`icon-outline` + `icon-filled`)만 사용. 하트 자체는 BookmarkButton과 동일한 glyph이지만, **채널(색 토큰 세트)이 달라 의미 구분이 되는 것을 목표**로 한다 (BookmarkButton은 hover/bookmarked 상태가 primary 오렉지가 아닌 red-accent로 겹치는 점은 후속 작업에서 재검토 예정).
- 다크 모드 도입 시 위 토큰만 재정의하면 like 패턴 전체가 자동 반영 — 각 사용처 개별 수정 불필요.

### 색 사용 규칙

- **"회색 버튼" 금지.** 비활성 버튼은 opacity + `cursor: not-allowed`로 표현. 중립 회색 배경 버튼은 디자인 시스템 밖이다.
- **테두리는 항상 `var(--color-border)`** (`#E8DDD4`). 순수 회색(`#ccc`, `#999`) 금지.
- **텍스트 컬러 2단계만 사용**: `--color-text` / `--color-text-muted`. 그 외 회색 톤 추가 금지.
- **Primary 위에 text는 항상 `white`.** (e.g., `.btn-primary`, `.badge-primary`, `.nav-link.active`.)

---

## 3. Typography Rules

### Font Family

| Token | Stack | 용도 |
|-------|-------|------|
| `--font-sans` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif` | 모든 UI 텍스트 |
| `--font-mono` | `'Fira Code', 'Cascadia Code', monospace` | 코드 블록, 기술 태그 |

**웹폰트 import 금지** — 성능/라이선스 이슈. 시스템 폰트 스택 유지.

### Base

- `html { font-size: 16px; }` — 모든 `rem` 계산 기준.
- `body { line-height: 1.6; }` — 본문 기본.
- 전역 `h1`~`h6` 리셋 스타일은 없으므로 **모든 제목은 컴포넌트 단위로 명시적 클래스를 붙여 스타일**한다(아래 Hierarchy 테이블의 클래스 사용).

### 전체 계층 테이블 (Hierarchy)

현행 코드에서 실제 정의된 모든 텍스트 계층. 새 제목을 만들 때는 가장 가까운 기존 클래스를 재사용하고, 꼭 필요하면 이 표에 **먼저** 추가.

| 레벨 | 클래스 / 셀렉터 | font-size | weight | line-height | 기타 | 코드 위치 |
|------|-----------------|-----------|--------|-------------|------|-----------|
| Display (Hero) | `.hero-headline` | `clamp(1.65rem, 4vw, 2.4rem)` | `800` | `1.2` | letter-spacing `-0.02em`, `text-wrap: balance` | `pages/index.astro` |
| Hero accent span | `.hero-headline-accent` | inherit | inherit | inherit | 그라데이션 텍스트 (primary→accent) | `pages/index.astro` |
| Page title (generic) | `.page-title` | `clamp(2rem, 4vw, 2.75rem)` | `800` | `1.2` | 반응형 scale | `styles/global.css` |
| Article detail title | `.article-detail-title` | `2rem` | `800` | `1.3` | `margin-bottom: var(--space-md)` | `pages/articles/[...slug].astro` |
| Page description | `.page-description` | `1.05rem` | default | default | `--color-text-muted` | `styles/global.css` |
| Section title (home/lists) | `.home-section-title`, `.platform-title` | `1.4rem` | `700` | default | | `pages/index.astro`, `pages/influencers.astro` |
| Comments section title | `.comments-title` | `1.25rem` | `700` | default | 아이콘 + 텍스트 flex | `components/Comments.astro`, `components/CommunityComments.astro` |
| Nav logo | `.nav-logo` | `1.2rem` | `900` | default | letter-spacing `0.05em`, 그라데이션 텍스트 | `components/Navigation.astro` |
| Nav link | `.nav-link` | `0.9rem` | `500` | default | muted → active 시 primary 배경 | `components/Navigation.astro` |
| Article card title | `.article-card .article-title` | `1rem` | `600` | `1.4` | primary 컬러 링크 | `components/ArticleCard.astro` |
| Home section link / secondary CTA text | `.home-section-link` | `0.9rem` | `600` | default | primary 컬러 | `pages/index.astro` |
| Article description | `.article-card .article-description` | `0.875rem` | default | `1.5` | muted, 2줄 클램프 | `components/ArticleCard.astro` |
| Article date / Footer | `.article-card .article-date`, `.footer-copy` | `0.8rem` / `0.875rem` | default | default | muted | component-level |
| Button (default) | `.btn` (home) | `0.95rem` | `700` | default | letter-spacing `-0.005em`, padding `12px 22px` | `pages/index.astro` |
| Button (small) | `.btn` (forms) | `1rem` (input-matched) | `500~600` | default | `padding: var(--space-sm) var(--space-md)` | `pages/p/new.astro`, `admin/must-read.astro` |
| Badge | `.badge` | `0.75rem` | `600` | default | uppercase + letter-spacing `0.05em` | `styles/global.css` |
| Tag | `.tag` | `0.75rem` | default | default | pill shape | `styles/global.css` |
| Form hint | `.form-hint`, `.article-date` | `0.8rem` | default | default | muted | `pages/p/new.astro`, components |

### 타이포그래피 규칙

- **제목은 굵게, 본문은 보통.** 제목 `font-weight: 600+`, 본문 `400`.
- **letter-spacing은 의도적 사용만.** uppercase 라벨(`.badge`, `.nav-logo`)에 `0.05em`, 큰 제목(`.hero-headline`, `.btn`)에 음수 tracking. 일반 본문에는 적용 금지.
- **새 제목 레벨 추가 금지 — 먼저 이 표 갱신.** `13px`, `15px` 같은 중간값 하드코딩 금지.
- **Gradient text**는 `-webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;` 3줄 세트로 쓴다(`.nav-logo`, `.hero-headline-accent` 참조).

---

## 4. Component Stylings

### Button — 실제 코드에서 공존하는 2가지 패턴

프로젝트에는 **전역 `.btn` 패턴(홈/폼/관리자 페이지)**과 **컴포넌트 스코프 버튼 패턴(nav, pagination 등)**이 **둘 다 존재**한다. 새 버튼은 맥락에 맞는 쪽을 따르되, CTA는 전역 `.btn`, 소형 컨트롤은 컴포넌트 스코프를 쓰는 것이 관례.

#### 4.1 Global `.btn` (Hero / Form CTA) — `pages/index.astro` 기준

```css
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 22px;
  border-radius: var(--radius-md);         /* 8px */
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: -0.005em;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.2s, background 0.2s, border-color 0.2s, color 0.2s;
  text-decoration: none;
  cursor: pointer;
  border: none;
  font-family: inherit;
}
.btn-primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: white;
  box-shadow: 0 4px 14px rgba(245, 124, 34, 0.3);  /* warm shadow */
}
.btn-primary:hover,
.btn-primary:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(245, 124, 34, 0.4);
  color: white; text-decoration: none; outline: none;
}
.btn-secondary {
  background: white;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.btn-secondary:hover,
.btn-secondary:focus-visible {
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  text-decoration: none; outline: none;
}
```

- 폼 컨텍스트(`pages/p/new.astro`)의 `.btn-primary`는 hover에서 solid `var(--color-primary-hover)` 배경으로 전환하는 변형이 존재. 새 폼에는 이 단순 변형이 더 적합.
- `.btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }` 필수.
- 폼 하단 대형 CTA엔 `.btn-lg` 조합: `padding: var(--space-md) var(--space-xl); font-size: 1.05rem;`.

#### 4.2 Inline / Small Component Button (nav, pagination, auth)

소형 컨트롤은 그라데이션 없이 solid 배경 + border-radius `--radius-sm`.

```css
background: var(--color-primary);
color: white;
padding: var(--space-xs) var(--space-md);
border: none;
border-radius: var(--radius-sm);
font-size: 0.9rem;
font-weight: 500;
font-family: inherit;
cursor: pointer;
transition: background 0.15s;
```

- Hover: `background: var(--color-primary-hover);`
- 예시: `.auth-login-btn` (Navigation), `.pagination a.active`, `.badge-primary`.

#### 4.3 Secondary / Ghost (nav link, dropdown item, pagination default)

```css
background: transparent;           /* 또는 없음 */
color: var(--color-text-muted);    /* 또는 var(--color-text) */
padding: var(--space-xs) var(--space-sm);
border: none;                      /* 또는 1px solid var(--color-border) */
border-radius: var(--radius-sm);
cursor: pointer;
transition: background 0.15s, color 0.15s;
```

- Hover: `background: var(--color-bg-secondary); color: var(--color-text);`
- 예시: `.nav-link`, `.pagination a`, `.auth-dropdown-item`.

#### 4.4 Pill / Tag / Filter

```css
padding: 2px var(--space-sm);
border-radius: 999px;
background: var(--color-bg-secondary);
color: var(--color-text-muted);
border: 1px solid var(--color-border);
font-size: 0.75rem;
cursor: pointer;
transition: background 0.15s, color 0.15s;
```

- Hover/Active: `background: var(--color-primary); color: white; border-color: var(--color-primary);`
- 예시: `.tag`, `.filter-pill`(InterestTagPanel). 좋아요 버튼은 pill shape을 공유하나 **색 채널이 달라 §4.6의 전용 패턴을 따른다**(brand orange가 아닌 like red/pink).

#### 4.5 버튼 공통 규칙

- `border: none` 기본. 테두리가 필요하면 `1px solid var(--color-border)` 명시.
- `cursor: pointer`.
- `font-family: inherit` (native 폰트 변경 방지).
- `:disabled`: `opacity: 0.5 ~ 0.7; cursor: not-allowed; pointer-events: none;`.
- `:focus-visible` 링 필수. 기본 outline 제거 시:
  - 일반: `outline: 2px solid var(--color-primary); outline-offset: 2px;`, 또는
  - 소프트: `box-shadow: 0 0 0 3px rgba(245, 124, 34, 0.15);` (input focus ring과 동일).

#### 4.6 Like Button (Affinity Action Pill)

좋아요 전용 pill 카드 버튼. §2 Affinity Action 채널을 사용해 brand orange와 시각적으로 구분되고, SVG 하트(outline ↔ filled) + 정수 카운트 숫자를 같이 표시한다. 구현: `src/pages/trending.astro`, `functions/trending.ts`, `functions/p/[id].ts`.

```css
/* Default (not liked) */
.like-button {                                  /* or .like-btn (§1 detail) */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;                                /* icon↔count spacing */
  min-height: 2rem;                             /* card trending — 2.25rem for ’playlist detail’ */
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-like-default-border);
  border-radius: 999px;                         /* pill */
  background: var(--color-bg);
  color: var(--color-like-default-count);       /* count numeric */
  font-family: inherit;
  font-size: 0.8rem;                            /* 0.9rem for playlist detail */
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: color 0.18s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.18s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.18s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}
.like-button-icon {
  width: 14px; height: 14px;                    /* 16px × 16px for playlist detail */
  color: var(--color-like-default-icon);        /* rose tint — independent of button color */
}

/* Hover (not liked) — pink lift */
.like-button:hover:not(:disabled) {
  color: var(--color-like-hover-text);
  border-color: var(--color-like-hover-border);
  background: var(--color-like-hover-bg);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}
.like-button:hover:not(:disabled) .like-button-icon {
  color: inherit;                               /* icon joins hover color */
}

/* Liked — pink gradient + glow */
.like-button.is-liked {
  background: linear-gradient(135deg,
              var(--color-like-gradient-from) 0%,
              var(--color-like-gradient-to) 100%);
  border-color: transparent;
  color: var(--color-like-contrast-text);       /* white count */
  box-shadow: var(--shadow-like);
}
.like-button.is-liked .like-button-icon {
  color: inherit;                               /* icon inherits white — PR #142 */
}
.like-button.is-liked:hover:not(:disabled) {
  background: linear-gradient(135deg,
              var(--color-like-gradient-from-hover) 0%,
              var(--color-like-gradient-to-hover) 100%);
  box-shadow: var(--shadow-like-hover);
  transform: translateY(-1px);
}

/* Icon swap — outline default, filled liked with pop animation */
.like-button.is-liked .icon-outline { display: none; }
.like-button.is-liked .icon-filled {
  display: block;
  animation: like-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes like-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.35); }
  100% { transform: scale(1); }
}

/* Respect reduced-motion — keep color transitions, disable lift/scale/pop */
@media (prefers-reduced-motion: reduce) {
  .like-button {
    transition: color 0.18s, background 0.18s, border-color 0.18s, box-shadow 0.18s;
  }
  .like-button-icon,
  .like-button.is-liked .icon-filled { transition: none; animation: none; }
  .like-button:hover:not(:disabled),
  .like-button:active:not(:disabled) { transform: none; }
}
```

**Icon color state machine (철작)**

| State | Icon color | Source rule |
|-------|------------|-------------|
| Default | `var(--color-like-default-icon)` (rose `#d67a8d`) | `.like-button-icon` 기본 |
| Hover (not liked) | `inherit` → `var(--color-like-hover-text)` | `.like-button:hover .like-button-icon` override |
| Liked | `inherit` → `var(--color-like-contrast-text)` (white) | `.like-button.is-liked .like-button-icon` override |
| Liked hover | `inherit` → white (그대로) | liked hover도 버튼 color가 contrast-text 유지 |

**마크업 규칙**

- 버튼 안에 **아이콘과 카운트를 함께** 넣는다. 별도 `<span class="like-count">`을 사용하지 않는다.
- `aria-pressed`, `aria-label` (현재 카운트 포함 — `좋아요 (현재 N개)`) 필수.
- `icon-outline`과 `icon-filled` SVG를 둘 다 내장 — CSS로 display toggle. 텍스트 글리프(♡♥) 금지.
- `:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }` (포커스 링은 brand orange — affinity red가 아님).

**변형**

| 사용처 | 선택자 | 크기 차이 |
|---------|--------|-----------|
| `/trending` 카드 | `.like-button`, `.like-button-icon` | `min-height: 2rem`, `padding: 0.375rem 0.875rem`, icon 14×14, font 0.8rem |
| `/p/[id]` 상세 | `.like-btn`, `.like-icon` | `min-height: 2.25rem`, `padding: 0.5rem 1rem`, icon 16×16, font 0.9rem (공간 여유 있음) |

두 변형은 **동일한 토큰과 상태 머신을 공유**하며, 크기만 문맥에 맞게 달라진다. 상세 페이지는 공간 여유로 인해 텍스트 라벨(`좋아요`/`좋아요 취소`)과 별도 카운트 디스플레이(`❤️ N명이 좋아합니다`)를 더 군다.

### Card (`.card`) — `styles/global.css`

```css
background: var(--color-bg);
border: 1px solid var(--color-border);
border-radius: var(--radius-md);  /* 8px */
padding: var(--space-md);          /* 16px */
transition: box-shadow 0.2s, border-color 0.2s;
```

- Hover: `box-shadow: var(--shadow-md); border-color: var(--color-primary);`
- 내부 구조: `display: flex; flex-direction: column; gap: var(--space-sm);` (ArticleCard 패턴)
- **카드에 기본 `box-shadow`를 두지 않는다.** 기본 border-only → hover에서 shadow 승격.

### Input / Form — 실제 코드 패턴

프로젝트에 **3가지 input 변형**이 공존한다. 새 입력을 만들 때 가장 가까운 것을 복사.

#### 4a. `.form-control` (범용 폼 — `pages/p/new.astro`)

```css
padding: var(--space-sm) var(--space-md);
border: 1px solid var(--color-border);
border-radius: var(--radius-sm);
font-family: inherit;
font-size: 1rem;
background: var(--color-bg);
color: var(--color-text);
transition: border-color 0.2s, box-shadow 0.2s;
```

Focus:
```css
outline: none;
border-color: var(--color-primary);
box-shadow: 0 0 0 3px rgba(245, 124, 34, 0.15);   /* warm focus ring */
```

> ⚠️ 현재 `pages/p/new.astro:357`에 `rgba(37, 99, 235, 0.1)` (파란색) focus shadow가 남아있음 — 이는 **버그**로 간주, 새 코드는 **오렌지 focus ring** 사용. 발견 즉시 수정 PR 권장.

#### 4b. `.search-input` (관리자 검색 — `pages/admin/must-read.astro`)

- 차이: `border-radius: var(--radius-md)` (카드에 맞춘 둥글기), `font: inherit`.
- Focus: `box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);` (amber rgba; primary rgba로 통일하는 것이 바람직).

#### 4c. `.article-search-input` (기사 검색 — `components/ArticleSearch.astro`)

- 전체 폭, `border-radius: var(--radius-md)`, `font-size: 0.95rem`.
- Focus ring: `box-shadow: 0 0 0 3px rgba(245, 124, 34, 0.15);` ✅ 이 값을 표준으로 본다.

**표준 (새 input은 이것)**

```css
.input, input, textarea {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);           /* 또는 sm — 컨텍스트에 맞게 */
  font-family: inherit;
  font-size: 0.95rem;
  background: var(--color-bg);
  color: var(--color-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(245, 124, 34, 0.15);
}
.input::placeholder { color: var(--color-text-muted); }
```

### Navigation — `components/Navigation.astro`

- Sticky, 높이 `var(--nav-height)` (60px), `border-bottom: 2px solid transparent` + `border-image: linear-gradient(to right, var(--color-primary), var(--color-accent)) 1`.
- `background: var(--color-bg)` (불투명), `z-index: 100`.
- Mobile(`max-width: 768px`): 햄버거 토글 + 수직 스택 + `flex-wrap: wrap`.
- 드롭다운: `box-shadow: var(--shadow-md); border: 1px solid var(--color-border); border-radius: var(--radius-md);`.

### Badge — `styles/global.css`

- `display: inline-flex; padding: 2px var(--space-sm); border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;`
- Variants: neutral(기본) / `.badge-primary` / `.badge-submitted`.

### State Matrix (전 컴포넌트 공통)

| State | 시각 표현 |
|-------|----------|
| Default | 기본 토큰 |
| Hover | 배경/색/border 전환, 선택적 `translateY(-2px)`, shadow 확대 |
| Active (nav/tag) | `background: var(--color-primary); color: white;` |
| Focus-visible | `outline: 2px solid var(--color-primary); outline-offset: 2px;` 또는 warm box-shadow ring |
| Disabled | `opacity: 0.5~0.7; cursor: not-allowed; pointer-events: none;` |

---

## 5. Layout Principles

### Spacing Scale

오직 아래 6단계 토큰만 사용. 중간값(`10px`, `20px`, `22px`) 하드코딩 **금지**. 단, 기존 `.btn`의 `padding: 12px 22px`처럼 **이미 코드에 존재하는 의도적 예외**는 보존 가능(새로 추가하지 말 것).

| Token | Value | px | 주 용도 |
|-------|-------|----|---------|
| `--space-xs` | `0.25rem` | 4px | 아이콘-텍스트 gap, 태그 리스트 gap, nav-toggle padding |
| `--space-sm` | `0.5rem` | 8px | 버튼 가로 padding, 카드 내부 gap, 기본 flex gap |
| `--space-md` | `1rem` | 16px | 카드 padding, container horizontal padding, 그리드 gap |
| `--space-lg` | `1.5rem` | 24px | footer padding, 섹션 내부 간격, 대형 버튼 가로 padding |
| `--space-xl` | `2rem` | 32px | 페이지 섹션 간 간격, page-shell gap, pagination margin |
| `--space-2xl` | `3rem` | 48px | footer top margin, 큰 섹션 분리 |

### Grid & Container

- **Container**: `max-width: var(--max-width)` (1200px), `margin: 0 auto`, `padding: 0 var(--space-md)`.
- **Grid utilities** (global.css): `.grid` / `.grid-2` / `.grid-3` — gap `var(--space-md)`.
- **Flex utility**: `.flex { display: flex; gap: var(--space-sm); align-items: center; }`
- **Page shell 패턴**: `.page-shell { display: flex; flex-direction: column; gap: var(--space-xl); }` + `.page-header { max-width: 720px; margin-bottom: var(--space-xl); }`.

### 여백 철학

- **섹션 간은 `--space-xl` 이상** (32px 이상).
- **카드 내부 gap은 `--space-sm`** (8px).
- **main content 세로 padding**: `var(--space-xl) 0` (`.main-content` in BaseLayout).
- **모바일에서 container padding 축소**: `var(--space-md)` → `var(--space-sm)`.
- **"여백 모자람"은 버그.** 카드끼리 붙거나 제목-본문이 붙어 보이면 반드시 gap 추가. AI가 "조금 더 컴팩트하게"라는 이유로 gap을 줄이는 것은 **차단 대상**.

### 컨텐츠 폭 상한

- 읽기용 텍스트 블록(page-header, article body): `max-width: 720px` 권장 — line-length 65~75자.
- 히어로 서브타이틀/폼: `max-width: 640px` 전후.
- Full-width 그리드: container(`1200px`)까지 확장.

---

## 6. Depth & Elevation

### Surface Layer (아래에서 위로)

| Layer | 배경 | Shadow | 예시 |
|-------|------|--------|------|
| L0 Page | `var(--color-bg)` | none | body |
| L1 Section/Card default | `var(--color-bg)` | none (border만) | `.card`, `.article-card` |
| L2 Card hover | `var(--color-bg)` | `var(--shadow-md)` (중립) | `.card:hover` |
| L3 Overlay (dropdown) | `var(--color-bg)` | `var(--shadow-md)` (중립) | `.auth-dropdown` |
| L4 Primary CTA | gradient | **warm** `rgba(245, 124, 34, 0.3)` | `.btn-primary`, `.like-button.is-liked` |
| L5 Primary CTA hover | gradient | **warm** `rgba(245, 124, 34, 0.4)`, lift `translateY(-2px)` | `.btn-primary:hover` |
| L6 Focus ring (input/button) | — | **warm** `rgba(245, 124, 34, 0.15)` 3px halo | `.article-search-input:focus` |

### Shadow Tokens

**Neutral (정보 카드, 드롭다운)**

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08);   /* 미세한 lift — 거의 사용 안 함 */
--shadow-md: 0 4px 12px rgba(0,0,0,0.1);   /* 카드 hover, dropdown */
```

**Warm (primary CTA / 브랜드 포인트)** — 토큰화 대기, 인라인 rgba로 사용

```css
/* .btn-primary 기본 */
box-shadow: 0 4px 14px rgba(245, 124, 34, 0.3);
/* .btn-primary hover */
box-shadow: 0 8px 24px rgba(245, 124, 34, 0.4);
/* focus ring 표준 */
box-shadow: 0 0 0 3px rgba(245, 124, 34, 0.15);
```

> **TODO**: 위 warm shadow 3종은 `--shadow-primary-sm/md/focus` 토큰으로 정식화 후 이 문서 업데이트. 당분간은 위 정확한 rgba 값을 복사해 사용.

### Elevation 규칙

- **기본 상태에 neutral shadow 남발 금지.** 정적 요소는 border로 구분, hover에서만 shadow로 승격.
- **Warm shadow는 primary CTA / focus ring 전용.** 일반 카드 hover에는 중립 `var(--shadow-md)`.
- **그림자 스택 2단계만.** `shadow-sm`, `shadow-md` 외 neutral 그림자 추가 시 토큰 먼저 등록.
- **Primary CTA는 hover 시 translateY(-2px) + shadow 확대 + `cubic-bezier(0.34, 1.56, 0.64, 1)` bounce.** 이 spring-like easing은 `.btn`의 시그니처 모션.

### Border Radius

| Token | Value | 용도 |
|-------|-------|------|
| `--radius-sm` | `4px` | 소형 버튼, 배지, pagination, `.form-control` |
| `--radius-md` | `8px` | 카드, 드롭다운, `.btn`(hero), `.search-input`, `.article-search-input` |
| `--radius-lg` | `12px` | 큰 컨테이너 (현재 일부 패널에서만 — 확대 도입 시 문서화) |
| pill | `999px` | 태그(`.tag`), 필터 pill, 소형 아바타 등 |

`border-radius: 0` (sharp corner) 사용 금지 — 웜톤 무드와 충돌.

---

## 7. Do's and Don'ts

### ✅ Do

- **토큰만 사용.** 색·간격·반경은 모두 `var(--*)`. warm shadow rgba는 §6의 정확한 값을 복사.
- **컴포넌트 `<style>` 활용.** Astro `<style>`은 기본 scoped. 전역 유틸이 필요하면 `global.css` + 본 문서에 등록.
- **새 토큰/색/간격/컴포넌트/그림자 필요 시 → DESIGN.md 먼저 → global.css → 구현.**
- **hover / focus-visible / disabled 상태 항상 정의.**
- **Primary CTA는 `.btn-primary` 패턴 재사용** — 새 그라데이션 변형 금지.
- **Transition duration 0.15s ~ 0.2s.** 이 범위 밖은 의도적 사유 주석 기재.
- **Cubic-bezier easing.** primary lift에는 `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring), 일반 전환에는 `ease-out` 또는 `cubic-bezier(0.4, 0, 0.2, 1)`. **`linear` 금지.**
- **모바일 breakpoint는 768px 단일.** 신규 브레이크포인트 도입 시 문서 먼저.
- **Focus ring은 warm** (`rgba(245, 124, 34, 0.15)` 3px). 파란색 focus ring 금지.

### ❌ Don't

- **회색(`#ccc`, `#888`, `gray`) 버튼/배경/테두리 금지.** 비활성은 opacity, 보조 액션은 ghost variant.
- **HEX/px 임의 하드코딩 금지.** (§6의 warm shadow rgba, `.btn` padding `12px 22px` 같은 기등록 예외 제외.)
- **`!important` 금지.** specificity/구조 재설계.
- **카드에 baseline `box-shadow` 금지.** border-only → hover에서 shadow.
- **AI-generic 디자인 금지** — 밋밋한 회색 카드, 파란색 primary, 보라/초록 accent, 과도한 emoji, 획일적 gradient 배경, 중성 회색 버튼.
- **여백 삭감 금지.** "compact" 목적의 padding/gap 축소는 리뷰에서 reject.
- **새 색/폰트/그림자 임의 도입 금지.** 본 문서 미등록 값 사용 시 PR 차단.
- **Inline `style="..."` 금지.** 동적 값은 CSS custom property 주입 (`style={\`--w: ${w}px\`}`).
- **transition 없는 interactive 요소 금지.**
- **파란색/보라색 focus ring 금지** (`rgba(37, 99, 235, *)`, `rgba(59, 130, 246, *)` 등). warm rgba만 사용.
- **Gradient 남용 금지.** §4 Button 4.1 / nav-logo / hero-headline-accent / like-button 활성 외 신규 그라데이션 도입 금지 — 신규 필요 시 문서 먼저.
- **불투명도만으로 "비활성" 표현 금지.** `opacity` + `cursor: not-allowed` + `pointer-events: none` 세트.
- **다크 모드 media query 임의 추가 금지.** 다크모드는 DESIGN.md 전체 개정이 선행되어야 함.
- **Like 전용 토큰(`--color-like-*`, `--shadow-like*`)을 좋아요 버튼 외 재사용 금지.** affinity action 전용 palette이므로 다른 컴포넌트에 쓰면 brand orange 채널과 혼동된다.
- **like 액션에 brand primary(오렉지)/accent(amber) 그라데이션 사용 금지.** like는 `--color-like-gradient-*`만 사용.
- **좋아요 버튼 안에 별도 `<span class="like-count">`으로 카운트 분리 금지.** 카운트는 `.like-button-count` / `.like-btn-label`처럼 버튼 내부 element로 통합.

---

## 8. Responsive Behavior

### Breakpoints

| 이름 | 범위 | media query |
|------|------|-------------|
| Mobile/Tablet | `< 768px` | `@media (max-width: 768px)` |
| Desktop (default) | `≥ 768px` | — |

**단일 브레이크포인트 원칙.** 중간 태블릿 전용 레이아웃을 두지 않는다. 한 분기로 "데스크톱 vs 그 외"를 구분하고, 모바일 축소는 `clamp()`, `flex-wrap`, `grid-template-columns: 1fr` 패턴을 활용.

### Mobile 축소 전략

- **Grid**: `.grid-2`, `.grid-3` → `1fr`.
- **Container padding**: `var(--space-md)` → `var(--space-sm)`.
- **Navigation**: 햄버거 토글(`.nav-toggle`) 표시, 링크 수직 스택, `flex-wrap: wrap`.
- **Hero / Page title**: `clamp()` 로 자연 축소.
- **Card meta/Footer**: `flex-wrap: wrap` 활용.
- **Button actions**: `.hero-actions { flex-wrap: wrap; }` — CTA가 줄바꿈되도록.

### Touch Target

- **최소 44×44px 권장** (Apple HIG).
- `.nav-link` 모바일 padding: `var(--space-sm)` — 가로 링크 + line-height로 44px 충족.
- `.btn` (hero CTA): `padding: 12px 22px` + `font-size: 0.95rem` ≈ 44px 충족.
- 소형 버튼(`var(--space-xs) var(--space-md)`): ~32px — **중요 CTA에 사용 금지**, 밀도 높은 컨트롤에만.

### Viewport

- `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` (BaseLayout)
- `min-height: 100vh` body — 짧은 페이지에서도 footer가 아래로.

---

## 9. Agent Prompt Guide

### 🎨 Color Quick Reference

```
Primary:         #F57C22  var(--color-primary)       // 주요 액션·링크·활성
Primary Hover:   #EE7320  var(--color-primary-hover) // hover
Accent:          #FCB924  var(--color-accent)        // 그라데이션 종점 (solid 단독 배경 금지)
Text:            #2F2B31  var(--color-text)          // 본문
Text Muted:      #6B6168  var(--color-text-muted)    // 부가/메타
BG:              #FFFFFF  var(--color-bg)            // 페이지·카드
BG Secondary:    #FFF8F0  var(--color-bg-secondary)  // 배지·호버
Border:          #E8DDD4  var(--color-border)        // 모든 테두리
Success:         #10b981  var(--color-success)
Danger:          #ef4444  var(--color-danger)

Radius:  sm=4px  md=8px  lg=12px  pill=999px
Space:   xs=4  sm=8  md=16  lg=24  xl=32  2xl=48 (px)
Shadow (neutral): sm = 0 1px 3px rgba(0,0,0,0.08)
                  md = 0 4px 12px rgba(0,0,0,0.1)
Shadow (warm, primary CTA):
                  base   = 0 4px 14px rgba(245, 124, 34, 0.3)
                  hover  = 0 8px 24px rgba(245, 124, 34, 0.4)
                  focus  = 0 0 0 3px rgba(245, 124, 34, 0.15)
Easing: primary lift = cubic-bezier(0.34, 1.56, 0.64, 1)
        default     = ease-out / cubic-bezier(0.4, 0, 0.2, 1)
        linear      = 금지
Transition duration: 0.15s ~ 0.2s
Breakpoint: 768px (single)
Gradient pattern: linear-gradient(135deg, var(--color-primary), var(--color-accent))
```

### 📝 즉시 사용 가능한 Agent Prompt 템플릿

UI 작업을 agent에게 위임할 때 아래 블록을 프롬프트 최상단에 복사/붙여넣기:

```
[DESIGN SYSTEM CONSTRAINTS — HoneyCombo]

You MUST obey the HoneyCombo design system defined in /DESIGN.md. Before writing
any code, READ /DESIGN.md end-to-end, and if a new token/color/spacing/component
type/shadow is required, UPDATE /DESIGN.md FIRST, then update
/src/styles/global.css, then implement. Non-negotiable rules:

1. Tokens only — no HEX/px hardcoding. Use var(--color-*), var(--space-*),
   var(--radius-*), var(--shadow-*). Warm shadow rgba values are the exact
   literals from DESIGN.md §6 — copy them verbatim.
2. Primary color is warm orange #F57C22 (var(--color-primary)). NEVER introduce
   gray buttons, blue primaries, or neutral-gray card backgrounds.
3. Buttons: reuse .btn + .btn-primary / .btn-secondary (global pattern in
   pages/index.astro) for hero/form CTAs. For inline/small controls follow the
   nav/pagination inline pattern from DESIGN.md §4.2~4.4. Every button needs
   hover + focus-visible + disabled states and transitions (0.15s ~ 0.2s).
4. Primary CTA gradient: linear-gradient(135deg, var(--color-primary), var(--color-accent)).
   Do NOT invent new gradients. Warm orange box-shadow on primary, not black.
5. Cards: border-only baseline, elevate to var(--shadow-md) on hover. Never
   add a baseline box-shadow to generic cards.
6. Inputs: border 1px solid var(--color-border), radius sm or md, focus ring
   box-shadow: 0 0 0 3px rgba(245, 124, 34, 0.15). NEVER blue/purple focus
   rings.
7. Spacing: use the 6-step scale (xs/sm/md/lg/xl/2xl). No intermediate values
   like 10px, 20px. Sections separated by >= var(--space-xl) (32px).
8. Typography: system font stack. Hierarchy per DESIGN.md §3 — reuse existing
   class (hero-headline / page-title / home-section-title / article-detail-title /
   platform-title / comments-title / article-title). No arbitrary font-size.
9. Responsive: single breakpoint at 768px. Grids collapse to 1fr, container
   padding shrinks to var(--space-sm).
10. Transitions: cubic-bezier or ease-out only. For primary lift use
    cubic-bezier(0.34, 1.56, 0.64, 1). NEVER `linear`.
11. Light mode only. Do not add dark-mode media queries without first
    rewriting DESIGN.md.
12. If you need a NEW token, component type, color, spacing, shadow, or
    breakpoint: FIRST edit /DESIGN.md (add entry + rule), THEN update
    /src/styles/global.css, THEN use it.

Before writing code, scan existing components in src/components/ and
src/pages/ for the closest precedent and match its structure. If a component
pattern you introduce is missing from DESIGN.md, ADD IT to DESIGN.md as part
of your PR. Any deviation from this system requires an explicit note in the PR
body with rationale.
```

### 🔍 UI 작업 셀프 체크리스트 (PR 제출 전)

- [ ] 시작 전 DESIGN.md를 처음부터 끝까지 읽었는가?
- [ ] 새 토큰/패턴이 필요했다면 DESIGN.md를 먼저 편집했는가?
- [ ] 모든 색·간격·반경·(중립)그림자가 `var(--*)` 토큰인가?
- [ ] Warm shadow rgba는 §6의 정확한 값을 썼는가 (임의 조정 없음)?
- [ ] Primary CTA는 `.btn-primary` 패턴을 재사용했는가?
- [ ] 회색 버튼, 회색 배경 카드, 블루 primary, 블루/보라 focus ring 등 AI-generic 요소가 없는가?
- [ ] Hover / focus-visible / disabled 상태가 모두 정의됐는가?
- [ ] Transition이 `cubic-bezier` 또는 `ease-out`인가 (linear 아님)?
- [ ] 768px 이하에서 레이아웃이 자연스럽게 축소되는가?
- [ ] 중요한 CTA 터치 타겟이 44px 이상인가?
- [ ] 신규 토큰/패턴 도입 시 `global.css`와 `DESIGN.md`가 함께 업데이트됐는가?
- [ ] `!important`, 임의 HEX/px 하드코딩이 없는가?
- [ ] 섹션 간 여백이 `--space-xl` 이상인가?

---

## 관련 문서

- [`AGENTS.md`](./AGENTS.md) — UI 작업 전 이 DESIGN.md를 참조/편집하라는 상위 지침
- [`src/styles/global.css`](./src/styles/global.css) — 전역 토큰 정의
- [`src/layouts/BaseLayout.astro`](./src/layouts/BaseLayout.astro) — 전역 레이아웃
- [`src/pages/index.astro`](./src/pages/index.astro) — `.btn`/`.btn-primary`/`.btn-secondary` 전역 버튼 패턴, `.hero-headline`
- [`src/pages/p/new.astro`](./src/pages/p/new.astro) — `.form-control` 범용 폼 패턴
- [`src/pages/admin/must-read.astro`](./src/pages/admin/must-read.astro) — `.search-input` + admin-scoped `.btn`
- [`src/components/ArticleSearch.astro`](./src/components/ArticleSearch.astro) — `.article-search-input` 표준 focus ring
- [`src/components/Navigation.astro`](./src/components/Navigation.astro) — 소형 버튼/드롭다운/그라데이션 border
- [`src/components/ArticleCard.astro`](./src/components/ArticleCard.astro) — 카드 패턴
- [`src/components/Comments.astro`](./src/components/Comments.astro), [`CommunityComments.astro`](./src/components/CommunityComments.astro) — `.comments-title`
- [`src/pages/articles/[...slug].astro`](./src/pages/articles/[...slug].astro) — `.article-detail-title`
- [`src/pages/influencers.astro`](./src/pages/influencers.astro) — `.platform-title`

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — 9개 섹션 초판 (global.css + 주요 컴포넌트 기반). |
| 2026-04-21 | Oracle 검증 피드백 반영 — (1) §1에서 "gradient는 브랜드 포인트만" 문구를 "Energetic CTAs"로 교정해 `.btn-primary`/`.like-button` 실 사용 반영, (2) §3 Hierarchy에 `.hero-headline`/`.home-section-title`/`.article-detail-title`/`.platform-title`/`.comments-title` 추가, (3) §4에 전역 `.btn`/`.btn-primary`/`.btn-secondary` 실패턴과 `.form-control`/`.search-input`/`.article-search-input` 3종 input을 실제 코드 기준으로 기술, (4) §6에 warm shadow rgba 공식화, (5) §7에 파란색 focus ring 금지 + gradient 남용 금지 추가, (6) AGENTS.md에서 "항상 DESIGN.md를 먼저 편집"을 리터럴 조항으로 강제하는 방향으로 동기화. |
| 2026-04-21 | **Like button 전용 패턴 등록** — PR #131→#142 작업으로 구현된 좋아요 pill 버튼을 DESIGN.md에 등록. (1) §2 "Affinity Action (Like)" subsection 신규 작성 — `--color-like-*` 10개 + `--shadow-like*` 2개 토큰 표목 정의 및 재사용 금지 규칙. (2) §4.6 "Like Button (Affinity Action Pill)" 신규 작성 — default/hover/liked/liked-hover 4상태 상세 CSS, icon color state machine, 사이즈 변형(`/trending` vs `/p/[id]`) 명세. (3) §4.4 Pill/Tag 서브셈에서 like의 입장 내용을 §4.6 상용 참조로 정리. (4) §7 Don't에 'like 토큰 재사용 금지', 'brand orange/amber 그라데이션을 like에 쓰는 것 금지', '카운트를 버튼 밖으로 분리 금지' 규칙 추가. (5) §2 Brand & Neutrals 표 내 `.like-button.is-liked` 인용을 실제 구현(amber 그라데이션이 아닌 like 전용 그라데이션)에 맞게 지움. |
