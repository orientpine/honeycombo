# RSS 요약이 "이 콘텐츠는" 같은 자기 지시적 서두로 시작되는 문제

> Gemini가 생성한 한국어 구조화 요약의 각 섹션 첫 문장이 "이 콘텐츠는", "본 콘텐츠는", "이 기사는" 등 불필요한 자기 지시적 표현으로 시작되어 본문 가독성을 해치던 문제

## 증상

`src/data/feeds/YYYY/MM/{id}.json`의 `description` 필드에 저장되는 한국어 구조화 요약이 각 섹션(`## 개요`, `## 주요 내용`, `## 시사점`)의 첫 문장을 자기 지시적 표현으로 시작한다. 본문이 주제를 곧바로 설명하지 못하고 "이 기사는 ~을 다룬다"처럼 메타-서술로 한 번 감싸져 나온다.

**대표 사례**:

```
## 개요

이 콘텐츠는 Vercel 블로그가 공개한 AGENTS.md 실험을 다룬다. ...

## 시사점

이 기사는 프로젝트 루트의 단일 문서 전략이 효과적임을 시사한다.
```

**기대 형식** — 주제(주어)로 바로 시작:

```
## 개요

Vercel 블로그가 공개한 AGENTS.md 실험은 Next.js 16 API 평가에서 Skills 기반 접근보다 높은 정확도(70% vs 53%)를 기록했다.

## 시사점

프로젝트 루트의 단일 "항상 보이는" 문서가 "찾아야 하는" Skills보다 실질 성능이 높다.
```

**재현 환경**: GitHub Actions(`summarize.yml`), Bun 런타임, Gemini 2.5 Flash-Lite. 축적된 feed article에서 다수 발견됨. 사용자가 명시적으로 불필요하다고 지적.

## 원인

두 가지 요인이 겹쳤다.

**원인 1 — 프롬프트가 직접 자기 지시적 서두를 유도했다.**

`scripts/summarize-articles.ts`의 `SUMMARIZE_PROMPT`가 각 섹션 예시에서 "이 콘텐츠"를 명시적으로 사용했다:

```ts
## 개요
(1~2문장으로 이 콘텐츠가 무엇인지 설명)

## 시사점
(이 콘텐츠의 의의, 결론, 또는 실무 적용 가능성을 1~2문장으로 정리)
```

Gemini는 지시 안의 명사 표현을 출력에도 그대로 반영하는 경향이 있다. "이 콘텐츠가 무엇인지"를 설명하라고 하니 실제 생성물에서 "이 콘텐츠는 ~을 설명한다"로 시작해버렸다.

**원인 2 — 요약 품질 가드가 구조만 검증하고 스타일은 검증하지 않았다.**

기존 `looksLikeKoreanStructuredSummary()`는 `## 주요 내용` 또는 `## 시사점` 헤딩 유무만 확인한다. 따라서 `## 개요\n이 콘텐츠는...`처럼 자기 지시적 서두가 포함된 요약도 "정상"으로 통과해서 feeds JSON에 그대로 저장됐다.

## 해결 방법

**Producer 측(프롬프트)에서 예방**하고, **Consumer 측(runtime validator)에서 방어**하는 이중 가드를 적용한다.

### 1. 프롬프트에서 자기 지시적 서두 금지 명시

```diff
 규칙:
 - 아래 형식을 반드시 따를 것
 - 전문 용어는 원문 그대로 유지 (예: API, SDK, LLM, React 등)
 - 주관적 평가 없이 사실만 전달
 - 최대 ${MAX_DESCRIPTION_LENGTH}자 이내
+- **자기 지시적 서두 절대 금지.** 각 섹션의 첫 문장을 "이 콘텐츠는", "본 콘텐츠는",
+  "이 기사는", "본 기사는", "해당 기사는", "이 글은", "본 글은", "해당 글은",
+  "이 아티클은", "본 아티클은", "이 영상은", "본 영상은", "이 포스트는", "본 포스트는",
+  "이 내용은", "본 내용은" 등 자기 지시적 표현으로 시작하지 마시오.
+  기사·영상이 다루는 **주제·대상(주어)**으로 바로 시작하시오.
+  - ✅ 올바른 예: "Vercel이 발표한 새 실험은 ...", "OpenAI의 o1 모델은 ..."
+  - ❌ 잘못된 예: "이 기사는 Vercel 실험을 다룬다"

 형식:
 ## 개요

-(1~2문장으로 이 콘텐츠가 무엇인지 설명)
+(1~2문장. 주제·대상을 주어로 하여 핵심 내용 요약. 주제로 바로 시작.)
 ...
 ## 시사점

-(이 콘텐츠의 의의, 결론, 또는 실무 적용 가능성을 1~2문장으로 정리)
+(1~2문장. 주제·대상이 갖는 의의, 결론, 실무 적용 가능성. 주어로 바로 시작.)
```

### 2. Runtime validator로 regression 방어

프롬프트만으로는 모델이 때때로 regress한다. 구조 검증(`looksLikeKoreanStructuredSummary`)과 별개로 **스타일 검증(`hasSelfReferentialOpening`)**을 추가해 regex로 패턴을 차단한다.

