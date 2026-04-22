# 기사 관리 페이지 (/my/articles)

> 사용자가 제출한 기사의 플레이리스트 배정을 직접 관리할 수 있는 개인 페이지.

## 개요

- **목적**: 기존에 자동으로 최근 플레이리스트에 추가되던 기사를 사용자가 직접 원하는 플레이리스트에 배정하도록 UX 변경.
- **대상 사용자**: 로그인한 모든 사용자(에디터 포함). 본인이 제출한 기사만 관리 가능.
- **구성**: 한 페이지 내 두 개의 탭 — "미배정 기사" / "배정된 기사".

## 동작 흐름

1. 사용자가 GitHub Issue로 기사 제출 → `.github/workflows/process-submission.yml` → `scripts/process-submission.ts` → PR 생성 → merge → `.github/workflows/on-article-approved.yml` → webhook POST.
2. `functions/webhooks/submission-approved.ts`가 webhook을 받아 `submissions` 테이블에 무조건 upsert. **자동 플레이리스트 추가는 수행하지 않음.**
3. 사용자가 `/my/articles` 접속 → `GET /api/my/articles?status=all` 호출.
4. 페이지가 두 탭으로 기사 분할 표시:
   - 미배정 기사 탭: `playlists.length === 0`인 기사 카드 + "플레이리스트에 추가" 버튼.
   - 배정된 기사 탭: `playlists.length > 0`인 기사 카드 + 플레이리스트 배지 + "다른 플레이리스트에 추가" 버튼.
5. 플레이리스트에 추가 → `POST /api/my/articles/:articleId/playlists`.
6. 플레이리스트에서 제거 → `DELETE /api/my/articles/:articleId/playlists/:playlistId`.
7. 마지막 배지 제거 시 카드는 미배정 탭으로 이동.

## 관련 파일

| 경로 | 역할 |
|---|---|
| `src/pages/my/articles.astro` | 기사 관리 페이지 UI (Astro shell + client-side JS) |
| `functions/api/my/articles/index.ts` | GET 기사 목록 (status=unassigned/assigned/all) |
| `functions/api/my/articles/[articleId]/playlists/index.ts` | POST 기사를 플레이리스트에 추가 |
| `functions/api/my/articles/[articleId]/playlists/[playlistId].ts` | DELETE 기사를 플레이리스트에서 제거 |
| `functions/webhooks/submission-approved.ts` | 기사 승인 webhook (submissions 테이블 upsert) |
| `scripts/backfill-submissions.ts` | 기존 기사 submissions 테이블 백필 스크립트 |
| `migrations/0004_auto_playlist.sql` | `submissions` 테이블 정의 |

## 설정값

새 환경 변수 없음. 기존 `WEBHOOK_SECRET` 및 D1 binding `DB`를 재사용.

## 제약 사항

- V1 범위: 벌크 작업 없음, 검색/필터/정렬 없음, 드래그&드롭 없음, 페이지 내 플레이리스트 생성 없음.
- 페이지는 로그인한 사용자 본인이 제출한 기사만 표시 (`submissions.submitted_by_id = current_user.id`).
- 한 번에 최대 100개 기사까지 로드(`limit=100`). 그 이상은 pagination 필요 (V2).
- 플레이리스트 "변경"은 독립 API가 아니라 client-side에서 `DELETE` + `POST`의 조합.

## 상태 전이 (프런트엔드 UI)

초기 로드 시 페이지는 다음 상태 중 **정확히 하나**만 노출한다. 상태 전환은 `hideAllStates()` + `showState(el)` 헬퍼로만 수행한다.

| 상태 ID | 트리거 | 표시 내용 |
|---|---|---|
| `#page-loading` | 초기 진입, 재시도 시작 | "데이터를 불러오는 중입니다..." |
| `#auth-gate` | `/api/auth/me` 가 `!ok` 또는 네트워크 에러 | "GitHub 로 로그인" CTA |
| `#error-state` | `/api/my/articles?status=...` 응답 중 하나라도 실패 | 오류 메시지 + "다시 시도" 버튼 |
| `#main-content` | 기사 fetch 성공 | 탭(미배정/배정) + 기사 카드 + 본문 |

`#main-content` 내부에는 `#playlists-warning` 인라인 경고가 따로 존재한다. `/api/playlists?mine=true` 가 실패했을 때만 나타나며, "플레이리스트에 추가" 버튼을 `disabled` 로 만들고 "다시 불러오기" 액션을 제공한다. 기사 목록 표시 자체는 플레이리스트 fetch 결과와 무관하게 진행된다 — 이것이 V1 의 회복력(resilience) 전략이다.

## 관련 문서

- [0006. 자동 플레이리스트 추가 제거 (ADR)](../decisions/0006-remove-auto-playlist-add.md)
- [플레이리스트 시스템](./playlists.md)
- [자동 플레이리스트 추가 (deprecated)](./auto-playlist-add.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 |
| 2026-04-22 | 프런트엔드 상태 전이(로딩/인증/에러/본문) 명시화, `/api/playlists?mine=true` 실패 시 기사 목록은 정상 노출하는 회복력 전략 문서화. 관련 버그 진단은 `docs/troubleshooting/my-articles-auth-and-loading-bugs.md` 참조. |
