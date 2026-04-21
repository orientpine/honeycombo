import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockD1 } from '../helpers/d1-mock';

const { playlistSideEffectSpy } = vi.hoisted(() => ({
  playlistSideEffectSpy: vi.fn(),
}));

vi.mock('../../functions/lib/playlists', () => ({
  createPlaylist: (...args: unknown[]) => playlistSideEffectSpy('createPlaylist', args),
}));

vi.mock('../../functions/lib/playlist-items', () => ({
  addItem: (...args: unknown[]) => playlistSideEffectSpy('addItem', args),
  removeItem: (...args: unknown[]) => playlistSideEffectSpy('removeItem', args),
}));

import { onRequestPost } from '../../functions/webhooks/submission-approved';

const payload = {
  article_id: 'article_1',
  submitted_by_id: 'user_1',
  title: 'A good article',
  url: 'https://example.com/article-1',
};

function createWebhookRequest(body: unknown, token?: string): Request {
  return new Request('https://example.com/functions/webhooks/submission-approved', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function createWebhookEnv(db: D1Database, secret = 'test-secret') {
  return {
    DB: db,
    WEBHOOK_SECRET: secret,
  } as { DB: D1Database; WEBHOOK_SECRET: string };
}

describe('POST /functions/webhooks/submission-approved', () => {
  beforeEach(() => {
    playlistSideEffectSpy.mockReset();
  });

  it('returns 200 and upserts into submissions without creating playlist items', async () => {
    const controller = createMockD1();
    controller.setResults([{ id: 'user_1' }, []]);

    const response = await onRequestPost({
      request: createWebhookRequest(payload, 'test-secret'),
      env: createWebhookEnv(controller.db),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, article_id: 'article_1' });

    const queries = controller.getQueries();
    expect(queries).toHaveLength(2);
    expect(queries[0]?.sql).toContain('SELECT id FROM users');
    expect(queries[1]?.sql).toContain('INSERT INTO submissions');
    expect(queries[1]?.params).toEqual(['article_1', 'user_1', 'A good article', 'https://example.com/article-1']);
    expect(queries.some((query) => query.sql.includes('playlist_items'))).toBe(false);
    expect(queries.some((query) => query.sql.includes('user_playlists'))).toBe(false);
    expect(playlistSideEffectSpy).not.toHaveBeenCalled();
  });

  it('is idempotent when the same article_id is received twice', async () => {
    const controller = createMockD1();
    controller.setResults([{ id: 'user_1' }, [], { id: 'user_1' }, []]);
    const env = createWebhookEnv(controller.db);

    const firstResponse = await onRequestPost({
      request: createWebhookRequest(payload, 'test-secret'),
      env,
    } as never);
    const secondResponse = await onRequestPost({
      request: createWebhookRequest(payload, 'test-secret'),
      env,
    } as never);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(controller.getQueries().filter((query) => query.sql.includes('INSERT INTO submissions'))).toHaveLength(2);
    expect(controller.getQueries().some((query) => query.sql.includes('playlist_items'))).toBe(false);
    expect(playlistSideEffectSpy).not.toHaveBeenCalled();
  });

  it('returns 401 when the Bearer token is missing', async () => {
    const controller = createMockD1();

    const response = await onRequestPost({
      request: createWebhookRequest(payload),
      env: createWebhookEnv(controller.db),
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(controller.getQueries()).toHaveLength(0);
    expect(playlistSideEffectSpy).not.toHaveBeenCalled();
  });

  it('returns 401 when the Bearer token is invalid', async () => {
    const controller = createMockD1();

    const response = await onRequestPost({
      request: createWebhookRequest(payload, 'wrong-secret'),
      env: createWebhookEnv(controller.db),
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(controller.getQueries()).toHaveLength(0);
    expect(playlistSideEffectSpy).not.toHaveBeenCalled();
  });
});
