import { isAdmin } from '../../../lib/admin';
import { generateId } from '../../../lib/id';
import { addMustReadItem, getNextPosition, listMustReadItems } from '../../../lib/must-read';
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

  if (!data.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!isAdmin(env, data.user.id)) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    if (request.method === 'GET') {
      const items = await listMustReadItems(env.DB);
      return json({ items });
    }

    if (request.method === 'POST') {
      let body: unknown;

      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }

      if (body === null || typeof body !== 'object') {
        return json({ error: 'Invalid request body' }, 400);
      }

      const { source_id, item_type, title_snapshot, url_snapshot, source_snapshot, description_snapshot } = body as Record<
        string,
        unknown
      >;

      if (typeof source_id !== 'string' || !source_id.trim()) {
        return json({ error: 'source_id is required' }, 400);
      }

      if (item_type !== 'curated' && item_type !== 'feed') {
        return json({ error: 'item_type must be curated or feed' }, 400);
      }

      if (typeof title_snapshot !== 'string' || !title_snapshot.trim()) {
        return json({ error: 'title_snapshot is required' }, 400);
      }

      if (typeof url_snapshot !== 'string' || !url_snapshot.trim()) {
        return json({ error: 'url_snapshot is required' }, 400);
      }

      if (source_snapshot !== undefined && source_snapshot !== null && typeof source_snapshot !== 'string') {
        return json({ error: 'source_snapshot must be a string or null' }, 400);
      }

      if (
        description_snapshot !== undefined &&
        description_snapshot !== null &&
        typeof description_snapshot !== 'string'
      ) {
        return json({ error: 'description_snapshot must be a string or null' }, 400);
      }

      try {
        const item = await addMustReadItem(env.DB, {
          id: generateId(),
          source_id: source_id.trim(),
          item_type,
          title_snapshot: title_snapshot.trim(),
          url_snapshot: url_snapshot.trim(),
          source_snapshot: typeof source_snapshot === 'string' ? source_snapshot : null,
          description_snapshot: typeof description_snapshot === 'string' ? description_snapshot : null,
          position: await getNextPosition(env.DB),
          added_by: data.user.id,
        });

        return json(item, 201);
      } catch (insertErr: unknown) {
        const msg = insertErr instanceof Error ? insertErr.message : '';
        if (msg.includes('UNIQUE constraint failed')) {
          return json({ error: '이미 추가된 기사입니다.' }, 409);
        }
        throw insertErr;
      }
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch {
    return json({ error: 'Internal server error' }, 500);
  }
};

export const onRequest: AppPagesFunction[] = [handler];
