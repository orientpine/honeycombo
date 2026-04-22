import { getSession } from '../lib/auth';
import { parseCookies } from '../lib/cookies';
import { escapeAttr, escapeHtml, stripMd } from '../lib/escape';
import { renderDocument } from '../lib/layout';
import { getLikeStatus } from '../lib/likes';
import { getPlaylist } from '../lib/playlists';
import type { AppPagesFunction, LikeStatusResponse, PlaylistDetail, PlaylistItemRow } from '../lib/types';

function getCanonicalUrl(requestUrl: string, playlistId: string): string {
  const origin = new URL(requestUrl).origin;
  return `${origin}/p/${encodeURIComponent(playlistId)}`;
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
  if (item.item_type === 'external') return item.url_snapshot;
  // Both curated and feed items with source_id link to internal article pages
  if (item.source_id) return `/articles/${item.source_id}`;
  // Fallback to external URL when no source_id
  return item.url_snapshot;
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (hostname === 'youtube.com' || hostname === 'youtube-nocookie.com') {
      // /watch?v=ID, /embed/ID, /shorts/ID, /live/ID, /v/ID
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
      const pathMatch = parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/);
      if (pathMatch) return pathMatch[1];
    }
  } catch {}
  return null;
}

function getYouTubeThumbnailUrl(url: string): string | null {
  const videoId = extractYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
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

function renderItems(items: PlaylistItemRow[], isOwner: boolean, playlistId: string): string {
  if (items.length === 0) {
    return '<p class="empty-state">이 플레이리스트에 아직 기사가 없습니다.</p>';
  }

  return items
    .map((item, index) => {
      const href = getItemHref(item);
      const title = item.title_snapshot.trim() || '제목 없음';
      const note = item.note?.trim();
      const sourceLabel = getItemMetaLabel(item);
      const domain = getItemDomain(item.url_snapshot);
      const isExternal = item.item_type === 'external' || !item.source_id;
      const thumbnail = getYouTubeThumbnailUrl(item.url_snapshot);
      const ownerControls = isOwner
        ? `
          <div class="item-controls">
            <button class="btn btn-sm btn-danger item-delete" data-item-id="${escapeAttr(item.id)}" title="삭제">삭제</button>
            <div class="item-note-edit">
              <button class="btn btn-sm item-edit-note" data-item-id="${escapeAttr(item.id)}" data-note="${escapeAttr(item.note || '')}" data-playlist-id="${escapeAttr(playlistId)}">
                ${item.note ? '💬 메모 수정' : '💬 메모 추가'}
              </button>
            </div>
          </div>`
        : '';

      return `
        <article class="item-card card" data-item-id="${escapeAttr(item.id)}" data-position="${item.position}">
          ${isOwner ? `<div class="drag-handle" aria-label="드래그하여 순서 변경"></div>` : ''}
          ${thumbnail ? `<div class="item-thumbnail"><img src="${escapeAttr(thumbnail)}" alt="" loading="lazy" width="160" height="90" /></div>` : ''}
          <div class="item-body">
            <h2 class="item-title">
              <a href="${escapeAttr(href)}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(title)}</a>
            </h2>
            <div class="item-card-footer">
              <span class="badge badge-sm">${escapeHtml(sourceLabel)}</span>
              ${isExternal ? `<span class="item-domain">${escapeHtml(domain)}</span>` : ''}
            </div>
            ${note ? `<p class="item-note">💬 ${escapeHtml(note)}</p>` : ''}
            ${ownerControls}
          </div>
        </article>`;
    })
    .join('');
}

function renderOwnerControls(playlist: PlaylistDetail): string {
  const isUnlisted = playlist.visibility === 'unlisted';
  const isPublicDraft = playlist.visibility === 'public' && playlist.status === 'draft';
  const isPending = playlist.visibility === 'public' && playlist.status === 'pending';
  const isApproved = playlist.visibility === 'public' && playlist.status === 'approved';
  const isRejected = playlist.visibility === 'public' && playlist.status === 'rejected';

  let visibilityTitle = '';
  let visibilityDesc = '';
  let visibilityBtnLabel = '';
  let visibilityBtnAction = '';
  let visibilityBtnClass = 'btn';

  if (playlist.playlist_type === 'editor') {
    // Editor playlists are always public and approved, no visibility controls needed
    visibilityTitle = '';
  } else if (isUnlisted || isPublicDraft) {
    visibilityTitle = '\uD83C\uDF10 \uACF5\uAC1C \uC2E0\uCCAD';
    visibilityDesc = '\uC774 \uD50C\uB808\uC774\uB9AC\uC2A4\uD2B8\uB97C \uCEE4\uBBA4\uB2C8\uD2F0\uC5D0 \uACF5\uAC1C \uC2E0\uCCAD\uD569\uB2C8\uB2E4. \uC5D0\uB514\uD130 \uC2B9\uC778 \uD6C4 \uACF5\uAC1C\uB429\uB2C8\uB2E4.';
    visibilityBtnLabel = '\uACF5\uAC1C \uC2E0\uCCAD';
    visibilityBtnAction = 'public';
    visibilityBtnClass = 'btn btn-visibility';
  } else if (isPending) {
    visibilityTitle = '\u23F3 \uC2B9\uC778 \uB300\uAE30 \uC911';
    visibilityDesc = '\uC5D0\uB514\uD130 \uC2B9\uC778\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC2B5\uB2C8\uB2E4.';
    visibilityBtnLabel = '\uBE44\uACF5\uAC1C\uB85C \uC804\uD658';
    visibilityBtnAction = 'unlisted';
  } else if (isApproved) {
    visibilityTitle = '\u2705 \uACF5\uAC1C \uC911';
    visibilityDesc = '\uC774 \uD50C\uB808\uC774\uB9AC\uC2A4\uD2B8\uB294 \uCEE4\uBBA4\uB2C8\uD2F0\uC5D0 \uACF5\uAC1C\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.';
    visibilityBtnLabel = '\uBE44\uACF5\uAC1C\uB85C \uC804\uD658';
    visibilityBtnAction = 'unlisted';
  } else if (isRejected) {
    visibilityTitle = '\u274C \uBC18\uB824\uB428';
    visibilityDesc = '\uACF5\uAC1C \uC2E0\uCCAD\uC774 \uBC18\uB824\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC218\uC815 \uD6C4 \uC7AC\uC2E0\uCCAD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.';
    visibilityBtnLabel = '\uC7AC\uC2E0\uCCAD';
    visibilityBtnAction = 'public';
    visibilityBtnClass = 'btn btn-visibility';
  }
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
    </section>
    ${visibilityTitle ? `
    <section class="visibility-section card">
      <div>
        <h2>${visibilityTitle}</h2>
        <p>${visibilityDesc}</p>
      </div>
      <button type="button" class="${visibilityBtnClass}" onclick="toggleVisibility('${visibilityBtnAction}')">${escapeHtml(visibilityBtnLabel)}</button>
    </section>` : ''}
    <section class="tag-editor-section card" data-initial-tags="${escapeAttr(JSON.stringify(playlist.tags || []))}">
      <div>
        <h2>🏷️ 태그 편집</h2>
        <p class="tag-editor-desc">플레이리스트를 분류할 태그를 관리하세요. 최대 5개까지 추가할 수 있습니다.</p>
      </div>
      <div class="tag-editor-tags" id="tag-editor-tags" aria-live="polite"></div>
      <div class="tag-editor-input-row">
        <input
          type="text"
          id="tag-editor-input"
          class="tag-editor-input"
          placeholder="태그 입력 후 Enter (최대 5개)"
          maxlength="30"
          autocomplete="off"
        />
        <button type="button" id="tag-save-btn" class="tag-save-btn" disabled aria-label="태그 변경 사항 저장">저장</button>
      </div>
      <div id="tag-editor-feedback" class="tag-editor-feedback" role="status" aria-live="polite"></div>
      <div class="tag-editor-hint">쉼표(,) 또는 Enter로 태그를 추가하세요. # 기호는 자동으로 제거됩니다.</div>
    </section>
    <section class="article-search-section">
      <h2>기사 추가</h2>
      <div class="search-box">
        <input type="text" class="search-input" placeholder="기사 제목으로 검색..." />
      </div>
      <div class="search-results" style="display:none;"></div>
    </section>
    <section class="external-url-section">
      <button class="btn toggle-external-form">➕ 외부 URL 추가</button>
      <form class="external-url-form" style="display:none;">
        <input type="url" name="url" placeholder="https://example.com/article" required class="search-input" />
        <input type="text" name="title" placeholder="제목" required class="search-input" />
        <textarea name="description" placeholder="설명 (선택)" class="search-input" style="min-height:60px;resize:vertical;"></textarea>
        <div style="display:flex;gap:var(--space-xs);">
          <button type="submit" class="btn btn-sm" style="background:var(--color-primary);color:white;">추가</button>
          <button type="button" class="btn btn-sm external-cancel">취소</button>
        </div>
      </form>
    </section>`;
}

// ---------------------------------------------------------------------------
// Page-specific styles (layout/nav/footer/base styles come from shared layout)
// ---------------------------------------------------------------------------

const PAGE_STYLES = `
      .badge-editor {
        background: rgba(245, 158, 11, 0.1);
        color: #d97706;
        border-color: rgba(245, 158, 11, 0.2);
      }

      .playlist-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
        margin-bottom: var(--space-md);
      }

      .tag {
        font-size: 0.8rem;
        padding: 2px 10px;
        background: var(--color-bg-secondary);
        color: var(--color-text-muted);
        border-radius: 999px;
        border: 1px solid var(--color-border);
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

      .like-section {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        margin-top: var(--space-sm);
        flex-wrap: wrap;
      }

      .like-count-display {
        color: var(--color-text-muted);
        font-weight: 600;
      }

      /* Modern like button — same pill design as /trending for site-wide consistency */
      .like-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        min-height: 2.25rem;
        padding: 0.5rem 1rem;
        border: 1px solid var(--color-like-default-border);
        border-radius: 999px;
        background: var(--color-bg);
        /* Base color drives the label; icon has its own tint (avoids "dead gray" look). */
        color: var(--color-like-default-count);
        font-family: inherit;
        font-size: 0.9rem;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        transition: color 0.18s cubic-bezier(0.4, 0, 0.2, 1),
                    background 0.18s cubic-bezier(0.4, 0, 0.2, 1),
                    border-color 0.18s cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 0.18s cubic-bezier(0.4, 0, 0.2, 1),
                    transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .like-btn:hover:not(:disabled) {
        color: var(--color-like-hover-text);
        border-color: var(--color-like-hover-border);
        background: var(--color-like-hover-bg);
        transform: translateY(-1px);
        box-shadow: var(--shadow-sm);
      }

      .like-btn:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: none;
      }

      .like-btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .like-btn.is-liked {
        background: linear-gradient(135deg, var(--color-like-gradient-from) 0%, var(--color-like-gradient-to) 100%);
        border-color: transparent;
        color: var(--color-like-contrast-text);
        box-shadow: var(--shadow-like);
      }

      .like-btn.is-liked:hover:not(:disabled) {
        color: var(--color-like-contrast-text);
        background: linear-gradient(135deg, var(--color-like-gradient-from-hover) 0%, var(--color-like-gradient-to-hover) 100%);
        border-color: transparent;
        box-shadow: var(--shadow-like-hover);
        transform: translateY(-1px);
      }

      .like-btn:disabled {
        opacity: 0.6;
        cursor: wait;
        transform: none;
      }

      .like-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        color: var(--color-like-default-icon);
        transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1);
      }
      /* On hover the button color shifts to hover-text; the icon joins in. */
      .like-btn:hover:not(:disabled) .like-icon {
        color: inherit;
      }
      .like-icon svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .like-icon .icon-filled {
        display: none;
      }
      /* Liked state: the icon must inherit the button color so it reads as
         white against the pink gradient (otherwise the rose default-icon
         tint blends into the gradient and the heart disappears). */
      .like-btn.is-liked .like-icon {
        color: inherit;
      }
      .like-btn.is-liked .icon-outline {
        display: none;
      }
      .like-btn.is-liked .icon-filled {
        display: block;
        animation: like-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes like-pop {
        0% { transform: scale(1); }
        40% { transform: scale(1.35); }
        100% { transform: scale(1); }
      }

      @media (prefers-reduced-motion: reduce) {
        .like-btn,
        .like-icon,
        .like-btn.is-liked .icon-filled {
          transition: none;
          animation: none;
        }
        .like-btn:hover:not(:disabled) {
          transform: none;
        }
      }

      .items {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-md);
        margin-top: var(--space-lg);
      }

      /* Batch edit toolbar */
      .items-toolbar {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: var(--space-sm);
        margin-bottom: var(--space-md);
        min-height: 2.25rem; /* prevent layout shift when switching modes */
      }
      /* Restore [hidden] behavior: .batch-edit-btn uses .btn's
         display: inline-flex, and .batch-action-bar sets display: flex,
         both of which override the user-agent [hidden] rule. We re-apply
         display: none when the attribute is present so that clicking 배치
         편집 actually hides it and reveals the action bar (and vice versa). */
      .batch-edit-btn[hidden],
      .batch-action-bar[hidden] {
        display: none !important;
      }
      .batch-action-bar {
        display: flex;
        gap: var(--space-sm);
        align-items: center;
        /* Subtle entrance when the action bar appears after clicking 배치
           편집. The button that hides is replaced without layout jump thanks
           to .items-toolbar min-height. */
        animation: batch-action-bar-in 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes batch-action-bar-in {
        from {
          opacity: 0;
          transform: translateX(6px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .batch-action-bar {
          animation: none;
        }
      }
      .batch-edit-btn,
      .batch-cancel-btn,
      .batch-save-btn {
        cursor: pointer;
        transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .batch-edit-btn:focus-visible,
      .batch-cancel-btn:focus-visible,
      .batch-save-btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .batch-save-btn {
        background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
        color: white;
        border: none;
        box-shadow: 0 4px 14px rgba(245, 124, 34, 0.3);
      }
      .batch-save-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(245, 124, 34, 0.4);
        color: white;
      }
      .batch-save-btn:disabled {
        opacity: 0.7;
        cursor: wait;
        transform: none;
      }

      /* Drag handle (§4.8) */
      .drag-handle {
        display: none;
        flex-shrink: 0;
        width: 24px;
        align-items: center;
        justify-content: center;
        cursor: grab;
        color: var(--color-text-muted);
        transition: color 0.15s ease-out;
        user-select: none;
        touch-action: none;
      }
      .drag-handle::before {
        content: '⋮⋮';
        font-size: 1.1rem;
        letter-spacing: 2px;
        line-height: 1;
      }
      .drag-handle:hover {
        color: var(--color-primary);
      }

      /* Batch edit mode container (§4.9) */
      .batch-edit-mode {
        border: 2px dashed var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--space-md);
        background: var(--color-bg-secondary);
        grid-template-columns: 1fr;
      }
      .batch-edit-mode .drag-handle {
        display: flex;
      }
      .batch-edit-mode .item-title a {
        pointer-events: none;
        color: var(--color-text-muted);
      }
      .batch-edit-mode .item-controls {
        display: none;
      }

      /* SortableJS drag states (§6 L9) */
      .sortable-ghost {
        opacity: 0.35;
        border: 2px dashed var(--color-primary);
      }
      .sortable-chosen {
        box-shadow: var(--shadow-md);
        transform: scale(1.02) rotate(1deg);
        cursor: grabbing;
      }
      .sortable-drag {
        opacity: 0.9;
      }

      .item-card {
        display: flex;
        flex-direction: row;
        gap: var(--space-md);
        overflow: hidden;
      }

      .item-thumbnail {
        flex-shrink: 0;
        width: 140px;
        margin: calc(-1 * var(--space-md)) 0 calc(-1 * var(--space-md)) calc(-1 * var(--space-md));
        overflow: hidden;
      }

      .item-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .item-card:hover .item-thumbnail img {
        transform: scale(1.05);
      }

      .item-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        flex: 1;
        min-width: 0;
      }

      .item-card-footer {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        flex-wrap: wrap;
      }

      .badge-sm {
        font-size: 0.7rem;
        padding: 1px 6px;
        white-space: nowrap;
      }

      .item-title {
        font-size: 0.95rem;
        font-weight: 600;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .item-title a {
        color: var(--color-text);
      }

      .item-title a:hover {
        color: var(--color-primary);
        text-decoration: none;
      }

      .item-domain, .meta-text, .updated-at {
        color: var(--color-text-muted);
        font-size: 0.75rem;
      }

      .item-note {
        padding: var(--space-xs) var(--space-sm);
        background: var(--color-bg-secondary);
        border-radius: var(--radius-sm);
        color: var(--color-text-muted);
        font-size: 0.85rem;
      }

      .item-controls {
        margin-top: var(--space-sm);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-sm);
      }

      .item-control-row {
        display: flex;
        gap: var(--space-xs);
      }

      .btn-sm {
        padding: var(--space-xs) var(--space-sm);
        font-size: 0.8rem;
      }

      .item-note-edit {
        display: flex;
        justify-content: flex-end;
      }

      .note-editor {
        margin-top: var(--space-sm);
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .note-editor textarea {
        width: 100%;
        min-height: 60px;
        padding: var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        font: inherit;
        font-size: 0.9rem;
        resize: vertical;
        background: var(--color-bg);
        color: var(--color-text);
      }

      .note-editor-actions {
        display: flex;
        gap: var(--space-xs);
        justify-content: flex-end;
      }

      .item-card.removing {
        opacity: 0;
        transition: opacity 0.3s;
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

      .visibility-section {
        margin-top: var(--space-md);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: var(--space-md);
      }

      .visibility-section h2 {
        font-size: 1.1rem;
        margin-bottom: var(--space-xs);
      }

      .visibility-section p {
        color: var(--color-text-muted);
      }

      .btn-visibility {
        background: rgba(245, 124, 34, 0.1);
        color: var(--color-primary);
        border-color: rgba(245, 124, 34, 0.2);
        white-space: nowrap;
      }

      .btn-visibility:hover {
        background: rgba(245, 124, 34, 0.2);
      }

      .btn-danger {
        border-color: rgba(239, 68, 68, 0.35);
        color: var(--color-danger);
      }

      .tag-editor-section {
        margin-top: var(--space-md);
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }

      .tag-editor-section h2 {
        font-size: 1.1rem;
        margin-bottom: var(--space-xs);
      }

      .tag-editor-section .tag-editor-desc {
        color: var(--color-text-muted);
        font-size: 0.9rem;
        margin-bottom: var(--space-sm);
      }

      .tag-editor-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
        min-height: 1.75rem;
        align-items: center;
      }

      .tag-editor-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 4px 2px var(--space-sm);
        background: var(--color-bg-secondary);
        color: var(--color-text-muted);
        border: 1px solid var(--color-border);
        border-radius: 999px;
        font-size: 0.8rem;
        transition: background 0.15s ease-out, color 0.15s ease-out, border-color 0.15s ease-out;
      }

      .tag-editor-tag-remove {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0 4px;
        font-size: 1.05rem;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        border-radius: var(--radius-sm);
        transition: color 0.15s ease-out, background 0.15s ease-out;
      }

      .tag-editor-tag-remove:hover {
        color: var(--color-danger);
      }

      .tag-editor-tag-remove:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .tag-editor-empty {
        color: var(--color-text-muted);
        font-size: 0.85rem;
        font-style: italic;
        padding: var(--space-xs) 0;
      }

      .tag-editor-input-row {
        display: flex;
        gap: var(--space-sm);
        align-items: stretch;
      }

      .tag-editor-input {
        flex: 1;
        min-width: 0;
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font: inherit;
        font-size: 0.95rem;
        background: var(--color-bg);
        color: var(--color-text);
        transition: border-color 0.15s ease-out, box-shadow 0.15s ease-out;
      }

      .tag-editor-input:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(245, 124, 34, 0.15);
      }

      .tag-save-btn {
        padding: var(--space-sm) var(--space-lg);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-bg);
        color: var(--color-text-muted);
        font: inherit;
        font-size: 0.9rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease-out, color 0.15s ease-out, border-color 0.15s ease-out, transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease-out;
        white-space: nowrap;
      }

      .tag-save-btn:hover:not(:disabled) {
        background: var(--color-bg-secondary);
      }

      .tag-save-btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }

      .tag-save-btn.has-changes {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: white;
        box-shadow: 0 2px 8px rgba(245, 124, 34, 0.25);
      }

      .tag-save-btn.has-changes:hover:not(:disabled) {
        background: var(--color-primary-hover);
        border-color: var(--color-primary-hover);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(245, 124, 34, 0.35);
      }

      .tag-save-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .tag-editor-feedback {
        font-size: 0.85rem;
        min-height: 1.25rem;
      }

      .tag-editor-feedback.is-error {
        color: var(--color-danger);
      }

      .tag-editor-feedback.is-success {
        color: var(--color-success);
      }

      .tag-editor-hint {
        font-size: 0.8rem;
        color: var(--color-text-muted);
      }

      .article-search-section {
        margin-top: var(--space-xl);
        padding-top: var(--space-xl);
        border-top: 1px solid var(--color-border);
      }

      .article-search-section h2 {
        font-size: 1.2rem;
        font-weight: 700;
        margin-bottom: var(--space-md);
      }

      .search-input {
        width: 100%;
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font: inherit;
        font-size: 0.95rem;
        background: var(--color-bg);
        color: var(--color-text);
      }

      .search-input:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      .search-results {
        margin-top: var(--space-md);
        display: grid;
        gap: var(--space-sm);
      }

      .search-result-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .search-result-meta {
        display: flex;
        gap: var(--space-xs);
      }

      .search-result-title {
        font-size: 0.95rem;
        font-weight: 600;
      }

      .search-result-desc {
        font-size: 0.85rem;
        color: var(--color-text-muted);
      }

      .search-add-btn {
        align-self: flex-start;
        background: var(--color-primary);
        color: white;
        border: none;
      }

      .search-add-btn:disabled {
        background: var(--color-bg-secondary);
        color: var(--color-text-muted);
      }

      .search-empty {
        color: var(--color-text-muted);
        text-align: center;
        padding: var(--space-md);
      }

      .external-url-section {
        margin-top: var(--space-lg);
      }

      .toggle-external-form {
        background: none;
        color: var(--color-primary);
        border: 1px dashed var(--color-border);
        width: 100%;
        padding: var(--space-sm);
        cursor: pointer;
        font-size: 0.9rem;
      }

      .toggle-external-form:hover {
        border-color: var(--color-primary);
      }

      .message-card {
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

      @media (max-width: 768px) {
        .items {
          grid-template-columns: 1fr;
        }

        .item-thumbnail {
          width: 100px;
        }

        .playlist-meta,
        .owner-controls,
        .visibility-section {
          flex-direction: column;
          align-items: flex-start;
        }

        .owner-actions {
          width: 100%;
        }

        .owner-actions .btn {
          width: 100%;
        }
        .tag-editor-input-row {
          flex-direction: column;
        }

        .tag-save-btn {
          width: 100%;
        }

      }
`;


function renderStatusPage(status: number, title: string, message: string, canonicalUrl: string): Response {
  const html = renderDocument({
    pageTitle: `${title} — HoneyCombo`,
    metaTitle: `${title} — HoneyCombo`,
    description: message,
    canonicalUrl,
    currentPath: '',
    robots: 'noindex, nofollow',
    styles: PAGE_STYLES,
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

  // /p/new is a static Astro page — delegate to static asset serving
  if (playlistId === 'new') {
    return env.ASSETS.fetch(request);
  }

  const canonicalUrl = getCanonicalUrl(request.url, playlistId);
  const playlist = await getPlaylist(env.DB, playlistId);

  if (!playlist) {
    return renderStatusPage(404, '플레이리스트를 찾을 수 없습니다', '요청하신 플레이리스트가 존재하지 않거나 삭제되었습니다.', canonicalUrl);
  }

  const cookies = parseCookies(request.headers.get('cookie') ?? '');
  const user = cookies.session ? await getSession(env.DB, cookies.session) : null;
  const isOwner = user?.id === playlist.user.id;

  // Like status (only for public+approved playlists)
  let likeStatus: LikeStatusResponse | null = null;
  const isPublicApproved = playlist.visibility === 'public' && playlist.status === 'approved';
  if (isPublicApproved) {
    likeStatus = await getLikeStatus(env.DB, playlistId, user?.id);
  }

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
    currentPath: `/p/${playlistId}`,
    ogType: 'article',
    robots: playlist.visibility === 'unlisted' ? 'noindex, nofollow' : undefined,
    styles: PAGE_STYLES,
    body: `
      <article class="playlist-detail">
        <header class="playlist-header">
          <h1 class="playlist-title">${escapeHtml(playlist.title)}</h1>
          ${playlist.description ? `<p class="playlist-description">${escapeHtml(playlist.description)}</p>` : ''}
          <div class="playlist-meta">
            <span class="playlist-owner">${renderAvatar(playlist)}<span>by ${escapeHtml(visibleName)}</span></span>
            <span class="meta-text">${playlist.items.length}개 기사</span>
            <span class="badge">${escapeHtml(getVisibilityLabel(playlist))}</span>
            ${playlist.playlist_type === 'editor' ? '<span class="badge badge-editor">🏷️ 에디터 큐레이션</span>' : ''}
            <time class="updated-at">최종 업데이트: ${escapeHtml(formatDate(playlist.updated_at))}</time>
          </div>
          ${likeStatus ? `
            <div class="like-section">
              <span class="like-count-display">❤️ ${likeStatus.like_count}명이 좋아합니다</span>
              <button type="button"
                class="like-btn${likeStatus.liked ? ' is-liked' : ''}"
                data-playlist-id="${escapeAttr(playlist.id)}"
                data-liked="${likeStatus.liked ? 'true' : 'false'}"
                data-like-count="${likeStatus.like_count}"
                data-authenticated="${user ? 'true' : 'false'}"
                aria-pressed="${likeStatus.liked ? 'true' : 'false'}"
                aria-label="${likeStatus.liked ? '좋아요 취소' : '좋아요'} (현재 ${likeStatus.like_count}명)">
                <span class="like-icon" aria-hidden="true">
                  <svg class="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                  <svg class="icon-filled" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </span>
                <span class="like-btn-label">${likeStatus.liked ? '좋아요 취소' : '좋아요'}</span>
              </button>
            </div>
          ` : ''}
          ${playlist.tags && playlist.tags.length > 0 ? `<div class="playlist-tags">${playlist.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          <p class="meta-text">${escapeHtml(ownerName)}가 모은 기술 콘텐츠를 한 번에 확인해보세요.</p>
        </header>
        ${isOwner && playlist.items.length > 1 ? `
          <div class="items-toolbar">
            <button type="button" class="btn btn-sm batch-edit-btn" id="batch-edit-btn">📋 배치 편집</button>
            <div class="batch-action-bar" id="batch-action-bar" hidden>
              <button type="button" class="btn btn-sm batch-cancel-btn" id="batch-cancel-btn">취소</button>
              <button type="button" class="btn btn-sm btn-primary batch-save-btn" id="batch-save-btn">저장</button>
            </div>
          </div>
        ` : ''}
        <section class="items" id="items-container">${renderItems(playlist.items, isOwner, playlist.id)}</section>
        ${isOwner ? renderOwnerControls(playlist) : ''}
      </article>`,
    script: [
      likeStatus ? `<script>
          (function() {
            const likeBtn = document.querySelector('.like-btn');
            if (!likeBtn) return;

            const loginUrl = '/api/auth/github/login?return_to=' + encodeURIComponent(window.location.pathname);

            likeBtn.addEventListener('click', async function() {
              const playlistId = likeBtn.dataset.playlistId;
              const isAuthenticated = likeBtn.dataset.authenticated === 'true';

              if (!isAuthenticated) {
                window.location.href = loginUrl;
                return;
              }

              const prevLiked = likeBtn.dataset.liked === 'true';
              const prevCount = Number(likeBtn.dataset.likeCount || '0');
              const nextLiked = !prevLiked;
              const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

              likeBtn.disabled = true;
              updateLikeBtn(nextLiked, nextCount);

              try {
                const res = await fetch('/api/playlists/' + encodeURIComponent(playlistId) + '/like', {
                  method: 'POST',
                  credentials: 'same-origin'
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                updateLikeBtn(Boolean(data.liked), Number(data.like_count || 0));
              } catch {
                updateLikeBtn(prevLiked, prevCount);
                window.alert('좋아요 처리에 실패했습니다.');
              } finally {
                likeBtn.disabled = false;
              }
            });

            function updateLikeBtn(liked, count) {
              likeBtn.dataset.liked = liked ? 'true' : 'false';
              likeBtn.dataset.likeCount = String(count);
              likeBtn.classList.toggle('is-liked', liked);
              likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
              likeBtn.setAttribute('aria-label', (liked ? '좋아요 취소' : '좋아요') + ' (현재 ' + count + '명)');
              const label = likeBtn.querySelector('.like-btn-label');
              if (label) label.textContent = liked ? '좋아요 취소' : '좋아요';
              const countEl = document.querySelector('.like-count-display');
              if (countEl) countEl.textContent = '❤️ ' + count + '명이 좋아합니다';
            }
          })();
        </script>` : '',
      isOwner ? `<script>
          const playlistId = '${encodeURIComponent(playlist.id)}';

          async function deletePlaylist() {
            if (!window.confirm('이 플레이리스트를 삭제할까요?')) {
              return;
            }

            const delBtn = document.querySelector('.owner-controls .btn-danger');
            if (delBtn) { delBtn.disabled = true; delBtn.textContent = '삭제 중...'; }
            try {
              const res = await fetch('/api/playlists/' + playlistId, {
                method: 'DELETE',
                credentials: 'same-origin'
              });

              if (!res.ok) {
                throw new Error('플레이리스트 삭제에 실패했습니다.');
              }

              window.location.href = '/my/playlists';
            } catch (error) {
              if (delBtn) { delBtn.disabled = false; delBtn.textContent = '삭제'; }
              window.alert(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
            }
          }

          async function toggleVisibility(visibility) {
            const label = visibility === 'public' ? '\uACF5\uAC1C \uC2E0\uCCAD' : '\uBE44\uACF5\uAC1C \uC804\uD658';
            if (!window.confirm(label + '\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?' + (visibility === 'public' ? '\\n\uC5D0\uB514\uD130 \uC2B9\uC778 \uD6C4 \uACF5\uAC1C\uB429\uB2C8\uB2E4.' : ''))) {
              return;
            }

            const visBtn = document.querySelector('.visibility-section button');
            if (visBtn) { visBtn.disabled = true; visBtn.textContent = '\uCC98\uB9AC \uC911...'; }

            try {
              const res = await fetch('/api/playlists/' + playlistId + '/visibility', {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visibility: visibility })
              });

              if (!res.ok) {
                const data = await res.json().catch(function() { return {}; });
                throw new Error(data.error || label + '\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
              }

              window.location.reload();
            } catch (error) {
              if (visBtn) { visBtn.disabled = false; visBtn.textContent = label; }
              window.alert(error instanceof Error ? error.message : '\uC54C \uC218 \uC5C6\uB294 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.');
            }
          }

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

          function updateItemCount(delta) {
            var el = document.querySelector('.playlist-meta .meta-text');
            if (el) {
              var m = el.textContent.match(/(\\d+)/);
              if (m) { el.textContent = Math.max(0, parseInt(m[1], 10) + delta) + '개 기사'; }
            }
          }

          let searchIndex = null;

          const searchInput = document.querySelector('.search-input');
          const searchResults = document.querySelector('.search-results');
          const toggleBtn = document.querySelector('.toggle-external-form');
          const extForm = document.querySelector('.external-url-form');
          const cancelBtn = document.querySelector('.external-cancel');

          if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
              clearTimeout(debounceTimer);
              debounceTimer = window.setTimeout(() => handleSearch(e.target.value), 300);
            });
          }

          async function addPlaylistItem(payload) {
            const res = await fetch('/api/playlists/' + playlistId + '/items', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            return res;
          }

          async function handleSearch(query) {
            if (!searchResults) {
              return;
            }

            if (!query || query.length < 2) {
              searchResults.style.display = 'none';
              return;
            }

            if (!searchIndex) {
              try {
                const res = await fetch('/search-index.json');
                searchIndex = await res.json();
              } catch {
                return;
              }
            }

            const q = query.toLowerCase();
            const results = searchIndex.filter((article) =>
              article.title.toLowerCase().includes(q) ||
              article.source.toLowerCase().includes(q)
            ).slice(0, 10);

            if (results.length === 0) {
              searchResults.innerHTML = '<p class="search-empty">검색 결과가 없습니다.</p>';
            } else {
              searchResults.innerHTML = results.map((article) => {
                const safeSource = escapeHtml(article.source);
                const safeType = article.type === 'curated' ? '큐레이션' : '피드';
                const safeTitle = escapeHtml(article.title);
                const safeId = escapeAttr(article.id);
                const safeItemType = escapeAttr(article.type);
                const safeUrl = escapeAttr(article.url);
                const safeDescAttr = escapeAttr(stripMd((article.description || '').slice(0, 200)));
                const safeDescHtml = article.description
                  ? '<p class="search-result-desc">' + escapeHtml(stripMd(article.description).slice(0, 100)) + '</p>'
                  : '';

                return '\\n                  <div class="search-result-card card">\\n                    <div class="search-result-meta">\\n                      <span class="badge">' + safeSource + '</span>\\n                      <span class="badge">' + safeType + '</span>\\n                    </div>\\n                    <h3 class="search-result-title">' + safeTitle + '</h3>\\n                    ' + safeDescHtml + '\\n                    <button class="btn btn-sm search-add-btn"\\n                            data-id="' + safeId + '" data-type="' + safeItemType + '"\\n                            data-title="' + escapeAttr(article.title) + '" data-url="' + safeUrl + '"\\n                            data-desc="' + safeDescAttr + '">\\n                      추가\\n                    </button>\\n                  </div>\\n                ';
              }).join('');

              searchResults.querySelectorAll('.search-add-btn').forEach((btn) => {
                btn.addEventListener('click', async () => {
                  try {
                    const res = await addPlaylistItem({
                      item_type: btn.dataset.type,
                      source_id: btn.dataset.id,
                      title_snapshot: btn.dataset.title,
                      url_snapshot: btn.dataset.url,
                      description_snapshot: btn.dataset.desc,
                    });

                    if (res.status === 409) {
                      btn.textContent = '이미 추가됨';
                      btn.disabled = true;
                      return;
                    }

                    if (!res.ok) {
                      throw new Error();
                    }

                    btn.textContent = '✓ 추가됨';
                    btn.disabled = true;
                    updateItemCount(1);
                    window.setTimeout(function() { window.location.reload(); }, 500);
                  } catch {
                    window.alert('추가에 실패했습니다.');
                  }
                });
              });
            }

            searchResults.style.display = '';
          }

          if (toggleBtn && extForm) {
            toggleBtn.addEventListener('click', () => {
              extForm.style.display = extForm.style.display === 'none' ? 'flex' : 'none';
            });
          }

          if (cancelBtn && extForm) {
            cancelBtn.addEventListener('click', () => {
              extForm.style.display = 'none';
            });
          }

          if (extForm) {
            extForm.style.flexDirection = 'column';
            extForm.style.gap = 'var(--space-sm)';
            extForm.style.marginTop = 'var(--space-md)';

            extForm.addEventListener('submit', async (e) => {
              e.preventDefault();

              const urlInput = extForm.elements.namedItem('url');
              const titleInput = extForm.elements.namedItem('title');
              const descriptionInput = extForm.elements.namedItem('description');
              const url = urlInput && 'value' in urlInput ? urlInput.value.trim() : '';
              const title = titleInput && 'value' in titleInput ? titleInput.value.trim() : '';
              const desc = descriptionInput && 'value' in descriptionInput ? descriptionInput.value.trim() : '';

              if (!url || !title) {
                return;
              }

              try {
                const res = await addPlaylistItem({
                  item_type: 'external',
                  external_url: url,
                  title_snapshot: title,
                  url_snapshot: url,
                  description_snapshot: desc || undefined,
                });

                if (res.status === 409) {
                  window.alert('이미 추가된 URL입니다.');
                  return;
                }

                if (!res.ok) {
                  throw new Error();
                }

                window.location.reload();
              } catch {
                window.alert('추가에 실패했습니다.');
              }
            });
          }

          document.querySelectorAll('.item-delete').forEach((btn) => {
            btn.addEventListener('click', async () => {
              const itemId = btn.dataset.itemId;

              if (!itemId || !window.confirm('이 기사를 플레이리스트에서 삭제할까요?')) {
                return;
              }

              try {
                const res = await fetch('/api/playlists/' + playlistId + '/items/' + encodeURIComponent(itemId), {
                  method: 'DELETE',
                  credentials: 'same-origin'
                });

                if (!res.ok) {
                  throw new Error();
                }

                const card = btn.closest('.item-card');
                if (!card) {
                  return;
                }

                card.classList.add('removing');
                window.setTimeout(() => {
                  card.remove();
                  updateItemCount(-1);
                  var itemsEl = document.querySelector('.items');
                  if (itemsEl && !itemsEl.querySelector('.item-card')) {
                    itemsEl.innerHTML = '<p class="empty-state">이 플레이리스트에 아직 기사가 없습니다.</p>';
                  }
                }, 300);
              } catch {
                window.alert('삭제에 실패했습니다.');
              }
            });
          });

          document.querySelectorAll('.item-edit-note').forEach((btn) => {
            btn.addEventListener('click', () => {
              const itemId = btn.dataset.itemId;
              const currentNote = btn.dataset.note || '';
              const card = btn.closest('.item-card');

              if (!itemId || !card) {
                return;
              }

              const existing = card.querySelector('.note-editor');
              if (existing) {
                existing.remove();
                return;
              }

              const editor = document.createElement('div');
              editor.className = 'note-editor';

              const textarea = document.createElement('textarea');
              textarea.placeholder = '메모를 입력하세요...';
              textarea.value = currentNote;

              const actions = document.createElement('div');
              actions.className = 'note-editor-actions';

              const cancelButton = document.createElement('button');
              cancelButton.type = 'button';
              cancelButton.className = 'btn btn-sm note-cancel';
              cancelButton.textContent = '취소';

              const saveButton = document.createElement('button');
              saveButton.type = 'button';
              saveButton.className = 'btn btn-sm note-save';
              saveButton.style.background = 'var(--color-primary)';
              saveButton.style.color = 'white';
              saveButton.textContent = '저장';

              actions.append(cancelButton, saveButton);
              editor.append(textarea, actions);

              const controls = card.querySelector('.item-controls');
              if (controls) {
                card.insertBefore(editor, controls);
              } else {
                card.appendChild(editor);
              }

              cancelButton.addEventListener('click', () => editor.remove());
              saveButton.addEventListener('click', async () => {
                const note = textarea.value;

                try {
                  const res = await fetch('/api/playlists/' + playlistId + '/items/' + encodeURIComponent(itemId), {
                    method: 'PUT',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ note })
                  });

                  if (!res.ok) {
                    throw new Error();
                  }

                  let noteEl = card.querySelector('.item-note');
                  const trimmedNote = note.trim();

                  if (trimmedNote) {
                    if (!noteEl) {
                      noteEl = document.createElement('p');
                      noteEl.className = 'item-note';
                      const controlsEl = card.querySelector('.item-controls');
                      if (controlsEl) {
                        card.insertBefore(noteEl, controlsEl);
                      } else {
                        card.appendChild(noteEl);
                      }
                    }
                    noteEl.textContent = '💬 ' + note;
                  } else if (noteEl) {
                    noteEl.remove();
                  }

                  btn.dataset.note = note;
                  btn.textContent = trimmedNote ? '💬 메모 수정' : '💬 메모 추가';
                  editor.remove();
                } catch {
                  window.alert('메모 저장에 실패했습니다.');
                }
              });
            });
          });

          // ========== Tag Editor ==========
          const tagEditorSectionEl = document.querySelector('.tag-editor-section');
          let initialTags = [];
          if (tagEditorSectionEl && tagEditorSectionEl.dataset && tagEditorSectionEl.dataset.initialTags) {
            try {
              const parsed = JSON.parse(tagEditorSectionEl.dataset.initialTags);
              if (Array.isArray(parsed)) {
                initialTags = parsed.filter(function(t) { return typeof t === 'string'; });
              }
            } catch (e) {}
          }
          let currentTags = initialTags.slice();

          const tagEditorTagsEl = document.getElementById('tag-editor-tags');
          const tagEditorInputEl = document.getElementById('tag-editor-input');
          const tagSaveBtnEl = document.getElementById('tag-save-btn');
          const tagEditorFeedbackEl = document.getElementById('tag-editor-feedback');

          function tagsEqual(a, b) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
              if (a[i] !== b[i]) return false;
            }
            return true;
          }

          function clearTagFeedback() {
            if (!tagEditorFeedbackEl) return;
            tagEditorFeedbackEl.textContent = '';
            tagEditorFeedbackEl.classList.remove('is-error', 'is-success');
          }

          function showTagFeedback(message, type) {
            if (!tagEditorFeedbackEl) return;
            tagEditorFeedbackEl.textContent = message;
            tagEditorFeedbackEl.classList.remove('is-error', 'is-success');
            if (type) tagEditorFeedbackEl.classList.add('is-' + type);
          }

          function updateTagSaveButton() {
            if (!tagSaveBtnEl) return;
            const changed = !tagsEqual(currentTags, initialTags);
            tagSaveBtnEl.disabled = !changed;
            tagSaveBtnEl.classList.toggle('has-changes', changed);
          }

          function renderEditorTags() {
            if (!tagEditorTagsEl) return;
            tagEditorTagsEl.innerHTML = '';
            if (currentTags.length === 0) {
              const empty = document.createElement('span');
              empty.className = 'tag-editor-empty';
              empty.textContent = '아직 태그가 없습니다.';
              tagEditorTagsEl.appendChild(empty);
            } else {
              currentTags.forEach(function(tag, index) {
                const pill = document.createElement('span');
                pill.className = 'tag-editor-tag';
                const label = document.createElement('span');
                label.textContent = tag;
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'tag-editor-tag-remove';
                removeBtn.setAttribute('aria-label', '태그 ' + tag + ' 제거');
                removeBtn.textContent = '×';
                removeBtn.addEventListener('click', function() {
                  currentTags.splice(index, 1);
                  renderEditorTags();
                  clearTagFeedback();
                });
                pill.appendChild(label);
                pill.appendChild(removeBtn);
                tagEditorTagsEl.appendChild(pill);
              });
            }
            updateTagSaveButton();
          }

          function addEditorTag(rawValue) {
            const cleaned = rawValue.trim().replace(/^#/, '').replace(/,/g, '').trim();
            if (!cleaned) return;
            if (cleaned.length > 30) {
              showTagFeedback('태그는 30자 이내로 입력해주세요.', 'error');
              return;
            }
            if (currentTags.length >= 5) {
              showTagFeedback('태그는 최대 5개까지만 추가할 수 있습니다.', 'error');
              return;
            }
            if (currentTags.indexOf(cleaned) !== -1) {
              showTagFeedback('이미 추가된 태그입니다.', 'error');
              return;
            }
            currentTags.push(cleaned);
            renderEditorTags();
            clearTagFeedback();
          }

          function updateHeaderTags(tags) {
            const header = document.querySelector('.playlist-header');
            if (!header) return;
            let container = header.querySelector('.playlist-tags');
            if (!tags || tags.length === 0) {
              if (container) container.remove();
              return;
            }
            if (!container) {
              container = document.createElement('div');
              container.className = 'playlist-tags';
              const ownerLine = header.querySelector('p.meta-text');
              if (ownerLine) {
                header.insertBefore(container, ownerLine);
              } else {
                header.appendChild(container);
              }
            }
            container.innerHTML = '';
            tags.forEach(function(t) {
              const span = document.createElement('span');
              span.className = 'tag';
              span.textContent = t;
              container.appendChild(span);
            });
          }

          async function saveTags() {
            if (!tagSaveBtnEl) return;
            tagSaveBtnEl.disabled = true;
            const originalLabel = tagSaveBtnEl.textContent;
            tagSaveBtnEl.textContent = '저장 중...';
            clearTagFeedback();
            try {
              const res = await fetch('/api/playlists/' + playlistId, {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: currentTags })
              });
              if (!res.ok) {
                let errorMsg = '태그 저장에 실패했습니다.';
                try {
                  const data = await res.json();
                  if (data && data.error) errorMsg = data.error;
                } catch (e) {}
                if (res.status === 401) errorMsg = '로그인이 필요합니다. 페이지를 새로고침한 뒤 다시 시도해주세요.';
                else if (res.status === 403) errorMsg = '이 플레이리스트를 수정할 권한이 없습니다.';
                throw new Error(errorMsg);
              }
              initialTags.length = 0;
              currentTags.forEach(function(t) { initialTags.push(t); });
              updateHeaderTags(currentTags);
              updateTagSaveButton();
              showTagFeedback('태그가 저장되었습니다.', 'success');
              window.setTimeout(clearTagFeedback, 3000);
            } catch (err) {
              const message = err && err.message ? err.message : '태그 저장에 실패했습니다.';
              showTagFeedback(message, 'error');
              updateTagSaveButton();
            } finally {
              tagSaveBtnEl.textContent = originalLabel;
            }
          }

          if (tagEditorInputEl) {
            tagEditorInputEl.addEventListener('keydown', function(e) {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addEditorTag(tagEditorInputEl.value);
                tagEditorInputEl.value = '';
              }
            });
            tagEditorInputEl.addEventListener('blur', function() {
              if (tagEditorInputEl.value.trim()) {
                addEditorTag(tagEditorInputEl.value);
                tagEditorInputEl.value = '';
              }
            });
          }

          if (tagSaveBtnEl) {
            tagSaveBtnEl.addEventListener('click', function() {
              if (!tagSaveBtnEl.disabled) void saveTags();
            });
          }

          renderEditorTags();
          // ========== End Tag Editor ==========

          // === Batch Edit Mode (drag-to-reorder) ===
          var batchEditBtn = document.getElementById('batch-edit-btn');
          var batchActionBar = document.getElementById('batch-action-bar');
          var batchSaveBtn = document.getElementById('batch-save-btn');
          var batchCancelBtn = document.getElementById('batch-cancel-btn');
          var itemsContainer = document.getElementById('items-container');
          var sortableInstance = null;
          var originalOrder = [];

          // ---- Custom auto-scroll during drag ------------------------------
          // WHY CUSTOM: SortableJS's built-in auto-scroll is binary
          // (scrollSpeed is applied as-is regardless of edge distance; see
          // AutoScroll.js vy = (...) - (...) line 225 in v1.15.2). Combined
          // with the sticky .nav header (position: sticky, top: 0, height
          // var(--nav-height) = 60px), the top edge zone is visually
          // unreachable by the pointer, so the browser's native
          // drag-at-edge fast-scroll never fires when dragging UP, while it
          // fires normally when dragging DOWN. The observable symptom was
          // "downward scroll = slow+very-fast, upward scroll = slow+2x".
          //
          // This implementation replaces SortableJS's scroll plugin with a
          // symmetric gradient using requestAnimationFrame. The effective
          // top edge is measured from .nav's bounding rect at drag start,
          // so the sticky header no longer blocks the fast-scroll zone.
          var AUTO_SCROLL_ZONE = 120;        // px from (effective) edge that triggers scroll
          var AUTO_SCROLL_MAX_SPEED = 32;    // px/frame at deepest edge (~1920 px/s @ 60fps)
          var AUTO_SCROLL_MIN_SPEED = 4;     // px/frame at the outer boundary of the zone
          var autoScrollRaf = 0;
          var autoScrollPointerY = -1;
          var autoScrollEffectiveTop = 0;
          var autoScrollEffectiveBottom = 0;

          function readAutoScrollBounds() {
            var nav = document.querySelector('.nav');
            var navBottom = 0;
            if (nav) {
              var r = nav.getBoundingClientRect();
              // getBoundingClientRect gives the current visual rect; for
              // position:sticky top:0 this is effectively the nav's height
              // while the header is pinned at the top of the viewport.
              navBottom = Math.max(0, r.bottom);
            }
            autoScrollEffectiveTop = navBottom;
            autoScrollEffectiveBottom = window.innerHeight;
          }

          function computeAutoScrollVelocity(pointerY) {
            if (pointerY < 0) return 0;
            var zone = AUTO_SCROLL_ZONE;
            var distFromTop = pointerY - autoScrollEffectiveTop;
            var distFromBottom = autoScrollEffectiveBottom - pointerY;

            // Upward scroll: pointer within zone px of (or above) the
            // effective top edge. distFromTop can be negative if the
            // pointer is above the nav bottom — still treat as max speed.
            if (distFromTop < zone) {
              var t = distFromTop <= 0 ? 1 : 1 - (distFromTop / zone);
              // t === 1 at the edge, 0 at the outer boundary.
              var speed = AUTO_SCROLL_MIN_SPEED + (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED) * t;
              return -speed;
            }
            // Downward scroll: pointer within zone px of (or below) the
            // effective bottom edge. Symmetric formula.
            if (distFromBottom < zone) {
              var b = distFromBottom <= 0 ? 1 : 1 - (distFromBottom / zone);
              var speedDown = AUTO_SCROLL_MIN_SPEED + (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED) * b;
              return speedDown;
            }
            return 0;
          }

          function autoScrollTick() {
            if (autoScrollRaf === 0) return;
            // Re-read bounds every frame so that the calculation stays
            // correct even if the nav collapses/expands mid-drag (mobile).
            readAutoScrollBounds();
            var v = computeAutoScrollVelocity(autoScrollPointerY);
            if (v !== 0) {
              // Clamp so we don't over-shoot past document boundaries.
              var maxUp = -window.scrollY;
              var maxDown = (document.documentElement.scrollHeight - window.innerHeight) - window.scrollY;
              if (v < maxUp) v = maxUp;
              if (v > maxDown) v = maxDown;
              if (v !== 0) window.scrollBy(0, v);
            }
            autoScrollRaf = window.requestAnimationFrame(autoScrollTick);
          }

          function onDragPointerMove(ev) {
            // pointermove + touchmove both fire during SortableJS fallback
            // drag (it uses its own fallback clone, so we don't rely on
            // native HTML5 dragover). Grab clientY from whichever event.
            var y = -1;
            if (ev.touches && ev.touches.length > 0) {
              y = ev.touches[0].clientY;
            } else if (typeof ev.clientY === 'number') {
              y = ev.clientY;
            }
            if (y >= 0) autoScrollPointerY = y;
          }

          function startAutoScroll() {
            if (autoScrollRaf !== 0) return;
            autoScrollPointerY = -1;
            readAutoScrollBounds();
            // passive:true — we never preventDefault; we only observe the
            // pointer position for scroll velocity computation.
            window.addEventListener('pointermove', onDragPointerMove, { passive: true });
            window.addEventListener('touchmove', onDragPointerMove, { passive: true });
            autoScrollRaf = window.requestAnimationFrame(autoScrollTick);
          }

          function stopAutoScroll() {
            if (autoScrollRaf !== 0) {
              window.cancelAnimationFrame(autoScrollRaf);
              autoScrollRaf = 0;
            }
            window.removeEventListener('pointermove', onDragPointerMove);
            window.removeEventListener('touchmove', onDragPointerMove);
            autoScrollPointerY = -1;
          }
          // ---- End custom auto-scroll --------------------------------------

          function loadSortableJS() {
            if (window.Sortable) return Promise.resolve();
            return new Promise(function(resolve, reject) {
              var s = document.createElement('script');
              s.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';
              s.onload = function() { resolve(); };
              s.onerror = function() { reject(new Error('SortableJS load failed')); };
              document.head.appendChild(s);
            });
          }

          function getCurrentItemIds() {
            if (!itemsContainer) return [];
            return Array.from(itemsContainer.querySelectorAll('.item-card')).map(function(c) {
              return c.dataset.itemId;
            });
          }

          function enterBatchMode() {
            if (!itemsContainer || !batchEditBtn || !batchActionBar) return;
            originalOrder = getCurrentItemIds();
            itemsContainer.classList.add('batch-edit-mode');
            batchEditBtn.hidden = true;
            batchActionBar.hidden = false;

            loadSortableJS().then(function() {
              sortableInstance = window.Sortable.create(itemsContainer, {
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                // forceFallback: use SortableJS's clone-based simulated drag
                // instead of the HTML5 native drag API. This is REQUIRED for
                // our custom auto-scroll: with HTML5 native drag, browsers
                // suppress pointermove/touchmove events on the window during
                // the drag (only dragover/drag fire, and those don't reliably
                // give a global cursor position). The fallback drag fires
                // normal mouse/touch events, so our window-level pointermove
                // and touchmove listeners in startAutoScroll() can track the
                // cursor and drive the rAF-based scroller symmetrically in
                // both directions.
                forceFallback: true,
                fallbackTolerance: 3,
                // Disable SortableJS's built-in auto-scroll. Its algorithm
                // applies scrollSpeed as a binary on/off (no gradient), and
                // the sticky site nav makes the top edge unreachable for
                // the browser's native drag-scroll fallback, producing a
                // visibly slower UP-direction scroll. We implement our own
                // symmetric rAF-based gradient scroller in
                // startAutoScroll() / autoScrollTick() above.
                scroll: false,
                onStart: function() { startAutoScroll(); },
                onEnd: function() { stopAutoScroll(); }
              });
            }).catch(function() {
              window.alert('드래그 기능을 불러오지 못했습니다. 페이지를 새로고침해주세요.');
              exitBatchMode();
            });
          }

          function exitBatchMode() {
            stopAutoScroll();
            if (sortableInstance) {
              sortableInstance.destroy();
              sortableInstance = null;
            }
            if (itemsContainer) itemsContainer.classList.remove('batch-edit-mode');
            if (batchEditBtn) batchEditBtn.hidden = false;
            if (batchActionBar) batchActionBar.hidden = true;
          }

          function cancelBatchEdit() {
            if (!itemsContainer) { exitBatchMode(); return; }
            originalOrder.forEach(function(id) {
              var card = itemsContainer.querySelector('[data-item-id="' + id + '"]');
              if (card) itemsContainer.appendChild(card);
            });
            exitBatchMode();
          }

          async function saveBatchOrder() {
            var itemIds = getCurrentItemIds();
            if (itemIds.length === 0) return;

            if (batchSaveBtn) {
              batchSaveBtn.disabled = true;
              batchSaveBtn.textContent = '저장 중...';
            }

            try {
              var res = await fetch('/api/playlists/' + playlistId + '/items/reorder', {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_ids: itemIds })
              });

              if (!res.ok) {
                throw new Error('Reorder failed');
              }

              window.location.reload();
            } catch (err) {
              if (batchSaveBtn) {
                batchSaveBtn.disabled = false;
                batchSaveBtn.textContent = '저장';
              }
              window.alert('순서 저장에 실패했습니다. 다시 시도해주세요.');
            }
          }

          if (batchEditBtn) {
            batchEditBtn.addEventListener('click', enterBatchMode);
          }
          if (batchCancelBtn) {
            batchCancelBtn.addEventListener('click', cancelBatchEdit);
          }
          if (batchSaveBtn) {
            batchSaveBtn.addEventListener('click', function() {
              void saveBatchOrder();
            });
          }
        </script>` : '',
    ].filter(Boolean).join('\n') || undefined,
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};
