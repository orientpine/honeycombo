# 플레이리스트 공개 승인 기능 미작동

> 공개 신청 기능의 3가지 버그로 인해 플레이리스트가 `/playlists/`에 공개되지 않는 문제

## 증상

- 사용자가 "공개 목록" 옵션으로 플레이리스트를 생성해도 `/playlists/` 페이지에 노출되지 않음
- 어드민 대기목록(`/admin/playlists`)에도 해당 플레이리스트가 나타나지 않음
- 기존 비공개 플레이리스트를 공개로 전환할 UI가 없음
- 반려된 플레이리스트를 재신청할 방법이 없음

**재현 조건**: `/p/new`에서 "공개 목록" 선택 후 플레이리스트 생성

## 원인

### BUG #1: `createPlaylist()`에서 status 하드코딩

`createPlaylist()` 함수가 `visibility='public'`으로 생성해도 `status`를 항상 `'draft'`로 설정.
결과: `visibility='public'` + `status='draft'` (dead state) → 어드민 대기목록 필터(`status='pending'`)에 걸리지 않음.

반면 `setVisibility()` 함수는 올바르게 `visibility='public'`일 때 `status='pending'`으로 설정하고 있었음.

### BUG #2: 공개 전환 UI 부재

API 엔드포인트 `PUT /api/playlists/{id}/visibility`는 구현되어 있으나, 이를 호출하는 UI가 `/my/playlists`와 `/p/[id]` 어디에도 없었음.

### BUG #3: 반려 후 재신청 불가

반려(`rejected`) 상태에서 재신청하는 UI가 없어 사용자가 아무 조치도 취할 수 없었음.

## 해결 방법

### BUG #1 수정 (`functions/lib/playlists.ts`)

```diff
- const visibility = input.visibility ?? 'unlisted';
-
- await db
-   .prepare(
-     `INSERT INTO user_playlists (id, user_id, title, description, visibility, status)
-      VALUES (?, ?, ?, ?, ?, 'draft')`,
-   )
-   .bind(id, userId, input.title, input.description ?? null, visibility)
-   .run();
+ const visibility = input.visibility ?? 'unlisted';
+ const status = visibility === 'public' ? 'pending' : 'draft';
+
+ await db
+   .prepare(
+     `INSERT INTO user_playlists (id, user_id, title, description, visibility, status)
+      VALUES (?, ?, ?, ?, ?, ?)`,
+   )
+   .bind(id, userId, input.title, input.description ?? null, visibility, status)
+   .run();
```

### BUG #2+3 수정

`/my/playlists` 페이지와 `/p/[id]` 플레이리스트 상세 페이지에 상태별 액션 버튼 추가:

| 상태 | 버튼 | 동작 |
|------|------|------|
| `unlisted` / `public+draft` | 🌐 공개 신청 | `PUT visibility=public` → status='pending' |
| `public+pending` | 없음 (대기 상태 표시) | — |
| `public+approved` | 🔒 비공개로 전환 | `PUT visibility=unlisted` → status='draft' |
| `public+rejected` | 🔄 재신청 | `PUT visibility=public` → status='pending' |

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `functions/lib/playlists.ts` | `createPlaylist()`에서 visibility 기반 status 동적 설정 |
| `src/pages/my/playlists.astro` | 플레이리스트 카드에 공개 신청/전환/재신청 버튼 추가 |
| `functions/p/[id].ts` | 소유자 뷰에 visibility-section 추가 (공개 신청/재신청 UI) |
| `tests/lib/playlists.test.ts` | `createPlaylist` 테스트의 expected params 업데이트 |

## 예방 조치

- `createPlaylist()`와 `setVisibility()`의 status 결정 로직이 동일해야 함. 향후 status 로직 변경 시 양쪽 모두 수정 필요.
- 새 API 엔드포인트를 추가할 때 반드시 대응하는 UI도 함께 구현할 것.
- 상태 머신의 모든 전이(transition) 경로에 대해 UI 접근성을 검증할 것.

---

## 관련 문서

- [플레이리스트 기능](../features/playlists.md)
- [플레이리스트 데이터 불일치 해결](./playlist-data-mismatch.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 |
