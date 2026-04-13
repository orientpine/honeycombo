import { escapeAttr, escapeHtml } from './lib/escape';
import { renderDocument } from './lib/layout';
import { listMustReadItems } from './lib/must-read';
import type { AppPagesFunction, Env, MustReadItemRow } from './lib/types';

function getCanonicalUrl(requestUrl: string): string {
  const origin = new URL(requestUrl).origin;
  return `${origin}/must-read`;
}

function renderMustReadItems(items: MustReadItemRow[]): string {
  if (items.length === 0) {
    return '<div class="empty-state">⭐ Must-read 목록을 준비 중입니다.</div>';
  }

  return items
    .map((item, index) => {
      const source = item.source_snapshot?.trim() || '출처 미상';
      const description = item.description_snapshot?.trim() || '';

      return `
        <article class="card must-read-card">
          <div class="must-read-rank">#${index + 1}</div>
          <div class="must-read-body">
            <h2 class="must-read-title">
              <a href="${escapeAttr(item.url_snapshot)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title_snapshot)}</a>
            </h2>
            <div class="must-read-meta">
              <span class="badge">${escapeHtml(source)}</span>
            </div>
            ${description ? `<p class="must-read-description">${escapeHtml(description)}</p>` : ''}
          </div>
        </article>`;
    })
    .join('');
}

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

      .must-read-grid { display: flex; flex-direction: column; gap: var(--space-md); }
      .must-read-card { display: flex; gap: var(--space-md); align-items: flex-start; padding: var(--space-lg); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-lg); }
      .must-read-rank { font-size: 1.5rem; font-weight: 800; color: var(--color-accent); min-width: 2rem; }
      .must-read-body { flex: 1; }
      .must-read-title { font-size: 1rem; font-weight: 600; margin-bottom: var(--space-sm); }
      .must-read-title a { color: var(--color-text); text-decoration: none; }
      .must-read-title a:hover { color: var(--color-primary); }
      .must-read-meta { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
      .must-read-description { font-size: 0.85rem; color: var(--color-text-muted); margin-top: var(--space-xs); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .empty-state { text-align: center; padding: var(--space-2xl); color: var(--color-text-muted); background: var(--color-bg-secondary); border-radius: var(--radius-lg); border: 1px dashed var(--color-border); }

      @media (max-width: 768px) {
        .must-read-card {
          flex-direction: column;
        }
      }
`;

export const onRequest: AppPagesFunction = async (context: { env: Env; request: Request }) => {
  const { env, request } = context;
  let items: MustReadItemRow[] = [];

  try {
    items = await listMustReadItems(env.DB);
  } catch {
    // DB not ready or migration not applied — render empty state gracefully
  }

  const canonicalUrl = getCanonicalUrl(request.url);

  const html = renderDocument({
    pageTitle: 'Must-read — HoneyCombo',
    metaTitle: 'Must-read — HoneyCombo',
    description: '오늘 꼭 읽어야 할 기술 기사',
    canonicalUrl,
    currentPath: '/must-read',
    body: `
      <section class="page-shell">
        <header class="page-header">
          <div class="page-eyebrow">⭐ Must-read</div>
          <h1 class="page-title">⭐ Must-read</h1>
          <p class="page-description">오늘 꼭 읽어야 할 기술 기사</p>
        </header>

        <section class="must-read-grid" data-testid="must-read-list">
          ${renderMustReadItems(items)}
        </section>
      </section>`,
    styles: PAGE_STYLES,
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
