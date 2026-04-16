# wrangler 배포 실패: PAGE_STYLES 템플릿 리터럴 미닫힘

> `functions/p/[id].ts`에서 `PAGE_STYLES` CSS 템플릿 리터럴이 닫히지 않아 wrangler esbuild 빌드 실패

## 증상

```
X [ERROR] Expected ";" but found "$"
    functions/p/[id].ts:674:16:
      674 │     pageTitle: `${title} — HoneyCombo`,
```

`npx wrangler pages deploy`시 esbuild가 템플릿 리터럴 파싱 에러 발생. Astro 빌드는 정상 통과하나 Cloudflare Functions 빌드만 실패.

## 원인

`const PAGE_STYLES = \`` (262행)로 시작하는 CSS 템플릿 리터럴이 `@media` 블록 종료(`}`) 이후 닫히는 백틱(`` `; ``)이 누락됨. esbuild가 이후의 함수 정의(`renderStatusPage`)를 템플릿 리터럴 내부로 인식하여 `${title}` 표현식에서 파싱 에러 발생.

## 해결 방법

`@media` 블록의 닫는 `}`(683행) 뒤에 `` `; ``을 추가하여 템플릿 리터럴을 정상 종료.

```typescript
// 수정 전 (683행 뒤 바로 함수 시작)
      }

function renderStatusPage(...)

// 수정 후
      }
`;

function renderStatusPage(...)
```

## 관련 파일

| 파일 | 역할 |
|------|------|
| `functions/p/[id].ts` | 플레이리스트 상세 페이지 Cloudflare Function (SSR) |

---

## 관련 문서

- [히어로 섹션](../features/hero-section.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-16 | 최초 작성 |
