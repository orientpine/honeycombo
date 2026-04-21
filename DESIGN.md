# HoneyCombo — Design System

> UI 일관성 확보를 위한 단일 소스 (Single Source of Truth). UI 작업 전 반드시 이 문서를 읽고, 변경 사항이 생기면 이 문서를 먼저 업데이트한다.

이 문서는 현재 HoneyCombo 프로젝트(`src/styles/global.css` + 컴포넌트 `<style>` 블록)에서 실제 사용 중인 디자인 토큰과 패턴을 캡처한 것이다. 모든 값은 코드베이스에서 추출한 실제 값이며, 새 컴포넌트/페이지 작성 시 이 문서의 토큰만 사용해야 한다.

---

## 1. Visual Theme & Atmosphere

### 무드 (Mood)

**따뜻한 미니멀리즘 (Warm Minimalism)** — 개발자 큐레이션 서비스답게 정보 밀도는 확보하되, 오렌지/앰버 계열 웜톤 팔레트와 부드러운 그림자·둥근 모서리로 차갑지 않은 인상을 준다. GitHub/Linear의 엄격한 기계적 느낌보다는, Substack/Dev.to에 가까운 "읽고 싶은 뉴스룸" 톤.

### 밀도 (Density)

- **Medium density**: 카드 그리드 기반의 정보 나열이 주된 패턴. 한 뷰포트에 4~6개 카드가 들어가되, 각 카드는 충분한 내부 여백(`--space-md` = 16px)을 확보.
- 섹션 간 여백은 `--space-xl` (32px) 이상으로 넓게 — **여백을 줄이지 말 것**.
- 텍스트 line-height 1.6 (본문), 1.4 (카드 타이틀), 1.2 (페이지 타이틀) — 읽기 편함을 우선.

### 디자인 철학 (Philosophy)

| 원칙 | 설명 |
|------|------|
| **Content-first** | UI가 콘텐츠를 가리지 않는다. 화려한 장식 대신 타이포그래피·간격으로 위계를 표현. |
| **Token-driven** | 모든 색·간격·반경은 `var(--*)` CSS custom property로만 사용. HEX 하드코딩 금지. |
| **Gradient accent only** | 그라데이션은 오로지 브랜드 포인트(`nav-logo`, `.nav` bottom border)에만 사용. 버튼·카드에는 solid 색 사용. |
| **Micro-interaction** | 모든 interactive 요소는 `transition` (0.15s ~ 0.2s) 필수. 호버 시 그림자·색 변화. |
| **Light-only** | 현재 dark mode 미구현 — `color-scheme: light` 고정. 다크모드 추가 시 이 문서 먼저 갱신. |

---

## 2. Color Palette & Roles

모든 색은 `src/styles/global.css :root`에 정의됨. 추가 색 사용 시 여기부터 업데이트한다.

### Brand & Neutrals

| 색상명 | HEX | Token | 역할 |
|--------|-----|-------|------|
| Honey Orange | `#F57C22` | `--color-primary` | 주요 액션, 링크, 활성 상태(`.nav-link.active`, `.tag:hover`, `.badge-primary`) |
| Deep Orange | `#EE7320` | `--color-primary-hover` | Primary 호버 상태 |
| Amber Accent | `#FCB924` | `--color-accent` | 그라데이션 보조색(`nav-logo`, `.nav` border-image) — **solid 배경으로 단독 사용 금지** |
| Ink | `#2F2B31` | `--color-text` | 본문·제목 텍스트 |
| Smoke | `#6B6168` | `--color-text-muted` | 메타데이터, 설명, 비활성 텍스트, footer 링크 |
| Snow | `#FFFFFF` | `--color-bg` | 페이지·카드 기본 배경 |
| Cream | `#FFF8F0` | `--color-bg-secondary` | 배지 기본 배경, 호버 배경, 드롭다운 호버 |
| Sand | `#E8DDD4` | `--color-border` | 카드·버튼·입력 테두리, 구분선 |

### Semantic

| 색상명 | HEX | Token | 역할 |
|--------|-----|-------|------|
| Success Green | `#10b981` | `--color-success` | 제출 완료 배지(`.badge-submitted`), 성공 상태 |
| Danger Red | `#ef4444` | `--color-danger` | 로그아웃 버튼 텍스트, 위험 액션 (`.text-danger`) |

