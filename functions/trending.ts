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

function renderCuratorAvatar(playlist: TrendingPlaylistItem): string {
  if (playlist.user.avatar_url) {
    return `<img src="${escapeAttr(playlist.user.avatar_url)}" alt="" class="curator-avatar" /> `;
  }
  return '';
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
      const likeCount = playlist.like_count;
      const likeButtonLabel = playlist.user_liked
        ? `좋아요 취소 (현재 ${likeCount}개)`
        : `좋아요 (현재 ${likeCount}개)`;
      const username = playlist.user.username || 'unknown';

      return `
        <article class="card playlist-card">
          <div class="playlist-header">
            <h3 class="playlist-title"><a href="/p/${escapeAttr(playlist.id)}">${escapeHtml(playlist.title)}</a></h3>
            <span class="playlist-count">${playlist.item_count}개</span>
          </div>
          <p class="playlist-description">${escapeHtml(description)}</p>
          <div class="playlist-footer">
            <span class="playlist-curator">
              ${renderCuratorAvatar(playlist)}
              by @${escapeHtml(username)}
            </span>
            <span class="trending-stats">
              <span class="rank-badge">#${rank}</span>
              <button
                type="button"
                class="like-button${playlist.user_liked ? ' is-liked' : ''}"
                data-playlist-id="${escapeAttr(playlist.id)}"
                data-liked="${playlist.user_liked ? 'true' : 'false'}"
                data-like-count="${likeCount}"
                data-authenticated="${isLoggedIn ? 'true' : 'false'}"
                aria-pressed="${playlist.user_liked ? 'true' : 'false'}"
                aria-label="${escapeAttr(likeButtonLabel)}"
              >
                <span class="like-button-icon" aria-hidden="true">
                  <svg class="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  <svg class="icon-filled" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </span>
                <span class="like-button-count">${likeCount}</span>
              </button>
            </span>
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

      /* Card structure — playlists page 패턴 일치 */
      .playlist-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        color: var(--color-text);
      }

      .playlist-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }

      .playlist-title {
        font-size: 1.1rem;
        font-weight: 700;
      }

      .playlist-title a {
        color: var(--color-text);
        text-decoration: none;
      }

      .playlist-title a:hover {
        color: var(--color-primary);
      }

      .playlist-count {
        font-size: 0.8rem;
        color: var(--color-text-muted);
        background: var(--color-bg-secondary);
        padding: 2px var(--space-sm);
        border-radius: var(--radius-sm);
        white-space: nowrap;
      }

      .playlist-description {
        font-size: 0.875rem;
        color: var(--color-text-muted);
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .playlist-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: auto;
      }

      .playlist-curator {
        font-size: 0.8rem;
        color: var(--color-text-muted);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .curator-avatar {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        object-fit: cover;
      }

      /* Trending-specific: rank + likes + button */
      .trending-stats {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .rank-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.5rem;
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        background: var(--color-accent);
        color: var(--color-text);
        font-weight: 800;
        font-size: 0.8rem;
      }

      /* Like count is no longer rendered as a separate sibling — */
      /* the count is now embedded inside the like button itself. */
      .like-count {
        display: none;
      }

      /* Modern like button — pill-shaped, icon + count, hover lift, liked-state gradient */
      .like-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        min-height: 2rem;
        padding: 0.375rem 0.875rem;
        border: 1px solid var(--color-border);
        border-radius: 999px;
        background: var(--color-bg);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.8rem;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        transition: color 0.18s cubic-bezier(0.4, 0, 0.2, 1),
                    background 0.18s cubic-bezier(0.4, 0, 0.2, 1),
                    border-color 0.18s cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1),
                    transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .like-button:hover:not(:disabled) {
        color: var(--color-like-hover-text);
        border-color: var(--color-like-hover-border);
        background: var(--color-like-hover-bg);
        transform: translateY(-1px);
        box-shadow: var(--shadow-sm);
      }

      .like-button:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: none;
      }

      .like-button:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .like-button-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 14px;
        color: inherit;
        transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .like-button-icon svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .like-button-icon .icon-filled {
        display: none;
      }

      .like-button-count {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      .like-button.is-liked {
        background: linear-gradient(135deg, var(--color-like-gradient-from) 0%, var(--color-like-gradient-to) 100%);
        border-color: transparent;
        color: #fff;
        box-shadow: var(--shadow-like);
      }
      .like-button.is-liked:hover:not(:disabled) {
        color: #fff;
        background: linear-gradient(135deg, var(--color-like-gradient-from-hover) 0%, var(--color-like-gradient-to-hover) 100%);
        border-color: transparent;
        box-shadow: var(--shadow-like-hover);
        transform: translateY(-1px);
      }
      .like-button.is-liked .icon-outline {
        display: none;
      }
      .like-button.is-liked .icon-filled {
        display: block;
        animation: like-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .like-button:disabled {
        opacity: 0.6;
        cursor: wait;
        transform: none;
      }

      @keyframes like-pop {
        0% { transform: scale(1); }
        40% { transform: scale(1.35); }
        100% { transform: scale(1); }
      }

      @media (prefers-reduced-motion: reduce) {
        .like-button,
        .like-button-icon,
        .like-button.is-liked .icon-filled {
          transition: none;
          animation: none;
        }
        .like-button:hover:not(:disabled) {
          transform: none;
        }
      }

      @media (max-width: 768px) {
        .playlist-footer {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-sm);
        }
        .trending-stats {
          width: 100%;
          justify-content: flex-end;
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
        button.setAttribute(
          'aria-label',
          (liked ? '좋아요 취소 (현재 ' : '좋아요 (현재 ') + likeCount + '개)'
        );
        button.classList.toggle('is-liked', liked);

        const countEl = button.querySelector('.like-button-count');
        if (countEl) {
          countEl.textContent = String(likeCount);
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
