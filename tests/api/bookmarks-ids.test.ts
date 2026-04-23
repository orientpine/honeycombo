import { describe, expect, it } from 'vitest';
import { createMockContext } from '../helpers/context-mock';
import { createMockD1 } from '../helpers/d1-mock';
import type { UserRow } from '../../functions/lib/types';
import { onRequestGet } from '../../functions/api/bookmarks/ids';

const user = {
  id: 'user_1',
  username: 'alice',
  display_name: 'Alice',
  avatar_url: 'https://example.com/alice.png',
  created_at: '2026-04-23T00:00:00.000Z',
} satisfies UserRow;

describe('GET /api/bookmarks/ids', () => {
  it('returns 401 when unauthenticated', async () => {
    const context = createMockContext({
      method: 'GET',
      url: 'https://example.com/api/bookmarks/ids',
    });

    const response = await onRequestGet(context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns empty bookmark ids when read later playlist does not exist', async () => {
    const controller = createMockD1();
    controller.setResults([null]);

    const context = createMockContext({
      method: 'GET',
      url: 'https://example.com/api/bookmarks/ids',
      user,
      env: { DB: controller.db },
    });

    const response = await onRequestGet(context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ bookmarked_ids: [], playlist_id: null });

    const queries = controller.getQueries();
    expect(queries[0]?.sql).toContain('SELECT id FROM user_playlists');
    expect(queries[0]?.params).toEqual([user.id, 'read_later']);
  });

  it('returns source ids from the existing read later playlist', async () => {
    const controller = createMockD1();
    controller.setResults([{ id: 'pl_read_later' }, [{ source_id: 'article-1' }, { source_id: 'article-2' }]]);

    const context = createMockContext({
      method: 'GET',
      url: 'https://example.com/api/bookmarks/ids',
      user,
      env: { DB: controller.db },
    });

    const response = await onRequestGet(context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      bookmarked_ids: ['article-1', 'article-2'],
      playlist_id: 'pl_read_later',
    });

    const queries = controller.getQueries();
    expect(queries[1]?.sql).toContain('SELECT source_id FROM playlist_items');
    expect(queries[1]?.params).toEqual(['pl_read_later']);
  });
});
