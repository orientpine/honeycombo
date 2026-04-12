# Cloudflare Pages 자동 배포 미트리거 문제

> GitHub에 push 후 Cloudflare Pages 자동 배포가 트리거되지 않는 간헐적 문제.

## 증상

`git push origin master` 성공 후 Cloudflare Pages 대시보드에 새 배포가 나타나지 않음. GitHub API로 확인하면 커밋은 정상적으로 원격에 반영된 상태.

```
# GitHub에는 최신 커밋이 있지만
gh api "repos/orientpine/honeycombo/commits?per_page=1" --jq '.[0].sha[:7]'
→ a97ec87

# Cloudflare Pages 최신 배포는 이전 커밋에서 멈춰 있음
```

**재현 환경**: Cloudflare Pages Git Integration, GitHub

## 원인

Cloudflare Pages는 GitHub App 연동 방식으로 push 이벤트를 감지한다. GitHub repo에 별도 webhook이 등록되지 않으며(`gh api repos/.../hooks` → `[]`), GitHub App이 이벤트를 전달하는 구조.

이 GitHub App 연동이 간헐적으로 push 이벤트를 놓치는 경우가 있다. 특히 짧은 시간에 여러 번 push할 때 발생 빈도가 높은 것으로 추정.

## 해결 방법

### 방법 1: wrangler CLI로 직접 배포 (권장)

```bash
bun run build
npx wrangler pages deploy dist --project-name=honeycombo --branch=master
```

`--branch=master` 옵션이 있어야 Production 배포로 인식됨.

### 방법 2: Cloudflare 대시보드에서 수동 재배포

1. Cloudflare Dashboard → Workers & Pages → honeycombo → Deployments
2. 최신 배포 옆 **⋯** (점 3개 메뉴) → **Retry deployment**

> ⚠️ 대시보드의 **Create deployment** 버튼은 파일 직접 업로드 방식이므로, Git 기반 재배포에는 **Retry deployment**를 사용할 것.

### 방법 3: 빈 커밋으로 webhook 재트리거

```bash
git commit --allow-empty -m "chore: trigger Cloudflare Pages deployment"
git push
```

이 방법은 GitHub App 연동이 일시적 오류인 경우에만 효과적.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `package.json` | `deploy` 스크립트: `bun run build && wrangler pages deploy dist` |
| `wrangler.jsonc` | Cloudflare Pages 프로젝트 설정 |

## 예방 조치

- 자동 배포가 안 될 때는 `npx wrangler pages deploy dist --project-name=honeycombo --branch=master`로 수동 배포.
- Cloudflare Dashboard → Settings → Builds & Deployments에서 Git 연결 상태를 주기적으로 확인.
- 짧은 시간에 다수의 push를 피하고, 가능하면 변경사항을 모아서 한 번에 push.

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [배포 가이드](../../DEPLOY.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
