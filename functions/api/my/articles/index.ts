import type { AppPagesFunction } from '../../../lib/types';

type ArticleStatus = 'unassigned' | 'assigned' | 'all';

interface UnassignedArticleRow {
  article_id: string;
  title: string;
  url: string;
  submitted_by_id: string;
  created_at: string;
}

interface AssignedArticleRow extends UnassignedArticleRow {
  playlists_json: string | null;
}

interface CountRow {
  total: number;
}

interface PlaylistSummary {
  id: string;
  title: string;
}

interface ArticleResponse {
  article_id: string;
  title: string;
  url: string;
  submitted_at: string;
  playlists: PlaylistSummary[];
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function parseStatus(value: string | null): ArticleStatus {
  if (value === 'unassigned' || value === 'assigned' || value === 'all') {
    return value;
  }

  return 'all';
}

function parsePlaylists(playlistsJson: string | null): PlaylistSummary[] {
  if (!playlistsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(playlistsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.reduce<PlaylistSummary[]>((acc, entry) => {
      if (entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.title === 'string' && entry.id && entry.title) {
        acc.push({ id: entry.id, title: entry.title });
      }
      return acc;
    }, []);
  } catch {
    return [];
  }
}

function mapUnassignedArticle(row: UnassignedArticleRow): ArticleResponse {
  return {
    article_id: row.article_id,
    title: row.title,
    url: row.url,
    submitted_at: row.created_at,
    playlists: [],
  };
}

function mapAssignedArticle(row: AssignedArticleRow): ArticleResponse {
  return {
    article_id: row.article_id,
    title: row.title,
    url: row.url,
    submitted_at: row.created_at,
    playlists: parsePlaylists(row.playlists_json),
  };
}

async function getUnassignedCount(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT s.article_id
         FROM submissions s
         WHERE s.submitted_by_id = ?
           AND NOT EXISTS (
             SELECT 1 FROM playlist_items pi
             INNER JOIN user_playlists up ON pi.playlist_id = up.id
             WHERE pi.source_id = s.article_id
               AND pi.item_type IN ('curated', 'feed')
               AND up.user_id = ?
           )
       ) AS unassigned_articles`,
    )
    .bind(userId, userId)
    .first<CountRow>();

  return row?.total ?? 0;
}

async function getAssignedCount(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM (
         SELECT s.article_id
         FROM submissions s
         INNER JOIN playlist_items pi ON pi.source_id = s.article_id
           AND pi.item_type IN ('curated', 'feed')
         INNER JOIN user_playlists up ON pi.playlist_id = up.id AND up.user_id = ?
         WHERE s.submitted_by_id = ?
         GROUP BY s.article_id
       ) AS assigned_articles`,
    )
    .bind(userId, userId)
    .first<CountRow>();

  return row?.total ?? 0;
}

async function listUnassignedArticles(
  db: D1Database,
  userId: string,
  limit: number,
  offset: number,
): Promise<UnassignedArticleRow[]> {
  const result = await db
    .prepare(
      `SELECT s.article_id, s.title, s.url, s.submitted_by_id, s.created_at
       FROM submissions s
       WHERE s.submitted_by_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM playlist_items pi
           INNER JOIN user_playlists up ON pi.playlist_id = up.id
           WHERE pi.source_id = s.article_id
             AND pi.item_type IN ('curated', 'feed')
             AND up.user_id = ?
         )
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(userId, userId, limit, offset)
    .all<UnassignedArticleRow>();

  return result.results;
}

async function listAssignedArticles(
  db: D1Database,
  userId: string,
  limit: number,
  offset: number,
): Promise<AssignedArticleRow[]> {
  const result = await db
    .prepare(
      `SELECT s.article_id, s.title, s.url, s.submitted_by_id, s.created_at,
              json_group_array(json_object('id', up.id, 'title', up.title)) AS playlists_json
       FROM submissions s
       INNER JOIN playlist_items pi ON pi.source_id = s.article_id
         AND pi.item_type IN ('curated', 'feed')
       INNER JOIN user_playlists up ON pi.playlist_id = up.id AND up.user_id = ?
       WHERE s.submitted_by_id = ?
       GROUP BY s.article_id
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(userId, userId, limit, offset)
    .all<AssignedArticleRow>();

  return result.results;
}

export const onRequest: AppPagesFunction[] = [
  async (context) => {
    const { request, env, data } = context;

    if (request.method === 'GET') {
      if (!data.user) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const userId = data.user.id;
      const url = new URL(request.url);
      const status = parseStatus(url.searchParams.get('status'));
      const page = parsePositiveInt(url.searchParams.get('page'), 1);
      const limit = Math.min(parsePositiveInt(url.searchParams.get('limit'), 20), 100);
      const offset = (page - 1) * limit;

      if (status === 'unassigned') {
        const [total, rows] = await Promise.all([
          getUnassignedCount(env.DB, userId),
          listUnassignedArticles(env.DB, userId, limit, offset),
        ]);

        return json({
          articles: rows.map(mapUnassignedArticle),
          pagination: { page, limit, total },
        });
      }

      if (status === 'assigned') {
        const [total, rows] = await Promise.all([
          getAssignedCount(env.DB, userId),
          listAssignedArticles(env.DB, userId, limit, offset),
        ]);

        return json({
          articles: rows.map(mapAssignedArticle),
          pagination: { page, limit, total },
        });
      }

      const [unassignedTotal, assignedTotal] = await Promise.all([
        getUnassignedCount(env.DB, userId),
        getAssignedCount(env.DB, userId),
      ]);

      const total = unassignedTotal + assignedTotal;

      if (offset >= unassignedTotal) {
        const assignedRows = await listAssignedArticles(env.DB, userId, limit, offset - unassignedTotal);

        return json({
          articles: assignedRows.map(mapAssignedArticle),
          pagination: { page, limit, total },
        });
      }

      const unassignedRows = await listUnassignedArticles(env.DB, userId, limit, offset);
      const remaining = limit - unassignedRows.length;
      const assignedRows = remaining > 0 ? await listAssignedArticles(env.DB, userId, remaining, 0) : [];

      return json({
        articles: [...unassignedRows.map(mapUnassignedArticle), ...assignedRows.map(mapAssignedArticle)],
        pagination: { page, limit, total },
      });
    }

    return json({ error: 'Method not allowed' }, 405);
  },
];
