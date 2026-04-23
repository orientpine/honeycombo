import { addItem, DuplicateItemError, removeItem } from '../../lib/playlist-items';
import { getOrCreateReadLaterPlaylist } from '../../lib/playlists';
import type { AppPagesFunction, ToggleBookmarkInput, ToggleBookmarkResponse } from '../../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBookmarkItemType(value: unknown): value is ToggleBookmarkInput['item_type'] {
  return value === 'curated' || value === 'feed';
}

async function parseToggleBookmarkInput(request: Request): Promise<ToggleBookmarkInput | Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid input' }, 400);
  }

  if (!isObject(body)) {
    return json({ error: 'Invalid input' }, 400);
  }

  const sourceId = body.source_id;
  const itemType = body.item_type;
  const titleSnapshot = body.title_snapshot;
  const urlSnapshot = body.url_snapshot;
  const descriptionSnapshot = body.description_snapshot;

  if (
    typeof sourceId !== 'string' ||
    !sourceId.trim() ||
    !isBookmarkItemType(itemType) ||
    typeof titleSnapshot !== 'string' ||
    !titleSnapshot.trim() ||
    typeof urlSnapshot !== 'string' ||
    !urlSnapshot.trim() ||
    (descriptionSnapshot !== undefined && typeof descriptionSnapshot !== 'string')
  ) {
    return json({ error: 'Invalid input' }, 400);
  }

  return {
    source_id: sourceId,
    item_type: itemType,
    title_snapshot: titleSnapshot,
    url_snapshot: urlSnapshot,
    ...(typeof descriptionSnapshot === 'string' ? { description_snapshot: descriptionSnapshot } : {}),
  };
}

export const onRequestPost: AppPagesFunction = async (context) => {
  const { request, env, data } = context;

  if (!data.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const parsed = await parseToggleBookmarkInput(request);
  if (parsed instanceof Response) {
    return parsed;
  }

  const playlist = await getOrCreateReadLaterPlaylist(env.DB, data.user.id);
  const existing = await env.DB
    .prepare(
      `SELECT id FROM playlist_items
       WHERE playlist_id = ? AND item_type = ? AND source_id = ?
       LIMIT 1`,
    )
    .bind(playlist.id, parsed.item_type, parsed.source_id)
    .first<{ id: string }>();

  const response: ToggleBookmarkResponse = {
    bookmarked: !existing,
    playlist_id: playlist.id,
  };

  if (existing) {
    await removeItem(env.DB, existing.id, playlist.id, data.user.id);
    response.bookmarked = false;
    return json(response);
  }

  try {
    await addItem(env.DB, playlist.id, data.user.id, parsed);
    return json(response);
  } catch (error) {
    if (error instanceof DuplicateItemError) {
      return json(response);
    }

    throw error;
  }
};
