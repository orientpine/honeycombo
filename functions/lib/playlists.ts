import { generateId } from './id';
import type { PlaylistDetail, PlaylistItemRow, PlaylistListResponse, PlaylistRow, UserPlaylistWithCount, UserRow } from './types';

type PlaylistWithUserRow = PlaylistRow & Pick<UserRow, 'username' | 'display_name' | 'avatar_url'>;

export type PendingPlaylistRow = PlaylistRow & Pick<UserRow, 'username' | 'avatar_url'>;

function normalizePage(page: number): number {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function normalizeLimit(limit: number): number {
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 12;
}

async function getPlaylistRow(db: D1Database, playlistId: string): Promise<PlaylistRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, title, description, visibility, status, created_at, updated_at
       FROM user_playlists
       WHERE id = ?`,
    )
    .bind(playlistId)
    .first<PlaylistRow>();
}

export async function listPendingPlaylists(db: D1Database): Promise<PendingPlaylistRow[]> {
  const result = await db
    .prepare(
      `SELECT p.id, p.user_id, p.title, p.description, p.visibility, p.status, p.created_at, p.updated_at,
              u.username, u.avatar_url
       FROM user_playlists p
       JOIN users u ON p.user_id = u.id
       WHERE p.status = 'pending'
       ORDER BY p.updated_at DESC`,
    )
    .all<PendingPlaylistRow>();

  return result.results;
}

export async function setPlaylistStatus(
  db: D1Database,
  playlistId: string,
  status: 'approved' | 'rejected',
): Promise<PlaylistRow | null> {
  await db
    .prepare(
      `UPDATE user_playlists
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(status, playlistId)
    .run();

  return getPlaylistRow(db, playlistId);
}

async function getPlaylistOwner(db: D1Database, playlistId: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT user_id FROM user_playlists WHERE id = ?')
    .bind(playlistId)
    .first<Pick<PlaylistRow, 'user_id'>>();

  return row?.user_id ?? null;
}

export async function createPlaylist(
  db: D1Database,
  userId: string,
  input: { title: string; description?: string; visibility?: 'unlisted' | 'public' },
): Promise<PlaylistRow> {
  const id = generateId();
  const visibility = input.visibility ?? 'unlisted';

  await db
    .prepare(
      `INSERT INTO user_playlists (id, user_id, title, description, visibility, status)
       VALUES (?, ?, ?, ?, ?, 'draft')`,
    )
    .bind(id, userId, input.title, input.description ?? null, visibility)
    .run();

  const playlist = await getPlaylistRow(db, id);

  if (!playlist) {
    throw new Error('Failed to create playlist');
  }

  return playlist;
}

