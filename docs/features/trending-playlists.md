# 트렌딩 플레이리스트

> 커뮤니티가 좋아하는 플레이리스트를 좋아요 수 기준으로 순위를 매겨 보여주는 기능. Astro View Transitions와 호환되도록 정적 shell + client fetch 구조를 사용한다.

## 개요

`/trending` 페이지는 승인된 공개 플레이리스트를 좋아요 수 기준으로 정렬하여 보여준다. 이전에는 기사 키워드 트렌딩 페이지였으나, 플레이리스트 인기 순위 페이지로 전환되었다. 현재는 Astro `BaseLayout.astro` 안에서 정적 shell을 빌드하고, 실제 데이터는 `/api/trending`을 클라이언트에서 fetch한다.

## 동작 흐름

### 트렌딩 페이지 조회
방문자 → /trending (Astro SSG)
       → `astro:page-load`에서 `/api/trending?page=N` fetch
       → getTrendingPlaylists(DB, page, limit, userId?)
       → 좋아요 수 DESC, updated_at DESC 정렬
       → 클라이언트 렌더링 (랭킹 카드 + 좋아요 버튼 + 페이지네이션)

- 인증 유저: 자신의 좋아요 여부 표시, 좋아요 토글 가능
- 비인증 유저: 좋아요 수만 표시, 클릭 시 GitHub 로그인으로 리다이렉션

### 좋아요 토글
유저 → POST /api/playlists/{id}/like
     → D1 playlist_likes INSERT/DELETE (토글)
     → { liked: boolean, like_count: number }

## 관련 파일

### 프론트엔드
| 파일 | 역할 |
|------|------|
| `src/pages/trending.astro` | 트렌딩 페이지 Astro shell + client-side 렌더링. `/playlists` 페이지와 동일한 카드 UI 패턴(`playlist-card`, `playlist-header`, `playlist-footer`, `playlist-curator`) 사용 |
| `functions/trending.ts` | 레거시 SSR fallback (직접 라우팅하지 않음). Astro 페이지와 동일한 `playlist-card` 구조 사용 |
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
| 2026-04-13 | Astro View Transitions 호환을 위해 `/trending`을 정적 shell + client fetch 구조로 전환 |
| 2026-04-14 | 카드 UI를 `/playlists` 페이지 패턴(`playlist-card`)으로 통일 — `trending-card` 구조 제거 |
| 2026-04-20 | **좋아요 버튼 레이아웃 시프트 해결** — `♡`(빈 하트, ≈ 12.8px)과 `♥`(채워진 하트, ≈ 7.6px) 유니코드 글리프의 고유 너비 차이로 좋아요 토글 시 버튼 폭이 ~1.8px 줄어들며 "좋아요" 레이블이 좌우로 틀어지는 현상을 해결. `.like-button-icon`을 `display: inline-flex; width: 1em; flex: 0 0 1em; justify-content: center`로 고정해 아이콘 박스를 1em 구간에 고정. 추가로 hover lift(`translateY(-1px)`) + active press 피드백 + is-liked 상태의 아이콘에 `scale(1.15)` 스프링 easing을 적용해 모던 InterestTagPanel 테마와 일관성 확보. 실측: 이전 button width 45.14 → 43.38 (Δ −1.76px), 수정 후 68.125 → 68.125 (Δ 0px), 레이블 좌표 동일. 파일: `src/pages/trending.astro`. |
