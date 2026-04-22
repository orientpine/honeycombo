# 플레이리스트

> 사용자가 기술 기사를 모아 공유할 수 있는 큐레이션 기능. Cloudflare D1 기반의 통합 시스템으로 운영된다.

## 개요

기술 뉴스 소비자가 관심 주제별로 기사를 묶어 저장·공유할 수 있게 한다. 에디터가 선정한 공식 플레이리스트와 사용자가 자유롭게 만드는 커뮤니티 플레이리스트를 `playlist_type`으로 구분하여 통합 관리한다.

## 데이터 모델

플레이리스트는 Cloudflare D1의 `user_playlists` 테이블에 저장되며, 다음 핵심 필드를 포함한다.

- `playlist_type`: 'community' (일반 유저) 또는 'editor' (공식 에디터)
- `tags`: 플레이리스트 분류를 위한 태그 (쉼표로 구분된 문자열)
- `status`: 'draft', 'pending', 'approved', 'rejected' (에디터 타입은 생성 시 즉시 'approved' 상태가 됨)

## 동작 흐름

### 플레이리스트 생성

```
사용자 → /p/new (정적 폼)
       → POST /api/playlists (D1 INSERT)
       → 리디렉션 /p/{id} (SSR 렌더링)
```

### 플레이리스트 조회

```
방문자 → /p/{id}
       → functions/p/[id].ts (SSR)
       → getPlaylist(DB, id) → D1 SELECT + JOIN
       → HTML 렌더링 (비공개: noindex)
```

#### 상세 페이지 UI

- **레이아웃**: 기사 아이템을 2열 반응형 그리드(`repeat(2, 1fr)`)로 표시한다. `@768px` 이하에서 1열로 전환된다. 각 카드는 가로형(`flex-direction: row`)이며, YouTube 썸네일이 있는 경우 좌측에 140px 고정폭 썸네일을 표시하고 우측에 제목/배지/컨트롤을 배치한다.
- **YouTube 썸네일**: `url_snapshot`이 YouTube URL인 경우 `img.youtube.com/vi/{videoId}/mqdefault.jpg` 썸네일을 카드 좌측에 자동 표시한다. `extractYouTubeVideoId()`가 `youtube.com`, `youtu.be`, `m.youtube.com`, `youtube-nocookie.com`, `/shorts/`, `/live/`, `/embed/`, `/v/` 패턴을 URL 파싱으로 처리한다.
- **내부 링크**: `source_id`가 있는 curated/feed 아이템은 `/articles/${source_id}`로 내부 페이지에 링크한다. `source_id`가 없는 external 아이템만 외부 URL(`url_snapshot`)로 링크하며 `target="_blank"`를 적용한다.
- **하위 호환**: DB에 year/month 경로 접두사 없이 저장된 레거시 `source_id`(예: `submission-62-xxx`)를 위해 `[...slug].astro`가 filename-only slug도 추가 생성한다. 이 alias 페이지는 정규 canonical URL과 Giscus term을 `entry.id` 기반으로 설정하여 SEO와 댓글 분리를 방지한다.
- **정렬 순서 (최신순)**: 아이템은 `ORDER BY position DESC`로 조회되어 **최근 추가된 기사가 최상단**에 표시된다. `addItem()`은 여전히 `position = MAX(position) + 1`을 사용하므로 새 기사는 자동으로 가장 큰 position을 얻고 DESC 정렬에서 맨 위에 온다.

### 기사 추가

```
기사 페이지 → AddToPlaylist 드롭다운
           → GET /api/playlists?mine=true&source_id=...&item_type=... (내 목록 + 포함 여부 조회)
           → POST /api/playlists/{id}/items (기사 추가)
```

- 로그인 전에는 현재 페이지 경로를 `return_to`로 포함한 OAuth 로그인 링크를 노출한다.
- 이미 같은 기사가 들어있는 플레이리스트는 드롭다운에서 `✓ 추가됨` 상태로 비활성화한다.
- 중복 추가 시 API의 `409` 응답을 받아 `이미 추가된 기사입니다.` 토스트를 표시한다.

### 상세 페이지 내 기사 검색/외부 URL 추가 (플레이리스트 소유자)

