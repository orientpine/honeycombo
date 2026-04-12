import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockContext } from '../helpers/context-mock';

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock('../../functions/lib/auth', () => ({
  getSession: getSessionMock,
}));

import { onRequest as onApiRequest } from '../../functions/api/_middleware';
import { onRequest as onGlobalRequest } from '../../functions/_middleware';

describe('API middleware', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  it('sets user for valid session cookie', async () => {
    const user = {
      id: 'user_1',
      username: 'alice',
      display_name: 'Alice',
      avatar_url: 'https://example.com/alice.png',
      created_at: '2026-04-12 12:00:00',
    };
    const context = createMockContext();
    const next = vi.fn(async () => new Response('ok', { status: 200 }));

    context.request = new Request('https://example.com/api/test', {
      headers: { cookie: 'session=session_123' },
    });
    context.next = next;
    getSessionMock.mockResolvedValue(user);

    const response = await onApiRequest(context);

    expect(getSessionMock).toHaveBeenCalledWith(context.env.DB, 'session_123');
    expect(context.data.user).toEqual(user);
    expect(next).toHaveBeenCalledOnce();
    expect(await response.text()).toBe('ok');
  });

  it('sets user to null for no cookie', async () => {
    const context = createMockContext();
    context.next = vi.fn(async () => new Response(null, { status: 204 }));

    await onApiRequest(context);

    expect(getSessionMock).not.toHaveBeenCalled();
    expect(context.data.user).toBeNull();
  });

  it('sets user to null for expired session', async () => {
    const context = createMockContext();

    context.request = new Request('https://example.com/api/test', {
      headers: { cookie: 'session=expired_session' },
    });
    context.next = vi.fn(async () => new Response(null, { status: 204 }));
    getSessionMock.mockResolvedValue(null);

    await onApiRequest(context);

    expect(getSessionMock).toHaveBeenCalledWith(context.env.DB, 'expired_session');
    expect(context.data.user).toBeNull();
  });

  it('adds CORS headers to response', async () => {
    const context = createMockContext();

    context.next = vi.fn(async () =>
      new Response('ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    const response = await onApiRequest(context);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    expect(response.headers.get('Content-Type')).toBe('text/plain');
  });
});

describe('global middleware', () => {
  it('returns 204 for OPTIONS', async () => {
    const context = createMockContext({ method: 'OPTIONS', url: 'https://example.com/api/test' });

    const response = await onGlobalRequest(context);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
  });

  it('catches errors and returns 500', async () => {
    const context = createMockContext();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    context.next = vi.fn(async () => {
      throw new Error('boom');
    });

    const response = await onGlobalRequest(context);

    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    await expect(response.json()).resolves.toEqual({ error: 'Internal server error' });
    expect(consoleErrorSpy).toHaveBeenCalledOnce();

    consoleErrorSpy.mockRestore();
  });
});
