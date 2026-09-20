(() => {
  if (window.__CFF_LOOKER_HOOKED__) return;
  window.__CFF_LOOKER_HOOKED__ = true;
  window.__CFF_LOOKER_RESULTS__ = window.__CFF_LOOKER_RESULTS__ || {};

  const params = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
  const wantedRound = String(params.get('cffRound') || '').toUpperCase();
  const wantedDrop = String(params.get('cffDrop') || '').toUpperCase();

  const kindFromBody = body => {
    const text = String(body || '');
    if (text.includes('cd-k2u4sxyk7d')) return 'T1';
    if (text.includes('cd-01c6zwsrgd')) return 'P1';
    return '';
  };

  const rewrite = body => {
    if (!wantedRound || !wantedDrop || typeof body !== 'string') return body;
    let json;
    try { json = JSON.parse(body); } catch (_) { return body; }

    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (Array.isArray(value.stringValues)) {
        value.stringValues = value.stringValues.map(item => {
          const s = String(item || '');
          if (/^R\d+$/i.test(s)) return wantedRound;
          if (/^Q\d+$/i.test(s)) return wantedDrop;
          return item;
        });
      }
      Object.values(value).forEach(visit);
    };

    visit(json);
    return JSON.stringify(json);
  };

  const saveResponse = (kind, text, status) => {
    if (!kind) return;
    window.__CFF_LOOKER_RESULTS__[kind] = {
      kind,
      text: String(text || ''),
      status: Number(status || 0),
      capturedAt: Date.now(),
      pageUrl: location.href,
      round: wantedRound,
      drop: wantedDrop
    };
  };

  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      const url = input instanceof Request ? input.url : String(input || '');
      if (!url.includes('batchedDataV2')) return originalFetch.apply(this, arguments);

      const kind = kindFromBody(init?.body);
      if (!kind || typeof init?.body !== 'string') return originalFetch.apply(this, arguments);

      const nextInit = { ...(init || {}), body: rewrite(init.body) };
      const promise = originalFetch.call(this, input, nextInit);
      promise.then(response => {
        response.clone().text().then(text => saveResponse(kind, text, response.status)).catch(() => {});
      }).catch(() => {});
      return promise;
    } catch (_) {
      return originalFetch.apply(this, arguments);
    }
  };

  const XHR = window.XMLHttpRequest;
  if (XHR?.prototype) {
    const originalOpen = XHR.prototype.open;
    const originalSend = XHR.prototype.send;

    XHR.prototype.open = function(method, url) {
      this.__cffUrl = String(url || '');
      return originalOpen.apply(this, arguments);
    };

    XHR.prototype.send = function(body) {
      try {
        const kind = this.__cffUrl.includes('batchedDataV2') ? kindFromBody(body) : '';
        if (kind && typeof body === 'string') {
          const rewritten = rewrite(body);
          this.addEventListener('load', () => {
            try { saveResponse(kind, this.responseText, this.status); } catch (_) {}
          }, { once: true });
          return originalSend.call(this, rewritten);
        }
      } catch (_) {}
      return originalSend.apply(this, arguments);
    };
  }
})();