```
소유자 → /p/{id} (SSR)
      → functions/p/[id].ts 에서 검색 UI + 외부 URL 폼 렌더링
      → GET /search-index.json (Astro build-time 생성 정적 인덱스)
      → POST /api/playlists/{id}/items (검색 결과 기사/외부 URL 추가)
```

- 검색 인덱스는 `src/pages/search-index.json.ts`가 빌드 시 생성하며, 승인된 curated 기사와 feed 기사를 합쳐 제공한다.
- 소유자는 상세 페이지 안에서 제목/출처 기준으로 HoneyCombo 기사 검색 후 즉시 플레이리스트에 추가할 수 있다.
- 외부 URL은 접이식 폼으로 추가하며, `external` 타입 스냅샷으로 저장한다.
- 검색/외부 URL 모두 중복 추가 시 API의 `409` 응답을 받아 `이미 추가됨` 또는 안내 alert로 처리한다.

### 아이템 관리 (플레이리스트 소유자)

```
소유자 → /p/{id} (SSR)
       → functions/p/[id].ts 에서 소유자 전용 컨트롤 렌더링
       → DELETE /api/playlists/{id}/items/{itemId} (삭제)
       → PUT /api/playlists/{id}/items/{itemId} (메모 수정)
       → PUT /api/playlists/{id}/items/reorder (배치 재정렬 — 배치 편집 모드)
```

- 소유자에게만 상세 페이지 카드별 관리 컨트롤(`삭제`, `💬 메모 수정/추가`)과 왼쪽 드래그 핸들(`⋮⋮`)을 노출한다.
- 삭제 성공 시 카드가 페이드아웃 후 DOM에서 제거되며, 헤더의 기사 수(`N개 기사`)가 자동으로 -1 갱신된다.
- 메모 수정은 카드 내부 인라인 에디터에서 수행하며, 저장 성공 시 화면 표시를 즉시 갱신한다.

### 배치 편집 모드 (드래그 재정렬)

```
소유자 → /p/{id} (아이템 2개 이상)
       → 📋 배치 편집 버튼 클릭 → SortableJS CDN 지연 로드 (https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js)
       → 드래그 핸들로 카드 순서 자유 재배치
       → 저장 버튼 클릭
       → PUT /api/playlists/{id}/items/reorder (body: { item_ids: string[] })
       → reorderItems() → D1 batch UPDATE로 position 원자 재할당
       → 페이지 reload (서버 상태 동기화)
```

- **진입 조건**: 소유자 + `items.length > 1`일 때만 `📋 배치 편집` 버튼을 노출한다.
- **편집 모드 UI** (DESIGN.md §4.8, §4.9 준수):
  - `.items` 컨테이너에 `.batch-edit-mode` 클래스가 붙어 점선 테두리 + `--color-bg-secondary` 배경 + 단일 열 그리드로 전환된다.
  - `.drag-handle`(`⋮⋮` grip)이 각 카드 좌측에 표시되며, 이 영역에서만 드래그를 개시할 수 있어 스크롤·읽기 중 오동작을 방지한다.
  - 편집 중에는 기사 링크(`.item-title a`)에 `pointer-events: none`이 적용되어 페이지 이탈을 차단하고, `.item-controls`(삭제·메모 버튼)는 숨겨진다.
