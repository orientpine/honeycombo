import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockContext } from '../helpers/context-mock';
import type { PlaylistItemRow, PlaylistRow, UserRow } from '../../functions/lib/types';

const { addItemMock, getOrCreateReadLaterPlaylistMock, DuplicateItemErrorMock } = vi.hoisted(() => {
  class DuplicateItemError extends Error {
    constructor() {
      super('Duplicate item');
      this.name = 'DuplicateItemError';
    }
  }

  return {
    addItemMock: vi.fn(),
    getOrCreateReadLaterPlaylistMock: vi.fn(),
    DuplicateItemErrorMock: DuplicateItemError,
  };
});

vi.mock('../../functions/lib/playlist-items', () => ({
  addItem: addItemMock,
  DuplicateItemError: DuplicateItemErrorMock,
}));

vi.mock('../../functions/lib/playlists', () => ({
  getOrCreateReadLaterPlaylist: getOrCreateReadLaterPlaylistMock,
}));

import { onRequestPost } from '../../functions/api/bookmarks/migrate';

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

function createPlaylistItem(sourceId: string): PlaylistItemRow {
  return {
    id: `item_${sourceId}`,
    playlist_id: 'pl_read_later',
    item_type: 'curated',
    source_id: sourceId,
    external_url: null,
    title_snapshot: `Title ${sourceId}`,
    url_snapshot: `https://example.com/${sourceId}`,
    description_snapshot: null,
    note: null,
    position: 0,
    added_at: '2026-04-23T00:00:00.000Z',
  };
}

describe('POST /api/bookmarks/migrate', () => {
  beforeEach(() => {
    addItemMock.mockReset();
    getOrCreateReadLaterPlaylistMock.mockReset();
    getOrCreateReadLaterPlaylistMock.mockResolvedValue(createReadLaterPlaylist());
    addItemMock.mockResolvedValue(createPlaylistItem('article-1'));
  });

  it('returns 401 when unauthenticated', async () => {
    const context = createMockContext({
      method: 'POST',
      url: 'https://example.com/api/bookmarks/migrate',
      body: JSON.stringify({ items: [] }),
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 for an empty items array', async () => {
    const context = createMockContext({
      method: 'POST',
      url: 'https://example.com/api/bookmarks/migrate',
      user,
      body: JSON.stringify({ items: [] }),
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid input' });
    expect(getOrCreateReadLaterPlaylistMock).not.toHaveBeenCalled();
  });

  it('returns 400 when more than 200 items are submitted', async () => {
    const items = Array.from({ length: 201 }, (_, index) => ({
      source_id: `article-${index}`,
      item_type: 'curated',
      title_snapshot: `Article ${index}`,
      url_snapshot: `https://example.com/article-${index}`,
    }));

    const context = createMockContext({
      method: 'POST',
      url: 'https://example.com/api/bookmarks/migrate',
      user,
      body: JSON.stringify({ items }),
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid input' });
  });

  it('imports unique items and skips duplicates', async () => {
    addItemMock
      .mockResolvedValueOnce(createPlaylistItem('article-1'))
      .mockRejectedValueOnce(new DuplicateItemErrorMock());

    const context = createMockContext({
      method: 'POST',
      url: 'https://example.com/api/bookmarks/migrate',
      user,
      body: JSON.stringify({
        items: [
          {
            source_id: 'article-1',
            item_type: 'curated',
            title_snapshot: 'Article 1',
            url_snapshot: 'https://example.com/article-1',
          },
          {
            source_id: 'article-2',
            item_type: 'feed',
            title_snapshot: 'Article 2',
            url_snapshot: 'https://example.com/article-2',
          },
        ],
      }),
    });

    const response = await onRequestPost(context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      imported: 1,
      skipped: 1,
      playlist_id: 'pl_read_later',
    });
    expect(addItemMock).toHaveBeenCalledTimes(2);
  });
});
