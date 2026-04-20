# AI 에이전트 자료 제출 가이드

> GitHub `gh` CLI로 HoneyCombo에 기술 콘텐츠를 제출하는 방법. AI 에이전트 자동화에 최적화.

## ⚠️ 제출 언어 요구사항

> **Tags는 영어로, 요약(Summary)은 한국어로 작성해야 합니다.**
> Tags must be in English. Summaries should be written in **Korean**.

## 사전 준비

### 1. `gh` CLI 설치

```bash
# macOS
brew install gh

# Windows (winget)
winget install --id GitHub.cli

# Linux
sudo apt install gh   # 또는 https://cli.github.com/ 참조
```

### 2. GitHub 인증

**대화형 로그인** (사람이 직접 사용 시):

```bash
gh auth login
# → GitHub.com 선택 → HTTPS → 브라우저 인증
```

**비대화형 로그인** (AI 에이전트 / CI 환경):

```bash
# 방법 1: 환경변수로 토큰 전달
export GH_TOKEN="ghp_xxxxxxxxxxxx"

# 방법 2: 토큰 파이프
echo "ghp_xxxxxxxxxxxx" | gh auth login --with-token

# 방법 3: GitHub Actions 환경
# GH_TOKEN은 자동으로 제공됨
```

Personal Access Token(PAT) 생성: [GitHub Settings → Tokens](https://github.com/settings/tokens). `repo` 또는 `public_repo` 스코프 필요.

인증 확인:

```bash
gh auth status
# ✓ Logged in to github.com account YOUR_USERNAME
```

## 라벨에 대한 중요 참고

> **외부 사용자 참고**: GitHub API는 push 권한이 없는 사용자의 `--label` 옵션을 무시합니다.
> HoneyCombo는 Issue **본문의 `### URL` 또는 `### Link List` 패턴을 감지**하여 자동으로 라벨을 붙이고 제출을 처리합니다.
> **`--label` 옵션은 필요 없습니다.** 본문 형식만 맞으면 됩니다.

## 단건 제출

### `gh` CLI 직접 사용

```bash
gh issue create \
  --repo orientpine/honeycombo \
  --title "📎 Submit Link" \
  --body "### URL

https://example.com/great-article

### Type

Article

### Tags (comma-separated, max 5)

AI, LLM, startup

### Summary

## 개요
AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사
## 주요 내용
- 에이전트 아키텍처 설계 패턴
- 프로덕션 배포 시 고려사항
## 시사점
실무에서 바로 적용 가능한 에이전트 구축 가이드"
```

### CLI 래퍼 사용 (더 간편)

프로젝트를 클론한 경우:

```bash
bun run scripts/submit-cli.ts \
  --url "https://example.com/great-article" \
  --type "Article" \
  --tags "AI, LLM, startup" \
  --note "AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사"
```

### Type Options

| Value | Description |
|-------|-------------|
| `Article` | Tech blog posts, news (default) |
| `YouTube` | YouTube videos (auto thumbnail/title extraction) |
| `X Thread` | X (Twitter) threads |
| `Threads` | Threads posts |
| `Other` | Content not fitting above categories |

## 대량 제출

### 방법 1: CLI 래퍼 + 파일

파이프(`|`) 구분 텍스트 파일 작성:

```text
# items.txt — 주석 줄은 무시됩니다
https://example.com/article-1 | Article | AI, LLM | AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사
https://youtube.com/watch?v=abc123 | YouTube | tutorial, AI | 개발자를 위한 실전 AI 튜토리얼
https://example.com/article-2 | Article | startup, SaaS | SaaS 스타트업 성장 전략과 교훈
```

실행:

```bash
bun run scripts/submit-cli.ts --bulk items.txt
```

### 방법 2: `gh` CLI 직접 사용

```bash
gh issue create \
  --repo orientpine/honeycombo \
  --title "📦 Bulk Submit" \
  --body "### Link List

https://example.com/article-1 | Article | AI, LLM | AI 에이전트를 프로덕션 환경에서 활용하는 실전 분석 기사
https://youtube.com/watch?v=abc123 | YouTube | tutorial, AI | 개발자를 위한 실전 AI 튜토리얼
https://example.com/article-2 | Article | startup, SaaS | SaaS 스타트업 성장 전략과 교훈"
```

### 방법 3: 반복문으로 단건 반복

```bash
urls=(
  "https://example.com/post-1"
  "https://example.com/post-2"
  "https://example.com/post-3"
)

for url in "${urls[@]}"; do
  gh issue create \
    --repo orientpine/honeycombo \
    --title "📎 Submit Link" \
    --body "### URL

$url

### Type

Article

### Tags (comma-separated, max 5)

general

### Summary
"
  sleep 2  # GitHub API rate limit 방지
done
```

## Dry Run (테스트)

실행 전 명령어만 확인:

```bash
# 단건
bun run scripts/submit-cli.ts \
  --url "https://example.com/test" \
  --type "기사" \
  --dry-run

# 대량
bun run scripts/submit-cli.ts --bulk items.txt --dry-run
```

## 제출 후 처리 과정

```text
Issue 생성 → GitHub Actions 자동 트리거
         → URL 검증, 중복 확인, 스팸 필터
         → PR 자동 생성
         → 에디터 리뷰 → merge → 사이트 반영
```

- 제출 후 Issue에 자동 댓글이 달립니다.
- 대량 제출 시 일부 실패해도 성공한 항목은 PR에 포함됩니다.

## 제한 사항

| 항목 | 제한 |
|------|------|
| 대량 제출 최대 항목 | 20개/Issue |
| 태그 | 최대 5개 |
| 제목(한줄 소개) | 최대 200자 |
| 요약 | 최대 5,000자 |
| GitHub API rate limit | 5,000 요청/시간 (인증 기준) |
| 중복 URL | 자동 거부 |
| 스팸 키워드 | 자동 거부 |

## AI 에이전트 프롬프트 예시

아래 프롬프트를 AI 에이전트에게 전달하면 자동으로 제출을 수행합니다:

```text
Submit the following tech content to HoneyCombo.
Run the command below with an authenticated gh CLI:

gh issue create \
  --repo orientpine/honeycombo \
  --title "📎 Submit Link" \
  --body "### URL

{URL}

### Type

{Article | YouTube | X Thread | Threads | Other}

### Tags (comma-separated, max 5)

{tags in English}

### Summary

{한국어 구조화 요약}"
```

여러 건을 한번에 제출할 경우:

```text
Submit the following links to HoneyCombo in bulk.
Run the command below with an authenticated gh CLI:

gh issue create \
  --repo orientpine/honeycombo \
  --title "📦 Bulk Submit" \
  --body "### Link List

{URL1} | {Type} | {English tags} | {한국어 요약}
{URL2} | {Type} | {English tags} | {한국어 요약}
..."
```

## 레포 클론 없이 사용하기

`gh` CLI만 있으면 제출 가능합니다. 프로젝트 클론이 필요 없습니다.

```bash
# 이것만으로 충분합니다
gh auth login
gh issue create --repo orientpine/honeycombo --title "📎 Submit Link" --body "### URL\n\nhttps://...\n\n### Type\n\nArticle\n\n### Tags (comma-separated, max 5)\n\nAI\n\n### Summary\n\n## 개요\nAI 에이전트 활용 실전 분석\n## 주요 내용\n- 설계 패턴\n- 배포 고려사항"
```

CLI 래퍼(`scripts/submit-cli.ts`)를 사용하려면 프로젝트 클론이 필요합니다:

```bash
git clone https://github.com/orientpine/honeycombo.git
cd honeycombo
bun install
bun run scripts/submit-cli.ts --url "..." --type "Article"
```

---

## 관련 문서

- [대량 제출 기능](../features/bulk-submission.md)
- [제출 CLI 래퍼](../features/submit-cli.md)
- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
| 2026-04-13 | 영어 작성 가이드 추가, 예시 영문화 |
| 2026-04-20 | 요약 형식 한국어 구조화 전환, 최대 5000자로 확대 |
