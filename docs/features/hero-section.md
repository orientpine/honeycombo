# 히어로 섹션 (CSS 애니메이션 로고)

> 메인 페이지 상단의 CSS 애니메이션 로고 + CTA 영역. 육각형 조각이 순차 등장하는 브랜드 로고 애니메이션.

## 개요

메인 페이지(`/`)에 진입하면 가장 먼저 보이는 히어로 섹션으로, HoneyCombo의 브랜드 로고가 CSS 애니메이션으로 표시된다. 8개의 육각형 그룹이 순차적으로 scale-in 되고, 마지막에 "HONEY COMBO" 텍스트가 slide-up으로 등장한다. 이미지 자체에 로고 텍스트가 포함되어 있으므로 별도 `<h1>` 헤딩은 없다.

CTA 버튼은 "기사 보기"(`/articles`)와 "트렌드 랭킹"(`/trending`) 2개만 제공한다.

다크모드는 제거되었으며, 페이지 배경색은 `#FFFFFF`(흰색)로 고정하여 로고 이미지 배경과 경계가 보이지 않도록 처리했다.

## 동작 흐름

```
페이지 로드 → astro:page-load 이벤트 발생
→ initHoneyComboLogo() 호출
→ 9개 PNG 이미지를 컨테이너에 절대 좌표로 배치
→ setTimeout으로 순차 딜레이 적용 (0~900ms: 육각형, 1200ms: 텍스트)
→ .show 클래스 추가 → CSS keyframe 애니메이션 실행
```

### 이미지 에셋 구성

| 파일 | 용도 |
|------|------|
| `public/images/logo/group_1.png` ~ `group_8.png` | 로고 육각형 조각 8개 |
| `public/images/logo/text_honey_combo.png` | "HONEY COMBO" 텍스트 |

### 애니메이션 상세

- **육각형 그룹** (group_1~8): `hcPieceIn` — `scale(0.8)→scale(1)` + `opacity 0→1`, `cubic-bezier(0.34, 1.56, 0.64, 1)` (약간 바운스)
- **텍스트**: `hcTextIn` — `translateY(20px)→translateY(0)` + `opacity 0→1`, `ease-out`
- Astro View Transitions 호환: `astro:page-load` 이벤트로 매 네비게이션마다 재생

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/pages/index.astro` | 히어로 HTML + CSS 애니메이션 + JS 초기화 로직 |
| `src/layouts/BaseLayout.astro` | `<head>`에 로고 이미지 preload |
| `src/styles/global.css` | 디자인 토큰 (배경색 #FFFFFF 등) |
| `public/images/logo/*.png` | 로고 애니메이션 이미지 에셋 (9개) |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `--hc-duration` | `index.astro` | `0.7s` | 각 조각 애니메이션 시간 |
| `maxDelay` | `index.astro` (JS) | `900` | 마지막 육각형 등장 딜레이(ms) |
| `textDelay` | `index.astro` (JS) | `1200` | 텍스트 등장 딜레이(ms) |
| `startDelay` | `index.astro` (JS) | `300` | 전체 시작 대기(ms) |
| `max-width` | `index.astro` (.honey-combo-logo) | `860px` | 로고 최대 너비 |

## 제약 사항

- 이미지에 로고 텍스트가 포함되어 있어 다국어 확장 시 이미지 자체를 교체해야 함
- 다크모드가 완전히 제거되어 항상 라이트 테마로 표시됨
- 로고 이미지 배경이 흰색이므로 `--color-bg`를 `#FFFFFF`에서 변경하면 경계가 보일 수 있음
- 9개 PNG 이미지에 의존하므로 `public/images/logo/` 디렉토리 필수

---

## 관련 문서

- [메인 페이지 리디자인](./main-page-redesign.md)
- [전체 아키텍처](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-16 | 최초 작성 — Option A 히어로 리디자인 적용 |
| 2026-04-17 | CSS 애니메이션 로고로 교체, 다크모드 제거, 배경색 흰색 통일 |
