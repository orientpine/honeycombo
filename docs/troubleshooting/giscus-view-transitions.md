# Giscus 댓글 View Transitions 네비게이션 시 렌더링 안 됨

> 기사 클릭 시 댓글이 표시되지 않고, 새로고침 후에야 렌더링되는 버그

## 증상

기사 목록에서 기사를 클릭하면 댓글 영역이 비어 있다. 브라우저에서 새로고침(F5)하면 정상적으로 Giscus 댓글이 표시된다.

**재현 조건**:
1. 메인 페이지 또는 기사 목록 페이지 진입
2. 기사 카드 클릭 → 기사 상세 페이지 이동
3. 댓글 섹션이 비어 있음 (Giscus iframe 없음)
4. F5로 새로고침하면 정상 표시

**재현 환경**: 모든 브라우저 (Astro View Transitions 지원 브라우저)

## 원인

`BaseLayout.astro`에서 `<ClientRouter />`(Astro View Transitions)를 사용하고 있어, 페이지 간 이동 시 전체 페이지 리로드가 아닌 DOM swap이 발생한다.

`Comments.astro`에서 Giscus를 `<script src="https://giscus.app/client.js" is:inline>` 형태로 로드하고 있었는데, 외부 스크립트(`src` 속성)는 View Transitions의 DOM swap 시 브라우저가 재실행하지 않는다. 따라서 클라이언트 네비게이션으로 기사 상세 페이지에 진입하면 Giscus가 초기화되지 않는다.

새로고침 시에는 전체 페이지가 로드되므로 스크립트가 정상 실행되어 댓글이 표시된다.

## 해결 방법

정적 `<script src>` 태그를 제거하고, `astro:page-load` 이벤트에서 동적으로 Giscus 스크립트를 생성·삽입하는 방식으로 전환했다. 이 패턴은 `ArticleCard.astro`의 댓글 수 fetch 등 기존 코드베이스에서 이미 사용 중인 패턴이다.

```diff
- <script src="https://giscus.app/client.js"
-     data-repo="orientpine/honeycombo"
-     ...
-     is:inline
- ></script>
+ <div class="giscus"></div>
+
+ <script>
+ document.addEventListener('astro:page-load', () => {
+   const container = document.querySelector('.giscus');
+   if (!container) return;
+   container.innerHTML = '';
+   const script = document.createElement('script');
+   script.src = 'https://giscus.app/client.js';
+   // ... setAttribute로 모든 data 속성 설정
+   container.appendChild(script);
+ });
+ </script>
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/Comments.astro` | 정적 스크립트 → `astro:page-load` 동적 초기화로 전환 |

## 예방 조치

Astro View Transitions 환경에서 외부 스크립트를 사용할 때는 `<script src="..." is:inline>`을 직접 사용하지 말고, `astro:page-load` 이벤트 핸들러 내에서 동적으로 `document.createElement('script')`로 생성해야 한다. 기존 코드베이스의 `ArticleCard.astro`, `Navigation.astro` 등이 이 패턴을 따르고 있으므로 참고할 것.

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-14 | 최초 작성 |
