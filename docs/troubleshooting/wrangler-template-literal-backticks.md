# wrangler 배포 시 esbuild 템플릿 리터럴 파싱 에러

> `functions/p/[id].ts` 의 JS 주석 안에 들어간 백틱(`) 이 바깥 템플릿 리터럴을 조기 종료시켜 wrangler pages deploy 실패한 건의 기록.

## 증상

`npx wrangler pages deploy dist --project-name=honeycombo --branch=master` 실행 시 다음 에러로 배포 실패:

```
X [ERROR] Expected ":" but found "zone"

    functions/p/[id].ts:1839:46:
      1839 │             // Upward scroll: pointer within `zone` px of (or above) the
           │                                               ~~~~
           ╵                                               :

X [ERROR] Build failed with 1 error:
  functions/p/[id].ts:1839:46: ERROR: Expected ":" but found "zone"
```

`bun run build` 와 `astro check` 에서는 에러가 나지 않고 **오직 wrangler 배포 단계에서만** 실패함.

## 원인

`functions/p/[id].ts` 는 Cloudflare Pages Function 으로 HTML 응답을 SSR 하는 파일이다. 페이지의 `<script>` 본문을 **TypeScript 템플릿 리터럴** 안에 길게 삽입하고 있다:

```ts
isOwner ? `<script>
  const playlistId = '${encodeURIComponent(playlist.id)}';
  // ... 약 800줄의 인라인 JS ...
  // Upward scroll: pointer within `zone` px of (or above) the   // ← 여기!
</script>` : '',
```

주석 안의 ``` `zone` ``` 는 독자가 코드 식별자를 강조하려는 의도였지만, 그 백틱이 **바깥 템플릿 리터럴을 조기 종료**시킨다. esbuild(= wrangler 가 내부적으로 쓰는 번들러) 는 그 이후부터를 새 JS 표현식으로 해석하려 시도하다 "콜론 `:` 자리에 식별자 `zone` 이 나왔다" 며 실패한다.

PR #175 의 auto-scroll 로직 추가 시 주석 안에 백틱을 섞어 쓴 것이 원인. 이전 PR 들의 같은 파일 주석에도 ``` `.nav` ``` 처럼 백틱이 섞여 있어 같은 패턴으로 잠재적 폭탄이었다. bun build / astro check 는 .astro 파일만 검사하므로 `functions/` 는 커버리지에서 빠지고, wrangler deploy 에서만 드러난 이유도 그것.

### esbuild 가 더 엄격했던 이유

bun 의 TypeScript 파서는 템플릿 리터럴 내부의 비매칭 백틱에 대해 관대하지만, esbuild 는 Spec 준수 파서라 동일 상황을 문법 에러로 처리한다. 두 번들러 간 관대함의 차이가 CI 패스-prod 배포 실패 라는 분리된 결과를 낳았다.

## 해결 방법

1. 주석 안의 백틱을 모두 **작은따옴표**로 치환한다 — 의미는 보존되고, 바깥 템플릿을 닫지 않는다.
2. `functions/p/[id].ts` 의 해당 주석 3개 (`zone`, `.nav`, `.nav's` ...) 를 모두 `'zone'`, `'.nav'`, `'.nav' bounding rect` 등으로 변경.

### 재발 방지 제안 (후속 작업)

- `functions/` 트리에 esbuild dry-run 을 CI 스텝으로 추가 검토 (PR 단에서 미리 실패하도록).
- 인라인 JS 주석에 마크다운 식별자 강조(`` `name` ``) 를 쓰지 말자는 가이드라인. SSR HTML 안의 JS 는 이미 **1단 중첩 문자열** 이므로 인용 부호를 하나 더 쓰는 순간 위험해진다.

## 관련 파일

- `functions/p/[id].ts` — 수정 대상. 라인 1800, 1809, 1839, 1848 의 주석에서 백틱 제거.
- `.github/workflows/ci.yml` — 현재 esbuild 검증 스텝 없음 (후속 제안 대상).
- `docs/features/playlists.md` — 페이지 SSR 구조 설명.

## 관련 문서

- [플레이리스트 시스템](../features/playlists.md)
- [Cloudflare Pages 자동 배포 실패](./cloudflare-pages-auto-deploy-failure.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-22 | 최초 작성 — PR #175 회귀로 인한 wrangler 배포 실패 진단과 해결 기록. |
