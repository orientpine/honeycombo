# Bulk 제출에서 title 필드가 description과 동일해지는 문제

> YouTube 채널처럼 metadata가 빈약한 URL을 bulk로 제출하면 title 필드가 요약 전체로 채워져 description과 100% 일치하는 버그. 2026-04-21 해결.

## 증상

Issue #155 (bulk submit, 9 URL) 처리 후 생성된 8개 JSON 파일의 `title` 필드가 모두 `description`과 동일한 긴 한국어 문장(120~240자)으로 채워졌다. YouTube 영상(oEmbed 성공)만 정상 제목을 가졌고, YouTube 채널 + 웹사이트 URL들은 모두 title=description 상태.

```json
{
  "title": "74만 구독자의 한국 스타트업 전문 콘텐츠 채널 EO Korea. 창업가 심층 인터뷰, ...",
  "description": "74만 구독자의 한국 스타트업 전문 콘텐츠 채널 EO Korea. 창업가 심층 인터뷰, ..."
}
```

**재현 환경**: HoneyCombo `process-submission.ts` (2026-04-21 이전), bulk TSV 4컬럼 포맷, YouTube 채널 URL(@handle 형식).

## 원인

`scripts/process-submission.ts`의 제목 해석 로직이 다음 순서로 fallback 했다:

1. `extractTitleFromNote(note)` — 요약의 첫 non-heading 라인을 반환
2. `|| url` — 그 외에는 URL 원문

그러나 `extractTitleFromNote`는 짧은 한 줄 요약에 대해 **요약 전체를 그대로 반환**한다 (첫 라인 == 전체). YouTube 채널 페이지는 oEmbed가 제목을 돌려주지 않으므로 이 fallback이 곧바로 적용돼 title = description이 되어 카드 UI에서 똑같은 문장이 두 번 렌더링됐다.

또한 bulk TSV는 `URL | Type | Tags | Summary` 4컬럼으로만 구성돼 제출자가 짧은 제목을 따로 명시할 통로가 없었다.

## 해결 방법

1. **신규 `deriveShortTitle(note)`** 도입. 섹션 헤딩(`## 개요`, `## 주요 내용` 등)과 URL-only 라인을 스킵하고, 첫 의미 있는 콘텐츠 라인의 **첫 문장**만 추출한 뒤 80 grapheme 이내로 truncate한다. 결과가 첫 콘텐츠 라인과 사실상 동일하면 null을 반환해 description과의 중복을 예방한다.
2. **신규 `resolveSubmissionTitle()` 헬퍼**로 fallback 체인을 단일화: `parsed.title` → `oEmbed.title` → `deriveShortTitle(note)` → URL hostname. single/bulk 흐름에서 공유한다.
3. **bulk TSV를 5컬럼 포맷으로 확장**: `URL | Type | Title | Tags | Summary`. 파서(`parseBulkIssueBody`)는 `|` 분할 개수가 5 이상이면 3번째 필드를 제목으로 인식하고, 4개면 기존 레거시 포맷으로 처리한다 (backward compatible).
4. **중복 URL 보고 개선**: `findDuplicateUrl(url)`이 매칭 파일 경로를 반환하고, bulk 흐름은 URL index를 1회만 로드한다. 실패 항목은 `bulk-result.json`에 기록되고 `.github/workflows/process-submission.yml`의 `Report bulk submission results` 스텝이 Issue에 상세 댓글을 upsert한다.

```diff
- let title = extractTitleFromNote(note) || url;
- let thumbnailUrl: string | undefined;
- if (type === 'youtube') {
-   const oembed = await fetchYouTubeOEmbed(url);
-   if (oembed) {
-     title = oembed.title || title;
-     thumbnailUrl = oembed.thumbnail_url;
-   }
- }
+ let oembed: OEmbedData | null = null;
+ let thumbnailUrl: string | undefined;
+ if (type === 'youtube') {
+   oembed = await fetchYouTubeOEmbed(url);
+   if (oembed) {
+     thumbnailUrl = oembed.thumbnail_url;
+   }
+ }
+ const title = resolveSubmissionTitle(parsed, oembed, url);
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `scripts/process-submission.ts` | `deriveShortTitle`, `resolveSubmissionTitle`, `findDuplicateUrl`, `buildUrlIndex` 추가. 5컬럼 파서로 확장. bulk 흐름에서 URL index 재사용 + `bulk-result.json` 작성 + exit code 조정 |
| `.github/workflows/process-submission.yml` | `Report bulk submission results` 스텝 추가(실패 댓글 upsert with `<!-- honeycombo-bulk-result -->` marker), 일반 성공 댓글은 bulk 실패 시 스킵 |
| `.github/ISSUE_TEMPLATE/submit-bulk.yml` | 5컬럼(optional title) 포맷 문서화 |
| `tests/process-submission.test.ts` | `deriveShortTitle` / `resolveSubmissionTitle` / 5컬럼 파싱 / `findDuplicateUrl` / `buildUrlIndex` 테스트 추가, 기존 제목 추출 케이스를 새 fallback 동작에 맞게 갱신 |

## 예방 조치

- **클라이언트(`link-curator` plugin)는 제목에 `|`, tab, CR/LF 포함을 거부**해야 한다. 서버 파서는 `|` 기준 분할을 사용하므로 제목 내 pipe는 컬럼 정렬을 깨뜨릴 수 있다.
- **단일 문장짜리 짧은 요약**은 자동으로 좋은 title을 만들 수 없다. 5컬럼 포맷으로 제출자가 직접 짧은 제목을 제공하거나, 2문장 이상의 요약을 작성해야 `deriveShortTitle`이 첫 문장만 추출해 description과 구분되는 title을 생성한다.
- `bulk-result.json` 댓글은 Issue에 upsert되므로 재처리 시 중복 댓글이 생기지 않는다. 댓글 내 `<!-- honeycombo-bulk-result -->` 마커를 건드리지 말 것.

---

## 관련 문서

- [bulk submission 기능 문서](../features/bulk-submission.md)
- [AI 에이전트 제출 가이드](../guides/agent-submission.md)
- [아키텍처 개요](../architecture/overview.md)

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-21 | 최초 작성 — Issue #155 파편 증상 분석 및 수정 기록 |
