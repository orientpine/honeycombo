# 0001: Astro SSG + Cloudflare Pages 기술 스택 선정

> 상태: **승인**

## 맥락

저비용으로 운영 가능한 기술 뉴스 큐레이션 사이트를 구축해야 했다. 핵심 요구사항:

- 월 운영비 0원 (또는 최소화)
- SEO 친화적 정적 사이트
- 콘텐츠 관리가 git 기반으로 가능
- 자동화 파이프라인 (RSS 수집, 트렌딩 계산)

## 결정

- **프레임워크**: Astro SSG — 콘텐츠 중심 정적 사이트에 최적화
- **호스팅**: Cloudflare Pages — 무료, 무제한 bandwidth
- **런타임**: Bun — 빠른 스크립트 실행, 내장 테스트 러너
- **자동화**: GitHub Actions — 스케줄 기반 RSS 수집, 트렌딩 계산
- **CMS**: Decap CMS — git-native, 별도 서버 불필요
- **댓글**: Giscus — GitHub Discussions 기반, 서버 불필요

## 고려한 대안

### 대안 1: Next.js + Vercel

- 장점: 풍부한 생태계, SSR/ISR 유연성
- 단점: 번들 크기 큼, 콘텐츠 사이트에 과한 JS
- 탈락 사유: 정적 콘텐츠 사이트에 SSR 불필요. Astro의 zero-JS 기본값이 적합

### 대안 2: Hugo + Netlify

- 장점: 빌드 속도 빠름
- 단점: Go 템플릿 러닝 커브, 컴포넌트 재사용 제한
- 탈락 사유: TypeScript 기반 스크립트와의 통합이 불편

### 대안 3: 자체 서버 (Node.js + DB)

- 장점: 유연성 최대
- 단점: 서버 비용, 관리 부담
- 탈락 사유: "저비용" 요구사항에 정면으로 배치

## 결과

- 월 운영비 0원 달성 (Cloudflare Pages 무료 + GitHub Actions 무료)
- 콘텐츠는 모두 git 관리 → 버전 이력 자동 확보
- 정적 사이트 → CDN 배포로 빠른 로딩
- 자동화 스크립트를 TypeScript로 작성해 타입 안정성 확보

## 관련 파일

- `astro.config.mjs` — Astro 설정
- `wrangler.jsonc` — Cloudflare 설정
- `package.json` — 의존성 및 스크립트
- `.github/workflows/` — 자동화 워크플로우

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-11 | 최초 작성 — 프로젝트 초기 기술 스택 결정 기록 |
