# 플레이리스트 드롭다운 텍스트 줄바꿈 문제

> 플레이리스트 선택 드롭다운에서 "추가됨" 항목의 제목과 뱃지가 여러 줄로 줄바꿈되는 UI 문제

## 증상

플레이리스트 드롭다운에서 이미 추가된 항목이 한 줄로 표시되지 않고, 제목 텍스트와 "추가됨" 뱃지가 줄바꿈되어 2~3줄로 표시됨.

**재현 환경**: 모든 브라우저, 특히 드롭다운 `min-width: 220px` 이내에서 긴 제목일 때 발생

## 원인

`.playlist-item-btn.already-added`에 `display: flex`가 적용되어 있었지만, 버튼 내부의 제목 텍스트가 별도의 flex item으로 감싸지지 않은 bare text node 상태였음. flex 컨테이너 내에서 text node는 암묵적 flex item이 되지만 `overflow`/`white-space` 제어가 불가능하여 줄바꿈이 발생함. "추가됨" 뱃지(`<span>`)도 `flex-shrink` 미설정으로 함께 밀려남.

## 해결 방법

1. 제목 텍스트를 `<span class="playlist-item-title">`으로 감싸 명시적 flex item으로 분리
2. `.playlist-item-title`에 `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0` 적용
3. `.badge-added`에 `white-space: nowrap; flex-shrink: 0` 추가
4. `.already-added`에 `gap: var(--space-xs)` 추가

```diff
- ${p.contains_item ? '✓ ' : '📋 '}${p.title}
+ <span class="playlist-item-title">${p.contains_item ? '✓ ' : '📋 '}${p.title}</span>
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/AddToPlaylist.astro` | 템플릿 및 CSS 수정 |

## 예방 조치

flex 컨테이너 내부에 텍스트를 배치할 때는 반드시 `<span>` 등으로 감싸서 명시적 flex item으로 만들고, `min-width: 0`과 overflow 제어를 적용할 것.

---

## 관련 문서

- [AddToPlaylist 컴포넌트](../../src/components/AddToPlaylist.astro)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-14 | 최초 작성 |
