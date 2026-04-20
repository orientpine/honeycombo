# 좋아요 버튼 토글 시 레이아웃이 좌우로 미세하게 흔들림

> `♡`(U+2661 hollow heart)와 `♥`(U+2665 black heart suit) 유니코드 글리프는 대부분의 폰트에서 **고유 너비가 서로 다르다**. 좋아요 토글 시 아이콘 글리프만 교체하면 inline-flex 컨테이너 폭이 변해 옆 텍스트가 좌우로 시프트한다. 해결: 아이콘을 `width: 1em` 박스에 가두고 중앙 정렬.

## 증상

`/trending` 페이지의 좋아요 버튼을 클릭하면 회색 → 주황색 변경 외에 **버튼 폭이 살짝 줄고 "좋아요" 글자가 좌측으로 미끄러진다**. 사용자 표현: "글자 간격이 변해서 이쁘지 않아."

```
[unliked]   ♡ 좋아요   (≈45px wide)
[liked]    ♥좋아요    (≈43px wide, label slid left ~2px)
```

## 원인

`.like-button-icon`이 단순 `<span>`이라 텍스트 노드(`♡` 또는 `♥`)의 **고유 너비**가 그대로 노출된다. 측정값(SF Pro / system-ui 기준):

| 글리프 | 고유 너비 |
|--------|----------|
| `♡` (U+2661, WHITE HEART SUIT) | ≈ 12.8px @ 0.8rem |
| `♥` (U+2665, BLACK HEART SUIT) | ≈ 7.6px @ 0.8rem |

차이 **5.2px**. inline-flex 컨테이너의 `gap: 6px`까지 합산되며 토글 시 버튼 width가 1.7~5px 변동한다. 옆에 있는 라벨이 좌우로 끌려가면서 시각적 jitter 발생.

같은 패턴이 다른 별표/하트/체크 토글 컴포넌트에서도 재발 가능 (예: `★` U+2605 vs `☆` U+2606 — 보통 비슷한 너비지만 폰트마다 다를 수 있음).

## 해결 방법

아이콘 컨테이너를 **고정 width의 flex 박스**로 만들어 글리프 너비 차이를 흡수한다.

```diff
 .like-button-icon {
+  display: inline-flex;
+  align-items: center;
+  justify-content: center;
+  width: 1em;
+  flex: 0 0 1em;
+  line-height: 1;
+  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
 }
+.like-button.is-liked .like-button-icon {
+  transform: scale(1.15);
+}
```

핵심 포인트:
1. **`width: 1em`** — 글리프와 무관한 고정 박스
2. **`flex: 0 0 1em`** — flex 컨테이너 안에서도 절대 줄어들지 않음
3. **`justify-content: center`** — 글리프가 박스 중앙에 정렬되어 토글 시 시각적 점프도 없음
4. (보너스) **`transform: scale(1.15)`** — `is-liked` 상태에 미세한 강조. transform은 레이아웃에 영향을 주지 않으므로 안전

검증 (Playwright 측정):

| 상태 | 수정 전 | 수정 후 |
|------|---------|---------|
| unliked button width | 45.14px | 68.13px |
| liked button width | 43.38px | 68.13px |
| **width Δ** | **−1.76px** ❌ | **0px** ✅ |
| label left position Δ | ~−2px | **0px** ✅ |

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/pages/trending.astro` | `.like-button-icon` 1em 고정 박스 + `.like-button.is-liked .like-button-icon` 스케일 강조 + 버튼 hover/active 마이크로 인터랙션 |

## 예방 조치

- **유니코드 심볼 토글이 있는 모든 컴포넌트**는 동일 패턴 적용. 후보: 북마크, 별표, 체크박스, 화살표.
- 새 토글 컴포넌트 추가 시 두 글리프의 너비 차이를 측정하지 말고 **항상 고정 박스로 감싸는 것을 디폴트**로 한다 (예방이 검증보다 싸다).
- SVG 아이콘으로 대체하는 것이 장기적으로 가장 안전 — SVG는 `viewBox` 기반이라 글리프 너비 가변성이 원천적으로 없다. 그러나 SVG로 즉시 마이그레이션 비용을 들이지 않더라도 1em 박스 패턴만 적용하면 즉시 해결됨.

---

## 관련 문서

- [트렌딩 플레이리스트](../features/trending-playlists.md)
- [관심사 & 태그 패널](../features/interest-tag-panel.md) — 같은 모던 디자인 시스템

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 — 좋아요 버튼 글리프 너비 시프트 진단 + 해결 |
