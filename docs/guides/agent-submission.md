# AI 에이전트 자료 제출 가이드

> GitHub `gh` CLI로 HoneyCombo에 기술 콘텐츠를 제출하는 방법. AI 에이전트 자동화에 최적화.

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
> HoneyCombo는 Issue **본문의 `### URL` 또는 `### 링크 목록` 패턴을 감지**하여 자동으로 라벨을 붙이고 제출을 처리합니다.
> **`--label` 옵션은 필요 없습니다.** 본문 형식만 맞으면 됩니다.

## 단건 제출

### `gh` CLI 직접 사용

```bash
gh issue create \
  --repo orientpine/honeycombo \
  --title "📎 자료 등록" \
  --body "### URL

https://example.com/great-article

### 유형

기사

### 태그 (쉼표 구분, 최대 5개)

AI, LLM, startup

### 한줄 소개

AI 에이전트의 실무 활용에 대한 심층 분석 기사입니다"
```

### CLI 래퍼 사용 (더 간편)

프로젝트를 클론한 경우:

```bash
bun run scripts/submit-cli.ts \
  --url "https://example.com/great-article" \
  --type "기사" \
  --tags "AI, LLM, startup" \
  --note "AI 에이전트의 실무 활용에 대한 심층 분석 기사입니다"
```

### 유형 옵션

| 값 | 설명 |
|----|------|
| `기사` | 기술 블로그 포스트, 뉴스 (기본값) |
| `YouTube` | YouTube 영상 (자동 썸네일/제목 추출) |
| `X 스레드` | X(Twitter) 스레드 |
| `Threads` | Threads 포스트 |
| `기타` | 위에 해당하지 않는 콘텐츠 |

## 대량 제출

### 방법 1: CLI 래퍼 + 파일

파이프(`|`) 구분 텍스트 파일 작성:

```text
# items.txt — 주석 줄은 무시됩니다
https://example.com/article-1 | 기사 | AI, LLM | AI 에이전트 심층 분석
https://youtube.com/watch?v=abc123 | YouTube | tutorial, AI | 유용한 AI 튜토리얼
https://example.com/article-2 | 기사 | startup, SaaS | SaaS 스타트업 성장기
```

실행:

```bash
bun run scripts/submit-cli.ts --bulk items.txt
```

### 방법 2: `gh` CLI 직접 사용

```bash
gh issue create \
  --repo orientpine/honeycombo \
  --title "📦 대량 자료 등록" \
  --body "### 링크 목록

https://example.com/article-1 | 기사 | AI, LLM | AI 에이전트 심층 분석
https://youtube.com/watch?v=abc123 | YouTube | tutorial, AI | 유용한 AI 튜토리얼
https://example.com/article-2 | 기사 | startup, SaaS | SaaS 스타트업 성장기"
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
    --title "📎 자료 등록" \
    --body "### URL

$url

### 유형

기사

### 태그 (쉼표 구분, 최대 5개)

general

### 한줄 소개
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
| 설명 | 최대 1,000자 |
| GitHub API rate limit | 5,000 요청/시간 (인증 기준) |
| 중복 URL | 자동 거부 |
| 스팸 키워드 | 자동 거부 |

## AI 에이전트 프롬프트 예시

아래 프롬프트를 AI 에이전트에게 전달하면 자동으로 제출을 수행합니다:

```text
다음 기술 콘텐츠를 HoneyCombo에 제출해줘.
gh CLI가 인증된 상태에서 아래 명령을 실행해:

gh issue create \
  --repo orientpine/honeycombo \
  --title "📎 자료 등록" \
  --body "### URL

{여기에 URL}

### 유형

{기사 | YouTube | X 스레드 | Threads | 기타}

### 태그 (쉼표 구분, 최대 5개)

{태그들}

### 한줄 소개

{한줄 설명}"
```

여러 건을 한번에 제출할 경우:

```text
다음 링크들을 HoneyCombo에 대량 제출해줘.
gh CLI가 인증된 상태에서 아래 명령을 실행해:

gh issue create \
  --repo orientpine/honeycombo \
  --title "📦 대량 자료 등록" \
  --body "### 링크 목록

{URL1} | {유형} | {태그} | {설명}
{URL2} | {유형} | {태그} | {설명}
..."
```

## 레포 클론 없이 사용하기

`gh` CLI만 있으면 제출 가능합니다. 프로젝트 클론이 필요 없습니다.

```bash
# 이것만으로 충분합니다
gh auth login
gh issue create --repo orientpine/honeycombo --title "📎 자료 등록" --body "### URL\n\nhttps://...\n\n### 유형\n\n기사\n\n### 태그 (쉼표 구분, 최대 5개)\n\nAI\n\n### 한줄 소개\n\n설명"
```

CLI 래퍼(`scripts/submit-cli.ts`)를 사용하려면 프로젝트 클론이 필요합니다:

```bash
git clone https://github.com/orientpine/honeycombo.git
cd honeycombo
bun install
bun run scripts/submit-cli.ts --url "..." --type "기사"
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
