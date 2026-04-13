# 문서 유효성 검증

> CI에서 docs/ 마크다운 파일의 형식 준수 여부를 자동 검사하고, 코드 변경 시 문서 누락을 경고하는 자동화 스크립트.

## 개요

AGENTS.md와 docs/README.md에 명확한 문서화 규칙이 있었으나 강제 수단이 없어, 최근 주요 기능 구현 시 docs/ 업데이트가 누락되는 문제가 반복되었다. 이를 해결하기 위해 문서 형식 검증 스크립트를 만들고 CI에 통합했다.

## 동작 흐름

```
docs/**/*.md 스캔 → 유형별 필수 섹션 검증 → 결과 출력 (❌/✅)
                                              ↓
                               (--check-coverage) git diff → 코드 변경 + docs 미변경 시 ❌ 실패
```

### 형식 검증 (필수, CI 빌드 실패)

모든 docs/ 마크다운 파일 (`_templates/`, `README.md` 제외)에 대해:

1. **공통 형식**: `# 제목`, `> 요약`, `## 관련 문서`, `## 변경 이력` 존재 여부
2. **유형별 필수 섹션**:
   - `features/`: 개요, 동작 흐름, 관련 파일, 설정값, 제약 사항
   - `decisions/`: 맥락, 결정, 고려한 대안, 결과 + 상태 키워드(제안/승인/폐기/대체됨)
   - `troubleshooting/`: 증상, 원인, 해결 방법, 관련 파일
   - `architecture/`, `guides/`: 공통 형식만

### 변경 커버리지 감지 (CI 빌드 실패)

`--check-coverage` 플래그 사용 시:
- `src/`, `functions/`, `scripts/` 변경이 있는데 `docs/` 변경이 없으면 경고
- 자동 생성 데이터(`src/data/feeds`, `src/data/trending`)는 제외
- PR: `origin/master...HEAD`, push: `HEAD~1` 기준으로 diff 비교

## 관련 파일

| 파일 | 역할 |
|------|------|
| `scripts/validate-docs.ts` | 메인 검증 스크립트 |
| `tests/scripts/validate-docs.test.ts` | 유닛 테스트 |
| `.github/workflows/ci.yml` | CI 통합 (Validate docs format + Check docs coverage 스텝) |
| `docs/_templates/` | 검증 기준이 되는 문서 템플릿 |
| `docs/README.md` | 문서화 규칙 원본 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `--check-coverage` | CLI 플래그 | 비활성 | 변경 커버리지 검사 활성화 |
| `GITHUB_EVENT_NAME` | CI 환경변수 | — | `pull_request`일 때 PR base 기준 diff |
| `EXCLUDED_DATA_DIRS` | `scripts/validate-docs.ts` | feeds, trending, must-read | 자동 생성 데이터 디렉토리 (커버리지 검사 제외) |

## 제약 사항

- 마크다운 파싱은 정규식 기반 — 복잡한 중첩 구조는 감지 못할 수 있음
- 변경 커버리지는 "docs/ 파일이 변경됐는가"만 확인 — 어떤 docs가 필요한지는 판단하지 않음
- `_templates/`와 `README.md`는 검증 대상에서 제외됨

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)
- [문서화 지침](../README.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 — 문서 유효성 검증 자동화 구현 |
| 2026-04-13 | 커버리지 검사를 경고에서 CI 실패로 강화, continue-on-error 제거, src/data/influencers 제외 해제 |
