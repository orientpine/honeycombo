import { escapeAttr, escapeHtml } from './escape';

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/articles', label: 'Articles' },
  { href: '/trending', label: 'Trending' },
  { href: '/must-read', label: 'Must-read' },
  { href: '/playlists', label: 'Playlists' },
  { href: '/influencers', label: 'Influencers' },
  { href: '/submit', label: 'Submit' },
];

function isNavActive(currentPath: string, href: string): boolean {
  if (href === '/') return currentPath === '/';
  return currentPath === href || currentPath.startsWith(href);
}

function renderNavigation(currentPath: string): string {
  const links = NAV_ITEMS.map((item) => {
    const cls = isNavActive(currentPath, item.href) ? ' active' : '';
    return `<li><a href="${item.href}" class="nav-link${cls}">${item.label}</a></li>`;
  }).join('\n          ');

  return `
    <nav class="nav" data-testid="nav-main">
      <div class="container nav-inner">
        <a href="/" class="nav-logo">HONEYCOMBO</a>
        <button class="nav-toggle" id="nav-toggle" aria-label="메뉴 열기" aria-expanded="false">
          <span class="nav-toggle-bar"></span>
          <span class="nav-toggle-bar"></span>
          <span class="nav-toggle-bar"></span>
        </button>
        <ul class="nav-links" id="nav-links">
          ${links}
        </ul>
        <div id="auth-area" class="auth-area"></div>
      </div>
    </nav>`;
}

// ---------------------------------------------------------------------------
// Shared CSS — design tokens, reset, layout, navigation, footer
// ---------------------------------------------------------------------------

const BASE_STYLES = `
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

      .empty-state {
        text-align: center;
        padding: var(--space-2xl) var(--space-lg);
        color: var(--color-text-muted);
      }

      .main-content {
        padding: var(--space-xl) 0 var(--space-2xl);
      }

      .site-footer {
        border-top: 1px solid var(--color-border);
        color: var(--color-text-muted);
      }
      .site-footer-inner {
        max-width: var(--max-width);
        margin: 0 auto;
        padding: var(--space-md);
      }`;

const NAV_STYLES = `
      /* Navigation */
      .nav {
        position: sticky;
        top: 0;
        z-index: 100;
        background: var(--color-bg);
        border-bottom: 2px solid transparent;
        border-image: linear-gradient(to right, var(--color-primary), var(--color-accent)) 1;
        height: var(--nav-height);
      }
      .nav-inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 100%;
      }
      .nav-logo {
        font-size: 1.2rem;
        font-weight: 900;
        letter-spacing: 0.05em;
        background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        text-decoration: none;
      }
      .nav-logo:hover { filter: brightness(1.1); }
      .nav-toggle {
        display: none;
        flex-direction: column;
        gap: 4px;
        background: none;
        border: none;
        cursor: pointer;
        padding: var(--space-xs);
      }
      .nav-toggle-bar {
        display: block;
        width: 20px;
        height: 2px;
        background: var(--color-text);
        border-radius: 1px;
        transition: transform 0.2s, opacity 0.2s;
      }
      .nav-toggle.open .nav-toggle-bar:nth-child(1) { transform: translateY(6px) rotate(45deg); }
      .nav-toggle.open .nav-toggle-bar:nth-child(2) { opacity: 0; }
      .nav-toggle.open .nav-toggle-bar:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
      .nav-links {
        display: flex;
        list-style: none;
        gap: var(--space-sm);
      }
      .nav-link {
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--radius-sm);
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--color-text-muted);
        text-decoration: none;
        transition: background 0.15s, color 0.15s;
      }
      .nav-link:hover { background: var(--color-bg-secondary); color: var(--color-text); text-decoration: none; }
      .nav-link.active { background: var(--color-primary); color: white; }

      /* Auth Area */
      .auth-area {
        opacity: 0;
        transition: opacity 0.3s ease;
        display: flex;
        align-items: center;
      }
      .auth-area.loaded { opacity: 1; }
      .auth-user {
        position: relative;
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        cursor: pointer;
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--radius-sm);
        transition: background 0.15s;
      }
      .auth-user:hover { background: var(--color-bg-secondary); }
      .auth-user::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        top: 100%;
        height: var(--space-xs);
      }
      .auth-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
      .auth-username { font-size: 0.9rem; font-weight: 500; color: var(--color-text); }
      .auth-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: var(--space-xs);
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-md);
        min-width: 150px;
        display: none;
        flex-direction: column;
        padding: var(--space-xs) 0;
        z-index: 10;
      }
      .auth-user:hover .auth-dropdown { display: flex; }
      .auth-dropdown-item {
        padding: var(--space-sm) var(--space-md);
        font-size: 0.9rem;
        color: var(--color-text);
        text-decoration: none;
        background: none;
        border: none;
        text-align: left;
        cursor: pointer;
        width: 100%;
      }
      .auth-dropdown-item:hover { background: var(--color-bg-secondary); text-decoration: none; }
      .auth-dropdown-item.text-danger { color: var(--color-danger); }
      .auth-dropdown-admin {
        border-top: 1px solid var(--color-border);
        margin-top: var(--space-xs);
        padding-top: var(--space-sm);
        color: var(--color-primary);
        font-weight: 600;
      }
      .auth-login-btn {
        padding: var(--space-xs) var(--space-md);
        background: var(--color-primary);
        color: white;
        border-radius: var(--radius-sm);
        font-size: 0.9rem;
        font-weight: 500;
        text-decoration: none;
        transition: background 0.15s;
      }
      .auth-login-btn:hover { background: var(--color-primary-hover); color: white; text-decoration: none; }`;

