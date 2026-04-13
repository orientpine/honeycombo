# 트렌딩 플레이리스트

> 커뮤니티가 좋아하는 플레이리스트를 좋아요 수 기준으로 순위를 매겨 보여주는 기능.

## 개요

`/trending` 페이지는 승인된 공개 플레이리스트를 좋아요 수 기준으로 정렬하여 보여준다. 이전에는 기사 키워드 트렌딩 페이지였으나, 플레이리스트 인기 순위 페이지로 전환되었다.

## 동작 흐름

### 트렌딩 페이지 조회
방문자 → /trending
       → functions/trending.ts (SSR)
       → getTrendingPlaylists(DB, page, limit, userId?)
       → 좋아요 수 DESC, updated_at DESC 정렬
       → HTML 렌더링 (랭킹 카드 + 좋아요 버튼 + 페이지네이션)

- 인증 유저: 자신의 좋아요 여부 표시, 좋아요 토글 가능
- 비인증 유저: 좋아요 수만 표시, 클릭 시 GitHub 로그인으로 리다이렉션

### 좋아요 토글
유저 → POST /api/playlists/{id}/like
     → D1 playlist_likes INSERT/DELETE (토글)
     → { liked: boolean, like_count: number }

## 관련 파일

### 프론트엔드 (SSR)
| 파일 | 역할 |
|------|------|
| `functions/trending.ts` | 트렌딩 페이지 SSR 렌더링 |
| `functions/p/[id].ts` | 플레이리스트 상세 페이지 (좋아요 버튼 포함) |

### 백엔드
| 파일 | 역할 |
|------|------|
| `functions/lib/likes.ts` | 좋아요 토글, 상태 조회, 트렌딩 쿼리 |
| `functions/lib/types.ts` | PlaylistLikeRow, LikeStatusResponse, TrendingPlaylistItem 등 |
| `functions/api/playlists/[id]/like.ts` | GET/POST 좋아요 API |
| `functions/api/trending.ts` | GET 트렌딩 API (JSON) |

### 데이터
| 파일 | 역할 |
|------|------|
| `migrations/0002_playlist_likes.sql` | playlist_likes 테이블 스키마 |

## API

### GET /api/trending?page=1&limit=20
공개 승인 플레이리스트를 좋아요 순으로 반환.

### GET /api/playlists/{id}/like
좋아요 상태 조회. 인증 시 liked 필드 포함.

### POST /api/playlists/{id}/like
좋아요 토글 (인증 필요). 공개 승인 플레이리스트만 가능.

## 설정값
별도 설정값 없음. D1 데이터베이스 바인딩만 필요.

## 제약 사항
- 공개 승인(visibility='public', status='approved') 플레이리스트만 트렌딩에 노출
- 좋아요는 1인 1좋아요 (토글 방식)
- 랭킹: 좋아요 수 DESC, 동점 시 updated_at DESC

---

## 관련 문서
- [플레이리스트](playlists.md)
- [아키텍처 개요](../architecture/overview.md)
- [트렌딩 전환 ADR](../decisions/0002-trending-repurpose.md)

## 변경 이력
| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 — 트렌딩 플레이리스트 기능 문서화 |
