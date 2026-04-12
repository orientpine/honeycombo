# 플레이리스트 API 응답 키 미스매치

> 프론트엔드가 API 응답의 잘못된 키를 참조하여 플레이리스트 목록이 표시되지 않는 문제

## 증상

1. **내 플레이리스트 페이지** (`/my/playlists`): 플레이리스트를 만들어도 목록에 아무것도 표시되지 않음
2. **기사 추가 드롭다운** (`AddToPlaylist`): 플레이리스트 선택 드롭다운이 "오류가 발생했습니다" 표시
3. **플레이리스트 항목 수**: 모든 플레이리스트가 "0개 항목"으로 표시
4. **SSR 페이지 canonical URL**: `honeycombo.orientpine.workers.dev`로 잘못 설정

```
// 브라우저 콘솔에서 확인 가능한 에러
TypeError: playlists.map is not a function
```

**재현 환경**: 모든 브라우저, 프로덕션(`honeycombo.pages.dev`)

## 원인

### 1. 응답 키 미스매치 (`my/playlists.astro`)

API `GET /api/playlists?mine=true`가 `{ playlists: [...] }` 형태로 응답하는데, 프론트엔드가 `data.items`로 접근.

### 2. 응답 타입 오인 (`AddToPlaylist.astro`)

`await res.json()` 결과가 `{ playlists: [...] }` 객체인데 배열로 취급. `obj.length`는 `undefined`, `obj.map()`은 `TypeError` 발생.

### 3. item_count 누락 (`listUserPlaylists`)

`listPublicPlaylists`는 `SELECT COUNT(*)` 서브쿼리로 `item_count`를 반환하지만, `listUserPlaylists`는 해당 서브쿼리 없이 기본 컬럼만 반환. 프론트엔드가 `item_count`를 표시하려 하면 항상 0.

### 4. SITE_URL 하드코딩 (`functions/p/[id].ts`)

`const SITE_URL = 'https://honeycombo.orientpine.workers.dev'`로 하드코딩되어 있어, 실제 배포 도메인(`honeycombo.pages.dev`)과 불일치. OG 태그, canonical URL 모두 잘못된 도메인 가리킴.

## 해결 방법

### 1. `src/pages/my/playlists.astro` (line 81)

```diff
- const playlists = data.items || [];
+ const playlists = data.playlists || [];
```

### 2. `src/components/AddToPlaylist.astro` (lines 89-91)

```diff
- const playlists = await playlistsRes.json();
- 
- if (playlists.length === 0) {
+ const playlistData = await playlistsRes.json();
+ const playlists: Array<{ id: string; title: string }> = playlistData.playlists || [];
+ 
+ if (playlists.length === 0) {
```

### 3. `functions/lib/playlists.ts` (`listUserPlaylists`)

```diff
- SELECT id, user_id, title, description, visibility, status, created_at, updated_at
-        FROM user_playlists
-        WHERE user_id = ?
+ SELECT p.id, p.user_id, p.title, p.description, p.visibility, p.status, p.created_at, p.updated_at,
+               (SELECT COUNT(*) FROM playlist_items pi WHERE pi.playlist_id = p.id) AS item_count
+        FROM user_playlists p
+        WHERE p.user_id = ?
```

반환 타입도 `PlaylistRow[]` → `UserPlaylistWithCount[]`로 변경. D1은 `COUNT(*)`를 문자열로 반환할 수 있으므로 `Number()` 변환 적용.

### 4. `functions/p/[id].ts` (line 7-11)

```diff
- const SITE_URL = 'https://honeycombo.orientpine.workers.dev';
- 
- function getCanonicalUrl(playlistId: string): string {
-   return `${SITE_URL}/p/${encodeURIComponent(playlistId)}`;
- }
+ function getCanonicalUrl(requestUrl: string, playlistId: string): string {
+   const origin = new URL(requestUrl).origin;
+   return `${origin}/p/${encodeURIComponent(playlistId)}`;
+ }
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/pages/my/playlists.astro` | `data.items` → `data.playlists` |
| `src/components/AddToPlaylist.astro` | 응답 객체에서 `.playlists` 배열 추출 |
| `functions/lib/playlists.ts` | `listUserPlaylists`에 item_count 서브쿼리 추가 |
| `functions/lib/types.ts` | `UserPlaylistWithCount` 타입 추가 |
| `functions/p/[id].ts` | request URL에서 origin 동적 추출 |
| `tests/lib/playlists.test.ts` | `listUserPlaylists` 테스트에 item_count 검증 추가 |

## 예방 조치

- API 응답 형태를 변경할 때 프론트엔드 소비자를 반드시 함께 업데이트
- 배포 도메인을 코드에 하드코딩하지 않기 — `request.url`에서 동적 추출
- 같은 데이터를 쿼리하는 함수가 여러 개일 때 (`listPublicPlaylists` vs `listUserPlaylists`) 반환 필드를 일관되게 유지

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 — 4건의 버그 원인 분석 및 수정 기록 |