export async function getPlaylist(db: D1Database, playlistId: string): Promise<PlaylistDetail | null> {
  const playlist = await db
    .prepare(
      `SELECT p.id, p.title, p.description, p.visibility, p.status, p.created_at, p.updated_at,
              u.id AS user_id, u.username, u.display_name, u.avatar_url
       FROM user_playlists p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
    )
    .bind(playlistId)
    .first<
      Pick<PlaylistRow, 'id' | 'title' | 'description' | 'visibility' | 'status' | 'created_at' | 'updated_at'> & {
        user_id: string;
      } & Pick<UserRow, 'username' | 'display_name' | 'avatar_url'>
    >();

  if (!playlist) {
    return null;
  }

  const itemsResult = await db
    .prepare(
      `SELECT id, playlist_id, item_type, source_id, external_url, title_snapshot, url_snapshot,
              description_snapshot, note, position, added_at
       FROM playlist_items
       WHERE playlist_id = ?
       ORDER BY position ASC`,
    )
    .bind(playlistId)
    .all<PlaylistItemRow>();

  return {
    id: playlist.id,
    title: playlist.title,
    description: playlist.description,
    visibility: playlist.visibility,
    status: playlist.status,
    created_at: playlist.created_at,
    updated_at: playlist.updated_at,
    user: {
      id: playlist.user_id,
      username: playlist.username,
      display_name: playlist.display_name,
      avatar_url: playlist.avatar_url,
    },
    items: itemsResult.results,
  };
}

export async function listPublicPlaylists(
  db: D1Database,
  page: number,
  limit: number,
): Promise<PlaylistListResponse> {
  const currentPage = normalizePage(page);
  const pageSize = normalizeLimit(limit);
  const offset = (currentPage - 1) * pageSize;

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM user_playlists
       WHERE visibility = 'public' AND status = 'approved'`,
    )
    .first<{ total: number | string }>();

  const total = Number(countRow?.total ?? 0);

  const result = await db
    .prepare(
      `SELECT p.id, p.user_id, p.title, p.description, p.visibility, p.status, p.created_at, p.updated_at,
              u.username, u.display_name, u.avatar_url,
              (
                SELECT COUNT(*)
                FROM playlist_items pi
                WHERE pi.playlist_id = p.id
              ) AS item_count
       FROM user_playlists p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.visibility = 'public' AND p.status = 'approved'
       ORDER BY p.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(pageSize, offset)
    .all<PlaylistWithUserRow & { item_count: number | string }>();

  return {
    playlists: result.results.map((playlist) => ({
      id: playlist.id,
      user_id: playlist.user_id,
      title: playlist.title,
      description: playlist.description,
      visibility: playlist.visibility,
      status: playlist.status,
      created_at: playlist.created_at,
      updated_at: playlist.updated_at,
      user: {
        username: playlist.username,
        display_name: playlist.display_name,
        avatar_url: playlist.avatar_url,
      },
      item_count: Number(playlist.item_count),
    })),
    total,
    page: currentPage,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function listUserPlaylists(
  db: D1Database,
  userId: string,
  containment?: { source_id: string; item_type: string },
): Promise<UserPlaylistWithCount[]> {
  const containsItemSelect = containment
    ? `,
              EXISTS(
                SELECT 1 FROM playlist_items pi2
                WHERE pi2.playlist_id = p.id
                  AND pi2.item_type = ?
                  AND pi2.source_id = ?
              ) AS contains_item`
    : '';

  const result = await db
    .prepare(
      `SELECT p.id, p.user_id, p.title, p.description, p.visibility, p.status, p.created_at, p.updated_at,
              (
                SELECT COUNT(*)
                FROM playlist_items pi
                WHERE pi.playlist_id = p.id
              ) AS item_count${containsItemSelect}
       FROM user_playlists p
       WHERE p.user_id = ?
       ORDER BY p.updated_at DESC`,
    )
    .bind(...(containment ? [containment.item_type, containment.source_id, userId] : [userId]))
    .all<PlaylistRow & { item_count: number | string; contains_item?: number | boolean }>();

  return result.results.map((row) => ({
    ...row,
    item_count: Number(row.item_count),
    ...(row.contains_item !== undefined ? { contains_item: Boolean(row.contains_item) } : {}),
  }));
}

export async function updatePlaylist(
  db: D1Database,
  playlistId: string,
  userId: string,
  input: { title?: string; description?: string },
): Promise<PlaylistRow | null> {
  const ownerId = await getPlaylistOwner(db, playlistId);

  if (ownerId !== userId) {
    return null;
  }

  const updates: string[] = [];
  const values: Array<string | null> = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    values.push(input.title);
  }

  if (input.description !== undefined) {
    updates.push('description = ?');
    values.push(input.description);
  }

  if (updates.length === 0) {
    return getPlaylistRow(db, playlistId);
  }

  await db
    .prepare(
      `UPDATE user_playlists
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(...values, playlistId)
    .run();

  return getPlaylistRow(db, playlistId);
}

export async function deletePlaylist(db: D1Database, playlistId: string, userId: string): Promise<boolean> {
  const ownerId = await getPlaylistOwner(db, playlistId);

  if (ownerId !== userId) {
    return false;
  }

  await db.prepare('DELETE FROM user_playlists WHERE id = ?').bind(playlistId).run();

  return true;
}

export async function setVisibility(
  db: D1Database,
  playlistId: string,
  userId: string,
  visibility: 'unlisted' | 'public',
): Promise<PlaylistRow | null> {
  const ownerId = await getPlaylistOwner(db, playlistId);

  if (ownerId !== userId) {
    return null;
  }

  const status = visibility === 'public' ? 'pending' : 'draft';

  await db
    .prepare(
      `UPDATE user_playlists
       SET visibility = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(visibility, status, playlistId)
    .run();

  return getPlaylistRow(db, playlistId);
}
