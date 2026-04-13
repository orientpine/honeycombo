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

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function serializeTags(tags?: string[]): string | null {
  if (!tags || tags.length === 0) return null;
  return JSON.stringify(tags.slice(0, 5));
}

async function getPlaylistRow(db: D1Database, playlistId: string): Promise<PlaylistRow | null> {
  return db
    .prepare(
      `SELECT id, user_id, title, description, visibility, status, playlist_type, tags, created_at, updated_at
       FROM user_playlists
       WHERE id = ?`,
    )
    .bind(playlistId)
    .first<PlaylistRow>();
}

export async function listPendingPlaylists(db: D1Database): Promise<PendingPlaylistRow[]> {
  const result = await db
    .prepare(
      `SELECT p.id, p.user_id, p.title, p.description, p.visibility, p.status, p.playlist_type, p.tags, p.created_at, p.updated_at,
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
  input: { title: string; description?: string; visibility?: 'unlisted' | 'public'; playlist_type?: 'community' | 'editor'; tags?: string[] },
): Promise<PlaylistRow> {
  const id = generateId();
  const playlistType = input.playlist_type ?? 'community';
  const tags = serializeTags(input.tags);

  // Editor playlists are always public + auto-approved
  const visibility = playlistType === 'editor' ? 'public' : (input.visibility ?? 'unlisted');
  const status = playlistType === 'editor' ? 'approved' : (visibility === 'public' ? 'pending' : 'draft');

  await db
    .prepare(
      `INSERT INTO user_playlists (id, user_id, title, description, visibility, status, playlist_type, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, input.title, input.description ?? null, visibility, status, playlistType, tags)
    .run();

  const playlist = await getPlaylistRow(db, id);

  if (!playlist) {
    throw new Error('Failed to create playlist');
  }

  return playlist;
}

export async function getOrCreateAutoPlaylist(db: D1Database, userId: string): Promise<PlaylistRow> {
  const existingPlaylist = await db
    .prepare('SELECT * FROM user_playlists WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1')
    .bind(userId)
    .first<PlaylistRow>();

  if (existingPlaylist) {
    return existingPlaylist;
  }

  const id = generateId();

  await db
    .prepare(
      `INSERT INTO user_playlists (id, user_id, title, visibility, status, playlist_type, is_auto_created)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, '내 제출 기사', 'unlisted', 'draft', 'community', 1)
    .run();

  const playlist = await getPlaylistRow(db, id);

  if (!playlist) {
    throw new Error('Failed to create auto playlist');
  }

  return playlist;
}

export async function getPlaylist(db: D1Database, playlistId: string): Promise<PlaylistDetail | null> {
  const playlist = await db
    .prepare(
      `SELECT p.id, p.title, p.description, p.visibility, p.status, p.playlist_type, p.tags,
              p.created_at, p.updated_at,
              u.id AS user_id, u.username, u.display_name, u.avatar_url
       FROM user_playlists p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
    )
    .bind(playlistId)
    .first<
      Pick<PlaylistRow, 'id' | 'title' | 'description' | 'visibility' | 'status' | 'playlist_type' | 'tags' | 'created_at' | 'updated_at'> & {
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
    playlist_type: playlist.playlist_type,
    tags: parseTags(playlist.tags),
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
  playlistType?: 'community' | 'editor',
): Promise<PlaylistListResponse> {
  const currentPage = normalizePage(page);
  const pageSize = normalizeLimit(limit);
  const offset = (currentPage - 1) * pageSize;

  const typeFilter = playlistType ? ` AND p.playlist_type = '${playlistType}'` : '';

  const countRow = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM user_playlists p
       WHERE p.visibility = 'public' AND p.status = 'approved'${typeFilter}`,
    )
    .first<{ total: number | string }>();

  const total = Number(countRow?.total ?? 0);

  const result = await db
    .prepare(
      `SELECT p.id, p.user_id, p.title, p.description, p.visibility, p.status, p.playlist_type, p.tags,
              p.created_at, p.updated_at,
              u.username, u.display_name, u.avatar_url,
              (
                SELECT COUNT(*)
                FROM playlist_items pi
                WHERE pi.playlist_id = p.id
              ) AS item_count
       FROM user_playlists p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.visibility = 'public' AND p.status = 'approved'${typeFilter}
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
      playlist_type: playlist.playlist_type,
      tags: playlist.tags,
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
      `SELECT p.id, p.user_id, p.title, p.description, p.visibility, p.status, p.playlist_type, p.tags,
              p.created_at, p.updated_at,
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

  return result.results.map((row): UserPlaylistWithCount => {
    const { contains_item, item_count, ...playlist } = row;

    return {
      ...playlist,
      item_count: Number(item_count),
      ...(contains_item !== undefined ? { contains_item: Boolean(contains_item) } : {}),
    };
  });
}

export async function updatePlaylist(
  db: D1Database,
  playlistId: string,
  userId: string,
  input: { title?: string; description?: string; tags?: string[] },
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

  if (input.tags !== undefined) {
    updates.push('tags = ?');
    values.push(serializeTags(input.tags));
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

  // Check if this is an editor playlist — editor playlists auto-approve
  const row = await db
    .prepare('SELECT playlist_type FROM user_playlists WHERE id = ?')
    .bind(playlistId)
    .first<Pick<PlaylistRow, 'playlist_type'>>();

  const isEditor = row?.playlist_type === 'editor';
  const status = visibility === 'public'
    ? (isEditor ? 'approved' : 'pending')
    : 'draft';

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
