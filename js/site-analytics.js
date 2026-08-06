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
      sessionStorage.setItem(seenKey, '1');
      const payload = {
        path: path,
        title: String(document.title || 'Central Free Fire').slice(0, 160),
        views: { '.sv': { increment: 1 } },
        lastViewedAt: { '.sv': 'timestamp' }
      };
      try {
        await fetch(databaseURL + '/siteAnalytics/pages/' + key + '.json', {
          method: 'PATCH',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        });
      } catch (_) {}
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
