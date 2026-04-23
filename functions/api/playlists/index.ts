import { isAdmin } from '../../lib/admin';
import { createPlaylist, listPublicPlaylists, listUserPlaylists } from '../../lib/playlists';
import { validatePlaylistDescription, validatePlaylistTitle } from '../../lib/validate';
import type { AppPagesFunction, CreatePlaylistInput, PlaylistCategory } from '../../lib/types';

const PLAYLIST_CATEGORIES: PlaylistCategory[] = ['read_later', 'submissions'];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withRateLimitHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', '100');
  headers.set('X-RateLimit-Remaining', '99');
  headers.set('X-RateLimit-Reset', '0');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function parseCreateInput(request: Request, userIsAdmin: boolean): Promise<CreatePlaylistInput | Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!isObject(body)) {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { title, description, visibility, playlist_type, tags } = body;

  if (typeof title !== 'string') {
    return json({ error: 'Title is required' }, 400);
  }

  const titleValidation = validatePlaylistTitle(title);
  if (!titleValidation.valid) {
    return json({ error: titleValidation.error }, 400);
  }

  if (description !== undefined && typeof description !== 'string') {
    return json({ error: 'Description must be a string' }, 400);
  }

  if (typeof description === 'string') {
    const descriptionValidation = validatePlaylistDescription(description);
    if (!descriptionValidation.valid) {
      return json({ error: descriptionValidation.error }, 400);
    }
  }

  if (visibility !== undefined && visibility !== 'unlisted' && visibility !== 'public') {
    return json({ error: 'Visibility must be unlisted or public' }, 400);
  }

  // playlist_type validation: only admin can create editor playlists
  if (playlist_type !== undefined && playlist_type !== 'community' && playlist_type !== 'editor') {
    return json({ error: 'playlist_type must be community or editor' }, 400);
  }

  if (playlist_type === 'editor' && !userIsAdmin) {
    return json({ error: 'Only admins can create editor playlists' }, 403);
  }

  // tags validation: array of strings, max 5
  if (tags !== undefined) {
    if (!Array.isArray(tags) || !tags.every((t: unknown) => typeof t === 'string')) {
      return json({ error: 'Tags must be an array of strings' }, 400);
    }
    if (tags.length > 5) {
      return json({ error: 'Maximum 5 tags allowed' }, 400);
    }
  }

  return {
    title,
    ...(typeof description === 'string' ? { description } : {}),
    ...(visibility === 'unlisted' || visibility === 'public' ? { visibility } : {}),
    ...(playlist_type === 'community' || playlist_type === 'editor' ? { playlist_type } : {}),
    ...(Array.isArray(tags) ? { tags: tags as string[] } : {}),
  };
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env, data } = context;
    const method = request.method;

    if (method === 'GET') {
      const url = new URL(request.url);
      const mine = url.searchParams.get('mine') === 'true';
      const sourceId = url.searchParams.get('source_id');
      const itemType = url.searchParams.get('item_type');
      const typeParam = url.searchParams.get('type');
      const excludeCategoryParam = url.searchParams.get('exclude_category');

      if (mine) {
        if (!data.user) {
          return json({ error: 'Unauthorized' }, 401);
        }

        const containment = sourceId && itemType ? { source_id: sourceId, item_type: itemType } : undefined;
        const excludeCategory = PLAYLIST_CATEGORIES.find((category) => category === excludeCategoryParam);
        const playlists = await listUserPlaylists(env.DB, data.user.id, containment, excludeCategory);
        return json({ playlists });
      }

      const page = parsePositiveInt(url.searchParams.get('page'), 1);
      const limit = parsePositiveInt(url.searchParams.get('limit'), 12);
      const playlistType = typeParam === 'editor' ? 'editor' : typeParam === 'community' ? 'community' : undefined;
      const playlists = await listPublicPlaylists(env.DB, page, limit, playlistType);
      return json(playlists);
    }

    if (method === 'POST') {
      if (!data.user) {
        return withRateLimitHeaders(json({ error: 'Unauthorized' }, 401));
      }

      const userIsAdmin = isAdmin(env, data.user.id);
      const parsed = await parseCreateInput(request, userIsAdmin);
      if (parsed instanceof Response) {
        return withRateLimitHeaders(parsed);
      }

      const playlist = await createPlaylist(env.DB, data.user.id, parsed);
      return withRateLimitHeaders(json(playlist, 201));
    }

    return json({ error: 'Method not allowed' }, 405);
  },
];
