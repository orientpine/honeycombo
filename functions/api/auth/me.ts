import type { AppPagesFunction } from '../../lib/types';

export const onRequest: AppPagesFunction = async ({ data, request }) => {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'GET',
      },
    });
  }

  if (!data.user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return Response.json({
    user: {
      id: data.user.id,
      username: data.user.username,
      display_name: data.user.display_name,
      avatar_url: data.user.avatar_url,
    },
  });
};
