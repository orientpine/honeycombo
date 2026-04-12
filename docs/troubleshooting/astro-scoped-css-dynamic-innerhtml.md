# Astro Scoped CSS가 동적 innerHTML 요소에 적용되지 않는 문제

> Astro `<style>` 블록의 scoped CSS가 JavaScript로 동적 생성된 요소에 적용되지 않아 레이아웃이 깨짐

## 증상

로그인 후 네비게이션 바의 프로필 아바타 이미지가 원본 크기(수백 px)로 렌더링되어 전체 navbar 레이아웃을 깨뜨림. `width: 28px; height: 28px` CSS가 전혀 적용되지 않음.

**재현 환경**: Astro v6, 모든 브라우저. GitHub OAuth 로그인 후 발생.

## 원인

Astro의 `<style>` 블록은 빌드 시 **scoped CSS**로 컴파일된다. 각 선택자에 `data-astro-cid-*` 속성이 추가되고, 해당 컴포넌트의 정적 HTML 요소에도 같은 속성이 부여된다.

```css
/* 소스 */
.auth-avatar { width: 28px; }

/* 컴파일 결과 */
.auth-avatar[data-astro-cid-pux6a34n] { width: 28px; }
```

그러나 JavaScript `innerHTML`로 동적 생성된 요소에는 이 `data-astro-cid-*` 속성이 붙지 않는다. 결과적으로 선택자가 매칭되지 않아 CSS가 적용되지 않음.

추가로 글로벌 CSS `img { max-width: 100%; height: auto; }`가 적용되어 이미지가 원본 크기로 렌더링됨.

## 해결 방법

동적 생성 요소의 CSS 선택자를 `:global()` 래퍼로 감싸되, 정적 부모 요소를 앵커로 사용하여 스코핑을 유지한다.

```css
/* 변경 전 — 동적 요소에 적용 안 됨 */
.auth-avatar {
  width: 28px;
  height: 28px;
}

/* 변경 후 — 정적 부모(.auth-area) + :global() 자식 */
.auth-area :global(.auth-avatar) {
  width: 28px;
  height: 28px;
}
```

컴파일 결과: `.auth-area[data-astro-cid-pux6a34n] .auth-avatar` — 부모만 스코핑되고 자식은 unscoped로 매칭됨.

**Specificity**: `.auth-area[data-astro-cid-*] .auth-avatar` (0,3,0) > `img` (0,0,1) → 글로벌 img 규칙도 정상 오버라이드.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/Navigation.astro` | 모든 동적 auth UI 선택자를 `.auth-area :global(...)` 패턴으로 변경 |

## 예방 조치

Astro 컴포넌트에서 `innerHTML`로 동적 요소를 생성할 때는 반드시 scoped CSS가 적용되지 않음을 인지하고, `:global()` 래퍼를 사용해야 한다.

**패턴**: 정적 부모 요소를 앵커로 활용하여 `.static-parent :global(.dynamic-child)` 형태로 작성하면 글로벌 오염 없이 동적 요소를 스타일링할 수 있다.

---

## 관련 문서

- [Astro Scoped Styles 공식 문서](https://docs.astro.build/en/guides/styling/#scoped-styles)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
