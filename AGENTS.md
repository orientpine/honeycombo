# HoneyCombo — Agent Guidelines

## Git Workflow

- **작업 완료 후 반드시 커밋 & 푸시한다.** 모든 구현/수정 작업이 끝나면 변경 사항을 커밋하고 원격 저장소에 푸시한다.
- 커밋 메시지는 conventional commits 형식을 따른다 (`feat:`, `fix:`, `chore:`, `docs:` 등).
- 관련 없는 변경 사항은 별도 커밋으로 분리한다.

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
