# Astro scoped 스타일이 innerHTML 렌더링 DOM에 적용되지 않음

> Astro는 scoped `<style>` 블록을 `data-astro-cid-*` 속성 기반으로 격리한다. JS에서 `innerHTML`로 동적 렌더링한 요소는 이 속성이 없어서 scoped 스타일이 매칭되지 않는다. 해결: Astro의 per-selector `:global()` 이스케이프 해치를 사용해 부모는 scoped 유지, 동적 자식만 global 처리.

## 증상

`InterestTagPanel.astro`에서 `refreshTopRow()`가 `row.innerHTML = ...`로 칩을 동적 렌더링한다. 이 칩들은 scoped `<style>` 블록의 규칙이 **매칭되지 않아** 활성 상태 스타일이 보이지 않음.

```ts
// refreshTopRow() 내부
row.innerHTML = `<span class="itp-chip-wrap active">
  <button class="itp-chip active" ...>...</button>
  <button class="itp-chip-star" ...>☆</button>
</span>`;
```

브라우저에서 확인:

```js
const wrap = document.querySelector('.itp-chip-wrap.active');
console.log(Array.from(wrap.attributes).map(a => a.name));
// SSR로 렌더링된 칩: ["class", "data-astro-cid-l37up36j"]
// JS로 렌더링된 칩: ["class"]   ← 속성 없음!
```

`<style>` 내부에 정의된 `.itp-chip-wrap.active { background: var(--color-primary); }`는 실제로 `.itp-chip-wrap[data-astro-cid-l37up36j].active`로 컴파일되어 있어서 동적 칩에 매칭되지 않음.

## 원인

Astro scoped 스타일은 [빌드 타임에 모든 선택자에 `[data-astro-cid-*]` 속성 매처를 추가](https://docs.astro.build/en/guides/styling/#scoped-styles)한다. 이는 컴포넌트 내부 SSR 요소에만 유효하며, JS가 런타임에 만든 DOM에는 속성이 없다.

흔한 잘못된 해법:
1. **전체 `<style is:global>`로 변경** → 모든 선택자가 사이트 전역에 노출됨. `.itp-*` 접두사로 충돌 위험은 낮지만, 이름 위생이 무너지면 잠재 위험. 유지보수자가 실수할 수 있음.
2. **런타임에 `data-astro-cid-*` 주입** → `cid`는 빌드 타임 생성값이라 런타임에서 확실히 얻을 방법이 없음. 굳이 하려면 `define:vars`로 노출해야 하지만 복잡.

## 해결 방법

Astro는 scoped `<style>` 블록 **내부**에 [`:global()` per-selector 이스케이프 해치](https://docs.astro.build/en/guides/styling/#global-styles)를 제공한다. 부모 선택자는 scoped, 괄호 안의 자식만 global로 처리된다.

```astro
<style>
  /* 컨테이너는 scoped 유지 (사이트 전역 노출 방지) */
  .interest-tag-panel {
    background: linear-gradient(...);
    border: 1px solid var(--color-border);
    /* ... */
  }

  /* 내부 동적 선택자는 :global()로 처리 */
  .interest-tag-panel :global(.itp-chip-wrap.active) {
    background: var(--color-primary);
    box-shadow: 0 2px 8px rgba(245, 124, 34, 0.3);
  }
</style>
```

컴파일 결과:

```css
/* 컨테이너: 여전히 scoped */
.interest-tag-panel[data-astro-cid-l37up36j] { ... }

/* 내부: global (data-astro-cid 없음) */
.interest-tag-panel[data-astro-cid-l37up36j] .itp-chip-wrap.active { ... }
```

→ **부모에 대한 scoping으로 사이트 전역 노출을 방지**하면서, **자식 선택자는 scoping을 피해** 동적으로 생성된 DOM에도 매칭된다.

**적용 효과**:

| 선택자 | 패턴 | 설명 |
|--------|------|------|
| `.interest-tag-panel` | (scoped) | 컨테이너. `data-astro-cid-*`가 SSR로 부여되므로 그대로 scoped. |
| `.interest-tag-panel :global(.itp-header)` | scoped 부모 + global 자식 | SSR 자식이지만 일관성 위해 동일 패턴. |
| `.interest-tag-panel :global(.itp-chip-wrap)` | scoped 부모 + global 자식 | **핵심** — 동적 렌더링 시 scope 속성 없으므로 `:global()` 필수. |

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/InterestTagPanel.astro` | scoped `<style>` 내부 모든 `.itp-*` 선택자를 `.interest-tag-panel :global(...)` 패턴으로 래핑. 컨테이너 `.interest-tag-panel`만 순수 scoped. 두 번째 `<style is:global>` 블록(`.article-card.interest-match`)은 복합 선택자로 이미 안전 — 변경 없음. |

## 예방 조치

- **`.itp-` 접두사 규칙 유지**: 동적 DOM에 대응하는 선택자를 추가할 때 반드시 고유 접두사 사용. 만약의 `:global()` 누수에도 충돌 위험을 낮춤.
- **`<style is:global>` 전체 블록 변환 금지**: 가능한 `:global()` per-selector 사용. 스타일 범위를 물리적으로 격리한다는 시각적 신호를 유지.
- 런타임에 만든 DOM을 관찰할 때는 `Element.attributes`를 확인해 `data-astro-cid-*`가 있는지 먼저 점검하면 스타일 미적용 원인 파악이 빠르다.

---

## 관련 문서

- [관심사 & 태그 패널 (InterestTagPanel)](../features/interest-tag-panel.md)
- [Astro 공식 문서 — :global()](https://docs.astro.build/en/guides/styling/#global-styles)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 — InterestTagPanel 리디자인 중 동적 칩 스타일 미적용 이슈 해결 기록 |
