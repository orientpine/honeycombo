import { describe, expect, it } from 'vitest';
import { createMockContext } from '../helpers/context-mock';
import { createMockD1 } from '../helpers/d1-mock';
import type { UserRow } from '../../functions/lib/types';
import { onRequest as myArticlesHandlers } from '../../functions/api/my/articles/index';
import { onRequest as addArticleToPlaylistHandlers } from '../../functions/api/my/articles/[articleId]/playlists/index';
import { onRequest as removeArticleFromPlaylistHandlers } from '../../functions/api/my/articles/[articleId]/playlists/[playlistId]';

const listMyArticles = myArticlesHandlers[0]!;
const addArticleToPlaylist = addArticleToPlaylistHandlers[0]!;
const removeArticleFromPlaylist = removeArticleFromPlaylistHandlers[0]!;

function makeUser(id: string): UserRow {
  return {
    id,
    username: `${id}_name`,
    display_name: id.toUpperCase(),
    avatar_url: `https://example.com/${id}.png`,
    created_at: '2026-04-22T00:00:00.000Z',
  };
}

function makeSubmissionRow(articleId: string, userId: string, overrides: Record<string, unknown> = {}) {
  return {
    article_id: articleId,
    title: `Title for ${articleId}`,
    url: `https://example.com/${articleId}`,
    submitted_by_id: userId,
    created_at: '2026-04-22T00:00:00.000Z',
    ...overrides,
  };
}

function makeAssignedArticleRow(
  articleId: string,
  userId: string,
  playlists: Array<{ id: string; title: string }> = [{ id: 'playlist_1', title: 'Favorites' }],
  overrides: Record<string, unknown> = {},
) {
  return {
    ...makeSubmissionRow(articleId, userId),
    playlists_json: JSON.stringify(playlists),
    ...overrides,
  };
}

function makePlaylistItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item_1',
    playlist_id: 'playlist_1',
    item_type: 'curated',
    source_id: 'article_1',
    external_url: null,
    title_snapshot: 'Title for article_1',
    url_snapshot: 'https://example.com/article_1',
    description_snapshot: null,
    note: null,
    position: 1,
    added_at: '2026-04-22T00:00:00.000Z',
    ...overrides,
  };
}

function createApiContext(options: {
  db: D1Database;
  user?: UserRow | null;
  method?: string;
  url: string;
  params?: Record<string, string>;
  body?: unknown;
}) {
  return createMockContext({
    env: { DB: options.db },
    user: options.user === undefined ? makeUser('user_1') : options.user,
    method: options.method ?? 'GET',
    url: options.url,
    params: options.params ?? {},
    body: options.body === undefined ? null : JSON.stringify(options.body),
  });
}

function createDuplicateInsertDatabase(controller: ReturnType<typeof createMockD1>): D1Database {
  const originalPrepare = controller.db.prepare.bind(controller.db);
  const createStatement = (sql: string): D1PreparedStatement =>
    ({
      bind(..._boundParams: unknown[]) {
        return createStatement(sql);
      },
      async first<T = Record<string, unknown>>(_columnName?: keyof T & string) {
        throw new Error(`Unexpected first() for ${sql}`);
      },
      async all<T = Record<string, unknown>>() {
        throw new Error(`Unexpected all() for ${sql}`);
      },
      async run<T = Record<string, unknown>>() {
        throw new Error('UNIQUE constraint failed: playlist_items.playlist_id, playlist_items.item_type, playlist_items.source_id');
      },
    }) as D1PreparedStatement;

  return {
    ...controller.db,
    prepare(sql: string) {
      if (sql.includes('INSERT INTO playlist_items')) {
        return createStatement(sql);
      }

      return originalPrepare(sql);
    },
  } as D1Database;
}

