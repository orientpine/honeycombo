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
       → PUT /api/playlists/{id}/items/{itemId} (메모 수정, position 변경)
```

- 소유자에게만 상세 페이지 카드별 관리 버튼(`삭제`, `↑`, `↓`, `💬 메모 수정/추가`)을 노출한다.
- 삭제 성공 시 카드가 페이드아웃 후 DOM에서 제거되며, 헤더의 기사 수(`N개 기사`)가 자동으로 -1 갱신된다.
- 순서 이동은 인접 두 아이템의 `position`을 서로 바꾸는 방식으로 처리한다. 실패 시 `window.location.reload()`로 서버 상태를 즉시 동기화한다.
- 메모 수정은 카드 내부 인라인 에디터에서 수행하며, 저장 성공 시 화면 표시를 즉시 갱신한다.

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
| `functions/api/playlists/[id]/visibility.ts` | PUT (공개 범위 변경) |
| `functions/api/admin/playlists/pending.ts` | GET (관리자: 승인 대기 목록) |
| `functions/api/admin/playlists/[id]/approve.ts` | PUT (관리자: 승인) |
| `functions/api/admin/playlists/[id]/reject.ts` | PUT (관리자: 반려) |
| `functions/api/playlists/[id]/like.ts` | GET/POST 좋아요 API |

### 비즈니스 로직

| 파일 | 역할 |
|------|------|
| `functions/lib/playlists.ts` | 플레이리스트 CRUD, 공개 범위, 상태 관리 |
| `functions/lib/playlist-items.ts` | 아이템 추가/수정/삭제, 포지션 관리 |
| `functions/lib/types.ts` | PlaylistRow, PlaylistDetail, UserPlaylistWithCount 등 타입 |
| `functions/lib/validate.ts` | 제목/설명 길이 검증, URL 검증 |
| `functions/lib/likes.ts` | 좋아요 토글, 상태 조회, 트렌딩 쿼리 |

### 데이터

| 파일 | 역할 |
|------|------|
 `migrations/0001_user_playlists.sql` | D1 테이블 스키마 (users, sessions, user_playlists, playlist_items) |
 `migrations/0002_playlist_type.sql` | `playlist_type`, `tags` 컬럼 추가 마이그레이션 |
| `migrations/0002_playlist_likes.sql` | playlist_likes 테이블 스키마 |

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

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [플레이리스트 데이터 미스매치 트러블슈팅](../troubleshooting/playlist-data-mismatch.md)
- [플레이리스트 검색 렌더링·순서 변경 트러블슈팅](../troubleshooting/playlist-detail-search-and-reorder.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
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
