import { deleteSession } from '../../lib/auth';
import { clearCookie, parseCookies } from '../../lib/cookies';
import type { AppPagesFunction } from '../../lib/types';

export const onRequest: AppPagesFunction = async ({ env, request }) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'POST',
      },
    });
  }

  const cookies = parseCookies(request.headers.get('cookie') ?? '');
  const sessionId = cookies.session;

  if (sessionId) {
    await deleteSession(env.DB, sessionId);
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  headers.append('Set-Cookie', clearCookie('session'));

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers,
  });
};
