# HoneyCombo 개발 문서화 지침

> 이 디렉토리는 프로젝트의 **개발 memory**입니다.
> 모든 설계 결정, 기능 명세, 트러블슈팅 기록을 여기에 남겨 미래의 개발자(사람·AI 모두)가 맥락을 빠르게 파악할 수 있도록 합니다.

---

## 디렉토리 구조

```
docs/
├── README.md                  # 이 파일 — 문서화 규칙과 색인
├── _templates/                # 문서 유형별 템플릿
│   ├── feature.md
│   ├── decision.md
│   └── troubleshooting.md
├── architecture/              # 시스템 설계
│   └── overview.md            # 전체 아키텍처 개요
├── decisions/                 # ADR (Architecture Decision Records)
│   └── 0001-initial-tech-stack.md
├── features/                  # 기능별 상세 문서
├── guides/                    # 개발/운영 가이드
└── troubleshooting/           # 문제 해결 기록
```

---

## 1. 문서 작성 원칙

### 1.1 언제 문서를 작성하는가

| 시점 | 필수 작성 문서 |
|------|---------------|
| 새 기능 개발 시작 전 | `features/{기능명}.md` |
| 기술 선택·설계 결정 시 | `decisions/NNNN-{제목}.md` |
| 버그 해결 후 | `troubleshooting/{주제}.md` (재발 가능성 있을 때) |
| 아키텍처 변경 시 | `architecture/overview.md` 업데이트 |
| 외부 서비스 연동 시 | `guides/{서비스명}-integration.md` |

### 1.2 어떻게 쓰는가

1. **WHY 우선**: "무엇을 했는가"보다 "왜 이렇게 했는가"를 먼저 쓴다.
2. **코드 경로 명시**: 관련 파일 경로를 반드시 포함한다. (`src/lib/rss.ts` 등)
3. **검색 가능하게**: 제목과 헤딩에 핵심 키워드를 포함한다.
4. **간결하게**: 한 문서가 200줄을 넘기면 분리를 고려한다.
5. **한국어 기본**: 프로젝트 기본 언어는 한국어. 코드·라이브러리명은 영문 그대로 사용.

### 1.3 파일 명명 규칙

- 소문자 kebab-case: `rss-collector.md`, `cloudflare-pages-deploy.md`
- ADR은 4자리 번호 접두사: `0001-`, `0002-`, ...
- 날짜가 중요한 문서: `YYYY-MM-DD-` 접두사 가능

---

## 2. 문서 유형별 가이드

### 2.1 기능 문서 (`features/`)

기능의 목적, 동작 방식, 관련 코드를 기록한다.

**필수 섹션:**
- 개요 (한 줄 설명)
- 동작 흐름 (입력 → 처리 → 출력)
- 관련 파일
- 설정값/환경변수
- 제약 사항

→ 템플릿: [`_templates/feature.md`](./_templates/feature.md)

### 2.2 설계 결정 기록 (`decisions/`)

"왜 A 대신 B를 선택했는가"를 기록한다. ADR(Architecture Decision Record) 형식.

**필수 섹션:**
- 상태 (제안 / 승인 / 폐기 / 대체됨)
- 맥락 (어떤 문제 상황이었는가)
- 결정 (무엇을 선택했는가)
- 고려한 대안
- 결과 (이 결정이 가져온 영향)

→ 템플릿: [`_templates/decision.md`](./_templates/decision.md)

### 2.3 트러블슈팅 (`troubleshooting/`)

재발 가능성이 있는 문제의 진단·해결 과정을 기록한다.

**필수 섹션:**
- 증상 (에러 메시지, 재현 조건)
- 원인
- 해결 방법
- 관련 파일

→ 템플릿: [`_templates/troubleshooting.md`](./_templates/troubleshooting.md)

### 2.4 아키텍처 문서 (`architecture/`)

시스템 전체 구조와 모듈 간 관계를 기록한다.

- `overview.md`는 항상 현재 상태를 반영해야 한다.
- 변경 시 하단 변경 이력 섹션에 날짜와 변경 내용을 추가한다.

### 2.5 가이드 (`guides/`)

특정 작업 수행 방법을 단계별로 기록한다. (배포, 연동, 설정 등)

---

## 3. AI 에이전트를 위한 규칙

이 문서 체계는 AI 에이전트가 개발 맥락을 빠르게 파악하는 데 최적화되어 있다.

### 3.1 에이전트가 참조해야 할 문서 (우선순위)

1. `docs/architecture/overview.md` — 전체 구조 파악
2. `docs/decisions/` — 설계 배경 이해
3. `docs/features/` — 수정 대상 기능의 상세 동작
4. `docs/troubleshooting/` — 과거 유사 문제 확인

### 3.2 에이전트가 문서를 업데이트해야 할 때

| 작업 | 업데이트 대상 |
|------|-------------|
| 새 기능 구현 완료 | `features/` 신규 작성, `architecture/overview.md` 반영 |
| 기존 기능 수정 | 해당 `features/*.md` 업데이트 |
| 기술 스택 변경 | `decisions/` 신규 작성, `architecture/overview.md` 반영 |
| 버그 수정 (비자명) | `troubleshooting/` 신규 작성 |
| 환경 설정 변경 | 해당 `guides/*.md` 업데이트 |

### 3.3 문서 작성 시 지켜야 할 형식

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

---

## 4. 문서 유지보수

### 4.1 정기 점검

- 기능이 삭제/대체되면 관련 문서에 `[폐기됨]` 태그를 추가한다.
- 분기별로 `docs/` 전체를 훑어 오래된 내용을 갱신한다.

### 4.2 문서와 코드의 동기화

문서에 명시된 파일 경로가 실제로 존재하는지 확인한다.
파일이 이동/삭제되면 문서의 경로도 함께 수정한다.

---

## 빠른 참조: "어디에 써야 하지?"

```
새 기능 만들었다        → docs/features/
왜 이렇게 했는지 남기고 싶다 → docs/decisions/
버그 잡는 데 삽질했다     → docs/troubleshooting/
시스템 구조가 바뀌었다    → docs/architecture/
설정/배포 방법 정리      → docs/guides/
```
