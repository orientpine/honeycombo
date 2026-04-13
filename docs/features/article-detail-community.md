# 기사 상세페이지 커뮤니티 기능

> 기사 상세페이지에 공유, 북마크, 개선된 관련 기사, 댓글 수 표시 등 커뮤니티 참여 기능 추가

## 개요

커뮤니티 성격 프로젝트에 어울리는 상호작용 기능을 기사 상세페이지와 목록 카드에 추가했다.

## 기능 목록

### 1. 공유 버튼 (ShareButtons)

- **X(Twitter) 공유**: `twitter.com/intent/tweet` URL 기반, API 불필요
- **링크 복사**: `navigator.clipboard` API, 복사 완료 시 "복사됨!" 피드백
- **Web Share API**: 모바일에서만 표시, 카카오톡/라인 등 네이티브 공유 지원
- 위치: 상세페이지 액션 바 (헤더 아래)

### 2. 북마크 (BookmarkButton)

- **localStorage 기반**: `honeycombo:bookmarks` 키에 기사 ID 배열 저장
- **하트 아이콘 토글**: outline ↔ filled, 핑크 컬러 (#e74c6f)
- **동기화**: 같은 페이지 내 동일 기사의 북마크 버튼 자동 동기화
- 상세페이지: `size="md"` (액션 바), 목록 카드: `size="sm"` (아이콘만)

### 3. 관련 기사 개선 (RelatedArticles)

- **Before**: curated만 대상, 태그 1개 매칭, 정렬 없음
- **After**: curated + feeds 모두 대상, 매칭 태그 수 기반 스코어링, score desc → date desc 정렬
- 최대 3개 표시, 날짜 표시 추가

### 4. 댓글 수 표시

- 기사 카드에 💬 아이콘 + 댓글 수 표시
- **Giscus API** 기반 클라이언트 사이드 fetching
- **IntersectionObserver**: 뷰포트 진입 시에만 fetch (rootMargin: 200px)
- **sessionStorage 캐시**: 세션 내 중복 요청 방지
- 댓글 아이콘 클릭 시 상세페이지 `#comments` 앵커로 이동

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/components/ShareButtons.astro` | 공유 버튼 컴포넌트 |
| `src/components/BookmarkButton.astro` | 북마크 토글 컴포넌트 |
| `src/components/RelatedArticles.astro` | 관련 기사 (개선된 알고리즘) |
| `src/components/ArticleCard.astro` | 기사 카드 (북마크 + 댓글 수 통합) |
| `src/pages/articles/[...slug].astro` | 상세페이지 (액션 바 레이아웃) |
| `src/components/Comments.astro` | Giscus 댓글 (View Transitions 호환) |
| `public/_headers` | CSP 헤더 (giscus.app 허용) |

## 설계 결정

- **북마크를 localStorage로 구현**: 서버 비용 없이 즉시 동작. 크로스 디바이스는 기존 플레이리스트 기능으로 대체 가능.
- **댓글 수를 클라이언트에서 fetch**: SSG 빌드 시점에 GitHub API 토큰 불필요. IntersectionObserver + sessionStorage로 성능 최적화.
- **Giscus를 `astro:page-load`로 초기화**: View Transitions(ClientRouter) 호환. 기존 `is:inline` + 외부 스크립트 방식은 페이지 전환 시 재초기화 실패.

## 제약 사항

- 북마크는 디바이스별 저장 (localStorage). 로그인 연동 미구현.
- 댓글 수는 Giscus API 응답 속도에 의존 (보통 100~300ms).
- Giscus Discussion이 아직 생성되지 않은 기사는 댓글 수 0 표시.

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-14 | 최초 작성 |
