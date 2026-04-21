# 0006. 자동 플레이리스트 추가 제거 및 기사 관리 페이지 도입

> 기사 제출 시 자동 플레이리스트 추가를 제거하고, 사용자가 직접 기사를 플레이리스트에 배정하는 `/my/articles` 페이지를 신설한다.

## 상태

승인 (2026-04-21)

## 맥락

기존 동작:
- 사용자가 기사를 제출하면 webhook(`functions/webhooks/submission-approved.ts`)이 자동으로 사용자의 가장 최근 플레이리스트에 기사를 추가.
- 플레이리스트가 없는 사용자에게는 "내 제출 기사" 플레이리스트를 자동 생성 (`is_auto_created=1`, unlisted, draft).
- OAuth 콜백(`functions/api/auth/github/callback.ts`)은 첫 로그인 시 `submissions` 테이블의 pending 기사를 catch-up sync로 플레이리스트에 추가.

문제점:
- 사용자가 어느 플레이리스트에 기사가 들어갈지 선택 불가.
- "최근 플레이리스트"가 사용자 의도와 다른 경우 오배정 발생.
- 자동 플레이리스트 이름("내 제출 기사")이 사용자 의도와 무관.

## 결정

1. `submission-approved.ts`의 자동 플레이리스트 추가 로직 제거. 대신 `submissions` 테이블에 항상 upsert (사용자 로그인 여부 무관).
2. `github/callback.ts`의 catch-up sync 로직 제거.
3. 새 페이지 `/my/articles` 도입. 미배정/배정된 두 탭으로 기사 관리.
4. `submissions` 테이블의 역할을 "deferred pending"에서 "사용자 제출 기사의 canonical registry"로 재정의.
5. 기존 자동 생성 플레이리스트 및 자동 추가된 `playlist_items` 레코드는 삭제하지 않고 유지 (사용자가 직접 제거 선택).
6. 과거 기사는 `scripts/backfill-submissions.ts`로 `submissions` 테이블에 백필.

## 고려한 대안

- **대안 1: 자동 추가 유지 + 수동 오버라이드 UI 추가** → 거부. UX 이중화로 혼란 증가, 여전히 초기 배정이 불투명.
- **대안 2: 자동 추가를 "제거 전용" UI로만 보완** → 거부. "잘못된 플레이리스트" 문제 미해결.
- **대안 3: 기사 관리용 새 D1 테이블 신설** → 거부. `submissions` 테이블이 이미 필요한 스키마(article_id, submitted_by_id, title, url)를 보유.

## 결과

- 사용자가 기사 배정을 완전히 제어.
- 과거 기사는 backfill을 통해 신규 페이지에 즉시 노출.
- 기존 자동 플레이리스트는 그대로 유지되어 사용자 데이터 손실 없음.
- `submissions.synced_to_playlist` 컬럼은 유지하되 새 의미(현재 어느 플레이리스트에도 속하지 않음)로 재해석 가능. V1에서는 실질적으로 미사용(향후 사용 여지).

## 관련 문서

- [기사 관리 페이지](../features/article-management.md)
- [자동 플레이리스트 추가 (deprecated)](../features/auto-playlist-add.md)
- [플레이리스트 시스템](../features/playlists.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성. 승인. |
