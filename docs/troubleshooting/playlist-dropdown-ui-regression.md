# AddToPlaylist 드롭다운 UI 리그레션

> View Transitions 전체 리팩터링 시 기존 UI 수정이 부분 역전되어, 드롭다운이 auth-dropdown 패턴과 불일치하게 된 문제.

## 증상

플레이리스트 추가 드롭다운의 스타일이 앱의 다른 드롭다운(Navigation의 auth-dropdown)과 시각적으로 불일치.

- 드롭다운 모서리가 다른 메뉴보다 더 둥글게 표시 (`radius-lg` vs `radius-md`)
- 아이템 간 수평 간격이 auth-dropdown과 다름
- 아이템에 불필요한 `border-radius`가 적용되어 auth-dropdown 패턴과 불일치
- `.playlist-list`의 패딩 축이 뒤바뀜 (수직 → 수평)

**재현 환경**: 모든 브라우저, `/articles` 페이지에서 "➕ 플레이리스트에 추가" 버튼 클릭 시

## 원인

커밋 `e219357`에서 auth-dropdown 패턴에 맞춰 수정한 CSS가, 이후 View Transitions 적용 커밋 `25e6bc7`에서 컴포넌트 전체를 재작성(252 insertions, 168 deletions)하면서 **부분적으로 역전**됨.

구체적으로:
1. `.playlist-list`의 `padding: var(--space-xs) 0` (수직 패딩)이 `padding: 0 var(--space-xs)` (수평 패딩)으로 **값이 뒤바뀜**
2. `.playlist-dropdown`의 `border-radius`가 `var(--radius-md)`에서 `var(--radius-lg)`로 변경됨
3. `.playlist-item-btn`에 `border-radius: var(--radius-sm)`이 추가됨 (auth-dropdown 아이템에는 없음)
4. `.playlist-item-btn`의 `padding`이 `var(--space-sm)`으로 변경됨 (auth-dropdown은 `var(--space-sm) var(--space-md)`)

**근본 원인**: 대규모 리팩터링 시 기존 UI 수정 사항을 개별적으로 검증하지 않고 전체를 재작성하여, 세부 CSS 값이 의도치 않게 변경됨.

## 해결 방법

auth-dropdown (Navigation.astro) 패턴에 맞춰 4개 CSS 속성 수정:

```diff
 .playlist-dropdown {
-  border-radius: var(--radius-lg);
+  border-radius: var(--radius-md);
 }

 .playlist-list {
-  padding: 0 var(--space-xs);
+  padding: var(--space-xs) 0;
 }

 .playlist-list :global(.playlist-item-btn) {
-  padding: var(--space-sm);
+  padding: var(--space-sm) var(--space-md);
   /* ... */
-  border-radius: var(--radius-sm);
 }
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/AddToPlaylist.astro` | 드롭다운 및 아이템 CSS 4개 속성 수정 |
| `src/components/Navigation.astro` | 참조 기준 (auth-dropdown 패턴) — 변경 없음 |

## auth-dropdown 참조 패턴

새로운 드롭다운 구현 시, Navigation.astro의 auth-dropdown을 기준으로 일관성을 유지해야 한다:

```css
/* 드롭다운 컨테이너 */
border-radius: var(--radius-md);     /* 12px 아님, 8px */
padding: var(--space-xs) 0;          /* 수직 패딩 */
box-shadow: var(--shadow-md);
border: 1px solid var(--color-border);

/* 드롭다운 아이템 */
padding: var(--space-sm) var(--space-md);  /* 8px 16px */
/* border-radius 없음 — 풀 너비 호버 배경 */
```

## 예방 조치

1. **대규모 리팩터링 후 UI 회귀 테스트**: 컴포넌트를 전체 재작성할 때, 이전 커밋에서 수정된 CSS 값들을 개별적으로 diff 확인한다.
2. **드롭다운 일관성 체크리스트**: 새 드롭다운이나 기존 드롭다운 수정 시, auth-dropdown 패턴과 비교한다 (`border-radius`, `padding`, 아이템 스타일).
3. **`padding` 축 주의**: `padding: A B`에서 A는 수직, B는 수평. 값 순서가 뒤바뀌기 쉬우므로, 의미를 주석으로 남기는 것을 권장한다.
4. **TagFilter.astro 주의**: AddToPlaylist의 HTML 마크업을 인라인으로 복제하고 있으므로, AddToPlaylist 구조 변경 시 TagFilter도 함께 확인한다.
5. **`<style is:global>` 안에서 `:global()` 래퍼 금지**: 프로덕션 빌드에서 해당 CSS 룰이 제거된다. dev 모드에서는 정상 동작하므로 발견이 어렵다. 아래 「추가 발견」 섹션 참조.

## 추가 발견 — `<style is:global>` + `:global()` 프로덕션 빌드 문제

### 증상

