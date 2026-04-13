import { getSession } from './lib/auth';
import { parseCookies } from './lib/cookies';
import { escapeAttr, escapeHtml } from './lib/escape';
import { getTrendingPlaylists } from './lib/likes';
import type { AppPagesFunction, Env, TrendingPlaylistItem } from './lib/types';

const PAGE_SIZE = 20;

function getCanonicalUrl(requestUrl: string): string {
  const origin = new URL(requestUrl).origin;
  return `${origin}/trending`;
}

function getOwnerName(playlist: TrendingPlaylistItem): string {
  return playlist.user.display_name?.trim() || `@${playlist.user.username}`;
}

function getPageNumber(value: string | null): number {
  const page = Number(value ?? '1');
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function getPageHref(page: number): string {
  return page <= 1 ? '/trending' : `/trending?page=${page}`;
}

function renderAvatar(playlist: TrendingPlaylistItem): string {
  if (playlist.user.avatar_url) {
    return `<img src="${escapeAttr(playlist.user.avatar_url)}" alt="" class="avatar">`;
  }

  const fallback = playlist.user.username.trim().charAt(0).toUpperCase() || 'H';
  return `<span class="avatar avatar-fallback" aria-hidden="true">${escapeHtml(fallback)}</span>`;
}

function renderPagination(currentPage: number, totalPages: number): string {
  if (totalPages <= 1) {
    return '';
  }

  const pageSet = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const pages = Array.from(pageSet)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const parts: string[] = [];

  if (currentPage > 1) {
    parts.push(`<a href="${escapeAttr(getPageHref(currentPage - 1))}">이전</a>`);
  }

  let prevPage = 0;
  for (const page of pages) {
    if (prevPage && page - prevPage > 1) {
      parts.push('<span class="pagination-gap" aria-hidden="true">…</span>');
    }

    parts.push(
      `<a href="${escapeAttr(getPageHref(page))}"${page === currentPage ? ' class="active" aria-current="page"' : ''}>${page}</a>`,
    );
    prevPage = page;
  }

  if (currentPage < totalPages) {
    parts.push(`<a href="${escapeAttr(getPageHref(currentPage + 1))}">다음</a>`);
  }

  return `<nav class="pagination" aria-label="트렌딩 페이지 이동">${parts.join('')}</nav>`;
}

function renderCards(playlists: TrendingPlaylistItem[], currentPage: number, isLoggedIn: boolean): string {
  if (playlists.length === 0) {
    return '<div class="card empty-state">아직 공개된 플레이리스트가 없습니다.</div>';
  }

  const rankOffset = (currentPage - 1) * PAGE_SIZE;

  return playlists
    .map((playlist, index) => {
      const rank = rankOffset + index + 1;
      const description = playlist.description?.trim() || `${getOwnerName(playlist)}의 플레이리스트 · ${playlist.item_count}개 기사`;
      const likeButtonLabel = playlist.user_liked ? '좋아요 취소' : '좋아요';
      const likeIcon = playlist.user_liked ? '♥' : '♡';

      return `
        <article class="card trending-card">
          <div class="trending-card-top">
            <span class="rank-badge">#${rank}</span>
            <span class="like-count" data-like-count-for="${escapeAttr(playlist.id)}">❤️ ${playlist.like_count}</span>
          </div>
          <h2 class="playlist-title"><a href="/p/${escapeAttr(playlist.id)}">${escapeHtml(playlist.title)}</a></h2>
          <p class="playlist-description">${escapeHtml(description)}</p>
          <div class="playlist-author">
            ${renderAvatar(playlist)}
            <span>${escapeHtml(getOwnerName(playlist))}</span>
          </div>
          <div class="playlist-footer">
            <span class="badge">${playlist.item_count}개 기사</span>
            <button
              type="button"
              class="btn like-button${playlist.user_liked ? ' is-liked' : ''}"
              data-playlist-id="${escapeAttr(playlist.id)}"
              data-liked="${playlist.user_liked ? 'true' : 'false'}"
              data-like-count="${playlist.like_count}"
              data-authenticated="${isLoggedIn ? 'true' : 'false'}"
              aria-pressed="${playlist.user_liked ? 'true' : 'false'}"
              aria-label="${escapeAttr(likeButtonLabel)}"
            >
              <span class="like-button-icon" aria-hidden="true">${likeIcon}</span>
              <span class="like-button-label">좋아요</span>
            </button>
          </div>
        </article>`;
    })
    .join('');
}

function renderDocument(options: {
  pageTitle: string;
  metaTitle: string;
  description: string;
  canonicalUrl: string;
  body: string;
  script?: string;
}): string {
  const { pageTitle, metaTitle, description, canonicalUrl, body, script } = options;

  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeAttr(description)}">
    <title>${escapeHtml(pageTitle)}</title>
    <link rel="canonical" href="${escapeAttr(canonicalUrl)}">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <meta property="og:title" content="${escapeAttr(metaTitle)}">
    <meta property="og:description" content="${escapeAttr(description)}">
    <meta property="og:url" content="${escapeAttr(canonicalUrl)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="HoneyCombo">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(metaTitle)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <style>
      :root {
        --color-bg: #F7F6F3;
        --color-bg-secondary: #FFF8F0;
        --color-text: #2F2B31;
        --color-text-muted: #6B6168;
        --color-primary: #F57C22;
        --color-primary-hover: #EE7320;
        --color-border: #E8DDD4;
        --color-accent: #FCB924;
        --color-success: #10b981;
        --color-danger: #ef4444;
        --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
        --font-mono: 'Fira Code', 'Cascadia Code', monospace;
        --space-xs: 0.25rem;
        --space-sm: 0.5rem;
        --space-md: 1rem;
        --space-lg: 1.5rem;
        --space-xl: 2rem;
        --space-2xl: 3rem;
        --radius-sm: 4px;
        --radius-md: 8px;
        --radius-lg: 12px;
        --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
        --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
        --max-width: 1200px;
        --nav-height: 60px;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --color-bg: #1A1517;
          --color-bg-secondary: #2A2226;
          --color-text: #F7F6F3;
          --color-text-muted: #A89B96;
          --color-primary: #F58B3F;
          --color-primary-hover: #FCB924;
          --color-border: #3D3235;
        }
      }

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { font-size: 16px; scroll-behavior: smooth; }
      body {
        font-family: var(--font-sans);
        background: var(--color-bg);
        color: var(--color-text);
        line-height: 1.6;
        min-height: 100vh;
      }

      a { color: var(--color-primary); text-decoration: none; }
      a:hover { color: var(--color-primary-hover); text-decoration: underline; }
      img { max-width: 100%; height: auto; }

      .container { max-width: var(--max-width); margin: 0 auto; padding: 0 var(--space-md); }
      .grid { display: grid; gap: var(--space-md); }
      .grid-3 { grid-template-columns: repeat(3, 1fr); }

      .card {
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--space-md);
        transition: box-shadow 0.2s, border-color 0.2s;
      }

      .card:hover { box-shadow: var(--shadow-md); border-color: var(--color-primary); }

      .badge {
        display: inline-flex;
        align-items: center;
        padding: 2px var(--space-sm);
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        background: var(--color-bg-secondary);
        color: var(--color-text-muted);
        border: 1px solid var(--color-border);
      }

      .pagination {
        display: flex;
        gap: var(--space-sm);
        justify-content: center;
        align-items: center;
        padding: var(--space-xl) 0;
        flex-wrap: wrap;
      }

      .pagination a {
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        font-weight: 500;
      }

      .pagination a:hover, .pagination a.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
        text-decoration: none;
      }

      .pagination-gap {
        color: var(--color-text-muted);
        padding: 0 var(--space-xs);
      }

      .site-header {
        border-bottom: 1px solid var(--color-border);
        background: var(--color-bg);
      }

      .site-header-inner, .site-footer-inner {
        max-width: var(--max-width);
        margin: 0 auto;
        padding: var(--space-md);
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: var(--space-sm);
        font-weight: 800;
        font-size: 1.1rem;
      }

      .main-content {
        padding: var(--space-xl) 0 var(--space-2xl);
      }

      .page-shell {
        display: flex;
        flex-direction: column;
        gap: var(--space-xl);
      }

      .page-header {
        max-width: 720px;
      }

      .page-eyebrow {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        margin-bottom: var(--space-sm);
        color: var(--color-primary);
        font-weight: 700;
      }

      .page-title {
        font-size: clamp(2rem, 4vw, 2.75rem);
        line-height: 1.2;
        font-weight: 800;
        margin-bottom: var(--space-sm);
      }

      .page-description {
        color: var(--color-text-muted);
        font-size: 1.05rem;
      }

      .trending-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        flex-wrap: wrap;
        color: var(--color-text-muted);
      }

      .trending-grid {
        align-items: stretch;
      }

      .trending-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        min-height: 100%;
      }

      .trending-card-top,
      .playlist-footer,
      .playlist-author {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
      }

      .rank-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 3rem;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        background: var(--color-accent);
        color: var(--color-text);
        font-weight: 800;
      }

      .like-count {
        color: var(--color-text-muted);
        font-weight: 600;
      }

      .playlist-title {
        font-size: 1.2rem;
        line-height: 1.4;
      }

      .playlist-title a {
        color: var(--color-text);
      }

      .playlist-title a:hover {
        color: var(--color-primary);
      }

      .playlist-description {
        color: var(--color-text-muted);
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        min-height: 3.2em;
      }

      .playlist-author {
        justify-content: flex-start;
        color: var(--color-text);
        font-weight: 600;
      }

      .avatar {
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        object-fit: cover;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
      }

      .avatar-fallback {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
      }

      .playlist-footer {
        margin-top: auto;
        align-items: flex-end;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-xs);
        padding: 0.75rem 1rem;
        border-radius: var(--radius-sm);
        border: 1px solid var(--color-border);
        background: var(--color-bg);
        color: var(--color-text);
        font: inherit;
        cursor: pointer;
      }

      .btn:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        text-decoration: none;
      }

      .like-button {
        min-width: 6.5rem;
        font-weight: 700;
      }

      .like-button.is-liked {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
      }

      .like-button.is-liked:hover {
        color: white;
        background: var(--color-primary-hover);
        border-color: var(--color-primary-hover);
      }

      .like-button:disabled {
        opacity: 0.7;
        cursor: wait;
      }

      .empty-state {
        text-align: center;
        padding: var(--space-2xl) var(--space-lg);
        color: var(--color-text-muted);
      }

      .site-footer {
        border-top: 1px solid var(--color-border);
        color: var(--color-text-muted);
      }

      @media (max-width: 768px) {
        .grid-3 { grid-template-columns: 1fr; }
        .container, .site-header-inner, .site-footer-inner { padding: 0 var(--space-sm); }
        .site-header-inner, .site-footer-inner {
          padding-top: var(--space-md);
          padding-bottom: var(--space-md);
        }
        .trending-card-top, .playlist-footer {
          align-items: flex-start;
          flex-direction: column;
        }
        .playlist-footer .btn {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <header class="site-header">
      <div class="site-header-inner">
        <a href="/" class="brand">🍯 HoneyCombo</a>
      </div>
    </header>
    <main class="main-content">
      <div class="container">
        ${body}
      </div>
    </main>
    <footer class="site-footer">
      <div class="site-footer-inner">
        <p>© 2026 HoneyCombo</p>
      </div>
    </footer>
    ${script ?? ''}
  </body>
</html>`;
}

export const onRequest: AppPagesFunction = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const page = getPageNumber(url.searchParams.get('page'));
  const canonicalUrl = getCanonicalUrl(request.url);

  const cookies = parseCookies(request.headers.get('cookie') ?? '');
  const user = cookies.session ? await getSession(env.DB, cookies.session) : null;
  const result = await getTrendingPlaylists(env.DB, page, PAGE_SIZE, user?.id);

  const html = renderDocument({
    pageTitle: '트렌딩 플레이리스트 — HoneyCombo',
    metaTitle: '트렌딩 플레이리스트 — HoneyCombo',
    description: '커뮤니티가 가장 좋아하는 기술 기사 플레이리스트',
    canonicalUrl,
    body: `
      <section class="page-shell">
        <header class="page-header">
          <div class="page-eyebrow">🔥 트렌딩 플레이리스트</div>
          <h1 class="page-title">🔥 트렌딩 플레이리스트</h1>
          <p class="page-description">커뮤니티가 좋아하는 플레이리스트</p>
        </header>

        <div class="trending-summary">
          <p>총 ${result.total}개의 공개 플레이리스트</p>
          <p>${result.totalPages > 0 ? `${result.page} / ${result.totalPages} 페이지` : '첫 번째 플레이리스트를 기다리고 있어요.'}</p>
        </div>

        <section class="grid grid-3 trending-grid">
          ${renderCards(result.playlists, result.page, Boolean(user))}
        </section>

        ${renderPagination(result.page, result.totalPages)}
      </section>`,
    script: `<script>
      const loginUrl = '/api/auth/github/login?return_to=' + encodeURIComponent('/trending');

      function updateLikeButton(button, liked, likeCount) {
        button.dataset.liked = liked ? 'true' : 'false';
        button.dataset.likeCount = String(likeCount);
        button.setAttribute('aria-pressed', liked ? 'true' : 'false');
        button.setAttribute('aria-label', liked ? '좋아요 취소' : '좋아요');
        button.classList.toggle('is-liked', liked);

        const icon = button.querySelector('.like-button-icon');
        if (icon) {
          icon.textContent = liked ? '♥' : '♡';
        }

        const countEl = document.querySelector('[data-like-count-for="' + button.dataset.playlistId + '"]');
        if (countEl) {
          countEl.textContent = '❤️ ' + likeCount;
        }
      }

      document.querySelectorAll('.like-button').forEach((button) => {
        button.addEventListener('click', async () => {
          const playlistId = button.dataset.playlistId;
          const isAuthenticated = button.dataset.authenticated === 'true';

          if (!playlistId) {
            return;
          }

          if (!isAuthenticated) {
            window.location.href = loginUrl;
            return;
          }

          const previousLiked = button.dataset.liked === 'true';
          const previousCount = Number(button.dataset.likeCount || '0');
          const nextLiked = !previousLiked;
          const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));

          button.disabled = true;
          updateLikeButton(button, nextLiked, nextCount);

          try {
            const response = await fetch('/api/playlists/' + encodeURIComponent(playlistId) + '/like', {
              method: 'POST',
              credentials: 'same-origin'
            });

            if (!response.ok) {
              throw new Error();
            }

            const data = await response.json();
            updateLikeButton(button, Boolean(data.liked), Number(data.like_count || 0));
          } catch {
            updateLikeButton(button, previousLiked, previousCount);
            window.alert('좋아요 처리에 실패했습니다.');
          } finally {
            button.disabled = false;
          }
        });
      });
    </script>`,
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
