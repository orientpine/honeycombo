# 0005: 북마크를 "나중에 볼 기사" 기본 Private 플레이리스트로 통합

> 상태: **승인**

## 맥락

HoneyCombo는 두 개의 독립된 "기사 저장" 기능을 운영해 왔다.

1. **북마크(BookmarkButton)**: `localStorage` 기반 디바이스-로컬 저장. 로그인 불필요, 서버 비용 0. 하트 아이콘 사용.
2. **플레이리스트(AddToPlaylist)**: D1 기반 서버 저장, GitHub OAuth 필수, 공유 가능한 큐레이션.

이 구조는 다음 문제를 야기했다.

- **UX 중복**: 기사 카드에 두 기능이 나란히 노출되어 "어느 걸 눌러야 하나?" 혼란을 유발.
- **아이콘 충돌**: 북마크가 하트 아이콘을 사용하는데, 플레이리스트 좋아요(Like) 기능도 하트로 표현되어 의미 충돌.
- **북마크 조회 불가능**: 사용자가 북마크한 기사를 확인할 UI가 전혀 없어서 북마크는 사실상 "write-only" 기능이었다. `docs/features/article-detail-community.md`는 "로그인 연동 미구현"을 명시적으로 설계 한계로 인정하고 있었다.
- **크로스 디바이스 불가**: localStorage 특성상 디바이스 간 동기화 불가.

사용자의 질문 "북마크를 '나중에 볼 기사' private 플레이리스트에 추가하는 기능으로 만들어줘. 북마크 조회도 가능하게 하고. 기존의 플레이리스트 페이지에서 처리할 수 있지?"가 통합 방향을 명확히 했다.

## 결정

**북마크 = 시스템이 자동 생성하는 "나중에 볼 기사"라는 이름의 private 플레이리스트.**

구체 설계:

1. **스키마**: `user_playlists` 테이블에 `playlist_category` 컬럼 추가.
   - 값: `'read_later'` | `'submissions'` | `NULL`
   - 부분 UNIQUE 인덱스 `uq_user_playlist_category (user_id, playlist_category) WHERE playlist_category IS NOT NULL`로 사용자당 카테고리별 단일 플레이리스트 보장.
   - 기존 `is_auto_created=1` 레코드는 `'submissions'`으로 backfill.

2. **생성 시점**: Lazy. 사용자가 처음 북마크 버튼을 클릭하는 순간 `getOrCreateReadLaterPlaylist()`가 호출되어 생성.
   - 속성: `title='나중에 볼 기사'`, `visibility='unlisted'`, `status='draft'`, `playlist_type='community'`, `is_auto_created=1`, `playlist_category='read_later'`.

3. **API 신설**:
   - `POST /api/bookmarks/toggle` — 기사 추가/제거 토글
   - `GET  /api/bookmarks/ids`    — 현재 사용자의 북마크 source_id 배열 반환 (UI 상태 복원용)
   - `POST /api/bookmarks/migrate` — localStorage 북마크를 D1으로 배치 이관

4. **보호 규칙**:
   - `playlist_category='read_later'`인 플레이리스트는 삭제 불가 (`deletePlaylist` 가드)
   - visibility 변경 불가 — 항상 `unlisted` 유지 (`setVisibility` 가드)
   - AddToPlaylist 드롭다운에서 제외 (`?exclude_category=read_later`) — 별도 북마크 버튼이 이미 존재하므로 중복 UX 방지

5. **UI 변경**:
   - BookmarkButton 아이콘: 하트 → 책갈피(bookmark) SVG
   - 색상: `#e74c6f` → `var(--color-primary)` (오렌지)
   - 미로그인 클릭 시: 현재 페이지로 `return_to`를 포함한 로그인 페이지로 리다이렉트
   - `/my/playlists`에서 Read Later는 항상 최상단에 고정 노출 (`ORDER BY (playlist_category = 'read_later') DESC, updated_at DESC`)
   - `/p/{id}` 상세 페이지: Read Later인 경우 삭제/공개 버튼 숨김, 항목 관리(추가/삭제/메모)는 유지

6. **마이그레이션**: 기존 localStorage(`honeycombo:bookmarks`) 사용자 대상 일회성 자동 이관.
   - 첫 로그인 후 BookmarkButton 초기화 시 localStorage 확인
   - 비어있지 않으면 `/api/bookmarks/migrate`로 배치 POST
   - 성공 시 토스트 `"N개의 북마크를 '나중에 볼 기사'로 옮겼습니다"` + localStorage 키 삭제

7. **기존 버그 동시 수정**: `getOrCreateAutoPlaylist()`가 auto-created 여부와 무관하게 "가장 최근 플레이리스트"를 반환하던 버그를 `playlist_category='submissions'` 필터로 정정.

## 고려한 대안

### 대안 1: 북마크를 localStorage에 유지하고 조회 페이지만 추가

