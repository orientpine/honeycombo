# 관리자 PR 자동 머지 워크플로우

> 관리자(editor)가 직접 생성한 PR은 생성 즉시 auto-merge가 활성화되어, CI 통과와 동시에 squash merge 된다.

## 개요

기존 `.github/workflows/process-submission.yml`의 `Auto-merge if editor` 스텝은 **issue 기반 bot PR**(브랜치 `submission/*`)에 한해 auto-merge를 걸어주었다. 관리자가 콘솔에서 직접 브랜치를 푸시해 만드는 **코드/문서/설정 PR**은 이 자동화 바깥에 있어 CI 통과 후에도 수동으로 머지 버튼을 눌러야 반영되는 상태였다. `AGENTS.md`에 "관리자 PR은 항상 auto-merge 켜라"는 규칙을 추가했으나, 사람이 규칙을 까먹을 경우 여전히 방치되는 문제가 남았다.

이 워크플로우는 해당 간극을 자동화로 메운다. PR이 `opened`/`ready_for_review`되는 순간, GitHub Actions가 PR 작성자 ID가 `src/config/editors.json`의 `editor_github_ids`에 포함되는지 검사하고, 포함되면 `gh pr merge --auto --squash --delete-branch`를 실행한다.

## 동작 흐름

```
[pull_request: opened or ready_for_review]
  ↓
[조기 필터: fork / bot / draft / submission-* / submission-label 이면 전체 job skip]
  ↓
[gh api로 base 브랜치의 editors.json 조회 → editor_github_ids 추출]
  ↓
[PR 작성자 user.id 가 목록에 포함?]
  ├─ No  → 종료
  └─ Yes → gh pr merge <N> --auto --squash --delete-branch
             ↓
           [CI 통과 시 GitHub가 squash merge + head 브랜치 삭제]
```

### 설계 결정

- **트리거에 `ready_for_review` 포함**: draft 상태에서 opened된 PR은 `--auto` 플래그가 거부되므로 첫 번째 실행이 스킵될 수 있다. draft가 Ready로 전환될 때 다시 실행해 커버한다.
- **editors.json은 base(=master) 기준으로 조회**: PR의 head 브랜치를 읽으면 PR 작성자가 해당 파일을 직접 수정해 자기 자신을 editor로 등록하는 권한 상승 공격이 가능하다. 반드시 이미 머지된 base의 값으로 검사.
- **Submission PR 제외**: `head.ref`가 `submission/`로 시작하거나 `submission` 라벨이 붙은 PR은 `process-submission.yml`이 이미 `gh pr merge --merge --auto`로 처리한다. 이 워크플로우가 겹쳐 호출하면 merge 방식(`--squash`)으로 덮어써 버리므로 명시적으로 스킵.
- **`--squash` 고정**: `AGENTS.md`의 관리자 PR 규칙과 일치. squash로 master 커밋 히스토리를 간결하게 유지.
- **Fork 제외**: `pull_request` 이벤트의 `GITHUB_TOKEN`은 fork 레포 PR에 대해 쓰기 권한이 없다. fork는 건드리지 않는 것이 안전. 필요해지면 `pull_request_target` + 명시적 permissions 평가로 별도 설계.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `.github/workflows/admin-pr-auto-merge.yml` | 본 워크플로우 정의 |
| `src/config/editors.json` | `editor_github_ids` 배열로 관리자 GitHub user ID 보관 |
| `.github/workflows/process-submission.yml` | bot 생성 submission PR의 auto-merge 담당 (보완 관계) |
| `AGENTS.md` (`### 관리자 PR 자동 머지`) | 수동 운영 시 지켜야 할 규칙. 이 워크플로우는 그 규칙의 안전망 |
| `docs/decisions/` (향후) | 필요 시 editor 식별 전략 변경 기록 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `editor_github_ids` | `src/config/editors.json` | `["32758428"]` | 자동 머지 대상 관리자 GitHub user ID 목록. 새 관리자 추가 시 여기만 수정하면 됨 |
| 트리거 이벤트 | `.github/workflows/admin-pr-auto-merge.yml` `on:` | `pull_request: [opened, ready_for_review]` | PR 상태 전환 시 실행 |
| Merge 방식 | 워크플로우 `Enable auto-merge` 스텝 | `--squash --delete-branch` | squash merge + head 브랜치 자동 삭제 |
| 권한 토큰 | 워크플로우 `permissions` | `contents: read`, `pull-requests: write` | `GITHUB_TOKEN`으로 충분 (PAT 불필요) |

## 제약 사항

- **Fork 레포 PR 미지원**: 외부 기여자 PR은 자동으로 스킵. 외부 기여자에게 auto-merge를 주고 싶다면 별도 승인 로직 + `pull_request_target` 기반 재설계 필요.
- **Draft PR**: 최초 opened 시점에 draft이면 `--auto` 플래그가 거부된다. Ready for Review로 전환하는 순간 `ready_for_review` 트리거로 재실행되어 정상 활성화됨.
- **Submission PR 처리 중복 금지**: branch가 `submission/*`이거나 `submission` 라벨이 있으면 스킵. 이 조건을 깨면 `process-submission.yml`의 merge commit 모드와 본 워크플로우의 squash 모드가 충돌하므로 수정 시 주의.
- **editors.json 변경은 base(master) 반영 후에야 효과 발생**: PR로 editor를 추가해도, 그 PR 자체는 기존 editors.json으로 평가된다. PR 머지 후 생성되는 다음 PR부터 적용.
- **GITHUB_TOKEN 권한**: 기본 `pull-requests: write`로 충분하지만, 조직 설정에서 `Read and write permissions`가 꺼져 있으면 실패한다. 레포 Settings → Actions → General → Workflow permissions 확인.
- **Repository Ruleset과 상호작용**: 현재 master는 ruleset `15005022`로 `ci` status check를 필수로 요구한다. auto-merge는 required check 통과를 기다린 뒤 merge하므로 정상 동작. required check 목록이 바뀌면 대기 조건도 자동으로 따라감.

---

## 관련 문서

- [AGENTS.md의 관리자 PR 자동 머지 섹션](../../AGENTS.md)
- [AI 에이전트 자료 제출 가이드](../guides/agent-submission.md)
- [사용자 제출 YouTube 영상 뱃지 중복](../troubleshooting/user-submission-youtube-duplicate-badge.md) — PR #75에서 발견된 수동 auto-merge 누락 사례

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-17 | 최초 작성 — `admin-pr-auto-merge.yml` 신규 추가 |
