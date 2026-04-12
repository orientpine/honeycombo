import { setVisibility } from '../../../lib/playlists';
import type { AppPagesFunction } from '../../../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function parseVisibility(request: Request): Promise<'unlisted' | 'public' | Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isObject(body) || (body.visibility !== 'unlisted' && body.visibility !== 'public')) {
    return json({ error: 'Visibility must be unlisted or public' }, 400);
  }

  return body.visibility;
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env, params, data } = context;

    if (request.method === 'PUT') {
      if (!data.user) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const visibility = await parseVisibility(request);
      if (visibility instanceof Response) {
        return visibility;
      }

      const playlist = await setVisibility(env.DB, params.id, data.user.id, visibility);

      if (!playlist) {
        return json({ error: 'Forbidden' }, 403);
      }

      return json(playlist);
    }

    return json({ error: 'Method not allowed' }, 405);
  },
];
