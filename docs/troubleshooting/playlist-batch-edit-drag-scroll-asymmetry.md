# 플레이리스트 배치 편집 드래그 시 위/아래 자동 스크롤 속도 비대칭

> 배치 편집 모드에서 아이템을 드래그해 스크롤할 때 **아래 방향은 2단(저속 + 매우 고속)**으로 빠르게 움직이는데 **위 방향은 2단이지만 2단 속도가 저속의 2배 정도에 그쳐** 체감상 훨씬 느린 문제가 있었다. 근본 원인과 커스텀 rAF 기반 오토스크롤로의 교체 기록.

## 증상

- `/p/{id}` 상세 페이지에서 소유자가 "📋 배치 편집" 버튼을 눌러 배치 편집 모드로 진입한다.
- 드래그 핸들(`⋮⋮`)을 잡고 아이템을 **아래로** 드래그 → 커서가 viewport 하단에 가까워질수록 페이지가 매우 빠르게 아래로 스크롤된다(원하는 UX).
- 같은 상태에서 아이템을 **위로** 드래그 → 커서가 viewport 상단에 가까워져도 스크롤이 미지근하게만 가속되고, 아래 방향만큼 빠르게 올라가지 않는다.
- 결과적으로 긴 플레이리스트에서 아이템을 **위로** 멀리 옮기는 작업이 아래로 옮기는 것보다 훨씬 오래 걸렸다.

**재현 환경**: 모든 데스크톱 브라우저(Chrome/Firefox/Safari), 모바일 터치도 동일. SortableJS v1.15.2, 사이트 공통 sticky `.nav`(height: `var(--nav-height)` = 60px) 레이아웃.

## 원인

실제 원인은 **두 가지 요인의 결합**이다.

### 1) SortableJS의 `scrollSpeed`는 binary on/off

SortableJS v1.15.2의 `plugins/AutoScroll/AutoScroll.js`(line 225–251)에서 수직 스크롤 속도 계산은 다음과 같다.

```js
let vy = canScrollY
  && (Math.abs(bottom - y) <= sens && (scrollPosY + height) < scrollHeight)
  - (Math.abs(top - y) <= sens && !!scrollPosY);
// ...
let scrollOffsetY = autoScrolls[this.layer].vy ? autoScrolls[this.layer].vy * speed : 0;
```

- `vy`는 `-1 | 0 | 1` (방향 지시자)이며 edge와의 거리에 비례한 가중치가 아니다.
- 최종 오프셋은 `vy * speed` → 존에 들어가는 순간 **항상 고정된 `scrollSpeed`**(설정값 40px/24ms = 약 1,667px/s)가 그대로 적용된다.
- 따라서 "가까이 갈수록 더 빠르게"라는 gradient는 존재하지 않는다. 사용자가 느낀 **2단**은 SortableJS만으로는 설명되지 않는다.

