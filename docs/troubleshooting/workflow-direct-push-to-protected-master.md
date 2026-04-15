# GitHub Actions 워크플로우 master 직접 push 실패

> master 브랜치의 repository ruleset이 `ci` status check을 요구하여, 자동화 워크플로우의 직접 push가 거부되는 문제.

## 증상

`rss-collect.yml`, `summarize.yml` 등 자동화 워크플로우에서 `git push origin master` 실행 시 아래 에러로 push가 거부된다.

```
remote: error: GH013: Repository rule violations found for refs/heads/master.
remote: - Required status check "ci" is expected.
To https://github.com/orientpine/honeycombo
 ! [remote rejected] master -> master (push declined due to repository rule violations)
```

3회 재시도해도 동일하게 실패한다.

**재현 환경**: GitHub Actions (ubuntu-latest), `GITHUB_TOKEN` 사용

## 원인

master 브랜치에 GitHub **repository ruleset**(GH013)이 설정되어 있어 push 시 `ci` status check 통과를 요구한다.

자동화 워크플로우가 새 커밋을 직접 master에 push하면, 해당 커밋 SHA에는 `ci` 체크 결과가 존재하지 않으므로 push가 거부된다. 직접 push된 새 커밋은 PR을 거치지 않기 때문에 CI가 실행될 기회가 없다.

추가적으로, 커밋 메시지에 `[skip ci]`가 포함되어 있어 GitHub Actions 워크플로우 실행 자체가 억제된다. 이로 인해 PR 기반으로 전환하더라도 `[skip ci]`를 제거하지 않으면 동일하게 실패한다.

## 해결 방법

직접 push 대신 **PR 기반 워크플로우**로 전환한다. 기존 `process-submission.yml`의 패턴을 참조.

핵심 변경:
1. `GITHUB_TOKEN` → `PAT`로 교체 (PAT 사용 시 PR에서 CI 워크플로우가 트리거됨)
2. `[skip ci]` 제거 (CI가 정상 실행되어야 status check 통과)
3. 직접 push 대신 브랜치 생성 → PR 생성 → auto-merge

```diff
- git commit -m "chore: update RSS feed articles [skip ci]"
- git push origin master
+ BRANCH="auto/rss-feeds"
+ git checkout -B "$BRANCH"
+ git commit -m "chore: update RSS feed articles"
+ git push origin "$BRANCH" --force
+ gh pr create --title "chore: update RSS feed articles" --base master --head "$BRANCH"
+ gh pr merge "$BRANCH" --auto --squash
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `.github/workflows/rss-collect.yml` | PAT 사용 + PR 기반 워크플로우로 전환 |
| `.github/workflows/summarize.yml` | PAT 사용 + PR 기반 워크플로우로 전환 |
| `.github/workflows/process-submission.yml` | 참조 패턴 (기존 PR 기반 워크플로우) |
| `.github/workflows/ci.yml` | 변경 없음 — `pull_request` 이벤트로 CI 트리거 |

## 예방 조치

- 자동화 워크플로우에서 master에 직접 push하지 않는다. 항상 PR을 통해 머지한다.
- `[skip ci]`는 repository ruleset의 required status check과 충돌하므로, 보호된 브랜치로 머지될 커밋에는 사용하지 않는다.
- `GITHUB_TOKEN`으로 push하면 다른 워크플로우(CI 등)가 트리거되지 않으므로, PR 생성·push에는 `PAT`를 사용한다.

---

## 관련 문서

- [Cloudflare Pages 자동 배포 실패](./cloudflare-pages-auto-deploy-failure.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-04-15 | 최초 작성 |
