# HoneyCombo MVP — 저비용 큐레이션 사이트

## TL;DR

> **Quick Summary**: RSS 자동 수집 + 사용자 제출 + 에디터 큐레이션 기반의 기술 뉴스 큐레이션 사이트를 Git 기반 인프라($0/월)로 구축한다. Astro SSG + Cloudflare Pages + GitHub Actions + JSON flat-file 아키텍처.
>
> **Deliverables**:
> - Astro SSG 큐레이션 사이트 (Cloudflare Pages 배포)
> - RSS 자동 수집 파이프라인 (GitHub Actions cron)
> - 사용자 자료 제출 시스템 (GitHub Issues → 자동 처리)
> - 에디터 큐레이션 CMS (Decap CMS)
> - 주간 트렌드 랭킹 + Must-read 목록
> - 에디터 플레이리스트 (생성/열람/추천)
> - 인플루언서 의견 큐레이션 페이지
> - YouTube oEmbed 지원
> - Giscus 댓글 시스템
> - localStorage 기반 관심사 필터링
>
> **Estimated Effort**: Large (21 tasks, 5 waves + final verification)
> **Parallel Execution**: YES — 5 waves, 최대 5개 동시 실행
> **Critical Path**: T1 → T6 → T7 → T10 → T12 → T13 → T19 → T21

---

## Context

### Original Request
저비용 큐레이션 사이트를 먼저 만들자. 이를 위한 구체적이고 한번에 완성하는 완전한 계획을 세워.

### Interview Summary (이전 세션에서 확보)
**Key Discussions**:
- **제품 정의**: Phase 1은 "공개 큐레이션 사이트" (개인화는 Phase 2로 미룸)
- **기술 스택**: Astro SSG + Cloudflare Pages + GitHub Actions + JSON flat-file
- **X/Threads**: 핵심 경로에서 제외 → 사용자 직접 링크 제출 권장
- **타겟**: 개발자/기술 커뮤니티
- **비용**: 인프라 $0/월 (운영 노동 주 3~6시간 별도)

**Research Findings**:
- **Astro v5+**: `glob()`/`file()` loader로 JSON 컬렉션 네이티브 지원, Zod 스키마 내장
- **Cloudflare Pages 무료 제한**: 20,000 파일, 500 builds/월, 무제한 bandwidth
- **GitHub Actions cron**: 5~30분 지연 가능, 60일 비활성 시 자동 비활성화
- **Git 디렉토리 제한**: 3,000 entries/디렉토리 → YYYY/MM 샤딩 필수
- **Decap CMS**: JSON format 지원 (`format: json`), Astro 호환 확인
- **GitHub Actions 동시성**: `concurrency` 그룹으로 push 충돌 방지 가능
- **oEmbed**: YouTube 메타데이터 무인증/무제한 추출 가능

### Metis Review
**Identified Gaps** (all addressed in this plan):
- **CF Pages 20K 파일 제한**: 모든 컨텐츠를 `glob()` loader로 개별 JSON 파일 관리. RSS 기사는 상세 페이지 미생성(외부 링크) → 배포 파일 ~300개로 유지. 소스 JSON 파일 수는 Git 디렉토리 샤딩(YYYY/MM)으로 관리.
- **Git 동시성 충돌**: 모든 워크플로우에 `concurrency: { group: "content-update", cancel-in-progress: false }` 적용
- **디렉토리 샤딩**: `content/curated/YYYY/MM/` 구조 1일차부터 적용
- **이미지 전략**: 원본 소스 핫링크 (RSS의 thumbnail_url 또는 OG image). Git 저장소에 이미지 저장 금지.
- **플레이리스트 범위**: Phase 1은 에디터 생성 전용. 사용자 생성은 Phase 2.
- **콘텐츠 보존 정책**: RSS 수집 기사 6개월 활성, 이후 아카이브. 큐레이션 기사는 영구 보존.
- **스키마 검증**: Zod (Astro 빌드타임) + JSON Schema/ajv (GitHub Actions CI) 이중 검증
- **모더레이션**: 스키마 검증 + URL 중복 체크 + 키워드 스팸 필터 + 수동 승인 큐
- **랭킹 감사**: audit log + pin/suppress/boost 수동 오버라이드
- **RSS 피드 불안정성**: feedparser + bozo flag + 30초 타임아웃 + skip-and-log
- **콘텐츠 보존 정책**: RSS 6개월 활성, 큐레이션 영구 보존

---

## Work Objectives

### Core Objective
Git 기반 $0 인프라 위에 기술 뉴스 큐레이션 사이트를 구축한다. RSS 자동 수집, 사용자 제출, 에디터 큐레이션, 트렌드 랭킹, 플레이리스트를 포함한 완전한 MVP.

### Concrete Deliverables
- Astro SSG 사이트 (Cloudflare Pages 라이브 배포)
- 3개 GitHub Actions 워크플로우 (RSS 수집, 트렌드 계산, 제출 처리)
- Decap CMS 어드민 UI (`/admin`)
- 7개 페이지: 홈, 기사 목록, 기사 상세, 트렌드, Must-read, 플레이리스트, 인플루언서
- Giscus 댓글 (큐레이션 기사 상세 페이지)
- localStorage 관심사 필터링

### Definition of Done
- [ ] `bun run build` 성공 (에러 0)
- [ ] Cloudflare Pages 라이브 배포 완료 (`*.pages.dev` 접근 가능)
- [ ] RSS 수집 워크플로우 수동 실행 (`workflow_dispatch`) 성공
- [ ] GitHub Issues 제출 → JSON 파일 생성 → PR 자동 생성 확인
- [ ] 트렌드 랭킹 계산 워크플로우 수동 실행 성공
- [ ] 모든 페이지 Lighthouse Performance ≥ 90
- [ ] 모든 Vitest 테스트 통과

### Must Have
- RSS 자동 수집 (최소 10개 피드)
- 사용자 자료 제출 (GitHub Issues)
- 에디터 큐레이션 (Decap CMS)
- 주간 트렌드 랭킹
- Must-read 목록
- 에디터 플레이리스트 (생성/열람)
- YouTube oEmbed 지원
- 정규화된 JSON Schema 문서 양식
- 모더레이션 파이프라인 (자동 필터 + 수동 승인)
- Giscus 댓글
- localStorage 관심사 필터링

### Must NOT Have (Guardrails)
- ❌ 사용자 생성 플레이리스트 (Phase 2)
- ❌ X/Twitter 또는 Threads 자동 스크래핑
- ❌ ML/AI 기반 스팸 탐지
- ❌ 실시간 알림/웹소켓
- ❌ YouTube 외 임베드 (Vimeo, TikTok 등)
- ❌ Git 저장소 내 이미지 저장
- ❌ 추천 엔진/협업 필터링
- ❌ 사용자 히스토리 추적
- ❌ 결제/수익화 기능
- ❌ 모바일 네이티브 앱
- ❌ 다국어 지원
- ❌ abstract base class, factory pattern, plugin system
- ❌ 모든 함수에 JSDoc (public API만)
- ❌ loading spinners/skeletons (SSG이므로 불필요)
- ❌ exponential backoff (단순 1-retry 충분)
- ❌ 별도 utils/ 디렉토리 (기능별 co-locate)
- ❌ analytics/tracking (Cloudflare 내장 대시보드 외)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield)
- **Automated tests**: YES (Tests-after)
- **Framework**: Vitest
- **Strategy**: 구현 후 핵심 로직 단위 테스트 + Playwright 통합 QA

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Pages/UI**: Playwright — navigate, assert DOM selectors, screenshot
- **GitHub Actions**: `gh workflow run` + `gh run view` — 수동 실행 후 결과 확인
- **Build/Schema**: `bun run build`, `bun run validate` — exit code + output 확인
- **RSS Pipeline**: Mock XML fixture → 파이프라인 실행 → JSON 출력 검증

---

## Execution Strategy

### Content Architecture (Hybrid — Metis 권고 반영)

```
src/
├── content/
│   ├── config.ts                    # Astro content collection definitions
│   └── curated/                     # glob() loader — 개별 JSON, CMS 편집 가능
│       └── 2026/04/
│           └── my-article.json
├── data/
│   ├── feeds/                       # glob() loader — RSS 수집 개별 JSON
│   │   └── 2026/04/
│   │       └── rss-techcrunch-abc.json  # 기사별 개별 파일
│   ├── trending/
│   │   └── week-2026-15.json
│   ├── must-read/
│   │   └── 2026-04-10.json
│   ├── playlists/
│   │   └── ai-weekly.json
│   └── influencers/
│       └── karpathy.json
├── config/
│   ├── feeds.json                   # RSS 피드 소스 목록
│   ├── influencer-list.json         # 추적 인플루언서 목록
│   ├── spam-keywords.json           # 스팸 키워드 리스트
│   └── ranking-overrides.json       # 랭킹 수동 오버라이드
```

### Deployed File Budget (CF Pages 20K 제한 대응)

