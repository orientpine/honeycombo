import type { Env } from '../lib/types';
import { verifyWebhookSecret } from '../lib/webhooks';

interface ApprovedPayload {
  article_id: string;
  submitted_by_id: string;
  title: string;
  url: string;
  description?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!verifyWebhookSecret(request, env)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: ApprovedPayload;
  try {
    payload = await request.json() as ApprovedPayload;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!payload.article_id || !payload.submitted_by_id || !payload.title || !payload.url) {
    return json({ error: 'Missing required fields' }, 400);
  }

  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(payload.submitted_by_id).first<{ id: string }>();
  const submittedById = user?.id ?? payload.submitted_by_id;

  // submissions table repurposed as canonical article registry. synced_to_playlist column semantics: 0 = not yet in any playlist, 1 = has been added to at least one (reserved for future use; currently unused).
  await env.DB.prepare(
    `INSERT INTO submissions (article_id, submitted_by_id, title, url, synced_to_playlist, created_at)
     VALUES (?, ?, ?, ?, 0, datetime('now'))
     ON CONFLICT(article_id) DO UPDATE SET
       submitted_by_id = excluded.submitted_by_id,
       title = excluded.title,
       url = excluded.url`,
  ).bind(payload.article_id, submittedById, payload.title, payload.url).run();

  return json({ success: true, article_id: payload.article_id });
};
