# 기사 승인 시 플레이리스트 자동 추가

> 승인된 제출 기사를 제출자 플레이리스트에 자동 반영하고, 미가입 제출자는 deferred submission으로 보관하는 기능.

## 개요

제출 자동화는 GitHub Issue 작성자 정보를 콘텐츠 JSON에 남기지만, 승인 이후 사용자의 플레이리스트와 연결되는 서버 흐름이 필요했다. 이 기능은 승인/삭제 webhook을 통해 승인된 curated 기사를 제출자 플레이리스트에 자동 추가하고, 아직 D1 사용자 레코드가 없는 제출자는 `submissions` 테이블에 보관해 이후 catch-up sync를 가능하게 한다.

## 동작 흐름

```text
GitHub Issue → scripts/process-submission.ts → submitted_by_id 저장
PR merge 이벤트 (새 파일 감지) → functions/webhooks/submission-approved.ts
          → users.id 조회
          → 최근 플레이리스트 재사용 또는 `내 제출 기사` 자동 생성
          → playlist_items 추가
미가입 사용자 → submissions INSERT OR IGNORE
최초 로그인 → functions/api/auth/github/callback.ts
          → submissions WHERE synced_to_playlist = 0 조회
          → 최근 플레이리스트 재사용 또는 `내 제출 기사` 자동 생성
          → playlist_items 추가 후 synced_to_playlist = 1 업데이트
삭제 이벤트 → functions/webhooks/submission-removed.ts
          → playlist_items / submissions 정리
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/process-submission.ts` | 제출 콘텐츠에 `submitted_by_id` 저장 |
| `.github/workflows/process-submission.yml` | Issue user id를 스크립트 env로 전달 |
| `functions/lib/webhooks.ts` | Bearer webhook secret 상수 시간 비교 검증 |
| `functions/lib/playlists.ts` | 최근 플레이리스트 재사용 / 자동 플레이리스트 생성 |
| `functions/api/auth/github/callback.ts` | OAuth 로그인 직후 deferred submissions catch-up |
| `functions/webhooks/submission-approved.ts` | 신규 파일 추가 감지 시 auto-playlist 반영 |
| `functions/webhooks/submission-removed.ts` | 승인 취소/삭제 시 정리 |
| `migrations/0004_auto_playlist.sql` | `is_auto_created`, `submissions` 스키마 |

## 설정값

| 이름 | 위치 | 타입 | 설명 |
|------|------|------|------|
| `WEBHOOK_SECRET` | Cloudflare Pages 환경변수 (Encrypt) + GitHub Actions Secret | Secret | webhook Bearer 토큰 검증용 shared secret. 양쪽 동일한 값 필요 |
| `SITE_URL` | GitHub Actions Variable | Variable | 배포된 사이트 URL (예: `https://honeycombo.pages.dev`). 워크플로우에서 webhook 호출 시 사용 |
| `ISSUE_USER_ID` | GitHub Actions env (워크플로우 내부) | 자동 | 제출 Issue 작성자의 GitHub numeric id. 워크플로우가 자동 설정 |

## 제약 사항

- webhook은 `Authorization: Bearer {token}` 헤더가 없거나 secret이 불일치하면 `401`을 반환한다.
- 자동 생성 플레이리스트는 `visibility: 'unlisted'`, `status: 'draft'`, `playlist_type: 'community'`, `is_auto_created = 1`로 생성된다.
- 이미 같은 curated 기사가 들어 있으면 `already_exists`로 응답하고 중복 삽입하지 않는다.
- 미가입 사용자는 즉시 플레이리스트에 반영하지 않고 `submissions` 테이블에 deferred 상태로 저장한다.
- catch-up 실패는 로그인 자체를 막지 않으며, `DuplicateItemError`를 제외한 오류만 로깅한다.

- `public/_routes.json`의 `include`에 `/webhooks/*`가 포함되어야 Cloudflare Pages Functions로 라우팅된다.
---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [플레이리스트](./playlists.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 |
| 2026-04-13 | Wave 4: OAuth callback catch-up과 `synced_to_playlist` 갱신 흐름 반영 |
| 2026-04-13 | 환경변수 설정 가이드 보강 (WEBHOOK_SECRET, SITE_URL), _routes.json 제약 추가 |
| 2026-04-13 | merge=approval 전환: status 변경 감지 → 신규 파일 추가 감지로 webhook 트리거 변경 |
