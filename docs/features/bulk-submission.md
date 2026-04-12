# 대량 제출 (bulk submission)

> 하나의 GitHub Issue로 여러 URL을 독립적으로 등록하는 제출 자동화 기능.

## 개요

기존 제출 자동화는 단건 링크만 처리할 수 있어 여러 자료를 한꺼번에 제보할 때 Issue를 반복 생성해야 했다. bulk submission은 `submission` 워크플로우와 기존 검증 규칙을 유지하면서, 한 Issue 안의 여러 항목을 각각 독립적으로 검증·생성해 일부 실패가 있어도 유효한 항목은 계속 PR로 이어지게 한다.

## 동작 흐름

```text
GitHub bulk Issue → scripts/process-submission.ts(parseBulkIssueBody/processBulkSubmission) → 항목별 검증/JSON 생성 → PR 생성
```

- Issue 템플릿 `.github/ISSUE_TEMPLATE/submit-bulk.yml` 에서 `URL | 유형 | 태그 | 한줄소개` 형식의 줄 목록을 수집한다.
- 워크플로우 `.github/workflows/process-submission.yml` 가 `bulk` 라벨을 환경변수로 전달한다.
- `scripts/process-submission.ts` 는 bulk 여부를 감지해 각 줄을 독립 처리한다.
- URL 오류·중복·스팸이 일부 항목에서 발생해도 나머지 성공 항목은 `src/content/curated/` JSON으로 생성한다.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `.github/ISSUE_TEMPLATE/submit-bulk.yml` | 대량 제출용 GitHub Issue 템플릿 |
| `.github/workflows/process-submission.yml` | bulk 라벨 전달, PR 제목 분기 |
| `scripts/process-submission.ts` | bulk 파싱/처리 로직 |
| `tests/process-submission.test.ts` | bulk 파싱 및 부분 실패 회귀 테스트 |
| `tests/fixtures/bulk-issue.json` | 전체 성공 bulk 픽스처 |
| `tests/fixtures/bulk-issue-partial.json` | 부분 실패 bulk 픽스처 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `ISSUE_LABELS` | GitHub Actions env / `scripts/process-submission.ts` | `''` | 쉼표 구분 라벨 문자열. `bulk` 포함 시 대량 제출 모드 활성화 |

## 제약 사항

- bulk 파싱은 최대 20개 항목까지만 처리한다.
- 각 항목은 기존 단건과 동일한 스팸·중복·YouTube oEmbed 규칙을 따른다.
- 부분 실패는 허용되지만, 전부 실패하면 스크립트는 종료 코드 1을 반환한다.

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
