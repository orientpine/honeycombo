# Decap CMS 로그인 시 Not Found

> `/admin/#/`에서 로그인 시도하면 "Not Found" 에러가 발생하는 문제.

## 증상

`https://honeycombo.pages.dev/admin/#/`에서 GitHub 로그인 버튼을 누르면 팝업이 열리지만 인증에 실패하고, CMS 화면에 "Not Found"가 표시된다. 같은 GitHub OAuth를 사용하는 `/admin/playlists`(사이트 자체 인증)는 정상 동작했다.

**재현 환경**: Cloudflare Pages 배포 환경, Decap CMS 3.1.2

## 원인

`functions/api/auth.ts`(Decap CMS 전용 OAuth 엔드포인트)에 **OAuth 2단계 중 1단계(GitHub 리다이렉트)**가 누락되어 있었다.

Decap CMS의 auth flow는 2단계:
1. `GET /api/auth` (code 없음) → GitHub OAuth 페이지로 리다이렉트
2. `GET /api/auth?code=xxx` → 토큰 교환 → `postMessage`로 CMS에 전달

기존 코드는 2단계만 구현했고, 1단계에서 `code` 파라미터가 없으면 **400 에러**를 반환했다:

```javascript
// 기존 (잘못된) 코드
if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
      status: 400, // ← CMS 팝업이 이 에러를 받음
    });
}
```

`/admin/playlists`는 사이트 자체 auth flow(`/api/auth/github/login` → 쿠키)를 사용하므로 이 엔드포인트와 무관했다.

### 두 개의 auth 시스템

| 시스템 | 용도 | 엔드포인트 | 인증 방식 |
|--------|------|-----------|----------|
| 사이트 auth | 플레이리스트, 관리자 | `/api/auth/github/login` → `/api/auth/github/callback` | 쿠키(세션) |
| Decap CMS auth | CMS 콘텐츠 편집 | `/api/auth` | 팝업 → postMessage(토큰) |

## 해결 방법

`code` 파라미터가 없을 때 GitHub OAuth로 302 리다이렉트하도록 1단계를 추가했다:

```diff
  const code = url.searchParams.get('code');

  if (!code) {
-   return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
-     status: 400,
-   });
+   const redirectUri = new URL('/api/auth', request.url).toString();
+   const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
+   authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
+   authorizeUrl.searchParams.set('redirect_uri', redirectUri);
+   authorizeUrl.searchParams.set('scope', 'repo,user');
+   return Response.redirect(authorizeUrl.toString(), 302);
  }
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `functions/api/auth.ts` | GitHub OAuth 리다이렉트 로직 추가 (1단계) |

## 예방 조치

- Decap CMS의 `auth_endpoint`는 반드시 **리다이렉트(1단계) + 콜백(2단계)** 모두 처리해야 한다.
- 사이트 자체 auth와 Decap CMS auth는 별도 시스템이므로, 한쪽 수정 시 다른 쪽에 영향이 없는지 확인할 것.
- GitHub OAuth App의 "Authorization callback URL"에 `/api/auth`가 등록되어 있는지 확인.

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
