# `/my/articles` 로그인/로딩 상태 오류

> 로그인된 상태에서도 로그인 안내가 보이거나 "데이터를 불러오는 중..." 표시가 멈춘 채 빈 페이지로 남던 문제의 진단과 해결 기록.

## 증상

- 로그인된 상태에서 `/my/articles` 에 접근하면 "기사를 관리하려면 로그인이 필요합니다." 안내가 뜬다.
- "데이터를 불러오는 중입니다..." 메시지가 계속 표시되거나, 잠깐 에러 알림이 뜬 뒤 **헤더만 남고 본문이 비어 있는** 상태로 멈춘다.
- 미배정/배정 탭 UI 자체가 아예 보이지 않아 사용자는 "기능이 제대로 구현되지 않은 것 같다" 고 느낀다.
- 재현 조건: 세션이 유효함에도 `/api/auth/me` 호출이 네트워크 오류로 실패하거나, `/api/my/articles` · `/api/playlists` 중 하나라도 5xx/네트워크 에러를 반환할 때.

## 원인

페이지 로더의 상태 전환이 불완전해 세 가지 버그가 겹쳐 발생했다.

### 1. 네트워크 에러가 인증 실패가 아닌 "치명적 에러" 로 취급됨

`src/pages/my/articles.astro` 의 `init()` 는 다음과 같이 구성되어 있었다.

```ts
const authRes = await fetch('/api/auth/me');
if (!authRes.ok) { /* 로그인 게이트 */ }
// ...이후의 기사 fetch 3개가 동일 try 블록에 묶임
```

`fetch('/api/auth/me')` 가 네트워크 레벨에서 throw 하면 try/catch 의 catch 분기로 빠지는데, 이 블록은 "데이터 로딩 실패" 로 처리해 로딩 메시지만 숨기고 main content 를 숨긴 채로 두고 있었다. 같은 상황에서 `/my/playlists.astro` 는 fetch 실패를 "인증 안 됨" 으로 간주해 로그인 게이트를 노출한다. 두 페이지의 UX 가 어긋나 있었고, 일부 사용자에겐 "로그인되어 있는데 로그인하라고 나온다" 로 인식되었다.

### 2. 데이터 fetch 실패 시 본문이 숨겨진 채로 남음

3개 병렬 fetch (`/api/my/articles?status=unassigned`, `status=assigned`, `/api/playlists?mine=true`) 중 하나라도 실패하면 통째로 에러로 간주해 throw 했다. catch 블록은:

```ts
loadingEl!.hidden = true;
showNotification(err.message || '오류가 발생했습니다.', 'error');
```

만 수행했다. `mainContentEl` 은 계속 `hidden` 상태였고 에러 노티는 3초 뒤 사라진다. 결과적으로 **헤더만 남은 빈 페이지** 가 "로딩이 안 끝남" 으로 보였다.

### 3. 플레이리스트 fetch 실패가 기사 목록까지 차단함

기사 목록은 `/api/my/articles` 로 불러오고, 플레이리스트 목록은 "어디에 추가할지" 드롭다운을 위해서만 필요하다. 그럼에도 두 요청이 모두 성공해야만 본문이 렌더됐다. 플레이리스트 쪽이 일시적으로 실패하면 기사까지 못 보여줬다.

## 해결 방법

`src/pages/my/articles.astro` 를 다음과 같이 재구성했다.

1. **인증 판정과 데이터 로딩의 분리** — `/api/auth/me` 호출만 먼저 수행하고, fetch 가 throw 하거나 `!ok` 이면 "인증 안 됨" 으로 간주해 `#auth-gate` 를 노출한다. `/my/playlists.astro` 의 패턴과 일관되게 맞췄다.
2. **명시적인 에러 상태 + 다시 시도 버튼** — 기사 fetch 실패 시 `#error-state` 를 노출하고 "다시 시도" 버튼으로 `init()` 를 재호출한다. 더 이상 빈 페이지로 남지 않는다.
3. **플레이리스트 fetch 는 옵셔널로 처리** — `/api/playlists?mine=true` 가 실패해도 기사 목록은 정상 렌더한다. 경고 배너(`#playlists-warning`)와 "플레이리스트 다시 불러오기" 버튼이 뜨고, 이 상태에서 "플레이리스트에 추가" 버튼은 `disabled` 로 비활성화된다.
4. **상태 전환 헬퍼 단일화** — `hideAllStates()` + `showState(el)` 로 로딩·인증 게이트·에러·본문 중 **정확히 하나만** 보이도록 강제해 상태 간 잔재 현상을 방지한다.
5. **중복 이벤트 바인딩 가드** — `astro:page-load` 가 ClientRouter 전환마다 발화하므로 (1) 현재 경로가 `/my/articles` 일 때만 초기화하고, (2) 탭 클릭 리스너는 `tabsBound` 플래그로 한 번만 붙인다.
6. **사소한 방어 로직** — 모든 `fetch` 에 `credentials: 'same-origin'` 명시, 사용자 입력 값(articleId/playlistId)을 URL 에 넣을 때 `encodeURIComponent` 적용, `escapeHtml` 에서 null/undefined 안전 처리, `formatDate` 에서 유효하지 않은 날짜 방어.