- 장점: 스키마 변경 없음, 로그인 불필요 유지, 서버 비용 0
- 단점:
  - 아이콘 충돌은 해결되나 "북마크 vs 플레이리스트 추가" UX 혼란은 그대로
  - 크로스 디바이스 동기화 불가
  - `/articles/` 필터 또는 신규 `/bookmarks` 페이지 구축 필요 — 또 하나의 조회 경로 증가
- 탈락 사유: 사용자의 "기존 플레이리스트 페이지에서 처리할 수 있을 것 같다"는 요구와 어긋남. 통합이 아닌 또 다른 분리를 만듦.

### 대안 2: 별도의 `user_bookmarks` 테이블 신설

- 장점: 기능 경계가 명확, 플레이리스트 시스템과 분리
- 단점:
  - 플레이리스트와 완전히 동일한 CRUD 패턴을 중복 구현 (list/add/remove/detail/snapshot)
  - `/my/playlists` 외에 `/my/bookmarks` 페이지를 별도 구축 — 사용자 요구("전용 페이지 없이도 되지?")에 반함
  - snapshot, position, note 등 동일 기능을 두 테이블에서 관리
- 탈락 사유: 명백한 over-engineering. 플레이리스트 시스템이 이미 모든 요구 기능을 갖춤.

### 대안 3: 북마크 제거 + AddToPlaylist만 사용

- 장점: UX 완전 단순화, 단일 경로
- 단점:
  - "빠른 한 번의 클릭"으로 저장하던 경험 상실 (드롭다운에서 플레이리스트 선택 필요)
  - 처음 사용하는 유저는 플레이리스트 생성부터 해야 하는 진입 장벽
- 탈락 사유: 북마크의 "원 클릭 저장" UX를 버림. Read Later를 기본 타깃으로 삼으면 이 장점을 유지하면서도 서버 저장 가능.

### 대안 4: localStorage + "익명 플레이리스트" 하이브리드 (Guest Mode)

- 장점: 미로그인 UX 유지하면서 조회 페이지 제공 가능
- 단점: 익명/인증 상태 전환 시 동기화 로직 복잡, 디바이스 이관 시 데이터 손실 가능
- 탈락 사유: 구현 복잡도가 얻는 이득보다 큼. OAuth 로그인 허들이 낮은 GitHub 사용자층 특성상 로그인 요구가 수용 가능.

## 결과

**긍정적 영향**:

- 북마크가 서버 저장으로 전환되어 크로스 디바이스 동기화가 가능해진다.
- 플레이리스트 시스템 하나로 "내가 저장한 기사"의 단일 접근 경로를 확립 → UX 통일성.
- 아이콘 충돌 해소 (하트는 Like 전용, 책갈피는 Bookmark 전용).
- `/articles/` 기사 카드의 UI 복잡도 감소.

**부정적 영향 / 트레이드오프**:

- **Breaking change**: 북마크가 로그인 필수 기능이 된다. 미로그인 사용자는 클릭 시 로그인 페이지로 리다이렉트.
  - 완화: 기존 localStorage 북마크는 첫 로그인 시 자동 이관 (최대 200건, 초과 시 안내).
- D1 쿼리 증가: 페이지 로드당 `GET /api/bookmarks/ids` 1회, 토글 시 `POST /api/bookmarks/toggle` 1회.
  - 완화: sessionStorage 캐시로 페이지 내 재호출 없음.
- 기존 auto-playlist 시스템(제출 기사 동기화)과의 카테고리 충돌을 `playlist_category` 컬럼으로 명시적 구분 → 향후 auto-playlist 유형 추가가 용이.

**향후 확장 여지**:

- `playlist_category`에 다른 값 추가 가능 (예: `'favorites'`, `'history'` 등)
- Read Later만의 특수 정렬/필터 UI를 플레이리스트 상세 페이지에 추가 가능

## 관련 파일

- `migrations/0005_playlist_category.sql`
- `functions/lib/playlists.ts` — `getOrCreateReadLaterPlaylist`, `getOrCreateAutoPlaylist` 버그 수정, 가드
- `functions/lib/types.ts` — `PlaylistCategory`, `ToggleBookmarkInput` 등
- `functions/api/bookmarks/toggle.ts`
- `functions/api/bookmarks/ids.ts`
- `functions/api/bookmarks/migrate.ts`
- `functions/api/playlists/[id]/index.ts` — DELETE 가드
- `functions/api/playlists/[id]/visibility.ts` — 가드
- `functions/api/playlists/index.ts` — `exclude_category` 파라미터
- `src/components/BookmarkButton.astro` — 전면 재작성 (localStorage → API)
- `src/components/ArticleCard.astro` — props 확장
- `src/components/AddToPlaylist.astro` — `exclude_category=read_later` 반영
- `src/pages/my/playlists.astro` — Read Later 특수 렌더링
- `functions/p/[id].ts` — Read Later 상세 페이지 가드
- `docs/features/bookmark-read-later.md`
- `docs/features/playlists.md`
- `docs/features/article-detail-community.md`
- `docs/architecture/overview.md`

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [플레이리스트](../features/playlists.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-23 | 최초 작성. 사용자 요청에 따른 북마크 → Read Later 플레이리스트 통합 결정. |
