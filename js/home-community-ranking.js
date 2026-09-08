(() => {
  'use strict';

  const API = 'https://cff-instagram-community.nakataffb4.workers.dev/api/ranking?period=week';
  const FULL_RANKING_URL = 'interacoes.html';
  const REFRESH_MS = 5 * 60 * 1000;

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  function injectCss() {
    if (document.getElementById('cff-home-community-ranking-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-home-community-ranking-css';
    style.textContent = `
      .home-rail-interactions{position:relative;overflow:hidden;cursor:pointer}
      .home-rail-interactions::before{content:"";position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,#00c8ff,rgba(0,200,255,.25),transparent);pointer-events:none}
      .home-rail-interactions h3{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .home-community-week{color:#6f91b5;font-size:.56rem;font-weight:950;letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}
      .home-community-body{display:flex!important;flex-direction:column;gap:0;padding:4px 10px 7px!important}
      .home-community-row{display:grid;grid-template-columns:27px minmax(0,1fr) auto;align-items:center;gap:8px;min-height:38px;border-bottom:1px solid rgba(255,255,255,.055)}
      .home-community-row:last-of-type{border-bottom:0}
      .home-community-pos{display:flex;width:25px;height:25px;align-items:center;justify-content:center;border-radius:50%;background:rgba(0,200,255,.07);color:#84dcff;font-size:.68rem;font-weight:1000}
      .home-community-row:first-child .home-community-pos{background:rgba(255,200,61,.12);color:#ffc83d}
      .home-community-user{min-width:0;overflow:hidden;color:#fff;font-size:.73rem;font-weight:950;text-overflow:ellipsis;white-space:nowrap}
      .home-community-points{color:#00c8ff;font-size:.72rem;font-weight:1000;white-space:nowrap}
      .home-community-empty{padding:18px 8px;color:#718aa8;font-size:.7rem;font-weight:800;line-height:1.45;text-align:center}
      .home-community-link{display:flex;min-height:34px;align-items:center;justify-content:center;border-top:1px solid rgba(255,255,255,.065);background:rgba(0,200,255,.045);color:#00c8ff;font-size:.66rem;font-weight:1000;letter-spacing:.075em;text-decoration:none;text-transform:uppercase}
      .home-community-link:hover{background:rgba(0,200,255,.085);color:#bcefff}
      .home-rail-interactions:focus-visible{outline:2px solid #00c8ff;outline-offset:2px}
      @media(max-width:900px){.home-left-rail .home-rail-interactions{grid-column:1 / -1}}
      @media(max-width:620px){.home-left-rail .home-rail-interactions{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function dateLabel(period) {
    const start = String(period?.weekStart || '');
    const end = String(period?.weekEnd || '');
    if (!start || !end) return 'SEMANA';
    const fmt = (key) => {
      const [y, m, d] = key.split('-').map(Number);
      if (!y || !m || !d) return '';
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' })
        .format(new Date(Date.UTC(y, m - 1, d, 12))).replace('.', '').toUpperCase();
    };
    const a = fmt(start), b = fmt(end);
    return a && b ? `${a}–${b}` : 'SEMANA';
  }

  function normalize(raw) {
    const source = raw?.users && typeof raw.users === 'object' ? raw.users : {};
    return Object.entries(source).map(([id, item]) => ({
      id,
      username: String(item?.username || 'usuario').replace(/^@+/, ''),
      points: num(item?.points),
      stories: num(item?.storyMentions),
      comments: num(item?.comments),
    })).sort((a, b) => b.points - a.points || b.stories - a.stories || b.comments - a.comments || a.username.localeCompare(b.username, 'pt-BR'));
  }

  function mount() {
    const rail = document.querySelector('.home-left-rail');
    const live = rail?.querySelector('.home-rail-live');
    if (!rail || !live) return null;
    let card = document.getElementById('home-community-ranking');
    if (card) return card;

    injectCss();
    card = document.createElement('section');
    card.id = 'home-community-ranking';
    card.className = 'home-widget home-rail-interactions';
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', 'Ver ranking completo de interações');
    card.innerHTML = `
      <h3><span>🏆 Ranking de Interações</span><small class="home-community-week" id="home-community-week">SEMANA</small></h3>
      <div class="home-widget-body home-community-body" id="home-community-body">
        <div class="home-community-empty">Carregando Top 3 da comunidade...</div>
      </div>
      <a class="home-community-link" href="${FULL_RANKING_URL}">VER RANKING COMPLETO →</a>`;

    live.parentNode.insertBefore(card, live);

    card.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      location.href = FULL_RANKING_URL;
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        location.href = FULL_RANKING_URL;
      }
    });

    return card;
  }

  function renderRows(users) {
    const body = document.getElementById('home-community-body');
    if (!body) return;
    const top = users.slice(0, 3);
    if (!top.length) {
      body.innerHTML = '<div class="home-community-empty">O ranking semanal ainda não tem interações registradas.</div>';
      return;
    }
    body.innerHTML = top.map((user, index) => `
      <div class="home-community-row">
        <span class="home-community-pos">${index + 1}º</span>
        <strong class="home-community-user">@${esc(user.username)}</strong>
        <span class="home-community-points">${user.points.toLocaleString('pt-BR')} pts</span>
      </div>`).join('');
  }

  async function load() {
    if (!mount()) return;
    try {
      const response = await fetch(`${API}&_=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();
      renderRows(normalize(raw));
      const week = document.getElementById('home-community-week');
      if (week) week.textContent = dateLabel(raw?.period);
    } catch (error) {
      console.error('[Home community ranking]', error);
      const body = document.getElementById('home-community-body');
      if (body) body.innerHTML = '<div class="home-community-empty">Não foi possível atualizar o ranking agora.</div>';
    }
  }

  function boot() {
    load();
    setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
