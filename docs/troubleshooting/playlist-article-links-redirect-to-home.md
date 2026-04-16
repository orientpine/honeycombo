# 플레이리스트 기사 링크가 홈으로 리다이렉트되는 버그

> 플레이리스트 상세 페이지에서 큐레이션 기사 클릭 시 기사 상세 페이지 대신 홈으로 이동하는 문제

## 증상

`/p/{playlistId}` 플레이리스트 상세 페이지에서 "HoneyCombo 큐레이션" 기사를 클릭하면 해당 기사의 상세 페이지(`/articles/{slug}`)로 이동하지 않고 홈(`/`)으로 리다이렉트됨.

**재현 조건**: DB에 `source_id`가 year/month 디렉토리 접두사 없이 저장된 플레이리스트 아이템 (예: `submission-62-0e8bf03f`)

**재현 환경**: Production (Cloudflare Pages + D1)

## 원인

두 가지 근본 원인이 결합:

1. **`source_id` 형식 불일치**: `playlist_items` 테이블의 `source_id`가 `submission-62-0e8bf03f` (파일명만)로 저장되었으나, Astro content collection의 `entry.id`는 `2026/04/submission-62-0e8bf03f` (디렉토리 경로 포함). `functions/p/[id].ts`의 `getItemHref()`가 `/articles/${source_id}`로 URL을 구성하므로 `/articles/submission-62-0e8bf03f`라는 존재하지 않는 페이지로 링크됨.

2. **Feed 아이템 처리 오류**: `getItemHref()`가 `item_type === 'feed'`일 때 무조건 `url_snapshot`(외부 URL)을 반환했으나, feed 아이템도 `source_id`가 있으면 내부 기사 페이지가 존재함.

## 해결 방법

### 1. `[...slug].astro`에 하위 호환 slug 추가

```diff
- ...curatedEntries.map((entry) => ({
-   params: { slug: entry.id },
-   props: { entry, collection: 'curated' },
- })),
+ ...curatedEntries.flatMap((entry) => {
+   const paths = [{ params: { slug: entry.id }, props: { entry, collection: 'curated' } }];
+   const parts = entry.id.split('/');
+   if (parts.length > 1) {
+     const filename = parts[parts.length - 1];
+     paths.push({ params: { slug: filename }, props: { entry, collection: 'curated' } });
+   }
+   return paths;
+ }),
```

이로써 `/articles/submission-62-0e8bf03f`와 `/articles/2026/04/submission-62-0e8bf03f` 모두 동일 기사를 렌더링함.

### 2. `getItemHref()` 로직 수정

```diff
- if (item.item_type === 'external') return item.url_snapshot;
- if (item.item_type === 'feed') return item.url_snapshot;
- return `/articles/${item.source_id ?? ''}`;
+ if (item.item_type === 'external') return item.url_snapshot;
+ if (item.source_id) return `/articles/${item.source_id}`;
+ return item.url_snapshot;
```

`source_id`가 있는 모든 아이템(curated, feed)은 내부 기사 페이지로 링크.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/pages/articles/[...slug].astro` | `getStaticPaths`에서 filename-only slug 추가 생성 |
| `functions/p/[id].ts` | `getItemHref()` 수정: feed 아이템도 내부 링크 지원 |

## 예방 조치

- 플레이리스트에 기사 추가 시 `source_id`는 반드시 Astro content collection의 `entry.id` (디렉토리 경로 포함 형식)를 사용해야 함.
- `search-index.json.ts`가 이미 `e.id`를 사용하므로 신규 추가 시 올바른 형식이 저장됨.
- `AddToPlaylist.astro` 컴포넌트도 `entry.id` 기반 `articleId`를 전달하므로 신규 데이터는 정상.

---

## 관련 문서

- [플레이리스트 기능](../features/playlists.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-16 | 최초 작성 |
