# 드롭다운 메뉴 Hover Gap 문제

> `margin-top`으로 시각적 간격을 둔 드롭다운 메뉴에서, 마우스 이동 중 메뉴가 닫히는 문제와 해결 패턴.

## 증상

드롭다운 트리거(버튼, 사용자 아이디 영역 등)를 hover/click하면 메뉴가 나타나지만, 마우스를 메뉴 항목 쪽으로 이동하는 도중 메뉴가 닫혀버린다.

**재현 조건:**
1. 트리거 요소에 마우스를 올려 드롭다운을 연다.
2. 드롭다운 항목으로 마우스를 이동한다.
3. 트리거와 드롭다운 사이의 빈 공간(gap)을 지나는 순간 메뉴가 닫힌다.

**재현 환경**: 모든 데스크톱 브라우저에서 발생. 마우스를 천천히 이동할수록 재현 확률이 높음.

## 원인

드롭다운 CSS에서 `margin-top`을 사용하여 트리거 요소와 드롭다운 사이에 시각적 간격을 만들면, **margin 영역은 어떤 요소에도 속하지 않는 빈 공간**이 된다.

```
┌─────────────┐
│  트리거 요소  │  ← 여기에 마우스가 있으면 :hover 활성
└─────────────┘
     ↕ gap       ← margin-top 영역: 누구에게도 속하지 않음!
┌─────────────┐
│  드롭다운     │  ← 여기에 도달하기 전에 :hover가 해제됨
└─────────────┘
```

- **CSS `:hover` 기반 드롭다운**: gap에 진입하면 트리거의 `:hover`가 해제 → `display: none` → 드롭다운 소멸
- **JS click 기반 드롭다운**: gap에서 outside click 판정 또는 pointer 이벤트 누락 발생 가능

## 해결 방법

트리거 요소(또는 부모 컨테이너)에 `::after` pseudo-element로 **invisible bridge**를 추가하여, gap 영역이 트리거의 hover 영역에 포함되도록 한다.

```css
/* 부모 요소에 position: relative가 필수 */
.trigger-element::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;                   /* 트리거 바로 아래에서 시작 */
  height: var(--space-xs);     /* gap 크기와 동일하게 설정 */
}
```

**동작 원리:**
- `::after`는 트리거 요소의 자식이므로, 이 영역에 마우스가 있으면 트리거의 `:hover` 상태가 유지됨
- 배경색이 없으므로 시각적 변화 없음
- 기존 `margin-top` 간격은 그대로 유지

**핵심 규칙:**
- `height`는 드롭다운의 `margin-top` 값과 **정확히 동일**해야 함
- 부모 요소에 `position: relative`가 있어야 `::after`가 올바르게 위치함
- 이미 `::after`를 사용 중이라면 `::before`를 대신 사용

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/Navigation.astro` | `.auth-user::after` bridge 추가 (로그인 드롭다운) |
| `src/components/AddToPlaylist.astro` | `.add-to-playlist-container::after` bridge 추가 (플레이리스트 드롭다운) |

## 예방 조치

새로운 드롭다운 컴포넌트를 만들 때 아래 체크리스트를 따른다:

1. **`margin-top`으로 gap을 만들면 반드시 `::after` bridge를 함께 추가한다.**
2. 대안으로 `margin-top` 대신 `padding-top`을 사용하면 bridge가 불필요하지만, 드롭다운의 배경/테두리가 gap까지 확장되는 점에 주의한다.
3. 드롭다운 구현 시 마우스를 트리거 → 메뉴 항목으로 천천히 이동하는 수동 테스트를 반드시 수행한다.

---

## 관련 문서

- (해당 없음)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 — Navigation, AddToPlaylist 드롭다운 hover gap 수정 |
