import { addItem, DuplicateItemError } from '../../../../lib/playlist-items';
import { isBlockedDomain, isValidUrl } from '../../../../lib/validate';
import type { AddItemInput, AppPagesFunction } from '../../../../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withRateLimitHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', '100');
  headers.set('X-RateLimit-Remaining', '99');
  headers.set('X-RateLimit-Reset', '0');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function parseAddItemInput(request: Request): Promise<AddItemInput | Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isObject(body)) {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { item_type, source_id, external_url, title_snapshot, url_snapshot, description_snapshot, note } = body;

  if (item_type !== 'curated' && item_type !== 'feed' && item_type !== 'external') {
    return json({ error: 'item_type is required' }, 400);
  }

  if (typeof title_snapshot !== 'string' || !title_snapshot.trim()) {
    return json({ error: 'title_snapshot is required' }, 400);
  }

  if (typeof url_snapshot !== 'string' || !url_snapshot.trim()) {
    return json({ error: 'url_snapshot is required' }, 400);
  }

  if (description_snapshot !== undefined && typeof description_snapshot !== 'string') {
    return json({ error: 'description_snapshot must be a string' }, 400);
  }

  if (note !== undefined && typeof note !== 'string') {
    return json({ error: 'note must be a string' }, 400);
  }

  if (item_type === 'external') {
    if (typeof external_url !== 'string' || !external_url.trim()) {
      return json({ error: 'external_url is required for external items' }, 400);
    }

    if (!isValidUrl(external_url) || isBlockedDomain(external_url)) {
      return json({ error: 'Invalid external URL' }, 400);
    }

    return {
      item_type,
      external_url,
      title_snapshot,
      url_snapshot,
      ...(typeof description_snapshot === 'string' ? { description_snapshot } : {}),
      ...(typeof note === 'string' ? { note } : {}),
    };
  }

  if (typeof source_id !== 'string' || !source_id.trim()) {
    return json({ error: 'source_id is required for curated and feed items' }, 400);
  }

  return {
    item_type,
    source_id,
    title_snapshot,
    url_snapshot,
    ...(typeof description_snapshot === 'string' ? { description_snapshot } : {}),
    ...(typeof note === 'string' ? { note } : {}),
  };
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env, params, data } = context;

    if (request.method === 'POST') {
      if (!data.user) {
        return withRateLimitHeaders(json({ error: 'Unauthorized' }, 401));
      }

      const parsed = await parseAddItemInput(request);
      if (parsed instanceof Response) {
        return withRateLimitHeaders(parsed);
      }

      try {
        const item = await addItem(env.DB, params.id, data.user.id, parsed);
        if (!item) {
          return withRateLimitHeaders(json({ error: 'Forbidden' }, 403));
        }
        return withRateLimitHeaders(json(item, 201));
      } catch (err) {
        if (err instanceof DuplicateItemError) {
          return withRateLimitHeaders(json({ error: '이미 추가된 기사입니다' }, 409));
        }
        throw err;
      }
    }

    return json({ error: 'Method not allowed' }, 405);
  },
];
