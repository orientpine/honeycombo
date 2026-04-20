# RSS 수집 article의 description이 영문 원문으로 노출되는 문제

> RSS 수집기가 description을 RSS contentSnippet으로 채워서 Gemini 요약기가 매번 0건으로 스킵하던 문제

## 증상

`src/data/feeds/YYYY/MM/{id}.json` 파일의 `description` 필드에 한국어 구조화 요약(`## 개요`, `## 주요 내용`, `## 시사점`) 대신 RSS 피드가 보내준 영문 원문 발췌가 1000~5000자 그대로 저장된다. 사이트 카드/상세 페이지에 영문 본문이 노출된다.

**대표 사례** (2026-04-20 수집된 dev.to article):

```json
{
  "id": "20b6b53922ca9538",
  "title": "Chain of Custody for Digital Evidence: How to Prove Your Video Wasn't Faked",
  "description": "Chain of Custody for Digital Evidence: How to Prove Your Video Wasn't Faked An insurance adjuster receives dashcam footage from a policyholder claiming another driver ran a red light. The video looks authentic. The timestamp shows it was recorded before the claim was filed. ..."
}
```

**기대 형식** (예시):

```
Dance of Tal 기반의 로컬 비주얼 에디터로, Figma처럼 캔버스 위에서 AI 퍼포머를 배치하고 연결하여 멀티 에이전트 워크플로우를 설계하는 도구

## 주요 내용
- Tal(정체성), Dance(스킬), Performer(에이전트), Act(협업 규칙) 4가지 빌딩 블록 제공
- 드래그&드롭으로 퍼포머를 캔버스에 배치하고 관계를 시각적으로 정의

## 시사점
에이전트 오케스트레이션을 코드가 아닌 비주얼 캔버스로 설계할 수 있는 접근법을 제시
```

**증거** — `Article Summarization` 워크플로우 로그 (run 24651044014, 2026-04-20 06:03):

```
Found 0 articles without descriptions (processing 0)
✅ Summarization complete: 0 updated, 0 skipped
```

매 실행이 10~17초 만에 종료된다. Gemini API는 단 한 번도 호출되지 않는다.

**재현 환경**: GitHub Actions(`summarize.yml`), Bun 런타임, Gemini 2.5 Flash-Lite. 사실상 모든 RSS 피드 article(특히 dev.to처럼 RSS 본문에 contentSnippet을 풍부하게 싣는 피드)에서 발생.

## 원인

두 단계 파이프라인의 **producer/consumer 계약이 어긋나 있었다**.

**Stage 1 — `scripts/rss-collect.ts:106` (수정 전)**

RSS 원문 `contentSnippet`을 그대로 `description`에 채워서 저장했다.

```ts
const description = truncateText(
  item.contentSnippet || item.content || item.summary,
  5000,
);
// ...
description: description || undefined,
```

**Stage 2 — `scripts/summarize-articles.ts:155` (수정 전)**

"description이 비어 있는" article만 요약 대상으로 보았다.

```ts
if (!data.description && typeof data.url === 'string' && data.url.length > 0) {
  articles.push({ filePath, data });
}
```

→ Stage 1이 description을 이미 채워버리니 Stage 2는 매번 0건 처리하고 종료. 사용자가 보는 영문 본문은 **Gemini가 만든 잘못된 요약이 아니라 RSS contentSnippet 그 자체**.

PR #97에서 description 한도를 1000자에서 5000자로 늘리면서 문제가 더 도드라졌다.

## 해결 방법

producer/consumer 계약을 명확히 분리한다: **`description` 필드는 오직 Gemini가 생성한 한국어 구조화 요약 전용**으로 의미를 고정한다.

### 1. RSS 수집 단계에서 description 채우지 않기

```diff
- const description = truncateText(item.contentSnippet || item.content || item.summary, 5000);
- // ...
- description: description || undefined,
+ // description은 의도적으로 비워둔다.
+ // RSS contentSnippet은 영문 원문 발췌라 한국어 구조화 요약과 의미가 다르며,
+ // summarize-articles.ts가 이 필드를 채우는 단일 책임을 갖는다.
+ description: undefined,
```

### 2. 요약 단계의 "한국어 구조화 형식 가드" + curated/feeds 처리 분리

**핵심 설계 결정**: curated와 feeds는 완전히 다른 처리 대상이다.

- **`src/content/curated/`** (사용자 제출 콘텐츠)
  - description은 사용자가 직접 적은 곧이다. 명시적 동의 없이 덮어쓰면 안 된다.
  - description이 완전히 비어 있을 때만 Gemini로 첫 생성(기존 동작 유지).
  - 사용자가 적은 한 줄짜리 설명(한국어/영문 무관) 대상이 아니다.

