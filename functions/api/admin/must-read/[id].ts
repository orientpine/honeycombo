import { isAdmin } from '../../../lib/admin';
import { deleteMustReadItem } from '../../../lib/must-read';
import type { AppPagesFunction, ContextData, Env } from '../../../lib/types';

type AdminContext = {
  request: Request;
  env: Env;
  params: Record<string, string>;
  data: ContextData;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const handler = async (context: AdminContext): Promise<Response> => {
  const { request, env, params, data } = context;

  if (request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!data.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!isAdmin(env, data.user.id)) {
    return json({ error: 'Forbidden' }, 403);
  }

  try {
    const deleted = await deleteMustReadItem(env.DB, params.id);

    if (!deleted) {
      return json({ error: 'Must-read item not found' }, 404);
    }

    return json({ success: true });
  } catch {
    return json({ error: 'Internal server error' }, 500);
  }
};

export const onRequest: AppPagesFunction[] = [handler];
