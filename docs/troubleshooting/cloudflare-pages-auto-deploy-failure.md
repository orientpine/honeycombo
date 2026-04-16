# Cloudflare Pages 자동 배포 미트리거 문제

> GitHub에 push 후 Cloudflare Pages 자동 배포가 트리거되지 않던 간헐적 문제. CI 파이프라인에 wrangler 직접 배포를 추가하여 근본 해결.

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

### 근본 해결: CI 파이프라인에 wrangler 배포 추가 (적용 완료)

`.github/workflows/ci.yml`에 master push 시 `wrangler pages deploy`를 실행하는 단계를 추가했다.
CI(validate → build → test)가 통과한 후 자동으로 Cloudflare Pages에 배포된다.

```yaml
# ci.yml (마지막 단계)
- name: Deploy to Cloudflare Pages
  if: github.ref == 'refs/heads/master' && github.event_name == 'push'
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  run: npx wrangler pages deploy dist --project-name=honeycombo --branch=master
```

이로써 Cloudflare GitHub App 연동에 의존하지 않고, 모든 master push가 확정적으로 배포된다.

**필요 GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN`: Cloudflare API 토큰 (Pages 편집 권한)
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 계정 ID

### 수동 배포 (fallback)

CI 배포가 실패하거나 즉시 배포가 필요한 경우:

```bash
bun run build
npx wrangler pages deploy dist --project-name=honeycombo --branch=master
```

`--branch=master` 옵션이 있어야 Production 배포로 인식됨.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `.github/workflows/ci.yml` | CI + 배포 파이프라인 (master push 시 자동 배포) |
| `package.json` | `deploy` 스크립트: 로컬 수동 배포용 |
| `wrangler.jsonc` | Cloudflare Pages 프로젝트 설정 |

## 예방 조치

- CI 배포 단계가 master push마다 자동 실행되므로, Cloudflare GitHub App 이벤트 누락과 무관하게 배포된다.
- `CLOUDFLARE_API_TOKEN` 만료 시 Cloudflare Dashboard에서 새 토큰을 발급하고 GitHub Secrets를 갱신할 것.
- Cloudflare GitHub App Git Integration은 보조 수단으로 유지해도 무방 (이중 배포 시 최신 빌드가 우선됨).
---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [배포 가이드](../../DEPLOY.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
| 2026-04-16 | CI 파이프라인에 wrangler 직접 배포 추가로 근본 해결 |
