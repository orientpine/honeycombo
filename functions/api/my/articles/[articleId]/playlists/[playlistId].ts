import type { AppPagesFunction } from '../../../../../lib/types';

interface SubmissionLookupRow {
  article_id: string;
}

interface PlaylistLookupRow {
  id: string;
}

interface PlaylistItemLookupRow {
  id: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getOwnedSubmission(db: D1Database, articleId: string, userId: string): Promise<SubmissionLookupRow | null> {
  return db
    .prepare('SELECT article_id FROM submissions WHERE article_id = ? AND submitted_by_id = ?')
    .bind(articleId, userId)
    .first<SubmissionLookupRow>();
}

async function getOwnedPlaylist(db: D1Database, playlistId: string, userId: string): Promise<PlaylistLookupRow | null> {
  return db
    .prepare('SELECT id FROM user_playlists WHERE id = ? AND user_id = ?')
    .bind(playlistId, userId)
    .first<PlaylistLookupRow>();
}

async function getPlaylistItem(db: D1Database, playlistId: string, articleId: string): Promise<PlaylistItemLookupRow | null> {
  return db
    .prepare(
      `SELECT id
       FROM playlist_items
       WHERE playlist_id = ?
         AND source_id = ?
         AND item_type IN ('curated', 'feed')`,
    )
    .bind(playlistId, articleId)
    .first<PlaylistItemLookupRow>();
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env, params, data } = context;
    const articleId = params.articleId;
    const playlistId = params.playlistId;

    if (request.method === 'DELETE') {
      if (!data.user) {
        return json({ error: 'Unauthorized' }, 401);
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

      const playlistItem = await getPlaylistItem(env.DB, playlist.id, articleId);
      if (!playlistItem) {
        return json({ error: 'Article not in this playlist' }, 404);
      }

      await env.DB.batch([
        env.DB.prepare('DELETE FROM playlist_items WHERE id = ?').bind(playlistItem.id),
        env.DB.prepare('UPDATE user_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(playlist.id),
      ]);

      return json({ success: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  },
];