describe('GET /api/my/articles', () => {
  it('returns 401 when user is not authenticated', async () => {
    const controller = createMockD1();
    const context = createApiContext({
      db: controller.db,
      user: null,
      url: 'https://example.com/api/my/articles',
    });

    const response = await listMyArticles(context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(controller.getQueries()).toHaveLength(0);
  });

  it('returns an empty state for a user with zero submissions', async () => {
    const controller = createMockD1();
    controller.setResults([{ total: 0 }, { total: 0 }, []]);

    const response = await listMyArticles(
      createApiContext({
        db: controller.db,
        url: 'https://example.com/api/my/articles',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      articles: [],
      pagination: { page: 1, limit: 20, total: 0 },
    });
  });

  it('returns unassigned articles with empty playlists arrays', async () => {
    const controller = createMockD1();
    controller.setResults([
      { total: 2 },
      [makeSubmissionRow('article_1', 'user_1'), makeSubmissionRow('article_2', 'user_1')],
    ]);

    const response = await listMyArticles(
      createApiContext({
        db: controller.db,
        url: 'https://example.com/api/my/articles?status=unassigned',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      articles: [
        {
          article_id: 'article_1',
          title: 'Title for article_1',
          url: 'https://example.com/article_1',
          submitted_at: '2026-04-22T00:00:00.000Z',
          playlists: [],
        },
        {
          article_id: 'article_2',
          title: 'Title for article_2',
          url: 'https://example.com/article_2',
          submitted_at: '2026-04-22T00:00:00.000Z',
          playlists: [],
        },
      ],
      pagination: { page: 1, limit: 20, total: 2 },
    });

    expect(controller.getQueries()[1]?.params).toEqual(['user_1', 'user_1', 20, 0]);
  });

  it('returns assigned articles with populated playlists arrays', async () => {
    const controller = createMockD1();
    controller.setResults([
      { total: 1 },
      [
        makeAssignedArticleRow(
          'article_1',
          'user_1',
          [
            { id: 'playlist_1', title: 'Favorites' },
            { id: 'playlist_2', title: 'Reading List' },
          ],
        ),
      ],
    ]);

    const response = await listMyArticles(
      createApiContext({
        db: controller.db,
        url: 'https://example.com/api/my/articles?status=assigned',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      articles: [
        {
          article_id: 'article_1',
          title: 'Title for article_1',
          url: 'https://example.com/article_1',
          submitted_at: '2026-04-22T00:00:00.000Z',
          playlists: [
            { id: 'playlist_1', title: 'Favorites' },
            { id: 'playlist_2', title: 'Reading List' },
          ],
        },
      ],
      pagination: { page: 1, limit: 20, total: 1 },
    });
  });

  it('returns mixed assigned and unassigned articles for status=all', async () => {
    const controller = createMockD1();
    controller.setResults([
      { total: 1 },
      { total: 1 },
      [makeSubmissionRow('article_1', 'user_1')],
      [makeAssignedArticleRow('article_2', 'user_1', [{ id: 'playlist_9', title: 'Deep Dives' }])],
    ]);

    const response = await listMyArticles(
      createApiContext({
        db: controller.db,
        url: 'https://example.com/api/my/articles?status=all',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      articles: [
        {
          article_id: 'article_1',
          title: 'Title for article_1',
          url: 'https://example.com/article_1',
          submitted_at: '2026-04-22T00:00:00.000Z',
          playlists: [],
        },
        {
          article_id: 'article_2',
          title: 'Title for article_2',
          url: 'https://example.com/article_2',
          submitted_at: '2026-04-22T00:00:00.000Z',
          playlists: [{ id: 'playlist_9', title: 'Deep Dives' }],
        },
      ],
      pagination: { page: 1, limit: 20, total: 2 },
    });
  });

  it('applies page and limit params when paginating mixed results', async () => {
    const controller = createMockD1();
    controller.setResults([
      { total: 1 },
      { total: 2 },
      [makeAssignedArticleRow('article_3', 'user_1', [{ id: 'playlist_3', title: 'Page Three' }])],
    ]);

    const response = await listMyArticles(
      createApiContext({
        db: controller.db,
        url: 'https://example.com/api/my/articles?status=all&page=3&limit=1',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      articles: [
        {
          article_id: 'article_3',
          title: 'Title for article_3',
          url: 'https://example.com/article_3',
          submitted_at: '2026-04-22T00:00:00.000Z',
          playlists: [{ id: 'playlist_3', title: 'Page Three' }],
        },
      ],
      pagination: { page: 3, limit: 1, total: 3 },
    });

    expect(controller.getQueries()[2]?.params).toEqual(['user_1', 'user_1', 1, 1]);
  });

  it('isolates results so user A cannot see user B submissions', async () => {
    const controller = createMockD1();
    controller.setResults([{ total: 1 }, [makeSubmissionRow('article_a', 'user_a')]]);

    const response = await listMyArticles(
      createApiContext({
        db: controller.db,
        user: makeUser('user_a'),
        url: 'https://example.com/api/my/articles?status=unassigned',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      articles: [
        {
          article_id: 'article_a',
          title: 'Title for article_a',
          url: 'https://example.com/article_a',
          submitted_at: '2026-04-22T00:00:00.000Z',
          playlists: [],
        },
      ],
      pagination: { page: 1, limit: 20, total: 1 },
    });

    const queries = controller.getQueries();
    expect(queries[0]?.params).toEqual(['user_a', 'user_a']);
    expect(queries[1]?.params).toEqual(['user_a', 'user_a', 20, 0]);
  });
});

describe('POST /api/my/articles/:articleId/playlists', () => {
  it('returns 401 when no authenticated user is present', async () => {
    const controller = createMockD1();
    const response = await addArticleToPlaylist(
      createApiContext({
        db: controller.db,
        user: null,
        method: 'POST',
        url: 'https://example.com/api/my/articles/article_1/playlists',
        params: { articleId: 'article_1' },
        body: { playlist_id: 'playlist_1' },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(controller.getQueries()).toHaveLength(0);
  });

  it('returns 404 when the submission is not owned by the user', async () => {
    const controller = createMockD1();
    controller.setResults([null]);

    const response = await addArticleToPlaylist(
      createApiContext({
        db: controller.db,
        method: 'POST',
        url: 'https://example.com/api/my/articles/article_404/playlists',
        params: { articleId: 'article_404' },
        body: { playlist_id: 'playlist_1' },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Article not found' });
    expect(controller.getQueries()[0]?.params).toEqual(['article_404', 'user_1']);
  });

  it('returns 404 when the playlist is not owned by the user', async () => {
    const controller = createMockD1();
    controller.setResults([makeSubmissionRow('article_1', 'user_1'), null]);

    const response = await addArticleToPlaylist(
      createApiContext({
        db: controller.db,
        method: 'POST',
        url: 'https://example.com/api/my/articles/article_1/playlists',
        params: { articleId: 'article_1' },
        body: { playlist_id: 'playlist_missing' },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Playlist not found' });
    expect(controller.getQueries()[1]?.params).toEqual(['playlist_missing', 'user_1']);
  });

  it('returns 201 when a valid article is added to a user playlist', async () => {
    const controller = createMockD1();
    controller.setResults([
      makeSubmissionRow('article_1', 'user_1'),
      { id: 'playlist_1' },
      { user_id: 'user_1' },
      { max_position: 0 },
      [],
      [],
      makePlaylistItem(),
    ]);

    const response = await addArticleToPlaylist(
      createApiContext({
        db: controller.db,
        method: 'POST',
        url: 'https://example.com/api/my/articles/article_1/playlists',
        params: { articleId: 'article_1' },
        body: { playlist_id: 'playlist_1' },
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      playlist_id: 'playlist_1',
      article_id: 'article_1',
    });

    expect(controller.getQueries()[4]).toMatchObject({
      params: [
        expect.any(String),
        'playlist_1',
        'curated',
        'article_1',
        null,
        'Title for article_1',
        'https://example.com/article_1',
        null,
        null,
        1,
      ],
    });
  });

  it('returns 409 when the article already exists in the playlist', async () => {
    const controller = createMockD1();
    controller.setResults([
      makeSubmissionRow('article_1', 'user_1'),
      { id: 'playlist_1' },
      { user_id: 'user_1' },
      { max_position: 0 },
    ]);

    const response = await addArticleToPlaylist(
      createApiContext({
        db: createDuplicateInsertDatabase(controller),
        method: 'POST',
        url: 'https://example.com/api/my/articles/article_1/playlists',
        params: { articleId: 'article_1' },
        body: { playlist_id: 'playlist_1' },
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'Article already in this playlist' });
  });

  it('prevents user A from adding user B article to user A playlist', async () => {
    const controller = createMockD1();
    controller.setResults([null]);

    const response = await addArticleToPlaylist(
      createApiContext({
        db: controller.db,
        user: makeUser('user_a'),
        method: 'POST',
        url: 'https://example.com/api/my/articles/article_b/playlists',
        params: { articleId: 'article_b' },
        body: { playlist_id: 'playlist_a' },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Article not found' });
    expect(controller.getQueries()).toHaveLength(1);
    expect(controller.getQueries()[0]?.params).toEqual(['article_b', 'user_a']);
  });
});

describe('DELETE /api/my/articles/:articleId/playlists/:playlistId', () => {
  it('returns 401 when no authenticated user is present', async () => {
    const controller = createMockD1();
    const response = await removeArticleFromPlaylist(
      createApiContext({
        db: controller.db,
        user: null,
        method: 'DELETE',
        url: 'https://example.com/api/my/articles/article_1/playlists/playlist_1',
        params: { articleId: 'article_1', playlistId: 'playlist_1' },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(controller.getQueries()).toHaveLength(0);
  });

  it('returns 404 when the submission is not owned by the user', async () => {
    const controller = createMockD1();
    controller.setResults([null]);

    const response = await removeArticleFromPlaylist(
      createApiContext({
        db: controller.db,
        method: 'DELETE',
        url: 'https://example.com/api/my/articles/article_404/playlists/playlist_1',
        params: { articleId: 'article_404', playlistId: 'playlist_1' },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Article not found' });
  });

  it('returns 404 when the playlist is not owned by the user', async () => {
    const controller = createMockD1();
    controller.setResults([{ article_id: 'article_1' }, null]);

    const response = await removeArticleFromPlaylist(
      createApiContext({
        db: controller.db,
        method: 'DELETE',
        url: 'https://example.com/api/my/articles/article_1/playlists/playlist_missing',
        params: { articleId: 'article_1', playlistId: 'playlist_missing' },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Playlist not found' });
  });

  it('returns 404 when the article is not already in the playlist', async () => {
    const controller = createMockD1();
    controller.setResults([{ article_id: 'article_1' }, { id: 'playlist_1' }, null]);

    const response = await removeArticleFromPlaylist(
      createApiContext({
        db: controller.db,
        method: 'DELETE',
        url: 'https://example.com/api/my/articles/article_1/playlists/playlist_1',
        params: { articleId: 'article_1', playlistId: 'playlist_1' },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Article not in this playlist' });
  });

  it('returns 200 when a playlist membership is removed successfully', async () => {
    const controller = createMockD1();
    controller.setResults([{ article_id: 'article_1' }, { id: 'playlist_1' }, { id: 'item_1' }, []]);

    const response = await removeArticleFromPlaylist(
      createApiContext({
        db: controller.db,
        method: 'DELETE',
        url: 'https://example.com/api/my/articles/article_1/playlists/playlist_1',
        params: { articleId: 'article_1', playlistId: 'playlist_1' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(controller.getQueries()[3]).toMatchObject({
      sql: expect.stringContaining('DELETE FROM playlist_items WHERE id = ?'),
      params: ['item_1'],
    });
  });
});
