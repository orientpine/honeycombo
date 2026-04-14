# AddToPlaylist 드롭다운 긴 플레이리스트 이름 2줄 줄바꿈 문제

> 플레이리스트 이름이 길 경우 "추가됨" 뱃지와 함께 2단으로 줄바꿈되어 레이아웃이 깨지는 문제.

## 증상

기사에서 "➕ 플레이리스트에 추가" 버튼을 누른 후, 이미 추가된 플레이리스트 항목에서:
- 플레이리스트 이름이 긴 경우 텍스트가 2줄로 줄바꿈
- "추가됨" 뱃지가 비정상적으로 배치
- 드롭다운 항목 높이가 불균일하게 표시

**재현 환경**: 모든 브라우저, 긴 이름(20자 이상)의 플레이리스트가 이미 기사를 포함하고 있을 때

## 원인

`.playlist-item-btn.already-added`가 `display: flex; justify-content: space-between`으로 제목 텍스트와 "추가됨" 뱃지를 양쪽 정렬하지만:

1. 제목 텍스트가 익명 flex item(text node)으로 존재하여 `overflow`/`text-overflow` 제어 불가
2. 뱃지에 `flex-shrink: 0`이 없어 제목이 전체 너비를 차지
3. `white-space: nowrap`이 없어 제목이 자유롭게 줄바꿈

## 해결 방법

1. 제목 텍스트를 `<span class="playlist-item-title">`로 래핑하여 CSS 제어 가능하게 변경
2. `.already-added`에만 ellipsis 적용 (비추가 항목은 원래 동작 유지)
3. `escAttr()` 헬퍼로 `p.title` HTML escape 적용
4. `title` attribute 추가로 잘린 제목 hover 시 확인 가능

```diff
 // JS template — 제목을 span으로 래핑 + title attribute 추가
  <button ... title="${escAttr(p.title)}">
+   <span class="playlist-item-title">${p.contains_item ? '✓ ' : '📋 '}${escAttr(p.title)}</span>
    ${p.contains_item ? '<span class="badge-added">추가됨</span>' : ''}
  </button>

 // CSS — .already-added에만 flex + ellipsis 적용
+.playlist-list .playlist-item-btn.already-added .playlist-item-title {
+  flex: 1;
+  overflow: hidden;
+  text-overflow: ellipsis;
+  white-space: nowrap;
+  min-width: 0;
+}
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/AddToPlaylist.astro` | escAttr 헬퍼 추가, title attribute, truncation CSS 범위 한정 |

## 예방 조치

1. **flex 컨테이너 내 텍스트 노드 주의**: 익명 flex item(text node)은 `overflow`/`text-overflow` 적용 불가. 반드시 `<span>` 등으로 래핑해야 한다.
2. **변경 범위를 버그 범위에 맞출 것**: `.already-added`만 문제였으면 CSS도 `.already-added`에만 적용. 전체 항목에 적용하면 선택 가능한 항목의 정보가 손실된다.
3. **`min-width: 0` 필수**: flex item에 `text-overflow: ellipsis`를 적용하려면 `min-width: 0`이 필요하다.
4. **`title` attribute로 전체 제목 노출**: ellipsis로 잘린 제목을 hover 시 볼 수 있도록 `title` 속성을 항상 포함한다.

---

## 관련 문서

- [AddToPlaylist 드롭다운 UI 리그레션](./playlist-dropdown-ui-regression.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-14 | 최초 작성 |
