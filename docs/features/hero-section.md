# 히어로 섹션

> 메인 페이지 상단의 브랜드 일러스트 + CTA 영역. 라이트/다크 테마별 이미지 분기와 반응형 WebP 최적화를 포함한다.

## 개요

메인 페이지(`/`)에 진입하면 가장 먼저 보이는 히어로 섹션으로, HoneyCombo의 브랜드 일러스트 이미지와 부제, CTA 버튼으로 구성된다. 이미지 자체에 로고 텍스트("HONEY COMBO")와 부제("연구자를 위한 AI 기술 커뮤니티")가 포함되어 있으므로, HTML에서는 시맨틱 `<h1>` 태그로 부제만 간결하게 표시한다.

## 동작 흐름

```
사용자 접속 → BaseLayout에서 테마별 이미지 preload
→ <picture> 태그가 prefers-color-scheme에 따라 라이트/다크 이미지 선택
→ srcset으로 디바이스 너비에 맞는 해상도(400w/800w/1200w) 자동 선택
→ WebP 미지원 브라우저는 JPG fallback
```

### 이미지 에셋 구성

| 파일 | 용도 | 크기 |
|------|------|------|
| `public/main_image_white_bg.webp` | 라이트 테마 1200w | ~49KB |
| `public/main_image_white_bg-800.webp` | 라이트 테마 800w | ~30KB |
| `public/main_image_white_bg-400.webp` | 라이트 테마 400w | ~12KB |
| `public/main_image_black_bg.webp` | 다크 테마 1200w | ~52KB |
| `public/main_image_black_bg-800.webp` | 다크 테마 800w | ~31KB |
| `public/main_image_black_bg-400.webp` | 다크 테마 400w | ~12KB |
| `public/main_image_white_bg.jpg` | 라이트 JPG fallback | ~640KB |
| `public/main_image_black_bg.jpg` | 다크 JPG fallback | ~5MB |

### 성능 최적화

- `<link rel="preload">`: `media` 속성으로 현재 테마 이미지만 preload
- `<img fetchpriority="high" loading="eager" decoding="async">`: LCP 최적화
- `width`/`height` 속성: CLS 방지
- WebP: JPG 대비 90%+ 용량 절감 (다크 이미지: 5MB → 52KB)

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/pages/index.astro` | 히어로 HTML 구조 + scoped CSS |
| `src/layouts/BaseLayout.astro` | `<head>`에 preload 링크 삽입 |
| `src/styles/global.css` | 디자인 토큰 (색상, 간격, 그림자 등) |
| `public/main_image_*.webp` | 반응형 WebP 이미지 에셋 |
| `public/main_image_*.jpg` | JPG fallback 이미지 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `max-width` | `index.astro` (.hero-image-wrapper) | `900px` | 이미지 최대 너비 |
| `max-height` | `index.astro` (.hero-logo) | `380px` | 이미지 최대 높이 |
| `border-radius` | `index.astro` (.hero-logo) | `16px` | 이미지 모서리 둥글기 |
| 모바일 패딩 | `index.astro` (@media max-width:600px) | `var(--space-lg)` | 소형 모바일에서 히어로 패딩 축소 |

## 제약 사항

- 이미지에 로고 텍스트가 포함되어 있어 다국어 확장 시 이미지 자체를 교체해야 함
- 장기적으로 텍스트 없는 순수 일러스트 이미지로 전환 권장 (Option D)
- 다크 테마 JPG fallback이 5MB로 큼 — WebP 미지원 환경에서 느릴 수 있음

---

## 관련 문서

- [전체 아키텍처](../architecture/overview.md)
- [페이지 타이틀 표준화](../decisions/0004-page-title-standardization.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-16 | 최초 작성 — Option A 히어로 리디자인 적용 (이미지 확대, 텍스트 정리, WebP 최적화, preload) |
