(() => {
  'use strict';

  if (!/interacoes\.html$/i.test(location.pathname)) return;

  const API = 'https://cff-instagram-community.nakataffb4.workers.dev';
  const HISTORY_LIMIT = 24;
  const CURRENT_RANKING_LIMIT = 20;

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  function dateFromKey(key) {
    const [y, m, d] = String(key || '').split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d, 12));
  }

  function shortDate(key) {
    const date = dateFromKey(key);
    if (!date) return '';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
      .format(date).replace('.', '').toUpperCase();
  }

  function periodLabel(item) {
    const start = shortDate(item?.weekStart);
    const end = shortDate(item?.weekEnd);
    return start && end ? `${start} — ${end}` : String(item?.weekStart || 'SEMANA');
  }

  function injectCss() {
    if (document.getElementById('cff-week-history-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-week-history-css';
    style.textContent = `
      .cff-week-history{margin-top:18px;border:1px solid var(--ig-border,#1d2a42);border-radius:18px;background:linear-gradient(145deg,rgba(15,23,38,.96),rgba(7,12,22,.97));overflow:hidden;box-shadow:0 18px 55px rgba(0,0,0,.20)}
      .cff-week-history-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid var(--ig-border,#1d2a42)}
      .cff-week-history-head h2{margin:0;color:#fff;font-size:.9rem;font-weight:1000;letter-spacing:1.2px;text-transform:uppercase}
      .cff-week-history-head span{color:#718eae;font-size:.68rem;font-weight:800}
      .cff-week-history-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px}
      .cff-week-history-item{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(255,255,255,.025);padding:11px 12px;color:inherit;text-align:left;cursor:pointer;transition:.15s ease}
      .cff-week-history-item:hover{border-color:rgba(0,200,255,.38);background:rgba(0,200,255,.05);transform:translateY(-1px)}
      .cff-week-history-cup{display:flex;width:38px;height:38px;align-items:center;justify-content:center;border-radius:10px;background:rgba(255,200,61,.10);color:#ffc83d;font-size:1rem}
      .cff-week-history-copy{min-width:0}
      .cff-week-history-period{display:block;color:#6683a3;font-size:.61rem;font-weight:950;letter-spacing:.06em;text-transform:uppercase}
      .cff-week-history-user{display:block;margin-top:3px;color:#fff;font-size:.82rem;font-weight:1000;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cff-week-history-points{color:#00c8ff;font-size:.76rem;font-weight:1000;white-space:nowrap}
      .cff-week-history-empty{padding:22px;color:#7692b1;font-size:.78rem;font-weight:750;text-align:center}
      .cff-week-history-detail{border-top:1px solid var(--ig-border,#1d2a42);padding:16px 18px;background:rgba(0,0,0,.12)}
      .cff-week-history-detail[hidden]{display:none}
      .cff-week-history-detail-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
      .cff-week-history-detail-head strong{color:#fff;font-size:.8rem;font-weight:1000;text-transform:uppercase}
      .cff-week-history-close{border:1px solid rgba(255,255,255,.12);border-radius:8px;background:transparent;color:#9bb0c8;padding:6px 9px;font-size:.66rem;font-weight:900;cursor:pointer}
      .cff-week-history-ranking{display:grid;gap:5px}
      .cff-week-history-rank{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.028);font-size:.75rem}
      .cff-week-history-rank b{color:#7895b4}.cff-week-history-rank strong{color:#eaf4ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cff-week-history-rank span{color:#00c8ff;font-weight:1000}
      .cff-week-history-rank:first-child{background:rgba(255,200,61,.07)}.cff-week-history-rank:first-child b{color:#ffc83d}
      .cff-ranking-scope-note{padding:10px 14px;border-top:1px solid rgba(29,42,66,.55);background:rgba(0,200,255,.025);color:#7895b5;font-size:.7rem;font-weight:750;line-height:1.4}
      .cff-ranking-scope-note strong{color:#bdefff}
      @media(max-width:900px){.cff-week-history-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.cff-week-history-list{grid-template-columns:1fr;padding:10px}.cff-week-history-head{padding:15px}.cff-week-history-item{padding:10px}.cff-week-history-detail{padding:13px}.cff-ranking-scope-note{font-size:.67rem}}
    `;
    document.head.appendChild(style);
  }

  function setupCurrentRankingView() {
    const table = document.getElementById('ig-table');
    const tbody = document.getElementById('ig-tbody');
    const search = document.getElementById('ig-search');
    const card = table?.closest('.ig-card');
    const title = card?.querySelector('.ig-card-head h2');
    const wrap = table?.closest('.ig-table-wrap');
    if (!table || !tbody || !search || !card || !wrap || card.dataset.top20Ready === '1') return;

    card.dataset.top20Ready = '1';
    search.placeholder = 'Digite @ para consultar qualquer participante';

    const note = document.createElement('div');
    note.className = 'cff-ranking-scope-note';
    note.id = 'cff-ranking-scope-note';
    wrap.appendChild(note);

    const apply = () => {
      const query = String(search.value || '').trim().replace(/^@+/, '');
      const rows = [...tbody.querySelectorAll('tr')];
      rows.forEach((row, index) => {
        row.hidden = !query && index >= CURRENT_RANKING_LIMIT;
      });

      if (title) title.textContent = query ? 'Resultado da busca' : `Classificação • Top ${CURRENT_RANKING_LIMIT}`;
      note.innerHTML = query
        ? '<strong>Consulta individual:</strong> a busca verifica os participantes registrados neste período e mantém a posição real no ranking.'
        : `<strong>Top ${CURRENT_RANKING_LIMIT} em destaque.</strong> Para não poluir a lista com interações esporádicas, os demais participantes ficam ocultos. Digite um @ na busca para consultar a pontuação de qualquer perfil.`;
    };

    new MutationObserver(apply).observe(tbody, { childList: true, subtree: true });
    search.addEventListener('input', () => requestAnimationFrame(apply));
    apply();
  }

  function mount() {
    if (document.getElementById('cff-week-history')) return document.getElementById('cff-week-history');
    const grid = document.querySelector('.ig-grid');
    if (!grid) return null;
    injectCss();
    setupCurrentRankingView();
    const section = document.createElement('section');
    section.className = 'cff-week-history';
    section.id = 'cff-week-history';
    section.innerHTML = `
      <div class="cff-week-history-head"><h2>🏆 Campeões semanais</h2><span>As semanas encerradas ficam salvas aqui</span></div>
      <div class="cff-week-history-list" id="cff-week-history-list"><div class="cff-week-history-empty">Carregando histórico...</div></div>
      <div class="cff-week-history-detail" id="cff-week-history-detail" hidden></div>`;
    grid.insertAdjacentElement('afterend', section);
    return section;
  }

  function normalizeRanking(raw) {
    const source = raw?.users && typeof raw.users === 'object' ? raw.users : {};
    return Object.entries(source).map(([id, item]) => ({
      id,
      username: String(item?.username || 'usuario').replace(/^@+/, ''),
      points: num(item?.points),
      stories: num(item?.storyMentions),
      comments: num(item?.comments),
    })).sort((a, b) => b.points - a.points || b.stories - a.stories || b.comments - a.comments || a.username.localeCompare(b.username, 'pt-BR'));
  }

  async function openWeek(item) {
    const detail = document.getElementById('cff-week-history-detail');
    if (!detail) return;
    detail.hidden = false;
    detail.innerHTML = `<div class="cff-week-history-detail-head"><strong>${esc(periodLabel(item))}</strong><button type="button" class="cff-week-history-close">Fechar</button></div><div class="cff-week-history-empty">Carregando ranking da semana...</div>`;
    detail.querySelector('.cff-week-history-close')?.addEventListener('click', () => { detail.hidden = true; detail.innerHTML = ''; });
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      const response = await fetch(`${API}/api/ranking?period=week&week=${encodeURIComponent(item.weekStart)}&_=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const ranking = normalizeRanking(await response.json()).slice(0, 10);
      detail.innerHTML = `<div class="cff-week-history-detail-head"><strong>${esc(periodLabel(item))} • TOP 10</strong><button type="button" class="cff-week-history-close">Fechar</button></div>${ranking.length ? `<div class="cff-week-history-ranking">${ranking.map((user, index) => `<div class="cff-week-history-rank"><b>${index + 1}º</b><strong>@${esc(user.username)}</strong><span>${user.points.toLocaleString('pt-BR')} pts</span></div>`).join('')}</div>` : '<div class="cff-week-history-empty">Não há dados para essa semana.</div>'}`;
      detail.querySelector('.cff-week-history-close')?.addEventListener('click', () => { detail.hidden = true; detail.innerHTML = ''; });
    } catch (error) {
      console.error('[CFF weekly history]', error);
      detail.innerHTML = `<div class="cff-week-history-detail-head"><strong>${esc(periodLabel(item))}</strong><button type="button" class="cff-week-history-close">Fechar</button></div><div class="cff-week-history-empty">Não foi possível carregar essa semana agora.</div>`;
      detail.querySelector('.cff-week-history-close')?.addEventListener('click', () => { detail.hidden = true; detail.innerHTML = ''; });
    }
  }

  function render(history) {
    const list = document.getElementById('cff-week-history-list');
    if (!list) return;
    if (!history.length) {
      list.innerHTML = '<div class="cff-week-history-empty">Ainda não há uma semana encerrada no histórico.</div>';
      return;
    }
    list.innerHTML = history.map((item, index) => {
      const winner = item?.winner || {};
      return `<button type="button" class="cff-week-history-item" data-index="${index}"><span class="cff-week-history-cup">🏆</span><span class="cff-week-history-copy"><small class="cff-week-history-period">${esc(periodLabel(item))}</small><strong class="cff-week-history-user">@${esc(String(winner.username || 'usuario').replace(/^@+/, ''))}</strong></span><span class="cff-week-history-points">${num(winner.points).toLocaleString('pt-BR')} pts</span></button>`;
    }).join('');
    list.querySelectorAll('[data-index]').forEach((button) => {
      button.addEventListener('click', () => openWeek(history[Number(button.dataset.index)]));
    });
  }

  async function load() {
    if (!mount()) return;
    const list = document.getElementById('cff-week-history-list');
    try {
      const response = await fetch(`${API}/api/ranking/history?limit=${HISTORY_LIMIT}&_=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json();
      render(Array.isArray(raw?.history) ? raw.history : []);
    } catch (error) {
      console.error('[CFF weekly history]', error);
      if (list) list.innerHTML = '<div class="cff-week-history-empty">Histórico temporariamente indisponível.</div>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once: true });
  else load();
})();

(() => {
  if (!/interacoes\.html$/i.test(location.pathname)) return;
  if (document.querySelector('script[data-cff-community-prediction]')) return;
  const script = document.createElement('script');
  script.src = 'js/community-prediction.js?v=20260914-prediction-v1';
  script.dataset.cffCommunityPrediction = '1';
  document.head.appendChild(script);
})();
