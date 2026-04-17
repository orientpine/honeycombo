# 메인 페이지 리디자인

> 히어로 로고 + CTA 위에 소개, 최근 기사(6), 트렌딩 플레이리스트(3), 추천 인플루언서(4)를 추가해 공백을 해소한 콘텐츠 허브형 레이아웃. 라이트 모드 고정.

## 개요

메인 페이지는 두 단계로 진화했다.

1. **1단계 (2026-04-17 이전)**: CSS 애니메이션 로고 + CTA 버튼 2개만 있는 브랜드 아이덴티티 중심 구성. 스크롤이 짧고 공백이 많아 첫 방문자가 사이트의 가치 제안(3-pillar 큐레이션 모델)을 인지하기 어려웠다.
2. **2단계 (현재)**: 기존 히어로는 유지하되 하단 패딩을 줄이고, 그 아래에 4개의 콘텐츠 섹션을 추가했다. 새 컴포넌트를 만들지 않고 기존 `ArticleCard`, `InfluencerCard`, 기존 디자인 토큰만 사용한다.

라이트 모드는 완전히 고정된다. 로고 이미지 조각의 배경이 흰색이라 OS 다크모드 적용 시 로고와 페이지 배경 사이에 경계가 드러나는 문제를 차단하기 위해, CSS(`color-scheme: light`)와 HTML(`<meta name="color-scheme" content="light">`) 양쪽에서 명시한다.

## 동작 흐름

```
페이지 로드
  ↓
[Hero] initHoneyComboLogo() → 9개 PNG 조각을 순차 scale/fade 애니메이션
  ↓
[Intro] 정적 마크업 (README 기반 카피 + 3-pillar 뱃지)
  ↓
[최근 기사] 빌드 타임: getCollection('curated', status=approved) + getCollection('feeds')
         → compareArticles 로 날짜 내림차순 정렬 → 상위 6개 슬라이싱
         → ArticleCard × 6 (grid-3)
  ↓
[트렌딩 플레이리스트] 빌드 타임: 스켈레톤 3개 렌더링
         런타임: loadHomeTrending() → fetch('/api/trending?page=1&limit=3')
         → 응답의 data.playlists.slice(0, 3) 을 인라인 카드 HTML 로 치환
  ↓
[추천 인플루언서] 빌드 타임: getCollection('influencers').slice(0, 4)
         → InfluencerCard × 4 (grid-2, 모바일 1열)
```

- 기사 날짜 필드는 `submitted_at` 우선, 없으면 `published_at`을 사용한다 (`articles/index.astro`와 동일 로직).
- 기사 수집·인플루언서 수집 실패 시 빈 배열 fallback + 안내 메시지 표시.
- 트렌딩 API 실패/빈 응답 시 스켈레톤을 에러 안내로 교체한다.

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
- 홈에 새 컴포넌트를 만들지 않는다. 기존 `ArticleCard`, `InfluencerCard`와 인라인 트렌딩 카드 마크업만 사용한다. 트렌딩 카드는 `.trending-page` 스코프로 묶인 `trending.astro`의 `is:global` 스타일과 선택자가 충돌하지 않도록 `home-playlist-*` 접두어를 사용해 독립적으로 스타일링한다.
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
