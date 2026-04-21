import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockD1 } from '../helpers/d1-mock';
import {
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPublicPlaylists,
  listUserPlaylists,
  setVisibility,
  updatePlaylist,
} from '../../functions/lib/playlists';

vi.mock('../../functions/lib/id', () => ({
  generateId: () => 'pl_testid123',
}));

const basePlaylist = {
  id: 'pl_1',
  user_id: 'user_1',
  title: 'My playlist',
  description: 'Great links',
  visibility: 'unlisted' as const,
  status: 'draft' as const,
  created_at: '2026-04-12T00:00:00.000Z',
  updated_at: '2026-04-12T00:00:00.000Z',
};

describe('playlists repository', () => {
  let controller: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    controller = createMockD1();
    controller.setResult([]);
  });

  it('createPlaylist returns new playlist with nanoid ID', async () => {
    controller.setResults([[], { ...basePlaylist, id: 'pl_testid123' }]);

    const playlist = await createPlaylist(controller.db, 'user_1', {
      title: 'My playlist',
      description: 'Great links',
    });

    expect(playlist.id).toBe('pl_testid123');
    expect(playlist.visibility).toBe('unlisted');
    expect(playlist.status).toBe('draft');

    const queries = controller.getQueries();
    expect(queries[0]).toMatchObject({
      params: ['pl_testid123', 'user_1', 'My playlist', 'Great links', 'unlisted', 'draft', 'community', null],
    });
    expect(queries[0]?.sql).toContain('INSERT INTO user_playlists');
    expect(queries[1]?.sql).toContain('FROM user_playlists');
    expect(queries[1]?.params).toEqual(['pl_testid123']);
  });

  it('getPlaylist returns playlist with items and user info', async () => {
    controller.setResults([
      {
        id: 'pl_1',
        title: 'My playlist',
        description: 'Great links',
        visibility: 'public',
        status: 'approved',
        playlist_type: 'community',
        tags: null,
        created_at: '2026-04-12T00:00:00.000Z',
        updated_at: '2026-04-12T00:00:00.000Z',
        user_id: 'user_1',
        username: 'orientpine',
        display_name: 'Orient Pine',
        avatar_url: 'https://example.com/avatar.png',
      },
      [
        {
          id: 'item_1',
          playlist_id: 'pl_1',
          item_type: 'external',
          source_id: null,
          external_url: 'https://example.com/a',
          title_snapshot: 'A',
          url_snapshot: 'https://example.com/a',
          description_snapshot: null,
          note: null,
          position: 1,
          added_at: '2026-04-12T00:00:00.000Z',
        },
        {
          id: 'item_2',
          playlist_id: 'pl_1',
          item_type: 'external',
          source_id: null,
          external_url: 'https://example.com/b',
          title_snapshot: 'B',
          url_snapshot: 'https://example.com/b',
          description_snapshot: 'desc',
          note: 'note',
          position: 2,
          added_at: '2026-04-12T00:00:00.000Z',
        },
      ],
    ]);

    const playlist = await getPlaylist(controller.db, 'pl_1');

    expect(playlist).toEqual({
      id: 'pl_1',
      title: 'My playlist',
      description: 'Great links',
      visibility: 'public',
      status: 'approved',
      playlist_type: 'community',
      tags: [],
      created_at: '2026-04-12T00:00:00.000Z',
      updated_at: '2026-04-12T00:00:00.000Z',
      user: {
        id: 'user_1',
        username: 'orientpine',
        display_name: 'Orient Pine',
        avatar_url: 'https://example.com/avatar.png',
      },
      items: expect.arrayContaining([
        expect.objectContaining({ id: 'item_1', position: 1 }),
        expect.objectContaining({ id: 'item_2', position: 2 }),
      ]),
    });

    const queries = controller.getQueries();
    expect(queries).toHaveLength(2);
    expect(queries[0]?.sql).toContain('INNER JOIN users');
    expect(queries[1]?.sql).toContain('ORDER BY position DESC');
  });

  it('getPlaylist returns null for non-existent ID', async () => {
    controller.setResults([null]);

    const playlist = await getPlaylist(controller.db, 'missing');

    expect(playlist).toBeNull();
    expect(controller.getQueries()).toHaveLength(1);
  });

  it('listPublicPlaylists returns only visibility public plus status approved', async () => {
    controller.setResults([
      { total: 2 },
      [
        {
          ...basePlaylist,
          id: 'pl_public_1',
          visibility: 'public',
          status: 'approved',
          username: 'alice',
          display_name: 'Alice',
          avatar_url: 'https://example.com/alice.png',
          item_count: 3,
        },
        {
          ...basePlaylist,
          id: 'pl_public_2',
          visibility: 'public',
          status: 'approved',
          username: 'bob',
          display_name: 'Bob',
          avatar_url: 'https://example.com/bob.png',
          item_count: '1',
        },
      ],
    ]);

    const response = await listPublicPlaylists(controller.db, 1, 12);

    expect(response.total).toBe(2);
    expect(response.page).toBe(1);
    expect(response.totalPages).toBe(1);
    expect(response.playlists).toHaveLength(2);
    expect(response.playlists[0]).toMatchObject({
      id: 'pl_public_1',
      visibility: 'public',
      status: 'approved',
      item_count: 3,
      user: { username: 'alice' },
    });

    const queries = controller.getQueries();
    expect(queries[0]?.sql).toContain('p.visibility =');
    expect(queries[0]?.sql).toContain("p.visibility = 'public' AND p.status = 'approved'");
    expect(queries[0]?.sql).toContain('SELECT COUNT(*)');
    expect(queries[1]?.sql).toContain('FROM user_playlists p');
    expect(queries[1]?.sql).toContain('ORDER BY p.updated_at DESC');
  });

  it('listPublicPlaylists paginates correctly', async () => {
    controller.setResults([{ total: 25 }, []]);

    const response = await listPublicPlaylists(controller.db, 3, 5);

    expect(response.total).toBe(25);
    expect(response.page).toBe(3);
    expect(response.totalPages).toBe(5);
    expect(response.playlists).toEqual([]);

    const queries = controller.getQueries();
    expect(queries[1]?.params).toEqual([5, 10]);
  });

  it('listUserPlaylists returns all playlists for given user with item_count', async () => {
    controller.setResults([
      [
        { ...basePlaylist, item_count: 3 },
        { ...basePlaylist, id: 'pl_2', title: 'Second', item_count: '0' },
      ],
    ]);

    const playlists = await listUserPlaylists(controller.db, 'user_1');

    expect(playlists).toHaveLength(2);
    expect(playlists.map((playlist) => playlist.id)).toEqual(['pl_1', 'pl_2']);
    expect(playlists[0]?.item_count).toBe(3);
    expect(playlists[1]?.item_count).toBe(0);

    const queries = controller.getQueries();
    expect(queries[0]?.params).toEqual(['user_1']);
    expect(queries[0]?.sql).toContain('ORDER BY p.updated_at DESC');
    expect(queries[0]?.sql).toContain('SELECT COUNT(*)');
  });

  it('updatePlaylist returns updated row for owner', async () => {
    controller.setResults([
      { user_id: 'user_1' },
      [],
      { ...basePlaylist, title: 'Updated title', description: 'Updated description' },
    ]);

    const playlist = await updatePlaylist(controller.db, 'pl_1', 'user_1', {
      title: 'Updated title',
      description: 'Updated description',
    });

    expect(playlist).toMatchObject({
      id: 'pl_1',
      title: 'Updated title',
      description: 'Updated description',
    });

    const queries = controller.getQueries();
    expect(queries[1]?.sql).toContain('SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP');
    expect(queries[1]?.params).toEqual(['Updated title', 'Updated description', 'pl_1']);
  });

  it('updatePlaylist returns null for non-owner', async () => {
    controller.setResults([{ user_id: 'other_user' }]);

    const playlist = await updatePlaylist(controller.db, 'pl_1', 'user_1', {
      title: 'Updated title',
    });

    expect(playlist).toBeNull();
    expect(controller.getQueries()).toHaveLength(1);
  });

  it('deletePlaylist cascades, returns true for owner, false for non-owner', async () => {
    controller.setResults([{ user_id: 'user_1' }, []]);

    const deleted = await deletePlaylist(controller.db, 'pl_1', 'user_1');

    expect(deleted).toBe(true);
    expect(controller.getQueries()[1]?.sql).toContain('DELETE FROM user_playlists');

    controller.setResults([{ user_id: 'other_user' }]);

    const notDeleted = await deletePlaylist(controller.db, 'pl_1', 'user_1');

    expect(notDeleted).toBe(false);
  });

  it('setVisibility auto-sets status pending when changing to public', async () => {
    controller.setResults([
      { user_id: 'user_1' },
      { playlist_type: 'community' },
      [],
      { ...basePlaylist, visibility: 'public', status: 'pending' },
    ]);

    const playlist = await setVisibility(controller.db, 'pl_1', 'user_1', 'public');

    expect(playlist).toMatchObject({
      id: 'pl_1',
      visibility: 'public',
      status: 'pending',
    });

    const queries = controller.getQueries();
    expect(queries[2]?.params).toEqual(['public', 'pending', 'pl_1']);
  });

  it('setVisibility resets status to draft when changing to unlisted', async () => {
    controller.setResults([
      { user_id: 'user_1' },
      { playlist_type: 'community' },
      [],
      { ...basePlaylist, visibility: 'unlisted', status: 'draft' },
    ]);

    const playlist = await setVisibility(controller.db, 'pl_1', 'user_1', 'unlisted');

    expect(playlist).toMatchObject({
      visibility: 'unlisted',
      status: 'draft',
    });
    expect(controller.getQueries()[2]?.params).toEqual(['unlisted', 'draft', 'pl_1']);
  });
});
