import { addItem, DuplicateItemError } from '../lib/playlist-items';
import { getOrCreateAutoPlaylist } from '../lib/playlists';
import type { Env } from '../lib/types';
import { verifyWebhookSecret } from '../lib/webhooks';

interface ApprovedPayload {
  article_id: string;
  submitted_by_id: string;
  title: string;
  url: string;
  description?: string;
}

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

  if (user) {
    const playlist = await getOrCreateAutoPlaylist(env.DB, user.id);

    try {
      const item = await addItem(env.DB, playlist.id, user.id, {
        item_type: 'curated',
        source_id: payload.article_id,
        title_snapshot: payload.title,
        url_snapshot: payload.url,
        description_snapshot: payload.description,
      });

      if (!item) {
        throw new Error('Failed to add approved submission to playlist');
      }
    } catch (err) {
      if (err instanceof DuplicateItemError) {
        return Response.json({ status: 'already_exists' });
      }
      throw err;
    }

    return Response.json({ status: 'added', playlist_id: playlist.id });
  }

  await env.DB.prepare(
    'INSERT OR IGNORE INTO submissions (article_id, submitted_by_id, title, url) VALUES (?, ?, ?, ?)',
  ).bind(payload.article_id, payload.submitted_by_id, payload.title, payload.url).run();

  return Response.json({ status: 'deferred' });
};