### 색 사용 규칙

- **"회색 버튼" 금지.** 비활성 버튼조차 primary 색 + `opacity`/`cursor: not-allowed`로 표현한다. 중립 회색 배경 버튼은 디자인 시스템 밖이다.
- **테두리는 항상 `--color-border`** (`#E8DDD4`). 순수 회색(`#ccc`, `#999`) 금지.
- **텍스트 컬러 2단계만 사용**: `--color-text` (기본) / `--color-text-muted` (부가). 그 외 회색 톤 추가 금지.

---

## 3. Typography Rules

### Font Family

| Token | Stack | 용도 |
|-------|-------|------|
| `--font-sans` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif` | 모든 UI 텍스트 (시스템 폰트 우선, 한글은 Noto Sans KR fallback) |
| `--font-mono` | `'Fira Code', 'Cascadia Code', monospace` | 코드 블록, 기술 태그 |

**웹폰트 import 금지** — 성능/라이선스 이슈. 시스템 폰트 스택 유지.

### Base

- `html { font-size: 16px; }` — 모든 `rem` 계산의 기준.
- `body { line-height: 1.6; }` — 본문 기본.

### Hierarchy

| 요소 | font-size | font-weight | line-height | 기타 | 코드 위치 |
|------|-----------|-------------|-------------|------|-----------|
| Page title (`.page-title`) | `clamp(2rem, 4vw, 2.75rem)` | `800` | `1.2` | 반응형 스케일 | `global.css` |
| Page description (`.page-description`) | `1.05rem` | default | default | `--color-text-muted` | `global.css` |
| Nav logo | `1.2rem` | `900` | default | letter-spacing `0.05em`, 그라데이션 텍스트 | `Navigation.astro` |
| Nav link | `0.9rem` | `500` | default | `--color-text-muted` → active 시 `--color-primary` 배경 | `Navigation.astro` |
| Article title (카드) | `1rem` | `600` | `1.4` | primary 컬러 링크 | `ArticleCard.astro` |
| Article description | `0.875rem` | default | `1.5` | muted, 2줄 클램프 | `ArticleCard.astro` |
| Article date / Footer | `0.8rem` / `0.875rem` | default | default | muted | component-level |
| Badge / Tag | `0.75rem` | `600` (badge) | default | uppercase + letter-spacing `0.05em` (badge) / pill (tag) | `global.css` |
| Pagination | default | `500` | default | `--space-sm var(--space-md)` 패딩 | `global.css` |

### 타이포그래피 규칙

- **제목은 굵게, 본문은 보통.** `font-weight: 400` 본문과 `font-weight: 600+` 제목의 대비를 유지.
- **letter-spacing**: 오로지 uppercase 라벨(`.badge`, `.nav-logo`)에만 `0.05em` 적용. 일반 텍스트에는 적용 금지.
- **font-size 하드코딩 금지**: 새 사이즈가 필요하면 위 스케일에 먼저 추가. `13px`, `15px` 같은 임시 값 금지.

---

## 4. Component Stylings

### Button

프로젝트에는 범용 `.button` 클래스가 없고, 컴포넌트별 인라인 패턴이 있다. **새 버튼을 만들 때는 아래 3가지 variant 중 하나를 정확히 따르고, 컴포넌트 `<style>` 블록에 구현한다.**

#### Primary (주요 액션)

```css
background: var(--color-primary);
color: white;
padding: var(--space-xs) var(--space-md);  /* 또는 var(--space-sm) var(--space-md) */
border: none;
border-radius: var(--radius-sm);
font-size: 0.9rem;
font-weight: 500;
font-family: inherit;
cursor: pointer;
text-decoration: none;
transition: background 0.15s;
```

- Hover: `background: var(--color-primary-hover);`
- 예시: `.auth-login-btn` (Navigation.astro), `.pagination a.active`

#### Secondary / Ghost (보조 액션)

```css
background: transparent;
color: var(--color-text);  /* 또는 var(--color-text-muted) */
padding: var(--space-xs) var(--space-sm);
border: 1px solid var(--color-border);  /* 또는 border: none + hover bg */
border-radius: var(--radius-sm);
cursor: pointer;
transition: background 0.15s, color 0.15s;
```

- Hover: `background: var(--color-bg-secondary); color: var(--color-text);`
- 예시: `.nav-link`, `.pagination a`, `.auth-dropdown-item`

#### Pill (Tag/Filter)

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
- 예시: `.tag` (global.css)

#### 모든 버튼 공통 규칙

- `border: none` (테두리가 필요하면 명시적으로 `1px solid var(--color-border)`)
- `cursor: pointer`
- `font-family: inherit` (native 버튼의 기본 폰트 변경 방지)
- `:disabled` 상태: `opacity: 0.5; cursor: not-allowed;`
- `:focus-visible` 링 필수 — 기본 outline 제거 시 `outline: 2px solid var(--color-primary); outline-offset: 2px;` 대체

### Card (`.card`)

```css
background: var(--color-bg);
border: 1px solid var(--color-border);
border-radius: var(--radius-md);  /* 8px */
padding: var(--space-md);          /* 16px */
transition: box-shadow 0.2s, border-color 0.2s;
```

- Hover: `box-shadow: var(--shadow-md); border-color: var(--color-primary);`
- 내부 구조: `display: flex; flex-direction: column; gap: var(--space-sm);` (ArticleCard 패턴)
- 썸네일: `border-radius: var(--radius-sm);`, `object-fit: cover;`
- **카드에 `box-shadow`를 기본 상태에 넣지 않는다.** 기본은 border-only, hover 시 shadow로 승격.

### Input / Form

현재 전용 `.input` 유틸 클래스는 없으며 페이지별 폼은 거의 없다. 신규 input 작성 시:

```css
padding: var(--space-sm) var(--space-md);
border: 1px solid var(--color-border);
border-radius: var(--radius-sm);
font-family: inherit;
font-size: 0.9rem;
background: var(--color-bg);
color: var(--color-text);
transition: border-color 0.15s, box-shadow 0.15s;
```

- Focus: `border-color: var(--color-primary); outline: none; box-shadow: 0 0 0 3px rgba(245, 124, 34, 0.15);`
- Placeholder: `color: var(--color-text-muted);`

### Navigation

구조: sticky header, 높이 `--nav-height` (60px), `border-bottom: 2px solid` + `border-image` 그라데이션.

- 배경: `var(--color-bg)` (스크롤에도 불투명)
- z-index: `100`
- Mobile (`max-width: 768px`): 햄버거 토글, 링크 수직 스택, `flex-wrap: wrap`

### Badge

- Base: `display: inline-flex; padding: 2px var(--space-sm); border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;`
- Variants: 기본(neutral) / `.badge-primary` / `.badge-submitted`

### State Matrix (전 컴포넌트 공통)

| State | 시각 표현 |
|-------|----------|
| Default | 기본 토큰 사용 |
| Hover | 배경/색 전환 + (카드는) shadow elevation |
| Active | `background: var(--color-primary); color: white;` |
| Focus-visible | `outline: 2px solid var(--color-primary); outline-offset: 2px;` (또는 box-shadow ring) |
| Disabled | `opacity: 0.5; cursor: not-allowed; pointer-events: none;` |

---

## 5. Layout Principles

### Spacing Scale

오직 아래 6단계 토큰만 사용. 중간값(`10px`, `20px` 등) 하드코딩 **금지**.

| Token | Value | px | 주 용도 |
|-------|-------|----|---------|
| `--space-xs` | `0.25rem` | 4px | 아이콘-텍스트 gap, 태그 리스트 gap, nav-toggle padding |
| `--space-sm` | `0.5rem` | 8px | 버튼 가로 padding, 카드 내부 요소 gap, 기본 flex gap |
| `--space-md` | `1rem` | 16px | 카드 padding, container horizontal padding, 그리드 gap |
| `--space-lg` | `1.5rem` | 24px | footer padding, 섹션 내부 간격 |
| `--space-xl` | `2rem` | 32px | 페이지 섹션 간 간격, page-shell gap, pagination margin |
| `--space-2xl` | `3rem` | 48px | footer top margin, 큰 섹션 분리 |

### Grid & Container

- **Container**: `max-width: var(--max-width)` (1200px), `margin: 0 auto`, `padding: 0 var(--space-md)`.
- **Grid utilities** (global.css):
  - `.grid { display: grid; gap: var(--space-md); }`
  - `.grid-2 { grid-template-columns: repeat(2, 1fr); }`
  - `.grid-3 { grid-template-columns: repeat(3, 1fr); }`
- **Flex utility**: `.flex { display: flex; gap: var(--space-sm); align-items: center; }`
- **Page shell 패턴**: `.page-shell { display: flex; flex-direction: column; gap: var(--space-xl); }` + `.page-header { max-width: 720px; margin-bottom: var(--space-xl); }`

### 여백 철학

- **섹션 간은 `--space-xl` 이상**: 페이지 내 논리 블록 사이에는 32px 이상 여백 확보.
- **카드 내부 `gap`은 `--space-sm`**: 메타 / 타이틀 / 설명 / 태그 / 푸터 사이 8px.
- **main content 세로 padding**: `var(--space-xl) 0` (`.main-content` in BaseLayout).
- **모바일에서 container padding 축소**: `var(--space-md)` → `var(--space-sm)` (8px).
- **"여백 모자람"은 버그.** 카드끼리 붙거나 제목-본문이 붙어 보이면 반드시 gap 추가.

### 컨텐츠 폭 상한

- 읽기용 텍스트 블록(page-header, article body): `max-width: 720px` 권장 — line-length 65-75자 유지.
- Full-width 그리드(카드 리스트): container (`1200px`)까지 확장.

---

## 6. Depth & Elevation

### Surface Layer (아래에서 위로)

| Layer | 배경 | Shadow | 예시 |
|-------|------|--------|------|
| L0 Page | `var(--color-bg)` | none | body |
| L1 Section/Card default | `var(--color-bg)` | none (border만) | `.card`, `.article-card` |
| L2 Card hover | `var(--color-bg)` | `var(--shadow-md)` | `.card:hover` |
| L3 Overlay (dropdown, popover) | `var(--color-bg)` | `var(--shadow-md)` | `.auth-dropdown` |
| L4 Modal (TBD) | `var(--color-bg)` | `var(--shadow-md)` 이상 | 향후 추가 시 `--shadow-lg` 신규 토큰 필요 |

### Shadow Tokens

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08);   /* 미세한 lift — 거의 사용 안 함 */
--shadow-md: 0 4px 12px rgba(0,0,0,0.1);   /* 카드 hover, dropdown */
```

