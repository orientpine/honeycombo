# Must-read 에디터 관리

> 에디터가 직접 필독 기사를 선정·관리하는 기능. D1 기반 저장, Astro 정적 shell + client fetch 공개 페이지 렌더링.

## 개요

Must-read는 에디터가 직접 선정한 필독 기사 목록이다. 기존 자동 계산 방식(`calc-must-read.ts` + trending JSON)에서 **에디터 수동 관리 모드**로 전환했다.

- **관리**: `/admin/must-read` 페이지에서 기사 검색 → 추가/삭제/순서 변경
- **공개**: `/must-read` Astro 페이지가 `/api/must-read`를 fetch해 D1 데이터 기반 렌더링
- **저장**: Cloudflare D1 `must_read_items` 테이블

## 동작 흐름

### 에디터 관리 흐름

```
에디터 → /admin/must-read → 로그인 확인 → admin 권한 확인
  → /search-index.json 로드 (기사 검색)
  → 기사 선택 → POST /api/admin/must-read (D1 저장)
  → 순서 변경 → PUT /api/admin/must-read/reorder
  → 삭제 → DELETE /api/admin/must-read/{id}
```

### 공개 페이지 렌더링

```
방문자 → /must-read (Astro SSG)
  → `astro:page-load`에서 `/api/must-read` fetch
  → D1 must_read_items 조회 (position 순)
  → 클라이언트 렌더링
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `migrations/0003_must_read_items.sql` | D1 테이블 스키마 |
| `functions/lib/must-read.ts` | DB CRUD 연산 |
| `functions/lib/types.ts` | `MustReadItemRow` 타입 정의 |
| `functions/api/admin/must-read/index.ts` | GET (목록) + POST (추가) API |
| `functions/api/admin/must-read/[id].ts` | DELETE (삭제) API |
| `functions/api/admin/must-read/reorder.ts` | PUT (순서 변경) API |
| `src/pages/must-read.astro` | 공개 페이지 Astro shell + client-side 렌더링 |
| `functions/api/must-read.ts` | 공개 Must-read JSON API |
| `functions/must-read.ts` | 레거시 SSR fallback (직접 라우팅하지 않음) |
| `src/pages/admin/must-read.astro` | 관리자 UI 페이지 |

## 설정값

| 변수 | 설명 |
|------|------|
| `ADMIN_GITHUB_IDS` | 쉼표 구분 GitHub 사용자 ID (관리자 권한) |
| `DB` | Cloudflare D1 바인딩 |

## API 명세

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| GET | `/api/admin/must-read` | 현재 목록 (position 순) | admin |
| POST | `/api/admin/must-read` | 기사 추가 | admin |
| DELETE | `/api/admin/must-read/{id}` | 기사 삭제 | admin |
| PUT | `/api/admin/must-read/reorder` | 순서 변경 | admin |

### POST body

```json
{
  "source_id": "2026/04/abc123",
  "item_type": "curated" | "feed",
  "title_snapshot": "기사 제목",
  "url_snapshot": "https://example.com/article",
  "source_snapshot": "출처명",
  "description_snapshot": "설명 (선택)"
}
```

### PUT /reorder body

```json
{ "ids": ["id1", "id2", "id3"] }
```

## D1 스키마

```sql
CREATE TABLE must_read_items (
  id                    TEXT PRIMARY KEY,
  source_id             TEXT NOT NULL,
  item_type             TEXT NOT NULL CHECK(item_type IN ('curated', 'feed')),
  title_snapshot        TEXT NOT NULL,
  url_snapshot          TEXT NOT NULL,
  source_snapshot       TEXT,
  description_snapshot  TEXT,
  position              INTEGER NOT NULL,
  added_by              TEXT NOT NULL,
  added_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 제약 사항

- 기사 데이터는 추가 시점의 스냅샷 — 원본이 변경되어도 must-read의 제목/URL은 유지
- 최대 항목 수 제한 없음 (권장: 10~15개)
- `search-index.json`은 빌드 시점 생성 — 최신 RSS 수집 기사는 다음 빌드 후 검색 가능
- 관리자만 접근 가능 (`ADMIN_GITHUB_IDS` 환경변수)

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [플레이리스트](playlists.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 자동 계산 → 에디터 수동 관리 모드 전환. D1/SSR 기반 구현 |
| 2026-04-13 | `/must-read`를 Astro View Transitions 호환 구조로 전환하고 `/api/must-read` 공개 API 추가 |
