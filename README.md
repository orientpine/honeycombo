# HoneyCombo

[![GitHub](https://img.shields.io/github/stars/orientpine/honeycombo?style=social)](https://github.com/orientpine/honeycombo)

저비용 기술 뉴스 큐레이션 사이트 — Astro SSG + Cloudflare Pages + GitHub Actions

## 기술 스택

- **프레임워크**: Astro SSG
- **호스팅**: Cloudflare Pages (무료, 무제한 bandwidth)
- **자동화**: GitHub Actions (RSS 수집, 트렌드 계산, 제출 처리)
- **CMS**: Decap CMS (git-native)
- **댓글**: Giscus (GitHub Discussions)

## 로컬 개발

```bash
bun install
bun run dev
```

## 배포

**GitHub 저장소**: https://github.com/orientpine/honeycombo

Cloudflare Pages Git Integration으로 자동 배포됩니다.
main 브랜치에 push하면 자동으로 빌드/배포됩니다.

### Cloudflare Pages 설정

1. https://dash.cloudflare.com → Workers & Pages → Create application → Pages → Connect to Git
2. honeycombo GitHub 저장소 선택
3. 빌드 설정:
   - Build command: `bun run build`
   - Build output directory: `dist`
4. Save and Deploy

## GitHub OAuth 설정 (Decap CMS용)

1. GitHub OAuth App 생성: https://github.com/settings/developers
   - Homepage URL: `https://honeycombo.pages.dev`
   - Authorization callback URL: `https://honeycombo.pages.dev/api/auth`

2. Cloudflare Pages 환경변수 설정:
   - `GITHUB_CLIENT_ID`: OAuth App Client ID
   - `GITHUB_CLIENT_SECRET`: OAuth App Client Secret

3. `public/admin/config.yml`에서 `repo` 필드를 실제 GitHub 사용자명으로 업데이트:
   ```yaml
   backend:
     repo: YOUR_GITHUB_USERNAME/honeycombo
   ```

## Giscus 댓글 설정

1. https://giscus.app 에서 설정 생성
2. `src/components/Comments.astro`에서 `data-repo-id`와 `data-category-id` 업데이트

## 환경변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | Decap CMS 사용 시 |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | Decap CMS 사용 시 |
