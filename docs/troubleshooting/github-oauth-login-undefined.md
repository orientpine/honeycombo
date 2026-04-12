# GitHub OAuth 로그인 시 client_id=undefined 문제

> GitHub OAuth 로그인 URL에 `client_id=undefined&redirect_uri=undefined`가 포함되어 인증이 실패하는 문제.

## 증상

로그인 버튼 클릭 시 GitHub OAuth 인증 페이지로 리다이렉트되지만, URL 파라미터가 `undefined`로 설정됨.

```
https://github.com/login/oauth/authorize?client_id=undefined&redirect_uri=undefined&state=b0816e51-...&scope=read%3Auser
```

환경변수 설정 후에도 `{"error":"OAuth not configured: missing GITHUB_CLIENT_ID"}` 에러 발생 가능.

**재현 환경**: Cloudflare Pages + Cloudflare Functions, GitHub OAuth

## 원인

2가지 버그가 복합적으로 작용:

1. **환경변수 미설정**: `login.ts`와 `callback.ts`가 `USER_GITHUB_CLIENT_ID`, `USER_GITHUB_CLIENT_SECRET`, `USER_GITHUB_REDIRECT_URI` 환경변수를 요구했으나, Cloudflare Pages에 설정되지 않음. Decap CMS용 `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`만 존재.

2. **me.ts 응답 형식 불일치**: `/api/auth/me`가 `{ user: { username, avatar_url, ... } }`로 래핑하여 반환했으나, `Navigation.astro`는 `user.username`, `user.avatar_url`로 직접 접근 → 로그인 후에도 사용자 정보가 `undefined`로 표시됨.

## 해결 방법

### 1. login.ts — 환경변수 fallback + redirect_uri 동적 생성

```diff
- authorizeUrl.searchParams.set('client_id', env.USER_GITHUB_CLIENT_ID);
- authorizeUrl.searchParams.set('redirect_uri', env.USER_GITHUB_REDIRECT_URI);
+ const clientId = env.USER_GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID;
+ const redirectUri =
+   env.USER_GITHUB_REDIRECT_URI ||
+   new URL('/api/auth/github/callback', request.url).toString();
+ authorizeUrl.searchParams.set('client_id', clientId);
+ authorizeUrl.searchParams.set('redirect_uri', redirectUri);
```

### 2. callback.ts — 동일한 fallback 적용

```diff
- client_id: env.USER_GITHUB_CLIENT_ID,
- client_secret: env.USER_GITHUB_CLIENT_SECRET,
+ const clientId = env.USER_GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID;
+ const clientSecret = env.USER_GITHUB_CLIENT_SECRET || env.GITHUB_CLIENT_SECRET;
+ client_id: clientId,
+ client_secret: clientSecret,
```

### 3. me.ts — flat 응답 형식으로 수정

```diff
  return Response.json({
-   user: {
-     id: data.user.id,
-     username: data.user.username,
-     display_name: data.user.display_name,
-     avatar_url: data.user.avatar_url,
-   },
+   id: data.user.id,
+   username: data.user.username,
+   display_name: data.user.display_name,
+   avatar_url: data.user.avatar_url,
  });
```

### 4. types.ts — USER_GITHUB_* 환경변수를 optional로 변경

```diff
- USER_GITHUB_CLIENT_ID: string;
- USER_GITHUB_CLIENT_SECRET: string;
- USER_GITHUB_REDIRECT_URI: string;
+ USER_GITHUB_CLIENT_ID?: string;
+ USER_GITHUB_CLIENT_SECRET?: string;
+ USER_GITHUB_REDIRECT_URI?: string;
```

## 관련 파일

| 파일 | 변경 내용 |
|------|----------|
| `functions/api/auth/github/login.ts` | `GITHUB_CLIENT_ID` fallback, `redirect_uri` 동적 생성, 미설정 시 500 에러 |
| `functions/api/auth/github/callback.ts` | `GITHUB_CLIENT_ID`/`SECRET` fallback, 미설정 시 500 에러 |
| `functions/api/auth/me.ts` | 응답을 flat object로 변경 |
| `functions/lib/types.ts` | `USER_GITHUB_*` 환경변수를 optional로 변경 |

## 예방 조치

- Decap CMS와 사용자 인증이 동일한 `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`을 공유하므로, 별도의 `USER_GITHUB_*` 환경변수 설정은 불필요. 분리가 필요한 경우에만 `USER_GITHUB_*`를 추가 설정.
- GitHub OAuth App의 Authorization callback URL이 `/api/auth`로 등록되어 있으면, 그 하위 경로인 `/api/auth/github/callback`도 허용됨.
- API 응답 형식 변경 시 프론트엔드 소비자 코드와의 일치 여부를 반드시 확인할 것.

---

## 관련 문서

- [아키텍처 개요](../architecture/overview.md)

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-04-12 | 최초 작성 |
