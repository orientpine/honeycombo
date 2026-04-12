import { createMockD1 } from './d1-mock';
import type { ContextData, Env, UserRow } from '../../functions/lib/types';

type ContextOverrides = Partial<{
  env: Partial<Env>;
  params: Record<string, string>;
  user: UserRow | null;
  body: BodyInit | null;
  method: string;
  url: string;
}>;

function createMockFetcher(): Fetcher {
  return {
    fetch(_input: RequestInfo | URL, _init?: RequestInit) {
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  } as Fetcher;
}

export function createMockContext(
  overrides: ContextOverrides = {},
): EventContext<Env, string, ContextData> {
  const { db } = createMockD1();
  const method = overrides.method ?? 'GET';
  const url = overrides.url ?? 'https://example.com/api/test';
  const request = new Request(url, {
    method,
    body: method === 'GET' || method === 'HEAD' ? null : (overrides.body ?? null),
    headers: overrides.body ? { 'content-type': 'application/json' } : undefined,
  });

  const env: Env = {
    DB: db,
    ASSETS: createMockFetcher(),
    GITHUB_CLIENT_ID: 'github-client-id',
    GITHUB_CLIENT_SECRET: 'github-client-secret',
    USER_GITHUB_CLIENT_ID: 'user-github-client-id',
    USER_GITHUB_CLIENT_SECRET: 'user-github-client-secret',
    USER_GITHUB_REDIRECT_URI: 'https://example.com/callback',
    ADMIN_GITHUB_IDS: '1,2,3',
    ALLOWED_ORIGIN: 'https://example.com',
    ...overrides.env,
  };

  return {
    request,
    env,
    params: overrides.params ?? {},
    data: {
      user: overrides.user ?? null,
    },
    functionPath: '/api/test',
    waitUntil(_promise: Promise<unknown>) {
      return undefined;
    },
    passThroughOnException() {
      return undefined;
    },
    next(_input?: Request | string, _init?: RequestInit) {
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  } as EventContext<Env, string, ContextData>;
}
