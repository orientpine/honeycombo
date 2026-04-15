# 커뮤니티 자유 발제

> GitHub Discussions를 백엔드로 사용하는 커뮤니티 MVP. 사이트 안에서 토론 글을 작성하고 Giscus 댓글로 의견을 나눈다.

## 개요

이 기능은 GitHub Discussions를 활용해 `/community`에서 자유 발제형 토론을 운영한다. 사용자는 사이트 내에서 글을 작성하고 상세 페이지에서 Giscus 댓글로 의견을 주고받을 수 있으며, 1개월 수요 검증을 위한 MVP로 설계했다.

## 동작 흐름

```
사용자 → /community (Astro SSG shell)
  → astro:page-load → community-page.js 초기화
  → GET /api/discussions → Cloudflare Function → GitHub GraphQL API
  → 토론 목록 렌더링

글 작성:
  로그인 사용자 → 제목+본문 입력 → POST /api/discussions
  → Cloudflare Function → createDiscussion mutation (Bot Token)
  → GitHub Discussions에 글 생성 (본문에 @username 표기)
  → 상세 뷰로 이동

상세 뷰:
  토론 클릭 → GET /api/discussions/[number]
  → 본문(bodyHTML) 렌더링 + Giscus 댓글 임베드 (data-mapping="number")
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/pages/community.astro` | 정적 셸 페이지 |
| `public/scripts/community-page.js` | 클라이언트 로직 (목록, 작성, 상세) |
| `src/components/CommunityComments.astro` | Giscus number mapping 컴포넌트 |
| `functions/api/discussions/index.ts` | GET(목록)/POST(작성) API |
| `functions/api/discussions/[number].ts` | GET(단건) API |
| `functions/lib/github-graphql.ts` | GitHub GraphQL 클라이언트 |
| `functions/lib/types.ts` | DiscussionSummary, Discussion, PageInfo 타입 + Env.GITHUB_BOT_TOKEN |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `GITHUB_BOT_TOKEN` | Cloudflare Pages 환경변수 | — | GitHub PAT. `public_repo` + `write:discussion` 스코프 필요 |
| `DISCUSSIONS_CATEGORY_ID` | Cloudflare Pages 환경변수 | — | "자유 발제" 카테고리 ID (`DIC_kwDO...` 형식) |
| `COMMUNITY_CATEGORY_ID` | `src/components/CommunityComments.astro` | placeholder | 카테고리 생성 후 업데이트해야 하는 Giscus mapping 상수 |

## 제약 사항

- GitHub 로그인 필수 (익명 작성 불가)
- 글 작성 1분 쿨다운 (in-memory rate limit, worker 재시작 시 초기화)
- 텍스트 전용 (이미지 업로드 없음, 마크다운 링크만 가능)
- 글 수정/삭제는 GitHub Discussions 웹에서 직접 처리
- 실시간 업데이트 없음 (수동 새로고침 필요)
- Giscus 댓글은 "자유 발제" 카테고리 생성 및 `DISCUSSIONS_CATEGORY_ID` 설정 후 활성화
- Workers Free 100K req/일 quota를 기존 동적 기능과 공유

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [초기 기술 스택 결정](../decisions/0001-initial-tech-stack.md)
- [플레이리스트](./playlists.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-14 | 최초 작성 — GitHub Discussions 기반 커뮤니티 MVP |
| 2026-04-15 | 네비게이션 항목 이름 '커뮤니티' → 'Community' 영문 변경, 발제하기 버튼 모던 UI 스타일 적용 |
