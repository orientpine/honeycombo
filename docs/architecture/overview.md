# HoneyCombo 아키텍처 개요

> 저비용 기술 뉴스 큐레이션 사이트. Astro SSG로 정적 빌드하고 Cloudflare Pages에 배포한다.

## 시스템 구성도

┌─────────────────────────────────────────────────────┐
│  GitHub Actions (자동화)                             │
│  ┌──────────┐ ┌──────────────────────┐              │
│  │RSS 수집   │ │제출 처리              │              │
│  │(scheduled)│ │(issue → PR)          │              │
│  └─────┬────┘ └──────────┬───────────┘              │
│        │                 │                          │
│        ▼                 ▼                          │
│  src/data/feeds/    src/content/                    │
└────────────────────────┬────────────────────────────┘
                         │ git push (master)
                         ▼
┌─────────────────────────────────────────────────────┐
│  Astro SSG 빌드                                      │
│  src/ → dist/ (정적 HTML)                            │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│  Cloudflare Pages                                    │
│  정적 파일 서빙 + functions/ (SSR & API)             │
│  (D1 데이터베이스 연동)                               │
└─────────────────────────────────────────────────────┘
```
## 디렉토리 구조

### `src/` — 소스 코드

| 디렉토리 | 역할 | 설명 |
|----------|------|------|
| `pages/` | 라우팅 | Astro 페이지. URL 구조와 1:1 대응 |
| `components/` | UI 컴포넌트 | `.astro` 컴포넌트 (ArticleCard, Navigation 등) |
| `layouts/` | 레이아웃 | 페이지 공통 레이아웃 |
| `content/` | 콘텐츠 컬렉션 | Astro Content Collections. `curated/` 큐레이션 기사 |
| `data/` | 데이터 파일 | JSON 기반 데이터 (feeds, trending, influencers) |
| `schemas/` | 스키마 정의 | TypeScript 타입/유효성 검사 (curated-article, feed-article 등) |
| `config/` | 설정 파일 | feeds.json, spam-keywords.json, editors.json, ranking-overrides.json |
| `lib/` | 유틸리티 | 공유 로직 (article-sort 등) |
| `styles/` | 스타일 | CSS |

### `scripts/` — 자동화 스크립트

| 파일 | 역할 | 실행 주체 |
|------|------|----------|
| `rss-collect.ts` | RSS 피드 수집 → `src/data/feeds/` | GitHub Actions (scheduled) |
| `calc-must-read.ts` | ~~필독 기사 선정~~ (삭제됨 — D1 에디터 관리로 전환) | — |
| `process-submission.ts` | 단건/대량 기사 제출 Issue → PR 변환 | GitHub Actions (on issue) |
| `validate.ts` | 콘텐츠 유효성 검사 | CI, 로컬 |
| `validate-docs.ts` | 문서 형식·커버리지 검증 | CI, 로컬 |
| `submit-cli.ts` | `gh` CLI 래퍼 (단건/대량 제출) | 사용자/AI 에이전트 (로컬) |

### `functions/` — Cloudflare Functions

| 파일 | 역할 |
|------|------|
| `api/auth.ts` | GitHub OAuth (Decap CMS 인증) |
| `api/auth/github/login.ts` | 사용자 GitHub OAuth 로그인 (return_to 쿠키 지원) |
| `api/auth/github/callback.ts` | OAuth 콜백, 세션 생성, auto-playlist catch-up 후 원래 페이지로 리디렉션 |
| `api/auth/me.ts` | 현재 로그인 사용자 정보 |
| `api/auth/logout.ts` | 로그아웃 |
| `api/playlists/index.ts` | GET(목록)/POST(생성), contains_item 포함 여부 지원 |
| `api/playlists/[id]/index.ts` | GET/PUT/DELETE (개별 플레이리스트 CRUD) |
| `api/playlists/[id]/items/index.ts` | POST (기사 추가, 중복 시 409) |
| `api/playlists/[id]/items/[itemId].ts` | PUT/DELETE (기사 수정/삭제) |
| `api/playlists/[id]/visibility.ts` | PUT (공개 범위 변경) |
`api/admin/playlists/[id]/reject.ts` | PUT (관리자: 반려) |
`api/playlists/[id]/like.ts` | GET/POST 좋아요 API |
`api/discussions/index.ts` | GET(목록)/POST(작성) Discussions API |
`api/discussions/[number].ts` | GET 단건 Discussion API |
`lib/github-graphql.ts` | GitHub GraphQL API 클라이언트 (queryDiscussions, getDiscussion, createDiscussion) |
`api/trending.ts` | GET 트렌딩 API (JSON) |
`trending.ts` | 트렌딩 페이지 SSR 렌더링 |
| `must-read.ts` | Must-read 페이지 SSR 렌더링 (D1 에디터 관리) |
| `api/admin/must-read/index.ts` | GET/POST Must-read 관리 API |
| `api/admin/must-read/[id].ts` | DELETE Must-read 항목 삭제 |
| `api/admin/must-read/reorder.ts` | PUT Must-read 순서 변경 |
| `lib/must-read.ts` | Must-read D1 CRUD 연산 |
| `p/[id].ts` | 유저 플레이리스트 SSR (아이템 관리, 기사 검색, 외부 URL 추가) |
| `lib/auth.ts` | 세션 관리 (upsertUser, createSession, getSession) |
| `lib/playlists.ts` | 플레이리스트 CRUD, 자동 플레이리스트 생성/조회, 포함 여부 확인 |
| `lib/playlist-items.ts` | 아이템 추가/수정/삭제, 중복 방지 (DuplicateItemError) |
| `lib/types.ts` | TypeScript 타입 정의 |
| `lib/validate.ts` | URL/제목/source_id 검증 |
| `webhooks/submission-approved.ts` | 기사 승인 시 플레이리스트 자동 추가 webhook |
| `webhooks/submission-removed.ts` | 기사 삭제/거부 시 플레이리스트 자동 정리 webhook |
| `lib/webhooks.ts` | Webhook shared secret 검증 유틸리티 |

### `.github/workflows/` — CI/CD

| 워크플로우 | 역할 |
|-----------|------|
| `ci.yml` | CI (validate, validate:docs, build, test) + master push 시 Cloudflare Pages 자동 배포 |
| `content-update-base.yml` | 콘텐츠 업데이트 공통 베이스 |
| `rss-collect.yml` | RSS 수집 스케줄 |
| ~~`trending-calc.yml`~~ | 삭제됨 — Must-read가 D1 에디터 관리로 전환 |
| `process-submission.yml` | 기사 제출 처리 + 외부 사용자 자동 라벨링 |
| `on-article-approved.yml` | PR merge 시 신규 파일 추가(diff-filter=A) 감지 → webhook 호출 |

## 페이지 구조

| URL | 페이지 | 설명 |
|-----|--------|------|
| `/` | `index.astro` | 메인 (히어로 + 소개 + 최근 기사 6 + 트렌딩 플레이리스트 3 + 추천 인플루언서 4) |
| `/articles` | `articles/index.astro` | 기사 목록 (SourceFilter: 전체/에디터추천/제출기사/RSS) |
| `/articles/[slug]` | `articles/[...slug].astro` | 개별 기사 (curated만) |
| `/trending` | `trending.astro` | 트렌딩 플레이리스트 (Astro SSG shell + client fetch, 좋아요 수 순위) |
| `/must-read` | `must-read.astro` | 필독 기사 (Astro SSG shell + client fetch, D1 에디터 관리) |
| `/influencers` | `influencers.astro` | 추천 인플루언서 (X/Threads 섹션 분리) |
| `/playlists` | `playlists/index.astro` | 에디터+커뮤니티 플레이리스트 목록 (D1 API 기반) |
| `/community` | `community.astro` + `functions/api/discussions/*` | 커뮤니티 자유 발제 (SSG shell + client fetch, GitHub Discussions 기반) |
| `/p/new` | `p/new.astro` | 유저 플레이리스트 생성 폼 |
| `/p/{id}` | `functions/p/[id].ts` | 유저 플레이리스트 상세 (SSR, 기사 검색/관리) |
| `/my/playlists` | `my/playlists.astro` | 내 플레이리스트 관리 |
| `/admin/playlists` | `admin/playlists.astro` | 관리자 플레이리스트 승인 페이지 |
| `/admin/must-read` | `admin/must-read.astro` | 관리자 Must-read 선정 페이지 |
| `/search-index.json` | `search-index.json.ts` | 플레이리스트 상세 기사 검색용 정적 JSON 인덱스 |
| `/submit` | `submit.astro` | 기사 제출 |
| `/admin` | `admin.astro` | Decap CMS 관리자 |
| `/rss.xml` | `rss.xml.ts` | RSS 피드 |

## 데이터 흐름

### 1. RSS 수집

```
외부 RSS 피드 → scripts/rss-collect.ts → src/data/feeds/*.json
```

- `src/config/feeds.json`에 등록된 피드 목록 기준
- `src/config/spam-keywords.json`으로 스팸 필터링
- `src/config/ai-keywords.json`으로 AI 관련 기사만 허용 (키워드 allowlist)
- 중복 URL 자동 제거

### 2. 트렌딩 플레이리스트 (Astro SSG + client fetch)

```
방문자 → /trending (Astro 정적 HTML) → 브라우저 fetch /api/trending → D1 (좋아요 순 쿼리)
```

- Astro `BaseLayout` + View Transitions를 사용하면서 공개 승인된 플레이리스트를 좋아요 수 기준으로 실시간 정렬하여 제공한다.

### 3. 기사 제출

```
GitHub Issue (single/bulk) → scripts/process-submission.ts → PR (src/content/curated/)
  ├─ 에디터 제출 → PR 자동 merge → 즉시 게시
  └─ 유저 제출 → PR 수동 merge = 승인 → 게시
```

- 제출 시 GitHub Issue 작성자의 numeric user id(`submitted_by_id`)도 함께 저장해 승인 webhook에서 D1 사용자와 매칭한다.
### 4. 기사 승인 시 플레이리스트 자동 추가

PR merge (새 파일 감지) → git push master → on-article-approved.yml → POST /webhooks/submission-approved → D1 (플레이리스트 자동 추가)

미로그인 제출자 → submissions 적재 → `/api/auth/github/callback` 로그인 시 catch-up → 자동 플레이리스트 반영


### 5. 빌드

```
src/ (pages + components + data + content) → astro build → dist/
```

## 기술 스택 상세

| 역할 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Astro 6 (SSG) | `output: 'static'` |
| 런타임 | Bun | 패키지 매니저 + 스크립트 실행 |
| 호스팅 | Cloudflare Pages | 무료, 무제한 bandwidth |
| 서버리스 | Cloudflare Functions | OAuth, 플레이리스트 API, SSR |
| 데이터베이스 | Cloudflare D1 (SQLite) | 사용자, 세션, 플레이리스트, 아이템 |
| CMS | Decap CMS | git-native |
| 댓글 | Giscus | GitHub Discussions 기반 |
| CI/CD | GitHub Actions + wrangler CLI | 수집, 계산, CI, 배포 자동화 |
| 테스트 | Vitest | 단위 테스트 |
| 타입 체크 | TypeScript 6 | strict |

---

## 관련 문서

- [초기 기술 스택 결정](../decisions/0001-initial-tech-stack.md)
- [문서 유효성 검증](../features/doc-validation.md)
- [대량 제출 (bulk submission)](../features/bulk-submission.md)
- [제출 CLI 래퍼](../features/submit-cli.md)
- [기사 소스 필터](../features/source-filter.md)
- [Decap CMS 로그인 Not Found](../troubleshooting/decap-cms-login-not-found.md)
- [AI 에이전트 제출 가이드](../guides/agent-submission.md)
- [추천 인플루언서](../features/influencers.md)
- [플레이리스트](../features/playlists.md)
- [AI 피드 필터](../features/ai-feed-filter.md)
- [트렌딩 플레이리스트](../features/trending-playlists.md)
- [Must-read 에디터 관리](../features/must-read-management.md)
- [기사 승인 시 플레이리스트 자동 추가](../features/auto-playlist-add.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-11 | 최초 작성 — 현재 프로젝트 구조 기반 |
| 2026-04-12 | validate-docs 스크립트 추가, CI 파이프라인 반영 |
| 2026-04-12 | 단건 제출 워크플로우에 bulk submission 처리 추가 |
| 2026-04-12 | SourceFilter 4탭 구조, Decap CMS auth 수정 반영 |
| 2026-04-12 | `/search-index.json` 정적 검색 인덱스 엔드포인트 추가 |
| 2026-04-13 | Cloudflare Functions 전체 목록 반영, D1 데이터베이스 추가, 플레이리스트 기능 아키텍처 문서화 |
| 2026-04-13 | 페이지 구조에 플레이리스트 하위 페이지(new, my, admin) 추가, 인플루언서 설명 갱신, 관련 문서 링크 보강 |
| 2026-04-13 | RSS 수집에 AI 키워드 필터 추가 (`ai-keywords.json` allowlist) |
| 2026-04-13 | 에디터 플레이리스트 정적 시스템 제거, D1 통합 반영 |
| 2026-04-13 | 키워드 트렌딩 → 플레이리스트 트렌딩(SSR) 전환, 좋아요 시스템 추가 |
| 2026-04-13 | 기사 승인 시 플레이리스트 자동 추가 기능, webhook 엔드포인트, on-article-approved 워크플로우 추가 |
| 2026-04-13 | GitHub OAuth 로그인 시 submissions catch-up 동기화 흐름 반영 |
| 2026-04-13 | Must-read: 자동 계산 → 에디터 수동 관리 전환. D1/SSR 기반, 관리자 UI 추가, 레거시 파일 삭제 |
| 2026-04-13 | `/trending`, `/must-read`를 Astro SSG shell + client fetch 구조로 전환해 View Transitions 깜빡임 제거 |
| 2026-04-13 | merge=approval 전환, 에디터 자동 merge, editors.json 추가 |
| 2026-04-14 | 커뮤니티 자유 발제 기능 추가 (GitHub Discussions 기반, /community 페이지, api/discussions/* API) |
| 2026-04-16 | CI 파이프라인에 wrangler 직접 배포 추가 (Cloudflare GitHub App 이벤트 누락 근본 해결) |
| 2026-04-17 | 메인 페이지 콘텐츠 허브화 — 소개 섹션·최근 기사·트렌딩·추천 인플루언서 추가, `color-scheme: light` 메타/CSS로 라이트 모드 고정 |
