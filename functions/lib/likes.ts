import type { LikeStatusResponse, TrendingPlaylistItem, TrendingPlaylistsResponse, UserRow } from './types';

type TrendingQueryRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  visibility: 'unlisted' | 'public';
  status: string;
  created_at: string;
  updated_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  item_count: number | string;
  like_count: number | string;
  user_liked: number | string;
};

function normalizePage(page: number): number {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function normalizeLimit(limit: number): number {
  return Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
}

export async function isPublicApprovedPlaylist(db: D1Database, playlistId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM user_playlists
       WHERE id = ? AND visibility = 'public' AND status = 'approved'`,
    )
    .bind(playlistId)
    .first();

  return row !== null;
}

export async function toggleLike(
  db: D1Database,
  userId: string,
  playlistId: string,
): Promise<LikeStatusResponse> {
  const existing = await db
    .prepare('SELECT 1 FROM playlist_likes WHERE user_id = ? AND playlist_id = ?')
    .bind(userId, playlistId)
    .first<{ 1: number }>();

  if (existing) {
    await db
      .prepare('DELETE FROM playlist_likes WHERE user_id = ? AND playlist_id = ?')
      .bind(userId, playlistId)
      .run();
  } else {
    await db
      .prepare('INSERT INTO playlist_likes (user_id, playlist_id) VALUES (?, ?)')
      .bind(userId, playlistId)
      .run();
  }

  const countRow = await db
    .prepare('SELECT COUNT(*) AS cnt FROM playlist_likes WHERE playlist_id = ?')
    .bind(playlistId)
    .first<{ cnt: number | string }>();

  return {
    liked: !existing,
    like_count: Number(countRow?.cnt ?? 0),
  };
}

export async function getLikeStatus(
  db: D1Database,
  playlistId: string,
  userId?: string,
): Promise<LikeStatusResponse> {
  const countRow = await db
    .prepare('SELECT COUNT(*) AS cnt FROM playlist_likes WHERE playlist_id = ?')
    .bind(playlistId)
    .first<{ cnt: number | string }>();

  let liked = false;

  if (userId) {
    const row = await db
      .prepare('SELECT 1 FROM playlist_likes WHERE user_id = ? AND playlist_id = ?')
      .bind(userId, playlistId)
      .first();
    liked = row !== null;
  }

  return {
    liked,
    like_count: Number(countRow?.cnt ?? 0),
  };
}

export async function getTrendingPlaylists(
  db: D1Database,
  page: number,
  limit: number,
  userId?: string,
): Promise<TrendingPlaylistsResponse> {
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

  // user_liked: check if current user liked each playlist (0 if anonymous)
  const userLikedSelect = userId
    ? `, EXISTS(
         SELECT 1 FROM playlist_likes pl2
         WHERE pl2.playlist_id = p.id AND pl2.user_id = ?
       ) AS user_liked`
    : ', 0 AS user_liked';

  const binds: Array<string | number> = [];
  if (userId) binds.push(userId);
  binds.push(pageSize, offset);

  const result = await db
    .prepare(
      `SELECT p.id, p.user_id, p.title, p.description, p.visibility, p.status,
              p.created_at, p.updated_at,
              u.username, u.display_name, u.avatar_url,
              (SELECT COUNT(*) FROM playlist_items pi WHERE pi.playlist_id = p.id) AS item_count,
              (SELECT COUNT(*) FROM playlist_likes pl WHERE pl.playlist_id = p.id) AS like_count
              ${userLikedSelect}
       FROM user_playlists p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.visibility = 'public' AND p.status = 'approved'
       ORDER BY like_count DESC, p.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...binds)
    .all<TrendingQueryRow>();

  const playlists: TrendingPlaylistItem[] = result.results.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    visibility: row.visibility as 'unlisted' | 'public',
    status: row.status as 'draft' | 'pending' | 'approved' | 'rejected',
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: {
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    } as Pick<UserRow, 'username' | 'display_name' | 'avatar_url'>,
    item_count: Number(row.item_count),
    like_count: Number(row.like_count),
    user_liked: Boolean(Number(row.user_liked)),
  }));

  return {
    playlists,
    total,
    page: currentPage,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
