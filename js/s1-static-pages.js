(() => {
  'use strict';

  const BUILD = '20260907-s1-static-pages-v2';
  const STATIC_PAGES = new Set(['equipes', 'comparar-1v1']);
  const state = {
    loading: null,
    ready: false,
    teams: [],
    meta: {},
    players: [],
    byName: new Map(),
    selectionTab: 'torneio',
    compareStage: 'geral',
    compareRole: 'all',
    compareP1: '',
    compareP2: ''
  };

  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const norm = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const num = value => Number(value) || 0;
  const fmt = value => Math.round(num(value)).toLocaleString('pt-BR');

  function injectCss() {
    if (document.getElementById('cff-s1-static-pages-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-s1-static-pages-css';
    style.textContent = `
      .s1-static-selection-card{position:relative;overflow:hidden;min-height:330px;border:1px solid rgba(0,200,255,.24);border-radius:18px;background:linear-gradient(155deg,rgba(0,200,255,.10),rgba(5,10,18,.96) 48%,rgba(255,255,255,.025));cursor:pointer;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
      .s1-static-selection-card:hover{transform:translateY(-3px);border-color:rgba(0,200,255,.65);box-shadow:0 15px 36px rgba(0,0,0,.24)}
      .s1-static-selection-photo{position:absolute;right:-12px;bottom:0;width:72%;height:78%;object-fit:contain;object-position:right bottom;filter:drop-shadow(0 12px 18px rgba(0,0,0,.35));z-index:1}
      .s1-static-selection-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,10,18,.98) 0%,rgba(5,10,18,.86) 43%,rgba(5,10,18,.12) 72%,transparent 100%);z-index:2}
      .s1-static-selection-info{position:relative;z-index:3;display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-height:330px;padding:24px 45% 22px 22px;box-sizing:border-box}
      .s1-static-selection-role{display:inline-flex;padding:5px 9px;border-radius:999px;background:var(--accent,#00c8ff);color:#00131d;font-size:.68rem;font-weight:1000;letter-spacing:.8px;text-transform:uppercase}
      .s1-static-selection-info h3{margin:6px 0 0;color:#fff;font-size:1.55rem;line-height:1;font-weight:1000}
      .s1-static-selection-team{display:flex;align-items:center;gap:8px;color:#9eb6cd;font-size:.78rem;font-weight:900}
      .s1-static-selection-team img{width:24px;height:24px;object-fit:contain}
      .s1-static-selection-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;width:100%;margin-top:auto}
      .s1-static-selection-stat{padding:8px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:rgba(255,255,255,.035)}
      .s1-static-selection-stat small{display:block;color:#7f96ad;font-size:.58rem;font-weight:950;text-transform:uppercase;letter-spacing:.6px}
      .s1-static-selection-stat strong{display:block;margin-top:2px;color:#fff;font-size:.92rem;font-weight:1000}
      .s1-static-archive-note{margin-top:12px;color:#7890a8;font-size:.72rem;font-weight:800;text-align:center}
      .s1-static-compare-filter{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px 0}
      .s1-static-compare-picker{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:end;gap:14px;margin:8px 0 20px}
      .s1-static-compare-picker>b{padding-bottom:12px;color:var(--accent,#00c8ff);font-size:1.08rem;font-weight:1000}
      .s1-static-select-label{display:grid;gap:7px;color:#8fa6bd;font-size:.7rem;font-weight:950;text-transform:uppercase;letter-spacing:.7px}
      .s1-static-select-label select{width:100%;height:44px;padding:0 12px;border:1px solid var(--border,rgba(255,255,255,.12));border-radius:10px;background:#09111d;color:#fff;font-weight:850;outline:none}
      .s1-static-select-label select:focus{border-color:var(--accent,#00c8ff)}
      .s1-static-page-error{padding:28px;border:1px solid rgba(255,80,100,.28);border-radius:16px;background:rgba(255,80,100,.06);color:#ff9ba8;text-align:center;font-weight:900}
      @media(max-width:850px){.s1-static-selection-info{padding-right:38%}.s1-static-selection-photo{width:62%}.s1-static-compare-picker{grid-template-columns:1fr}.s1-static-compare-picker>b{text-align:center;padding:0}.s1-static-compare-filter{grid-template-columns:1fr}}
      @media(max-width:600px){.s1-static-selection-card{min-height:285px}.s1-static-selection-info{min-height:285px;padding:19px 42% 18px 17px}.s1-static-selection-info h3{font-size:1.25rem}.s1-static-selection-photo{width:68%;height:72%}}
    `;
    document.head.appendChild(style);
  }

  async function getJson(url) {
    const response = await fetch(`${url}?v=${BUILD}`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`${url} retornou ${response.status}`);
    return response.json();
  }

  function canonicalPlayer(meta, statsKey, stat) {
    const metaValues = Object.entries(meta || {});
    const statName = String(stat?.name || stat?.jogador || statsKey || '').trim();
    const candidates = [statsKey, statName].map(norm).filter(Boolean);
    let foundKey = '';
    let found = null;
    for (const [key, item] of metaValues) {
      const aliases = [key, item?.name, ...(Array.isArray(item?.aliases) ? item.aliases : [])].map(norm);
      if (candidates.some(candidate => aliases.includes(candidate))) {
        foundKey = key;
        found = item;
        break;
      }
    }
    return { id: foundKey || statsKey, meta: found || {} };
  }

  function buildPlayers(meta, statsPayload) {
    const raw = statsPayload?.players && typeof statsPayload.players === 'object' ? statsPayload.players : {};
    const out = [];
    Object.entries(raw).forEach(([statsKey, stat]) => {
      const resolved = canonicalPlayer(meta, statsKey, stat);
      const name = String(resolved.meta?.name || stat?.name || statsKey).trim();
      if (!name) return;
      const team = String(resolved.meta?.team || stat?.team || '').trim();
      const role = String(resolved.meta?.role || 'RUSH').toUpperCase();
      const general = {
        kills: num(stat?.kills), damage: num(stat?.damage), assists: num(stat?.assists),
        matches: num(stat?.matches), mvps: num(stat?.mvp ?? stat?.mvps), record: num(stat?.record)
      };
      const stages = {};
      ['classificatoria', 'final'].forEach(stage => {
        const row = stat?.stages?.[stage] || {};
        stages[stage] = {
          kills: num(row?.kills), damage: num(row?.damage), assists: num(row?.assists),
          matches: num(row?.matches), mvps: num(row?.mvp ?? row?.mvps), record: 0
        };
      });
      out.push({
        id: String(resolved.id || statsKey), name, team, role,
        rookie: Boolean(resolved.meta?.rookie), aliases: Array.isArray(resolved.meta?.aliases) ? resolved.meta.aliases : [],
        general, stages
      });
    });
    return out;
  }

  function indexPlayers(players) {
    const map = new Map();
    players.forEach(player => {
      [player.id, player.name, ...player.aliases].filter(Boolean).forEach(alias => map.set(norm(alias), player));
    });
    return map;
  }

  async function loadData() {
    if (state.ready) return state;
    if (state.loading) return state.loading;
    state.loading = Promise.all([
      getJson('ffws-br-2026-s1/teams.json'),
      getJson('ffws-br-2026-s1/player-meta.json'),
      getJson('ffws-br-2026-s1/player-stats.json')
    ]).then(([teamsPayload, metaPayload, statsPayload]) => {
      state.teams = Array.isArray(teamsPayload?.teams) ? teamsPayload.teams : [];
      state.meta = metaPayload?.players || {};
      state.players = buildPlayers(state.meta, statsPayload);
      state.byName = indexPlayers(state.players);
      state.ready = true;
      return state;
    }).finally(() => { state.loading = null; });
    return state.loading;
  }

  function teamByName(name) {
    const key = norm(name);
    return state.teams.find(team => norm(team?.name) === key || norm(team?.abbreviation) === key) || null;
  }

  function teamLogo(name) {
    const team = teamByName(name);
    try {
      if (typeof window.getTeamLogoSafe === 'function') {
        const found = window.getTeamLogoSafe(team?.name || name);
        if (found && found !== 'escudo.webp') return found;
      }
    } catch (_) {}
    return team?.logo || 'escudo.webp';
  }

  function playerPhoto(player) {
    try {
      if (typeof window.cffResolvePlayerPhoto === 'function') {
        const found = window.cffResolvePlayerPhoto(player?.name || '', '');
        if (found) return found;
      }
    } catch (_) {}
    try {
      if (typeof playerPhotos !== 'undefined') {
        const aliases = [player?.name, ...(player?.aliases || [])];
        for (const alias of aliases) if (playerPhotos?.[alias]) return playerPhotos[alias];
      }
    } catch (_) {}
    const safe = String(player?.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return safe ? `player-photos/s2/${safe}.webp` : 'silhueta.webp';
  }

  function roleLabel(role) {
    const value = String(role || '').toUpperCase();
    if (value.includes('GRAN')) return 'Granadeiro';
    if (value.includes('SUP')) return 'Suporte';
    if (value === '3') return '3º homem';
    return 'Rush';
  }

  function statFor(player, stage = 'geral') {
    const row = stage === 'geral' ? player?.general : player?.stages?.[stage];
    const stats = row || { kills: 0, damage: 0, assists: 0, matches: 0, mvps: 0, record: 0 };
    return {
      ...stats,
      avgKills: num(stats.matches) ? num(stats.kills) / num(stats.matches) : 0,
      avgDamage: num(stats.matches) ? num(stats.damage) / num(stats.matches) : 0,
      avgAssists: num(stats.matches) ? num(stats.assists) / num(stats.matches) : 0
    };
  }

  function openPlayer(player) {
    if (!player) return;
    try {
      if (typeof window.openPlayerProfile === 'function') {
        window.openPlayerProfile(player.name, player.team);
        return;
      }
    } catch (_) {}
    const query = new URLSearchParams({ jogador: player.name, time: player.team });
    location.href = `jogador.html?${query.toString()}`;
  }

  function openTeam(name) {
    try {
      if (typeof window.openTeamProfile === 'function') {
        window.openTeamProfile(name);
        return;
      }
    } catch (_) {}
  }

  function teamRoster(team) {
    const roster = (team?.players || []).map(name => state.byName.get(norm(name)) || {
      id: norm(name).toLowerCase(), name, team: team?.name || '', role: 'RUSH', rookie: false,
      aliases: [], general: { kills: 0, damage: 0, assists: 0, matches: 0, mvps: 0, record: 0 }, stages: {}
    });
    roster.sort((a, b) => num(b.general?.matches) - num(a.general?.matches) || num(b.general?.kills) - num(a.general?.kills) || a.name.localeCompare(b.name, 'pt-BR'));
    const highlight = roster.slice().sort((a, b) => num(b.general?.kills) - num(a.general?.kills))[0]?.name || '';
    return roster.map((player, index) => ({ ...player, starter: index < 4, highlight: player.name === highlight }));
  }

  function renderTeams() {
    const root = document.getElementById('equipes');
    if (!root) return false;
    const totalPlayers = new Set(state.teams.flatMap(team => (team.players || []).map(norm))).size;
    const rookies = state.players.filter(player => player.rookie && state.teams.some(team => (team.players || []).some(name => norm(name) === norm(player.name) || player.aliases.some(alias => norm(alias) === norm(name))))).length;
    root.innerHTML = `<div class="ffws-s2-shell" data-s1-static="equipes">
      <section class="ffws-s2-hero"><div class="ffws-s2-kicker">WB 2026 S1 • ARQUIVO</div><h1>Equipes</h1><p>As 16 organizações e os elencos finais registrados na temporada.</p></section>
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner">
        <div class="ffws-s2-panel-head"><div><h2>Diretório de Equipes</h2><p>Mesmo visual da WB 2026 S2, com funções, estreantes e jogadores mais utilizados.</p></div><span class="ffws-s2-badge">${totalPlayers} jogadores • ${rookies} estreantes</span></div>
        <div class="ffws-s2-teams-grid ffws-s2-rosters-grid">${state.teams.map(team => {
          const roster = teamRoster(team);
          const starters = roster.filter(player => player.starter).length;
          return `<article class="ffws-s2-team-card ffws-s2-team-roster-card" role="button" tabindex="0" data-s1-open-team="${esc(team.name)}">
            <header class="ffws-s2-team-roster-head"><img loading="lazy" decoding="async" src="${esc(teamLogo(team.name))}" alt="${esc(team.name)}" onerror="this.onerror=null;this.src='escudo.webp'"><div><strong>${esc(team.name)}</strong><small>${esc(team.abbreviation || team.name)} • Brasil • Grupo ${esc(team.group || '—')}</small><small>${starters} titulares • ${Math.max(0, roster.length - starters)} reservas</small></div></header>
            <div class="ffws-s2-roster-list">${roster.map(player => `<button type="button" class="ffws-s2-roster-player${player.starter ? '' : ' reserve'}" data-s1-open-player="${esc(player.name)}">
              <img class="ffws-s2-roster-player-avatar" loading="lazy" decoding="async" src="${esc(playerPhoto(player))}" alt="${esc(player.name)}" onerror="this.onerror=null;this.src='silhueta.webp'">
              <span class="ffws-s2-roster-player-main"><strong>${esc(player.name)}</strong><small>${esc(roleLabel(player.role))} • ${player.starter ? 'Titular' : 'Reserva'}</small></span>
              <span class="ffws-s2-roster-badges">${player.rookie ? '<span class="ffws-s2-roster-badge rookie">Estreante</span>' : ''}${player.highlight ? '<span class="ffws-s2-roster-badge highlight">Destaque</span>' : ''}</span>
            </button>`).join('')}</div>
          </article>`;
        }).join('')}</div>
        <div class="s1-static-archive-note">Arquivo congelado da WB 2026 S1. Titulares são os quatro jogadores com mais quedas registradas pela equipe na edição.</div>
      </div></section>
    </div>`;

    root.querySelectorAll('[data-s1-open-team]').forEach(card => card.addEventListener('click', event => {
      if (event.target.closest('[data-s1-open-player]')) return;
      openTeam(card.getAttribute('data-s1-open-team'));
    }));
    root.querySelectorAll('[data-s1-open-player]').forEach(button => button.addEventListener('click', event => {
      event.stopPropagation();
      openPlayer(state.byName.get(norm(button.getAttribute('data-s1-open-player'))));
    }));
    return true;
  }

  function selectionScore(player, stage) {
    const stat = statFor(player, stage);
    if (!stat.matches) return -Infinity;
    const role = String(player.role || 'RUSH').toUpperCase();
    if (role.includes('SUP')) return stat.assists * 1.55 + stat.damage / 1350 + stat.kills * .75 + stat.mvps * 5;
    if (role.includes('GRAN')) return stat.kills * 1.45 + stat.damage / 1300 + stat.assists * .72 + stat.mvps * 6;
    return stat.kills * 1.7 + stat.damage / 1450 + stat.assists * .45 + stat.mvps * 6;
  }

  function buildSelection(stage) {
    const available = state.players.filter(player => statFor(player, stage).matches > 0)
      .sort((a, b) => selectionScore(b, stage) - selectionScore(a, stage));
    const used = new Set();
    const take = (roles, amount) => available.filter(player => !used.has(player.id) && roles.some(role => String(player.role || 'RUSH').toUpperCase().includes(role)))
      .slice(0, amount).map(player => (used.add(player.id), player));
    let lineup = [...take(['RUSH'], 2), ...take(['GRAN'], 1), ...take(['SUP'], 1)];
    if (lineup.length < 4) lineup = lineup.concat(available.filter(player => !used.has(player.id)).slice(0, 4 - lineup.length));
    return lineup;
  }

  function selectionCard(player, stage) {
    const stat = statFor(player, stage);
    return `<article class="s1-static-selection-card" role="button" tabindex="0" data-s1-open-player="${esc(player.name)}">
      <img class="s1-static-selection-photo" src="${esc(playerPhoto(player))}" alt="${esc(player.name)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='silhueta.webp'">
      <div class="s1-static-selection-shade"></div>
      <div class="s1-static-selection-info">
        <span class="s1-static-selection-role">${esc(roleLabel(player.role))}</span>
        <h3>${esc(player.name)}</h3>
        <div class="s1-static-selection-team"><img src="${esc(teamLogo(player.team))}" alt="" onerror="this.onerror=null;this.src='escudo.webp'"><span>${esc(player.team)}</span></div>
        <div class="s1-static-selection-stats">
          <div class="s1-static-selection-stat"><small>Abates</small><strong>${fmt(stat.kills)}</strong></div>
          <div class="s1-static-selection-stat"><small>K / queda</small><strong>${stat.avgKills.toFixed(2)}</strong></div>
          <div class="s1-static-selection-stat"><small>Dano</small><strong>${fmt(stat.damage)}</strong></div>
          <div class="s1-static-selection-stat"><small>Assist.</small><strong>${fmt(stat.assists)}</strong></div>
        </div>
      </div>
    </article>`;
  }

  function renderSelections() {
    return false;
  }

  function compareRows() {
    return state.players.map(player => ({ player, stats: statFor(player, state.compareStage) }))
      .filter(row => row.stats.matches > 0)
      .filter(row => state.compareRole === 'all' || String(row.player.role || 'RUSH').toUpperCase().includes(state.compareRole))
      .sort((a, b) => b.stats.kills - a.stats.kills || b.stats.damage - a.stats.damage || a.player.name.localeCompare(b.player.name, 'pt-BR'));
  }

  function compareHero(row, side) {
    const player = row?.player;
    return `<article class="ffws-s2-player-compare-hero ${side}" role="button" tabindex="0" data-s1-open-player="${esc(player?.name || '')}">
      <img class="ffws-s2-compare-photo" src="${esc(playerPhoto(player))}" alt="${esc(player?.name || 'Jogador')}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='silhueta.webp'">
      <div><img class="ffws-s2-compare-team-logo" src="${esc(teamLogo(player?.team))}" alt="" onerror="this.onerror=null;this.src='escudo.webp'"><strong>${esc(player?.name || '—')}</strong><span>${esc(player?.team || 'Sem equipe')}</span></div>
    </article>`;
  }

  function compareMetric(label, a, b, formatter = value => String(value)) {
    const av = num(a), bv = num(b);
    return `<div class="ffws-s2-compare-metric"><strong class="${av > bv ? 'winner' : ''}">${esc(formatter(a))}</strong><span>${esc(label)}</span><strong class="${bv > av ? 'winner' : ''}">${esc(formatter(b))}</strong></div>`;
  }

  function playerOptions(rows, selected) {
    return rows.map(row => `<option value="${esc(row.player.id)}"${row.player.id === selected ? ' selected' : ''}>${esc(row.player.name)} • ${esc(teamByName(row.player.team)?.abbreviation || row.player.team)}</option>`).join('');
  }

  function renderCompare() {
    const root = document.getElementById('comparar-1v1');
    if (!root) return false;
    const rows = compareRows();
    if (!rows.some(row => row.player.id === state.compareP1)) state.compareP1 = rows[0]?.player.id || '';
    if (!rows.some(row => row.player.id === state.compareP2) || state.compareP2 === state.compareP1) state.compareP2 = rows.find(row => row.player.id !== state.compareP1)?.player.id || state.compareP1;
    const p1 = rows.find(row => row.player.id === state.compareP1) || null;
    const p2 = rows.find(row => row.player.id === state.compareP2) || null;

    root.innerHTML = `<div class="ffws-s2-shell" data-s1-static="comparar-1v1">
      <section class="ffws-s2-hero"><div class="ffws-s2-kicker">WB 2026 S1 • ARQUIVO</div><h1>Comparar 1V1</h1><p>Compare dois jogadores usando somente o resumo congelado da edição.</p></section>
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner">
        <div class="ffws-s2-panel-head"><div><h2>Escolha o confronto</h2><p>O comparador agora usa o arquivo leve de estatísticas finais, sem carregar todas as quedas.</p></div><span class="ffws-s2-badge">${rows.length} jogadores</span></div>
        <div class="s1-static-compare-filter">
          <label class="s1-static-select-label">Etapa<select id="s1-static-compare-stage"><option value="geral"${state.compareStage === 'geral' ? ' selected' : ''}>Geral</option><option value="classificatoria"${state.compareStage === 'classificatoria' ? ' selected' : ''}>Classificatória</option><option value="final"${state.compareStage === 'final' ? ' selected' : ''}>Final</option></select></label>
          <label class="s1-static-select-label">Posição<select id="s1-static-compare-role"><option value="all"${state.compareRole === 'all' ? ' selected' : ''}>Todas</option><option value="RUSH"${state.compareRole === 'RUSH' ? ' selected' : ''}>Rush</option><option value="GRAN"${state.compareRole === 'GRAN' ? ' selected' : ''}>Granadeiro</option><option value="SUP"${state.compareRole === 'SUP' ? ' selected' : ''}>Suporte</option></select></label>
        </div>
        ${p1 && p2 ? `<div class="s1-static-compare-picker">
          <label class="s1-static-select-label">Jogador 1<select id="s1-static-compare-p1">${playerOptions(rows, state.compareP1)}</select></label><b>VS</b><label class="s1-static-select-label">Jogador 2<select id="s1-static-compare-p2">${playerOptions(rows, state.compareP2)}</select></label>
        </div>
        <div class="ffws-s2-player-compare-grid">${compareHero(p1, 'left')}<div class="ffws-s2-compare-metrics">
          ${compareMetric('Abates', p1.stats.kills, p2.stats.kills, fmt)}
          ${compareMetric('Dano', p1.stats.damage, p2.stats.damage, fmt)}
          ${compareMetric('Assistências', p1.stats.assists, p2.stats.assists, fmt)}
          ${compareMetric('Quedas', p1.stats.matches, p2.stats.matches, fmt)}
          ${compareMetric('MVPs', p1.stats.mvps, p2.stats.mvps, fmt)}
          ${compareMetric('K / queda', p1.stats.avgKills, p2.stats.avgKills, value => num(value).toFixed(2))}
          ${compareMetric('Dano / queda', p1.stats.avgDamage, p2.stats.avgDamage, value => fmt(value))}
          ${compareMetric('Assist. / queda', p1.stats.avgAssists, p2.stats.avgAssists, value => num(value).toFixed(2))}
          ${state.compareStage === 'geral' ? compareMetric('Recorde em queda', p1.stats.record, p2.stats.record, fmt) : ''}
        </div>${compareHero(p2, 'right')}</div>` : '<div class="ffws-s2-empty"><div><strong>Nenhum jogador neste recorte</strong>Troque a etapa ou posição.</div></div>'}
        <div class="s1-static-archive-note">Por ser uma edição encerrada, filtros por dia e mapa foram removidos daqui para manter o carregamento leve. Esses recortes continuam disponíveis em Estatísticas Gerais.</div>
      </div></section>
    </div>`;

    document.getElementById('s1-static-compare-stage')?.addEventListener('change', event => { state.compareStage = event.target.value; state.compareP1 = ''; state.compareP2 = ''; renderCompare(); });
    document.getElementById('s1-static-compare-role')?.addEventListener('change', event => { state.compareRole = event.target.value; state.compareP1 = ''; state.compareP2 = ''; renderCompare(); });
    document.getElementById('s1-static-compare-p1')?.addEventListener('change', event => { state.compareP1 = event.target.value; renderCompare(); });
    document.getElementById('s1-static-compare-p2')?.addEventListener('change', event => { state.compareP2 = event.target.value; renderCompare(); });
    root.querySelectorAll('[data-s1-open-player]').forEach(card => card.addEventListener('click', () => openPlayer(state.byName.get(norm(card.getAttribute('data-s1-open-player'))))));
    return true;
  }

  async function render(page = '') {
    page = String(page || location.hash.replace(/^#/, '') || '').trim();
    if (!STATIC_PAGES.has(page)) return false;
    injectCss();
    const root = document.getElementById(page);
    try {
      await loadData();
      if (page === 'equipes') return renderTeams();
      if (page === 'comparar-1v1') return renderCompare();
    } catch (error) {
      console.error('[S1 static pages]', page, error);
      if (root) root.innerHTML = `<div class="s1-static-page-error" data-s1-static="${esc(page)}">Não foi possível carregar o arquivo leve da WB 2026 S1.</div>`;
    }
    return false;
  }

  function markerExists(page) {
    return Boolean(document.querySelector(`#${CSS.escape(page)} [data-s1-static="${CSS.escape(page)}"]`));
  }

  function wrapNavigation(name) {
    const base = window[name];
    if (typeof base !== 'function' || base.__cffS1StaticWrapped) return;
    const wrapped = function(page, ...args) {
      const result = base.call(this, page, ...args);
      const target = String(page || '');
      if (STATIC_PAGES.has(target)) {
        setTimeout(() => render(target), 120);
        setTimeout(() => render(target), 850);
      }
      return result;
    };
    wrapped.__cffS1StaticWrapped = true;
    wrapped.__cffS1StaticBase = base;
    window[name] = wrapped;
  }

  window.cffS1StaticPagesRender = render;

  window.addEventListener('hashchange', () => {
    const page = String(location.hash || '').replace(/^#/, '');
    if (STATIC_PAGES.has(page)) setTimeout(() => render(page), 120);
  });

  const boot = () => {
    wrapNavigation('navigate');
    wrapNavigation('navigateAndClose');
    const page = String(location.hash || '').replace(/^#/, '');
    if (STATIC_PAGES.has(page)) {
      setTimeout(() => render(page), 80);
      setTimeout(() => render(page), 900);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  let attempts = 0;
  const watchdog = setInterval(() => {
    attempts += 1;
    wrapNavigation('navigate');
    wrapNavigation('navigateAndClose');
    const page = String(location.hash || '').replace(/^#/, '');
    if (STATIC_PAGES.has(page) && !markerExists(page)) render(page);
    if (attempts >= 24) clearInterval(watchdog);
  }, 500);
})();