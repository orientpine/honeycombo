// @ts-nocheck
document.addEventListener('astro:page-load', () => {
  const pageRoot = document.querySelector('[data-trending-page]');
  const summaryNode = document.getElementById('trending-summary');
  const gridNode = document.getElementById('trending-grid');
  const paginationNode = document.getElementById('trending-pagination');
  if (!pageRoot || !summaryNode || !gridNode || !paginationNode) return;

  const loginBaseUrl = '/api/auth/github/login?return_to=';
  let isAuthenticated = false;

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

  function getOwnerName(playlist) {
    const playlistData = playlist || {};
    return (playlistData.user && playlistData.user.display_name && playlistData.user.display_name.trim()) || '@' + ((playlistData.user && playlistData.user.username) || 'unknown');
  }

  function getPageNumber(value) {
    const page = Number(value || '1');
    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  }

  function getPageHref(page) {
    return page <= 1 ? '/trending' : '/trending?page=' + page;
  }

  function renderAvatar(playlist) {
    const playlistData = playlist || {};

    if (playlistData.user && playlistData.user.avatar_url) {
      return '<img src="' + escapeAttr(playlistData.user.avatar_url) + '" alt="" class="avatar">';
    }

    const username = playlistData.user && playlistData.user.username ? playlistData.user.username.trim() : '';
    const fallback = username.charAt(0).toUpperCase() || 'H';
    return '<span class="avatar avatar-fallback" aria-hidden="true">' + escapeHtml(fallback) + '</span>';
  }

  function renderPagination(currentPage, totalPages) {
    if (totalPages <= 1) {
      return '';
    }

    const pageSet = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const pages = Array.from(pageSet).filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
    const parts = [];

    if (currentPage > 1) {
      parts.push('<a href="' + escapeAttr(getPageHref(currentPage - 1)) + '">이전</a>');
    }

    let prevPage = 0;
    pages.forEach((page) => {
      if (prevPage && page - prevPage > 1) {
        parts.push('<span class="pagination-gap" aria-hidden="true">…</span>');
      }

      parts.push('<a href="' + escapeAttr(getPageHref(page)) + '"' + (page === currentPage ? ' class="active" aria-current="page"' : '') + '>' + page + '</a>');
      prevPage = page;
    });

    if (currentPage < totalPages) {
      parts.push('<a href="' + escapeAttr(getPageHref(currentPage + 1)) + '">다음</a>');
    }

    return '<nav class="pagination" aria-label="트렌딩 페이지 이동">' + parts.join('') + '</nav>';
  }

  function renderCards(playlists, currentPage) {
    if (!Array.isArray(playlists) || playlists.length === 0) {
      return '<div class="card empty-state">아직 공개된 플레이리스트가 없습니다.</div>';
    }

    const rankOffset = (currentPage - 1) * 20;

    return playlists.map((playlist, index) => {
      const playlistData = playlist || {};
      const rank = rankOffset + index + 1;
      const description = (playlistData.description && playlistData.description.trim()) || (getOwnerName(playlistData) + '의 플레이리스트 · ' + Number(playlistData.item_count || 0) + '개 기사');
      const userLiked = Boolean(playlistData.user_liked);
      const likeButtonLabel = userLiked ? '좋아요 취소' : '좋아요';
      const likeIcon = userLiked ? '♥' : '♡';

      return '\n        <article class="card trending-card">\n          <div class="trending-card-top">\n            <span class="rank-badge">#' + rank + '</span>\n            <span class="like-count" data-like-count-for="' + escapeAttr(playlistData.id) + '">❤️ ' + Number(playlistData.like_count || 0) + '</span>\n          </div>\n          <h2 class="playlist-title"><a href="/p/' + escapeAttr(playlistData.id) + '">' + escapeHtml(playlistData.title || '') + '</a></h2>\n          <p class="playlist-description">' + escapeHtml(description) + '</p>\n          <div class="playlist-author">\n            ' + renderAvatar(playlistData) + '\n            <span>' + escapeHtml(getOwnerName(playlistData)) + '</span>\n          </div>\n          <div class="playlist-footer">\n            <span class="badge">' + Number(playlistData.item_count || 0) + '개 기사</span>\n            <button\n              type="button"\n              class="btn like-button' + (userLiked ? ' is-liked' : '') + '"\n              data-playlist-id="' + escapeAttr(playlistData.id) + '"\n              data-liked="' + (userLiked ? 'true' : 'false') + '"\n              data-like-count="' + Number(playlistData.like_count || 0) + '"\n              data-authenticated="' + (isAuthenticated ? 'true' : 'false') + '"\n              aria-pressed="' + (userLiked ? 'true' : 'false') + '"\n              aria-label="' + escapeAttr(likeButtonLabel) + '"\n            >\n              <span class="like-button-icon" aria-hidden="true">' + likeIcon + '</span>\n              <span class="like-button-label">좋아요</span>\n            </button>\n          </div>\n        </article>';
    }).join('');
  }

  function renderLoading() {
    summaryNode.innerHTML = '<p>총 0개의 공개 플레이리스트</p><p>불러오는 중...</p>';
    gridNode.innerHTML = '';

    for (let index = 0; index < 3; index += 1) {
      gridNode.insertAdjacentHTML('beforeend',
        '<article class="card trending-card skeleton-card">' +
          '<div class="trending-card-top">' +
            '<span class="rank-badge skeleton-box"></span>' +
            '<span class="like-count skeleton-line"></span>' +
          '</div>' +
          '<div class="skeleton-line skeleton-title"></div>' +
          '<div class="skeleton-line skeleton-text"></div>' +
          '<div class="skeleton-line skeleton-text short"></div>' +
          '<div class="playlist-author skeleton-author">' +
            '<span class="avatar avatar-fallback skeleton-avatar"></span>' +
            '<span class="skeleton-line skeleton-author-line"></span>' +
          '</div>' +
          '<div class="playlist-footer">' +
            '<span class="badge skeleton-badge"></span>' +
            '<span class="btn like-button skeleton-button"></span>' +
          '</div>' +
        '</article>'
      );
    }

    paginationNode.innerHTML = '';
  }

  function updateLikeButton(button, liked, likeCount) {
    button.setAttribute('data-liked', liked ? 'true' : 'false');
    button.setAttribute('data-like-count', String(likeCount));
    button.setAttribute('data-authenticated', isAuthenticated ? 'true' : 'false');
    button.setAttribute('aria-pressed', liked ? 'true' : 'false');
    button.setAttribute('aria-label', liked ? '좋아요 취소' : '좋아요');
    button.classList.toggle('is-liked', liked);

    const icon = button.querySelector('.like-button-icon');
    if (icon) {
      icon.textContent = liked ? '♥' : '♡';
    }

    const playlistId = button.getAttribute('data-playlist-id') || '';
    const countEl = document.querySelector('[data-like-count-for="' + playlistId + '"]');
    if (countEl) {
      countEl.textContent = '❤️ ' + likeCount;
    }
  }

  function bindLikeButtons() {
    gridNode.querySelectorAll('.like-button').forEach((button) => {
      button.addEventListener('click', async () => {
        const playlistId = button.getAttribute('data-playlist-id');
        const isButtonAuthed = button.getAttribute('data-authenticated') === 'true';

        if (!playlistId) {
          return;
        }

        if (!isButtonAuthed) {
          const returnTo = window.location.pathname + window.location.search;
          window.location.href = loginBaseUrl + encodeURIComponent(returnTo);
          return;
        }

        const previousLiked = button.getAttribute('data-liked') === 'true';
        const previousCount = Number(button.getAttribute('data-like-count') || '0');
        const nextLiked = !previousLiked;
        const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));

        button.setAttribute('disabled', 'true');
        updateLikeButton(button, nextLiked, nextCount);

        try {
          const response = await fetch('/api/playlists/' + encodeURIComponent(playlistId) + '/like', {
            method: 'POST',
            credentials: 'same-origin'
          });

          if (response.status === 401) {
            isAuthenticated = false;
            updateLikeButton(button, previousLiked, previousCount);
            const returnTo = window.location.pathname + window.location.search;
            window.location.href = loginBaseUrl + encodeURIComponent(returnTo);
            return;
          }

          if (!response.ok) {
            throw new Error();
          }

          const data = await response.json();
          isAuthenticated = true;
          updateLikeButton(button, Boolean(data.liked), Number(data.like_count || 0));
        } catch {
          updateLikeButton(button, previousLiked, previousCount);
          window.alert('좋아요 처리에 실패했습니다.');
        } finally {
          button.removeAttribute('disabled');
        }
      });
    });
  }

  async function loadAuthState() {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
      isAuthenticated = response.ok;
    } catch {
      isAuthenticated = false;
    }
  }

  async function loadTrending() {
    renderLoading();

    const requestedPage = getPageNumber(new URL(window.location.href).searchParams.get('page'));

    try {
      await loadAuthState();

      const response = await fetch('/api/trending?page=' + encodeURIComponent(String(requestedPage)), {
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error('트렌딩 데이터를 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      const page = getPageNumber(data && data.page);
      const total = Number((data && data.total) || 0);
      const totalPages = Number((data && data.totalPages) || 0);
      const playlists = Array.isArray(data && data.playlists) ? data.playlists : [];

      summaryNode.innerHTML = '<p>총 ' + total + '개의 공개 플레이리스트</p><p>' + (totalPages > 0 ? page + ' / ' + totalPages + ' 페이지' : '첫 번째 플레이리스트를 기다리고 있어요.') + '</p>';
      gridNode.innerHTML = renderCards(playlists, page);
      paginationNode.innerHTML = renderPagination(page, totalPages);
      bindLikeButtons();
    } catch {
      summaryNode.innerHTML = '<p>총 0개의 공개 플레이리스트</p><p>데이터를 불러오지 못했습니다.</p>';
      gridNode.innerHTML = '<div class="card empty-state">트렌딩 플레이리스트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
      paginationNode.innerHTML = '';
    }
  }

  loadTrending();
});
