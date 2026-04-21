# 좋아요 버튼 — 눌러진(liked) 후 하트 아이콘이 보이지 않는 문제

> PR #140에서 default 상태에 rose tint를 적용한 뒤 발생한 후속 버그. liked 상태(핑크 그라데이션 배경)에서 하트 아이콘이 default tint(`#d67a8d`)로 남아 배경과 섞여 사실상 보이지 않던 문제를 `color: inherit`로 해결한 기록.

## 증상

PR #140 머지 이후 `/trending` 페이지에서 좋아요를 눌러 liked 상태로 전환하면:

- 버튼 배경: 핑크 그라데이션 (`#ff5a7a` → `#e74c6f`)
- 버튼 color(카운트 숫자): 흰색 (`--color-like-contrast-text`, `#ffffff`) — 정상
- **하트 아이콘: 여전히 `#d67a8d` soft rose** — 핑크 배경과 색이 섞여 **시각적으로 거의 안 보임**

사용자 인식: "눌러진 후에 하트 색감이 별로야. 하트가 안 보여."

```
재현 환경: 모든 브라우저, master HEAD (commit eb3d294, PR #140 머지 후)
재현 URL: https://honeycombo.pages.dev/trending/ (좋아요 토글)
```

## 원인

PR #140에서 default 상태를 개선하기 위해 `.like-button-icon`에 다음 규칙을 추가했다:

```css
.like-button-icon {
  color: var(--color-like-default-icon);  /* #d67a8d soft rose */
}

.like-button:hover:not(:disabled) .like-button-icon {
  color: inherit;  /* hover 시에만 버튼 color를 따라감 */
}
```

이 구조는 default → hover 전환은 올바르게 처리하지만, **liked 상태에 대한 override가 빠져 있다**. CSS 우선순위상 `.like-button-icon` 규칙이 `.like-button` 자체의 color보다 구체적(selector specificity가 같지만 직접 지정)이어서, liked 상태에서도 icon은 여전히 rose 색으로 남는다.

liked 상태는 이미 정의되어 있지만 아이콘 color는 다루지 않는다:

```css
.like-button.is-liked {
  background: linear-gradient(135deg, #ff5a7a 0%, #e74c6f 100%);
  color: var(--color-like-contrast-text);  /* ← 버튼/텍스트만 흰색 */
  /* icon color는 그대로 #d67a8d */
}
```

→ 핑크 그라데이션 위에 rose pink 아이콘이 올라가서 **색이 묻혀 하트 형태가 읽히지 않는다**.

## 해결 방법

liked 상태일 때만 아이콘이 버튼 color(흰색)를 상속하도록 override 규칙 추가:

```diff
+ /* Liked state: the icon must inherit the button color so it reads as
+    white against the pink gradient (otherwise the rose default-icon
+    tint blends into the gradient and the heart disappears). */
+ .like-button.is-liked .like-button-icon {
+   color: inherit;
+ }
```

효과:
- **Default**: icon은 `var(--color-like-default-icon)` (rose) — PR #140 유지
- **Hover (not liked)**: icon은 `inherit` → `var(--color-like-hover-text)` (#e74c6f) — PR #140 유지
- **Liked**: icon은 `inherit` → `var(--color-like-contrast-text)` (#ffffff) — **이번 PR에서 추가**
- **Liked hover**: icon도 여전히 inherit → 흰색 유지 (liked 배경이 hover 그라데이션으로만 바뀜)

hover-in-liked도 자연스럽게 작동하는 이유: liked 상태에서는 `.like-button.is-liked:hover:not(:disabled)`가 버튼의 color를 다시 `var(--color-like-contrast-text)`로 명시적 지정하므로, icon의 `inherit`도 흰색을 유지한다.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/pages/trending.astro` | `.like-button.is-liked .like-button-icon { color: inherit; }` 규칙 추가 |
| `functions/trending.ts` | SSR fallback에 동일 규칙 추가 |
| `functions/p/[id].ts` | 플레이리스트 상세 페이지의 `.like-btn.is-liked .like-icon { color: inherit; }` 추가 (클래스명 규칙만 다르고 원리 동일) |

## 예방 조치

- **state 레이어의 CSS는 각 축(color, background, border, shadow)이 모두 일관되게 업데이트되는지 체크리스트로 확인할 것**: 배경/테두리/텍스트 color를 바꿀 때 아이콘 color도 같은 state machine 안에서 다뤄야 한다. PR #140은 default 축만 다뤘고 liked 축에서 아이콘을 놓쳤다.
- **"inherit으로 돌리는 override는 해당 state를 가진 모든 자식 요소에 대해 필요한지 점검"**: `.like-button:hover .like-button-icon { color: inherit }`를 추가한 순간, `.like-button.is-liked .like-button-icon`도 같은 처리가 필요하지 않은지 반드시 점검해야 했다.
- **기능이 아닌 시각 축 변경도 실제 토글 시나리오로 수동 QA**: liked 상태의 하트 렌더링은 default 상태에서는 드러나지 않는 regression이라, 사용자 flow(좋아요 토글 → liked 보기 → 다시 취소)를 직접 눌러봐야 보인다.

---

## 관련 문서

- [트렌딩 플레이리스트 기능](../features/trending-playlists.md)
- [좋아요 버튼 회색 박스 → 모던 pill 재디자인](./like-button-gray-square-redesign.md) — PR #131
- [좋아요 버튼 토큰화 및 커버리지 후속](./like-button-token-and-coverage-followup.md) — PR #133 + #136
- [좋아요 버튼 default 상태 soft rose tint](./like-button-default-state-rose-tint.md) — PR #140 (이 버그를 야기한 직전 작업)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — liked 상태 하트 아이콘이 배경에 묻히던 문제 해결 |