**규칙**:
- `(이|본|해당) + (콘텐츠|기사|글|아티클|포스트|영상|문서|뉴스|내용|자료|텍스트) + (은|는|이|가|을|를|의|에서)`
- 본문 산문 라인에만 적용 (마크다운 헤딩 `##`, 불릿 `-` 은 대상 외)
- 명사 리스트 기반이 아닌 **regex 패턴**이므로 새로운 변형(`본 기사는` → `해당 포스트는` 등)이 등장해도 바로 걸러낸다

```ts
const SELF_REFERENTIAL_PATTERN = /^\s*(이|본|해당)\s*(콘텐츠|기사|글|아티클|포스트|영상|문서|뉴스|내용|자료|텍스트)\s*(은|는|이|가|을|를|의|에서)/;

export function hasSelfReferentialOpening(text: string): boolean {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#+\s/.test(trimmed)) continue; // skip markdown headings
    if (/^[-*]\s/.test(trimmed)) continue; // skip bullet items
    if (SELF_REFERENTIAL_PATTERN.test(trimmed)) {
      return true;
    }
  }
  return false;
}
```

**명사(주제) 기반 비교 — 오탐 방지**:
- ✅ 걸림 — "이 기사는 AI를 다룬다" (기사 = 자기 지시적)
- ✅ 걸림 — "본 콘텐츠는 중요하다" (콘텐츠 = 자기 지시적)
- ❌ 안 걸림 — "이 기술은 혁신적이다" (기술 = 본문의 주제)
- ❌ 안 걸림 — "본 프레임워크는 구성 요소가 많다" (프레임워크 = 본문의 주제)

### 3. 검증 실패 시 stale clear 후 재시도

`summarizeArticles` 루프에서 Gemini 응답을 받은 직후 `hasSelfReferentialOpening`을 통과시킨다. 실패 시 stale description을 clear하고 `errors`에 기록한 뒤 continue. 다음 run에서 가드가 다시 해당 article을 픽업해 재요약한다 (기존 fetch/API 실패 폴백과 동일한 패턴).

```ts
// Step 2.5: Validate no self-referential openings (user preference).
if (hasSelfReferentialOpening(summary)) {
  const message = `Rejected self-referential opening for: ${title}`;
  console.warn(`  ⚠️  ${message}`);
  if (!dryRun) {
    await clearStaleDescription(filePath, data);
  }
  errors.push(message);
  continue;
}
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `scripts/summarize-articles.ts` | `SUMMARIZE_PROMPT` 개정(자기 지시적 서두 금지 규칙 + 주제 중심 섹션 가이드), `hasSelfReferentialOpening` validator 함수 신규 export, `summarizeArticles` 루프에 Step 2.5 검증 추가, `findArticlesNeedingSummary`가 기존 자기 지시적 서두를 가진 feed description을 자동 재요약 대상으로 pick up하도록 조건 확장 (백필) |
| `tests/summarize-articles.test.ts` | `hasSelfReferentialOpening` 단위 테스트(positive/negative/섹션 내부/헤딩·불릿 무시), `findArticlesNeedingSummary` 백필 테스트(feed 재큐·curated 보호), `summarizeArticles` integration 테스트(mock된 Gemini 응답 reject·수용 검증) |

## 예방 조치

- **Producer/Consumer 이중 가드 유지**: Gemini 프롬프트 수정만으로 안주하지 않는다. AI는 때때로 규칙을 잊으므로 runtime validator가 필요하다.
- **새 자기 지시적 변형 감지 시**: 사용자가 새 형태 ("이 다큐멘터리는" 등)를 지적하면, 명사 리스트를 확장하기보다 **regex 패턴 자체를 확장**하는 방향으로 대응한다. 명사 리스트는 필연적으로 불완전하다.
- **요약 품질 회귀 감시**: `Article Summarization` 워크플로우 로그에서 `Rejected self-referential opening` 경고 빈도를 모니터링한다. 빈도가 높으면 프롬프트 약화 또는 모델 변경 신호.
- **기존 feed 데이터 백필**: `findArticlesNeedingSummary`가 `hasSelfReferentialOpening(description)`이 true인 feed 항목도 다음 run에 자동으로 pick up하므로, 과거 저장된 193개 선약 데이터도 추가 작업 없이 재요약된다. `MAX_ARTICLES_PER_RUN=100`이므로 2회 run에 완전 백필.
- **Curated는 영향 없음**: curated/ 내 사용자 직접 입력 description은 `allowResummarize=false`로 보호되며 Gemini가 건드리지 않는다. 이 규칙은 유지된다.

---

## 관련 문서

- [RSS 수집 article의 description이 영문 원문으로 노출되는 문제](./rss-summary-english-fallback.md) — 구조 검증 가드 `looksLikeKoreanStructuredSummary` 도입 배경
- [scripts/summarize-articles.ts](../../scripts/summarize-articles.ts)
- [tests/summarize-articles.test.ts](../../tests/summarize-articles.test.ts)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — 프롬프트 개정 + `hasSelfReferentialOpening` runtime validator 도입으로 자기 지시적 서두 차단 |