- **드래그 자동 스크롤**: 드래그 중 카드를 뷰포트 상/하단 **120px** 이내로 가져가면 페이지가 자동으로 위/아래로 스크롤된다. SortableJS의 내장 `scroll` 플러그인은 **비활성화**(`scroll: false`)하고, `requestAnimationFrame` 기반의 커스텀 오토스크롤러를 `onStart`/`onEnd` 라이프사이클에 연결하여 직접 구현한다. 이유는 (1) SortableJS는 `scrollSpeed`를 **binary(고정 속도 on/off)**로만 적용해 edge에 가까워져도 속도가 증가하지 않고, (2) 사이트 공통 `position: sticky` 네비게이션(`height: var(--nav-height)` = 60px)이 viewport 상단을 가려서 브라우저 네이티브 drag-at-edge fast-scroll이 **위 방향**에서 발동하지 않아 위/아래 스크롤 속도가 비대칭으로 느껴지는 문제가 있었기 때문이다. 커스텀 구현은 드래그 시작 시 `.nav`의 `getBoundingClientRect().bottom`을 **effective top edge**로 사용하여 sticky 헤더 offset을 자동 보정하며, edge와의 거리에 비례한 gradient 속도(`AUTO_SCROLL_MIN_SPEED = 4px/frame` → `AUTO_SCROLL_MAX_SPEED = 32px/frame`)를 적용해 위/아래 모두 **동일하게** 부드럽고 빠르게 스크롤한다. 문서 맨 상단/하단에서는 `window.scrollBy` 전에 `scrollHeight` 기준으로 clamp하여 over-shoot을 방지한다. 긴 플레이리스트에서도 드래그를 유지한 채 원하는 위치까지 자연스럽게 이동할 수 있으며, 데스크톱 마우스·모바일 터치(`pointermove`+`touchmove`) 모두 동일하게 동작한다.
- **저장 흐름**: `저장` 버튼 → 현재 DOM 순서의 `item_ids` 배열을 `PUT /reorder`로 전송 → 성공 시 `window.location.reload()`로 서버 상태 재동기화.
- **취소 흐름**: `취소` 버튼 → 진입 시점에 저장한 `originalOrder` 배열대로 DOM 재배치 → SortableJS 인스턴스 destroy → 편집 모드 종료 (API 호출 없음).
- **실패 처리**: CDN 로드 실패 시 alert + 배치 모드 자동 종료. 저장 API 실패 시 버튼 복구 + alert, 편집 모드 유지하여 재시도 가능.
- **position 재할당 공식**: `position = (itemIds.length - 1) - idx`. 배열의 첫 ID가 가장 큰 position을 받아 DESC 정렬에서 최상단에 온다. 재정렬 후 position은 `0..(N-1)`로 정규화되므로 이후 `addItem()`의 `MAX + 1`이 계속 정상 동작한다.
- **기존 인접 swap 호환**: `swapItemPositions()` 백엔드 함수와 `/items/swap` API는 프론트엔드에서 더 이상 호출되지 않지만 향후 재사용을 위해 유지된다.
### 태그 편집 (플레이리스트 소유자)

```
소유자 → /p/{id} (SSR)
       → functions/p/[id].ts 소유자 전용 “🏷️ 태그 편집” 섹션 렌더링
       → 태그 추가/제거/변경 후 저장 버튼 클릭
       → PUT /api/playlists/{id} { tags: string[] } (최대 5개 검증)
       → 성공 시 헤더의 `.playlist-tags` 디스플레이 즉시 갱신 (페이지 리로드 없음)
```

- 소유자 전용 섹션은 공개/비공개 섹션과 기사 추가 섹션 사이에 배치되며, 현재 태그를 pill 형태로 표시한다.
- 입력 필드에서 **Enter 또는 쉼표(`,`)** 키로 태그를 추가한다. blur 이벤트에서도 미커밋된 입력이 추가된다.
- 입력값의 선두 `#` 기호와 내부 쉼표는 자동 제거되며, 공백만 있는 값은 무시한다.
- 각 태그 pill의 `×` 버튼으로 개별 제거 가능. aria-label 로 접근성을 보장한다.
- **태그당 최대 30자**, **플레이리스트당 최대 5개** 제한을 클라이언트와 서버(`functions/api/playlists/[id]/index.ts:73-84`) 양쪽에서 검증한다. 중복 태그도 차단한다.
- 저장 버튼은 변경 없을 때 `disabled`, 변경 있을 때 `.has-changes` 클래스로 primary warm orange 색 + warm shadow를 부여한다 (DESIGN.md §4.4 / §6 준수).
- 초기 태그는 XSS 안전을 위해 서버 측에서 `data-initial-tags` HTML 속성(`escapeAttr(JSON.stringify(...))`)으로 전달되며, 클라이언트는 `dataset`에서 `JSON.parse`로 복원한다.
- XHR 401/403 응답은 전용 한국어 메시지로 대체한다. 일반 실패는 서버의 `data.error` 메시지를 우선 표시한다.
- 성공 시에는 상단 헤더의 기존 `.playlist-tags` 노드를 부분적으로 갱신하며, 페이지 전체 새로고침은 발생하지 않는다. 성공 피드백(“태그가 저장되었습니다.”)은 3초 뒤 자동 사라진다.
- 모바일(`≤768px`)에서는 입력/저장 버튼이 세로 종막으로 전환되며 저장 버튼이 전체 넓이를 차지한다.

