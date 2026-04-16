# 0004: 전 페이지 제목 구조 표준화 (2단 구성)

> 상태: **승인**

## 맥락

사이트 내 페이지별 제목 구조가 일관되지 않았다.

- **패턴 A** (trending, community, must-read): `page-eyebrow` + `page-title` (h1) + `page-description` — 3단 구성
- **패턴 B** (articles, playlists, influencers 등): 일반 `h1` + `page-subtitle` — 2단 구성, 작은 폰트
- 각 페이지가 인라인 `<style>`에 동일한 `.page-header`, `.page-subtitle` 스타일을 중복 정의

이로 인해 페이지 간 시각적 통일감이 부족하고, 스타일 변경 시 모든 파일을 개별 수정해야 하는 유지보수 문제가 있었다.

## 결정

1. **2단 구성으로 통일**: 모든 섹션 페이지(home, 콘텐츠 상세 페이지 제외)의 제목을 `h1.page-title` + `p.page-description` 2단 구조로 표준화
2. **page-eyebrow 제거**: trending, community, must-read에서 작은 글씨 부제목(eyebrow) 삭제
3. **공통 스타일을 global.css로 통합**: `.page-shell`, `.page-header`, `.page-title`, `.page-description` 스타일을 `src/styles/global.css`에 정의하고, 각 페이지의 중복 인라인 스타일 제거
4. **반응형 폰트**: `clamp(2rem, 4vw, 2.75rem)`로 모든 페이지의 제목 크기 통일
5. **max-width: 720px**: 모든 `.page-header`에 적용하여 제목 영역의 가독성 확보 (flex-between 레이아웃은 예외)

## 고려한 대안

### 대안 1: page-eyebrow를 모든 페이지에 추가 (3단 구성)

- 장점: 카테고리 라벨로 사용 가능
- 단점: 정보 중복 (eyebrow와 h1이 같은 텍스트), 시각적 노이즈 증가
- 탈락 사유: 유저가 eyebrow 제거를 명시적으로 요청

### 대안 2: 공유 컴포넌트(PageHeader.astro) 생성

- 장점: HTML 구조도 중앙 관리 가능
- 단점: props 인터페이스 설계 필요, submit의 notice-box 등 특수 케이스 처리 복잡
- 탈락 사유: CSS 클래스 통일만으로 충분하며, 과도한 추상화 방지

## 결과

- **시각적 통일**: 모든 섹션 페이지가 동일한 2단 제목 구조 사용
- **코드 간소화**: 13개 파일에서 총 130줄의 중복 인라인 스타일 제거, 64줄의 공통 스타일 추가 (순 66줄 감소)
- **유지보수 개선**: 제목 스타일 변경 시 global.css 한 곳만 수정하면 됨
- **적용 범위**: 섹션/목록 페이지에 적용. 콘텐츠 상세 페이지(`articles/[...slug].astro`)는 개별 기사 제목과 메타데이터를 표시하는 별도 구조(`article-detail-title` + `ArticleMeta`)를 유지
- **이모지 규칙**: 모든 섹션 페이지의 `h1.page-title`에 이모지 접두사를 적용하여 시각적 식별성 강화. BaseLayout title(브라우저 탭/SEO)에는 이모지를 넣지 않음

## 관련 파일

- `src/styles/global.css` — 공통 page-header 스타일 정의
- `src/pages/trending.astro` — eyebrow 제거, 인라인 스타일 정리
- `src/pages/community.astro` — eyebrow 제거
- `src/pages/must-read.astro` — eyebrow 제거, 인라인 스타일 정리
- `src/pages/articles/index.astro` — 구조 통일
- `src/pages/articles/page/[...page].astro` — 구조 통일
- `src/pages/playlists/index.astro` — 구조 통일
- `src/pages/influencers.astro` — 구조 통일
- `src/pages/submit.astro` — 구조 통일
- `src/pages/my/playlists.astro` — 구조 통일 (flex-between 유지)
- `src/pages/p/new.astro` — 구조 통일
- `src/pages/admin/must-read.astro` — 구조 통일
- `src/pages/admin/playlists.astro` — 구조 통일
- `functions/trending.ts` — SSR 폴백의 eyebrow 제거
- `functions/must-read.ts` — SSR 폴백의 eyebrow 제거

---

## 관련 문서

- [트렌딩 플레이리스트](../features/trending-playlists.md)
- [Must-read 관리](../features/must-read-management.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-16 | 최초 작성 |
| 2026-04-16 | 이모지 규칙 추가: Articles(📰), Community(💬), Must-read(📌) 이모지 통일 |
| 2026-04-16 | 이모지 누락 보완: articles 페이지네이션, must-read SSR fallback 통일 |
| 2026-04-16 | Must-read 페이지 제목 한국어화: `📌 Must-read` → `📌 꼭 읽어야 할 기사` (메뉴는 영문 유지) |
| 2026-04-16 | Must-read 문서 제목(브라우저 탭) 한국어화: `Must-read — HoneyCombo` → `꼭 읽어야 할 기사 — HoneyCombo` |
