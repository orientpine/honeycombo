# 0002: 트렌딩 페이지 목적 전환 (키워드 → 플레이리스트)

> 기사 키워드 트렌딩을 플레이리스트 인기 순위로 전환

## 상태

승인 (2026-04-13)

## 맥락

- `/trending` 페이지는 원래 RSS 피드 기사의 키워드 트렌드를 보여주는 페이지였다
- 주간 GitHub Actions로 `calc-trending.ts` 실행하여 정적 JSON 데이터 생성 → Astro SSG로 빌드
- 플레이리스트 기능이 추가되면서, 사용자들이 만든 플레이리스트의 인기를 확인할 수 있는 기능이 필요해짐
- `/trending`의 본래 목적은 "사람들이 많이 좋아하는 콘텐츠를 순위로 보여주는 것"

## 결정

`/trending` 페이지를 기사 키워드 트렌딩에서 **플레이리스트 좋아요 수 기반 인기 순위**로 전환한다.

### 주요 변경:
1. 정적 SSG → **동적 SSR** (Cloudflare Functions)
2. 키워드 기반 → **좋아요 수 기반** 랭킹
3. 주간 배치 → **실시간** 데이터
4. `playlist_likes` 테이블 신설 (D1)
5. 기존 키워드 트렌딩 시스템 완전 제거

## 고려한 대안

### 대안 1: 키워드 트렌딩과 플레이리스트 트렌딩 공존
- `/trending` = 키워드, `/trending/playlists` = 플레이리스트
- 기각 사유: 키워드 트렌딩의 실사용 가치가 낮고, 두 시스템 유지 비용 불필요

### 대안 2: 정적 빌드로 플레이리스트 순위 생성
- GitHub Actions로 주기적 좋아요 수 계산 → JSON → SSG
- 기각 사유: 좋아요가 실시간으로 변하므로 데이터가 항상 stale, D1에서 직접 쿼리가 자연스러움

## 결과

- `/trending`이 실시간 플레이리스트 인기 순위를 보여줌
- 사용자가 좋아하는 플레이리스트를 즉시 확인 가능
- 기존 키워드 트렌딩 관련 코드 완전 제거 (git 히스토리에 보존)
- 제거된 파일: `scripts/calc-trending.ts`, `src/schemas/trending.ts`, `src/components/TrendingTable.astro`, `src/pages/trending.astro`, `src/data/trending/`, `tests/calc-trending.test.ts`

---

## 관련 문서
- [트렌딩 플레이리스트 기능](../features/trending-playlists.md)
- [플레이리스트](../features/playlists.md)

## 변경 이력
| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 |
