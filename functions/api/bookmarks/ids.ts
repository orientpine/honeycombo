import type { AppPagesFunction, BookmarkStatusResponse, PlaylistCategory } from '../../lib/types';

const READ_LATER_CATEGORY: PlaylistCategory = 'read_later';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestGet: AppPagesFunction = async (context) => {
  const { env, data } = context;

  if (!data.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const playlist = await env.DB
    .prepare(
      `SELECT id FROM user_playlists
       WHERE user_id = ? AND playlist_category = ?
       LIMIT 1`,
    )
    .bind(data.user.id, READ_LATER_CATEGORY)
    .first<{ id: string }>();

  if (!playlist) {
    const response: BookmarkStatusResponse = {
      bookmarked_ids: [],
      playlist_id: null,
    };

    return json(response);
  }

  const items = await env.DB
    .prepare(
      `SELECT source_id FROM playlist_items
       WHERE playlist_id = ? AND source_id IS NOT NULL`,
    )
    .bind(playlist.id)
    .all<{ source_id: string | null }>();

  const response: BookmarkStatusResponse = {
    bookmarked_ids: items.results.map((row) => String(row.source_id)),
    playlist_id: playlist.id,
  };

  return json(response);
};
