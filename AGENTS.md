# HoneyCombo — Agent Guidelines

## Git Workflow

- **작업 완료 후 반드시 커밋 & 푸시한다.** 모든 구현/수정 작업이 끝나면 변경 사항을 커밋하고 원격 저장소에 푸시한다.
- 커밋 메시지는 conventional commits 형식을 따른다 (`feat:`, `fix:`, `chore:`, `docs:` 등).
- 관련 없는 변경 사항은 별도 커밋으로 분리한다.

### 관리자 PR 자동 머지 (필수)

> **관리자(개발자)가 직접 생성하는 모든 PR은 생성 직후 auto-merge를 활성화한다.** master 브랜치는 Repository Ruleset(`ruleset_id: 15005022`)으로 보호되어 있어 `ci` status check 통과가 필수이므로, auto-merge를 미리 켜두면 CI 통과 즉시 자동으로 머지된다.

**PR 생성 직후 반드시 실행**:

```bash
gh pr merge <PR_NUMBER> --auto --squash --delete-branch
```

- `--auto`: CI 통과 시 자동 머지
- `--squash`: squash merge (커밋 히스토리 깔끔하게 유지)
- `--delete-branch`: 머지 후 원격 브랜치 자동 삭제

**적용 범위 — 이 규칙은 다음 모든 PR에 적용된다**:

- 코드 수정 (`src/`, `functions/`, `scripts/`, `public/` 등)
- 문서 수정 (`docs/`, `AGENTS.md`, `README.md` 등)
- 설정 변경 (`.github/`, `astro.config.mjs`, `package.json` 등)
- 기능 추가 / 리팩토링 / hotfix / chore — 타입 무관

**유일한 예외**: `.github/workflows/process-submission.yml`이 bot 계정으로 생성하는 **issue 기반 submission PR**. 해당 워크플로우의 `Auto-merge if editor` 스텝(line 151-177)이 editor 계정 한정으로 이미 `gh pr merge --merge --auto`를 실행하므로 사람이 추가 조치할 필요 없음.

**Draft PR**: Ready for Review로 전환한 뒤 위 명령을 실행한다. Draft 상태에서는 `--auto` 플래그가 거부된다.

**왜 필요한가**: master는 보호되어 있어 CI 통과 후에도 **사람이 수동으로 머지 버튼을 눌러야** 한다. 관리자 본인이 만든 PR을 본인이 지켜보며 기다릴 이유가 없으므로, CI 통과 즉시 자동 반영되도록 PR 생성 직후 auto-merge를 반드시 켜둔다. 이 단계를 빠뜨리면 본인 PR이 CI 통과 후에도 방치되어 피드백 루프가 늘어진다.

## 배포 (Cloudflare Pages)

- **즉시 배포 요청 시**: Cloudflare Pages GitHub App 연동은 짧은 시간 내 다수 push 시 이벤트를 놓치는 경우가 있다. 사용자가 "즉시 배포", "지금 반영" 등을 요청하면 wrangler CLI로 직접 배포한다.

```bash
bun run build
npx wrangler pages deploy dist --project-name=honeycombo --branch=master
```

- `--branch=master` 옵션이 있어야 Production 배포로 인식된다.
- 상세 트러블슈팅: `docs/troubleshooting/cloudflare-pages-auto-deploy-failure.md` 참조.

## 문서화 (docs/) — 개발 메모리

> **목적**: 버그·기능 작업의 중복 방지. 과거 맥락을 빠르게 파악하여 같은 실수를 반복하지 않는다.
> 상세 규칙은 [`docs/README.md`](./docs/README.md) 참조.

### 작업 시작 전 — 반드시 읽기

1. `docs/architecture/overview.md` — 전체 구조 파악
2. `docs/decisions/` — 설계 배경 이해 (이미 검토·기각된 대안 재시도 방지)
3. `docs/features/` — 수정 대상 기능의 기존 명세 확인 (중복 구현 방지)
4. `docs/troubleshooting/` — 과거 유사 문제·해결 기록 확인 (중복 디버깅 방지)

**새 기능 개발 시**: 시작 전에 `docs/features/{기능명}.md`를 먼저 작성한다. (목적·범위 정의 → 중복 구현 사전 차단)

