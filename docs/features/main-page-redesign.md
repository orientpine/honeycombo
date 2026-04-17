# 메인 페이지 리디자인

> 통합 Hero(로고 + 헤드라인 + 태그라인 + 3-pillar 칩 + CTA) 아래에 최근 기사(6), 트렌딩 플레이리스트(3), 추천 인플루언서(4) 섹션이 이어지는 콘텐츠 허브형 레이아웃. 라이트 모드 고정.

## 개요

메인 페이지는 세 단계로 진화했다.

1. **1단계 (2026-04-17 이전)**: CSS 애니메이션 로고 + CTA 버튼 2개만 있는 브랜드 아이덴티티 중심 구성. 스크롤이 짧고 공백이 많아 첫 방문자가 사이트의 가치 제안(3-pillar 큐레이션 모델)을 인지하기 어려웠다.
2. **2단계**: 기존 히어로 아래에 별도의 카드형 Intro 섹션 + 콘텐츠 섹션 4개를 추가. 콘텐츠는 풍성해졌으나 Hero(로고+CTA)와 Intro(헤드라인+설명+뱃지) 카드가 서로 분리되어 보였고, 한국어 줄바꿈이 어절을 끊어 표시되는 문제가 있었다.
3. **3단계 (현재)**: Hero와 Intro를 하나의 통합 블록으로 합쳤다. 로고 → 헤드라인(그라데이션 액센트) → 태그라인 → 3-pillar 칩 → CTA 순으로 단일 수직 흐름. 한국어 텍스트는 `word-break: keep-all` + `overflow-wrap: break-word` + `text-wrap: balance`로 어절 보존 줄바꿈 처리.

라이트 모드는 완전히 고정된다. 로고 이미지 조각의 배경이 흰색이라 OS 다크모드 적용 시 로고와 페이지 배경 사이에 경계가 드러나는 문제를 차단하기 위해, CSS(`color-scheme: light`)와 HTML(`<meta name="color-scheme" content="light">`) 양쪽에서 명시한다.

## 동작 흐름

```
페이지 로드
  ↓
[Hero 통합 블록]
  - 애니메이션 로고: initHoneyComboLogo() → 9개 PNG 조각 scale/fade
  - <h1> 헤드라인: "저비용 기술 뉴스 큐레이션" + 그라데이션 액센트 단어
  - 태그라인: 한 줄 가치 제안 (word-break: keep-all 적용)
  - 3-pillar 칩 (📡 RSS / ✍️ 에디터 / 🙋 커뮤니티) — hover lift
  - CTA: 기사 보기 (primary, gradient) + 트렌드 랭킹 (secondary)
  ↓
[최근 기사] 빌드 타임: getCollection('curated', status=approved) + getCollection('feeds')
         → compareArticles 로 날짜 내림차순 정렬 → 상위 6개 슬라이싱
         → ArticleCard × 6 (grid-3)
  ↓
[트렌딩 플레이리스트] 빌드 타임: 3개 스켈레톤 카드 렌더링 (.playlist-card-skeleton, shimmer)
         런타임: loadHomeTrending() → fetch('/api/trending?page=1&limit=3')
         → 응답의 data.playlists.slice(0, 3) 을 `<a class="card playlist-card">`
           (header: 타이틀 2줄 클램프 + 기사 수 pill, description 항상 표시
           [없으면 fallback], footer: 큐레이터 + 랭크 뱃지 + 좋아요 수) 로 치환
         → API 실패 시 스켈레톤이 .error-state 안내로 교체
  ↓
[추천 인플루언서] 빌드 타임: getCollection('influencers').slice(0, 4)
         → InfluencerCard × 4 (grid-2, 모바일 1열)
```

- 기사 날짜 필드는 `submitted_at` 우선, 없으면 `published_at`을 사용한다 (`articles/index.astro`와 동일 로직).
- 기사 수집·인플루언서 수집 실패 시 빈 배열 fallback + 안내 메시지 표시.
- 트렌딩 API 실패/빈 응답 시 스켈레톤이 `.error-state` 또는 `.empty-state` 안내로 교체된다.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/pages/index.astro` | 메인 페이지 — 히어로 + Intro + 4개 콘텐츠 섹션, 로고 애니메이션 스크립트, 트렌딩 클라이언트 fetch |
| `src/components/ArticleCard.astro` | 최근 기사 섹션 카드 (재사용) |
| `src/components/InfluencerCard.astro` | 추천 인플루언서 섹션 카드 (재사용) |
| `src/lib/article-sort.ts` | `compareArticles` — 최근 기사 정렬용 공유 비교 함수 |
| `src/layouts/BaseLayout.astro` | `<meta name="color-scheme" content="light">` 삽입 위치 |
| `src/styles/global.css` | `:root { color-scheme: light; ... }` 토큰 선언 |
| `functions/api/trending.ts` | 트렌딩 API 엔드포인트 (`{ page, total, totalPages, playlists: [...] }` 응답) |
| `public/images/logo/group_*.png` | 로고 육각형 조각 이미지 8개 (히어로) |
| `public/images/logo/text_honey_combo.png` | 로고 텍스트 이미지 (히어로) |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `--hc-duration` | `src/pages/index.astro` | `0.7s` | 로고 각 조각 애니메이션 시간 |
| `maxDelay` | `src/pages/index.astro` | `900` | 마지막 육각형 등장 딜레이(ms) |
| `textDelay` | `src/pages/index.astro` | `1200` | 텍스트 등장 딜레이(ms) |
| `startDelay` | `src/pages/index.astro` | `300` | 전체 시작 대기(ms) |
| `recentArticles.length` | `src/pages/index.astro` | `6` | 최근 기사 섹션 표시 개수 |
| `featuredInfluencers.length` | `src/pages/index.astro` | `4` | 추천 인플루언서 섹션 표시 개수 |
| 트렌딩 요청 | `loadHomeTrending()` | `/api/trending?page=1&limit=3` | 홈 트렌딩 섹션 카드 개수 |
| `--color-bg` | `src/styles/global.css` | `#FFFFFF` | 페이지 배경색 (라이트 모드 고정) |
| `color-scheme` | `src/styles/global.css`, `src/layouts/BaseLayout.astro` | `light` | 브라우저 네이티브 위젯(스크롤바/폼)까지 라이트로 강제 |