### Elevation 규칙

- **기본 상태에 shadow 남발 금지.** 정적 요소는 border로 구분, 상호작용이 있는 요소만 hover에서 shadow.
- **그림자는 2단계만.** `shadow-sm`, `shadow-md` 외에 새 그림자 추가 시 먼저 global.css에 토큰으로 등록.
- **그림자 색은 `rgba(0,0,0,*)` 고정.** 오렌지/컬러 그림자 금지 (브랜드 일관성 유지).

### Border Radius

| Token | Value | 용도 |
|-------|-------|------|
| `--radius-sm` | `4px` | 버튼, 배지, pagination, input |
| `--radius-md` | `8px` | 카드, 드롭다운, 모달 |
| `--radius-lg` | `12px` | 큰 컨테이너 (현재 미사용, 예약) |
| pill | `999px` | 태그 (`.tag`) |

`border-radius: 0` (sharp corner) 사용 금지 — 웜톤 무드와 충돌.

---

## 7. Do's and Don'ts

### ✅ Do

- **토큰만 사용.** 색·간격·반경·그림자는 모두 `var(--*)`로 참조.
- **컴포넌트 `<style>` 블록 활용.** Astro `<style>`은 기본적으로 scoped. 전역 유틸이 필요하면 `global.css`에 추가하고 이 문서에 기록.
- **새 토큰 필요 시 global.css 먼저 업데이트 → DESIGN.md에 기록 → 사용.**
- **hover 상태 항상 정의.** 모든 interactive 요소는 hover 반응이 있어야 한다.
- **focus-visible 링 유지.** 키보드 접근성을 위해 outline 제거 시 대체 포커스 스타일 제공.
- **cubic-bezier easing 선호.** 빠른 전환은 `cubic-bezier(0.4, 0, 0.2, 1)` (material standard) 또는 `ease-out`. `linear` 금지.
- **transition duration은 0.15s ~ 0.2s 범위.** 이 범위 밖은 의도적 사유 기재.
- **모바일 breakpoint는 768px.** 추가 브레이크포인트가 필요하면 DESIGN.md에 기록 후 도입.

