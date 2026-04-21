import { reorderItems } from '../../../../lib/playlist-items';
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

function isNonEmptyStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return value.every((item) => typeof item === 'string' && item.length > 0);
}

function hasDuplicates(arr: string[]): boolean {
  return new Set(arr).size !== arr.length;
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

    if (!isObject(body) || !isNonEmptyStringArray(body.item_ids)) {
      return json({ error: 'item_ids must be a non-empty array of strings' }, 400);
    }

    if (hasDuplicates(body.item_ids)) {
      return json({ error: 'item_ids must not contain duplicates' }, 400);
    }

    const success = await reorderItems(
      env.DB,
      params.id,
      data.user.id,
      body.item_ids,
    );

    if (!success) {
      return json({ error: 'Forbidden or invalid item_ids' }, 403);
    }

    return json({ success: true });
  },
];
