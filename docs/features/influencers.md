# 인플루언서 의견

> 기술 분야 주요 인물들의 최신 의견을 자동 수집하고 표시하는 기능.

## 개요

기술/AI/Web3 분야 인플루언서들의 최신 인사이트를 Exa API로 자동 수집하여 카드 형태로 표시한다. 사용자가 주요 인물들의 의견을 한곳에서 빠르게 파악할 수 있도록 한다.

## 동작 흐름

```
influencer-sources.json (소스 설정)
  → scripts/influencer-collect.ts (Exa API로 수집)
  → src/data/influencers/*.json (데이터 저장)
  → Astro Content Collection (빌드 시 로드)
  → /influencers/ 페이지 렌더링
```

### 자동 수집
- GitHub Actions 워크플로우(`influencer-collect.yml`)가 매주 월요일 04:00 UTC에 실행
- Exa API로 각 인플루언서 관련 최신 기사/포스트를 검색
- 토픽 자동 감지 (LLM, AGI, AI Agent, Robotics, Coding, Research, AI, Tech)
- 기존 의견과 병합, URL 기준 중복 제거, 최대 10개 유지

### 데이터 검증
- Zod 스키마(`src/schemas/influencer.ts`)로 유효성 검사
- `scripts/validate.ts`에서 전체 콘텐츠 검증 포함

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/pages/influencers.astro` | 인플루언서 목록 페이지 |
| `src/components/InfluencerCard.astro` | 개별 인플루언서 카드 컴포넌트 |
| `src/schemas/influencer.ts` | Zod 스키마 + TypeScript 타입 |
| `src/config/influencer-sources.json` | 수집 대상 인플루언서 설정 |
| `src/data/influencers/*.json` | 수집된 데이터 파일 |
| `src/content.config.ts` | Astro Content Collection 정의 |
| `scripts/influencer-collect.ts` | Exa API 수집 스크립트 |
| `.github/workflows/influencer-collect.yml` | 주간 자동 수집 워크플로우 |

## 등록된 인플루언서

| ID | 이름 | 핸들 | 분야 |
|----|------|------|------|
| `karpathy` | Andrej Karpathy | @karpathy | AI/LLM |
| `yann-lecun` | Yann LeCun | @ylecun | AI/딥러닝 |
| `lucas-flatwhite` | Lucas | @lucas_flatwhite | AI 도구/Claude Code |
| `ralralbral` | 잔다르크 | @ralralbral | AI 에이전트/개발 |
| `scobleizer` | Robert Scoble | @Scobleizer | Tech/AI/spatial computing |
| `justsisyphus` | Sisyphus | @justsisyphus | AI 에이전트/오픈소스 |
| `chosenryot` | Ryot | @chosenryot | DeFi/Solana/Web3 |

## 설정값

| 이름 | 위치 | 기본값 | 설명 |
|------|------|--------|------|
| `EXA_API_KEY` | GitHub Secrets | - | Exa API 인증키 (수집 시 필요) |
| `MAX_OPINIONS` | `scripts/influencer-collect.ts` | `10` | 인플루언서당 최대 의견 수 |
| `COLLECTION_WINDOW_DAYS` | `scripts/influencer-collect.ts` | `14` | 수집 대상 기간 (일) |
| `REQUEST_DELAY_MS` | `scripts/influencer-collect.ts` | `1000` | API 요청 간 딜레이 |

## 인플루언서 추가 방법

1. `src/config/influencer-sources.json`에 새 항목 추가 (id, name, platform, handle, bio, search_query, enabled)
2. `src/data/influencers/{id}.json` 데이터 파일 생성 (초기 opinions는 빈 배열 가능)
3. `bun run build`로 빌드 검증
4. 자동 수집 워크플로우가 다음 실행 시 의견 자동 채움

## 제약 사항

- Exa API 무료 티어 제한에 따라 수집 빈도 제한
- 수집된 텍스트는 기사 본문의 일부로, 원문 품질에 따라 노이즈 포함 가능
- 플랫폼은 x, threads, blog, youtube 중 하나만 지원
- 의견 텍스트 최대 500자, bio 최대 300자

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 — 7명 인플루언서 등록 (karpathy, yann-lecun, lucas-flatwhite, ralralbral, scobleizer, justsisyphus, chosenryot) |