### ❌ Don't

- **회색(`#ccc`, `#888`, `gray`) 버튼 금지.** 비활성은 opacity, 보조 액션은 ghost variant, 중립 액션은 muted 톤 ghost.
- **HEX/px 하드코딩 금지.** `#F57C22`, `16px` 대신 `var(--color-primary)`, `var(--space-md)`.
- **`!important` 금지.** 스타일 충돌이 나면 specificity/구조를 재설계.
- **`border: none` + `box-shadow`로 카드 구분 금지.** 기본은 border, hover에서 shadow 승격.
- **AI-generic 디자인 금지** — 밋밋한 회색 카드, 생기 없는 파란색 primary, 과도한 emoji, 획일적 gradient 배경 등.
- **여백 삭감 금지.** "공간이 많아 보인다"는 이유로 padding/gap 줄이지 말 것. 밀도를 더 올리려면 먼저 DESIGN.md 논의.
- **새 색/폰트/그림자 임의 도입 금지.** 이 문서에 등록된 것 외에는 사용하지 않는다. 필요하면 이 문서를 먼저 편집.
- **inline `style="..."` 금지.** 동적 값 필요 시 CSS custom property 주입(`style={`--w: ${w}px`}`).
- **transition 없는 interactive 요소 금지.**
- **불투명도로 primary 흐리게 해서 "비활성" 표현 금지.** `opacity: 0.5` + `cursor: not-allowed` + `pointer-events: none` 세트로.

