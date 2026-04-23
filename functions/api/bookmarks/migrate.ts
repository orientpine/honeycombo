import { addItem, DuplicateItemError } from '../../lib/playlist-items';
import { getOrCreateReadLaterPlaylist } from '../../lib/playlists';
import type {
  AppPagesFunction,
  MigrateBookmarksInput,
  MigrateBookmarksResponse,
  ToggleBookmarkInput,
} from '../../lib/types';

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

function parseBookmarkItem(value: unknown): ToggleBookmarkInput | null {
  if (!isObject(value)) {
    return null;
  }

  const sourceId = value.source_id;
  const itemType = value.item_type;
  const titleSnapshot = value.title_snapshot;
  const urlSnapshot = value.url_snapshot;
  const descriptionSnapshot = value.description_snapshot;

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
    return null;
  }

  return {
    source_id: sourceId,
    item_type: itemType,
    title_snapshot: titleSnapshot,
    url_snapshot: urlSnapshot,
    ...(typeof descriptionSnapshot === 'string' ? { description_snapshot: descriptionSnapshot } : {}),
  };
}

async function parseMigrateBookmarksInput(request: Request): Promise<MigrateBookmarksInput | Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid input' }, 400);
  }

  if (!isObject(body) || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 200) {
    return json({ error: 'Invalid input' }, 400);
  }

  return { items: body.items };
}

export const onRequestPost: AppPagesFunction = async (context) => {
  const { request, env, data } = context;

  if (!data.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const parsed = await parseMigrateBookmarksInput(request);
  if (parsed instanceof Response) {
    return parsed;
  }

  const playlist = await getOrCreateReadLaterPlaylist(env.DB, data.user.id);
  let imported = 0;
  let skipped = 0;

  for (const rawItem of parsed.items) {
    const item = parseBookmarkItem(rawItem);

    if (!item) {
      skipped += 1;
      continue;
    }

    try {
      const added = await addItem(env.DB, playlist.id, data.user.id, item);

      if (added) {
        imported += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      if (error instanceof DuplicateItemError) {
        skipped += 1;
        continue;
      }

      throw error;
    }
  }

  const response: MigrateBookmarksResponse = {
    imported,
    skipped,
    playlist_id: playlist.id,
  };

  return json(response);
};
