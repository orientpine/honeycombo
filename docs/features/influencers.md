# 추천 인플루언서

> 기술 분야 주요 인물들의 프로필을 플랫폼별(X, Threads)로 모아 보여주는 디렉토리 기능.

## 개요

기술/AI/Web3 분야 인플루언서들을 카드 형태로 소개하고, 각 프로필 링크를 통해 바로 팔로우할 수 있도록 한다. X (Twitter)와 Threads 섹션을 분리하여 플랫폼별로 탐색할 수 있다.

> **변경 이력 요약**: 초기에는 Exa API로 인플루언서 의견(opinions)을 자동 수집했으나, X.com 라이브 임베드 → click-to-load 방식을 거쳐 현재는 **정적 프로필 카드 디렉토리**로 단순화되었다. Exa API 의존성과 자동 수집 워크플로우는 완전히 제거됨.

## 동작 흐름

```
src/data/influencers/*.json (개별 데이터 파일 — Content Collection 소스)
  → Astro Content Collection (getCollection('influencers'), 빌드 시 로드)
  → /influencers/ 페이지 렌더링 (X / Threads 섹션 분리)
```

### 페이지 렌더링

1. `influencers.astro`가 Astro Content Collection에서 전체 인플루언서 데이터 로드
2. `platform` 필드 기준으로 X(`x`)와 Threads(`threads`) 그룹 분리
3. 각 그룹을 이름순 정렬 후 `InfluencerCard` 컴포넌트로 렌더링
4. 카드에는 이름, 핸들, bio, 프로필 링크 버튼 표시

### 프로필 링크 생성

- X: `https://x.com/{handle}` (@ 제거)
- Threads: `https://www.threads.net/@{handle}` (@ 제거)

### 데이터 검증

- Zod 스키마(`src/schemas/influencer.ts`)로 유효성 검사
- `scripts/validate.ts`에서 전체 콘텐츠 검증 포함

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/pages/influencers.astro` | 인플루언서 목록 페이지 (X/Threads 섹션 분리) |
| `src/components/InfluencerCard.astro` | 개별 인플루언서 카드 컴포넌트 (프로필 링크 포함) |
| `src/schemas/influencer.ts` | Zod 스키마 (`id`, `name`, `platform`, `handle`, `bio`) |
| `src/config/influencer-sources.json` | 인플루언서 마스터 목록 (참고용, 코드에서 직접 import하지 않음) |
| `src/data/influencers/*.json` | 개별 인플루언서 데이터 파일 (Content Collection 소스) |
| `src/content.config.ts` | Astro Content Collection 정의 (`influencers` 컬렉션) |

## 등록된 인플루언서

### X (Twitter) — 7명

| ID | 이름 | 핸들 | 분야 |
|----|------|------|------|
| `karpathy` | Andrej Karpathy | @karpathy | AI/LLM |
| `yann-lecun` | Yann LeCun | @ylecun | AI/딥러닝 |
| `lucas-flatwhite` | Lucas | @lucas_flatwhite | AI 도구/Claude Code |
| `ralralbral` | 잔다르크 | @ralralbral | AI 에이전트/개발 |
| `scobleizer` | Robert Scoble | @Scobleizer | Tech/AI/spatial computing |
| `justsisyphus` | Sisyphus | @justsisyphus | AI 에이전트/오픈소스 |
| `chosenryot` | Ryot | @chosenryot | DeFi/Solana/Web3 |

### Threads — 4명

| ID | 이름 | 핸들 | 분야 |
|----|------|------|------|
| `dev-roach-log` | Roach | @dev_roach_log | 바이브 코딩/AI 자동화 |
| `choi-openai` | CHOI | @choi.openai | AI/AGI 콘텐츠 |
| `boris-cherny` | Boris Cherny | @boris_cherny | Claude Code/TypeScript |
| `bizmentor-kr` | BizMentor | @bizmentor_kr | GitHub Repo 요약/AI 트렌드 |

## 인플루언서 추가 방법

1. `src/data/influencers/{id}.json` 데이터 파일 생성 (**실제 빌드에 사용되는 소스**):
   ```json
   {
     "id": "new-person",
     "name": "표시 이름",
     "platform": "x",
     "handle": "@handle",
     "bio": "간단한 소개 (300자 이내)"
   }
   ```
2. (선택) `src/config/influencer-sources.json`에도 동일 항목 추가 (참고용 마스터 목록)
3. `bun run build`로 빌드 검증

## 설정값

별도 환경변수나 외부 API 키 없음. 모든 데이터는 정적 JSON 파일로 관리된다.

## 제약 사항

- 플랫폼은 `x`, `threads`, `blog`, `youtube` 중 하나만 지원 (현재 `x`와 `threads`만 활성)
- bio 최대 300자
- 데이터는 수동 관리 — 자동 수집 없음

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 — Exa API 기반 의견 수집 구조로 7명 등록 |
| 2026-04-13 | 전면 재작성 — Exa API 제거, 정적 프로필 카드 디렉토리로 전환. Threads 인플루언서 4명 추가 (총 11명). X/Threads 섹션 분리 반영 |