### 기능 확인 (미배정/배정 탭)

- `/api/my/articles` 핸들러(`functions/api/my/articles/index.ts`) 와 마이그레이션(`migrations/0004_auto_playlist.sql`) 을 다시 검토해 다음을 확인했다:
  - "미배정" 은 `submissions` 에 존재하지만 동일 `article_id` 로 된 `playlist_items` 가 소유 플레이리스트에 없는 경우 — 해당 SQL 의 `NOT EXISTS` 서브쿼리로 정확히 판정된다.
  - "배정됨" 은 `submissions` ⟕ `playlist_items`(item_type in curated/feed) ⟕ `user_playlists`(user_id = me) 조인 + `json_group_array` 로 플레이리스트 요약을 만들어 반환한다.
  - 프런트는 응답의 `playlists` 배열 길이로 재분류할 뿐 서버 판정을 덮어쓰지 않는다.
- 이 구조 자체는 기능적으로 문제 없었고, 보고된 문제는 **프런트 오류 경로의 UI 상태 누락** 에서 비롯되었다.

## 관련 파일

- `src/pages/my/articles.astro` — 상태 전환 로직 및 fetch 에러 핸들링 수정
- `src/pages/my/playlists.astro` — 비교 참조한 인증/로딩 UX 패턴
- `functions/api/my/articles/index.ts` — 기사 목록 API (변경 없음, 거동 재검증만 수행)
- `functions/api/my/articles/[articleId]/playlists/index.ts` — 플레이리스트 추가 API (변경 없음)
- `functions/api/my/articles/[articleId]/playlists/[playlistId].ts` — 플레이리스트 제거 API (변경 없음)
- `functions/api/_middleware.ts` — 세션 쿠키 파싱 및 `data.user` 주입 (변경 없음)
- `functions/api/auth/me.ts` — 현재 유저 응답 엔드포인트 (변경 없음)
- `docs/features/article-management.md` — 동작 흐름 재검증 기준

## 관련 문서

- [기사 관리 페이지 (`/my/articles`)](../features/article-management.md)
- [플레이리스트 시스템](../features/playlists.md)
- [자동 플레이리스트 추가 제거 (ADR)](../decisions/0006-remove-auto-playlist-add.md)

## 후속 회귀: trailing slash 경로 가드 (PR #174 회귀 → PR #175 에서 수정)

### 증상

PR #174 배포 직후 사용자 보고: 실제 프로덕션에서 **여전히 "데이터를 불러오는 중입니다..." 만 노출**. 새 코드에 있어야 할 에러 상태 / 로그인 게이트 / 본문 어느 것도 나타나지 않음.

### 원인

PR #174 에서 `astro:page-load` 중복 실행 방어용으로 추가했던 경로 가드:

```ts
if (window.location.pathname !== '/my/articles') return;
```

이 조건이 Astro 의 기본 trailing slash 동작과 충돌. 프로덕션 빌드 결과물은 `/my/articles/index.html` 로 서빙되며, 서버는 `/my/articles` 요청을 `308 Permanent Redirect → /my/articles/` 로 리다이렉트한다. 즉 브라우저의 `window.location.pathname` 은 항상 `'/my/articles/'` (끝 슬래시 포함) 이므로 가드가 매번 `true` 로 판정해 **`init()` 이 한 번도 실행되지 않음**. `#page-loading` 이 초기 DOM 상태 그대로 영구히 남아 로딩 메시지만 보이는 현상이 발생.

### 해결

경로 가드 제거. 이미 존재하던 DOM 엘리먼트 존재 체크 (`if (!loadingEl || !authGateEl || !errorStateEl || !mainContentEl) return;`) 가 자연스러운 가드 역할을 한다 — 해당 ID 들은 `/my/articles` 페이지에만 있으므로 다른 페이지로의 ClientRouter 전환에서는 DOM 존재 체크에서 early-return 된다.

### 재발 방지 교훈

- Astro + Cloudflare Pages 조합에서 **`window.location.pathname` 정확 비교는 항상 trailing slash 양쪽을 허용해야 한다.** (`p === '/x' || p === '/x/'` 또는 `p.replace(/\/$/, '') === '/x'`.)
- 애초에 이번 경우는 DOM 존재 체크로 충분했고 경로 가드는 **불필요한 오버엔지니어링**이었다. 방어 코드를 추가할 때는 "이미 있는 안전장치가 충분한가" 를 먼저 확인.
- 푸시/배포 전 **프로덕션 형태에 가까운 `bun run preview`** 로 실제 라우팅 동작을 확인하자 (dev server 는 trailing slash 동작이 다를 수 있음).

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-22 | 최초 작성 — `/my/articles` 의 (1) 네트워크 오류를 인증 실패로 간주하지 않음, (2) 데이터 fetch 실패 시 본문 영구 숨김, (3) 플레이리스트 fetch 실패가 기사까지 차단 하는 3가지 버그 진단과 해결 기록. |
| 2026-04-22 | 후속 회귀 문서화 — PR #174 의 경로 가드가 trailing slash 와 충돌해 `init()` 가 실행되지 않던 회귀를 PR #175 에서 수정. DOM 존재 체크만으로 충분하므로 경로 가드 제거. |