관련: [SortableJS #1907 — feature request: gradient scroll speed](https://github.com/SortableJS/Sortable/issues/1907)

### 2) sticky `.nav` 헤더가 위쪽 "완전한 edge" 도달을 막아 브라우저 네이티브 fast-scroll 미발동

- 사이트 공통 레이아웃(`functions/lib/layout.ts` line 225–231)은 `.nav`를 `position: sticky; top: 0; height: var(--nav-height); /* 60px */`로 렌더링한다.
- `SortableJS`는 `forceAutoScrollFallback: true`에서 자체 fallback 드래그(클론)를 사용하지만, 일부 브라우저는 여전히 커서가 viewport 최상단/최하단 수 px에 도달했을 때 추가적인 auto-scroll을 발동한다(사용자가 "2단"이라고 표현한 **매우 고속** 구간).
- **아래 방향**은 커서가 viewport 하단(`y ≈ innerHeight`)까지 도달 가능 → 이 fast-scroll이 발동 → 매우 빠르게 내려감.
- **위 방향**은 커서가 `.nav` 아래 약 60px에서 멈춘다(sticky 헤더가 시각적으로 가리고 있고, 실제로도 네이티브 fast-scroll 트리거 zone이 `.nav` 영역 뒤로 숨겨진다) → fast-scroll 미발동 → SortableJS의 binary speed만 남음 → "저속의 2배 정도"로만 보임.

**결과**: 알고리즘 자체는 대칭이지만, 환경(sticky header)이 비대칭을 유발한다.

## 해결 방법

**SortableJS의 `scroll` 플러그인을 완전히 비활성화**하고, `requestAnimationFrame` 기반 **커스텀 gradient 오토스크롤**로 교체한다. 드래그 시작 시 `.nav.getBoundingClientRect().bottom`을 측정해 **effective top edge**로 사용하므로 sticky 헤더 offset이 자동 보정되고, edge와의 거리에 비례해 속도가 증가하는 gradient 공식을 위/아래 **동일하게** 적용한다.

### 핵심 변경

```diff
- sortableInstance = window.Sortable.create(itemsContainer, {
-   handle: '.drag-handle',
-   animation: 150,
-   ghostClass: 'sortable-ghost',
-   chosenClass: 'sortable-chosen',
-   dragClass: 'sortable-drag',
-   scroll: true,
-   scrollSensitivity: 80,
-   scrollSpeed: 40,
-   bubbleScroll: true,
-   forceAutoScrollFallback: true
- });
+ sortableInstance = window.Sortable.create(itemsContainer, {
+   handle: '.drag-handle',
+   animation: 150,
+   ghostClass: 'sortable-ghost',
+   chosenClass: 'sortable-chosen',
+   dragClass: 'sortable-drag',
+   scroll: false,                  // 내장 auto-scroll 비활성화
+   onStart: function() { startAutoScroll(); },
+   onEnd:   function() { stopAutoScroll(); }
+ });
```

### 커스텀 오토스크롤 알고리즘 (요약)

- **감지 영역**: `AUTO_SCROLL_ZONE = 120px` (이전 SortableJS의 80px보다 넓어 도달하기 쉬움)
- **속도 범위**: `AUTO_SCROLL_MIN_SPEED = 4 px/frame` → `AUTO_SCROLL_MAX_SPEED = 32 px/frame` (60fps 기준 최대 약 1,920 px/s)
- **Effective top edge**: `nav.getBoundingClientRect().bottom` — sticky 헤더 높이만큼 top edge를 아래로 이동
- **Effective bottom edge**: `window.innerHeight`
- **Gradient 공식** (위/아래 동일):
  ```
  t = (edge에 가까울수록 1, 멀어질수록 0)
  speed = MIN + (MAX - MIN) * t
  ```
- **Over-shoot 방지**: `window.scrollBy` 전에 `document.scrollHeight - innerHeight - scrollY`로 clamp
- **이벤트**: `window`에 `pointermove`와 `touchmove`(모두 `{ passive: true }`)를 걸어 `clientY` 추적
- **라이프사이클**: `onStart`에서 rAF 시작, `onEnd`/`exitBatchMode`에서 rAF 취소 + 리스너 제거

전체 구현은 `functions/p/[id].ts`의 `readAutoScrollBounds`, `computeAutoScrollVelocity`, `autoScrollTick`, `onDragPointerMove`, `startAutoScroll`, `stopAutoScroll` 함수를 참조.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `functions/p/[id].ts` | SortableJS `scroll: false`로 전환, `requestAnimationFrame` 기반 커스텀 오토스크롤러 추가, `onStart`/`onEnd`에서 라이프사이클 연결 |
| `docs/features/playlists.md` | 자동 스크롤 설명을 SortableJS 옵션 기반 → 커스텀 rAF gradient 기반으로 업데이트 |

## 예방 조치

- **Sticky/fixed 헤더가 있는 레이아웃**에서 브라우저의 drag-at-edge fast-scroll에 의존하지 말 것. 헤더 높이를 명시적으로 보정한 effective edge를 사용하자.
- **SortableJS의 `scrollSpeed`는 gradient가 아니다**. 부드러운 가속감을 원하면 커스텀 스크롤러가 필요하다. `#1907` 이슈가 해결되기 전까지는 동일하다.
- 커스텀 rAF 스크롤러를 쓸 때는 반드시 (1) 문서 경계 clamp, (2) 드래그 종료/배치 모드 종료에서의 확실한 `cancelAnimationFrame` + 리스너 해제를 보장할 것(메모리 누수/멈춤 방지).

---

## 관련 문서

- [플레이리스트 기능](../features/playlists.md)
- [최신순 정렬 및 드래그 재정렬 (ADR 0005)](../decisions/0005-playlist-newest-first-and-drag-reorder.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-22 | 최초 작성 — 위/아래 비대칭 원인 규명(SortableJS binary speed + sticky nav) 및 커스텀 rAF gradient 오토스크롤로 교체 기록 |