드롭다운 내 플레이리스트 아이템 버튼이 브라우저 기본 스타일(appearance: auto, 회색 배경, 2px outset 테두리)로 렌더링. CSS 리셋(`appearance: none`, `background: none`, `border: none`)이 전혀 적용되지 않음.

**특징**: dev 모드(`bun run dev`)에서는 정상 동작하지만, 프로덕션 빌드(`bun run build`) 결과물에서만 발생.

### 원인

`<style is:global>` 블록 내에서 추가로 `:global()` 래퍼를 사용하면, Astro 프로덕션 빌더가 해당 CSS 룰을 **완전히 제거**함.

```css
/* ❌ 빌드 시 제거됨 */
<style is:global>
.playlist-list :global(.playlist-item-btn) {
  appearance: none;
  background: none;
}
</style>

/* ✅ 정상 동작 */
<style is:global>
.playlist-list .playlist-item-btn {
  appearance: none;
  background: none;
}
</style>
```

- `<style is:global>`은 이미 **모든 셀렉터를 글로벌로** 처리함
- 그 안에서 `:global()`을 중복 사용하면 빌더가 해당 룰을 제거하는 버그/의도치 않은 동작 발생
- dev 모드는 인라인 스타일 주입 방식이라 이 문제가 드러나지 않음

### 해결 방법

`:global()` 래퍼를 모두 제거하고 평범한 셀렉터로 변경:

```diff
- .playlist-list :global(.playlist-item-btn) {
+ .playlist-list .playlist-item-btn {

- .playlist-list :global(.playlist-auth-required) {
+ .playlist-list .playlist-auth-required {

- .playlist-list :global(.badge-added) {
+ .playlist-list .badge-added {
```

총 8개 셀렉터에서 `:global()` 제거.

### 검증 방법

이 문제는 빌드 결과물을 직접 검사해야 발견 가능:

```bash
# 빌드 후 셀렉터 존재 여부 확인
bun run build
grep 'playlist-item-btn' dist/articles/index.html

# 결과가 없으면 CSS가 누락된 것
```

또는 배포된 사이트에서 브라우저 DevTools로 computed style 확인:
- `appearance: auto` → CSS 미적용
- `appearance: none` → CSS 정상 적용

## 작업 회고 — 왜 간단한 작업이 오래 걸렸는가

**실제 수정 분량**: CSS 4줄 변경. 본래 5분이면 끝날 작업.

### 시간 소모 원인 분석

| 원인 | 소요 | 개선 방법 |
|------|------|----------|
| 과도한 탐색: explore 에이전트 3개를 병렬로 띄워 컴포넌트, 디자인 시스템, git 히스토리 전체 조사 | ~2분 대기 | CSS 패딩 값 하나 뒤바뀐 수준이면 explore 1개 + 직접 grep으로 충분 |
| dev 서버 삽질: Playwright 시각 검증을 위해 서버 시작 4회 실패 후 tmux로 해결 | ~3분 | 서버 시작은 tmux를 기본으로 사용 |
| **브랜치 미확인 (핵심 실수)**: 수정 후 커밋했으나 `git branch`를 안 쳐봐서 엉뚱한 브랜치(`fix/cf-functions-view-transitions`)에 커밋 | Oracle 검증 1회 추가 | **커밋 전 `git branch --show-current` 필수** |
| Oracle 검증 3회전: CSS 수정은 1회차에서 이미 정확하다고 확인됨. 2회차는 Navigation.astro 무관한 변경(dirty worktree), 3회차는 `.sisyphus/` 언트랙 파일 | 검증당 1~5분 | 커밋 전 `git status`로 clean 상태 확인 |

### 핵심 교훈

1. **커밋 전 `git branch` + `git status` 먼저 확인** — 이것만 했으면 검증 라운드 2개가 아예 없었음
2. **탐색 규모를 수정 규모에 맞출 것** — CSS 리그레션은 `git show <커밋>` + `grep`이면 원인 파악 가능. 에이전트 3개는 과잉
3. **dev 서버는 tmux로** — `bun run dev &`는 불안정. tmux 세션이 확실함
4. **worktree를 항상 clean하게 유지** — 무관한 변경이 남아있으면 검증 단계에서 반복적으로 걸림
---

## 관련 문서

- [hover-gap-dropdown.md](./hover-gap-dropdown.md) — 드롭다운 마우스 이동 시 닫힘 문제
- [astro-scoped-css-dynamic-innerhtml.md](./astro-scoped-css-dynamic-innerhtml.md) — Astro scoped CSS와 동적 innerHTML 이슈 (관련 문제)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-14 | 최초 작성 — View Transitions 리팩터링 후 드롭다운 UI 리그레션 기록 |
| 2026-04-14 | 추가 발견 — `<style is:global>` + `:global()` 프로덕션 빌드 누락 문제 기록 |
| 2026-04-14 | 플레이리스트 아이템에 📋 아이콘 추가 |