### 작업 완료 후 — 반드시 업데이트

| 작업 유형 | 업데이트 대상 |
|-----------|-------------|
| 새 기능 구현 | `docs/features/{기능명}.md` 신규 작성 + `docs/architecture/overview.md` 반영 |
| 기존 기능 수정 | 해당 `docs/features/*.md` 업데이트 |
| 기술 스택 변경 | `docs/decisions/NNNN-{제목}.md` 신규 작성 + `docs/architecture/overview.md` 반영 |
| 버그 수정 (비자명) | `docs/troubleshooting/{주제}.md` 신규 작성 |
| 환경 설정 변경 | 해당 `docs/guides/*.md` 업데이트 |

### 문서 작성 원칙

- **WHY 우선**: "왜 이렇게 했는가"를 먼저 쓴다.
- **코드 경로 명시**: 관련 파일 경로를 반드시 포함한다.
- **템플릿 사용**: `docs/_templates/` 의 템플릿을 기반으로 작성한다.
- **한국어 기본**: 코드·라이브러리명은 영문 그대로 사용.

### 문서 필수 형식

모든 문서는 아래 구조를 포함해야 한다:

```markdown
# 제목

> 한 줄 요약

## 본문 섹션들...

---

## 관련 문서

- [링크](../path/to/related.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| YYYY-MM-DD | 최초 작성 |
```

## CI 통과 체크리스트 (필수)

> **master 브랜치는 보호되어 있다.** PR의 CI가 통과해야만 머지할 수 있으므로, 푸시 전에 반드시 아래 검증을 로컬에서 모두 통과시켜야 한다.

### CI 파이프라인 (`.github/workflows/ci.yml`)

CI는 아래 5단계를 **순서대로** 실행한다. 하나라도 실패하면 PR 머지가 차단된다.

| 단계 | 명령어 | 검증 내용 |
|------|--------|----------|
| 1. 콘텐츠 검증 | `bun run validate` | JSON 스키마, 필수 필드 확인 |
| 2. 문서 형식 검증 | `bun run validate:docs` | `docs/` 내 모든 마크다운 필수 섹션 확인 |
| 3. 문서 커버리지 검증 | `bun run validate:docs -- --check-coverage` | 코드 변경 시 `docs/` 변경 동반 여부 확인 |
| 4. 빌드 | `bun run build` | Astro SSG 빌드 성공 여부 |
| 5. 테스트 | `bun run test` | Vitest 테스트 통과 여부 |

### 푸시 전 로컬 검증 (복사해서 실행)

```bash
bun run validate && bun run validate:docs && bun run validate:docs -- --check-coverage && bun run build && bun run test
```

### 자주 실패하는 원인과 해결법

#### 1. 문서 커버리지 실패 (`--check-coverage`)

**원인**: `src/`, `functions/`, `scripts/` 파일을 변경했는데 `docs/` 파일 변경이 없음.

**해결**: 코드를 변경할 때 반드시 `docs/` 문서도 함께 커밋한다.

| 코드 변경 유형 | 필요한 docs 변경 |
|---------------|----------------|
| 버그 수정 | `docs/troubleshooting/{주제}.md` 신규 작성 |
| 기능 추가/수정 | `docs/features/{기능명}.md` 작성 또는 업데이트 |
| 설계 변경 | `docs/decisions/NNNN-{제목}.md` 신규 작성 |

**예외 디렉토리** (변경해도 docs 불필요): `src/data/feeds/`, `src/data/trending/`, `src/content/curated/`

#### 2. 문서 형식 실패 (`validate:docs`)

**원인**: `docs/` 내 마크다운 파일에 필수 섹션 누락.

**모든 문서 공통 필수 섹션:**
- `# 제목` (첫 줄)
- `> 한 줄 요약` (제목 바로 다음)
- `## 관련 문서`
- `## 변경 이력`

**문서 유형별 추가 필수 섹션:**

| 유형 (`docs/` 하위 경로) | 추가 필수 섹션 |
|------------------------|--------------|
| `features/` | 개요, 동작 흐름, 관련 파일, 설정값, 제약 사항 |
| `decisions/` | 맥락, 결정, 고려한 대안, 결과 + 상태 키워드(제안/승인/폐기/대체됨) |
| `troubleshooting/` | 증상, 원인, 해결 방법, 관련 파일 |

