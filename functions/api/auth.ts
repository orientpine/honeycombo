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
  ALLOWED_ORIGIN?: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

type PagesFunction<TEnv = Record<string, unknown>> = (context: {
  request: Request;
  env: TEnv;
}) => Response | Promise<Response>;

function jsonHeaders(allowedOrigin: string) {
  return {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': allowedOrigin,
  };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const allowedOrigin = env.ALLOWED_ORIGIN || url.origin;

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

  // Step 1: No code → redirect to GitHub OAuth (Decap CMS opens this in a popup)
  if (!code) {
    if (!env.GITHUB_CLIENT_ID) {
      return new Response(JSON.stringify({ error: 'OAuth not configured: missing GITHUB_CLIENT_ID' }), {
        status: 500,
        headers: jsonHeaders(allowedOrigin),
      });
    }

    const redirectUri = new URL('/api/auth', request.url).toString();
    const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
    authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', 'repo,user');

    return Response.redirect(authorizeUrl.toString(), 302);
  }

  // Step 2: Has code → exchange for token and postMessage back to CMS

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: 'OAuth not configured' }), {
      status: 500,
      headers: jsonHeaders(allowedOrigin),
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
        headers: jsonHeaders(allowedOrigin),
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
          headers: jsonHeaders(allowedOrigin),
        },
      );
    }

    const script = `
      <script>
      (function() {
        function receiveMessage(e) {
          window.opener.postMessage(
            'authorization:github:success:${JSON.stringify({ token: tokenData.access_token, provider: 'github' })}',
            e.origin
          );
          window.removeEventListener("message", receiveMessage, false);
        }
        window.addEventListener("message", receiveMessage, false);
        window.opener.postMessage("authorizing:github", "*");
      })()
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
      headers: jsonHeaders(allowedOrigin),
    });
  }
};
