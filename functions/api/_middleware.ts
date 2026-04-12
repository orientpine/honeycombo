import { getSession } from '../lib/auth';
import { parseCookies } from '../lib/cookies';
import type { ContextData, Env } from '../lib/types';

function getAllowedOrigin(request: Request, env: Env): string {
  return env.ALLOWED_ORIGIN ?? new URL(request.url).origin;
}

function isMutationMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'DELETE';
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  const vary = headers.get('Vary');
  headers.set('Vary', vary ? `${vary}, Origin` : 'Origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest: PagesFunction<Env, string, ContextData> = async (context) => {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (isMutationMethod(method)) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = getAllowedOrigin(request, env);

    if (origin !== allowedOrigin) {
      return withCors(
        new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
        request,
        env,
      );
    }
  }

  const cookieHeader = context.request.headers.get('cookie') ?? '';
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies.session;

  context.data.user = sessionId ? await getSession(context.env.DB, sessionId) : null;

  const response = await context.next();
  return withCors(response, request, env);
};