---

## 8. Responsive Behavior

### Breakpoints

| 이름 | 범위 | media query |
|------|------|-------------|
| Mobile/Tablet | `< 768px` | `@media (max-width: 768px)` |
| Desktop (default) | `≥ 768px` | — (기본 스타일) |

**단일 브레이크포인트 원칙.** 중간 태블릿 전용 디자인은 두지 않는다. 한 개의 분기로 "데스크톱 vs 그 외"를 구분하고, 모바일에서 자연스럽게 축소되도록 `clamp()`, `flex-wrap`, `grid-template-columns: 1fr` 패턴을 활용.

### Mobile 축소 전략

- **Grid**: `.grid-2`, `.grid-3` → `1fr` (단일 컬럼)
- **Container padding**: `var(--space-md)` → `var(--space-sm)`
- **Navigation**: 햄버거 토글(`.nav-toggle`) 표시, 링크 수직 스택
- **Page title**: `clamp(2rem, 4vw, 2.75rem)` — 자연 축소
- **Card meta**: `flex-wrap: wrap` 활용 (ArticleCard의 `.article-meta`)
- **Footer**: `flex-wrap: wrap` — 링크 줄바꿈

### Touch Target

- **최소 44×44px 권장** (Apple HIG).
- `.nav-link` 모바일 padding: `var(--space-sm)` (8px 전체) — 가로 링크 길이와 line-height로 44px 충족.
- 버튼 최소 높이: padding 조합으로 `~32px` 이상 확보 (`var(--space-xs) var(--space-md)` = 8px 세로 padding + 0.9rem 폰트 ≈ 32-36px). 중요한 CTA는 `var(--space-sm) var(--space-md)` 이상 사용 권장.

### Viewport

- `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` (BaseLayout)
- `min-height: 100vh` body — 짧은 페이지에서도 footer가 아래로.

---

## 9. Agent Prompt Guide

### 🎨 Color Quick Reference

```
Primary:         #F57C22  var(--color-primary)       // 주요 액션·링크·활성
Primary Hover:   #EE7320  var(--color-primary-hover) // hover
Accent:          #FCB924  var(--color-accent)        // 그라데이션 보조 (solid 배경 금지)
Text:            #2F2B31  var(--color-text)          // 본문
Text Muted:      #6B6168  var(--color-text-muted)    // 부가/메타
BG:              #FFFFFF  var(--color-bg)            // 페이지·카드
BG Secondary:    #FFF8F0  var(--color-bg-secondary)  // 배지·호버
Border:          #E8DDD4  var(--color-border)        // 모든 테두리
Success:         #10b981  var(--color-success)
Danger:          #ef4444  var(--color-danger)

Radius:  sm=4px  md=8px  lg=12px  pill=999px
Space:   xs=4  sm=8  md=16  lg=24  xl=32  2xl=48 (px)
Shadow:  sm = 0 1px 3px rgba(0,0,0,0.08)
         md = 0 4px 12px rgba(0,0,0,0.1)
Transition: 0.15s ~ 0.2s, cubic-bezier 또는 ease-out (linear 금지)
Breakpoint: 768px (single)
```