const RESPONSIVE_STYLES = `
      @media (max-width: 768px) {
        .grid-3 { grid-template-columns: 1fr; }
        .container { padding: 0 var(--space-sm); }
        .nav { height: auto; min-height: var(--nav-height); }
        .nav-inner { flex-wrap: wrap; padding-top: var(--space-sm); padding-bottom: var(--space-sm); }
        .nav-toggle { display: flex; }
        .nav-links {
          display: none;
          flex-direction: column;
          width: 100%;
          padding-top: var(--space-sm);
          gap: 2px;
        }
        .nav-links.open { display: flex; }
        .nav-link { padding: var(--space-sm); }
        .auth-area { margin-left: auto; margin-right: var(--space-md); }
        .site-footer-inner { padding: var(--space-md) var(--space-sm); }
      }`;

// ---------------------------------------------------------------------------
// Navigation script — hamburger toggle + auth area
// ---------------------------------------------------------------------------

const NAV_SCRIPT = `<script>
      (function() {
        var navToggle = document.getElementById('nav-toggle');
        if (navToggle) {
          navToggle.addEventListener('click', function() {
            var links = document.getElementById('nav-links');
            if (links) {
              var isOpen = links.classList.toggle('open');
              navToggle.classList.toggle('open', isOpen);
              navToggle.setAttribute('aria-expanded', String(isOpen));
            }
          });
        }

        document.addEventListener('DOMContentLoaded', async function() {
          var authArea = document.getElementById('auth-area');
          if (!authArea) return;

          try {
            var res = await fetch('/api/auth/me');
            if (res.ok) {
              var user = await res.json();
              var avatarUrl = user.avatar_url ? user.avatar_url : '/default-avatar.png';
              authArea.innerHTML =
                '<div class="auth-user">' +
                  '<img src="' + avatarUrl + '" alt="' + user.username + '" class="auth-avatar" />' +
                  '<span class="auth-username">' + user.username + '</span>' +
                  '<div class="auth-dropdown">' +
                    '<a href="/my/playlists" class="auth-dropdown-item">내 플레이리스트</a>' +
                    (user.is_admin
                      ? '<a href="/admin/must-read" class="auth-dropdown-item auth-dropdown-admin">⭐ Must-read 관리</a>' +
                        '<a href="/admin/playlists" class="auth-dropdown-item auth-dropdown-admin">🛡️ 플레이리스트 관리</a>' +
                        '<a href="/admin" class="auth-dropdown-item auth-dropdown-admin">🛡️ 기사 검토 (CMS)</a>'
                      : '') +
                    '<button id="logout-btn" class="auth-dropdown-item text-danger">로그아웃</button>' +
                  '</div>' +
                '</div>';

              var logoutBtn = document.getElementById('logout-btn');
              if (logoutBtn) {
                logoutBtn.addEventListener('click', async function() {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  window.location.reload();
                });
              }
            } else {
              authArea.innerHTML = '<a href="/api/auth/github/login" class="auth-login-btn">로그인</a>';
            }
          } catch (err) {
            authArea.innerHTML = '<a href="/api/auth/github/login" class="auth-login-btn">로그인</a>';
          } finally {
            authArea.classList.add('loaded');
          }
        });
      })();
    </script>`;

// ---------------------------------------------------------------------------
// Document renderer
// ---------------------------------------------------------------------------

export interface LayoutOptions {
  pageTitle: string;
  metaTitle: string;
  description: string;
  canonicalUrl: string;
  /** Used to highlight the active nav link */
  currentPath: string;
  robots?: string;
  ogType?: string;
  body: string;
  /** Page-specific CSS appended after shared styles */
  styles?: string;
  /** Page-specific <script> tags inserted before </body> */
  script?: string;
}

export function renderDocument(options: LayoutOptions): string {
  const {
    pageTitle,
    metaTitle,
    description,
    canonicalUrl,
    currentPath,
    robots,
    ogType = 'website',
    body,
    styles,
    script,
  } = options;

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
    <meta property="og:type" content="${escapeAttr(ogType)}">
    <meta property="og:site_name" content="HoneyCombo">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(metaTitle)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    ${robots ? `<meta name="robots" content="${escapeAttr(robots)}">` : ''}
    <style>
${BASE_STYLES}
${NAV_STYLES}
${RESPONSIVE_STYLES}
${styles ?? ''}
    </style>
  </head>
  <body>
    ${renderNavigation(currentPath)}
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
    ${NAV_SCRIPT}
    ${script ?? ''}
  </body>
</html>`;
}
