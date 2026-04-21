# 좋아요 버튼 — default 상태가 여전히 "회색 버튼"처럼 읽히는 문제

> PR #131~#136으로 pill shape + SVG + 토큰화까지 완료한 뒤, Oracle 최종 검토에서 "누르기 전 상태가 여전히 muted gray로 지배되어 원본 불만('회색이야')을 완전히 해소하지 못했다"는 지적을 받아, default 상태에만 은은한 로즈 톤 tint를 주어 해결한 기록.

## 증상

PR #131에서 모양(네모 → pill)과 상호작용(hover/liked)은 충분히 개선됐으나, **정지 상태(누르기 전)의 지배적 인상이 여전히 회색**. 구성 요소:

- 배경: `var(--color-bg)` (흰색)
- 텍스트/아이콘 색: `var(--color-text-muted)` (`#6B6168`, 갈회색)
- 테두리: `var(--color-border)` (`#E8DDD4`, 연한 베이지)

결과적으로 좋아요 버튼을 **Like 액션**으로 즉시 인지하기 어렵고, 원본 사용자 불만("누르기 전에 회색이야")이 부분적으로만 해소됨.

```
재현 환경: 모든 브라우저, master 브랜치 상태 (PR #136까지 머지된 시점)
재현 URL: https://honeycombo.pages.dev/trending/
```

## 원인

모던 pill 재디자인 초기 작업에서 default 상태를 "조용하게" 잡으려고 `--color-text-muted`를 차용했는데, 이게 `#6B6168`이라는 실제 갈회색이어서 시각 톤이 사실상 "회색 버튼"과 동일해짐. 테두리(`--color-border`)도 연한 베이지라 핑크 계열과 거리가 멀어 Like 의미 신호가 부족.

또한 아이콘이 버튼 color를 상속(`color: inherit`)하는 구조라, 버튼 color만 바꾸면 아이콘도 같이 따라가 "은은한 tint만 아이콘에 주기" 같은 미세한 표현이 불가능했음.

## 해결 방법

### 1) default 전용 토큰 3개 추가 (`src/styles/global.css`)

```diff
+ --color-like-default-icon: #d67a8d;          /* soft rose icon tint — reads as "like" at rest, not dead gray */
+ --color-like-default-border: #f0dde2;        /* subtle pink hint on resting border */
+ --color-like-default-count: var(--color-text);  /* readable count numeric at rest */
```

설계 원칙:
- **아이콘만** 핑크 hint (`#d67a8d`, soft rose) → 즉시 "Like" 신호
- **테두리**는 아주 은은한 핑크 베이지 (`#f0dde2`) → 정지 상태에서도 따뜻함
- **카운트 숫자**는 `var(--color-text)` (`#2F2B31`, 진한 회갈색) → 가독성 우선
- **배경은 흰색 유지** → liked 상태(핑크 그라데이션)와 명확한 대비

### 2) 버튼 color 분리 (`src/pages/trending.astro`, `functions/trending.ts`, `functions/p/[id].ts`)

```diff
  .like-button {
-   border: 1px solid var(--color-border);
+   border: 1px solid var(--color-like-default-border);
-   color: var(--color-text-muted);
+   color: var(--color-like-default-count);
  }

  .like-button-icon {
-   color: inherit;
+   color: var(--color-like-default-icon);  /* 아이콘만 별도 톤 */
  }

+ /* Hover 때만 아이콘이 버튼 color(핑크)를 따라간다. */
+ .like-button:hover:not(:disabled) .like-button-icon {
+   color: inherit;
+ }
```

이 구조로:
- **Default**: 아이콘은 soft rose, 숫자는 검정, 테두리는 연한 핑크 베이지 → "조용하지만 따뜻한 Like"
- **Hover**: 버튼 전체 color가 `#e74c6f`로 덮어써지고, 아이콘도 inherit로 같이 따라감 → "선명한 Like intent"
- **Liked**: 그라데이션 + 흰색 contrast 유지 (기존 구조)

### 3) 3경로(Astro + SSR fallback + `/p/[id]`) 모두 동일 패턴 적용

사이트 내 좋아요 UI 일관성 유지. `.like-button` (trending)과 `.like-btn` (playlist detail) 모두 동일한 default 토큰 사용.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/styles/global.css` | default 전용 토큰 3개 추가 |
| `src/pages/trending.astro` | `.like-button` default 톤 조정 + hover-inherit 규칙 |
| `functions/trending.ts` | SSR fallback에도 동일 적용 |
| `functions/p/[id].ts` | `.like-btn` default 톤 조정 + hover-inherit 규칙 |
| `docs/features/trending-playlists.md` | 변경 이력 추가 |

## 예방 조치

- **"Muted = Brand-agnostic gray"라는 자동 연결을 피할 것**: 브랜드나 액션 의미가 있는 버튼은 default 상태에서도 최소한의 brand hint가 필요. 완전한 회색은 disabled/neutral 버튼에만.
- **아이콘과 라벨 색을 분리 가능하게 설계**: `color: inherit` 한 줄로 통합하면 미세 조정 여지가 사라진다. default/hover/active/liked의 각 축에서 "어떤 요소가 어떻게 변할지" 선택지를 확보하는 구조가 필요.
- **사용자의 원본 표현을 액면 그대로 받을 것**: "회색이야"는 단순한 형태 지적이 아니라 "의미가 전달되지 않음"의 신호일 수 있다. 형태만 바꾸고 색 문제는 놓치기 쉽다.

---

## 관련 문서

- [트렌딩 플레이리스트 기능](../features/trending-playlists.md)
- [좋아요 버튼 회색 박스 → 모던 pill 재디자인](./like-button-gray-square-redesign.md) — PR #131
- [좋아요 버튼 토큰화 및 커버리지 후속](./like-button-token-and-coverage-followup.md) — PR #133 + #136

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — default 상태에 soft rose tint 적용해 "회색 버튼" 인상 해소 |
