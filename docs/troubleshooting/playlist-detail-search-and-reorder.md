# 플레이리스트 상세 페이지 검색 렌더링 오류 및 순서 변경 상태 불일치

> `functions/p/[id].ts`의 인라인 JavaScript에서 검색 결과 HTML의 `\n` 이스케이프 오류, 기사 수 미갱신, 순서 변경 실패 시 클라이언트-서버 상태 불일치 문제 해결

## 증상

### 1. 검색 결과가 렌더링되지 않음

플레이리스트 상세 페이지(`/p/{id}`)에서 기사 검색 시 결과 카드가 정상 출력되지 않음. 검색 결과 HTML 문자열 내 리터럴 `\n`이 실제 줄바꿈으로 해석되어 JavaScript 문법 오류 발생.

```
// 브라우저 콘솔
Uncaught SyntaxError: Invalid or unexpected token
```

### 2. 기사 추가/삭제 시 헤더 카운트 미갱신

검색으로 기사를 추가하거나 기존 기사를 삭제해도 상단 메타 영역의 "N개 기사" 텍스트가 변하지 않음. 페이지 새로고침 후에야 정확한 숫자로 표시됨.

### 3. 순서 변경 실패 시 UI와 서버 상태 불일치

아이템 순서 변경(↑/↓ 버튼) 중 PUT 요청이 실패하면 `alert('순서 변경에 실패했습니다.')`만 표시. 클라이언트 DOM은 이미 position이 바뀐 상태이므로 서버와 불일치 발생.

**재현 환경**: 모든 브라우저, 프로덕션(`honeycombo.pages.dev`)

## 원인

### 1. `\n` 이스케이프 오류 (line 952)

`functions/p/[id].ts`의 검색 결과 HTML을 문자열 연결로 빌드하는 구간에서 `\n`이 15개 포함되어 있었음. 이 파일은 SSR에서 인라인 `<script>` 블록을 문자열로 구성하므로, `\n`이 실제 개행으로 해석되어 JavaScript 문자열 리터럴이 깨짐.

### 2. 기사 수 갱신 로직 부재

검색 추가(`POST /api/playlists/{id}/items`) 성공과 삭제(`DELETE`) 성공 후 DOM에서 카드를 추가/제거하지만, 상단 `.playlist-meta .meta-text`의 카운트를 업데이트하는 코드가 없었음.

### 3. 순서 변경 실패 핸들링 미흡

`catch` 블록에서 `alert()`만 호출하고 DOM 롤백이나 서버 상태 동기화를 하지 않아, 실패 후에도 클라이언트가 변경된 position 값을 유지.

## 해결 방법

### 1. `\n` → `\\n` 이스케이프 (b34ff2c)

검색 결과 HTML 빌더의 리터럴 `\n` 15개를 `\\n`으로 수정하여 JavaScript 문자열 내에서 올바르게 이스케이프되도록 함.

```diff
- return '\n                  <div class="search-result-card card">\n ...
+ return '\\n                  <div class="search-result-card card">\\n ...
```

### 2. `updateItemCount()` 헬퍼 추가 (b34ff2c)

기사 수를 실시간 반영하는 유틸리티 함수를 추가하고, 검색 추가 성공 시 `+1`, 삭제 성공 시 `-1`을 호출.

```javascript
function updateItemCount(delta) {
  var el = document.querySelector('.playlist-meta .meta-text');
  if (el) {
    var m = el.textContent.match(/(\d+)/);
    if (m) { el.textContent = Math.max(0, parseInt(m[1], 10) + delta) + '개 기사'; }
  }
}
```

### 3. 순서 변경 실패 시 `reload()` (103e4d2)

`alert()` 대신 `window.location.reload()`로 변경하여 서버의 실제 position 상태를 즉시 반영.

```diff
  } catch {
-   window.alert('순서 변경에 실패했습니다.');
+   window.location.reload();
  }
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `functions/p/[id].ts` | 검색 HTML `\n` 이스케이프 수정, `updateItemCount()` 추가, 순서 변경 실패 핸들러 변경 |

## 예방 조치

- SSR 인라인 스크립트에서 HTML을 문자열 연결로 빌드할 때, 줄바꿈은 반드시 `\\n`으로 이스케이프한다.
- DOM 조작(추가/삭제)과 연동된 카운터가 있으면 항상 함께 갱신한다.
- 서버 상태를 변경하는 클라이언트 작업이 실패하면 `alert()`만으로 끝내지 말고 상태 동기화(reload, 롤백 등)를 수행한다.

---

## 관련 문서

- [플레이리스트 기능](../features/playlists.md)
- [플레이리스트 데이터 미스매치](./playlist-data-mismatch.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-13 | 최초 작성 — b34ff2c, 103e4d2 커밋의 버그 수정 기록 |
