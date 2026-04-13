# 0002: 플레이리스트 관리 시스템 통합

> 상태: **승인**

## 맥락

기존에 에디터 플레이리스트(정적 JSON)와 유저 플레이리스트(D1 DB)가 분리 운영되어 관리 주체가 불명확했음. 에디터가 JSON 파일을 직접 편집해야 해서 관리 UI가 없었음.

## 결정

D1 `user_playlists` 테이블에 `playlist_type` ('community' | 'editor') 컬럼을 추가하여 두 시스템을 통합. 관리자(admin)가 에디터 플레이리스트를 동일한 UI(`/my/playlists`, `/p/new`)에서 생성·관리할 수 있게 변경. 에디터 플레이리스트는 승인 없이 즉시 공개됨(auto-approve). `tags` 컬럼도 추가하여 태그 지원.

## 고려한 대안

### 대안 1: 정적 JSON 에디팅 UI 추가

- 장점: 기존 정적 파일 구조 유지
- 단점: git 기반 워크플로 복잡, 실시간 반영 불가
- 탈락 사유: 관리 효율성이 낮고 실시간 업데이트가 어려움

### 대안 2: 두 시스템 병행 유지

- 장점: 기존 코드 변경 최소화
- 단점: 관리 분산, 코드 중복
- 탈락 사유: 유지보수 비용이 증가하고 사용자 경험이 일관되지 않음

## 결과

정적 에디터 플레이리스트 시스템 제거 (src/data/playlists/, src/schemas/playlist.ts, src/pages/playlists/[id].astro, PlaylistCard.astro), D1 마이그레이션 필요 (0002_playlist_type.sql)

## 관련 파일

- `migrations/0002_playlist_type.sql`
- `src/data/playlists/` (삭제)
- `src/schemas/playlist.ts` (삭제)
- `src/pages/playlists/[id].astro` (삭제)
- `src/components/PlaylistCard.astro` (삭제)

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [플레이리스트](../features/playlists.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 |
