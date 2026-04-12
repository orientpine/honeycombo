import { removeItem, updateItem } from '../../../../lib/playlist-items';
import type { AppPagesFunction, UpdateItemInput } from '../../../../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function parseUpdateItemInput(request: Request): Promise<UpdateItemInput | Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isObject(body)) {
    return json({ error: 'Invalid request body' }, 400);
  }

  const input: UpdateItemInput = {};

  if ('note' in body) {
    if (body.note !== undefined && typeof body.note !== 'string') {
      return json({ error: 'note must be a string' }, 400);
    }

    if (typeof body.note === 'string') {
      input.note = body.note;
    }
  }

  if ('position' in body) {
    if (body.position !== undefined && (typeof body.position !== 'number' || !Number.isFinite(body.position))) {
      return json({ error: 'position must be a number' }, 400);
    }

    if (typeof body.position === 'number') {
      input.position = body.position;
    }
  }

  return input;
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env, params, data } = context;
    const playlistId = params.id;
    const itemId = params.itemId;

    if (request.method === 'PUT') {
      if (!data.user) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const parsed = await parseUpdateItemInput(request);
      if (parsed instanceof Response) {
        return parsed;
      }

      const item = await updateItem(env.DB, itemId, playlistId, data.user.id, parsed);

      if (!item) {
        return json({ error: 'Forbidden' }, 403);
      }

      return json(item);
    }

    if (request.method === 'DELETE') {
      if (!data.user) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const removed = await removeItem(env.DB, itemId, playlistId, data.user.id);

      if (!removed) {
        return json({ error: 'Forbidden' }, 403);
      }

      return new Response(null, { status: 204 });
    }

    return json({ error: 'Method not allowed' }, 405);
  },
];
