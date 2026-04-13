import { swapItemPositions } from '../../../../lib/playlist-items';
import type { AppPagesFunction } from '../../../../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export const onRequest: AppPagesFunction[] = [
  async ({ request, env, params, data }) => {
    if (request.method !== 'PUT') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (!data.user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (
      !isObject(body) ||
      typeof body.itemA !== 'string' ||
      typeof body.itemB !== 'string' ||
      !body.itemA ||
      !body.itemB
    ) {
      return json({ error: 'itemA and itemB are required strings' }, 400);
    }

    const success = await swapItemPositions(
      env.DB,
      params.id,
      data.user.id,
      body.itemA,
      body.itemB,
    );

    if (!success) {
      return json({ error: 'Forbidden or items not found' }, 403);
    }

    return json({ success: true });
  },
];