### 📝 즉시 사용 가능한 Agent Prompt 템플릿

UI 작업을 agent에게 위임할 때 아래 블록을 프롬프트 최상단에 붙여 넣는다:

```
[DESIGN SYSTEM CONSTRAINTS — HoneyCombo]

You MUST obey the HoneyCombo design system defined in /DESIGN.md. Key rules:

1. Tokens only — no HEX/px hardcoding. Use var(--color-*), var(--space-*),
   var(--radius-*), var(--shadow-*) defined in src/styles/global.css.
2. Primary color is warm orange #F57C22 (var(--color-primary)). NEVER introduce
   gray buttons, blue primaries, or neutral-gray backgrounds.
3. Buttons: follow Primary / Secondary-Ghost / Pill variants in DESIGN.md §4.
   Every button needs hover + focus-visible + disabled states and transitions (0.15s).
4. Cards: border-only by default, elevate with var(--shadow-md) on hover. Never
   add a baseline box-shadow.
5. Spacing: use the 6-step scale (xs/sm/md/lg/xl/2xl). No intermediate values
   like 10px, 20px. Sections separated by >= var(--space-xl) (32px).
6. Typography: system font stack via var(--font-sans). Hierarchy per DESIGN.md §3.
   No arbitrary font-size values.
7. Responsive: single breakpoint at 768px. Grids collapse to 1fr, container
   padding shrinks to var(--space-sm).
8. Transitions: cubic-bezier or ease-out only, 0.15s~0.2s. NEVER `linear`.
9. Light mode only (color-scheme: light). Do not add dark-mode media queries
   without first updating DESIGN.md.
10. If you need a NEW token (color, spacing, shadow), FIRST add it to
    src/styles/global.css AND update DESIGN.md, THEN use it.

Before writing code, scan existing components in src/components/ for the closest
precedent and match its structure. If a component pattern is missing from
DESIGN.md, ADD IT to DESIGN.md as part of your PR.
```

### 🔍 UI 작업 셀프 체크리스트 (PR 제출 전)

- [ ] 모든 색·간격·반경·그림자가 `var(--*)` 토큰인가?
- [ ] 회색 버튼, 회색 배경 카드 등 "AI-generic" 요소가 없는가?
- [ ] Hover / focus-visible / disabled 상태가 모두 정의됐는가?
- [ ] Transition이 `cubic-bezier` 또는 `ease-out`인가 (linear 아님)?
- [ ] 768px 이하에서 레이아웃이 자연스럽게 축소되는가?
- [ ] Touch target이 최소 ~32-44px인가?
- [ ] 새 토큰/패턴을 도입했다면 `global.css`와 `DESIGN.md`가 함께 업데이트됐는가?
- [ ] `!important`, inline `style="..."` (동적 custom property 주입 제외), HEX 하드코딩이 없는가?
- [ ] 섹션 간 여백이 `--space-xl` 이상인가?

---

## 관련 문서

- [`AGENTS.md`](./AGENTS.md) — UI 작업 전 이 DESIGN.md를 참조하라는 상위 지침
- [`src/styles/global.css`](./src/styles/global.css) — 실제 토큰 정의 위치
- [`src/layouts/BaseLayout.astro`](./src/layouts/BaseLayout.astro) — 전역 레이아웃 구조
- [`src/components/Navigation.astro`](./src/components/Navigation.astro) — 버튼·드롭다운 패턴 레퍼런스
- [`src/components/ArticleCard.astro`](./src/components/ArticleCard.astro) — 카드 패턴 레퍼런스

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — 현재 코드베이스(`global.css` + 주요 컴포넌트) 기준으로 9개 섹션 전체 캡처 |
