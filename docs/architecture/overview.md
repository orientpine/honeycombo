# HoneyCombo 아키텍처 개요

> 저비용 기술 뉴스 큐레이션 사이트. Astro SSG로 정적 빌드하고 Cloudflare Pages에 배포한다.

## 시스템 구성도

```
┌─────────────────────────────────────────────────────┐
│  GitHub Actions (자동화)                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │RSS 수집   │ │트렌드 계산│ │제출 처리              │ │
│  │(scheduled)│ │(scheduled)│ │(issue → PR)          │ │
│  └─────┬────┘ └─────┬────┘ └──────────┬───────────┘ │
│        │            │                 │              │
│        ▼            ▼                 ▼              │
│  src/data/feeds/  src/data/trending/  src/content/   │
│                   src/data/must-read/  curated/      │
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
│  정적 파일 서빙 + functions/api/ (서버리스)           │
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
| `data/` | 데이터 파일 | JSON 기반 데이터 (feeds, trending, must-read, influencers) |
| `schemas/` | 스키마 정의 | TypeScript 타입/유효성 검사 (curated-article, feed-article 등) |
| `config/` | 설정 파일 | feeds.json, spam-keywords.json, ranking-overrides.json |
| `lib/` | 유틸리티 | 공유 로직 (article-sort 등) |
| `styles/` | 스타일 | CSS |

### `scripts/` — 자동화 스크립트

| 파일 | 역할 | 실행 주체 |
|------|------|----------|
| `rss-collect.ts` | RSS 피드 수집 → `src/data/feeds/` | GitHub Actions (scheduled) |
| `calc-trending.ts` | 트렌딩 점수 계산 → `src/data/trending/` | GitHub Actions (scheduled) |
| `calc-must-read.ts` | 필독 기사 선정 → `src/data/must-read/` | GitHub Actions (scheduled) |
| `process-submission.ts` | 단건/대량 기사 제출 Issue → PR 변환 | GitHub Actions (on issue) |
| `validate.ts` | 콘텐츠 유효성 검사 | CI, 로컬 |
| `validate-docs.ts` | 문서 형식·커버리지 검증 | CI, 로컬 |
| `submit-cli.ts` | `gh` CLI 래퍼 (단건/대량 제출) | 사용자/AI 에이전트 (로컬) |

### `functions/` — Cloudflare Functions

| 파일 | 역할 |
|------|------|
| `api/auth.ts` | GitHub OAuth (Decap CMS 인증) |
| `api/auth/github/login.ts` | 사용자 GitHub OAuth 로그인 (return_to 쿠키 지원) |
| `api/auth/github/callback.ts` | OAuth 콜백, 세션 생성, 원래 페이지로 리디렉션 |
| `api/auth/me.ts` | 현재 로그인 사용자 정보 |
| `api/auth/logout.ts` | 로그아웃 |
| `api/playlists/index.ts` | GET(목록)/POST(생성), contains_item 포함 여부 지원 |
| `api/playlists/[id]/index.ts` | GET/PUT/DELETE (개별 플레이리스트 CRUD) |
| `api/playlists/[id]/items/index.ts` | POST (기사 추가, 중복 시 409) |
| `api/playlists/[id]/items/[itemId].ts` | PUT/DELETE (기사 수정/삭제) |
| `api/playlists/[id]/visibility.ts` | PUT (공개 범위 변경) |
| `api/admin/playlists/pending.ts` | GET (관리자: 승인 대기 목록) |
| `api/admin/playlists/[id]/approve.ts` | PUT (관리자: 승인) |
| `api/admin/playlists/[id]/reject.ts` | PUT (관리자: 반려) |
| `p/[id].ts` | 유저 플레이리스트 SSR (아이템 관리, 기사 검색, 외부 URL 추가) |
| `lib/auth.ts` | 세션 관리 (upsertUser, createSession, getSession) |
| `lib/playlists.ts` | 플레이리스트 CRUD, 목록 조회, 포함 여부 확인 |
| `lib/playlist-items.ts` | 아이템 추가/수정/삭제, 중복 방지 (DuplicateItemError) |
| `lib/types.ts` | TypeScript 타입 정의 |
| `lib/validate.ts` | URL/제목/source_id 검증 |

### `.github/workflows/` — CI/CD

| 워크플로우 | 역할 |
|-----------|------|
| `ci.yml` | CI (validate, validate:docs, build, test) |
| `content-update-base.yml` | 콘텐츠 업데이트 공통 베이스 |
| `rss-collect.yml` | RSS 수집 스케줄 |
| `trending-calc.yml` | 트렌딩 계산 스케줄 |
| `process-submission.yml` | 기사 제출 처리 + 외부 사용자 자동 라벨링 |

## 페이지 구조

| URL | 페이지 | 설명 |
|-----|--------|------|
| `/` | `index.astro` | 메인 (최신 기사) |
| `/articles` | `articles/index.astro` | 기사 목록 (SourceFilter: 전체/에디터추천/제출기사/RSS) |
| `/articles/[slug]` | `articles/[...slug].astro` | 개별 기사 (curated만) |
| `/trending` | `trending.astro` | 트렌딩 기사 |
| `/must-read` | `must-read.astro` | 필독 기사 |
| `/influencers` | `influencers.astro` | 추천 인플루언서 (X/Threads 섹션 분리) |
| `/playlists` | `playlists/index.astro` | 에디터+커뮤니티 플레이리스트 목록 (D1 API 기반) |
| `/p/new` | `p/new.astro` | 유저 플레이리스트 생성 폼 |
| `/p/{id}` | `functions/p/[id].ts` | 유저 플레이리스트 상세 (SSR, 기사 검색/관리) |
| `/my/playlists` | `my/playlists.astro` | 내 플레이리스트 관리 |
| `/admin/playlists` | `admin/playlists.astro` | 관리자 플레이리스트 승인 페이지 |
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

### 2. 트렌딩 계산

```
src/data/feeds/ → scripts/calc-trending.ts → src/data/trending/
```

- `src/config/ranking-overrides.json`으로 가중치 조정 가능

### 3. 기사 제출

```
GitHub Issue (single/bulk) → scripts/process-submission.ts → PR (src/content/curated/)
```

### 4. 빌드

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
| CI/CD | GitHub Actions | 수집, 계산, 배포 자동화 |
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
