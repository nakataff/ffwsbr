(function () {
  'use strict';

  if (/\/interacoes\.html$/i.test(location.pathname) && !document.querySelector('script[data-cff-community-checkin]')) {
    const script = document.createElement('script');
    script.src = 'js/community-checkin.js?v=20260908-daily-checkin-v1';
    script.async = false;
    script.dataset.cffCommunityCheckin = '1';
    document.head.appendChild(script);
  }
})();

(function () {
  'use strict';

  const isNews = /\/noticia\.html$/i.test(location.pathname) || /^\/noticias\/[^/]+\/?$/i.test(location.pathname) || /^\/noticia\/[^/]+\/?$/i.test(location.pathname);
  if (isNews && !document.querySelector('script[data-cff-news-comments]')) {
    const script = document.createElement('script');
    script.src = '/js/news-comments.js?v=20260909-news-comments-v3';
    script.async = false;
    script.dataset.cffNewsComments = '1';
    document.head.appendChild(script);
  }
})();

(function () {
  'use strict';

  function start() {
    const config = window.CFF_CONFIG || {};
    const databaseURL = String(config.firebase && config.firebase.databaseURL || '').replace(/\/$/, '');
    if (!databaseURL || /(^|\/)admin\.html$/i.test(location.pathname)) return;

    function safeKey(value) {
      try {
        return btoa(unescape(encodeURIComponent(value))).replace(/[+/=]/g, '_').slice(0, 180);
      } catch (_) {
        return String(value || '').replace(/[.#$/\[\]/]/g, '_').slice(0, 180);
      }
    }

    function currentPath() {
      const hash = location.hash && location.hash !== '#home' ? location.hash : '';
      return location.pathname.replace(/\/+$/, '/') + hash;
    }

    async function track() {
      const path = currentPath();
      const key = safeKey(path);
      const seenKey = 'cff_page_seen_' + key;
      if (sessionStorage.getItem(seenKey) === '1') return;

      const payload = {
        path: path,
        title: String(document.title || 'Central Free Fire').slice(0, 160),
        views: { '.sv': { increment: 1 } },
        lastViewedAt: { '.sv': 'timestamp' }
      };

      try {
        const response = await fetch(databaseURL + '/siteAnalytics/pages/' + key + '.json', {
          method: 'PATCH',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        });
        if (!response.ok) throw new Error('Analytics write failed: HTTP ' + response.status);
        sessionStorage.setItem(seenKey, '1');
      } catch (error) {
        console.warn('[CFF analytics] não foi possível registrar a visualização', error);
      }
    }

    let queued = null;
    function queueTrack() {
      if (queued) clearTimeout(queued);
      queued = setTimeout(track, 450);
    }

    const replaceState = history.replaceState;
    const pushState = history.pushState;
    history.replaceState = function () { const result = replaceState.apply(history, arguments); queueTrack(); return result; };
    history.pushState = function () { const result = pushState.apply(history, arguments); queueTrack(); return result; };
    addEventListener('hashchange', queueTrack, { passive: true });
    track();
  }

  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 3500 });
  else setTimeout(start, 1600);
})();