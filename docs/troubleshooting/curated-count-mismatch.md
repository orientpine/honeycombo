# 에디터 추천 카운트 불일치 (curated count mismatch)

> SourceFilter에서 에디터 추천 카운트가 1로 표시되나 실제 기사가 없는 문제

## 증상

`/articles/?origin=curated` 페이지에서 "에디터 추천 1"로 표시되나, 필터 클릭 시 기사가 0건 표시됨.

**재현 환경**: 프로덕션 (https://honeycombo.pages.dev/articles/?origin=curated)

## 원인

두 가지 문제가 복합적으로 작용:

### 1. 샘플 데이터가 프로덕션에 approved 상태로 존재

`src/content/curated/2026/04/sample-article.json` 파일이 `"status": "approved"` 상태로 남아 있어서
`getCollection('curated', entry => entry.data.status === 'approved')` 쿼리에 1건 매칭됨.

### 2. 카운트/필터 구조적 불일치

- 카운트는 **전체 기사 기준**(글로벌)으로 계산: `articles/index.astro` line 43
- 필터는 **현재 페이지에 렌더링된 카드**에만 적용: `SourceFilter.astro` 클라이언트 JS
- 샘플 기사는 날짜순 198번째(page 10)에 위치하여 page 1에서 필터링 시 0건 노출

## 해결 방법

### 1. 샘플 데이터 삭제

```diff
- src/content/curated/2026/04/sample-article.json  (파일 삭제)
```

### 2. SourceFilter에 page-local 카운트 재계산 + 빈 상태 표시 추가

`src/components/SourceFilter.astro` 수정:

- `initSourceFilter()`에서 DOM의 `data-origin` 속성 기반으로 카운트 재계산 (서버 전달 글로벌 카운트 → 페이지 로컬 카운트로 덮어쓰기)
- `filterByOrigin()`에서 visible 카드가 0개일 때 "이 페이지에 해당하는 기사가 없습니다." 메시지 표시

### 3. Astro 빌드 캐시 주의

`node_modules/.astro/data-store.json`에 삭제된 컨텐츠가 캐시로 남아 빌드에 반영되는 문제 발견.
컨텐츠 파일 삭제 후 빌드 시 반드시 캐시 정리 필요:

```bash
rm -rf .astro node_modules/.astro/data-store.json dist && bun run build
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/content/curated/2026/04/sample-article.json` | 삭제 |
| `src/components/SourceFilter.astro` | page-local 카운트 재계산 + 빈 상태 UI 추가 |

## 예방 조치

- curated 컬렉션에 테스트/샘플 데이터를 `status: "approved"`로 두지 않는다.
- 향후 실제 curated 기사 추가 시, SourceFilter의 page-local 카운트 재계산 로직이 카운트/필터 불일치를 방지한다.
- 컨텐츠 파일 삭제 후 빌드 시 `node_modules/.astro/data-store.json` 캐시 정리 필요.

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 |
