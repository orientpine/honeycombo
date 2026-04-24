# 북마크 — 나중에 볼 기사 (Read Later)

> 사용자가 관심 있는 기사를 북마크하여 '나중에 볼 기사' 플레이리스트에 자동으로 저장하고 관리하는 기능.

## 개요

기존의 localStorage 기반 북마크 시스템은 브라우저나 디바이스가 바뀌면 데이터가 유지되지 않는 한계가 있었다. 이를 해결하기 위해 Cloudflare D1 데이터베이스 기반의 '나중에 볼 기사' 플레이리스트로 통합했다. 사용자가 북마크 버튼을 누르면 서버에 비공개 플레이리스트가 자동으로 생성되며, 모든 디바이스에서 동기화된 북마크 목록을 확인할 수 있다.

## 동작 흐름

### 1. 북마크 토글
```
사용자 클릭 → Optimistic UI (아이콘 변경) 
           → POST /api/bookmarks/toggle 
           → D1 user_playlists (read_later 카테고리) & playlist_items 업데이트
           → sessionStorage 캐시 (honeycombo:bookmark-ids) 갱신
```

### 2. 페이지 로드 시 상태 복원
```
페이지 로드 → sessionStorage 캐시 확인
           → (캐시 없음) GET /api/bookmarks/ids 
           → sessionStorage 캐시 저장
           → UI 반영 (북마크된 기사 표시)
```

### 3. localStorage 마이그레이션
```
첫 로그인 후 BookmarkButton 초기화 
           → 기존 localStorage (honeycombo:bookmarks) 검사 
           → (데이터 존재 시) POST /api/bookmarks/migrate (최대 200개)
           → D1 저장 완료 후 localStorage 제거
           → "N개의 북마크를 '나중에 볼 기사'로 옮겼습니다." 토스트 표시
```

### 4. 북마크 조회 및 관리
```
사용자 → /my/playlists (내 플레이리스트 목록)
       → '나중에 볼 기사' 카드 클릭 (🔖 배지 표시)
       → /p/{id} (플레이리스트 상세 페이지)
       → 항목 확인, 메모 추가, 순서 변경 등 수행
```

### 5. 상세 페이지에서 삭제 시 북마크 UI 동기화

Read Later 플레이리스트 상세 페이지(`/p/{id}`)에서 기사 카드의 “삭제” 버튼을 누르면 해당 기사가 플레이리스트에서 제거되는 동시에 북마크 상태 또한 해제되어야 한다. `functions/p/[id].ts`는 Read Later 플레이리스트일 때 삽입되는 `syncBookmarkRemoval()` 헬퍼를 사용해 다음을 수행한다.

1. `sessionStorage['honeycombo:bookmark-ids']` 목록에서 해당 `source_id`를 제거.
2. 현재 로드된 DOM 내의 `[data-bookmark-id="{source_id}"]` 버튼에서 `bookmarked` 클래스와 `aria-pressed`를 해제.

이 동기화는 `item-card` 태그에 서버가 렌더링한 `data-source-id`/`data-item-type` 속성을 읽어 동작하므로, 외부 URL 항목처럼 `source_id`가 없는 항목은 북마크 개념과 무관하므로 아무 작업도 하지 않는다.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `migrations/0005_playlist_category.sql` | `playlist_category` 컬럼 및 유니크 인덱스 추가 |
| `functions/lib/playlists.ts` | `read_later` 카테고리 생성 및 보호 로직 (`ReadLaterProtectedError`) |
| `functions/api/bookmarks/toggle.ts` | 북마크 토글 API |
| `functions/api/bookmarks/ids.ts` | 북마크된 ID 목록 조회 API |
| `functions/api/bookmarks/migrate.ts` | localStorage 데이터를 D1으로 마이그레이션하는 API |
| `src/components/BookmarkButton.astro` | 북마크 버튼 UI 및 클라이언트 사이드 로직 (마이그레이션 포함) |
| `src/pages/my/playlists.astro` | 내 플레이리스트 목록에서 Read Later 특수 UI 처리 |
| `functions/p/[id].ts` | Read Later 상세 페이지 전용 헤더 및 컨트롤 제어 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `honeycombo:bookmark-ids` | sessionStorage | `[]` | 클라이언트 사이드 북마크 상태 캐시 (source_id 배열) |
| `honeycombo:bookmarks` | localStorage | — | (레거시) 구버전 북마크 데이터, 마이그레이션 후 삭제됨 |
| `playlist_category` | D1 테이블 | `'read_later'` | 자동 생성된 북마크 플레이리스트를 식별하는 값 |
| `Max migration batch` | `/api/bookmarks/migrate` | `200` | 한 번에 마이그레이션 가능한 최대 아이템 수 |

## 제약 사항

- **로그인 필수**: D1 데이터베이스를 사용하므로 로그인이 필요하다. 미로그인 상태에서 클릭 시 로그인 페이지로 리다이렉트된다.
- **동기화 타이밍**: sessionStorage 캐시를 사용하며, 브라우저 탭을 새로고침하거나 다른 기기에서 접속 시 서버에서 최신 상태를 재조회한다.
- **자동 마이그레이션 조건**: `#all-articles-data` JSON 데이터가 포함된 페이지(기사 목록 등)에서만 마이그레이션이 트리거된다.
- **삭제 및 설정 변경 제한**: '나중에 볼 기사' 플레이리스트는 삭제하거나 공개 범위를 변경할 수 없다. (`ReadLaterProtectedError` 가드 적용)
- **중복 방지**: 동일한 기사는 하나의 플레이리스트에 중복해서 추가될 수 없다. (UNIQUE 제약)

---

## 관련 문서

- [플레이리스트](./playlists.md)
- [기사 상세페이지 커뮤니티 기능](./article-detail-community.md)
- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-23 | 최초 작성. 북마크를 D1 기반 Read Later 플레이리스트로 통합 |
| 2026-04-24 | 상세 페이지에서 기사 삭제 시 북마크 UI 미동기화 버그 수정. `syncBookmarkRemoval()` 헬퍼 추가 및 `item-card` 태그에 `data-source-id`/`data-item-type` 속성 렌더링. |
