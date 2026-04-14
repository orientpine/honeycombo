import { queryDiscussions, createDiscussion } from '../../lib/github-graphql';
import type { AppPagesFunction } from '../../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const lastPostTime = new Map<string, number>();
const RATE_LIMIT_MS = 60 * 1000; // 1 minute

export const onRequestGet: AppPagesFunction = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  const firstParam = url.searchParams.get('first');
  let first = firstParam ? parseInt(firstParam, 10) : 20;
  if (!Number.isFinite(first) || first < 1) first = 20;
  if (first > 50) first = 50;

  const after = url.searchParams.get('after') || undefined;
  const categoryId = env.DISCUSSIONS_CATEGORY_ID ?? '';

  try {
    const result = await queryDiscussions(env, categoryId, first, after);
    return json({
      discussions: result.discussions,
      pageInfo: result.pageInfo,
      totalCount: result.totalCount,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
};

export const onRequestPost: AppPagesFunction = async (context) => {
  const { env, request, data } = context;

  if (!data.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const now = Date.now();
  const userId = data.user.id;
  const lastPost = lastPostTime.get(userId);
  if (lastPost && now - lastPost < RATE_LIMIT_MS) {
    return json({ error: '1분에 한 번만 발제할 수 있습니다.' }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (typeof body !== 'object' || body === null) {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { title, body: discussionBody } = body as Record<string, unknown>;

  if (typeof title !== 'string' || title.length < 1 || title.length > 256) {
    return json({ error: 'Title must be between 1 and 256 characters' }, 400);
  }

  if (typeof discussionBody !== 'string' || discussionBody.length < 1 || discussionBody.length > 10000) {
    return json({ error: 'Body must be between 1 and 10000 characters' }, 400);
  }

  const categoryId = env.DISCUSSIONS_CATEGORY_ID;
  if (!categoryId) {
    return json({ error: 'Discussions feature is not configured. DISCUSSIONS_CATEGORY_ID is missing.' }, 503);
  }

  try {
    const result = await createDiscussion(env, categoryId, title, discussionBody, data.user.username);
    lastPostTime.set(userId, Date.now());
    return json({ number: result.number }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
};
