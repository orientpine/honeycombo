/**
 * Cloudflare Pages Function: GitHub OAuth handler for Decap CMS
 *
 * This function handles the OAuth code-to-token exchange.
 * The client_secret is stored as a Cloudflare Pages environment variable,
 * never exposed to the browser.
 *
 * Setup:
 * 1. Create a GitHub OAuth App at https://github.com/settings/developers
 *    - Homepage URL: https://honeycombo.pages.dev
 *    - Authorization callback URL: https://honeycombo.pages.dev/api/auth
 * 2. Set environment variables in Cloudflare Pages Dashboard:
 *    - GITHUB_CLIENT_ID: your OAuth app client ID
 *    - GITHUB_CLIENT_SECRET: your OAuth app client secret
 */

interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

type PagesFunction<TEnv = Record<string, unknown>> = (context: {
  request: Request;
  env: TEnv;
}) => Response | Promise<Response>;

const allowedOrigin = 'https://honeycombo.pages.dev';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': allowedOrigin,
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  const code = url.searchParams.get('code');

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code parameter' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: 'OAuth not configured' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
        status: 502,
        headers: jsonHeaders,
      });
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: tokenData.error || 'No access token' }),
        {
          status: 400,
          headers: jsonHeaders,
        },
      );
    }

    const script = `
      <script>
        window.opener.postMessage(
          'authorization:github:success:${JSON.stringify({ token: tokenData.access_token, provider: 'github' })}',
          '${allowedOrigin}'
        );
        window.close();
      </script>
    `;

    return new Response(script, {
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': allowedOrigin,
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
};
