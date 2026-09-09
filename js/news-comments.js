(function () {
  'use strict';

  const VERSION = '20260909-news-comments-v1';
  const MAX_COMMENTS = 50;
  const COOLDOWN_MS = 30000;
  const NAME_KEY = 'cff_comment_name_v1';
  const LAST_SEND_KEY = 'cff_comment_last_send_v1';

  function isNewsPage() {
    return /\/noticia\.html$/i.test(location.pathname) || /^\/noticias\/[^/]+\/?$/i.test(location.pathname);
  }

  if (!isNewsPage()) return;

  const config = window.CFF_CONFIG || {};
  const databaseURL = String(config.firebase && config.firebase.databaseURL || '').replace(/\/$/, '');
  if (!databaseURL) return;

  function getSlug() {
    const staticMatch = location.pathname.match(/^\/noticias\/([^/]+)\/?$/i);
    if (staticMatch) return decodeURIComponent(staticMatch[1]);
    const params = new URLSearchParams(location.search);
    return String(params.get('id') || params.get('slug') || '').trim();
  }

  function safeSlug(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 160);
  }

  function randomId() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return 'c_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }

  function clientId() {
    const key = 'cff_comment_client_v1';
    try {
      let value = localStorage.getItem(key);
      if (!value) {
        value = randomId().replace(/^c_/, 'u_');
        localStorage.setItem(key, value);
      }
      return value;
    } catch (_) {
      return 'u_' + Math.random().toString(36).slice(2, 14);
    }
  }

  function escapeText(value) {
    return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function formatDate(value) {
    const date = new Date(Number(value || 0));
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).replace(',', ' •');
  }

  function injectStyles() {
    if (document.getElementById('cff-news-comments-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-news-comments-css';
    style.textContent = `
      .cff-comments{margin:28px 0 0;border:1px solid rgba(0,200,255,.18);border-radius:18px;background:rgba(9,17,31,.86);overflow:hidden;color:#f4f9ff}
      .cff-comments-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid rgba(0,200,255,.14);background:linear-gradient(135deg,rgba(0,200,255,.09),rgba(255,255,255,.018))}
      .cff-comments-kicker{color:#00c8ff;font-size:.72rem;font-weight:1000;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:3px}
      .cff-comments-title{margin:0;color:#fff;font-size:1.12rem;line-height:1.1;font-weight:1000;text-transform:uppercase}
      .cff-comments-count{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:32px;padding:0 10px;border:1px solid rgba(0,200,255,.25);border-radius:999px;background:rgba(0,200,255,.07);color:#7edfff;font-size:.8rem;font-weight:1000}
      .cff-comments-body{padding:18px 20px 20px}
      .cff-comment-form{display:grid;grid-template-columns:minmax(160px,.72fr) minmax(0,1.7fr) auto;gap:10px;align-items:end;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.025)}
      .cff-comment-field{display:grid;gap:6px;min-width:0}.cff-comment-field label{color:#9bb9d8;font-size:.69rem;font-weight:950;letter-spacing:.65px;text-transform:uppercase}
      .cff-comment-input,.cff-comment-text{width:100%;min-width:0;border:1px solid #253650;border-radius:11px;background:#08111f;color:#fff;outline:none;padding:10px 11px;font:inherit}
      .cff-comment-text{height:44px;min-height:44px;max-height:120px;resize:vertical;line-height:1.35}
      .cff-comment-input:focus,.cff-comment-text:focus{border-color:#00c8ff;box-shadow:0 0 0 3px rgba(0,200,255,.10)}
      .cff-comment-submit{min-height:44px;border:0;border-radius:11px;padding:0 16px;background:#00c8ff;color:#00131b;font-weight:1000;white-space:nowrap;cursor:pointer}
      .cff-comment-submit:disabled{opacity:.48;cursor:not-allowed}
      .cff-comment-note{grid-column:1/-1;min-height:17px;color:#7897b8;font-size:.72rem;line-height:1.4}.cff-comment-note.is-error{color:#ff8f9b}.cff-comment-note.is-success{color:#72e6ad}
      .cff-comments-list{display:grid;gap:10px;margin-top:15px}
      .cff-comment{padding:13px 14px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:#0b1422}
      .cff-comment-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px}.cff-comment-author{min-width:0;color:#fff;font-size:.9rem;font-weight:1000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cff-comment-time{flex:0 0 auto;color:#6f8dac;font-size:.66rem;font-weight:800}
      .cff-comment-text-body{color:#dcecff;font-size:.91rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
      .cff-comments-empty,.cff-comments-loading{padding:18px 8px 5px;color:#7897b8;text-align:center;font-size:.82rem;font-weight:800}
      @media(max-width:760px){.cff-comments{margin-top:20px;border-radius:15px}.cff-comments-head{padding:14px 15px}.cff-comments-body{padding:14px}.cff-comment-form{grid-template-columns:1fr;padding:11px;gap:9px}.cff-comment-note{grid-column:1}.cff-comment-submit{width:100%}.cff-comment-text{height:76px;min-height:76px}.cff-comment-top{align-items:flex-start;flex-direction:column;gap:2px}.cff-comment-time{font-size:.64rem}}
    `;
    document.head.appendChild(style);
  }

  function buildSection() {
    if (document.getElementById('cff-news-comments')) return document.getElementById('cff-news-comments');
    const section = document.createElement('section');
    section.id = 'cff-news-comments';
    section.className = 'cff-comments';
    section.innerHTML = `
      <div class="cff-comments-head">
        <div><div class="cff-comments-kicker">Comunidade</div><h2 class="cff-comments-title">Comentários</h2></div>
        <span class="cff-comments-count" id="cff-comments-count">0</span>
      </div>
      <div class="cff-comments-body">
        <form class="cff-comment-form" id="cff-comment-form">
          <div class="cff-comment-field"><label for="cff-comment-name">Nome ou @</label><input class="cff-comment-input" id="cff-comment-name" maxlength="36" autocomplete="nickname" placeholder="@seuinstagram" required></div>
          <div class="cff-comment-field"><label for="cff-comment-text">Seu comentário</label><textarea class="cff-comment-text" id="cff-comment-text" maxlength="600" placeholder="Comente sobre a notícia..." required></textarea></div>
          <button class="cff-comment-submit" id="cff-comment-submit" type="submit">COMENTAR</button>
          <div class="cff-comment-note" id="cff-comment-note">Comentários são públicos. Máximo de 600 caracteres.</div>
        </form>
        <div class="cff-comments-list" id="cff-comments-list"><div class="cff-comments-loading">Carregando comentários...</div></div>
      </div>`;
    return section;
  }

  function mount(section) {
    const more = document.querySelector('.more-news');
    if (more && more.parentNode) {
      more.parentNode.insertBefore(section, more);
      return true;
    }
    const dynamic = document.getElementById('noticia-dinamica');
    if (dynamic && dynamic.parentNode) {
      dynamic.insertAdjacentElement('afterend', section);
      return true;
    }
    const article = document.querySelector('article.article-shell, article.news-article, article');
    if (article && article.parentNode) {
      article.insertAdjacentElement('afterend', section);
      return true;
    }
    return false;
  }

  const slug = safeSlug(getSlug());
  if (!slug) return;
  injectStyles();
  const section = buildSection();
  if (!mount(section)) {
    let attempts = 0;
    const timer = setInterval(function () {
      if (mount(section) || ++attempts > 40) clearInterval(timer);
    }, 250);
  }

  const els = {
    form: section.querySelector('#cff-comment-form'),
    name: section.querySelector('#cff-comment-name'),
    text: section.querySelector('#cff-comment-text'),
    submit: section.querySelector('#cff-comment-submit'),
    note: section.querySelector('#cff-comment-note'),
    list: section.querySelector('#cff-comments-list'),
    count: section.querySelector('#cff-comments-count')
  };

  try { els.name.value = String(localStorage.getItem(NAME_KEY) || '').slice(0, 36); } catch (_) {}

  const endpoint = databaseURL + '/newsComments/' + encodeURIComponent(slug);

  function setNote(text, type) {
    els.note.textContent = text;
    els.note.classList.toggle('is-error', type === 'error');
    els.note.classList.toggle('is-success', type === 'success');
  }

  function renderComments(rows) {
    els.count.textContent = String(rows.length);
    els.list.innerHTML = '';
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'cff-comments-empty';
      empty.textContent = 'Seja o primeiro a comentar.';
      els.list.appendChild(empty);
      return;
    }
    rows.forEach(function (item) {
      const card = document.createElement('article');
      card.className = 'cff-comment';
      const top = document.createElement('div');
      top.className = 'cff-comment-top';
      const author = document.createElement('strong');
      author.className = 'cff-comment-author';
      author.textContent = item.name || 'Visitante';
      const time = document.createElement('time');
      time.className = 'cff-comment-time';
      time.textContent = formatDate(item.createdAt);
      const text = document.createElement('div');
      text.className = 'cff-comment-text-body';
      text.textContent = item.text || '';
      top.append(author, time);
      card.append(top, text);
      els.list.appendChild(card);
    });
  }

  async function loadComments() {
    try {
      const query = '?orderBy=%22createdAt%22&limitToLast=' + MAX_COMMENTS;
      const response = await fetch(endpoint + '.json' + query, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const raw = await response.json();
      const rows = Object.entries(raw || {}).map(function ([id, item]) {
        return { id: id, name: escapeText(item && item.name), text: String(item && item.text || '').trim(), createdAt: Number(item && item.createdAt || 0) };
      }).filter(function (item) { return item.text; }).sort(function (a, b) { return b.createdAt - a.createdAt; });
      renderComments(rows);
    } catch (_) {
      els.list.innerHTML = '<div class="cff-comments-empty">Comentários indisponíveis no momento.</div>';
    }
  }

  els.form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const name = escapeText(els.name.value).slice(0, 36);
    const text = String(els.text.value || '').replace(/\r/g, '').trim().slice(0, 600);
    if (name.length < 2) return setNote('Digite um nome ou @ válido.', 'error');
    if (text.length < 2) return setNote('Escreva um comentário antes de enviar.', 'error');

    try {
      const last = Number(localStorage.getItem(LAST_SEND_KEY) || 0);
      const wait = COOLDOWN_MS - (Date.now() - last);
      if (wait > 0) return setNote('Aguarde ' + Math.ceil(wait / 1000) + 's para comentar novamente.', 'error');
    } catch (_) {}

    els.submit.disabled = true;
    setNote('Enviando comentário...');
    const id = randomId();
    const payload = { name: name, text: text, createdAt: Date.now(), clientId: clientId() };
    try {
      const response = await fetch(endpoint + '/' + encodeURIComponent(id) + '.json', {
        method: 'PUT', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      try {
        localStorage.setItem(NAME_KEY, name);
        localStorage.setItem(LAST_SEND_KEY, String(Date.now()));
      } catch (_) {}
      els.text.value = '';
      setNote('Comentário publicado!', 'success');
      await loadComments();
    } catch (_) {
      setNote('Não foi possível publicar agora. Tente novamente em instantes.', 'error');
    } finally {
      els.submit.disabled = false;
    }
  });

  loadComments();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loadComments(); });
  window.CFF_NEWS_COMMENTS_VERSION = VERSION;
})();
