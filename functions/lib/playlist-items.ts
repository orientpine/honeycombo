import { generateId } from './id';
import { isValidUrl, isBlockedDomain, isValidSourceId } from './validate';
import type { PlaylistItemRow, AddItemInput, UpdateItemInput } from './types';

export class DuplicateItemError extends Error {
  constructor() {
    super('Duplicate item');
    this.name = 'DuplicateItemError';
  }
}

async function isPlaylistOwner(db: D1Database, playlistId: string, userId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT user_id FROM user_playlists WHERE id = ? AND user_id = ?')
    .bind(playlistId, userId)
    .first<{ user_id: string }>();

  return row !== null;
}

async function getItemRow(db: D1Database, itemId: string): Promise<PlaylistItemRow | null> {
  return db
    .prepare(
      `SELECT id, playlist_id, item_type, source_id, external_url, title_snapshot, url_snapshot,
              description_snapshot, note, position, added_at
       FROM playlist_items
       WHERE id = ?`,
    )
    .bind(itemId)
    .first<PlaylistItemRow>();
}

export async function addItem(
  db: D1Database,
  playlistId: string,
  userId: string,
  input: AddItemInput
): Promise<PlaylistItemRow | null> {
  if (!(await isPlaylistOwner(db, playlistId, userId))) {
    return null;
  }

  if (input.item_type === 'external') {
    if (!input.external_url || !isValidUrl(input.external_url) || isBlockedDomain(input.external_url)) {
      return null;
    }
  } else if (!input.source_id || !isValidSourceId(input.source_id)) {
    return null;
  }

  const positionRow = await db
    .prepare('SELECT MAX(position) AS max_position FROM playlist_items WHERE playlist_id = ?')
    .bind(playlistId)
    .first<{ max_position: number | null }>();

  const position = positionRow?.max_position === null || positionRow?.max_position === undefined
    ? 0
    : positionRow.max_position + 1;
  const id = generateId();

  try {
    await db
      .prepare(
        `INSERT INTO playlist_items (
        id,
        playlist_id,
        item_type,
        source_id,
        external_url,
        title_snapshot,
        url_snapshot,
        description_snapshot,
        note,
        position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        playlistId,
        input.item_type,
        input.item_type === 'external' ? null : input.source_id ?? null,
        input.item_type === 'external' ? input.external_url : null,
        input.title_snapshot,
        input.url_snapshot,
        input.description_snapshot ?? null,
        input.note ?? null,
        position
      )
      .run();
  } catch (err: unknown) {
    if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
      throw new DuplicateItemError();
    }
    throw err;
  }

  await db.prepare('UPDATE user_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(playlistId).run();

  return getItemRow(db, id);
}

export async function updateItem(
  db: D1Database,
  itemId: string,
  playlistId: string,
  userId: string,
  input: UpdateItemInput
): Promise<PlaylistItemRow | null> {
  if (!(await isPlaylistOwner(db, playlistId, userId))) {
    return null;
  }

  const existing = await db
    .prepare(
      `SELECT id, playlist_id, item_type, source_id, external_url, title_snapshot, url_snapshot,
              description_snapshot, note, position, added_at
       FROM playlist_items
       WHERE id = ? AND playlist_id = ?`,
    )
    .bind(itemId, playlistId)
    .first<PlaylistItemRow>();

  if (!existing) {
    return null;
  }

  const note = input.note ?? existing.note;
  const position = input.position ?? existing.position;

  const result = await db
    .prepare('UPDATE playlist_items SET note = ?, position = ? WHERE id = ? AND playlist_id = ?')
    .bind(note, position, itemId, playlistId)
    .run();

  if (result.meta.changes === 0) {
    return null;
  }

  await db.prepare('UPDATE user_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(playlistId).run();

  return getItemRow(db, itemId);
}

export async function removeItem(
  db: D1Database,
  itemId: string,
  playlistId: string,
  userId: string
): Promise<boolean> {
  if (!(await isPlaylistOwner(db, playlistId, userId))) {
    return false;
  }

  const result = await db
    .prepare('DELETE FROM playlist_items WHERE id = ? AND playlist_id = ?')
    .bind(itemId, playlistId)
    .run();

  if (result.meta.changes === 0) {
    return false;
  }

  await db.prepare('UPDATE user_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(playlistId).run();

  return true;
}