### 공개 플레이리스트 승인

```
유저 → visibility: 'public' 설정 → status: 'pending'
관리자 → /admin/playlists (승인 관리 UI 페이지)
       → GET /api/admin/playlists/pending (대기 목록 조회)
       → PUT /api/admin/playlists/{id}/approve 또는 reject
       → status: 'approved' → /playlists 목록에 노출
```

- 관리자 승인 UI는 `/admin/playlists` 정적 페이지(`src/pages/admin/playlists.astro`)에서 클라이언트 사이드 렌더링으로 동작한다.
- 로그인 상태 + 관리자 권한 검증 후 대기 목록을 표시한다.
- 각 카드에서 승인/반려/미리보기 버튼을 제공하며, 처리 완료 시 카드가 페이드아웃 후 제거된다.

- 에디터 플레이리스트(`playlist_type: 'editor'`)는 승인 절차를 거치지 않고 생성 즉시 `approved` 상태가 되어 목록에 노출된다. (Auto-approve)
### 좋아요 기능

```
유저 → POST /api/playlists/{id}/like (토글)
     → D1 playlist_likes INSERT/DELETE
     → { liked: boolean, like_count: number }
```

- 플레이리스트 상세 페이지와 트렌딩 페이지에서 좋아요를 누를 수 있다.
- 1인 1좋아요만 가능하며, 다시 누르면 취소되는 토글 방식이다.
- 좋아요 수는 트렌딩 순위 산정의 핵심 지표로 사용된다.

### 승인 기사 자동 추가 (auto-playlist)

> 참고: 기사 자동 플레이리스트 추가 기능은 2026-04-21부로 제거되었습니다. [ADR 0006](../decisions/0006-remove-auto-playlist-add.md) 참조.
```text
승인 webhook → functions/webhooks/submission-approved.ts
            → users.id = submitted_by_id 조회
            → 최근 플레이리스트 재사용 또는 `내 제출 기사` 자동 생성
            → curated 아이템 추가
미가입 사용자 → submissions 테이블에 deferred 저장
삭제 webhook  → functions/webhooks/submission-removed.ts → playlist_items/submissions 정리
```

- 자동 생성 플레이리스트는 `visibility: 'unlisted'`, `status: 'draft'`, `playlist_type: 'community'`, `is_auto_created = 1` 로 생성된다.
- 이미 같은 curated 기사가 존재하면 `DuplicateItemError`를 `already_exists` 응답으로 변환해 중복 삽입을 막는다.
- 제출 파이프라인(`scripts/process-submission.ts`)은 GitHub Issue 작성자의 numeric user id를 `submitted_by_id`로 함께 저장한다.

## 관련 파일

### 프론트엔드 (Astro 정적 페이지)

| 파일 | 역할 |
|------|------|
| `src/pages/p/new.astro` | 플레이리스트 생성 폼 (인증 필요) |
| `src/pages/my/playlists.astro` | 내 플레이리스트 관리 페이지 |
| `src/pages/search-index.json.ts` | 빌드 시 기사 검색용 정적 JSON 인덱스 생성 |
 `src/pages/playlists/index.astro` | 에디터+커뮤니티 플레이리스트 목록 (D1 API 기반) |
| `src/components/AddToPlaylist.astro` | 기사에 "플레이리스트에 추가" 드롭다운 |
| `src/pages/admin/playlists.astro` | 관리자 플레이리스트 승인/반려 UI 페이지 |
| `src/components/ArticleCard.astro` | 기사 카드 (각 기사에 AddToPlaylist 버튼 포함) |

### 백엔드 (Cloudflare Functions)

