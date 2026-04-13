import { afterEach, describe, expect, it, vi } from 'vitest';
import * as idLib from '../../functions/lib/id';
import { addItem, removeItem, swapItemPositions, updateItem } from '../../functions/lib/playlist-items';
import type { PlaylistItemRow } from '../../functions/lib/types';
import { createMockD1 } from '../helpers/d1-mock';

const playlistId = 'playlist-1';
const userId = 'user-1';
const itemId = 'item-1';

afterEach(() => {
  vi.restoreAllMocks();
});

function makeItem(overrides: Partial<PlaylistItemRow> = {}): PlaylistItemRow {
  return {
    id: itemId,
    playlist_id: playlistId,
    item_type: 'external',
    source_id: null,
    external_url: 'https://example.com/story',
    title_snapshot: 'Example story',
    url_snapshot: 'https://example.com/story',
    description_snapshot: 'A good read',
    note: 'save for later',
    position: 0,
    added_at: '2026-04-12 00:00:00',
    ...overrides,
  };
}

describe('playlist-items repository', () => {
  it('addItem creates with correct position', async () => {
    const { db, getQueries, setResults } = createMockD1();
    const createdItem = makeItem({ id: 'generated-id', position: 5 });

    vi.spyOn(idLib, 'generateId').mockReturnValue('generated-id');
    setResults([{ user_id: userId }, { max_position: 4 }, [{}], [{}], createdItem]);

    const result = await addItem(db, playlistId, userId, {
      item_type: 'external',
      external_url: 'https://example.com/story',
      title_snapshot: 'Example story',
      url_snapshot: 'https://example.com/story',
      description_snapshot: 'A good read',
      note: 'save for later',
    });

    expect(result).toEqual(createdItem);
    expect(getQueries()[2]?.params).toEqual([
      'generated-id',
      playlistId,
      'external',
      null,
      'https://example.com/story',
      'Example story',
      'https://example.com/story',
      'A good read',
      'save for later',
      5,
    ]);
  });

  it('addItem rejects non-owner', async () => {
    const { db, getQueries, setResults } = createMockD1();

    setResults([null]);

    const result = await addItem(db, playlistId, userId, {
      item_type: 'external',
      external_url: 'https://example.com/story',
      title_snapshot: 'Example story',
      url_snapshot: 'https://example.com/story',
    });

    expect(result).toBeNull();
    expect(getQueries()).toHaveLength(1);
  });

  it('addItem validates external URLs', async () => {
    const invalid = createMockD1();
    invalid.setResults([{ user_id: userId }]);

    const invalidResult = await addItem(invalid.db, playlistId, userId, {
      item_type: 'external',
      external_url: 'not-a-url',
      title_snapshot: 'Bad url',
      url_snapshot: 'not-a-url',
    });

    expect(invalidResult).toBeNull();
    expect(invalid.getQueries()).toHaveLength(1);

    const blocked = createMockD1();
    blocked.setResults([{ user_id: userId }]);

    const blockedResult = await addItem(blocked.db, playlistId, userId, {
      item_type: 'external',
      external_url: 'https://clickbaitfarm.com/post',
      title_snapshot: 'Blocked',
      url_snapshot: 'https://clickbaitfarm.com/post',
    });

    expect(blockedResult).toBeNull();
    expect(blocked.getQueries()).toHaveLength(1);
  });

  it('updateItem updates note/position', async () => {
    const { db, getQueries, setResults } = createMockD1();
    const existingItem = makeItem();
    const updatedItem = makeItem({ note: 'updated note', position: 3 });

    setResults([{ user_id: userId }, existingItem, [{}], [{}], updatedItem]);

    const result = await updateItem(db, itemId, playlistId, userId, {
      note: 'updated note',
      position: 3,
    });

    expect(result).toEqual(updatedItem);
    expect(getQueries()[2]?.params).toEqual(['updated note', 3, itemId, playlistId]);
  });

  it('removeItem deletes and returns true', async () => {
    const { db, getQueries, setResults } = createMockD1();

    setResults([{ user_id: userId }, [{}], [{}]]);

    const result = await removeItem(db, itemId, playlistId, userId);

    expect(result).toBe(true);
    expect(getQueries()[1]?.params).toEqual([itemId, playlistId]);
  });

  it('removeItem returns false for non-owner', async () => {
    const { db, getQueries, setResults } = createMockD1();

    setResults([null]);

    const result = await removeItem(db, itemId, playlistId, userId);

    expect(result).toBe(false);
    expect(getQueries()).toHaveLength(1);
  });

  it('swapItemPositions swaps positions atomically', async () => {
    const { db, getQueries, setResults } = createMockD1();

    setResults([{ user_id: userId }, [{}], [{}]]);

    const result = await swapItemPositions(db, playlistId, userId, 'item-a', 'item-b');

    expect(result).toBe(true);
    expect(getQueries()).toHaveLength(3);
    expect(getQueries()[1]?.sql).toContain('WITH swap AS MATERIALIZED');
    expect(getQueries()[1]?.params).toEqual(['item-b', playlistId, 'item-a', playlistId]);
    expect(getQueries()[2]?.sql).toContain('UPDATE user_playlists SET updated_at = CURRENT_TIMESTAMP');
  });
});
