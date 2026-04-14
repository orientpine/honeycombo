// @ts-nocheck
document.addEventListener('astro:page-load', () => {
  const pageRoot = document.querySelector('[data-community-page]');
  if (!pageRoot) return;

  // DOM refs
  const writeArea = document.getElementById('community-write-area');
  const summaryNode = document.getElementById('community-summary');
  const listNode = document.getElementById('community-list');
  const paginationNode = document.getElementById('community-pagination');
  const detailNode = document.getElementById('community-detail');

  const AUTH_CACHE_KEY = 'honeycombo:auth';

  // ---- Auth helpers ----
  function getCachedUser() {
    try {
      var raw = sessionStorage.getItem(AUTH_CACHE_KEY);
      if (!raw || raw === 'guest') return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // ---- HTML escape ----
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---- Date formatting ----
  function formatDate(isoStr) {
    var now = Date.now();
    var then = new Date(isoStr).getTime();
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + '일 전';
    return new Date(isoStr).toLocaleDateString('ko-KR');
  }

  // ---- Render write form ----
  function renderWriteArea(user) {
    if (!user) {
      writeArea.innerHTML = `<div class="login-prompt">
        <p>로그인 후 발제할 수 있습니다.</p>
        <a href="/api/auth/github/login?return_to=/community" class="btn btn-primary">GitHub으로 로그인</a>
      </div>`;
      return;
    }

    writeArea.innerHTML = `<div class="write-form">
      <h2>✍️ 새 발제 작성</h2>
      <div class="write-form-field">
        <label for="post-title">제목</label>
        <input type="text" id="post-title" placeholder="발제 제목을 입력하세요" maxlength="256" autocomplete="off" />
      </div>
      <div class="write-form-field">
        <label for="post-body">내용</label>
        <textarea id="post-body" placeholder="내용을 입력하세요. 마크다운 문법을 사용할 수 있습니다." maxlength="10000"></textarea>
        <p class="write-form-hint">💡 마크다운 문법 사용 가능 · 최대 10,000자</p>
      </div>
      <div class="write-form-footer">
        <span class="write-form-error" id="write-form-error" role="alert"></span>
        <button type="button" id="submit-post-btn" class="btn btn-primary">발제하기</button>
      </div>
    </div>`;

    const submitBtn = document.getElementById('submit-post-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', handleSubmit);
    }
  }

  // ---- Submit handler ----
  async function handleSubmit() {
    const titleInput = document.getElementById('post-title');
    const bodyInput = document.getElementById('post-body');
    const submitBtn = document.getElementById('submit-post-btn');
    const errorEl = document.getElementById('write-form-error');

    const title = titleInput ? titleInput.value.trim() : '';
    const body = bodyInput ? bodyInput.value.trim() : '';

    if (errorEl) errorEl.textContent = '';

    if (!title) {
      if (errorEl) errorEl.textContent = '제목을 입력해주세요.';
      return;
    }
    if (title.length > 256) {
      if (errorEl) errorEl.textContent = '제목은 256자 이내로 입력해주세요.';
      return;
    }
    if (!body) {
      if (errorEl) errorEl.textContent = '내용을 입력해주세요.';
      return;
    }
    if (body.length > 10000) {
      if (errorEl) errorEl.textContent = '내용은 10,000자 이내로 입력해주세요.';
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '발제 중...';
    }

    try {
      const response = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ title, body })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '발제에 실패했습니다.');
      }

      // Success: reload list and open detail view
      await loadDiscussions();
      showDetail(data.number);
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message || '발제에 실패했습니다. 잠시 후 다시 시도해주세요.';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '발제하기';
      }
    }
  }

  // ---- Render discussion list ----
  function renderDiscussions(discussions) {
    if (!discussions || discussions.length === 0) {
      listNode.innerHTML = `<div class="empty-state">
        <p>아직 발제가 없습니다. 첫 번째 발제를 시작해보세요!</p>
      </div>`;
      return;
    }

    listNode.innerHTML = discussions.map(function(d) {
      const author = d.author ? d.author.login : '알 수 없음';
      const avatarHtml = d.author && d.author.avatarUrl
        ? `<img src="${escapeHtml(d.author.avatarUrl)}" alt="" class="discussion-avatar" loading="lazy" />`
        : '';
      return `<article class="discussion-card" data-discussion-number="${d.number}">
        <div class="discussion-card-header">
          <h3 class="discussion-card-title">${escapeHtml(d.title)}</h3>
        </div>
        <div class="discussion-card-meta">
          ${avatarHtml}
          <span>@${escapeHtml(author)}</span>
          <span>·</span>
          <span>${formatDate(d.createdAt)}</span>
          <span class="discussion-comments">💬 ${d.comments.totalCount}</span>
        </div>
      </article>`;
    }).join('');

    // Bind click handlers
    listNode.querySelectorAll('.discussion-card').forEach(function(card) {
      card.addEventListener('click', function() {
        const num = parseInt(card.getAttribute('data-discussion-number'), 10);
        if (num) showDetail(num);
      });
    });
  }

  // ---- Show detail view ----
  function showDetail(number) {
    // Hide list area, show detail
    listNode.closest('.community-list-section').hidden = true;
    writeArea.hidden = true;
    detailNode.hidden = false;

    detailNode.innerHTML = `<button class="detail-back-btn" id="detail-back-btn">← 목록으로</button>
      <div id="detail-content"><div class="empty-state">발제 내용을 불러오는 중...</div></div>
      <div id="detail-comments"></div>`;

    document.getElementById('detail-back-btn').addEventListener('click', showList);

    // Load discussion detail
    fetch('/api/discussions/' + number, { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.discussion) {
          document.getElementById('detail-content').innerHTML = '<div class="empty-state">발제를 찾을 수 없습니다.</div>';
          return;
        }
        const d = data.discussion;
        const author = d.author ? d.author.login : '알 수 없음';
        const avatarHtml = d.author && d.author.avatarUrl
          ? `<img src="${escapeHtml(d.author.avatarUrl)}" alt="" class="discussion-avatar" loading="lazy" />`
          : '';
        document.getElementById('detail-content').innerHTML = `
          <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:var(--space-sm);">${escapeHtml(d.title)}</h2>
          <div class="discussion-card-meta" style="margin-bottom:var(--space-xl);">
            ${avatarHtml}
            <span>@${escapeHtml(author)}</span>
            <span>·</span>
            <span>${formatDate(d.createdAt)}</span>
            <span class="discussion-comments">💬 ${d.comments.totalCount}</span>
          </div>
          <div class="prose" style="line-height:1.8;">${d.bodyHTML}</div>`;

        // Mount Giscus for this discussion number
        const commentsDiv = document.getElementById('detail-comments');
        if (commentsDiv) {
          commentsDiv.innerHTML = '';
          const giscusScript = document.createElement('script');
          giscusScript.src = 'https://giscus.app/client.js';
          giscusScript.setAttribute('data-repo', 'orientpine/honeycombo');
          giscusScript.setAttribute('data-repo-id', 'R_kgDOR_fpgQ');
          giscusScript.setAttribute('data-category', '자유 발제');
          giscusScript.setAttribute('data-category-id', 'PLACEHOLDER_UPDATE_AFTER_CATEGORY_CREATION');
          giscusScript.setAttribute('data-mapping', 'number');
          giscusScript.setAttribute('data-term', String(number));
          giscusScript.setAttribute('data-strict', '0');
          giscusScript.setAttribute('data-reactions-enabled', '1');
          giscusScript.setAttribute('data-emit-metadata', '0');
          giscusScript.setAttribute('data-input-position', 'top');
          giscusScript.setAttribute('data-theme', 'preferred_color_scheme');
          giscusScript.setAttribute('data-lang', 'ko');
          giscusScript.crossOrigin = 'anonymous';
          giscusScript.async = true;
          commentsDiv.appendChild(giscusScript);
        }
      })
      .catch(function() {
        document.getElementById('detail-content').innerHTML = '<div class="empty-state">발제를 불러오지 못했습니다. <a href="https://github.com/orientpine/honeycombo/discussions" target="_blank" rel="noopener">GitHub에서 직접 보기 →</a></div>';
      });
  }

  // ---- Show list view ----
  function showList() {
    detailNode.hidden = true;
    listNode.closest('.community-list-section').hidden = false;
    writeArea.hidden = false;
  }

  // ---- Render loading state ----
  function renderLoading() {
    summaryNode.innerHTML = '<p>불러오는 중...</p>';
    listNode.innerHTML = `
      <article class="discussion-card skeleton-card">
        <div class="discussion-card-header"><span class="skeleton-line skeleton-title"></span></div>
        <div class="discussion-card-meta"><span class="skeleton-avatar"></span><span class="skeleton-line skeleton-author-line"></span><span class="skeleton-line skeleton-date-line"></span></div>
      </article>
      <article class="discussion-card skeleton-card">
        <div class="discussion-card-header"><span class="skeleton-line skeleton-title"></span></div>
        <div class="discussion-card-meta"><span class="skeleton-avatar"></span><span class="skeleton-line skeleton-author-line"></span><span class="skeleton-line skeleton-date-line"></span></div>
      </article>`;
  }

  // ---- Cursor-based pagination ----
  let nextCursor = null;
  let hasNextPage = false;

  function renderPagination() {
    if (!hasNextPage) {
      paginationNode.innerHTML = '';
      return;
    }
    paginationNode.innerHTML = `<div class="load-more-wrap">
      <button type="button" id="load-more-btn" class="btn">더 보기</button>
    </div>`;
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function() {
        loadMore();
      });
    }
  }

  async function loadMore() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = '불러오는 중...';
    }
    try {
      const url = '/api/discussions?first=20' + (nextCursor ? '&after=' + encodeURIComponent(nextCursor) : '');
      const response = await fetch(url, { credentials: 'same-origin' });
      const data = await response.json();
      const more = Array.isArray(data.discussions) ? data.discussions : [];
      more.forEach(function(d) {
        const author = d.author ? d.author.login : '알 수 없음';
        const avatarHtml = d.author && d.author.avatarUrl
          ? `<img src="${escapeHtml(d.author.avatarUrl)}" alt="" class="discussion-avatar" loading="lazy" />`
          : '';
        const articleHtml = `<article class="discussion-card" data-discussion-number="${d.number}">
          <div class="discussion-card-header"><h3 class="discussion-card-title">${escapeHtml(d.title)}</h3></div>
          <div class="discussion-card-meta">
            ${avatarHtml}
            <span>@${escapeHtml(author)}</span>
            <span>·</span>
            <span>${formatDate(d.createdAt)}</span>
            <span class="discussion-comments">💬 ${d.comments.totalCount}</span>
          </div>
        </article>`;
        listNode.insertAdjacentHTML('beforeend', articleHtml);
        const cards = listNode.querySelectorAll('.discussion-card');
        const newCard = cards[cards.length - 1];
        newCard.addEventListener('click', function() {
          const num = parseInt(newCard.getAttribute('data-discussion-number'), 10);
          if (num) showDetail(num);
        });
      });
      hasNextPage = data.pageInfo && data.pageInfo.hasNextPage;
      nextCursor = (data.pageInfo && data.pageInfo.endCursor) || null;
      renderPagination();
    } catch {
      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = '더 보기';
      }
    }
  }

  // ---- Load discussions ----
  async function loadDiscussions() {
    renderLoading();

    try {
      const cachedUser = getCachedUser();
      renderWriteArea(cachedUser);

      const response = await fetch('/api/discussions?first=20', { credentials: 'same-origin' });
      if (!response.ok) throw new Error();
      const data = await response.json();

      const discussions = Array.isArray(data.discussions) ? data.discussions : [];
      summaryNode.innerHTML = `<p>총 ${data.totalCount || 0}개의 발제</p>`;
      renderDiscussions(discussions);

      hasNextPage = data.pageInfo && data.pageInfo.hasNextPage;
      nextCursor = (data.pageInfo && data.pageInfo.endCursor) || null;
      renderPagination();

      // Also verify auth with server in background
      fetch('/api/auth/me', { credentials: 'same-origin' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(user) { if (user) renderWriteArea(user); })
        .catch(function() {});
    } catch {
      summaryNode.innerHTML = '<p>데이터를 불러오지 못했습니다.</p>';
      listNode.innerHTML = `<div class="empty-state">
        커뮤니티 발제를 불러오지 못했습니다.
        <br><a href="https://github.com/orientpine/honeycombo/discussions" target="_blank" rel="noopener" style="color:var(--color-primary)">GitHub에서 직접 보기 →</a>
      </div>`;
    }
  }

  loadDiscussions();
});