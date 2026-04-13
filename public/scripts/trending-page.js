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

  function renderCuratorAvatar(playlist) {
    var playlistData = playlist || {};
    if (playlistData.user && playlistData.user.avatar_url) {
      return '<img src="' + escapeAttr(playlistData.user.avatar_url) + '" alt="" class="curator-avatar" /> ';
    }
    return '';
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

    var rankOffset = (currentPage - 1) * 20;

    return playlists.map(function(playlist, index) {
      var playlistData = playlist || {};
      var rank = rankOffset + index + 1;
      var description = (playlistData.description && playlistData.description.trim()) || (getOwnerName(playlistData) + '의 플레이리스트 · ' + Number(playlistData.item_count || 0) + '개 기사');
      var userLiked = Boolean(playlistData.user_liked);
      var likeButtonLabel = userLiked ? '좋아요 취소' : '좋아요';
      var likeIcon = userLiked ? '♥' : '♡';
      var itemCount = Number(playlistData.item_count || 0);
      var username = (playlistData.user && playlistData.user.username) || 'unknown';
      var avatarHtml = renderCuratorAvatar(playlistData);

      return '<article class="card playlist-card">' +
        '<div class="playlist-header">' +
          '<h3 class="playlist-title"><a href="/p/' + escapeAttr(playlistData.id) + '">' + escapeHtml(playlistData.title || '') + '</a></h3>' +
          '<span class="playlist-count">' + itemCount + '개</span>' +
        '</div>' +
        '<p class="playlist-description">' + escapeHtml(description) + '</p>' +
        '<div class="playlist-footer">' +
          '<span class="playlist-curator">' +
            avatarHtml +
            'by @' + escapeHtml(username) +
          '</span>' +
          '<span class="trending-stats">' +
            '<span class="rank-badge">#' + rank + '</span>' +
            '<span class="like-count" data-like-count-for="' + escapeAttr(playlistData.id) + '">❤️ ' + Number(playlistData.like_count || 0) + '</span>' +
            '<button type="button"' +
              ' class="btn like-button' + (userLiked ? ' is-liked' : '') + '"' +
              ' data-playlist-id="' + escapeAttr(playlistData.id) + '"' +
              ' data-liked="' + (userLiked ? 'true' : 'false') + '"' +
              ' data-like-count="' + Number(playlistData.like_count || 0) + '"' +
              ' data-authenticated="' + (isAuthenticated ? 'true' : 'false') + '"' +
              ' aria-pressed="' + (userLiked ? 'true' : 'false') + '"' +
              ' aria-label="' + escapeAttr(likeButtonLabel) + '"' +
            '>' +
              '<span class="like-button-icon" aria-hidden="true">' + likeIcon + '</span>' +
              '<span class="like-button-label">좋아요</span>' +
            '</button>' +
          '</span>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function renderLoading() {
    summaryNode.innerHTML = '<p>총 0개의 공개 플레이리스트</p><p>불러오는 중...</p>';
    gridNode.innerHTML = '';

    for (var i = 0; i < 3; i += 1) {
      gridNode.insertAdjacentHTML('beforeend',
        '<article class="card playlist-card skeleton-card">' +
          '<div class="playlist-header">' +
            '<span class="skeleton-line skeleton-title"></span>' +
            '<span class="playlist-count skeleton-count"></span>' +
          '</div>' +
          '<div class="skeleton-line skeleton-text"></div>' +
          '<div class="skeleton-line skeleton-text short"></div>' +
          '<div class="playlist-footer">' +
            '<span class="playlist-curator">' +
              '<span class="skeleton-avatar"></span>' +
              '<span class="skeleton-line skeleton-author-line"></span>' +
            '</span>' +
            '<span class="trending-stats">' +
              '<span class="rank-badge skeleton-box"></span>' +
              '<span class="skeleton-line skeleton-like-count"></span>' +
              '<span class="btn like-button skeleton-button"></span>' +
            '</span>' +
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
