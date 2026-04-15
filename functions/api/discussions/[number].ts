import { getDiscussion } from '../../lib/github-graphql';
import type { AppPagesFunction } from '../../lib/types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequestGet: AppPagesFunction = async (context) => {
  const numberStr = context.params.number as string;
  const num = parseInt(numberStr, 10);

  if (!Number.isFinite(num) || num < 1) {
    return json({ error: 'Invalid discussion number' }, 400);
  }

  try {
    const discussion = await getDiscussion(context.env, num);

    if (!discussion) {
      return json({ error: 'Discussion not found' }, 404);
    }

    return json({ discussion });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
};
