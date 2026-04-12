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

  const state = crypto.randomUUID();
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');

  authorizeUrl.searchParams.set('client_id', env.USER_GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', env.USER_GITHUB_REDIRECT_URI);
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

  return new Response(null, {
    status: 302,
    headers,
  });
};
