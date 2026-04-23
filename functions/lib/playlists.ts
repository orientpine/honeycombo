import { generateId } from './id';
import type {
  PlaylistCategory,
  PlaylistDetail,
  PlaylistItemRow,
  PlaylistListResponse,
  PlaylistRow,
  UserPlaylistWithCount,
  UserRow,
} from './types';

type PlaylistWithUserRow = PlaylistRow & Pick<UserRow, 'username' | 'display_name' | 'avatar_url'>;

export type PendingPlaylistRow = PlaylistRow & Pick<UserRow, 'username' | 'avatar_url'>;

/**
 * Error thrown when attempting to modify or delete a protected auto-playlist.
 * Currently applies to the 'read_later' category (backs the Bookmark feature).
 */
export class ReadLaterProtectedError extends Error {
  constructor(message = '나중에 볼 기사 플레이리스트는 수정/삭제할 수 없습니다.') {
    super(message);
    this.name = 'ReadLaterProtectedError';
  }
}

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

// All SELECT queries that hydrate a full PlaylistRow must project these columns.
const PLAYLIST_ROW_COLUMNS =
  'id, user_id, title, description, visibility, status, playlist_type, tags, is_auto_created, playlist_category, created_at, updated_at';

async function getPlaylistRow(db: D1Database, playlistId: string): Promise<PlaylistRow | null> {
  return db
    .prepare(
      `SELECT ${PLAYLIST_ROW_COLUMNS}
       FROM user_playlists
       WHERE id = ?`,
    )
    .bind(playlistId)
    .first<PlaylistRow>();
}

