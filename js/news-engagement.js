(function () {
  'use strict';

  const config = window.CFF_CONFIG || {};
  const databaseURL = String(config.firebase && config.firebase.databaseURL || '').replace(/\/$/, '');
  if (!databaseURL) return;

  function safeKey(value) {
    return String(value || '').trim().replace(/[.#$/\[\]]/g, '_').slice(0, 180);
  }

  function formatCount(value) {
    const number = Math.max(0, Number(value || 0));
    return number >= 1000000 ? (number / 1000000).toFixed(number >= 10000000 ? 0 : 1).replace('.0', '') + ' mi' :
      number >= 1000 ? (number / 1000).toFixed(number >= 10000 ? 0 : 1).replace('.0', '') + ' mil' : String(number);
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
    style.textContent = '.cff-news-engagement{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:20px 0 4px;padding:14px 0;border-top:1px solid rgba(143,179,220,.18);border-bottom:1px solid rgba(143,179,220,.18)}.cff-news-engagement-stat,.cff-news-like-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(0,200,255,.2);border-radius:999px;padding:9px 13px;background:rgba(0,200,255,.055);color:#dff5ff;font:900 .85rem/1 system-ui,sans-serif}.cff-news-like-btn{cursor:pointer}.cff-news-like-btn.is-liked{background:rgba(255,72,107,.14);border-color:rgba(255,72,107,.35);color:#ff9bb0}.cff-news-like-btn:disabled{opacity:.6;cursor:wait}';
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
    wrapper.innerHTML = '<span class="cff-news-engagement-stat" title="Visualizações desta notícia">👁 <strong data-cff-views>0</strong> visualizações</span><button type="button" class="cff-news-like-btn" data-cff-like>❤ <strong data-cff-likes>0</strong> curtidas</button>';
    host.insertAdjacentElement('afterend', wrapper);

    const viewsEl = wrapper.querySelector('[data-cff-views]');
    const likesEl = wrapper.querySelector('[data-cff-likes]');
    const likeButton = wrapper.querySelector('[data-cff-like]');
    const likedKey = 'cff_news_liked_' + id;
    let liked = localStorage.getItem(likedKey) === '1';
    likeButton.classList.toggle('is-liked', liked);

    async function refresh() {
      try {
        const metrics = await request('newsMetrics/' + encodeURIComponent(id));
        viewsEl.textContent = formatCount(metrics && metrics.views);
        likesEl.textContent = formatCount(metrics && metrics.likes);
      } catch (_) {}
    }

    const sessionKey = 'cff_news_viewed_' + id;
    if (sessionStorage.getItem(sessionKey) !== '1') {
      sessionStorage.setItem(sessionKey, '1');
      try { await increment('newsMetrics/' + encodeURIComponent(id) + '/views', 1); } catch (_) {}
    }
    await refresh();

    likeButton.addEventListener('click', async function () {
      if (likeButton.disabled) return;
      likeButton.disabled = true;
      const delta = liked ? -1 : 1;
      try {
        await increment('newsMetrics/' + encodeURIComponent(id) + '/likes', delta);
        liked = !liked;
        localStorage.setItem(likedKey, liked ? '1' : '0');
        likeButton.classList.toggle('is-liked', liked);
        await refresh();
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