| 파일 | 역할 |
|------|------|
| `functions/p/[id].ts` | 유저 플레이리스트 SSR 렌더링 |
| `functions/api/playlists/index.ts` | GET(목록)/POST(생성) |
| `functions/api/playlists/[id]/index.ts` | GET/PUT/DELETE (개별 CRUD) |
| `functions/api/playlists/[id]/items/index.ts` | POST (기사 추가) |
| `functions/api/playlists/[id]/items/[itemId].ts` | PUT/DELETE (기사 수정/삭제) |
| `functions/api/playlists/[id]/items/swap.ts` | PUT (인접 swap — 프론트엔드 미사용, 하위호환 유지) |
| `functions/api/playlists/[id]/items/reorder.ts` | PUT (배치 재정렬 — `{ item_ids: string[] }` 수용, `db.batch()`로 원자 position 재할당) |
| `functions/api/playlists/[id]/visibility.ts` | PUT (공개 범위 변경) |
| `functions/api/admin/playlists/pending.ts` | GET (관리자: 승인 대기 목록) |
| `functions/api/admin/playlists/[id]/approve.ts` | PUT (관리자: 승인) |
| `functions/api/admin/playlists/[id]/reject.ts` | PUT (관리자: 반려) |
| `functions/api/playlists/[id]/like.ts` | GET/POST 좋아요 API |
| `functions/webhooks/submission-approved.ts` | 승인 기사 auto-playlist webhook |
| `functions/webhooks/submission-removed.ts` | 승인 취소/삭제 정리 webhook |

### 비즈니스 로직

| 파일 | 역할 |
|------|------|
| `functions/lib/playlists.ts` | 플레이리스트 CRUD, 공개 범위, 상태 관리 |
| `functions/lib/playlist-items.ts` | 아이템 추가/수정/삭제, 포지션 관리 (`reorderItems()` 배치 재정렬 포함) |
| `functions/lib/types.ts` | PlaylistRow, PlaylistDetail, UserPlaylistWithCount 등 타입 |
| `functions/lib/validate.ts` | 제목/설명 길이 검증, URL 검증 |
| `functions/lib/likes.ts` | 좋아요 토글, 상태 조회, 트렌딩 쿼리 |
| `functions/lib/webhooks.ts` | webhook Bearer secret 검증 |

### 데이터

| 파일 | 역할 |
|------|------|
 `migrations/0001_user_playlists.sql` | D1 테이블 스키마 (users, sessions, user_playlists, playlist_items) |
 `migrations/0002_playlist_type.sql` | `playlist_type`, `tags` 컬럼 추가 마이그레이션 |
| `migrations/0002_playlist_likes.sql` | playlist_likes 테이블 스키마 |
| `migrations/0004_auto_playlist.sql` | auto-created playlist / deferred submissions 스키마 |

## API 응답 형태

