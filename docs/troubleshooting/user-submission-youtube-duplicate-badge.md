# 사용자 제출 YouTube 영상의 뱃지가 "YouTube" 2번 표시되는 문제

> 사용자가 제출한 YouTube 영상 카드가 `[User Submission][YouTube]` 대신 `[YouTube][YouTube]`로 표시되는 버그의 원인과 해결 기록.

## 증상

`/articles/?origin=submitted` 페이지에서 사용자 제출(user submission) YouTube 영상의 카드 상단 뱃지가 아래와 같이 중복 표시됨.

```
[YouTube] [YouTube] 2026. 4. 16.
```

**기대 동작**: 첫 번째 뱃지는 출처(`User Submission`), 두 번째 뱃지는 콘텐츠 타입(`YouTube`)이어야 함.

```
[User Submission] [YouTube] 2026. 4. 16.
```

**재현 조건**:
- 페이지: `https://honeycombo.pages.dev/articles/?origin=submitted`
- 대상 콘텐츠: `submitted_by` 필드가 존재하고 `type === "youtube"`인 제출 기사
- 예: `src/content/curated/2026/04/submission-62-272335fa.json`

## 원인

YouTube 제출 데이터는 두 개의 별개 필드를 가짐.

```json
{
  "source": "YouTube",
  "type": "youtube",
  "submitted_by": "orientpine"
}
```

- `src/components/ArticleCard.astro`는 첫 번째 뱃지로 `source`를 그대로 렌더링 (`<span class="badge">{source}</span>`)
- 이어서 `type === 'youtube'`이면 두 번째 뱃지로 고정 문자열 `YouTube`를 렌더링

두 렌더링 경로가 모두 같은 문자열(`YouTube`)을 출력하면서 중복이 발생.
일반 글 제출(비YouTube)의 경우에는 `source`가 `"User Submission"`이므로 이 문제가 없었음.
`src/components/TagFilter.astro`의 클라이언트 측 동적 렌더링(`renderCard`)도 동일한 중복 로직을 가지고 있었음.

관련 데이터 분류 로직 (`src/pages/articles/index.astro` line 30):

```ts
_type: (e.data.source === 'User Submission' || e.data.source === 'YouTube') && e.data.submitted_by
  ? 'submitted'
  : 'curated'
```

즉 `_type === 'submitted'`는 이미 정확히 "사용자 제출"을 식별하고 있으나, 뷰 레이어가 이를 활용하지 않고 있던 것이 근본 원인.

## 해결 방법

`articleOrigin === 'submitted'`이면 출처 뱃지를 항상 `'User Submission'`으로 고정. 원본 `source`가 `"YouTube"`여도 뷰 단에서 덮어쓰므로 YouTube 타입 뱃지와 겹치지 않음.

### ArticleCard.astro

```diff
  <div class="article-meta">
-   <span class="badge">{source}</span>
+   <span class="badge">{articleOrigin === 'submitted' ? 'User Submission' : source}</span>
    {type === 'youtube' && <span class="badge badge-primary">YouTube</span>}
    <time class="article-date" datetime={new Date(date).toISOString()}>{formattedDate}</time>
  </div>
```

### TagFilter.astro (클라이언트 측 `renderCard`)

```diff
  const typeBadge = a.type === 'youtube' ? '<span class="badge badge-primary">YouTube</span>' : '';
+ const sourceLabel = a.articleOrigin === 'submitted' ? 'User Submission' : source;
  ...
-     <span class="badge">${source}</span>
+     <span class="badge">${sourceLabel}</span>
      ${typeBadge}
```

### 왜 데이터를 고치지 않고 뷰만 고쳤는가

- `source: "YouTube"`는 원본 플랫폼 정보로서 의미가 있고, 다른 곳(예: 큐레이션된 YouTube 영상)에서 소비될 수 있음.
- 제출 식별자(`_type === 'submitted'`)는 `source + submitted_by` 조합으로 이미 명확히 계산되고 있음.
- 뷰 레이어에서 한 줄로 해결 가능하며 데이터 마이그레이션이 불필요.

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/ArticleCard.astro` | 출처 뱃지에 `articleOrigin === 'submitted'` 분기 추가 |
| `src/components/TagFilter.astro` | 클라이언트 `renderCard`에 동일 분기 추가 |
| `src/pages/articles/index.astro` | (참고) `_type` 계산 로직. 변경 없음 |
| `src/content/curated/**/submission-*.json` | (참고) `source: "YouTube"` + `type: "youtube"` 데이터. 변경 없음 |

## 예방 조치

- 뱃지/라벨 로직을 추가할 때는 **데이터 필드 2개가 동일한 문자열을 렌더링할 가능성이 있는지** 확인한다. 특히 `source`와 `type`처럼 의미는 다르지만 값이 겹칠 수 있는 필드에 주의.
- SSR 렌더링 경로(`ArticleCard.astro`)와 CSR 렌더링 경로(`TagFilter.astro`의 `renderCard`)가 **반드시 동일한 로직을 유지**해야 한다. 하나만 고치면 초기 로드/필터 전환 상태에 따라 버그가 재발한다.
- 출처 뱃지의 표시 규칙은 `articleOrigin` 기준으로 판단하는 것이 가장 안전 (원시 `source` 값은 데이터 입력 방식에 따라 편차가 존재).

---

## 관련 문서

- [에디터 추천/제출/RSS 분류](../features/source-filter.md)
- [origin 뱃지 제거 결정](../decisions/0003-remove-origin-badges.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-17 | 최초 작성 |
