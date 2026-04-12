import { getSession } from '../lib/auth';
import { parseCookies } from '../lib/cookies';
import { escapeAttr, escapeHtml } from '../lib/escape';
import { getPlaylist } from '../lib/playlists';
import type { AppPagesFunction, PlaylistDetail, PlaylistItemRow } from '../lib/types';

const SITE_URL = 'https://honeycombo.orientpine.workers.dev';

function getCanonicalUrl(playlistId: string): string {
  return `${SITE_URL}/p/${encodeURIComponent(playlistId)}`;
}

function canViewPlaylist(playlist: PlaylistDetail, userId?: string): boolean {
  if (playlist.visibility === 'unlisted') {
    return true;
  }

  if (playlist.visibility === 'public' && playlist.status === 'approved') {
    return true;
  }

  return playlist.user.id === userId;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getVisibilityLabel(playlist: PlaylistDetail): string {
  if (playlist.visibility === 'unlisted') {
    return '비공개 링크';
  }

  if (playlist.status === 'approved') {
    return '공개';
  }

  if (playlist.status === 'pending') {
    return '승인 대기';
  }

  if (playlist.status === 'rejected') {
    return '반려';
  }

  return '임시 저장';
}

function getItemHref(item: PlaylistItemRow): string {
  if (item.item_type === 'external') {
    return item.url_snapshot;
  }

  return `/articles/${encodeURIComponent(item.source_id ?? '')}`;
}

function getItemDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getItemMetaLabel(item: PlaylistItemRow): string {
  if (item.item_type === 'external') {
    return getItemDomain(item.url_snapshot);
  }

  if (item.item_type === 'feed') {
    return 'HoneyCombo 피드';
  }

  return 'HoneyCombo 큐레이션';
}

function getOwnerName(playlist: PlaylistDetail): string {
  return playlist.user.display_name?.trim() || `@${playlist.user.username}`;
}

function getDescription(playlist: PlaylistDetail): string {
  const description = playlist.description?.trim();

  if (description) {
    return description;
  }

  return `${getOwnerName(playlist)}의 플레이리스트 · ${playlist.items.length}개 기사`;
}

function renderAvatar(playlist: PlaylistDetail): string {
  if (playlist.user.avatar_url) {
    return `<img src="${escapeAttr(playlist.user.avatar_url)}" alt="" class="avatar">`;
  }

  const fallback = playlist.user.username.trim().charAt(0).toUpperCase() || 'H';
  return `<span class="avatar avatar-fallback" aria-hidden="true">${escapeHtml(fallback)}</span>`;
}

function renderItems(items: PlaylistItemRow[]): string {
  if (items.length === 0) {
    return '<p class="empty-state">이 플레이리스트에 아직 기사가 없습니다.</p>';
  }

  return items
    .map((item) => {
      const href = getItemHref(item);
      const title = item.title_snapshot.trim() || '제목 없음';
      const note = item.note?.trim();
      const sourceLabel = getItemMetaLabel(item);
      const domain = getItemDomain(item.url_snapshot);
      const isExternal = item.item_type === 'external';

      return `
        <article class="item-card card">
          <div class="item-card-header">
            <span class="badge">${escapeHtml(sourceLabel)}</span>
            ${isExternal ? `<span class="item-domain">${escapeHtml(domain)}</span>` : '<span class="item-domain">HoneyCombo 기사</span>'}
          </div>
          <h2 class="item-title">
            <a href="${escapeAttr(href)}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(title)}</a>
          </h2>
          <p class="item-url">${escapeHtml(item.url_snapshot)}</p>
          ${note ? `<p class="item-note">💬 ${escapeHtml(note)}</p>` : ''}
        </article>`;
    })
    .join('');
}

function renderOwnerControls(playlist: PlaylistDetail): string {
  return `
    <section class="owner-controls card">
      <div>
        <h2>내 플레이리스트 관리</h2>
        <p>플레이리스트를 계속 편집하거나 삭제할 수 있습니다.</p>
      </div>
      <div class="owner-actions">
        <a href="/my/playlists" class="btn">관리 페이지</a>
        <a href="/p/new" class="btn">새 플레이리스트</a>
        <button type="button" class="btn btn-danger" onclick="deletePlaylist()">삭제</button>
      </div>
    </section>`;
}

function renderDocument(options: {
  pageTitle: string;
  metaTitle: string;
  description: string;
  canonicalUrl: string;
  robots?: string;
  body: string;
  script?: string;
}): string {
  const { pageTitle, metaTitle, description, canonicalUrl, robots, body, script } = options;

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
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="HoneyCombo">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(metaTitle)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    ${robots ? `<meta name="robots" content="${escapeAttr(robots)}">` : ''}
    <style>
      :root {
        --color-bg: #ffffff;
        --color-bg-secondary: #f8f9fa;
        --color-text: #1a1a2e;
        --color-text-muted: #6c757d;
        --color-primary: #2563eb;
        --color-primary-hover: #1d4ed8;
        --color-border: #e2e8f0;
        --color-accent: #f59e0b;
        --color-danger: #ef4444;
        --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
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
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --color-bg: #0f172a;
          --color-bg-secondary: #1e293b;
          --color-text: #f1f5f9;
          --color-text-muted: #94a3b8;
          --color-primary: #3b82f6;
          --color-primary-hover: #60a5fa;
          --color-border: #334155;
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
      .card {
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--space-md);
        transition: box-shadow 0.2s, border-color 0.2s;
      }

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

      .playlist-detail {
        max-width: 920px;
        margin: 0 auto;
      }

      .playlist-header {
        margin-bottom: var(--space-xl);
      }

      .playlist-title {
        font-size: clamp(2rem, 4vw, 2.75rem);
        line-height: 1.2;
        font-weight: 800;
        margin-bottom: var(--space-sm);
      }

      .playlist-description {
        color: var(--color-text-muted);
        font-size: 1.05rem;
        margin-bottom: var(--space-md);
      }

      .playlist-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-sm) var(--space-md);
        color: var(--color-text-muted);
        margin-bottom: var(--space-sm);
      }

      .playlist-owner {
        display: inline-flex;
        align-items: center;
        gap: var(--space-sm);
        font-weight: 600;
        color: var(--color-text);
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
        font-size: 0.85rem;
        font-weight: 700;
      }

      .items {
        display: grid;
        gap: var(--space-md);
        margin-top: var(--space-lg);
      }

      .item-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-sm);
      }

      .item-title {
        font-size: 1.125rem;
        line-height: 1.4;
        margin-bottom: var(--space-xs);
      }

      .item-title a {
        color: var(--color-text);
      }

      .item-title a:hover {
        color: var(--color-primary);
      }

      .item-domain, .item-url, .meta-text, .updated-at {
        color: var(--color-text-muted);
        font-size: 0.9rem;
      }

      .item-url {
        word-break: break-all;
      }

      .item-note {
        margin-top: var(--space-sm);
        padding: var(--space-sm);
        background: var(--color-bg-secondary);
        border-radius: var(--radius-sm);
        color: var(--color-text-muted);
      }

      .owner-controls {
        margin-top: var(--space-xl);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-md);
      }

      .owner-controls h2 {
        font-size: 1.1rem;
        margin-bottom: var(--space-xs);
      }

      .owner-controls p {
        color: var(--color-text-muted);
      }

      .owner-actions {
        display: flex;
        gap: var(--space-sm);
        flex-wrap: wrap;
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

      .btn-danger {
        border-color: rgba(239, 68, 68, 0.35);
        color: var(--color-danger);
      }

      .empty-state, .message-card {
        text-align: center;
        padding: var(--space-2xl) var(--space-lg);
      }

      .message-card h1 {
        font-size: 2rem;
        margin-bottom: var(--space-sm);
      }

      .message-card p {
        color: var(--color-text-muted);
        margin-bottom: var(--space-lg);
      }

      .site-footer {
        border-top: 1px solid var(--color-border);
        color: var(--color-text-muted);
      }

      @media (max-width: 768px) {
        .container, .site-header-inner, .site-footer-inner {
          padding: 0 var(--space-sm);
        }

        .site-header-inner, .site-footer-inner {
          padding-top: var(--space-md);
          padding-bottom: var(--space-md);
        }

        .playlist-meta,
        .owner-controls,
        .item-card-header {
          flex-direction: column;
          align-items: flex-start;
        }

        .owner-actions {
          width: 100%;
        }

        .owner-actions .btn {
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

function renderStatusPage(status: number, title: string, message: string, canonicalUrl: string): Response {
  const html = renderDocument({
    pageTitle: `${title} — HoneyCombo`,
    metaTitle: `${title} — HoneyCombo`,
    description: message,
    canonicalUrl,
    robots: 'noindex, nofollow',
    body: `
      <section class="playlist-detail">
        <div class="message-card card">
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(message)}</p>
          <a href="/" class="btn">홈으로 돌아가기</a>
        </div>
      </section>`,
  });

  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export const onRequest: AppPagesFunction = async ({ env, request, params }) => {
  const playlistId = params.id;
  const canonicalUrl = getCanonicalUrl(playlistId);
  const playlist = await getPlaylist(env.DB, playlistId);

  if (!playlist) {
    return renderStatusPage(404, '플레이리스트를 찾을 수 없습니다', '요청하신 플레이리스트가 존재하지 않거나 삭제되었습니다.', canonicalUrl);
  }

  const cookies = parseCookies(request.headers.get('cookie') ?? '');
  const user = cookies.session ? await getSession(env.DB, cookies.session) : null;
  const isOwner = user?.id === playlist.user.id;

  if (!canViewPlaylist(playlist, user?.id)) {
    return renderStatusPage(403, '접근할 수 없는 플레이리스트입니다', '이 플레이리스트는 작성자만 볼 수 있습니다.', canonicalUrl);
  }

  const description = getDescription(playlist);
  const ownerName = getOwnerName(playlist);
  const visibleName = playlist.user.display_name?.trim()
    ? `${playlist.user.display_name} (@${playlist.user.username})`
    : `@${playlist.user.username}`;

  const html = renderDocument({
    pageTitle: `${playlist.title} — HoneyCombo`,
    metaTitle: playlist.title,
    description,
    canonicalUrl,
    robots: playlist.visibility === 'unlisted' ? 'noindex, nofollow' : undefined,
    body: `
      <article class="playlist-detail">
        <header class="playlist-header">
          <h1 class="playlist-title">${escapeHtml(playlist.title)}</h1>
          ${playlist.description ? `<p class="playlist-description">${escapeHtml(playlist.description)}</p>` : ''}
          <div class="playlist-meta">
            <span class="playlist-owner">${renderAvatar(playlist)}<span>by ${escapeHtml(visibleName)}</span></span>
            <span class="meta-text">${playlist.items.length}개 기사</span>
            <span class="badge">${escapeHtml(getVisibilityLabel(playlist))}</span>
            <time class="updated-at">최종 업데이트: ${escapeHtml(formatDate(playlist.updated_at))}</time>
          </div>
          <p class="meta-text">${escapeHtml(ownerName)}가 모은 기술 콘텐츠를 한 번에 확인해보세요.</p>
        </header>
        <section class="items">${renderItems(playlist.items)}</section>
        ${isOwner ? renderOwnerControls(playlist) : ''}
      </article>`,
    script: isOwner
      ? `<script>
          async function deletePlaylist() {
            if (!window.confirm('이 플레이리스트를 삭제할까요?')) {
              return;
            }

            try {
              const res = await fetch('/api/playlists/${encodeURIComponent(playlist.id)}', {
                method: 'DELETE',
                credentials: 'same-origin'
              });

              if (!res.ok) {
                throw new Error('플레이리스트 삭제에 실패했습니다.');
              }

              window.location.href = '/my/playlists';
            } catch (error) {
              window.alert(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
            }
          }
        </script>`
      : undefined,
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
