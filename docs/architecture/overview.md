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
| `data/` | 데이터 파일 | JSON 기반 데이터 (feeds, trending, must-read, playlists, influencers) |
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
| `process-submission.ts` | 기사 제출 Issue → PR 변환 | GitHub Actions (on issue) |
| `validate.ts` | 콘텐츠 유효성 검사 | CI, 로컬 |

### `functions/` — Cloudflare Functions

| 파일 | 역할 |
|------|------|
| `api/auth.ts` | GitHub OAuth (Decap CMS 인증) |

### `.github/workflows/` — CI/CD

| 워크플로우 | 역할 |
|-----------|------|
| `ci.yml` | CI (validate, build, test) |
| `content-update-base.yml` | 콘텐츠 업데이트 공통 베이스 |
| `rss-collect.yml` | RSS 수집 스케줄 |
| `trending-calc.yml` | 트렌딩 계산 스케줄 |
| `process-submission.yml` | 기사 제출 처리 |

## 페이지 구조

| URL | 페이지 | 설명 |
|-----|--------|------|
| `/` | `index.astro` | 메인 (최신 기사) |
| `/articles/[slug]` | `articles/` | 개별 기사 |
| `/trending` | `trending.astro` | 트렌딩 기사 |
| `/must-read` | `must-read.astro` | 필독 기사 |
| `/influencers` | `influencers.astro` | 인플루언서 |
| `/playlists/[slug]` | `playlists/` | 플레이리스트 |
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
- 중복 URL 자동 제거

### 2. 트렌딩 계산

```
src/data/feeds/ → scripts/calc-trending.ts → src/data/trending/
```

- `src/config/ranking-overrides.json`으로 가중치 조정 가능

### 3. 기사 제출

```
GitHub Issue → scripts/process-submission.ts → PR (src/content/curated/)
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
| 서버리스 | Cloudflare Functions | OAuth용 |
| CMS | Decap CMS | git-native |
| 댓글 | Giscus | GitHub Discussions 기반 |
| CI/CD | GitHub Actions | 수집, 계산, 배포 자동화 |
| 테스트 | Vitest | 단위 테스트 |
| 타입 체크 | TypeScript 6 | strict |

---

## 관련 문서

- [초기 기술 스택 결정](../decisions/0001-initial-tech-stack.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-11 | 최초 작성 — 현재 프로젝트 구조 기반 |
