# Decap CMS Publish 드롭다운 텍스트 잘림

> Decap CMS의 Publish 버튼 드롭다운 메뉴 텍스트가 잘려서 보이지 않는 문제. CSS 수정이 반복 실패한 원인은 Astro의 scoped CSS.

## 증상

`/admin/#/` CMS 에디터에서 Publish 버튼의 드롭다운(▼)을 클릭하면 3개 옵션이 표시되지만, 텍스트가 잘려서 읽을 수 없음:

- ~~Publish now~~ → `Publi...`
- ~~Publish and create new~~ → `Publi...`
- ~~Publish and duplicate~~ → `Publi...`

**재현 환경**: Decap CMS 3.1.2 (CDN), Astro v6, 모든 브라우저

## 원인

**2단계 문제**:

### 1단계: Decap CMS의 Publish 드롭다운 고유 스타일 문제

Decap CMS의 `EditorToolbar.js`에서 `DropdownButton`에 `overflow: hidden; white-space: nowrap; text-overflow: ellipsis` 스타일이 적용되어 있다. 드롭다운 메뉴(`DropdownList`)가 버튼 너비에 맞춰 잘리는 경우가 있음.

### 2단계: Astro scoped CSS가 Decap CMS DOM에 매칭 불가 (근본 원인)

Astro의 `<style>` 블록은 빌드 시 **scoped CSS**로 컴파일된다:

```css
/* 소스 코드 */
#nc-root [role="menu"] > ul {
  min-width: max-content !important;
}

/* Astro 빌드 결과 — data-astro-cid 속성이 모든 셀렉터에 추가됨 */
#nc-root[data-astro-cid-2zp6q64z] [data-astro-cid-2zp6q64z][role=menu] > ul[data-astro-cid-2zp6q64z] {
  min-width: max-content !important;
}
```

Decap CMS는 CDN 스크립트가 런타임에 `#nc-root` 내부에 DOM을 동적 생성하므로, 이 요소들에는 `data-astro-cid-*` 속성이 존재하지 않는다. **결과적으로 CSS 셀렉터가 어떤 요소에도 매칭되지 않음.**

#### 추가 함정: Decap CMS의 CSS 셀렉터 난이도

Decap CMS는 `emotion` (CSS-in-JS)을 사용하여 클래스명이 `css-1abc2de` 같은 해시값으로 생성된다. 따라서 `[class*="Dropdown"]` 같은 속성 셀렉터는 매칭 불가. 대신 `react-aria-menubutton` 라이브러리가 부여하는 **ARIA 속성**(`role="menu"`, `role="menuitem"`)으로 타겟해야 한다.

DOM 구조:
```html
<div>                          <!-- Wrapper (StyledWrapper) -->
  <span role="button">         <!-- Button (DropdownButton) -->
    Publish
  </span>
  <div role="menu">             <!-- Menu (react-aria-menubutton) -->
    <ul>                        <!-- DropdownList (emotion styled ul) -->
      <div role="menuitem">     <!-- MenuItem -->
        <span>Publish now</span>
      </div>
    </ul>
  </div>
</div>
```

## 해결 방법

`<style>` 태그에 `is:global` 디렉티브를 추가하여 Astro의 scoped CSS를 비활성화한다:

```diff
- <style>
+ <style is:global>
    /* Decap CMS publish dropdown — prevent text truncation
       DOM: div[role="menu"] > ul (DropdownList) > div[role="menuitem"] */
    #nc-root [role="menu"] > ul {
      min-width: max-content !important;
      width: max-content !important;
      overflow: visible !important;
    }
    #nc-root [role="menuitem"] {
      white-space: nowrap !important;
      overflow: visible !important;
      text-overflow: unset !important;
    }
  </style>
```

빌드 결과:
```css
/* is:global — data-astro-cid 없이 출력 */
#nc-root [role=menu]>ul{min-width:max-content!important;...}
#nc-root [role=menuitem]{white-space:nowrap!important;...}
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/pages/admin.astro` | `<style is:global>` + ARIA 셀렉터 기반 드롭다운 스타일 오버라이드 |

## 예방 조치

Astro 페이지에서 **외부 CDN 스크립트가 생성하는 DOM**에 CSS를 적용할 때:

| 상황 | 해결 방법 |
|------|----------|
| 외부 스크립트(CDN)가 생성하는 DOM 전체 | `<style is:global>` 또는 `<style is:inline>` |
| 자체 `innerHTML`로 생성하는 동적 자식 요소 | `.static-parent :global(.dynamic-child)` |
| 정적 Astro 컴포넌트 | 기본 `<style>` (scoped) |

**체크리스트**:
1. 대상 DOM이 Astro 빌드 시 존재하는가? → 아니면 `is:global` 필수
2. CSS-in-JS 라이브러리를 쓰는가? → 클래스명 셀렉터 대신 **ARIA 속성**(`role`, `aria-*`) 또는 **구조 셀렉터**(`>`, `nth-child`) 사용
3. 빌드 결과물(`dist/`)에서 `data-astro-cid`가 셀렉터에 붙어 있는지 반드시 확인

---

## 관련 문서

- [Astro Scoped CSS + 동적 innerHTML 문제](./astro-scoped-css-dynamic-innerhtml.md) — 동일 근본 원인의 다른 변형
- [Decap CMS 로그인 Not Found](./decap-cms-login-not-found.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 |
