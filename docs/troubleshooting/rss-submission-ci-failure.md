# RSS/Submission PR의 CI가 GitHub 인프라 장애·stale 브랜치로 실패한다

> Issue 제출 처리 워크플로우와 그 결과 PR의 CI가 HTTP 500과 non-fast-forward push로 연쇄 실패한 사건을 기록한다. infra-transient 자동 재실행 워크플로우와 stale 브랜치 방어 로직을 추가해 재발을 막는다.

## 증상

2026-04-23 16:17 UTC, issue #192("온라인/설치형 무료 한글 에디터 프로그램") 제출 처리가 실패하고, 생성된 PR #193의 CI도 실패해 master 머지가 차단됐다.

### 증상 1 — `Process Submission` 워크플로우 실패

`Create PR with new submission` 스텝에서 `git push`가 거부됐다.

```
To https://github.com/orientpine/honeycombo
 ! [rejected]        submission/192 -> submission/192 (non-fast-forward)
error: failed to push some refs to 'https://github.com/orientpine/honeycombo'
hint: Updates were rejected because the tip of your current branch is behind
hint: its remote counterpart.
##[error]Process completed with exit code 1.
```

이로 인해 issue #192에는 "❌ 제출 처리 중 오류가 발생했습니다" 코멘트가 달렸지만, 실제로는 PR #193이 이미 존재했다(오탐).

### 증상 2 — PR #193의 `CI` 워크플로우 실패

`actions/checkout@v6`가 내부 retry 3회를 모두 HTTP 500으로 소진하고 최종 실패했다.

```
Run actions/checkout@v6
...
remote: Internal Server Error
fatal: unable to access 'https://github.com/orientpine/honeycombo/': The requested URL returned error: 500
error: RPC failed; HTTP 500 curl 22 The requested URL returned error: 500
fatal: expected flush after ref listing
```

이후 `Install dependencies`, `Build`, `Test`, `Deploy` 등 모든 스텝이 skip 되고 CI 전체가 빨간 X. master Ruleset(`ci` status check 필수) 때문에 PR 머지가 차단됐다.

**재현 환경**: GitHub Actions hosted runner(`ubuntu-24.04`), `actions/checkout@v6`, `git 2.53`, 2026-04-23 16:17 UTC.

## 원인

두 개의 **독립된** 원인이 같은 이벤트에서 겹쳤다.

### 원인 1 — GitHub 인프라 일시 장애 (transient)

해당 시각에 github.com git 서버가 일시적으로 HTTP 500을 반환했다. `actions/checkout`은 fetch 단계에서 retry helper로 최대 3회 재시도를 수행하지만, 장애가 retry 창을 넘기면 모두 실패한다. 코드·콘텐츠 문제가 아니라 외부 장애이므로 단순 재실행으로 해소된다.

### 원인 2 — stale submission 브랜치 재사용 (버그)

`.github/workflows/process-submission.yml`의 `Create PR with new submission` 스텝은 이슈 번호만으로 `submission/$ISSUE_NUM` 브랜치를 만들고 `git push origin "$BRANCH"`를 실행한다 (force 없음).

```bash
# (이전)
git checkout -b "$BRANCH"
git commit -m "..."
git push origin "$BRANCH"     # ← 원격에 같은 이름 브랜치가 남아 있으면 non-fast-forward로 거부
```

원격 `submission/<N>` 브랜치가 이전 run에서 남아있는 상태로 같은 이슈가 재트리거되면 (issue 재라벨링, workflow_dispatch 등) push가 non-fast-forward로 거부된다. 이번 장애에서는 원인 1과 맞물려 동일 run 안에서 먼저 `submission/192`가 원격에 생긴 뒤 두 번째 push 시도가 거부된 것으로 관찰된다.

`.github/workflows/admin-pr-auto-merge.yml`은 `submission/*` 브랜치를 명시적으로 건너뛰고, `process-submission.yml` 내부 `Auto-merge if editor` 스텝도 `gh pr merge --merge --auto`만 쓰고 `--delete-branch` 플래그가 없다. 따라서 stale 브랜치가 쉽게 누적될 수 있는 구조였다.

## 해결 방법

### P0 — PR #193 즉시 복구

`gh run rerun 24846153285 --failed`로 단순 재실행. 2번째 시도에서 GitHub 인프라가 회복되어 CI 통과 확인.

### P1-1 — `process-submission.yml`의 push 로직을 견고화

`Create PR with new submission` 스텝에서 원격 브랜치 상태를 먼저 정리하고 `--force-with-lease`로 push 하도록 수정했다.

