# 플레이리스트 최신순 정렬 및 드래그 재정렬 도입

> 플레이리스트 아이템 순서를 최신 추가 순으로 표시하고, ↑/↓ 버튼 기반 인접 이동 대신 SortableJS 드래그 기반 배치 편집 모드로 전환한다.

## 상태

승인 (2026-04-21)

## 맥락

기존 플레이리스트 구현은 `functions/lib/playlists.ts` line 169에서 `ORDER BY position ASC`로 조회하여 position 0인 가장 오래된 기사가 최상단에 위치했습니다. `addItem()`은 `position = MAX(position) + 1`로 말단에 추가하여 새 기사가 항상 최하단에 쌓이는 구조였습니다.

이러한 방식은 몇 가지 사용자 경험 문제를 야기했습니다. 첫째, 오래된 기사가 최상단에 고정되어 최근 업데이트된 내용을 한눈에 파악하기 어려웠습니다. 둘째, 순서 재배치가 `↑`/`↓` 버튼으로 인접한 두 아이템의 position을 swap하는 방식(`functions/lib/playlist-items.ts` `swapItemPositions`)이라, 아이템이 많을 경우 원하는 위치로 옮기기 위해 수십 번의 클릭과 페이지 리로드가 필요했습니다. 셋째, 대량의 순서 재배치가 사실상 불가능하여 소유자가 큐레이션을 지속적으로 다듬는 흐름을 저해했습니다.

사용자는 "새로 추가된 기사가 상단에 표시되도록 순서를 변경해줘"라는 요청과 함께 "한번에 점핑할 수 있으면 좋을 것 같아. 드래그 해서 올린다던가 하는 것. 배치 모드에서 자유롭게 배치를 움직일 수 있으면 유용할 것 같아"라는 구체적인 개선안을 제시했습니다.

이에 따라 기존 아이템 순서를 전체적으로 최신순으로 역전시키고, 배치 모드를 토글 진입 방식(`📋 배치 편집` → `저장`/`취소`)으로 도입하기로 했습니다. 모바일 터치까지 안정적으로 지원하기 위해 검증된 라이브러리인 SortableJS를 사용하며, 기존의 `↑`/`↓` 버튼은 드래그 기능으로 완전히 대체하여 UI를 간소화합니다.

## 결정

1. **정렬 순서 변경**: `functions/lib/playlists.ts` line 169의 `ORDER BY position ASC`를 `ORDER BY position DESC`로 변경합니다.
   - `addItem()`은 기존의 `MAX(position) + 1` 공식을 그대로 유지합니다. DESC 정렬에서는 가장 큰 position 값이 최상단에 오므로, 새 기사가 자동으로 상단에 나타나게 됩니다.
   - `swapItemPositions()` (인접 swap) 함수와 관련 API는 프론트엔드에서 더 이상 호출되지 않지만, 향후 재사용 가능성을 고려하여 백엔드 로직은 유지합니다.

2. **새 API 엔드포인트 추가**: `PUT /api/playlists/{id}/items/reorder` 엔드포인트를 신설합니다.
   - 요청 body는 `{ item_ids: string[] }` 형식을 가지며, 배열의 순서는 시각적 렌더링 순서(최상단에서 최하단)를 의미합니다.
   - `functions/lib/playlist-items.ts`에 `reorderItems(db, playlistId, userId, itemIds)` 함수를 추가하여 처리를 담당합니다.
   - position 재할당 공식은 `position = (itemIds.length - 1) - idx`를 사용하여, 최상단 아이템이 가장 큰 position을 갖도록 하여 DESC 정렬 시 먼저 렌더링되게 합니다.
   - Cloudflare D1의 `db.batch(stmts)`를 사용하여 N개의 UPDATE 문을 원자적으로 실행하며, 이는 `must_read_items`의 패턴을 재사용합니다.
   - 소유자 권한 확인, 아이템 개수 일치 여부, 모든 ID의 소속 확인 등 엄격한 검증을 수행합니다.

3. **프론트엔드 UI 전환**: `functions/p/[id].ts`의 SSR 인라인 스크립트를 수정합니다.
   - 기존의 `↑`/`↓` 버튼과 `moveItem()`, `syncItemControls()` 등 관련 로직을 전면 제거합니다.
   - 소유자이면서 아이템이 2개 이상일 때만 `📋 배치 편집` 토글 버튼을 노출합니다.
   - 배치 편집 모드 진입 시 SortableJS를 CDN에서 lazy-load하며, `.drag-handle`을 핸들로 지정하여 드래그 기능을 활성화합니다.
   - 편집 중에는 링크 클릭을 방지(`pointer-events: none`)하고 삭제/메모 버튼을 숨기며, 점선 테두리와 배경색 변경을 통해 시각적으로 차별화합니다.
   - `저장` 시 새 API를 호출하고 reload하며, `취소` 시에는 DOM 스냅샷을 복원하여 모드를 종료합니다.

