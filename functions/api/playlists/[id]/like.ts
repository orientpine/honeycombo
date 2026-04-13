import { getLikeStatus, isPublicApprovedPlaylist, toggleLike } from '../../../lib/likes';
import type { AppPagesFunction } from '../../../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env, params, data } = context;
    const playlistId = params.id;

    if (request.method === 'GET') {
      const result = await getLikeStatus(env.DB, playlistId, data.user?.id);
      return json(result);
    }

    if (request.method === 'POST') {
      if (!data.user) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const exists = await isPublicApprovedPlaylist(env.DB, playlistId);
      if (!exists) {
        return json({ error: 'Playlist not found or not public' }, 404);
      }

      const result = await toggleLike(env.DB, data.user.id, playlistId);
      return json(result);
    }

    return json({ error: 'Method not allowed' }, 405);
  },
];
