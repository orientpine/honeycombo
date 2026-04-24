# '나중에 볼 기사'에서 삭제해도 북마크 UI가 유지되던 문제

> Read Later 플레이리스트 상세 페이지에서 기사 카드의 "삭제" 버튼을 누르면 서버에선 정상 제거되지만, 이후 해당 기사 페이지로 이동하면 북마크 아이콘이 여전히 활성(bookmarked) 상태로 보이던 버그. `sessionStorage` 캐시를 같이 무효화하지 않았던 것이 원인.

## 증상

PR #188 머지 이후 다음 절차로 재현된다.

```
1. 기사 상세 페이지에서 북마크 아이콘 클릭 → 북마크됨 (🔖 활성)
2. /p/{read_later_id} 에 진입 → 방금 북마크한 기사 카드가 존재함
3. 카드의 "삭제" 버튼 클릭 → 카드가 사라짐 (서버 DELETE 성공)
4. 같은 탭에서 원래 기사 페이지로 네비게이션 (뒤로가기 / 링크 / 검색)
5. 북마크 아이콘이 여전히 "bookmarked" 상태로 보임 (❌)
```

**재현 환경**: 로그인 상태, 단일 탭, PR #188 (commit `0e4073a`) 배포 이후.

## 원인

북마크 UI 상태는 두 곳에서 결정된다.

1. **서버 소스 오브 트루스**: D1 `playlist_items` (read_later 플레이리스트의 `source_id` 목록).
2. **클라이언트 캐시**: `sessionStorage['honeycombo:bookmark-ids']` — `BookmarkButton.astro`가 탭 내부에서 반복적인 `/api/bookmarks/ids` 호출을 피하려고 캐시한 source_id 배열.

기존 토글 플로우(`BookmarkButton` 내부)는 토글 시 서버에 `POST /api/bookmarks/toggle` 한 뒤 `invalidateBookmarkCache()`로 `sessionStorage`를 즉시 갱신한다. 덕분에 같은 탭 내에서 상태가 일관된다.

그러나 **Read Later 상세 페이지(`/p/{id}`)의 "삭제" 버튼은 이 캐시 동기화 경로를 거치지 않았다.** `functions/p/[id].ts`의 `item-delete` 클릭 핸들러(기존 L1549 전후)는 `DELETE /api/playlists/{playlistId}/items/{itemId}`만 호출하고, DOM 카드만 제거했다. 결과:

- 서버 D1: 해당 `playlist_items` 행이 삭제됨 → **북마크 아님**이 정답.
- 클라이언트 `sessionStorage['honeycombo:bookmark-ids']`: 해당 `source_id`가 **그대로 남아 있음** → 이후 같은 탭의 `BookmarkButton.initBookmarkButtons()`가 이 배열을 읽어 UI를 "bookmarked"로 렌더링.

즉, **"두 개의 삭제 입구"**(토글 vs. 플레이리스트 삭제) 중 한 쪽만 캐시를 갱신하던 누락 버그다.

## 해결 방법

`functions/p/[id].ts`의 오너 스크립트 블록에 다음을 추가했다.

1. **`item-card`에 `data-source-id` / `data-item-type` 렌더링**: 클라이언트가 어떤 기사인지 식별할 수 있도록 서버가 메타 정보를 HTML 속성으로 내려준다 (`item.source_id`가 있는 내부 기사만).
2. **`syncBookmarkRemoval(sourceId)` 헬퍼**: Read Later 플레이리스트일 때에 한해
   - `sessionStorage['honeycombo:bookmark-ids']`에서 해당 `source_id`를 제거.
   - 현재 DOM에 있는 `[data-bookmark-id="{source_id}"]` 버튼에서 `bookmarked` 클래스와 `aria-pressed`를 해제.
3. **삭제 핸들러에서 호출**: `DELETE /api/playlists/{playlistId}/items/{itemId}` 성공 직후, 카드를 DOM에서 제거하기 전에 `syncBookmarkRemoval(card.dataset.sourceId)`를 호출.