export async function listPendingPlaylists(db: D1Database): Promise<PendingPlaylistRow[]> {
  const result = await db
    .prepare(
      `SELECT p.id, p.user_id, p.title, p.description, p.visibility, p.status, p.playlist_type, p.tags,
              p.is_auto_created, p.playlist_category, p.created_at, p.updated_at,
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
      `INSERT INTO user_playlists
         (id, user_id, title, description, visibility, status, playlist_type, tags, is_auto_created, playlist_category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    )
    .bind(id, userId, input.title, input.description ?? null, visibility, status, playlistType, tags)
    .run();

  const playlist = await getPlaylistRow(db, id);

  if (!playlist) {
    throw new Error('Failed to create playlist');
  }

  return playlist;
}

/**
 * Shared helper: find-or-create an auto-playlist with a specific category.
 * Safe under concurrency thanks to the partial unique index
 * `uq_user_playlist_category (user_id, playlist_category) WHERE playlist_category IS NOT NULL`.
 */
async function getOrCreateCategoryPlaylist(
  db: D1Database,
  userId: string,
  category: PlaylistCategory,
  title: string,
): Promise<PlaylistRow> {
  const existing = await db
    .prepare(
      `SELECT ${PLAYLIST_ROW_COLUMNS}
       FROM user_playlists
       WHERE user_id = ? AND playlist_category = ?
       LIMIT 1`,
    )
    .bind(userId, category)
    .first<PlaylistRow>();

  if (existing) return existing;

  const id = generateId();
  try {
    await db
      .prepare(
        `INSERT INTO user_playlists
           (id, user_id, title, visibility, status, playlist_type, is_auto_created, playlist_category)
         VALUES (?, ?, ?, 'unlisted', 'draft', 'community', 1, ?)`,
      )
      .bind(id, userId, title, category)
      .run();
  } catch (err) {
    // Concurrent insert raced us and won the unique index.
    // Re-fetch the winning row.
    const winner = await db
      .prepare(
        `SELECT ${PLAYLIST_ROW_COLUMNS}
         FROM user_playlists
         WHERE user_id = ? AND playlist_category = ?
         LIMIT 1`,
      )
      .bind(userId, category)
      .first<PlaylistRow>();
    if (winner) return winner;
    throw err;
  }

  const playlist = await getPlaylistRow(db, id);
  if (!playlist) {
    throw new Error(`Failed to create ${category} auto-playlist`);
  }
  return playlist;
}

/**
 * Get or create the 'submissions' auto-playlist for a user.
 * Used by the submission-approved webhook to sync approved articles.
 *
 * FIXED: previously returned any arbitrary most-recent playlist,
 * now correctly filters by `playlist_category='submissions'`.
 */
export async function getOrCreateAutoPlaylist(db: D1Database, userId: string): Promise<PlaylistRow> {
  return getOrCreateCategoryPlaylist(db, userId, 'submissions', '내 제출 기사');
}

/**
 * Get or create the 'read_later' auto-playlist that backs the Bookmark feature.
 * Lazily created on first bookmark click.
 */
export async function getOrCreateReadLaterPlaylist(db: D1Database, userId: string): Promise<PlaylistRow> {
  return getOrCreateCategoryPlaylist(db, userId, 'read_later', '나중에 볼 기사');
}

export function isReadLaterPlaylist(playlist: Pick<PlaylistRow, 'playlist_category'>): boolean {
  return playlist.playlist_category === 'read_later';
}

export async function getPlaylist(db: D1Database, playlistId: string): Promise<PlaylistDetail | null> {
  const playlist = await db
    .prepare(
      `SELECT p.id, p.title, p.description, p.visibility, p.status, p.playlist_type, p.tags,
              p.is_auto_created, p.playlist_category, p.created_at, p.updated_at,
              u.id AS user_id, u.username, u.display_name, u.avatar_url
       FROM user_playlists p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
    )
    .bind(playlistId)
    .first<
      Pick<
        PlaylistRow,
        | 'id'
        | 'title'
        | 'description'
        | 'visibility'
        | 'status'
        | 'playlist_type'
        | 'tags'
        | 'is_auto_created'
        | 'playlist_category'
        | 'created_at'
        | 'updated_at'
      > & {
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
       ORDER BY position DESC`,
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
    playlist_category: playlist.playlist_category,
    is_auto_created: playlist.is_auto_created,
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
              p.is_auto_created, p.playlist_category, p.created_at, p.updated_at,
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
      is_auto_created: playlist.is_auto_created,
      playlist_category: playlist.playlist_category,
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
  excludeCategory?: PlaylistCategory,
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

  const excludeClause = excludeCategory
    ? ' AND (p.playlist_category IS NULL OR p.playlist_category != ?)'
    : '';

  // Pin 'read_later' playlists to the top of the list so the Bookmark
  // playlist always appears first in /my/playlists.
  const result = await db
    .prepare(
      `SELECT p.id, p.user_id, p.title, p.description, p.visibility, p.status, p.playlist_type, p.tags,
              p.is_auto_created, p.playlist_category, p.created_at, p.updated_at,
              (
                SELECT COUNT(*)
                FROM playlist_items pi
                WHERE pi.playlist_id = p.id
              ) AS item_count${containsItemSelect}
       FROM user_playlists p
       WHERE p.user_id = ?${excludeClause}
       ORDER BY (p.playlist_category = 'read_later') DESC, p.updated_at DESC`,
    )
    .bind(
      ...(containment ? [containment.item_type, containment.source_id] : []),
      userId,
      ...(excludeCategory ? [excludeCategory] : []),
    )
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

  // Read Later playlists have a system-managed title and are not user-editable.
  const row = await db
    .prepare('SELECT playlist_category FROM user_playlists WHERE id = ?')
    .bind(playlistId)
    .first<Pick<PlaylistRow, 'playlist_category'>>();
  if (row?.playlist_category === 'read_later') {
    throw new ReadLaterProtectedError();
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

  // Guard: protected auto-playlists (read_later) cannot be deleted.
  const row = await db
    .prepare('SELECT playlist_category FROM user_playlists WHERE id = ?')
    .bind(playlistId)
    .first<Pick<PlaylistRow, 'playlist_category'>>();
  if (row?.playlist_category === 'read_later') {
    throw new ReadLaterProtectedError();
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

  // Check playlist type and category: read_later is locked, editor auto-approves.
  const row = await db
    .prepare('SELECT playlist_type, playlist_category FROM user_playlists WHERE id = ?')
    .bind(playlistId)
    .first<Pick<PlaylistRow, 'playlist_type' | 'playlist_category'>>();

  if (row?.playlist_category === 'read_later') {
    throw new ReadLaterProtectedError();
  }

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
