(function () {
  'use strict';

  const config = window.CFF_CONFIG || {};
  const databaseURL = String(config.firebase && config.firebase.databaseURL || '').replace(/\/$/, '');
  if (!databaseURL) return;

  function safeKey(value) {
    return String(value || '').trim().replace(/[.#$/\[\]]/g, '_').slice(0, 180);
  }

  async function request(path, options) {
    const response = await fetch(databaseURL + '/' + path + '.json', Object.assign({ cache: 'no-store' }, options || {}));
    if (!response.ok) throw new Error('Firebase HTTP ' + response.status);
    return response.status === 204 ? null : response.json();
  }

  function increment(path, delta) {
    return request(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ '.sv': { increment: delta } })
    });
  }

  function ensureStyle() {
    if (document.getElementById('cff-news-engagement-style')) return;
    const style = document.createElement('style');
    style.id = 'cff-news-engagement-style';
    style.textContent = '.cff-news-engagement{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:20px 0 4px;padding:14px 0;border-top:1px solid rgba(143,179,220,.18);border-bottom:1px solid rgba(143,179,220,.18)}.cff-news-like-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(0,200,255,.2);border-radius:999px;padding:9px 13px;background:rgba(0,200,255,.055);color:#dff5ff;font:900 .85rem/1 system-ui,sans-serif;cursor:pointer}.cff-news-like-btn.is-liked{background:rgba(255,72,107,.14);border-color:rgba(255,72,107,.35);color:#ff9bb0}.cff-news-like-btn:disabled{opacity:.6;cursor:wait}';
    document.head.appendChild(style);
  }

  async function mount(slug, target) {
    const id = safeKey(slug);
    if (!id || document.querySelector('[data-cff-news-engagement="' + CSS.escape(id) + '"]')) return;
    ensureStyle();

    let host = target;
    if (typeof host === 'string') host = document.querySelector(host);
    if (!host) host = document.querySelector('.news-meta, .meta, .news-summary, .summary');
    if (!host) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'cff-news-engagement';
    wrapper.dataset.cffNewsEngagement = id;
    wrapper.innerHTML = '<button type="button" class="cff-news-like-btn" data-cff-like>❤ <span data-cff-like-label>Curtir</span></button>';
    host.insertAdjacentElement('afterend', wrapper);

    const likeButton = wrapper.querySelector('[data-cff-like]');
    const likeLabel = wrapper.querySelector('[data-cff-like-label]');
    const likedKey = 'cff_news_liked_' + id;
    let liked = localStorage.getItem(likedKey) === '1';
    function renderLikeState() {
      likeButton.classList.toggle('is-liked', liked);
      if (likeLabel) likeLabel.textContent = liked ? 'Curtido' : 'Curtir';
    }
    renderLikeState();

    const sessionKey = 'cff_news_viewed_' + id;
    if (sessionStorage.getItem(sessionKey) !== '1') {
      sessionStorage.setItem(sessionKey, '1');
      try { await increment('newsMetrics/' + encodeURIComponent(id) + '/views', 1); } catch (_) {}
    }

    likeButton.addEventListener('click', async function () {
      if (likeButton.disabled) return;
      likeButton.disabled = true;
      const delta = liked ? -1 : 1;
      try {
        await increment('newsMetrics/' + encodeURIComponent(id) + '/likes', delta);
        liked = !liked;
        localStorage.setItem(likedKey, liked ? '1' : '0');
        renderLikeState();
      } catch (_) {
        likeButton.title = 'Não foi possível registrar agora';
      } finally {
        likeButton.disabled = false;
      }
    });
  }

  window.CFF_NEWS_ENGAGEMENT = { mount: mount };

  document.addEventListener('DOMContentLoaded', function () {
    const dynamicId = new URLSearchParams(location.search).get('id') || new URLSearchParams(location.search).get('slug');
    const staticMatch = location.pathname.match(/\/noticias\/([^/]+)\/?$/i);
    const slug = dynamicId || (staticMatch && staticMatch[1]);
    if (slug && !document.getElementById('noticia-dinamica')) mount(slug);
  }, { once: true });
})();
