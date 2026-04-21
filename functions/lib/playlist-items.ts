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

export async function swapItemPositions(
  db: D1Database,
  playlistId: string,
  userId: string,
  itemIdA: string,
  itemIdB: string,
): Promise<boolean> {
  if (!(await isPlaylistOwner(db, playlistId, userId))) {
    return false;
  }

  // MATERIALIZED CTE forces SQLite to compute original positions as a
  // temporary result set BEFORE the UPDATE runs. Without MATERIALIZED,
  // SQLite may inline the CTE and read already-updated rows.
  const result = await db
    .prepare(
      `WITH swap AS MATERIALIZED (
         SELECT a.id AS id_a, a.position AS pos_a,
                b.id AS id_b, b.position AS pos_b
         FROM playlist_items a
         JOIN playlist_items b ON b.id = ? AND b.playlist_id = ?
         WHERE a.id = ? AND a.playlist_id = ?
       )
       UPDATE playlist_items
       SET position = CASE id
         WHEN (SELECT id_a FROM swap) THEN (SELECT pos_b FROM swap)
         WHEN (SELECT id_b FROM swap) THEN (SELECT pos_a FROM swap)
       END
       WHERE id IN (SELECT id_a FROM swap UNION ALL SELECT id_b FROM swap)`,
    )
    .bind(itemIdB, playlistId, itemIdA, playlistId)
    .run();

  if (result.meta.changes === 0) {
    return false;
  }

  await db.prepare('UPDATE user_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(playlistId).run();

  return true;
}

export async function reorderItems(
  db: D1Database,
  playlistId: string,
  userId: string,
  itemIds: string[],
): Promise<boolean> {
  const owner = await db
    .prepare('SELECT user_id FROM user_playlists WHERE id = ?')
    .bind(playlistId)
    .first<{ user_id: string }>();

  if (!owner || owner.user_id !== userId) {
    return false;
  }

  const existing = await db
    .prepare('SELECT id FROM playlist_items WHERE playlist_id = ?')
    .bind(playlistId)
    .all<{ id: string }>();

  if (existing.results.length !== itemIds.length) {
    return false;
  }

  const existingIds = new Set(existing.results.map((row) => row.id));
  if (!itemIds.every((id) => existingIds.has(id))) {
    return false;
  }

  const stmts = itemIds.map((id, idx) =>
    db
      .prepare('UPDATE playlist_items SET position = ? WHERE id = ? AND playlist_id = ?')
      .bind(itemIds.length - 1 - idx, id, playlistId),
  );
  await db.batch(stmts);

  await db.prepare('UPDATE user_playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(playlistId).run();

  return true;
}
