import { isAdmin } from '../../../../lib/admin';
import { setPlaylistStatus } from '../../../../lib/playlists';
import type { AppPagesFunction } from '../../../../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest: AppPagesFunction[] = [
  async ({ request, env, params, data }) => {
    if (request.method !== 'PUT') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (!data.user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (!isAdmin(env, data.user.id)) {
      return json({ error: 'Forbidden' }, 403);
    }

    const playlist = await setPlaylistStatus(env.DB, params.id, 'approved');

    if (!playlist) {
      return json({ error: 'Playlist not found' }, 404);
    }

    return json(playlist);
  },
];