4. **디자인 토큰**: 신규 CSS custom property를 추가하지 않고, DESIGN.md에 정의된 기존 토큰 조합(§4.8, §4.9, §6 L9)만을 사용합니다.

## 고려한 대안

### 대안 A: ASC 유지 + `addItem()`에서 position=0으로 prepend + 기존 items position +1
- **탈락 사유**: 아이템 추가 시마다 모든 기존 아이템의 position을 업데이트해야 하는 write load가 발생합니다. 렌더링 시 DESC 정렬로 변경하는 것만으로 동일한 효과를 얻을 수 있으므로 비효율적입니다. 기존 순서 역전에 대해서는 사용자의 명시적 동의를 확인했습니다.

### 대안 B: `↑`/`↓` 유지 + `⬆ 맨 위로` / `⬇ 맨 아래로` 점프 버튼 추가
- **탈락 사유**: 중간 위치로의 이동은 여전히 불편하며, 버튼이 늘어나 UI가 복잡해집니다. 드래그 방식은 모든 이동 시나리오를 직관적으로 해결합니다.

### 대안 C: 카드 전체를 draggable (핸들 없이)
- **탈락 사유**: 스크롤이나 텍스트 선택 중 의도치 않은 드래그가 발생할 위험이 크며, 특히 모바일 환경에서 스크롤 동작과 충돌할 가능성이 높습니다. 전용 핸들을 사용하는 것이 더 안전한 표준 방식입니다.

### 대안 D: HTML5 Drag and Drop API 직접 구현
- **탈락 사유**: 모바일 터치 이벤트 대응 등 구현 및 테스트 비용이 큽니다. SortableJS는 가볍고 검증된 라이브러리이며, 접근성과 터치 지원을 기본으로 제공하므로 도입 효율이 높습니다.

### 대안 E: 전용 `/p/{id}/arrange` 페이지로 분리
- **탈락 사유**: 페이지 전환으로 인해 편집 흐름이 끊깁니다. 현재 페이지 내에서의 토글 방식이 훨씬 즉각적이고 편리한 경험을 제공합니다.

## 결과

### 긍정적 효과
- 최신 업데이트가 최상단에 노출되어 소유자와 독자 모두의 인지 속도가 향상됩니다.
- 대량의 순서 재배치가 한 번에 가능해져 큐레이션 작업의 부담이 크게 줄어듭니다.
- 데스크톱과 모바일 모두에서 자연스러운 드래그 UX를 제공합니다.
- 불필요한 버튼 제거로 카드 UI가 깔끔해지고 가독성이 좋아집니다.
- 구현된 배치 업데이트 패턴은 향후 다른 컬렉션 기능에도 재사용할 수 있습니다.

### 부정적 효과
- SortableJS CDN 의존성이 생깁니다. 다만 장애 시 배치 모드 진입을 차단하고 안내하는 방식으로 대응합니다.
- 기존 플레이리스트의 아이템 순서가 일괄적으로 역전됩니다 (수용된 사항).
- 프론트엔드 스크립트의 복잡도가 다소 증가합니다.

### 리스크 및 완화
- **포지션 공식 유효성**: `reorderItems()`가 포지션을 정규화하므로 이후 `addItem()`의 `MAX+1` 공식은 문제없이 작동합니다.
- **성능**: D1 batch()를 통해 대량 업데이트도 효율적으로 처리 가능합니다.
- **동시 편집**: 저장 후 강제 reload를 통해 최신 상태를 유지합니다.

## 관련 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `functions/lib/playlists.ts` | MODIFY | line 169 `ORDER BY position ASC` → `DESC` |
| `functions/lib/playlist-items.ts` | MODIFY | `reorderItems()` 함수 추가 |
| `functions/api/playlists/[id]/items/reorder.ts` | CREATE | `PUT` 엔드포인트 구현 |
| `functions/p/[id].ts` | MODIFY | UI 전환, SortableJS 통합, 배치 모드 로직 |
| `tests/lib/playlist-items.test.ts` | MODIFY | `reorderItems` 테스트 케이스 추가 |
| `DESIGN.md` | MODIFY | 관련 섹션 업데이트 및 변경 이력 기록 |
| `docs/features/playlists.md` | MODIFY | 기능 명세 업데이트 |

---

## 관련 문서

- [플레이리스트 기능](../features/playlists.md)
- [통합 플레이리스트 관리 (ADR 0002)](./0002-unified-playlist-management.md)
- [DESIGN.md](../../DESIGN.md)
- [AGENTS.md](../../AGENTS.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — 최신순 정렬(ORDER BY DESC) + SortableJS 드래그 기반 배치 편집 모드 결정 기록 |
