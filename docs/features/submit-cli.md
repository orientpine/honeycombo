# 제출 CLI 래퍼

> AI 에이전트가 `gh` CLI로 단건/대량 자료 제출 Issue를 쉽게 생성하도록 돕는 Bun 스크립트.

## 개요

터미널 기반 에이전트가 브라우저 없이도 HoneyCombo 제출 워크플로우를 호출할 수 있어야 했다. `scripts/submit-cli.ts`는 입력 형식을 고정해 `gh issue create` 호출을 단순화하고, dry-run/대량 제출/기본 에러 메시지를 제공해 제출 자동화 진입점을 안정적으로 만든다.

## 동작 흐름

```text
CLI 인자 → scripts/submit-cli.ts 파싱/검증 → gh issue create → GitHub Issue 생성
```

- 단건 모드는 `URL / 유형 / 태그 / 한줄 소개`를 템플릿 본문으로 변환한다.
- 대량 모드는 파이프 구분 파일을 읽어 `### 링크 목록` 본문으로 단일 bulk Issue를 만든다.
- `--dry-run` 사용 시 실제 실행 대신 최종 `gh` 명령만 출력한다.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/submit-cli.ts` | 제출용 `gh issue create` 래퍼 CLI |
| `scripts/process-submission.ts` | 생성된 submission Issue를 실제 콘텐츠 처리로 연결 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `repo` | `scripts/submit-cli.ts` | `orientpine/honeycombo` | Issue를 생성할 대상 GitHub 저장소 |
| `MAX_BULK_ITEMS` | `scripts/submit-cli.ts` | `20` | 대량 제출 시 한 번에 허용할 최대 줄 수 |

## 제약 사항

- `gh auth status`가 통과해야 실제 실행이 가능하다.
- 대량 제출은 빈 줄/주석 줄(`#`)을 제외하고 최대 20개 항목만 포함한다.
- 태그는 최대 5개까지만 본문에 포함한다.

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [대량 제출 (bulk submission)](./bulk-submission.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