### `GET /api/playlists?mine=true`
```json
{
  "playlists": [
    {
      "id": "...",
      "user_id": "...",
      "title": "...",
      "description": "...",
      "playlist_type": "community|editor",
      "tags": "...",
      "visibility": "unlisted|public",
      "status": "draft|pending|approved|rejected",
      "item_count": 5,
      "contains_item": true,
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

### `GET /api/playlists` (공개 목록)
```json
{
  "playlists": [...],
  "total": 10,
  "page": 1,
  "totalPages": 1
}
```

## 인증 흐름

1. `GET /api/auth/github/login` → GitHub OAuth 리디렉션
2. GitHub → `GET /api/auth/github/callback` → 세션 생성 → `Set-Cookie: session={id}`
3. 이후 API 호출 시 쿠키 기반 인증 (`functions/api/_middleware.ts`에서 자동 처리)

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `D1_DATABASE` | `wrangler.jsonc` | — | Cloudflare D1 데이터베이스 바인딩 |
| `GITHUB_CLIENT_ID` | Cloudflare 환경변수 | — | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Cloudflare 환경변수 | — | GitHub OAuth App Client Secret |

## 제약 사항

- 유저 플레이리스트는 D1 데이터베이스 의존 → 마이그레이션 필수
- 공개 플레이리스트는 관리자 승인 후 `/playlists` 목록에 노출
- 기사 추가 시 스냅샷(title, url, description) 저장 → 원본 삭제돼도 정보 유지
- 아이템 타입: `curated` (큐레이션 기사), `feed` (피드 기사), `external` (외부 URL)
- YouTube 썸네일은 `url_snapshot` URL 기반 클라이언트 측 추출이므로, 삭제/비공개 동영상은 깨진 이미지로 표시될 수 있다
- 아이템 순서는 `position DESC`로 조회되어 최신 추가 아이템이 최상단에 표시된다. 소유자는 배치 편집 모드(SortableJS CDN 지연 로드)에서만 순서를 재배치할 수 있다.
- 배치 편집 모드는 소유자 + 아이템 2개 이상에서만 노출된다. CDN 로드 실패 시 alert 후 모드를 종료한다 (graceful degradation).

---

## 관련 문서

- [기사 관리 페이지](./article-management.md)
- [아키텍처 개요](../architecture/overview.md)
- [기사 승인 시 플레이리스트 자동 추가](./auto-playlist-add.md)
- [플레이리스트 데이터 미스매치 트러블슈팅](../troubleshooting/playlist-data-mismatch.md)
- [플레이리스트 검색 렌더링·순서 변경 트러블슈팅](../troubleshooting/playlist-detail-search-and-reorder.md)
- [플레이리스트 기사 링크 홈 리다이렉트 트러블슈팅](../troubleshooting/playlist-article-links-redirect-to-home.md)
- [배치 편집 드래그 위/아래 스크롤 비대칭 트러블슈팅](../troubleshooting/playlist-batch-edit-drag-scroll-asymmetry.md)
- [최신순 정렬 및 드래그 재정렬 (ADR 0005)](../decisions/0005-playlist-newest-first-and-drag-reorder.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 자동 플레이리스트 추가 제거 반영. /my/articles 페이지 링크 추가. |
| 2026-04-12 | 최초 작성 — 플레이리스트 기능 전체 문서화 |
| 2026-04-12 | AddToPlaylist 로그인 return URL, 중복 추가 409 처리, contains_item 기반 비활성화 표시 반영 |
| 2026-04-12 | 유저 플레이리스트 상세(`/p/{id}`)에 소유자 전용 아이템 삭제/재정렬/메모 수정 UI 반영 |
| 2026-04-12 | 유저 플레이리스트 상세(`/p/{id}`)에 기사 검색 추가와 외부 URL 추가 폼, `/search-index.json` 정적 인덱스 반영 |
| 2026-04-13 | ArticleCard 전체에 AddToPlaylist 버튼 추가, OAuth 복귀 URL 보존, source_id 검증, pending 기사 외부 링크 처리 — 전체 플레이리스트-기사 통합 구현 완료 |
| 2026-04-13 | 관리자 승인 UI 페이지(`/admin/playlists`) 문서화 반영 |
| 2026-04-13 | AddToPlaylist 드롭다운 UI 개선 — 브라우저 기본 버튼 스타일 리셋(`appearance`, `font-family`, `outline`), 아이템 간 `border-bottom` 제거, `focus-visible` 상태 추가. Navigation의 auth-dropdown 패턴과 시각적 일관성 확보 |
| 2026-04-13 | 에디터/커뮤니티 플레이리스트 통합 — playlist_type, tags 지원, 정적 시스템 제거 |
| 2026-04-13 | 좋아요 시스템 추가, 트렌딩 페이지 연동 |
| 2026-04-13 | 검색 결과 HTML `\n` 이스케이프 수정, 기사 수 동적 갱신(`updateItemCount`), 순서 변경 실패 시 reload 동기화 반영 |
| 2026-04-13 | 승인 기사 auto-playlist webhook, auto-created playlist 생성 규칙, deferred submissions 흐름 문서화 |
| 2026-04-13 | GitHub Actions 승인 감지와 OAuth catch-up 기반 auto-playlist 동기화 반영 |
| 2026-04-17 | YouTube 썸네일 표시, 2열 가로형 카드 레이아웃(좌측 썸네일), 기사 내부 링크 수정(source_id 기반), alias 페이지 canonical/Giscus 정규화, BaseLayout canonicalPath 프롭 추가, Comments 컨포넌트 data-giscus-term 지원 |
| 2026-04-21 | 플레이리스트 상세 페이지(`/p/{id}`) 소유자 전용 “🏷️ 태그 편집” 섹션 추가 — inline 태그 관리 UI(pill + Enter/쉼표 추가 + × 제거), `data-initial-tags` 속성 기반 XSS-safe 전달, PUT /api/playlists/{id} 호출, 리로드 없이 헤더 태그 디스플레이 즉시 갱신, DESIGN.md §4.4/§4.2 패턴 재사용. |
| 2026-04-21 | **최신순 정렬 + 드래그 재정렬 전환** — `ORDER BY position DESC`로 정렬 방향 역전, `↑`/`↓` 버튼 전면 제거, `📋 배치 편집` 토글 모드 + SortableJS 드래그 도입, 새 API `PUT /api/playlists/{id}/items/reorder`와 `reorderItems()` 함수 추가 (D1 `batch()`로 원자 position 재할당). DESIGN.md §4.8 Drag Handle, §4.9 Batch Edit Mode, §6 L9 Dragging Elevation 패턴 참조. |
| 2026-04-21 | 배치 편집 드래그 **자동 스크롤 활성화** — SortableJS `scroll`/`scrollSensitivity: 80`/`scrollSpeed: 20`/`bubbleScroll: true`/`forceAutoScrollFallback: true` 옵션 추가. 드래그 중 뷰포트 가장자리 근처에서 페이지 자동 스크롤되어 긴 플레이리스트의 먼 위치로 드래그 가능. 신규 토큰·UI 변경 없음. |
| 2026-04-21 | 배치 편집 드래그 자동 스크롤 속도 **2배 가속** — SortableJS `scrollSpeed: 20 → 40` (프레임당 40px, 60fps 기준 약 2,400px/s). 더 높은 속도로 드래그 중 스크롤할 수 있어 긴 플레이리스트 탐색이 더 경쯠해짐. `scrollSensitivity: 80`은 유지 — 감지 영역은 동일, 스크롤 개시 후 만 빠르게 이동.
| 2026-04-22 | 배치 편집 드래그 자동 스크롤 **위/아래 비대칭 버그 수정 + 커스텀 rAF 구현으로 교체** — SortableJS 내장 `scroll` 플러그인 비활성화(`scroll: false`)하고 `requestAnimationFrame` 기반 gradient 오토스크롤을 `onStart`/`onEnd`에 직접 연결. sticky `.nav` 헤더(60px)가 가리던 위쪽 edge 영역을 `.nav.getBoundingClientRect().bottom`으로 측정한 effective top edge로 보정. zone 120px, 속도 `4 → 32 px/frame` gradient (edge에 가까울수록 빠름). 이전 binary 속도로 인해 위 방향이 느리고 2단 계단식으로 느껴지던 현상 해소, 위/아래 모두 부드럽고 대칭적으로 스크롤됨. 참조: [troubleshooting/playlist-batch-edit-drag-scroll-asymmetry.md](../troubleshooting/playlist-batch-edit-drag-scroll-asymmetry.md).
| 2026-04-22 | 배치 편집 드래그 자동 스크롤 **후속 수정** — 앞 변경에서 `forceFallback: true` 옵션이 누락되어 SortableJS가 HTML5 native drag를 사용했고, native drag 중 브라우저가 `pointermove`를 window로 발화시키지 않아 커스텀 rAF 스크롤러가 `clientY`를 전혀 받지 못해 **위 방향 자동 스크롤이 완전히 멈추는** 회귀 발생. Sortable 옵션에 `forceFallback: true` + `fallbackTolerance: 3` 추가(클론 기반 시뮬레이션 드래그로 전환)로 해결. 트러블슈팅 문서의 예방 조치에 "커스텀 pointer 기반 auto-scroll 쓸 때는 `forceFallback` 필수" 항목 추가.
| 2026-04-22 | 배치 편집 **버튼 가시성 버그 수정 + entrance animation** — `.batch-edit-btn`(`📋 배치 편집`)과 `.batch-action-bar`(`취소`/`저장`)가 배치 편집 진입 전후에 **세 버튼이 동시에 보이던** 문제 해결. 원인: `.btn` 의 `display: inline-flex` 와 `.batch-action-bar` 의 `display: flex` 가 user-agent의 `[hidden] { display: none }` 를 덮어씀. `.batch-edit-btn[hidden], .batch-action-bar[hidden] { display: none !important; }` 명시 선언으로 HTML `hidden` 속성이 정상 동작하도록 복구. 부가로 action bar 등장 시 0.18s spring easing opacity+translateX 애니메이션으로 자연스러운 모드 전환 UX 제공(`prefers-reduced-motion: reduce` 존중). 툴바에 `min-height: 2.25rem` 로 레이아웃 점프 방지.
