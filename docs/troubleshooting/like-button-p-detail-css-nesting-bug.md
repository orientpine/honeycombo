# `/p/[id]` 좋아요 버튼이 라이브에서 구형으로 보이는 문제

> PR #142에서 liked 상태 아이콘 흰색 상속 규칙을 추가할 때, `functions/p/[id].ts`의 `.like-icon` 블록 **내부**에 hover 규칙을 잘못 중첩(nested)시켜 CSS 파싱이 깨졌다. 브라우저는 native CSS nesting을 (아직) 지원하지 않아 이 블록 이후의 여러 규칙이 invalid property로 무시되었고, 라이브 `/p/[id]` 페이지에서 좋아요 버튼이 구형 스타일처럼 렌더링되었다.

## 증상

라이브 `https://honeycombo.pages.dev/p/QpPyDksJqZnb`에서 좋아요 버튼이 `/trending` 페이지의 모던 pill과 시각적으로 다르게 보였다:

- 아이콘 색: `rgb(47, 43, 49)` (= `--color-text`, 진한 회갈색) — **의도한 `#d67a8d` soft rose가 아님**
- 테두리 색: 같은 진한 회갈색 톤
- 전체적으로 default rose tint가 적용되지 않아 "구형 회색 버튼" 인상
- Oracle 7차 검증에서 "production 라이브 /p/[id]에서 pill이 깨져 있다"고 지적됨

반면 `/trending` 페이지는 정상 렌더링되었다 (같은 기능을 다른 파일에서 중복 구현하는 구조 때문).

```
재현 환경: 모든 브라우저, master HEAD (commit 84c3122 이전)
재현 URL: https://honeycombo.pages.dev/p/QpPyDksJqZnb
```

## 원인

`functions/p/[id].ts:401-413`의 PAGE_STYLES 템플릿 리터럴 안에서 `.like-icon` 블록이 **닫는 중괄호 없이** hover 규칙을 내부에 포함한 형태로 잘못 작성되어 있었다:

```css
/* BUG (actual live CSS) */
.like-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--color-like-default-icon);
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
  /* ↓ 여기 .like-icon {}의 닫는 } 없이 다른 rule 시작 */
  /* On hover the button color shifts to hover-text; the icon joins in. */
  .like-btn:hover:not(:disabled) .like-icon {
    color: inherit;
  }
}  /* ← 이게 .like-icon의 실제 닫는 } */
```

Native CSS nesting은 최신 브라우저에서만 선택적으로 지원된다(Chrome 112+, Safari 16.5+). HoneyCombo는 빌드 파이프라인에서 CSS nesting을 처리하지 않으므로(Astro scoped styles + Cloudflare Functions 템플릿 리터럴), 브라우저가 직접 파싱한다. Native nesting 미지원 또는 제한적 지원 브라우저에서는:

1. `.like-icon { transition: ...; }` 다음의 중첩된 `.like-btn:hover...`는 **invalid property**로 간주되어 무시됨
2. 그 결과 `.like-btn` 자체의 규칙이 영향을 받거나, 이후 형제 규칙이 의도대로 파싱되지 않음
3. Cloudflare Pages edge에서 CSS는 그대로 서빙되므로 버그가 프로덕션에 직접 반영됨

이 버그는 [PR #142](https://github.com/orientpine/honeycombo/pull/142)에서 발생했다. 해당 PR에서 `.like-btn:hover:not(:disabled) .like-icon { color: inherit }` 규칙을 추가할 때 `Edit` 툴의 `append, pos: "407#VK"`(=`.like-icon { ... transition: ...` 마지막 줄)로 지시되어, 닫는 중괄호 안쪽에 삽입되었다. `/trending` 경로(`src/pages/trending.astro`, `functions/trending.ts`)에서는 같은 작업이 정확히 닫는 중괄호 바깥에 추가되어 정상이었다.

Oracle의 7차 검증은 라이브 페이지를 Playwright로 직접 확인해서 이 렌더링 오류를 발견했다. **소스 grep만으로는 놓치기 쉬운 버그**였다(규칙 자체는 존재했고 다만 잘못된 위치에 있었음).

## 해결 방법

`.like-icon` 블록을 정상적으로 닫은 뒤 hover 규칙을 형제로 배치:

```css
/* FIXED */
.like-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--color-like-default-icon);
  transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
}
/* On hover the button color shifts to hover-text; the icon joins in. */
.like-btn:hover:not(:disabled) .like-icon {
  color: inherit;
}
```

변경: `functions/p/[id].ts:401-413` — `.like-icon { ... }` 블록의 닫는 중괄호 위치를 8번째 property(`transition`) 뒤로 당기고, hover 규칙을 정상적인 형제 selector로 분리.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `functions/p/[id].ts` | `.like-icon` CSS 블록의 nesting 버그 수정 (line 401-413) |
| `docs/troubleshooting/like-button-p-detail-css-nesting-bug.md` | 이 트러블슈팅 기록 |
| `docs/features/trending-playlists.md` | 변경 이력 추가 |

## 예방 조치

- **템플릿 리터럴 안의 CSS를 수정할 때는 반드시 선택자 블록 경계를 시각적으로 확인할 것.** `Edit` 툴의 `append pos: "X"` 지시자는 라인 번호 기준이라 블록의 닫는 `}` 위치를 자동으로 존중하지 않는다. CSS 블록 **바깥**에 형제로 추가할 의도라면 append 대상을 닫는 `}` 라인으로 지정해야 한다.
- **소스에서만 grep으로 확인하지 말고 라이브 페이지를 직접 열어볼 것.** CSS nesting 같은 파싱 레벨 버그는 compute style에서만 드러난다. 이번 버그는 PR #142 머지 후 3번의 Oracle 검증을 통과했지만 7번째 검증에서 Playwright 라이브 확인으로 처음 발견됐다.
- **Functions의 PAGE_STYLES 같은 인라인 CSS는 Astro scoped style보다 자유롭지만 검증도 약하다.** linter/formatter가 TS 파일 안의 CSS template literal까지 검사하지 않는 경우가 대부분. 이런 파일의 CSS 변경은 별도 QA가 필요.
- **같은 UI가 2곳 이상에 중복 정의되어 있을 때, 한 곳이 깨져도 다른 곳이 정상이면 발견이 늦어진다.** 이번처럼 `/trending`은 정상이고 `/p/[id]`만 깨져 있었다. 장기적으로는 공유 컴포넌트로 통합하는 것이 안전.

---

## 관련 문서

- [트렌딩 플레이리스트 기능](../features/trending-playlists.md)
- [좋아요 버튼 회색 박스 → 모던 pill 재디자인](./like-button-gray-square-redesign.md) — PR #131
- [좋아요 버튼 토큰화 및 커버리지 후속](./like-button-token-and-coverage-followup.md) — PR #133 + #136
- [좋아요 버튼 default 상태 soft rose tint](./like-button-default-state-rose-tint.md) — PR #140
- [좋아요 버튼 liked 하트 가시성 수정](./like-button-liked-heart-invisible.md) — PR #142 (이 버그를 야기한 직전 작업)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — Oracle 7차 검증이 라이브에서 발견한 CSS nesting 버그 해결 |
