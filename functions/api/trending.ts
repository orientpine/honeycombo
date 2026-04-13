import { getTrendingPlaylists } from '../lib/likes';
import type { AppPagesFunction } from '../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env, data } = context;

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '20');

    const result = await getTrendingPlaylists(env.DB, page, limit, data.user?.id);
    return json(result);
  },
];