```diff
+ const playlistIsReadLater = ${isReadLater ? 'true' : 'false'};
+ const BOOKMARK_CACHE_KEY = 'honeycombo:bookmark-ids';
+
+ function syncBookmarkRemoval(sourceId) {
+   if (!playlistIsReadLater || !sourceId) return;
+   try {
+     const raw = sessionStorage.getItem(BOOKMARK_CACHE_KEY);
+     if (raw) {
+       const parsed = JSON.parse(raw);
+       if (Array.isArray(parsed)) {
+         const next = parsed.filter(id => String(id) !== String(sourceId));
+         sessionStorage.setItem(BOOKMARK_CACHE_KEY, JSON.stringify(next));
+       }
+     }
+   } catch (_err) { /* non-fatal */ }
+
+   document.querySelectorAll('[data-bookmark-id="' + ... + '"]').forEach(btn => {
+     btn.classList.remove('bookmarked');
+     btn.setAttribute('aria-pressed', 'false');
+   });
+ }

  document.querySelectorAll('.item-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      ...
      const card = btn.closest('.item-card');
      if (!card) return;
+     syncBookmarkRemoval(card.dataset.sourceId);
      card.classList.add('removing');
      ...
```

이후 동일 탭에서 기사로 이동할 때 `BookmarkButton.fetchBookmarkIds()`가 `sessionStorage` 캐시를 읽어 올바른 상태(북마크 해제됨)로 UI를 그린다. 다른 탭이나 다른 디바이스는 다음 `/api/bookmarks/ids` 호출(새 탭/하드 리로드) 때 서버 기준으로 자연스럽게 재동기화된다.

### 외부 URL 항목 처리

플레이리스트 항목 중 `item_type === 'external'`인 항목은 `source_id`가 `null`이다. 이 경우 `data-source-id` 속성 자체가 렌더링되지 않으므로 `card.dataset.sourceId`는 `undefined`가 되고 `syncBookmarkRemoval(undefined)` 내부의 `!sourceId` 가드에서 즉시 반환한다. 북마크 개념이 적용되지 않는 항목을 잘못 건드릴 위험이 없다.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `functions/p/[id].ts` | `item-card`에 `data-source-id`/`data-item-type` 속성 추가, 오너 스크립트에 `syncBookmarkRemoval()` 헬퍼 삽입, `item-delete` 핸들러에서 호출 |
| `docs/features/bookmark-read-later.md` | 5번 절(상세 페이지에서 삭제 시 UI 동기화) 신설 및 변경 이력 갱신 |

## 예방 조치

- **"동일한 도메인 상태를 바꾸는 모든 입구"를 동기화하라**: 북마크는 두 UI(북마크 버튼, Read Later 삭제 버튼)에서 변경될 수 있다. 새 입구가 생기면 반드시 `sessionStorage['honeycombo:bookmark-ids']` 캐시 경로도 함께 갱신해야 한다.
- **캐시 갱신 헬퍼를 공유하라**: 현재 캐시 조작 로직이 `BookmarkButton.astro`(`invalidateBookmarkCache`)와 `functions/p/[id].ts`(`syncBookmarkRemoval`) 두 곳에 분산되어 있다. 세 번째 입구가 생기기 전에 공통 모듈로 추출하는 것이 바람직하다. (후속 과제)
- **삭제 API에 `source_id`를 응답에 포함하는 안**: 서버 응답에 삭제된 항목의 `source_id`를 돌려주면 클라이언트가 `data-source-id` 속성에 의존하지 않아도 된다. 다만 현재 DELETE는 `204 No Content`로 설계되어 있으므로, 이 방식은 계약 변경을 수반한다. 지금 수정은 최소 침습적으로 속성 전달 방식을 택했다.
- **회귀 테스트**: `tests/api/bookmarks-ids.test.ts`는 서버 단의 ID 조회만 검증한다. 클라이언트 캐시 동기화는 통합 테스트 범위이므로, 향후 Playwright 시나리오("Read Later에서 삭제 후 기사 페이지 방문") 추가를 고려한다.

---

## 관련 문서

- [북마크 — 나중에 볼 기사 (Read Later)](../features/bookmark-read-later.md)
- [플레이리스트](../features/playlists.md)
- [D1 마이그레이션 미적용 문제](./d1-migration-deployment.md)
- ADR: [북마크를 Read Later 플레이리스트로 통합](../decisions/0005-bookmark-as-read-later-playlist.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-24 | 최초 작성. Read Later 상세 페이지에서 삭제 시 `sessionStorage` 캐시 미갱신 버그 수정. |
