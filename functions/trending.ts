import { getSession } from './lib/auth';
import { parseCookies } from './lib/cookies';
import { escapeAttr, escapeHtml } from './lib/escape';
import { renderDocument } from './lib/layout';
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

// ---------------------------------------------------------------------------
// Page-specific styles (layout/nav/footer/base styles come from shared layout)
// ---------------------------------------------------------------------------

const PAGE_STYLES = `
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

      .playlist-footer {
        margin-top: auto;
        align-items: flex-end;
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

      @media (max-width: 768px) {
        .trending-card-top, .playlist-footer {
          align-items: flex-start;
          flex-direction: column;
        }
        .playlist-footer .btn {
          width: 100%;
        }
      }`;

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
    currentPath: '/trending',
    styles: PAGE_STYLES,
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
