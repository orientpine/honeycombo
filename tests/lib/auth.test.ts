import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockD1 } from '../helpers/d1-mock';

vi.mock('../../functions/lib/id', () => ({
  generateId: vi.fn(() => 'session_123456'),
}));

import {
  cleanExpiredSessions,
  createSession,
  deleteSession,
  getSession,
  upsertUser,
} from '../../functions/lib/auth';

describe('auth repository', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('upsertUser creates new user', async () => {
    const mock = createMockD1();
    const user = {
      id: 'user_1',
      username: 'alice',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.png',
      created_at: '2026-04-12 12:00:00',
    };

    mock.setResult(user);

    const result = await upsertUser(mock.db, {
      id: 'user_1',
      username: 'alice',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.png',
    });

    expect(result).toEqual(user);

    const [query] = mock.getQueries();
    expect(query.sql).toContain('INSERT INTO users');
    expect(query.sql).toContain('ON CONFLICT(id) DO UPDATE');
  });

  it('upsertUser updates existing user with bound params', async () => {
    const mock = createMockD1();
    mock.setResult({
      id: 'user_1',
      username: 'alice-renamed',
      display_name: 'Alice Updated',
      avatar_url: null,
      created_at: '2026-04-12 12:00:00',
    });

    await upsertUser(mock.db, {
      id: 'user_1',
      username: 'alice-renamed',
      display_name: 'Alice Updated',
      avatar_url: null,
    });

    const [query] = mock.getQueries();
    expect(query.sql).toContain('INSERT INTO users');
    expect(query.sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(query.params).toEqual(['user_1', 'alice-renamed', 'Alice Updated', null]);
  });

  it('createSession returns session id and about 30 day expiry', async () => {
    const mock = createMockD1();
    const before = Date.now();

    const result = await createSession(mock.db, 'user_1');

    const after = Date.now();
    const minExpiry = before + 30 * 24 * 60 * 60 * 1000;
    const maxExpiry = after + 30 * 24 * 60 * 60 * 1000;

    expect(result.sessionId).toBe('session_123456');
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(minExpiry);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(maxExpiry);

    const [query] = mock.getQueries();
    expect(query.sql).toBe('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)');
    expect(query.params).toEqual(['session_123456', 'user_1', result.expiresAt.toISOString()]);
  });

  it('getSession returns user for a valid session', async () => {
    const mock = createMockD1();
    const user = {
      id: 'user_1',
      username: 'alice',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.png',
      created_at: '2026-04-12 12:00:00',
    };

    mock.setResult(user);

    const result = await getSession(mock.db, 'session_123456');

    expect(result).toEqual(user);

    const [query] = mock.getQueries();
    expect(query.sql).toContain('FROM sessions s');
    expect(query.sql).toContain('INNER JOIN users u ON u.id = s.user_id');
    expect(query.sql).toContain('s.expires_at > CURRENT_TIMESTAMP');
    expect(query.params).toEqual(['session_123456']);
  });

  it('getSession returns null for an expired session', async () => {
    const mock = createMockD1();
    mock.setResult(null);

    const result = await getSession(mock.db, 'expired_session');

    expect(result).toBeNull();
  });

  it('deleteSession removes session', async () => {
    const mock = createMockD1();

    await deleteSession(mock.db, 'session_123456');

    const [query] = mock.getQueries();
    expect(query.sql).toBe('DELETE FROM sessions WHERE id = ?');
    expect(query.params).toEqual(['session_123456']);
  });

  it('cleanExpiredSessions deletes expired sessions and returns count', async () => {
    const mock = createMockD1();
    mock.setResult([{}, {}]);

    const deletedCount = await cleanExpiredSessions(mock.db);

    expect(deletedCount).toBe(2);

    const [query] = mock.getQueries();
    expect(query.sql).toBe('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP');
    expect(query.params).toEqual([]);
  });
});
