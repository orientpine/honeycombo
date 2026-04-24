# D1 마이그레이션 미적용으로 인한 런타임 SQL 에러

> 코드는 새 컬럼을 참조하지만 프로덕션 D1에는 해당 컬럼이 없어 `/api/playlists?mine=true`가 500을 반환하고 "내 플레이리스트" 페이지가 실패하던 문제. 코드 머지 전 D1 마이그레이션을 먼저 적용해야 한다.

## 증상

PR #188(`feat: 북마크를 '나중에 볼 기사' Read Later 플레이리스트로 통합`) 머지 후 로그인 상태로 `/my/playlists`에 접근하면 아래 에러 메시지만 노출된다.

```
플레이리스트를 불러오는데 실패했습니다.
```

네트워크 탭에서 `/api/playlists?mine=true`가 **500 Internal Server Error**를 반환하며, 내부 SQL 에러는 다음과 같다.

```
D1_ERROR: no such column: playlist_category
```

**재현 환경**: Cloudflare Pages Production(honeycombo) + D1 `honeycombo-db`, master 기준 브랜치 `feat/bookmark-read-later`(commit `0e4073a`).

## 원인

PR #188이 두 가지를 동시에 변경했다.

1. **코드**: `functions/lib/playlists.ts`의 모든 playlist SELECT 쿼리가 `playlist_category` 컬럼을 선택/정렬/필터에 사용하도록 변경됨 (예: `listUserPlaylists` L377, `getPlaylist` L221, `PLAYLIST_ROW_COLUMNS` L52).
2. **스키마**: `migrations/0005_playlist_category.sql`에서 `ALTER TABLE user_playlists ADD COLUMN playlist_category TEXT`로 새 컬럼을 추가.

Cloudflare Pages는 GitHub 연동으로 코드만 자동 배포하며 **D1 마이그레이션은 자동 적용하지 않는다**. 운영자는 별도 명령(`wrangler d1 migrations apply ...`)으로 수동 적용해야 하는데, 이 단계가 누락된 채 코드만 배포되어 런타임에서 `no such column` 에러가 발생했다.

즉 **코드가 스키마보다 앞서 배포된 배포 순서 버그**다.

## 해결 방법

프로덕션 D1에 누락된 마이그레이션을 즉시 적용한다.

```bash
# 1. 적용 대상 확인
npx wrangler d1 migrations list honeycombo-db --remote

# 2. 적용
npx wrangler d1 migrations apply honeycombo-db --remote

# 3. 검증 (컬럼 존재 확인)
npx wrangler d1 execute honeycombo-db --remote \
  --command "PRAGMA table_info(user_playlists);"

# 4. 재확인: pending 없음이어야 함
npx wrangler d1 migrations list honeycombo-db --remote
# → ✅ No migrations to apply!
```

적용 즉시 `/api/playlists?mine=true`가 정상 200을 반환하며, 북마크 토글(`/api/bookmarks/toggle`), 북마크 ID 조회(`/api/bookmarks/ids`), 레거시 마이그레이션(`/api/bookmarks/migrate`)도 모두 복구된다.

```diff
- SELECT ... playlist_category FROM user_playlists  -- ❌ no such column
+ SELECT ... playlist_category FROM user_playlists  -- ✅ 정상 동작
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `migrations/0005_playlist_category.sql` | 누락돼 있던 D1 마이그레이션 (`playlist_category` 컬럼 추가 + 부분 유니크 인덱스) |
| `functions/lib/playlists.ts` | `playlist_category`를 SELECT/ORDER/WHERE에 사용하는 모든 쿼리 |
| `functions/api/playlists/index.ts` | `/api/playlists?mine=true` 엔드포인트 (500을 반환하던 지점) |
| `src/pages/my/playlists.astro` | 에러 메시지를 노출하는 프론트엔드 (`loadPlaylists()` L106-131) |
| `.github/workflows/ci.yml` | CI. pending D1 마이그레이션을 감지하는 스텝이 추가됨 (예방 조치 참고) |
| `wrangler.jsonc` | D1 바인딩 및 `migrations_dir` 설정 |

## 예방 조치

### 1. 마이그레이션 우선 배포 체크리스트 (필수)

`migrations/` 하위에 새 `.sql` 파일을 추가하는 PR을 머지할 때는 **반드시** 아래 순서를 지킨다.

1. **로컬 검증**: `npx wrangler d1 execute honeycombo-db --local --file=migrations/NNNN_*.sql`로 문법/의도 확인.
2. **머지 직전 적용 대상 확인**: `npx wrangler d1 migrations list honeycombo-db --remote`로 pending 목록 확인.
3. **프로덕션 적용 선행**: **코드가 master로 머지되기 전에** `npx wrangler d1 migrations apply honeycombo-db --remote` 실행. (마이그레이션은 하위 호환 — 새 컬럼/인덱스 추가만 — 이어야 이 순서가 안전함.)
4. **컬럼 존재 검증**: `PRAGMA table_info(...)`로 기대 컬럼이 생겼는지 확인.
5. **코드 머지 및 배포**: PR 머지 → CI → Cloudflare Pages 자동 배포.
6. **스모크 테스트**: 프로덕션에서 영향받은 엔드포인트(`/api/playlists?mine=true`, `/my/playlists` 등)를 직접 확인.

하위 호환되지 않는 파괴적 마이그레이션(컬럼 삭제, 타입 변경 등)은 별도 결정 문서(`docs/decisions/`)를 먼저 작성하고 점진적 배포 전략을 세운 뒤에만 진행한다.

### 2. CI에서 pending 마이그레이션 감지 (적용 완료)

`.github/workflows/ci.yml`에 `migrations/` 경로 변경을 감지하면 경고를 띄우는 스텝을 추가했다. PR 리뷰 단계에서 `wrangler d1 migrations apply`를 잊지 않도록 상기시킨다.

> 해당 스텝은 `DETECT_D1_MIGRATIONS` 단계에서 `git diff --name-only origin/master...HEAD -- migrations/`를 검사한다. 새 마이그레이션 파일이 있으면 **차단은 하지 않지만** 요약 커멘트와 함께 리뷰어의 수동 적용을 요청한다. (CI 러너에 프로덕션 D1 쓰기 권한을 부여하지 않기 위한 의도적 설계.)

### 3. 배포 전 점검 루틴

코드만 머지하고 배포가 자동화돼 있다는 이유로 방심하지 말 것. **D1 스키마 변경은 수동 적용 단계**임을 기억한다. 모든 배포 전 다음 한 줄을 확인한다.

```bash
npx wrangler d1 migrations list honeycombo-db --remote
# 기대 결과: ✅ No migrations to apply!
```

---

## 관련 문서

- [Cloudflare Pages 자동 배포 미트리거 문제](./cloudflare-pages-auto-deploy-failure.md)
- [아키텍처 개요](../architecture/overview.md)
- [북마크/Read Later 기능](../features/bookmark-read-later.md)
- [플레이리스트 기능](../features/playlists.md)
- ADR: [북마크를 Read Later 플레이리스트로 통합](../decisions/0005-bookmark-as-read-later-playlist.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-24 | 최초 작성. PR #188 배포 후 `/my/playlists` 실패 사건 기록. 예방책: 체크리스트 + CI 감지 스텝 추가. |