```diff
- git push origin "$BRANCH"
+ # stale 원격 브랜치 방어:
+ OPEN_PR=$(gh pr list --head "$BRANCH" --state open --json number --jq '.[0].number // ""')
+ if [ -z "$OPEN_PR" ]; then
+   if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
+     echo "Removing stale remote branch $BRANCH (no open PR)"
+     git push origin --delete "$BRANCH" || true
+   fi
+ fi
+ git fetch origin "$BRANCH" || true
+ git push --force-with-lease origin "$BRANCH"
+
+ if [ -n "$OPEN_PR" ]; then
+   echo "Reusing existing open PR #$OPEN_PR on branch $BRANCH"
+ else
+   gh pr create --title "$PR_TITLE" --body "..." --base master --head "$BRANCH" --label "submission"
+ fi
```

핵심 포인트:
- **열린 PR이 있으면** 브랜치를 지우지 않는다. PR이 사라지면 안 된다. 대신 `--force-with-lease`로 같은 브랜치에 새 commit을 덮어쓴다 (기존 PR이 새 commit으로 업데이트됨).
- **열린 PR이 없고 stale 원격 브랜치만 남아있으면** 브랜치를 지운 뒤 재push.
- `git fetch origin "$BRANCH" || true`로 `--force-with-lease`가 비교할 remote-tracking ref를 확보.
- PR 생성은 open PR이 없을 때만.

### P1-2 — `ci-auto-rerun.yml` 신규 워크플로우로 infra 장애 자동 복구

`.github/workflows/ci-auto-rerun.yml`을 추가했다.

- 트리거: `workflow_run: workflows: ["CI"], types: [completed]`
- 조건: `conclusion == 'failure' && run_attempt < 3`
- 실패 로그(`gh run view --log-failed`)에서 infra-transient 시그니처가 하나라도 매칭될 때만 `gh run rerun "$RUN_ID" --failed` 수행.
- 시그니처: `remote: Internal Server Error`, `RPC failed; HTTP 5xx`, `unable to access ... error: 5xx`, `Connection timed out`, `Connect Timeout Error`, `connect ETIMEDOUT`, `getaddrinfo ENOTFOUND github.com`, `502/503/504`, `fatal: expected flush after ref listing` 등.
- 테스트/빌드 실패 같은 **결정적** 실패는 시그니처에 포함하지 않는다. 재실행해봐야 같은 결과라 리소스 낭비이므로.

로직은 로컬에서 4개 골든 로그 샘플로 단위 검증했다 (infra 로그 → MATCH, jest/tsc 실패 로그 → NO_MATCH, timeout 로그 → MATCH).

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `.github/workflows/process-submission.yml` | `Create PR with new submission` 스텝에 stale 브랜치 정리 + `--force-with-lease` + 기존 PR 재사용 분기 추가 |
| `.github/workflows/ci-auto-rerun.yml` | 신규. CI 실패 시 infra-transient 시그니처 매칭 후 `gh run rerun --failed` |
| `docs/troubleshooting/rss-submission-ci-failure.md` | 이 문서 |

## 예방 조치

- **GitHub 인프라 장애는 언제든 재발한다.** `actions/checkout`의 내부 retry는 부족할 수 있으므로 `ci-auto-rerun.yml`이 안전망이다. 시그니처가 매칭되지 않아도 `gh run rerun --failed`는 수동으로 항상 가능하다.
- **같은 issue를 재처리할 때는 절대로 non-fast-forward 실패가 나면 안 된다.** 브랜치 이름이 `submission/<N>`처럼 결정적이라면 항상 (a) 기존 열린 PR 확인 → (b) 안전한 브랜치 정리 → (c) `--force-with-lease` 패턴을 쓴다.
- **동일 시그니처를 쓰는 다른 워크플로우에도 적용 가능**: `content-update-base.yml`은 이미 rebase+retry 구조를 갖고 있어 OK. `rss-collect.yml`·`summarize.yml`은 `auto/rss-feeds`·`auto/summarize` 브랜치에 `--force`를 사용하므로 이 문제와 무관.
- **자동 재실행이 3회를 넘기면 사람이 개입**해야 한다 (`run_attempt < 3` 조건). 시그니처가 계속 매칭된다면 GitHub Status(status.github.com)를 확인하고 수동으로 기다린다.
- **재실행된 CI도 로그에 원인을 남겨라**: `ci-auto-rerun.yml`은 매칭된 패턴을 로그에 찍어서 왜 재실행됐는지 추적 가능하다.

---

## 관련 문서

- [직접 master push가 Ruleset 때문에 실패하는 문제](./workflow-direct-push-to-protected-master.md)
- [Cloudflare Pages 자동 배포 실패](./cloudflare-pages-auto-deploy-failure.md)
- [Process Submission 멀티라인 Summary 파싱](./multiline-summary-parsing.md)
- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-24 | 최초 작성 — PR #193 CI 장애 대응 (HTTP 500 retry 소진 + stale submission/192 브랜치 non-fast-forward) |
