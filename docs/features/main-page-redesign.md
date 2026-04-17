# 메인 페이지 리디자인

> 메인 페이지를 CSS 애니메이션 로고 + CTA 버튼 2개(기사 보기, 트렌드 랭킹)로 단순화하고, 다크모드를 제거하여 흰색 배경 통일

## 개요

메인 페이지를 브랜드 아이덴티티 중심으로 리디자인했다. 기존의 정적 히어로 이미지와 최근 기사 섹션을 제거하고, 육각형 조각이 순차 등장하는 CSS 애니메이션 로고를 메인 비주얼로 배치했다. 로고 이미지 내에 "HONEY COMBO" 텍스트가 포함되어 있어 별도 헤딩이 불필요하다.

다크모드를 전면 제거하고 배경색을 `#FFFFFF`(흰색)로 통일하여 로고 이미지 배경과 페이지 배경 사이에 경계가 보이지 않도록 했다.

## 동작 흐름

```
페이지 로드 → initHoneyComboLogo() 호출 → 9개 PNG 조각을 컨테이너에 배치 → 순차적 딜레이로 scale/fade 애니메이션 → CTA 버튼 표시
```

- 8개 육각형 그룹(`group_1.png` ~ `group_8.png`)이 0~900ms 사이에 순차 등장
- 텍스트(`text_honey_combo.png`)가 1200ms 후 slide-up으로 등장
- Astro 클라이언트 네비게이션(`astro:page-load`)에서도 애니메이션 재생

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/pages/index.astro` | 메인 페이지 — 애니메이션 로고 + CTA 버튼 |
| `public/images/logo/group_*.png` | 로고 육각형 조각 이미지 8개 |
| `public/images/logo/text_honey_combo.png` | 로고 텍스트 이미지 |
| `src/styles/global.css` | 글로벌 CSS — 다크모드 제거, 배경색 #FFFFFF |
| `src/layouts/BaseLayout.astro` | 레이아웃 — 다크모드 preload 제거 |
| `functions/lib/layout.ts` | Functions 레이아웃 — 다크모드 제거 |
| `src/components/Comments.astro` | Giscus 테마 light 고정 |
| `src/components/CommunityComments.astro` | Giscus 테마 light 고정 |
| `public/scripts/community-page.js` | Giscus 테마 light 고정 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `--hc-duration` | `src/pages/index.astro` | `0.7s` | 각 조각 애니메이션 시간 |
| `maxDelay` | `src/pages/index.astro` | `900` | 마지막 육각형 등장 딜레이(ms) |
| `textDelay` | `src/pages/index.astro` | `1200` | 텍스트 등장 딜레이(ms) |
| `startDelay` | `src/pages/index.astro` | `300` | 전체 시작 대기(ms) |
| `--color-bg` | `src/styles/global.css` | `#FFFFFF` | 페이지 배경색 |

## 제약 사항

- 다크모드가 완전히 제거되어 OS 다크모드 설정과 무관하게 항상 라이트 테마로 표시된다
- 로고 애니메이션은 9개 PNG 이미지에 의존하므로 `public/images/logo/` 디렉토리가 필수
- 로고 이미지 배경이 흰색이므로 페이지 배경도 흰색으로 고정해야 경계가 보이지 않음

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-17 | 최초 작성 — 메인 페이지 리디자인 및 다크모드 제거 |