**해결**: `docs/_templates/` 의 템플릿을 기반으로 작성하면 누락을 방지할 수 있다.

## UI 디자인 원칙 — DESIGN.md가 Single Source of Truth

> **본 프로젝트의 모든 UI 작업은 [`DESIGN.md`](./DESIGN.md)의 지침을 따른다.** DESIGN.md는 색상·타이포그래피·간격·컴포넌트·레이아웃·그림자·반응형·금지 사항을 모두 정의한 단일 소스(Single Source of Truth)다. 이 섹션은 DESIGN.md를 **언제·어떻게 참조/수정하는지**에 대한 운영 규칙이다.

### UI 작업 필수 플로우 (NON-NEGOTIABLE)

UI 관련 파일(Astro 컴포넌트 `<style>`, `src/styles/*.css`, 레이아웃, 페이지의 스타일 블록)을 건드리는 모든 작업은 아래 순서를 **반드시** 따른다.

| 순서 | 행동 | 이유 |
|------|------|------|
| 1 | [`DESIGN.md`](./DESIGN.md)를 **처음부터 끝까지** 읽는다 | 기존 토큰·패턴·금지 사항 숙지. 회색 버튼·부족한 여백 등 AI-slop 방지. |
| 2 | 필요한 토큰/컴포넌트 패턴이 이미 있는지 확인한다 | 중복 정의 방지. 기존 패턴이 있으면 그대로 재사용. |
| 3-A | 기존 토큰·패턴으로 100% 커버되면 → 바로 구현 | DESIGN.md 수정 불필요. |
| 3-B | 새 토큰/색/간격/컴포넌트 패턴이 필요하면 → **먼저 [`DESIGN.md`](./DESIGN.md)를 편집하고, `src/styles/global.css`에 토큰을 추가한 뒤** 구현한다 | DESIGN.md와 실제 코드의 진실이 어긋나면 문서가 무의미해진다. 반드시 문서 먼저. |
| 4 | PR 제출 전 DESIGN.md §9의 "UI 작업 셀프 체크리스트"를 완주 | `var(--*)` 토큰만 사용했는지, hover/focus/disabled 정의됐는지 등. |

**요약: 문서 → 토큰 → 구현. 절대로 구현부터 시작하지 않는다.**

### DESIGN.md 수정이 필요한 대표 상황

- 새 색상이 필요함 (예: warning yellow, info blue)
- 새 간격 단계가 필요함 (예: `--space-3xl`)
- 새 컴포넌트 타입을 도입 (예: Modal, Toast, Tabs)
- 새 그림자 레벨이 필요함 (예: `--shadow-lg`)
- 새 브레이크포인트 도입 (예: tablet 중간값)
- 다크 모드 추가
- 새 폰트 도입

위 상황에서 DESIGN.md를 건너뛰고 코드만 수정하면 ― **PR 리뷰에서 차단된다.**

### UI agent에게 작업을 위임할 때

Agent에게 UI 작업을 지시할 때는 반드시 [`DESIGN.md §9 Agent Prompt Guide`](./DESIGN.md#9-agent-prompt-guide)의 "즉시 사용 가능한 Agent Prompt 템플릿" 블록을 프롬프트에 포함한다. 그래야 agent가 회색 버튼, 부족한 마진, 하드코딩된 HEX 같은 AI-slop을 만들지 않는다.

### 금지 사항 (요약 — 상세는 [`DESIGN.md §7`](./DESIGN.md#7-dos-and-donts))

- 회색 버튼 / 중립 회색 배경 카드 금지 — primary는 항상 warm orange `#F57C22`.
- HEX·px 하드코딩 금지 — 모든 값은 `var(--*)` 토큰 사용.
- `!important` 금지.
- Hover/focus-visible/disabled 상태 없는 interactive 요소 금지.
- `linear` easing 금지 — `cubic-bezier` 또는 `ease-out` (0.15s~0.2s).
- 섹션 간 여백 `--space-xl`(32px) 미만으로 축소 금지.
- DESIGN.md에 등록되지 않은 새 색/폰트/그림자 임의 도입 금지.
