import type { Env } from '../lib/types';
import { verifyWebhookSecret } from '../lib/webhooks';

interface WebhookContext {
  request: Request;
  env: Env;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest = async ({ request, env }: WebhookContext): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!verifyWebhookSecret(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: { article_id: string };
  try {
    payload = await request.json() as { article_id: string };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!payload.article_id) {
    return json({ error: 'Missing article_id' }, 400);
  }

  const result = await env.DB.prepare(
    "DELETE FROM playlist_items WHERE item_type = 'curated' AND source_id = ?",
  ).bind(payload.article_id).run();

  await env.DB.prepare('DELETE FROM submissions WHERE article_id = ?').bind(payload.article_id).run();

  return Response.json({ status: 'removed', items_deleted: result.meta.changes });
};
