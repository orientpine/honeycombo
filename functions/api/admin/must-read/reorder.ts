import { isAdmin } from '../../../lib/admin';
import { listMustReadItems, reorderMustReadItems } from '../../../lib/must-read';
import type { AppPagesFunction, ContextData, Env } from '../../../lib/types';

type AdminContext = {
  request: Request;
  env: Env;
  data: ContextData;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const handler = async (context: AdminContext): Promise<Response> => {
  const { request, env, data } = context;

  if (request.method !== 'PUT') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!data.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!isAdmin(env, data.user.id)) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (body === null || typeof body !== 'object' || !('ids' in body)) {
      return json({ error: 'ids must be a non-empty array of strings' }, 400);
    }

    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string' && id.length > 0)) {
      return json({ error: 'ids must be a non-empty array of strings' }, 400);
    }

    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) {
      return json({ error: 'ids must not contain duplicates' }, 400);
    }

    const existingItems = await listMustReadItems(env.DB);
    const existingIds = new Set(existingItems.map(i => i.id));
    const invalidIds = ids.filter(id => !existingIds.has(id));
    if (invalidIds.length > 0) {
      return json({ error: `Unknown item ids: ${invalidIds.join(', ')}` }, 400);
    }

    if (ids.length !== existingItems.length) {
      return json({ error: 'ids must include all existing items' }, 400);
    }

    await reorderMustReadItems(env.DB, ids);
    return json({ success: true });
  } catch {
    return json({ error: 'Internal server error' }, 500);
  }
};

export const onRequest: AppPagesFunction[] = [handler];
