import { listMustReadItems } from '../lib/must-read';
import type { AppPagesFunction } from '../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env } = context;

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    try {
      const items = await listMustReadItems(env.DB);
      return json({ items });
    } catch {
      return json({ items: [] });
    }
  },
];
