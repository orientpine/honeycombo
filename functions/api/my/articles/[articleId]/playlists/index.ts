import { addItem, DuplicateItemError } from '../../../../../lib/playlist-items';
import type { AppPagesFunction, AddItemInput } from '../../../../../lib/types';

interface SubmissionLookupRow {
  article_id: string;
  title: string;
  url: string;
}

interface PlaylistLookupRow {
  id: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function parsePlaylistId(request: Request): Promise<string | Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isObject(body)) {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (typeof body.playlist_id !== 'string' || !body.playlist_id.trim()) {
    return json({ error: 'playlist_id is required' }, 400);
  }

  return body.playlist_id.trim();
}

async function getOwnedSubmission(db: D1Database, articleId: string, userId: string): Promise<SubmissionLookupRow | null> {
  return db
    .prepare('SELECT article_id, title, url FROM submissions WHERE article_id = ? AND submitted_by_id = ?')
    .bind(articleId, userId)
    .first<SubmissionLookupRow>();
}

async function getOwnedPlaylist(db: D1Database, playlistId: string, userId: string): Promise<PlaylistLookupRow | null> {
  return db
    .prepare('SELECT id FROM user_playlists WHERE id = ? AND user_id = ?')
    .bind(playlistId, userId)
    .first<PlaylistLookupRow>();
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env, params, data } = context;
    const articleId = params.articleId;

    if (request.method === 'POST') {
      if (!data.user) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const playlistId = await parsePlaylistId(request);
      if (playlistId instanceof Response) {
        return playlistId;
      }

      const userId = data.user.id;
      const submission = await getOwnedSubmission(env.DB, articleId, userId);
      if (!submission) {
        return json({ error: 'Article not found' }, 404);
      }

      const playlist = await getOwnedPlaylist(env.DB, playlistId, userId);
      if (!playlist) {
        return json({ error: 'Playlist not found' }, 404);
      }

      const input: AddItemInput = {
        item_type: 'curated',
        source_id: articleId,
        title_snapshot: submission.title,
        url_snapshot: submission.url,
      };

      try {
        const item = await addItem(env.DB, playlist.id, userId, input);
        if (!item) {
          return json({ error: 'Unable to add article' }, 400);
        }

        return json({ success: true, playlist_id: playlist.id, article_id: articleId }, 201);
      } catch (error) {
        if (error instanceof DuplicateItemError) {
          return json({ error: 'Article already in this playlist' }, 409);
        }

        throw error;
      }
    }

    return json({ error: 'Method not allowed' }, 405);
  },
];
