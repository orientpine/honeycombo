import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockContext } from '../helpers/context-mock';
import { createMockD1 } from '../helpers/d1-mock';
import type { PlaylistItemRow, PlaylistRow, UserRow } from '../../functions/lib/types';

const { addItemMock, getOrCreateReadLaterPlaylistMock, removeItemMock, DuplicateItemErrorMock } = vi.hoisted(() => {
  class DuplicateItemError extends Error {
    constructor() {
      super('Duplicate item');
      this.name = 'DuplicateItemError';
    }
  }

  return {
    addItemMock: vi.fn(),
    getOrCreateReadLaterPlaylistMock: vi.fn(),
    removeItemMock: vi.fn(),
    DuplicateItemErrorMock: DuplicateItemError,
  };
});

vi.mock('../../functions/lib/playlist-items', () => ({
  addItem: addItemMock,
  removeItem: removeItemMock,
  DuplicateItemError: DuplicateItemErrorMock,
}));

vi.mock('../../functions/lib/playlists', () => ({
  getOrCreateReadLaterPlaylist: getOrCreateReadLaterPlaylistMock,
}));

import { onRequestPost } from '../../functions/api/bookmarks/toggle';

const user = {
  id: 'user_1',
  username: 'alice',
  display_name: 'Alice',
  avatar_url: 'https://example.com/alice.png',
  created_at: '2026-04-23T00:00:00.000Z',
} satisfies UserRow;

function createReadLaterPlaylist(): PlaylistRow {
  return {
    id: 'pl_read_later',
    user_id: user.id,
    title: '나중에 볼 기사',
    description: null,
    visibility: 'unlisted',
    status: 'draft',
    playlist_type: 'community',
    tags: null,
    is_auto_created: 1,
    playlist_category: 'read_later',
    created_at: '2026-04-23T00:00:00.000Z',
    updated_at: '2026-04-23T00:00:00.000Z',
  };
}

function createPlaylistItem(): PlaylistItemRow {
  return {
    id: 'item_1',
    playlist_id: 'pl_read_later',
    item_type: 'curated',
    source_id: 'article-1',
    external_url: null,
    title_snapshot: 'Article 1',
    url_snapshot: 'https://example.com/article-1',
    description_snapshot: null,
    note: null,
    position: 0,
    added_at: '2026-04-23T00:00:00.000Z',
  };
}

describe('POST /api/bookmarks/toggle', () => {
  beforeEach(() => {
    addItemMock.mockReset();
    getOrCreateReadLaterPlaylistMock.mockReset();
    removeItemMock.mockReset();
    getOrCreateReadLaterPlaylistMock.mockResolvedValue(createReadLaterPlaylist());
    addItemMock.mockResolvedValue(createPlaylistItem());
    removeItemMock.mockResolvedValue(true);
  });

  it('returns 401 when unauthenticated', async () => {
    const context = createMockContext({
      method: 'POST',
      url: 'https://example.com/api/bookmarks/toggle',
      body: JSON.stringify({}),
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(getOrCreateReadLaterPlaylistMock).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid input', async () => {
    const context = createMockContext({
      method: 'POST',
      url: 'https://example.com/api/bookmarks/toggle',
      user,
      body: JSON.stringify({
        source_id: 'article-1',
        item_type: 'external',
        title_snapshot: 'Article 1',
        url_snapshot: 'https://example.com/article-1',
      }),
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid input' });
    expect(getOrCreateReadLaterPlaylistMock).not.toHaveBeenCalled();
  });

  it('adds a bookmark when item is not yet saved', async () => {
    const controller = createMockD1();
    controller.setResults([null]);

    const context = createMockContext({
      method: 'POST',
      url: 'https://example.com/api/bookmarks/toggle',
      user,
      env: { DB: controller.db },
      body: JSON.stringify({
        source_id: 'article-1',
        item_type: 'curated',
        title_snapshot: 'Article 1',
        url_snapshot: 'https://example.com/article-1',
      }),
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ bookmarked: true, playlist_id: 'pl_read_later' });
    expect(getOrCreateReadLaterPlaylistMock).toHaveBeenCalledWith(context.env.DB, user.id);
    expect(addItemMock).toHaveBeenCalledWith(context.env.DB, 'pl_read_later', user.id, {
      source_id: 'article-1',
      item_type: 'curated',
      title_snapshot: 'Article 1',
      url_snapshot: 'https://example.com/article-1',
    });
    expect(removeItemMock).not.toHaveBeenCalled();

    const queries = controller.getQueries();
    expect(queries[0]?.sql).toContain('SELECT id FROM playlist_items');
    expect(queries[0]?.params).toEqual(['pl_read_later', 'curated', 'article-1']);
  });

  it('removes a bookmark when item already exists', async () => {
    const controller = createMockD1();
    controller.setResults([{ id: 'item_existing' }]);

    const context = createMockContext({
      method: 'POST',
      url: 'https://example.com/api/bookmarks/toggle',
      user,
      env: { DB: controller.db },
      body: JSON.stringify({
        source_id: 'article-1',
        item_type: 'curated',
        title_snapshot: 'Article 1',
        url_snapshot: 'https://example.com/article-1',
      }),
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ bookmarked: false, playlist_id: 'pl_read_later' });
    expect(removeItemMock).toHaveBeenCalledWith(context.env.DB, 'item_existing', 'pl_read_later', user.id);
    expect(addItemMock).not.toHaveBeenCalled();
  });

  it('treats DuplicateItemError as a successful bookmark add', async () => {
    const controller = createMockD1();
    controller.setResults([null]);
    addItemMock.mockRejectedValueOnce(new DuplicateItemErrorMock());

    const context = createMockContext({
      method: 'POST',
      url: 'https://example.com/api/bookmarks/toggle',
      user,
      env: { DB: controller.db },
      body: JSON.stringify({
        source_id: 'article-1',
        item_type: 'curated',
        title_snapshot: 'Article 1',
        url_snapshot: 'https://example.com/article-1',
      }),
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ bookmarked: true, playlist_id: 'pl_read_later' });
  });
});
