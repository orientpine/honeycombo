import { serializeCookie } from '../../../lib/cookies';
import type { AppPagesFunction } from '../../../lib/types';

export const onRequest: AppPagesFunction = async ({ env, request }) => {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'GET',
      },
    });
  }

  const clientId = env.USER_GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return Response.json(
      { error: 'OAuth not configured: missing GITHUB_CLIENT_ID' },
      { status: 500 },
    );
  }

  const redirectUri =
    env.USER_GITHUB_REDIRECT_URI ||
    new URL('/api/auth/github/callback', request.url).toString();

  const state = crypto.randomUUID();
  const reqUrl = new URL(request.url);
  const returnTo = reqUrl.searchParams.get('return_to') || '';
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');

  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('scope', 'read:user');

  const headers = new Headers({
    Location: authorizeUrl.toString(),
  });

  headers.append(
    'Set-Cookie',
    serializeCookie('oauth_state', state, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 600,
    }),
  );

  if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
    headers.append(
      'Set-Cookie',
      serializeCookie('oauth_return', returnTo, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 600,
      }),
    );
  }

  return new Response(null, {
    status: 302,
    headers,
  });
};