| 카테고리 | 예상 파일 수 | 비고 |
|---------|------------|------|
| 큐레이션 기사 상세 페이지 | ~100 | 수동 큐레이션만 상세 페이지 |
| 목록 페이지 (페이지네이션) | ~60 | 기사·트렌드·플레이리스트 |
| 정적 페이지 | ~10 | 홈, about, submit 등 |
| CSS/JS/assets | ~30 | Astro 번들 |
| admin | ~5 | Decap CMS |
| **합계** | **~205** | 20K 대비 **1%** 사용 |

### Parallel Execution Waves

```
Wave 1 (Foundation — 즉시 시작, 전부 병렬):
├── T1:  Astro 프로젝트 스캐폴딩 + 설정 [quick]
├── T2:  콘텐츠 스키마 정의 (Zod + JSON Schema) [quick]
├── T3:  베이스 레이아웃 + 글로벌 스타일 + 네비게이션 [visual-engineering]
├── T4:  GitHub Actions 인프라 (CI/CD + concurrency) [quick]
└── T5:  콘텐츠 검증 스크립트 (validate.ts) [quick]

Wave 2 (Core Content — Wave 1 완료 후, 전부 병렬):
├── T6:  RSS 수집 파이프라인 (GitHub Actions cron) [deep]
├── T7:  기사 목록 페이지 + 페이지네이션 + 태그 필터 [visual-engineering]
├── T8:  큐레이션 기사 상세 페이지 [visual-engineering]
└── T9:  Decap CMS 설정 + 어드민 페이지 [unspecified-high]

Wave 3 (Interaction & Ranking — Wave 2 완료 후, 전부 병렬):
├── T10: 사용자 제출 파이프라인 (Issues → Actions → JSON) [deep]
├── T11: 모더레이션 상태 관리 (pending/approved/rejected) [unspecified-high]
├── T12: 트렌드 랭킹 계산 워크플로우 [deep]
└── T13: 트렌드 페이지 + Must-read 페이지 [visual-engineering]

Wave 4 (Features — Wave 3 완료 후, 전부 병렬):
├── T14: 에디터 플레이리스트 (콘텐츠 + 페이지) [visual-engineering]
├── T15: 인플루언서 의견 (콘텐츠 + 페이지) [visual-engineering]
├── T16: YouTube oEmbed 컴포넌트 [quick]
├── T17: Giscus 댓글 통합 [quick]
└── T18: SEO (sitemap, robots.txt, OG meta, RSS feed) [quick]

Wave 5 (Polish & Deploy — Wave 4 완료 후):
├── T19: localStorage 개인화 (관심사 태그 필터) [unspecified-high]
├── T20: GitHub OAuth (Cloudflare Workers) [deep]
└── T21: Cloudflare Pages 프로덕션 배포 + 모니터링 [unspecified-high]

Wave FINAL (ALL 완료 후 — 4개 병렬 리뷰, 사용자 승인 후 완료):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high + playwright)
└── F4: Scope fidelity check (deep)
→ 결과 제시 → 사용자 명시적 승인 대기

Critical Path: T1 → T6 → T7 → T10 → T12 → T13 → T19 → T21 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 5 (Waves 1, 4)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1 | - | T6-T9, all | 1 |
| T2 | - | T5-T8, T10 | 1 |
| T3 | - | T7, T8, T13-T15 | 1 |
| T4 | - | T6, T10, T12, T21 | 1 |
| T5 | T2 | T6, T10 | 1 |
| T6 | T1, T2, T4, T5 | T7, T12 | 2 |
| T7 | T1, T2, T3, T6 | T13, T18 | 2 |
| T8 | T1, T2, T3 | T17 | 2 |
| T9 | T1 | T11 | 2 |
| T10 | T1, T2, T4, T5 | T11 | 3 |
| T11 | T9, T10 | - | 3 |
| T12 | T4, T6 | T13 | 3 |
| T13 | T3, T7, T12 | T18 | 3 |
| T14 | T1, T2, T3 | T18 | 4 |
| T15 | T1, T2, T3 | - | 4 |
| T16 | T1 | - | 4 |
| T17 | T8 | - | 4 |
| T18 | T7, T13, T14 | T21 | 4 |
| T19 | T7 | - | 5 |
| T20 | T9 | T21 | 5 |
| T21 | T18, T20 | F1-F4 | 5 |
| F1-F4 | T21 | - | FINAL |

### Agent Dispatch Summary

| Wave | Tasks | Dispatch |
|------|-------|----------|
| 1 | 5 | T1→`quick`, T2→`quick`, T3→`visual-engineering`, T4→`quick`, T5→`quick` |
| 2 | 4 | T6→`deep`, T7→`visual-engineering`, T8→`visual-engineering`, T9→`unspecified-high` |
| 3 | 4 | T10→`deep`, T11→`unspecified-high`, T12→`deep`, T13→`visual-engineering` |
| 4 | 5 | T14→`visual-engineering`, T15→`visual-engineering`, T16→`quick`, T17→`quick`, T18→`quick` |
| 5 | 3 | T19→`unspecified-high`, T20→`deep`, T21→`unspecified-high` |
| FINAL | 4 | F1→`oracle`, F2→`unspecified-high`, F3→`unspecified-high`+`playwright`, F4→`deep` |

---

## TODOs

- [x] 1. Astro 프로젝트 스캐폴딩 + 설정

  **What to do**:
  - **루트 디렉토리(C:\Users\BaekdongCha\Documents\honeycombo)에서 직접 스캐폴딩** (하위 폴더 생성 금지):
    - `bun create astro@latest . -- --template minimal --typescript strict` (현재 디렉토리에 설치, `.sisyphus/`는 보존)
    - 또는 수동: `bun init`, `bun add astro`, `package.json` 설정 후 astro 파일 수동 생성
  - **Git 초기화 + GitHub repo 생성**:
    - `git init`
    - `gh repo create honeycombo --public --source=. --push` (GitHub CLI 사용)
    - 또는 GitHub 웹에서 repo 생성 후 `git remote add origin` + `git push`
  - `astro.config.mjs`: `output: 'static'`, `site: 'https://honeycombo.pages.dev'`
  - `@astrojs/cloudflare` 어댑터 불필요 (SSG 정적 빌드 → Cloudflare Pages Git Integration으로 배포)
  - Cloudflare Pages 프로젝트는 T21에서 생성 (GitHub repo 연결 필요)
  - `tsconfig.json`: `extends: "astro/tsconfigs/strict"`
  - `package.json` scripts: `build`, `dev`, `preview`, `validate`
  - Vitest 설치: `bun add -D vitest`
  - `vitest.config.ts` 생성
  - `.gitignore` 설정 (dist/, node_modules/)
  - 디렉토리 구조 생성:
    ```
    src/content/curated/    — glob() 개별 JSON용
    src/data/feeds/         — glob() RSS 개별 JSON (기사별 파일, YYYY/MM 샤딩)
    src/data/trending/
    src/data/must-read/
    src/data/playlists/
    src/data/influencers/
    src/config/             — feeds.json, spam-keywords.json 등
    src/pages/
    src/components/
    src/layouts/
    src/styles/
    scripts/                — validate.ts 등 CI 스크립트
    public/admin/           — Decap CMS
    .github/workflows/
    functions/api/          — Cloudflare Pages Functions (OAuth 등)
    ```

  **Must NOT do**:
  - 이미지 폴더 (public/images) 생성 금지 — 이미지는 외부 핫링크
  - `output: 'server'` 사용 금지 — SSG 전용
  - 불필요한 Astro 인테그레이션 추가 금지 (tailwind, react 등 — 필요 시 후속 태스크에서)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순 스캐폴딩 + 설정 파일 생성, 비즈니스 로직 없음
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2, T3, T4, T5)
  - **Blocks**: T6, T7, T8, T9, T10 (모든 후속 태스크)
  - **Blocked By**: None

  **References**:
  - Astro 공식 설치: https://docs.astro.build/en/install-and-setup/
  - Cloudflare Pages 배포: https://docs.astro.build/en/guides/deploy/cloudflare/
  - Cloudflare Pages Git Integration: https://developers.cloudflare.com/pages/get-started/git-integration/
  - Vitest 설정: https://vitest.dev/guide/

  **Acceptance Criteria**:
  - [ ] `bun install` 성공
  - [ ] `bun run dev` → localhost:4321 접근 가능
  - [ ] `bun run build` → `dist/` 생성, exit 0
  - [ ] 모든 디렉토리 구조 존재 확인
  - [ ] TypeScript strict mode 활성화 확인

  **QA Scenarios:**
  ```
  Scenario: 빌드 성공 확인
    Tool: Bash
    Steps:
      1. `bun run build`
      2. exit code 확인: 0
      3. `ls dist/index.html` → 파일 존재 확인
    Expected Result: exit 0, dist/index.html 존재
    Evidence: .sisyphus/evidence/task-1-build-success.txt

  Scenario: 디렉토리 구조 확인
    Tool: Bash
    Steps:
      1. `ls src/content/curated` → 디렉토리 존재
      2. `ls src/data/feeds` → 디렉토리 존재
      3. `ls src/config` → 디렉토리 존재
      4. `ls scripts` → 디렉토리 존재
      5. `ls .github/workflows` → 디렉토리 존재
    Expected Result: 모든 디렉토리 존재
    Evidence: .sisyphus/evidence/task-1-dirs.txt
  ```

  **Commit**: YES (Wave 1 그룹)
  - Message: `chore: scaffold astro project with schemas and CI`
  - Files: 전체 프로젝트 구조
  - Pre-commit: `bun run build`

- [x] 2. 콘텐츠 스키마 정의 (Zod + JSON Schema)

  **What to do**:
  - `src/content.config.ts` 생성 (Astro v5+ loader 기반 컬렉션 — 레거시 `src/content/config.ts` 아님):
    - `curated` 컬렉션: `glob()` loader, `src/content/curated/**/*.json`
    - `feeds` 컬렉션: `glob()` loader, `src/data/feeds/**/*.json` (월별 개별 JSON 파일)
    - `trending` 컬렉션: `glob()` loader, `src/data/trending/*.json` (주간별 개별 JSON)
    - `mustRead` 컬렉션: `glob()` loader, `src/data/must-read/*.json` (일별 개별 JSON)
    - `playlists` 컬렉션: `glob()` loader, `src/data/playlists/*.json` (플레이리스트별 개별 JSON)
    - `influencers` 컬렉션: `glob()` loader, `src/data/influencers/*.json` (인플루언서별 개별 JSON)
  - 각 컬렉션별 Zod 스키마 (`src/schemas/` 디렉토리):
    - `curated-article.ts` (수동 큐레이션용): id, title(max 200), url(URL), source, type(enum: article|youtube|x_thread|threads|other), thumbnail_url(optional), description(max 1000), tags(array, 1-5개), submitted_by, submitted_at(date), status(enum: pending|approved|rejected), engagement({views, reactions, sources_count})
    - `feed-article.ts` (RSS 수집용, 별도 스키마): id, title(max 200), url(URL), source, type(default: 'article'), thumbnail_url(optional), description(max 1000), tags(array, 1-5개), published_at(date), feed_id(string) — submitted_by/status/engagement 필드 없음 (자동 수집이므로)
    - `playlist.ts`: id, title, description, curator, items(array of article refs), created_at, updated_at, tags
    - `trending.ts`: week, generated_at, items(array of {rank, keyword, score, direction(enum: rising|stable|falling), velocity, article_count, top_articles(refs)})
    - `must-read.ts`: date, items(array of article refs), pinned_by(optional)
    - `influencer.ts`: id, name, platform(enum), handle, bio, opinions(array of {text(max 500), source_url, date, topic})
    - `feed-config.ts`: id, name, url(URL), category, enabled(boolean), last_fetched(optional date)
  - JSON Schema 버전 생성 (`scripts/schemas/` 디렉토리) — GitHub Actions 검증용 (ajv 호환)
  - 샘플 데이터 생성 — 각 컬렉션별 1-2개 fixture (유효 + 무효 샘플 포함)
  - `src/config/feeds.json` 초기 RSS 피드 목록 10개:
    - Hacker News, TechCrunch, The Verge, Ars Technica, Dev.to, GitHub Blog, Product Hunt, MIT Tech Review, Wired, 요즘IT(한국)
  - `src/config/spam-keywords.json` 초기 50개 키워드
  - `src/config/ranking-overrides.json` 빈 구조 (`{ "week": "", "pin": [], "suppress": [], "boost": {}, "audit_log": [] }`)

  **Must NOT do**:
  - 스키마에 `any` 타입 사용 금지
  - 필드 수 과다 금지 — 각 스키마 최대 15개 필드
  - 중첩 3단계 이상 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 타입 정의 + 설정 파일, 로직 없음
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T3, T4, T5)
  - **Blocks**: T5, T6, T7, T8, T10
  - **Blocked By**: None

  **References**:
  - Astro Content Collections: https://docs.astro.build/en/guides/content-collections/
  - Astro Zod 스키마: https://docs.astro.build/en/guides/content-collections/#defining-the-collection-schema
  - Zod 문서: https://zod.dev/
  - JSON Schema 스펙: https://json-schema.org/draft/2020-12/schema

  **Acceptance Criteria**:
  - [ ] `bun run build` 성공 — 스키마 유효성 검증 통과
  - [ ] 유효 샘플 데이터로 빌드 성공
  - [ ] 무효 샘플 데이터로 빌드 실패 (Zod 에러 메시지 출력)
  - [ ] 모든 Zod 스키마에 대응하는 JSON Schema 파일 존재

  **QA Scenarios:**
  ```
  Scenario: 유효 데이터 빌드 성공
    Tool: Bash
    Steps:
      1. 유효 샘플 JSON을 src/content/curated/2026/04/test-article.json에 배치
      2. `bun run build`
      3. exit code 확인: 0
    Expected Result: 빌드 성공
    Evidence: .sisyphus/evidence/task-2-valid-build.txt

  Scenario: 무효 데이터 빌드 실패
    Tool: Bash
    Steps:
      1. title 필드 누락된 JSON을 src/content/curated/2026/04/bad-article.json에 배치
      2. `bun run build`
      3. exit code 확인: 비-0
      4. stderr에 'title' 관련 Zod 에러 메시지 포함 확인
    Expected Result: 빌드 실패 + 명확한 에러 메시지
    Evidence: .sisyphus/evidence/task-2-invalid-build.txt
  ```

  **Commit**: YES (Wave 1 그룹)

- [x] 3. 베이스 레이아웃 + 글로벌 스타일 + 네비게이션

  **What to do**:
  - `src/layouts/BaseLayout.astro` 생성:
    - HTML head: charset, viewport, OG meta slots, favicon
    - 네비게이션 바: 홈, 기사, 트렌드, Must-read, 플레이리스트, 인플루언서, 자료등록
    - 푸터: 저작권, GitHub 링크
    - 다크모드 지원 (CSS `prefers-color-scheme`)
  - `src/styles/global.css` 생성:
    - CSS custom properties (디자인 토큰): colors, spacing, font-size, border-radius
    - CSS reset (modern normalize)
    - 레스폰시브 그리드 시스템 (CSS Grid + Flexbox)
    - `.card`, `.badge`, `.tag`, `.pagination` 기본 스타일
  - `src/components/Navigation.astro`: 헤더 네비게이션 컴포넌트
  - `src/components/Footer.astro`: 푸터 컴포넌트
  - `src/pages/index.astro`: 홈 페이지 기본 구조 (빈 상태 OK)
  - 데이터 속성: `data-testid` 추가 — `article-list`, `trending-list`, `nav-main` 등

  **Must NOT do**:
  - Tailwind CSS 사용 금지 — 순수 CSS만 (CSS custom properties + 네이티브)
  - React/Vue/Svelte 사용 금지 — 순수 Astro 컴포넌트
  - 로딩 스피너/스켈레톤 금지 — SSG
  - 복잡한 디자인 시스템 금지 — 간결한 컨텐츠 사이트 스타일

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 레이아웃, 스타일링, 컴포넌트 UI 설계
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: 디자인 품질 보장

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T4, T5)
  - **Blocks**: T7, T8, T13, T14, T15
  - **Blocked By**: None

  **References**:
  - Astro 레이아웃: https://docs.astro.build/en/basics/layouts/
  - Astro 컴포넌트: https://docs.astro.build/en/basics/astro-components/

  **Acceptance Criteria**:
  - [ ] `bun run build` 성공
  - [ ] 홈 페이지 HTML에 `data-testid="nav-main"` 존재
  - [ ] CSS custom properties 정의됨 (`--color-primary` 등)
  - [ ] 다크모드 `prefers-color-scheme: dark` 반응

  **QA Scenarios:**
  ```
  Scenario: 네비게이션 렌더링
    Tool: Bash
    Steps:
      1. `bun run build`
      2. `Select-String 'data-testid="nav-main"' dist/index.html`
      3. 매치 확인
    Expected Result: nav-main testid 존재
    Evidence: .sisyphus/evidence/task-3-nav.txt
  ```

  **Commit**: YES (Wave 1 그룹)

- [x] 4. GitHub Actions 인프라 (CI/CD + concurrency)

  **What to do**:
  - `.github/workflows/ci.yml` 생성:
    - trigger: push to main, pull_request
    - steps: checkout, setup-bun, install, validate, build, test
    - concurrency: `{ group: "ci-${{ github.ref }}", cancel-in-progress: true }`
  - **배포는 Cloudflare Pages Git Integration**으로 처리 (GitHub Actions deploy.yml 불필요):
    - Cloudflare Dashboard에서 Pages 프로젝트 생성 → GitHub repo 연결
    - Build command: `bun run build`, Output directory: `dist/`
    - main branch에 push 시 자동 빌드/배포 (CF 측에서 처리)
    - 별도 deploy.yml 생성 금지 — CF Pages Git Integration이 대체
  - `.github/workflows/content-update-base.yml` (reusable workflow):
    - concurrency: `{ group: "content-update", cancel-in-progress: false }`
    - push-with-retry step: pull --rebase, push, retry 1회
  - `.github/ISSUE_TEMPLATE/submit-link.yml` 생성:
    - 필드: url(필수), type(dropdown: 기사/YouTube/X/Threads/기타), tags(텍스트), note(텍스트어리어)
    - labels: `["submission"]`
  - 모든 워크플로우에 `workflow_dispatch` 트리거 포함 (수동 테스트용)

  **Must NOT do**:
  - `cancel-in-progress: true`를 content-update 그룹에 사용 금지 — 데이터 손실 위험
  - secrets를 하드코딩 금지
  - 복잡한 matrix build 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: YAML 설정 파일 생성, 로직 최소
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T6, T10, T12, T21
  - **Blocked By**: None

  **References**:
  - GitHub Actions 동시성: https://docs.github.com/en/actions/using-jobs/using-concurrency
  - GitHub Issue Forms: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms
  - Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/

  **Acceptance Criteria**:
  - [ ] CI 워크플로우 YAML 문법 유효 (actionlint 또는 GitHub UI 검증)
  - [ ] Issue 템플릿 `.github/ISSUE_TEMPLATE/submit-link.yml` 존재
  - [ ] 모든 워크플로우에 `workflow_dispatch` 트리거 포함
  - [ ] content-update concurrency group이 `cancel-in-progress: false`로 설정됨

  **QA Scenarios:**
  ```
  Scenario: CI 워크플로우 문법 검증
    Tool: Bash
    Steps:
      1. `Select-String 'workflow_dispatch' .github/workflows/ci.yml` → 매치 확인
      2. `Select-String 'content-update' .github/workflows/content-update-base.yml` → concurrency 그룹 확인
    Expected Result: 모든 워크플로우에 필수 설정 존재
    Evidence: .sisyphus/evidence/task-4-workflows.txt
  ```

  **Commit**: YES (Wave 1 그룹)

- [x] 5. 콘텐츠 검증 스크립트 (validate.ts)

  **What to do**:
  - `scripts/validate.ts` 생성:
    - `src/content/curated/` 내 모든 JSON 파일 스캔
    - `src/data/feeds/` 내 모든 JSON 파일 스캔
    - 각 파일을 대응 Zod 스키마로 검증
    - 성공: `✅ All N files valid` 출력, exit 0
    - 실패: 파일별 에러 나열, exit 1
    - `--fix` 옵션: 자동 수정 가능한 문제 (trailing whitespace 등) 자동 수정
  - `package.json`에 `"validate": "bun run scripts/validate.ts"` 스크립트 추가
  - CI 워크플로우에서 `bun run validate` 단계 확인 (T4에서 이미 추가)
  - URL 중복 검사: 모든 기사의 url 필드 유니크성 확인

  **Must NOT do**:
  - 무효 파일을 자동 삭제 금지 — 리포트만 (데이터 손실 방지)
  - 외부 네트워크 요청 금지 — 오프라인 검증만

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 스크립트 생성
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (T2 완료 후)
  - **Parallel Group**: Wave 1 (T2에 의존하지만 T1과 병렬 가능)
  - **Blocks**: T6, T10
  - **Blocked By**: T2 (스키마 필요)

  **References**:
  - Zod .parse() API: https://zod.dev/?id=parse
  - Node.js fs/path API: 파일 스캔용

  **Acceptance Criteria**:
  - [ ] `bun run validate` → 유효 데이터에 exit 0, `All N files valid` 출력
  - [ ] `bun run validate` → 무효 데이터에 exit 1, 파일별 에러 상세 출력
  - [ ] URL 중복 감지 정상 동작

  **QA Scenarios:**
  ```
  Scenario: 유효 데이터 검증 통과
    Tool: Bash
    Steps:
      1. 유효 fixture JSON 파일을 src/content/curated/2026/04/에 배치
      2. `bun run validate`
      3. exit code: 0, stdout에 'All' + 'valid' 포함
    Expected Result: exit 0
    Evidence: .sisyphus/evidence/task-5-valid.txt

  Scenario: 무효 데이터 검증 실패
    Tool: Bash
    Steps:
      1. 무효 fixture JSON (title 누락) 배치
      2. `bun run validate`
      3. exit code: 1, stderr에 파일명 + 'title' 에러 포함
    Expected Result: exit 1 + 명확한 에러
    Evidence: .sisyphus/evidence/task-5-invalid.txt

  Scenario: URL 중복 감지
    Tool: Bash
    Steps:
      1. 동일 URL을 가진 2개 파일 배치
      2. `bun run validate`
      3. stderr에 'duplicate' + URL 포함
    Expected Result: 중복 URL 경고
    Evidence: .sisyphus/evidence/task-5-dedup.txt
  ```

  **Commit**: YES (Wave 1 그룹)


- [x] 6. RSS 수집 파이프라인 (GitHub Actions cron)

  **What to do**:
  - `scripts/rss-collect.ts` 생성:
    - `src/config/feeds.json`에서 피드 목록 로드
    - 각 피드 병렬 fetch (Promise.allSettled, 30초 타임아웃/피드)
    - RSS/Atom XML 파싱 (rss-parser 라이브러리)
    - 아티클 정규화: title, url(canonical), source, description(절단 1000자), thumbnail_url(OG image에서 추출), tags(카테고리에서 유도), published_at
    - 중복 제거: SHA-256 hash(title + url) — 기존 `src/data/feeds/*.json` 과 비교
    - 스탈 필터: `src/config/spam-keywords.json` 키워드 매칭
    - 최대 50개 새 기사/실행 (플러드 방지)
    - 결과를 `src/data/feeds/YYYY/MM/{id}.json`에 개별 파일로 저장 (glob() loader와 일치)
    - 에러 로그: 실패한 피드를 stderr 출력 (skip-and-log, 크래시 금지)
  - `.github/workflows/rss-collect.yml` 생성:
    - schedule: `cron: '17 2,14 * * *'` (하루 2회, 피크 회피용 홀수분)
    - workflow_dispatch (수동 실행)
    - concurrency: `content-update` 그룹 사용 (T4의 base workflow)
    - steps: checkout, setup-bun, install, `bun run scripts/rss-collect.ts`, validate, git add+commit+push (retry-with-rebase)
  - 테스트: `tests/rss-collect.test.ts`
    - mock RSS XML fixture (유효 + 말포먼 + 빈 피드)
    - 정규화 로직 검증
    - 중복 제거 검증
    - 스타 필터 검증

  **Must NOT do**:
  - 라이브 RSS 피드로 테스트 금지 — fixture 전용
  - 이미지 다운로드 금지 — thumbnail_url 핫링크만
  - exponential backoff 금지 — 단순 1-retry만
  - 피드당 50개 초과 수집 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: RSS 파싱, 중복제거, 에러핸들링 등 복잡한 데이터 파이프라인
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2 내 병렬)
  - **Parallel Group**: Wave 2 (with T7, T8, T9)
  - **Blocks**: T7, T12
  - **Blocked By**: T1, T2, T4, T5

  **References**:
  - rss-parser npm: https://www.npmjs.com/package/rss-parser
  - GitHub Actions cron: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule
  - SHA-256 Node.js: `crypto.createHash('sha256')`

  **Acceptance Criteria**:
  - [ ] `bun test tests/rss-collect.test.ts` → 모든 테스트 통과
  - [ ] mock fixture로 `bun run scripts/rss-collect.ts` 실행 → `src/data/feeds/YYYY-MM.json` 생성됨
  - [ ] 중복 기사 제거 확인
  - [ ] 말포먼 XML fixture로 실행 → 크래시 없이 skip-and-log

  **QA Scenarios:**
  ```
  Scenario: RSS 수집 성공 (mock)
    Tool: Bash
    Preconditions: tests/fixtures/valid-rss.xml 존재
    Steps:
      1. 환경변수로 mock 피드 URL 설정
      2. `bun run scripts/rss-collect.ts`
      3. `src/data/feeds/2026/04/` 디렉토리에 JSON 파일 생성 확인
      4. 생성된 JSON 파일 1개 이상 확인
      5. 각 JSON 파일에 id, title, url 필드 존재 확인
    Expected Result: 개별 JSON 기사 파일 생성
    Evidence: .sisyphus/evidence/task-6-rss-success.txt

  Scenario: 말포먼 피드 처리 (graceful skip)
    Tool: Bash
    Preconditions: tests/fixtures/malformed-rss.xml 존재
    Steps:
      1. 말포먼 fixture URL 설정
      2. `bun run scripts/rss-collect.ts`
      3. exit code: 0 (crash 없음)
      4. stderr에 'skipped' 또는 'error' 로그 포함
    Expected Result: skip + log, no crash
    Evidence: .sisyphus/evidence/task-6-rss-malformed.txt
  ```

  **Commit**: YES
  - Message: `feat: add RSS pipeline and article pages`
  - Pre-commit: `bun run build; bun test`

- [x] 7. 기사 목록 페이지 + 페이지네이션 + 태그 필터

  **What to do**:
  - `src/pages/articles/index.astro` (첫 페이지) + `src/pages/articles/page/[...page].astro` (페이지네이션) 생성:
    - 라우팅: `/articles` (첫 페이지), `/articles/page/2`, `/articles/page/3` ...
    - `/articles/[slug]` (T8)와 라우팅 충돌 없음
    - `getStaticPaths()`로 페이지네이션 (20개/페이지)
    - 큐레이션 + RSS 수집 기사 통합 목록 (curated 우선)
    - 날짜 역순 정렬
    - `data-testid="article-list"` 속성
  - `src/components/ArticleCard.astro` 생성:
    - 제목, 소스, 설명, 태그, 날짜, 썸네일(선택적)
    - 외부 링크 → `target="_blank" rel="noopener noreferrer"`
    - 큐레이션 기사는 내부 상세 페이지 링크, RSS 기사는 외부 링크
    - `data-testid="article-card"`
  - `src/components/Pagination.astro` 생성:
    - 이전/다음 페이지 링크
    - 현재 페이지 표시
    - `data-testid="pagination"`
  - `src/components/TagFilter.astro` 생성:
    - 태그 목록 표시 (전체 기사에서 추출)
    - 클릭 시 URL 파라미터로 필터링 (`/articles?tag=AI`)
    - 클라이언트 사이드 JS로 필터링 (영 바이트 hydration)
    - `data-testid="tag-filter"`

  **Must NOT do**:
  - 무한 스크롤 금지 — 페이지네이션 전용
  - 검색 기능 금지 (Phase 2)
  - React/Vue 사용 금지 — 순수 Astro + vanilla JS

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI 컴포넌트 설계 + 렌더링
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2 내)
  - **Parallel Group**: Wave 2
  - **Blocks**: T13, T18
  - **Blocked By**: T1, T2, T3, T6

  **References**:
  - Astro 페이지네이션: https://docs.astro.build/en/guides/routing/#pagination
  - Astro getStaticPaths: https://docs.astro.build/en/reference/routing-reference/#getstaticpaths

  **Acceptance Criteria**:
  - [ ] `/articles` 페이지 렌더링 성공
  - [ ] 페이지네이션 2페이지 이상일 때 정상 동작
  - [ ] 태그 필터 클릭 시 URL 변경 + 필터링 작동
  - [ ] 큐레이션 기사 → 내부 링크, RSS 기사 → 외부 링크

  **QA Scenarios:**
  ```
  Scenario: 기사 목록 렌더링
    Tool: Bash
    Steps:
      1. `bun run build`
      2. `Select-String 'data-testid="article-list"' dist/articles/index.html`
      3. `Select-String 'data-testid="article-card"' dist/articles/index.html`
      4. `Select-String 'data-testid="pagination"' dist/articles/index.html`
    Expected Result: 모든 testid 매치
    Evidence: .sisyphus/evidence/task-7-article-list.txt

  Scenario: 빈 상태 처리
    Tool: Bash
    Preconditions: 콘텐츠 파일 0개
    Steps:
      1. `bun run build` (빈 콘텐츠)
      2. dist/articles/index.html 존재 확인
      3. '기사가 없습니다' 또는 empty state 메시지 포함 확인
    Expected Result: 빈 상태 UI 정상 렌더
    Evidence: .sisyphus/evidence/task-7-empty-state.txt
  ```

  **Commit**: YES (T6과 묶음)

- [x] 8. 큐레이션 기사 상세 페이지

  **What to do**:
  - `src/pages/articles/[slug].astro` 생성:
    - `getStaticPaths()`로 curated 커렉션에서 동적 경로 생성
    - RSS 수집 기사는 상세 페이지 없음 (목록에서 외부 링크)
    - 제목, 소스, 설명, 태그, 날짜, 썰네일(선택적), 원문 링크
    - 관련 기사 추천 (같은 태그 기반, 최대 3개)
    - OG meta tags (title, description, image)
    - Giscus 댓글 슬롯 (T17에서 채움)
    - `data-testid="article-detail"`
  - `src/components/RelatedArticles.astro` 생성
  - `src/components/ArticleMeta.astro` 생성 (소스, 날짜, 태그)

  **Must NOT do**:
  - RSS 수집 기사용 상세 페이지 생성 금지 (파일 수 절약)
  - 콘텐츠 복사/재게시 금지 — 원문 링크만
  - 불필요한 애니메이션 금지

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI 렌더링 + 컴포넌트 설계
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2 내)
  - **Parallel Group**: Wave 2
  - **Blocks**: T17 (Giscus)
  - **Blocked By**: T1, T2, T3

  **References**:
  - Astro 동적 라우팅: https://docs.astro.build/en/guides/routing/#dynamic-routes

  **Acceptance Criteria**:
  - [ ] `/articles/test-slug` 페이지 렌더링 성공
  - [ ] OG meta tags 정상 출력
  - [ ] 관련 기사 최대 3개 표시
  - [ ] Giscus 슬롯 영역 존재 (T17에서 활성화)

  **QA Scenarios:**
  ```
  Scenario: 상세 페이지 렌더링
    Tool: Bash
    Steps:
      1. 큐레이션 기사 fixture 배치
      2. `bun run build`
      3. `Select-String 'data-testid="article-detail"' dist/articles/test-article/index.html`
      4. `Select-String 'og:title' dist/articles/test-article/index.html`
    Expected Result: 상세 페이지 + OG meta 존재
    Evidence: .sisyphus/evidence/task-8-detail.txt
  ```

  **Commit**: YES (T6, T7과 묶음)


- [x] 9. Decap CMS 설정 + 어드민 페이지

  **What to do**:
  - `public/admin/config.yml` 생성:
    - backend: github, repo, branch: main
    - collections: curated (폴더 `src/content/curated`, format: json, identifier_field: id)
    - 필드: id, title, url, source, type(select), description(text), tags(list), thumbnail_url, status(select: pending/approved/rejected)
    - playlists 컬렉션 (폴더 `src/data/playlists`, format: json)
    - influencers 컬렉션 (폴더 `src/data/influencers`, format: json)
    - must-read 컬렉션 (폴더 `src/data/must-read`, format: json)
    - ranking-overrides 컬렉션 (single file `src/config/ranking-overrides.json`)
  - `src/pages/admin.astro` 생성:
    - Decap CMS 스크립트 로드 (`unpkg.com/decap-cms@^3.1.2`)
    - `robots: noindex` 메타
  - GitHub OAuth App 설정 안내 문서 (README에 단계 기록)

  **Must NOT do**:
  - Decap CMS를 npm으로 설치 금지 — CDN script 태그 사용
  - 사용자 관리 기능 금지 (Phase 1은 단일 에디터)
  - 미디어 업로드 금지 — 이미지 외부 핫링크만

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: CMS 통합 + OAuth 설정 등 인프라 구성
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2 내)
  - **Parallel Group**: Wave 2
  - **Blocks**: T11
  - **Blocked By**: T1

  **References**:
  - Decap CMS + Astro: https://docs.astro.build/en/guides/cms/decap-cms/
  - Decap CMS 설정: https://decapcms.org/docs/configuration-options/
  - Decap JSON format: https://decapcms.org/docs/collection-types/#file-collections

  **Acceptance Criteria**:
  - [ ] `/admin` 페이지에 Decap CMS UI 로드
  - [ ] config.yml에 curated, playlists, influencers 컬렉션 정의
  - [ ] `robots: noindex` 메타 태그 존재

  **QA Scenarios:**
  ```
  Scenario: CMS 페이지 로드
    Tool: Bash
    Steps:
      1. `bun run build`
      2. `Test-Path dist/admin/index.html` → True
      3. `Select-String 'decap-cms' dist/admin/index.html` → 매치
    Expected Result: Decap CMS 스크립트 로드됨
    Evidence: .sisyphus/evidence/task-9-cms.txt
  ```

  **Commit**: YES
  - Message: `feat: add Decap CMS admin interface`

- [x] 10. 사용자 제출 파이프라인 (GitHub Issues → Actions → JSON)

  **What to do**:
  - `.github/workflows/process-submission.yml` 생성:
    - trigger: `issues: { types: [opened] }` + label `submission` 필터
    - workflow_dispatch (수동 실행)
    - concurrency: `content-update` 그룹
    - steps:
      1. Issue body에서 필드 추출 (url, type, tags, note)
      2. URL 유효성 검증 (format 체크)
      3. URL 중복 검사 (기존 curated + feeds JSON 전체 스캔)
      4. 스타 키워드 검사
      5. YouTube URL이면 oEmbed로 메타데이터 자동 추출 (title, thumbnail)
      6. JSON 파일 생성: `src/content/curated/YYYY/MM/submission-{issue-number}.json`
      7. status: `pending` (모더레이션 대기)
      8. PR 생성 (branch: `submission/{issue-number}`)
      9. Issue에 댓글: "접수되었습니다. 검토 후 게시됩니다." 또는 "중복 URL입니다." 등
  - `scripts/process-submission.ts` 생성 (Issue 파싱 + JSON 생성 로직)
  - 테스트: `tests/process-submission.test.ts`
    - 유효 Issue 처리
    - YouTube URL oEmbed 추출
    - 중복 URL 거부
    - 스타 키워드 거부
    - 말포먼 Issue 처리 (graceful fail)

  **Must NOT do**:
  - Issue를 자동 승인 금지 — 항상 pending 상태로 PR 생성
  - 직접 main에 push 금지 — 항상 PR 경유
  - 20개/시간 초과 처리 금지 (rate limit)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 복잡한 워크플로우 + 데이터 처리 + 엣지 케이스
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3 내)
  - **Parallel Group**: Wave 3
  - **Blocks**: T11
  - **Blocked By**: T1, T2, T4, T5

  **References**:
  - GitHub Issues 이벤트: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#issues
  - oEmbed API: https://oembed.com/
  - YouTube oEmbed: `https://www.youtube.com/oembed?url={URL}&format=json`

  **Acceptance Criteria**:
  - [ ] `bun test tests/process-submission.test.ts` → 모든 테스트 통과
  - [ ] 유효 Issue 데이터 → JSON 파일 생성 + status: pending
  - [ ] YouTube URL → oEmbed으로 title, thumbnail 자동 채움
  - [ ] 중복 URL → 거부 로그 출력

  **QA Scenarios:**
  ```
  Scenario: 제출 처리 성공
    Tool: Bash
    Steps:
      1. mock Issue 데이터 (url: https://example.com/article, type: article, tags: AI,LLM)
      2. `bun run scripts/process-submission.ts --mock-issue tests/fixtures/valid-issue.json`
      3. `src/content/curated/2026/04/submission-*.json` 생성 확인
      4. JSON의 status 필드 = "pending" 확인
    Expected Result: pending 상태 JSON 기사 생성
    Evidence: .sisyphus/evidence/task-10-submission.txt

  Scenario: YouTube oEmbed 추출
    Tool: Bash
    Steps:
      1. mock Issue (url: https://www.youtube.com/watch?v=dQw4w9WgXcQ)
      2. `bun run scripts/process-submission.ts --mock-issue tests/fixtures/youtube-issue.json`
      3. 생성된 JSON에서 title, thumbnail_url 필드 존재 확인
    Expected Result: YouTube 메타데이터 자동 채움
    Evidence: .sisyphus/evidence/task-10-youtube.txt

  Scenario: 중복 URL 거부
    Tool: Bash
    Steps:
      1. 기존 기사와 동일 URL로 mock Issue 생성
      2. `bun run scripts/process-submission.ts --mock-issue tests/fixtures/duplicate-issue.json`
      3. exit code: 0 (크래시 없음)
      4. stderr에 'duplicate' 로그 포함
      5. 새 JSON 파일 미생성 확인
    Expected Result: 중복 감지 + skip
    Evidence: .sisyphus/evidence/task-10-duplicate.txt
  ```

  **Commit**: YES
  - Message: `feat: add submission pipeline and moderation`

- [x] 11. 모더레이션 상태 관리 (pending/approved/rejected)

  **What to do**:
  - Decap CMS에서 status 필드 통한 모더레이션:
    - `status: pending` → 사이트에 미노출
    - `status: approved` → 사이트에 노출
    - `status: rejected` → 사이트에 미노출
  - 기사 목록/상세 페이지에서 `status === 'approved'` 필터 적용
  - Decap CMS config에 status 필드 editorial_workflow 설정
  - `src/pages/articles/index.astro` + `src/pages/articles/page/[...page].astro` 수정: approved 만 표시
  - `src/pages/articles/[slug].astro` 수정: pending/rejected면 404

  **Must NOT do**:
  - ML 기반 스팸 탐지 금지
  - 사용자 평판/어필 시스템 금지
  - 복잡한 모더레이션 UI 금지 — Decap CMS status 필드만

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: CMS 통합 + 필터링 로직 수정
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3 내, T10 후)
  - **Parallel Group**: Wave 3
  - **Blocks**: -
  - **Blocked By**: T9, T10

  **Acceptance Criteria**:
  - [ ] `status: pending` 기사 → 목록 페이지에 미노출
  - [ ] `status: approved` 기사 → 목록 페이지에 노출
  - [ ] `status: rejected` 기사 → 404

  **QA Scenarios:**
  ```
  Scenario: 모더레이션 필터링
    Tool: Bash
    Steps:
      1. pending/approved/rejected 상태 기사 3개 배치
      2. `bun run build`
      3. dist/articles/index.html에서 approved 기사 제목만 존재 확인
      4. pending/rejected 기사 제목 부재 확인
    Expected Result: approved만 노출
    Evidence: .sisyphus/evidence/task-11-moderation.txt
  ```

  **Commit**: YES (T10과 묶음)


- [x] 12. 트렌드 랭킹 계산 워크플로우 (weekly GitHub Actions)

  **What to do**:
  - `scripts/calc-trending.ts` 생성:
    - `src/data/feeds/*.json` + `src/content/curated/**/*.json`에서 최근 7일 기사 로드
    - 태그 빈도 집계 (키워드 랭킹)
    - 랭킹 산식: `score = (count × 0.3) + (source_diversity × 0.3) + (recency_weight × 0.4)`
    - direction 계산: 이전 주 대비 rising/stable/falling
    - 수동 오버라이드 적용 (`src/config/ranking-overrides.json`): pin → 강제 상위, suppress → 제거, boost → 가중치
    - audit_log에 매 계산 기록 추가
    - 최소 20개 기사 미만이면 `not_enough_data` 플래그
    - 결과: `src/data/trending/week-YYYY-WW.json` 생성
  - `scripts/calc-must-read.ts` 생성:
    - 트렌딩 상위 3개 + 에디터 수동 핀 = must-read
    - 결과: `src/data/must-read/YYYY-MM-DD.json`
  - `.github/workflows/trending-calc.yml` 생성:
    - schedule: `cron: '0 3 * * 1'` (매주 월요일)
    - workflow_dispatch
    - concurrency: `content-update` 그룹
  - 테스트: `tests/calc-trending.test.ts`
    - fixture 기사로 랭킹 산출 검증
    - 오버라이드 적용 검증
    - cold-start (기사 20개 미만) 처리 검증

  **Must NOT do**:
  - 실시간 랭킹 금지 — 주간 배치만
  - ML/AI 랭킹 조정 금지
  - A/B 테스트 금지

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 랭킹 알고리즘 + 데이터 처리 + 오버라이드 로직
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 3 내)
  - **Parallel Group**: Wave 3
  - **Blocks**: T13
  - **Blocked By**: T4, T6

  **Acceptance Criteria**:
  - [ ] `bun test tests/calc-trending.test.ts` → 모든 테스트 통과
  - [ ] fixture 데이터로 실행 → `src/data/trending/week-*.json` 생성
  - [ ] 오버라이드 pin/suppress 정상 적용
  - [ ] 기사 20개 미만 → `not_enough_data` 플래그

  **QA Scenarios:**
  ```
  Scenario: 트렌드 계산 정상
    Tool: Bash
    Steps:
      1. 30개 fixture 기사 배치 (태그: AI×10, LLM×7, Startup×5, 기타×8)
      2. `bun run scripts/calc-trending.ts`
      3. 생성된 JSON에서 rank 1 = AI 확인
      4. direction, score, article_count 필드 존재 확인
    Expected Result: AI가 1위, 모든 필드 존재
    Evidence: .sisyphus/evidence/task-12-trending.txt
  ```

  **Commit**: YES
  - Message: `feat: add trending ranking and must-read`

- [x] 13. 트렌드 페이지 + Must-read 페이지

  **What to do**:
  - `src/pages/trending.astro` 생성:
    - 최신 트렌딩 데이터 로드
    - 랭킹 테이블: 순위, 키워드, 점수, 방향(화살표 아이콘), 기사 수
    - 각 키워드 클릭 → 관련 기사 목록 표시
    - cold-start: 기사 부족 시 "데이터 수집 중" 메시지
    - `data-testid="trending-list"`
  - `src/pages/must-read.astro` 생성:
    - 오늘의 must-read 목록
    - 각 항목: 제목, 소스, 요약, 트렌드 연동 표시
    - `data-testid="must-read-list"`
  - `src/components/TrendingTable.astro` 생성
  - `src/components/MustReadCard.astro` 생성

  **Must NOT do**:
  - 실시간 업데이트 금지 — SSG 정적 페이지
  - 복잡한 차트/그래프 금지 — 단순 테이블

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI 컴포넌트 + 데이터 시각화
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (T12 완료 후)
  - **Parallel Group**: Wave 3
  - **Blocks**: T18 (SEO)
  - **Blocked By**: T3, T7, T12

  **Acceptance Criteria**:
  - [ ] `/trending` 페이지 렌더링 성공
  - [ ] `/must-read` 페이지 렌더링 성공
  - [ ] 트렌딩 데이터 없을 때 empty state 표시

  **QA Scenarios:**
  ```
  Scenario: 트렌드 페이지 렌더링
    Tool: Bash
    Steps:
      1. trending fixture 데이터 배치
      2. `bun run build`
      3. `Select-String 'data-testid="trending-list"' dist/trending/index.html`
    Expected Result: trending-list testid 존재
    Evidence: .sisyphus/evidence/task-13-trending-page.txt
  ```

  **Commit**: YES (T12와 묶음)

- [ ] 14. 에디터 플레이리스트 (콘텐츠 + 페이지)

  **What to do**:
  - 플레이리스트 데이터 모델 (`src/data/playlists/*.json`):
    - id, title, description, curator, tags
    - items: 기사 참조 배열 [{article_id, added_at, note}]
    - created_at, updated_at
  - `src/pages/playlists/index.astro`: 플레이리스트 목록
    - 인기순 정렬 (items 수 × 0.3 + 최신 업데이트 × 0.7)
    - `data-testid="playlist-list"`
  - `src/pages/playlists/[id].astro`: 플레이리스트 상세
    - 소속 기사 목록 (ArticleCard 재사용)
    - 큐레이터 정보
    - `data-testid="playlist-detail"`
  - `src/components/PlaylistCard.astro` 생성
  - 샘플 플레이리스트 2개 생성 (AI Weekly, Startup Picks)

  **Must NOT do**:
  - 사용자 생성 플레이리스트 금지 (Phase 2)
  - fork/협업 기능 금지
  - 드래그앨드드롭 정렬 금지

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 4 내)
  - **Parallel Group**: Wave 4
  - **Blocks**: T18
  - **Blocked By**: T1, T2, T3

  **Acceptance Criteria**:
  - [ ] `/playlists` 목록 페이지 렌더링
  - [ ] `/playlists/ai-weekly` 상세 페이지 렌더링
  - [ ] 인기순 정렬 동작

  **QA Scenarios:**
  ```
  Scenario: 플레이리스트 페이지
    Tool: Bash
    Steps:
      1. 샘플 플레이리스트 2개 배치
      2. `bun run build`
      3. `Select-String 'data-testid="playlist-list"' dist/playlists/index.html`
      4. `Test-Path dist/playlists/ai-weekly/index.html` → True
    Expected Result: 목록 + 상세 페이지 존재
    Evidence: .sisyphus/evidence/task-14-playlist.txt
  ```

  **Commit**: YES (Wave 4 그룹)

- [ ] 15. 인플루언서 의견 페이지

  **What to do**:
  - 인플루언서 데이터 모델 (`src/data/influencers/*.json`):
    - id, name, platform(enum: x|threads|blog|youtube), handle, bio
    - opinions: [{text(max 500), source_url, date, topic}]
  - `src/pages/influencers.astro` 생성:
    - 인플루언서 목록 + 각자 최신 의견
    - 주제별 필터링
    - `data-testid="influencer-list"`
  - `src/components/InfluencerCard.astro` 생성
  - 샘플 인플루언서 2명 데이터 생성
  - Decap CMS에서 수동 관리 가능 (T9에서 설정 완료)

  **Must NOT do**:
  - 자동 수집/스크래핑 금지 — 수동 입력 전용
  - 감성 분석 금지
  - 소셜 미디어 임베드 금지 — 소스 링크만

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 4 내)
  - **Parallel Group**: Wave 4
  - **Blocks**: -
  - **Blocked By**: T1, T2, T3

  **Acceptance Criteria**:
  - [ ] `/influencers` 페이지 렌더링
  - [ ] 인플루언서 카드에 이름, 플랫폼, 의견 표시

  **QA Scenarios:**
  ```
  Scenario: 인플루언서 페이지
    Tool: Bash
    Steps:
      1. 샘플 인플루언서 2명 데이터 배치
      2. `bun run build`
      3. `Select-String 'data-testid="influencer-list"' dist/influencers/index.html`
    Expected Result: influencer-list testid 존재
    Evidence: .sisyphus/evidence/task-15-influencer.txt
  ```

  **Commit**: YES (Wave 4 그룹)


- [ ] 16. YouTube oEmbed 컴포넌트

  **What to do**:
  - `src/components/YouTubeEmbed.astro` 생성:
    - YouTube URL 감지 (youtube.com, youtu.be)
    - oEmbed API로 메타데이터 추출 (title, thumbnail, embed HTML)
    - 렌더: 썸네일 + 제목 + lazy iframe embed
    - 삭제/비공개 동영상: 플레이스홀더 표시 ("Video unavailable")
    - `data-testid="youtube-embed"`
  - ArticleCard.astro에서 `type === 'youtube'`일 때 썸네일 표시
  - 빌드 타임에 oEmbed fetch (SSG 시점)

  **Must NOT do**:
  - Vimeo, TikTok 등 다른 플랫폼 임베드 금지
  - YouTube API key 사용 금지 — oEmbed만 (key 불필요)
  - 자동재생 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 컴포넌트 + oEmbed 호출
  - **Skills**: []

  **Parallelization**: Wave 4, Blocked By: T1

  **Acceptance Criteria**:
  - [ ] YouTube URL 기사 → 썸네일 + embed 표시
  - [ ] 유효하지 않은 YouTube URL → 플레이스홀더

  **QA Scenarios:**
  ```
  Scenario: YouTube 임베드
    Tool: Bash
    Steps:
      1. type=youtube 기사 fixture 배치
      2. `bun run build`
      3. 상세 페이지에서 `data-testid="youtube-embed"` 확인
    Expected Result: YouTube 임베드 컴포넌트 존재
    Evidence: .sisyphus/evidence/task-16-youtube.txt
  ```

  **Commit**: YES (Wave 4 그룹)

- [ ] 17. Giscus 댓글 통합

  **What to do**:
  - Giscus GitHub App 설정 가이드 (README에 단계 기록)
  - `src/components/Comments.astro` 생성:
    - Giscus 스크립트 태그 (giscus.app)
    - mapping: pathname
    - theme: preferred_color_scheme
    - `data-testid="comments"`
  - T8의 기사 상세 페이지에 Comments 컴포넌트 삽입
  - CSP 헤더 추가: `frame-src giscus.app`, `script-src giscus.app`
  - `public/_headers`에 Cloudflare Pages CSP 설정

  **Must NOT do**:
  - 커스텀 댓글 시스템 금지
  - 댓글 모더레이션 대시보드 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**: Wave 4, Blocked By: T8

  **Acceptance Criteria**:
  - [ ] 기사 상세 페이지에 Giscus 스크립트 태그 존재
  - [ ] CSP 헤더에 giscus.app 허용

  **QA Scenarios:**
  ```
  Scenario: Giscus 스크립트 태그 확인
    Tool: Bash
    Steps:
      1. `bun run build`
      2. `Select-String 'giscus.app' dist/articles/test-article/index.html`
      3. `Select-String 'giscus.app' dist/_headers` (CSP)
    Expected Result: Giscus 스크립트 + CSP 설정 존재
    Evidence: .sisyphus/evidence/task-17-giscus.txt
  ```

  **Commit**: YES (Wave 4 그룹)

- [ ] 18. SEO (sitemap, robots.txt, OG meta, RSS feed)

  **What to do**:
  - `@astrojs/sitemap` 설치 + 설정
  - `public/robots.txt` 생성: sitemap URL 포함, /admin disallow
  - `src/pages/rss.xml.ts` 생성: `@astrojs/rss`로 기사 피드 생성
  - BaseLayout.astro에 OG meta 슬롯 구현 (title, description, image, type)
  - 각 페이지에 적절한 OG meta 전달

  **Must NOT do**:
  - Google Analytics 금지
  - 구조화 데이터 (JSON-LD) 금지 (Phase 2)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**: Wave 4, Blocked By: T7, T13, T14

  **Acceptance Criteria**:
  - [ ] `/sitemap.xml` 생성 확인
  - [ ] `/rss.xml` 생성 + 유효 RSS XML
  - [ ] `robots.txt`에 sitemap URL + /admin disallow

  **QA Scenarios:**
  ```
  Scenario: SEO 출력 확인
    Tool: Bash
    Steps:
      1. `bun run build`
      2. `Test-Path dist/sitemap-index.xml` → True
      3. `Test-Path dist/rss.xml` → True
      4. `Select-String 'Disallow: /admin' dist/robots.txt`
    Expected Result: sitemap + RSS + robots.txt 모두 존재
    Evidence: .sisyphus/evidence/task-18-seo.txt
  ```

  **Commit**: YES (Wave 4 그룹)

- [ ] 19. localStorage 개인화 (관심사 태그 필터)

  **What to do**:
  - `src/components/PersonalizationBar.astro` + 클라이언트 JS:
    - 초기 설정: 관심 태그 선택 UI (체크박스 목록)
    - localStorage에 `honeycombo_interests` 키로 저장
    - 기사 목록 페이지에서 선택된 태그 기사 우선 정렬 (필터링이 아닌 우선순위)
    - "관심사 설정" 버튼 (nav에 추가)
    - `data-testid="personalization-bar"`
  - 클라이언트 JS만 — 서버 로직 없음

  **Must NOT do**:
  - 조회/클릭 히스토리 추적 금지
  - 추천 엔진 금지
  - 서버 사이드 개인화 금지

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 클라이언트 JS 로직 + localStorage 통합
  - **Skills**: []

  **Parallelization**: Wave 5, Blocked By: T7

  **Acceptance Criteria**:
  - [ ] 관심사 설정 UI 표시
  - [ ] 태그 선택 후 새로고침 → 선택 유지 (localStorage)
  - [ ] 선택된 태그 기사 우선 표시

  **QA Scenarios:**
  ```
  Scenario: localStorage 개인화
    Tool: Playwright
    Steps:
      1. 사이트 접속
      2. "관심사 설정" 클릭
      3. "AI" 태그 선택
      4. 페이지 새로고침
      5. localStorage에서 `honeycombo_interests` 키 확인
      6. "AI" 태그 기사가 상단에 표시되는지 확인
    Expected Result: 태그 선택 유지 + 우선 정렬
    Evidence: .sisyphus/evidence/task-19-personalization.png
  ```

  **Commit**: YES
  - Message: `feat: add personalization, oauth, and production deploy`

- [ ] 20. GitHub OAuth (Cloudflare Pages Functions)

  **What to do**:
  - **Pages Functions** 생성 (`functions/api/auth.ts`):
    - Cloudflare Pages Functions는 `functions/` 디렉토리의 파일을 자동으로 serverless function으로 배포
    - `functions/api/auth.ts` → `https://honeycombo.pages.dev/api/auth` 로 자동 라우팅
    - GitHub OAuth App의 client_secret를 CF Pages 환경변수로 설정 (CF Dashboard)
    - code → access_token 교환 로직 구현
  - Decap CMS backend config에 `auth_endpoint: /api/auth` 연결
  - 별도 wrangler.jsonc 불필요 — Pages Functions는 Git Integration으로 자동 배포
  - 설정 가이드: GitHub OAuth App 생성 + CF Pages 환경변수 설정 단계 문서화

  **Must NOT do**:
  - client_secret를 프론트엔드 코드에 노출 금지
  - 사용자 DB 금지 — 토큰만 관리
  - 세션 저장 금지 — 스테이트리스 OAuth 플로우

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: OAuth 플로우 + Pages Functions 설정 + 보안
  - **Skills**: []

  **Parallelization**: Wave 5, Blocked By: T9

  **Acceptance Criteria**:
  - [ ] `functions/api/auth.ts` 파일 존재
  - [ ] `/api/auth` 엔드포인트 응답 (프로덕션 URL 검증은 T21에서 실행)

  **QA Scenarios:**
  ```
  Scenario: Pages Functions 파일 구조 검증
    Tool: Bash
    Steps:
      1. `Test-Path functions/api/auth.ts` → True
      2. 파일 내용에 `onRequest` 또는 `export` 함수 존재 확인
      3. `bun run build` 성공 (Functions 포함 빌드 오류 없음)
    Expected Result: Pages Functions 파일 존재 + 빌드 성공
    Evidence: .sisyphus/evidence/task-20-oauth-local.txt

  Scenario: OAuth 엔드포인트 프로덕션 검증 (→ T21 배포 후 실행)
    Tool: Bash
    Steps:
      1. `curl -s -o /dev/null -w '%{http_code}' https://honeycombo.pages.dev/api/auth`
      2. HTTP 상태 코드 400 또는 302 확인 (코드 없이 요청이므로)
    Expected Result: 엔드포인트 응답 있음
    Note: 이 시나리오는 T21 배포 완료 후 실행
    Evidence: .sisyphus/evidence/task-20-oauth-prod.txt
  ```

  **Commit**: YES (T19, T21과 묶음)

- [ ] 21. Cloudflare Pages 프로덕션 배포 + 모니터링

  **What to do**:
  - Cloudflare Pages 프로젝트 생성 (Cloudflare Dashboard)
  - GitHub repo 연결 (Git Integration — main branch push 시 자동 빌드/배포)
  - Build settings: command `bun run build`, output `dist/`
  - 환경변수 설정: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (Pages Functions용)
  - `*.pages.dev` URL로 접근 확인
  - Cloudflare Web Analytics 활성화 (내장, 무료)
  - `public/_headers` 최종 확인 (CSP, cache 정책)
  - 모든 페이지 Lighthouse 테스트 (Performance ≥ 90)
  - README.md 업데이트: 프로젝트 설명, 설치 방법, 환경변수 목록

  **Must NOT do**:
  - 커스텀 도메인 설정 금지 (Phase 2)
  - 외부 analytics 금지 (GA 등)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 배포 + 모니터링 + 문서화
  - **Skills**: [`playwright`]
    - `playwright`: Lighthouse 테스트 + 스크린샷

  **Parallelization**: Wave 5, Blocked By: T18, T20

  **Acceptance Criteria**:
  - [ ] `*.pages.dev` URL 접근 가능
  - [ ] 모든 페이지 200 OK
  - [ ] Lighthouse Performance ≥ 90
  - [ ] Cloudflare Analytics 활성화

  **QA Scenarios:**
  ```
  Scenario: 프로덕션 사이트 검증
    Tool: Playwright
    Steps:
      1. https://honeycombo.pages.dev/ 접속
      2. 네비게이션 모든 링크 클릭 → 200 OK 확인
      3. /articles → article-list testid 확인
      4. /trending → trending-list testid 확인
      5. /playlists → playlist-list testid 확인
      6. /influencers → influencer-list testid 확인
      7. /must-read → must-read-list testid 확인
      8. /rss.xml → XML content-type 확인
      9. /sitemap-index.xml → XML content-type 확인
      10. Lighthouse 검사: Performance ≥ 90
    Expected Result: 모든 페이지 정상 + Lighthouse 통과
    Evidence: .sisyphus/evidence/task-21-production.png

  Scenario: 404 페이지 확인
    Tool: Bash
    Steps:
      1. `curl -s -o /dev/null -w '%{http_code}' https://honeycombo.pages.dev/nonexistent`
      2. HTTP 404 확인
    Expected Result: 404 반환
    Evidence: .sisyphus/evidence/task-21-404.txt
  ```

  **Commit**: YES
  - Message: `feat: add personalization, oauth, and production deploy`
  - Pre-commit: `bun run build; bun test`

---
## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `bun run build` + `bun test`. Review all files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp), unnecessary factory patterns.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (RSS articles in trending, submission in moderation queue). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Wave | Commit | Files | Pre-commit |
|------|--------|-------|------------|
| 1 | `chore: scaffold astro project with schemas and CI` | T1-T5 전체 | `bun run build; bun run validate` |
| 2 | `feat: add RSS pipeline and article pages` | T6-T8 | `bun run build; bun test` |
| 2 | `feat: add Decap CMS admin interface` | T9 | `bun run build` |
| 3 | `feat: add submission pipeline and moderation` | T10-T11 | `bun test` |
| 3 | `feat: add trending ranking and must-read` | T12-T13 | `bun run build; bun test` |
| 4 | `feat: add playlists, influencers, youtube, comments, seo` | T14-T18 | `bun run build; bun test` |
| 5 | `feat: add personalization, oauth, and production deploy` | T19-T21 | `bun run build; bun test` |

---

## Success Criteria

### Verification Commands
```bash
bun run build              # Expected: exit 0, no errors
bun run validate           # Expected: "All content valid" 
bun test                   # Expected: all tests pass
curl -s https://honeycombo.pages.dev/ | Select-String 'data-testid="article-list"'  # Expected: match
curl -s https://honeycombo.pages.dev/trending | Select-String 'data-testid="trending-list"'  # Expected: match
gh workflow run rss-collect.yml --ref main  # Expected: successful run
gh workflow run trending-calc.yml --ref main  # Expected: successful run
```

### Final Checklist
- [ ] All "Must Have" present and functional
- [ ] All "Must NOT Have" absent (codebase search confirms)
- [ ] All Vitest tests pass
- [ ] Lighthouse Performance ≥ 90 on all pages
- [ ] RSS 수집 워크플로우 정상 작동
- [ ] 사용자 제출 → 모더레이션 → 게시 파이프라인 정상
- [ ] 트렌드 랭킹 계산 및 표시 정상
- [ ] Cloudflare Pages 라이브 배포 완료
