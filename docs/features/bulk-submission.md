# 대량 제출 (bulk submission)

> 하나의 GitHub Issue로 여러 URL을 독립적으로 등록하는 제출 자동화 기능.

## 개요

기존 제출 자동화는 단건 링크만 처리할 수 있어 여러 자료를 한꺼번에 제보할 때 Issue를 반복 생성해야 했다. bulk submission은 `submission` 워크플로우와 기존 검증 규칙을 유지하면서, 한 Issue 안의 여러 항목을 각각 독립적으로 검증·생성해 일부 실패가 있어도 유효한 항목은 계속 PR로 이어지게 한다.

## 동작 흐름

```text
GitHub bulk Issue → scripts/process-submission.ts(parseBulkIssueBody/processBulkSubmission) → 항목별 검증/JSON 생성 → PR 생성
```

- Issue 템플릿 `.github/ISSUE_TEMPLATE/submit-bulk.yml` 에서 다음 두 포맷 중 하나로 줄 목록을 수집한다.
  - v1 (legacy, 4컬럼): `URL | 유형 | 태그 | 요약`
  - v2 (title 추가, 5컬럼): `URL | 유형 | 제목 | 태그 | 요약`
  - **태그는 영어로, 제목·요약은 한국어로 작성한다.**
  - 제목과 요약에는 어떠한 경우에도 `|`, 탭, CR/LF를 포함할 수 없다 (컬럼 구분자 충돌).
- `parseBulkIssueBody` 는 `|` 기준 분할 목 수를 세어 5개 이상이면 3번째 필드를 제목으로 읽고, 4개면 기존 레거시 포맷으로 처리한다 (backward compatible).
- `processBulkSubmission` 는 bulk URL index를 1회만 로드해 항목별 중복 조회 비용을 줄인다.
- Title 해석은 `resolveSubmissionTitle` 헬퍼를 통해 `parsed.title` → oEmbed title → `deriveShortTitle(note)` → URL hostname 순서로 fallback한다.
- 워크플로우 `.github/workflows/process-submission.yml` 가 `bulk` 라벨을 환경변수로 전달하고, 실패 항목이 있으면 `bulk-result.json` 을 기준으로 상세 댓글을 upsert한다 (동일 Issue 재처리 시 중복 방지).

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
- **부분 실패는 허용되며 exit 0을 반환**한다. 전부 실패해야 exit 1이 되며, 이 경우에만 `Comment on failure` 스텝이 일반 실패 댓글을 남긴다. 부분 실패는 `Report bulk submission results` 스텝이 상세 댓글을 upsert한다.
- **태그는 반드시 영어로 작성한다.** 제목과 요약은 한국어로 작성한다. 유형(`기사`, `YouTube` 등)은 시스템 값이므로 한국어 그대로 사용한다.
- Title fallback은 `deriveShortTitle`이 title과 description 간 거의 같은 내용(title=description 중복)이 될 위험이 있을 때 null을 반환하고, 그 경우 URL hostname으로 최종 fallback한다.

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [AI 에이전트 제출 가이드](../guides/agent-submission.md)
- [Title≐Description 중복 트러블슈팅](../troubleshooting/bulk-title-description-overlap.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
| 2026-04-13 | 영어 작성 요구사항 추가 |
| 2026-04-20 | 요약 한국어 전환 반영 |
| 2026-04-21 | 5컬럼 제목 포맷, `bulk-result.json` 기반 상세 실패 댓글 upsert, URL index 재사용 추가 |
