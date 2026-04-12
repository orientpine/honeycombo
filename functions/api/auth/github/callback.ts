import { createSession, upsertUser } from '../../../lib/auth';
import { clearCookie, parseCookies, serializeCookie } from '../../../lib/cookies';
import type { AppPagesFunction } from '../../../lib/types';

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}

export const onRequest: AppPagesFunction = async ({ env, request }) => {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'GET',
      },
    });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = parseCookies(request.headers.get('cookie') ?? '');
  const cookieState = cookies.oauth_state;
  const returnTo = cookies.oauth_return;

  if (!code || !state) {
    return Response.json({ error: 'Missing code or state' }, { status: 400 });
  }

  if (!cookieState || cookieState !== state) {
    return Response.json({ error: 'Invalid OAuth state' }, { status: 403 });
  }

  const clientId = env.USER_GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID;
  const clientSecret = env.USER_GITHUB_CLIENT_SECRET || env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json({ error: 'OAuth not configured' }, { status: 500 });
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    return Response.json({ error: 'Token exchange failed' }, { status: 502 });
  }

  const tokenData = (await tokenResponse.json()) as GitHubTokenResponse;

  if (!tokenData.access_token || tokenData.error) {
    return Response.json({ error: tokenData.error ?? 'No access token' }, { status: 400 });
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'honeycombo',
    },
  });

  if (!userResponse.ok) {
    return Response.json({ error: 'Failed to fetch GitHub user' }, { status: 502 });
  }

  const githubUser = (await userResponse.json()) as GitHubUserResponse;
  const user = await upsertUser(env.DB, {
    id: String(githubUser.id),
    username: githubUser.login,
    display_name: githubUser.name,
    avatar_url: githubUser.avatar_url,
  });
  const { sessionId } = await createSession(env.DB, user.id);

  const headers = new Headers({
    Location: (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) ? returnTo : '/my/playlists',
  });

  headers.append(
    'Set-Cookie',
    serializeCookie('session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    }),
  );
  headers.append('Set-Cookie', clearCookie('oauth_state'));
  headers.append('Set-Cookie', clearCookie('oauth_return'));

  return new Response(null, {
    status: 302,
    headers,
  });
};