- **`src/data/feeds/`** (RSS 자동 수집)
  - description은 Gemini가 생성한 한국어 구조화 요약 전용이다.
  - 비어 있거나 구조화 형식이 아닌 경우(영문 원문 누수) 모두 재요약.

가드 함수`looksLikeKoreanStructuredSummary()`는 `## 주요 내용` 또는 `## 시사점` 둘 중 하나만 있어도 정상으로 본다(모델이 종종 `## 개요`를 생략하기 때문). regex로 공백 변동을 허용한다.

```ts
export function looksLikeKoreanStructuredSummary(text: string): boolean {
  return /##\s*주요\s*내용|##\s*시사점/.test(text);
}

// findArticlesNeedingSummary 안에서:
const targets = [
  { dir: curatedDir, allowResummarize: false },  // curated: description 비어있을 때만
  { dir: feedsDir,   allowResummarize: true  },  // feeds: 구조화 형식 아니면 재요약
];
```

### 3. 백필을 위한 `MAX_ARTICLES_PER_RUN` 한시 상향

기존 273개 영문 description article을 빠르게 정상화하기 위해 한도를 일시적으로 100으로 올렸다(20 → 100). 백필 완료 후 원복 예정.

```diff
- const MAX_ARTICLES_PER_RUN = 20;
+ const MAX_ARTICLES_PER_RUN = 100;
```

per-article try/catch로 격리되어 있어 한 article의 API 실패가 전체 run을 중단시키지 않는다.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `scripts/rss-collect.ts` | `normalizeFeedItem`에서 description 필드를 항상 `undefined`로 반환하도록 변경 |
| `scripts/summarize-articles.ts` | `looksLikeKoreanStructuredSummary()` 가드 추가, `findArticlesWithoutDescription` → `findArticlesNeedingSummary`로 이름 변경, `MAX_ARTICLES_PER_RUN` 100으로 한시 상향 |
| `tests/rss-collect.test.ts` | `normalizeFeedItem`이 description 없이 반환하는지 검증 추가 |
| `tests/summarize-articles.test.ts` | 가드 함수 + `findArticlesNeedingSummary` 단위 테스트 신규 작성 |

## 예방 조치

- **producer/consumer 계약을 명확히 한다**: `description`은 "AI 생성 한국어 구조화 요약" 전용이다. RSS 원문이나 사용자 입력이 이 필드로 새지 않도록 한다.
- **요약 워크플로우 회귀 감시**: GitHub Actions의 `Article Summarization` 워크플로우가 매 실행 10초 안에 끝나면(=Gemini 호출 0건) 즉시 의심한다. 정상 실행은 article 처리량에 비례해 분 단위로 걸린다.
- **백필 완료 후 원복**: 273개 백필이 끝나면 `MAX_ARTICLES_PER_RUN`을 20으로 되돌려 일일 사용량을 안정적으로 유지한다.
- **새 피드 추가 시 검증**: 새 RSS 피드를 추가할 때 contentSnippet이 한국어 구조화 형식과 우연히 충돌하는지(예: 영문 article에 `## 시사점` 같은 문자열이 들어 있는지) 확인한다. 현실적으로 거의 없다.
- **사용자 제출고 보호**: curated/의 description은 사용자 입력이므로 가드가 적용되지 않는다(`allowResummarize=false`). 사용자가 영문으로 잧게 적어도 Gemini가 덮어쓰지 않는다. 이 계약을 유지해야 사용자 경험이 망가지지 않는다.

---

## 관련 문서

- [멀티라인 Summary 파싱 트러블슈팅](./multiline-summary-parsing.md) — 한국어 구조화 요약 렌더링 관련 선행 이슈
- [scripts/summarize-articles.ts](../../scripts/summarize-articles.ts)
- [scripts/rss-collect.ts](../../scripts/rss-collect.ts)
- PR #97: 아티클 요약을 한국어 구조화 형식으로 전환, 최대 5000자 확대 (commit `2dd653d`)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-20 | 최초 작성 — RSS contentSnippet이 description으로 누수되어 요약기가 매번 0건 스킵하던 문제 진단 및 수정 |
| 2026-04-20 | 회귀 방지 — curated/feeds 처리 분리 추가. 사용자가 직접 적은 curated description(영문/한 줄짜리 등)을 Gemini가 덮어쓰지 않도록 `allowResummarize` 플래그 도입 |
| 2026-04-20 | Stale fallback policy — fetch 실패 또는 Gemini 실패 시 clearStaleDescription()으로 stale 영문 description을 즉시 제거. 다음 run에서 가드가 다시 픽업해 재시도 |
