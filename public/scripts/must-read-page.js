// @ts-nocheck
document.addEventListener('astro:page-load', () => {
  const listNode = document.getElementById('must-read-list');
  if (!listNode) return;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  // Mirrors src/lib/render-summary.ts stripMarkdownForPreview() and functions/lib/escape.ts stripMd().
  // For structured Korean summaries (## 개요 / ## 주요 내용 / ## 시사점), returns the body of the FIRST
  // section only — the heading label is visual noise on cards.
  function stripMd(text) {
    if (!text) return '';
    var s = String(text);
    // Structured summary path: split on ## boundaries, return first non-empty body.
    if (/^##\s+/m.test(s)) {
      var sections = s.split(/(?:^|\n)##\s+[^\n]*\n?/);
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].trim()) {
          return flattenMd(sections[i]);
        }
      }
      return '';
    }
    return flattenMd(s);
  }

  function flattenMd(text) {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[-*]\s+/gm, '• ')
      .replace(/\n{2,}/g, ' ')
      .replace(/\n/g, ' ')
      // Inline markdown markers — mirror src/lib/render-summary.ts and functions/lib/escape.ts.
      .replace(/`([^`\n]+)`/g, '$1')
      // Bold uses [^\n]+? (allows internal *) so nested **outer *inner* outer** strips fully.
      .replace(/\*\*([^\n]+?)\*\*/g, '$1')
      .replace(/(^|[^*A-Za-z0-9_])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![A-Za-z0-9_])/g, '$1$2')
      .replace(/(^|[^A-Za-z0-9_])_([^_\n]+?)_(?![A-Za-z0-9_])/g, '$1$2')
      .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
      .trim();
  }

  function renderLoading() {
    listNode.innerHTML = '';

    for (let index = 0; index < 3; index += 1) {
      listNode.insertAdjacentHTML('beforeend',
        '<article class="card must-read-card skeleton-card">' +
          '<div class="must-read-rank skeleton-rank"></div>' +
          '<div class="must-read-body">' +
            '<div class="skeleton-line skeleton-title"></div>' +
            '<div class="must-read-meta"><span class="badge skeleton-badge"></span></div>' +
            '<div class="skeleton-line skeleton-text"></div>' +
            '<div class="skeleton-line skeleton-text short"></div>' +
          '</div>' +
        '</article>'
      );
    }
  }

  function renderMustReadItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div class="empty-state">📌 꼭 읽어야 할 기사 목록을 준비 중입니다.</div>';
    }

    return items.map((item, index) => {
      const itemData = item || {};
      const source = (itemData.source_snapshot && itemData.source_snapshot.trim()) || '출처 미상';
      const description = stripMd((itemData.description_snapshot && itemData.description_snapshot.trim()) || '');

      return '\n        <article class="card must-read-card">\n          <div class="must-read-rank">#' + (index + 1) + '</div>\n          <div class="must-read-body">\n            <h2 class="must-read-title">\n              <a href="' + escapeAttr(itemData.url_snapshot || '') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(itemData.title_snapshot || '') + '</a>\n            </h2>\n            <div class="must-read-meta">\n              <span class="badge">' + escapeHtml(source) + '</span>\n            </div>\n            ' + (description ? '<p class="must-read-description">' + escapeHtml(description) + '</p>' : '') + '\n          </div>\n        </article>';
    }).join('');
  }

  async function loadMustRead() {
    renderLoading();

    try {
      const response = await fetch('/api/must-read', { credentials: 'same-origin' });
      if (!response.ok) {
        throw new Error('Must-read 데이터를 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      const items = Array.isArray(data && data.items) ? data.items : [];
      listNode.innerHTML = renderMustReadItems(items);
    } catch {
      listNode.innerHTML = '<div class="empty-state">📌 꼭 읽어야 할 기사 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
    }
  }

  loadMustRead();
});
