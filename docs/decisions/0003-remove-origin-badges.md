# 0003: 커뮤니티·에디터 추천 origin 뱃지 제거

> 상태: **승인**

## 맥락

기사 카드에 `커뮤니티`, `에디터 추천` 등 articleOrigin 기반 뱃지가 표시되고 있었다. 이 뱃지는 기사의 수집 경로(feed/curated/submitted)를 사용자에게 노출하는 역할이었으나, 사용자 관점에서 불필요한 정보이며 UI를 복잡하게 만든다는 판단 하에 제거를 결정했다.

## 결정

`ArticleCard.astro`와 `TagFilter.astro`에서 articleOrigin 기반 뱃지 렌더링을 제거한다.

- `badge-curated` (에디터 추천) 뱃지 제거
- `badge-submitted` (커뮤니티) 뱃지 제거
- source 뱃지(`Hacker News`, `User Submission` 등)는 유지

## 고려한 대안

### 대안 1: CSS로 숨기기 (`display: none`)

- 장점: 코드 변경 최소화, 향후 복원 용이
- 단점: 불필요한 HTML이 계속 생성됨, 의도가 불명확
- 탈락 사유: HTML 자체를 생성하지 않는 것이 더 깔끔하고 의도가 명확함

### 대안 2: 뱃지 텍스트만 변경

- 장점: 기사 출처 구분 기능 유지
- 단점: 사용자가 원하는 것은 뱃지 자체의 제거
- 탈락 사유: 요구사항에 부합하지 않음

## 결과

- 기사 카드에 source 뱃지, YouTube 뱃지, 날짜만 표시됨
- articleOrigin 데이터는 data 속성으로 남아 있어 필터링 기능에는 영향 없음

## 관련 파일

- `src/components/ArticleCard.astro` — SSR 렌더링 시 뱃지 출력 제거
- `src/components/TagFilter.astro` — 클라이언트 필터링 시 뱃지 HTML 생성 제거

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-14 | 최초 작성 |
