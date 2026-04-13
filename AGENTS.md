# HoneyCombo — Agent Guidelines

## Git Workflow

- **작업 완료 후 반드시 커밋 & 푸시한다.** 모든 구현/수정 작업이 끝나면 변경 사항을 커밋하고 원격 저장소에 푸시한다.
- 커밋 메시지는 conventional commits 형식을 따른다 (`feat:`, `fix:`, `chore:`, `docs:` 등).
- 관련 없는 변경 사항은 별도 커밋으로 분리한다.

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
