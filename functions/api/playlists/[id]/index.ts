import { deletePlaylist, getPlaylist, updatePlaylist } from '../../../lib/playlists';
import { validatePlaylistDescription, validatePlaylistTitle } from '../../../lib/validate';
import type { AppPagesFunction, UpdatePlaylistInput } from '../../../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function canViewPlaylist(playlist: NonNullable<Awaited<ReturnType<typeof getPlaylist>>>, userId?: string): boolean {
  if (playlist.visibility === 'unlisted') {
    return true;
  }

  if (playlist.visibility === 'public' && playlist.status === 'approved') {
    return true;
  }

  return playlist.user.id === userId;
}

async function parseUpdateInput(request: Request): Promise<UpdatePlaylistInput | Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isObject(body)) {
    return json({ error: 'Invalid request body' }, 400);
  }

  const input: UpdatePlaylistInput = {};

  if ('title' in body) {
    if (body.title !== undefined && typeof body.title !== 'string') {
      return json({ error: 'Title must be a string' }, 400);
    }

    if (typeof body.title === 'string') {
      const validation = validatePlaylistTitle(body.title);
      if (!validation.valid) {
        return json({ error: validation.error }, 400);
      }

      input.title = body.title;
    }
  }

  if ('description' in body) {
    if (body.description !== undefined && typeof body.description !== 'string') {
      return json({ error: 'Description must be a string' }, 400);
    }

    if (typeof body.description === 'string') {
      const validation = validatePlaylistDescription(body.description);
      if (!validation.valid) {
        return json({ error: validation.error }, 400);
      }

      input.description = body.description;
    }
  }

  return input;
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env, params, data } = context;
    const method = request.method;
    const playlistId = params.id;

    if (method === 'GET') {
      const playlist = await getPlaylist(env.DB, playlistId);

      if (!playlist) {
        return json({ error: 'Playlist not found' }, 404);
      }

      if (!canViewPlaylist(playlist, data.user?.id)) {
        return json({ error: 'Forbidden' }, 403);
      }

      return json(playlist);
    }

    if (method === 'PUT') {
      if (!data.user) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const parsed = await parseUpdateInput(request);
      if (parsed instanceof Response) {
        return parsed;
      }

      const playlist = await updatePlaylist(env.DB, playlistId, data.user.id, parsed);

      if (!playlist) {
        return json({ error: 'Forbidden' }, 403);
      }

      return json(playlist);
    }

    if (method === 'DELETE') {
      if (!data.user) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const deleted = await deletePlaylist(env.DB, playlistId, data.user.id);

      if (!deleted) {
        return json({ error: 'Forbidden' }, 403);
      }

      return new Response(null, { status: 204 });
    }

    return json({ error: 'Method not allowed' }, 405);
  },
];