## 제약 사항

- OS 다크모드 설정과 무관하게 항상 라이트 테마로 표시된다. 배경 흰색 로고 이미지와 페이지 배경의 경계 문제를 차단하기 위함이다.
- 홈에 새 컴포넌트를 만들지 않는다. 기존 `ArticleCard`, `InfluencerCard`와 `/playlists` 페이지의 카드 마크업(`<a class="card playlist-card">` + `playlist-header`/`-title`/`-count`/`-description`/`-footer`/`-curator`)을 그대로 재사용한다. 트렌딩 전용 랭크 뱃지·좋아요 수(`playlist-stats`·`rank-badge`·`like-count`)는 홈에서만 푸터 우측에 추가한다. 스타일은 `.home-trending-section :global(.playlist-card)` 로 스코프해 `/playlists` 의 `.community-section :global(...)`·`.editor-section :global(...)` 선택자, `/trending` 의 `.trending-page :global(...)` 선택자와 충돌하지 않게 분리한다. 홈 카드 타이포는 `1rem/700` (가독성 유지하면서 `/trending` 1.1rem 보다 약간 축소), 랭크 뱃지는 primary→accent 그라데이션 pill, 좋아요 수는 `tabular-nums` 로 숫자 정렬한다.
- 한국어 줄바꿈: Hero 헤드라인·태그라인·pillar 칩 라벨·트렌딩 카드 타이틀에 `word-break: keep-all` + `overflow-wrap: break-word` 를 적용해 "최신 기술 뉴스" 같은 어절이 음절 사이에서 끊기지 않도록 한다 (Naver SmartStudio·Mozilla bedrock 공식 권장 패턴). 헤드라인은 추가로 `text-wrap: balance` 로 멀티 라인일 때 균형 잡힌 줄바꿈을 유도한다.
- 접근성: 트렌딩 스켈레톤 카드에 `aria-hidden="true"`, 랭크 뱃지에 `aria-label="랭킹 N위"`, 좋아요 수에 `aria-label="좋아요 N"` 을 부여해 스크린리더 노이즈를 줄이고 의미를 명시한다. 3-pillar 칩 이모지에는 `aria-hidden="true"` 부여 (이모지 라벨이 중복 안내되지 않도록).
- 기사 날짜 정렬은 `src/lib/article-sort.ts`의 `compareArticles`에 전적으로 위임한다. 홈은 `/articles` 페이지와 정렬 순서가 동일해야 한다.
- 트렌딩 섹션은 클라이언트 fetch 기반이다. API가 다운되면 섹션은 안내 메시지로 그레이스풀하게 전환되며, 나머지 섹션은 영향을 받지 않는다.
- `recentArticles`가 0건이거나 `featuredInfluencers`가 0명일 때도 페이지는 정상 렌더링되며 각 섹션이 빈 상태 안내로 대체된다.

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [히어로 섹션](./hero-section.md)
- [트렌딩 플레이리스트](./trending-playlists.md)
- [추천 인플루언서](./influencers.md)
- [기사 소스 필터](./source-filter.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-17 | 최초 작성 — 메인 페이지 리디자인 및 다크모드 제거 |
| 2026-04-17 | 메인 페이지 콘텐츠 허브화 — 소개 섹션·최근 기사 6·트렌딩 3·추천 인플루언서 4 섹션 추가, `color-scheme: light` CSS/Meta로 라이트 모드 명시 고정 |
| 2026-04-17 | 홈 트렌딩 카드 UI를 `/playlists` 구조(`<a class="card playlist-card">`)로 정렬하면서 랭크·좋아요 스탯은 유지. 타이포 축소(0.95rem/600), 랭크 뱃지 primary→accent 그라데이션 pill, 기사 수 tabular-nums pill, 아바타 18px, hover translateY(-2px) 등으로 정돈 |
| 2026-04-17 | Hero/Intro 통합 + 트렌딩 카드 마감. (1) Hero 블록을 로고 + h1 헤드라인(그라데이션 액센트) + 태그라인 + 3-pillar 칩 + CTA 단일 수직 스택으로 통합, 별도 `.home-intro` 카드 섹션 제거. (2) 한국어 어절 줄바꿈 문제(예: "최신기술 뉴" 분리) 해소를 위해 헤드라인·태그라인·트렌딩 타이틀에 `word-break: keep-all` + `overflow-wrap: break-word` 적용, 헤드라인은 `text-wrap: balance` 추가. (3) Pillar는 `<ul role=list>` 로 시맨틱화하고 칩은 orange-tinted bg + hover translateY(-2px) + bounce easing. (4) CTA는 이모지 + bounce easing(cubic-bezier(0.34, 1.56, 0.64, 1)) + 모바일 풀폭. (5) 트렌딩 카드 Oracle 검증 마감: 타이틀 1rem/700 복원, description fallback 복원, 3장 스켈레톤 복원, 랭크/좋아요 aria-label 추가, "개"는 마크업에 직접 포함 |
