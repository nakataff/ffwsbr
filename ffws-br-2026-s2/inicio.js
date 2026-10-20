(() => {
  'use strict';
  if (window.CFFS2Inicio) return;
  const root = document.getElementById('ffws-br-s2-inicio-content');
  if (!root) return;
  const VERSION = '20261020-inicio-share-v3';
  const BASE = '/ffws-br-2026-s2/';
  const files = {summary: BASE + 'inicio-resumo.json?v=' + VERSION, mvp: BASE + 'inicio-mvp-top10.json?v=' + VERSION, squads: BASE + 'inicio-elencos.json?v=' + VERSION};
  const cache = new Map();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const num = v => Number(v) || 0;
  const fmt = v => num(v).toLocaleString('pt-BR');
  const links = {classificatoria:'/ffws-br-s2/classificatoria', segundaFase:'/ffws-br-s2/segunda-fase', final:'/ffws-br-s2/final', mvp:'/ffws-br-s2/mvp', equipes:'/ffws-br-s2/equipes'};
  const stages = [{id:'classificatoria', name:'Classificatória'}, {id:'segundaFase', name:'Segunda fase', short:'2ª fase'}, {id:'final', name:'Final'}];
  const tabs = [{id:'tabela', name:'Tabela'}, {id:'mvp', name:'Ranking MVP'}, {id:'equipes', name:'Equipes'}];
  const params = new URLSearchParams(location.search);
  const initialTab = ['tabela','mvp','equipes'].includes(params.get('aba')) ? params.get('aba') : 'tabela';
  const initialStage = params.get('etapa');
  const state = {tab:initialTab, stage:stages.some(s => s.id === initialStage) ? initialStage : 'final', mvpStage:['geral', ...stages.map(s => s.id)].includes(initialStage) ? initialStage : 'geral', team:''};
  let currentCard = null;
  function cardButton() {return '<button type="button" class="s2-start-complete s2-start-share" data-s2-share aria-label="Criar card deste recorte">↗ Criar card</button>';}
  function cardSource(rows, kind, stage, updatedAt) {
    const tab = kind === 'players' ? 'mvp' : 'tabela';
    return {id:'wb-s2-'+tab+'-'+stage, kind, title:kind === 'players' ? 'Ranking de abates' : 'Classificação', event:'WB 2026 S2', stage:stage === 'geral' ? 'Geral' : stages.find(s => s.id === stage)?.name || stage, updatedAt, metric:kind === 'players' ? 'kills' : 'points', url:'https://centralfreefire.com.br/ffws-br-s2/inicio?aba='+tab+'&etapa='+stage, rows:rows.map((r,i) => ({...r, rank:r.position || i+1, name:kind === 'teams' ? r.team : r.name, logo:teamMeta(r.team).logo}))};
  }
  async function shareCard(button) {
    if (!currentCard) return;
    const payload = currentCard;
    button.disabled = true;
    try {const {openRankingCard} = await import('/js/ranking-share-cards.mjs?v=20261020-cards-v1'); await openRankingCard(payload);}
    catch (error) {let note = query('[data-s2-share-status]'); if (!note) {note = document.createElement('p'); note.dataset.s2ShareStatus=''; note.setAttribute('role','status'); query('#s2-start-pane')?.append(note);} note.textContent=error.message || 'Não foi possível abrir o editor. Tente novamente.';}
    finally {button.disabled = false;}
  }
  let requestId = 0, initialized = false, summaryData = null;
  const query = selector => root.querySelector(selector);
  function get(key) {
    if (!cache.has(key)) cache.set(key, fetch(files[key], {cache:'default'}).then(r => {
      if (!r.ok) throw Error('Resumo indisponível');
      return r.json();
    }).catch(error => {cache.delete(key); throw error;}));
    return cache.get(key);
  }
  function buttons(items, current, attribute) {
    return items.map(x => `<button type="button" data-s2-${attribute}="${x.id}" class="${x.id === current ? 'is-active' : ''}" aria-pressed="${x.id === current}">${esc(x.short || x.name)}</button>`).join('');
  }
  const teamMeta = name => summaryData?.teams?.find(t => t.name === name) || {name, abbreviation:name, logo:'escudo.webp'};
  function asset(src) {
    const value = String(src || '');
    // All assets come from the repository; refuse external or script URLs.
    return value && !/[:\\]|^\/\//.test(value) && !value.split('/').includes('..') ? '/' + value.replace(/^\//, '') : '/escudo.webp';
  }
  function image(src, alt, kind = 'team') {
    return `<img class="s2-start-${kind}-image" src="${esc(asset(src))}" alt="${esc(alt)}" width="${kind === 'player' ? 40 : 28}" height="${kind === 'player' ? 40 : 28}" loading="lazy" decoding="async" data-s2-fallback="${kind === 'player' ? '/silhueta.webp' : '/escudo.webp'}">`;
  }
  function teamLink(name, compact = false) {
    const t = teamMeta(name);
    return `<a class="s2-start-team-link${compact ? ' is-compact' : ''}" href="/equipe.html?time=${encodeURIComponent(name)}" aria-label="${esc(name)}">${image(t.logo, '')}<span class="s2-start-team-full">${esc(name)}</span><span class="s2-start-team-short" aria-hidden="true">${esc(t.abbreviation)}</span></a>`;
  }
  function nameLink(name, team) {
    return `<a class="s2-start-player-link" href="/jogador.html?jogador=${encodeURIComponent(name)}&time=${encodeURIComponent(team)}">${esc(name)}</a>`;
  }
  function link(url, text) {
    return `<a class="s2-start-complete" href="${esc(url)}">${esc(text)} <span aria-hidden="true">→</span></a>`;
  }
  function dateLabel(value) {
    const date = new Date(String(value) + 'T12:00:00Z');
    return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('pt-BR', {day:'2-digit', month:'short', timeZone:'UTC'}).replace('.', '');
  }
  function formatSections(summary) {
    const brief = ['14 equipes · 12 avançam · 2 rebaixadas', '12 equipes · bônus · 2 vagas no Mundial', '2 dias · Champion Rush · 160 pontos'];
    return `<details class="s2-start-format"><summary><span>Como funciona o torneio</span><small>Classificatória · Segunda fase · Final</small><span class="s2-start-chevron" aria-hidden="true">⌄</span></summary><div class="s2-start-format-grid">${stages.map((s, i) => `<article><h3>${esc(s.name)}</h3><strong>${brief[i]}</strong><p>${esc(summary.format?.[s.id]?.description || '')}</p>${link(links[s.id], 'Ver etapa')}</article>`).join('')}</div></details>`;
  }
  function hero(summary) {
    return `<section class="ffws-s2-hero s2-start-hero"><div class="s2-start-title-row"><div><div class="ffws-s2-kicker">FFWS BRASIL 2026 SPLIT 2</div><h1>WB 2026 S2</h1><p>${dateLabel(summary.dateStart)} a ${dateLabel(summary.dateEnd)} de 2026 <span aria-hidden="true">·</span> 14 equipes</p></div><span class="s2-start-status">${summary.finished ? 'Encerrado' : 'Em andamento'}</span></div><div class="s2-start-results"><div class="s2-start-champion"><small>Campeão brasileiro</small>${summary.champion ? teamLink(summary.champion) : '<strong>A definir</strong>'}</div><div class="s2-start-qualified"><small>Vagas no Mundial pela 2ª fase</small><div>${(summary.worldQualifiedFromStage2 || []).map(t => teamLink(t)).join('') || '<strong>A definir</strong>'}</div></div></div></section>`;
  }
  function layout(summary) {
    root.innerHTML = `<div class="s2-start ffws-s2-shell">${hero(summary)}<section class="ffws-s2-panel s2-start-data" aria-label="Resumo da competição"><div class="s2-start-tabs" role="tablist" aria-label="Informações do torneio">${tabs.map(t => `<button type="button" id="s2-start-tab-${t.id}" role="tab" data-s2-tab="${t.id}" aria-controls="s2-start-pane" aria-selected="${t.id === state.tab}" tabindex="${t.id === state.tab ? 0 : -1}">${t.name}</button>`).join('')}</div><div id="s2-start-pane" role="tabpanel" aria-labelledby="s2-start-tab-${state.tab}" aria-live="polite" tabindex="0"></div></section>${formatSections(summary)}<nav class="s2-start-shortcuts" aria-label="Mais sobre a competição">${link('/ffws-br-s2/datas', 'Calendário')}${link('/ffws-br-s2/stats', 'Estatísticas gerais')}${link('/ffws-br-s2/selecoes', 'Seleções da season')}</nav></div>`;
  }
  function stageTable(data) {
    const stage = stages.find(s => s.id === state.stage) || stages[2];
    const rows = (data.stages?.[stage.id]?.rows || []).filter(r => num(r.matches) > 0).slice().sort((a, b) => num(a.position) - num(b.position));
    currentCard = cardSource(rows, 'teams', stage.id, data.updatedAt);
    const world = new Set(data.worldQualifiedTeams || [data.champion, ...data.worldQualifiedFromStage2]);
    const legend = stage.id === 'classificatoria' ? '<span class="is-advance">1º–12º: Segunda fase</span><span class="is-relegated">13º–14º: Rebaixados</span>' : stage.id === 'segundaFase' ? '<span class="is-world">1º e 2º: Mundial</span><span>12 equipes na Final · pontos incluem bônus</span>' : '<span class="is-champion">Campeão</span><span class="is-qualified">Classificados ao Mundial</span>';
    return `<div class="s2-start-subtabs" role="group" aria-label="Etapa da tabela">${buttons(stages, state.stage, 'stage')}</div><div class="s2-start-section-head"><h2>${esc(stage.name)}</h2><div class="s2-start-section-actions"><span class="ffws-s2-badge">${rows.length} equipes</span>${rows.length ? cardButton() : ''}</div></div><div class="s2-start-table-wrap ffws-s2-table-wrap"><table class="s2-start-table ffws-s2-table"><caption class="s2-start-sr">Classificação da ${esc(stage.name)} da WB 2026 S2</caption><thead><tr><th scope="col">#</th><th scope="col" class="team-col">Equipe</th><th scope="col">PTS</th><th scope="col" class="s2-start-secondary">B!</th><th scope="col">K</th><th scope="col">Q</th></tr></thead><tbody>${rows.map((r, i) => {
      const zone = stage.id === 'classificatoria' ? (i < 12 ? 'advance' : 'relegated') : stage.id === 'segundaFase' ? (i < 2 ? 'world' : '') : r.team === data.champion ? 'champion' : world.has(r.team) ? 'qualified' : '';
      return `<tr class="s2-start-zone-${zone}"><td class="ffws-s2-rank">${r.position || i + 1}º</td><td class="team-col">${teamLink(r.team)}</td><td class="s2-start-points">${fmt(r.points)}</td><td class="s2-start-secondary">${fmt(r.booyahs)}</td><td>${fmt(r.kills)}</td><td>${fmt(r.matches)}</td></tr>`;
    }).join('') || '<tr><td colspan="6">Resumo ainda indisponível.</td></tr>'}</tbody></table></div><div class="s2-start-legend">${legend}</div><div class="s2-start-under"><small>PTS: pontos · B!: Booyahs · K: abates · Q: quedas</small>${link(links[stage.id], 'Ver tabela completa')}</div>`;
  }
  function mvpTable(data) {
    const list = [{id:'geral', name:'Geral'}, ...stages], selected = list.find(s => s.id === state.mvpStage);
    const entries = (data.top10?.[state.mvpStage] || []).slice(0, 10);
    currentCard = entries.length ? cardSource(entries, 'players', state.mvpStage, data.updatedAt) : null;
    const top = `<div class="s2-start-subtabs" role="group" aria-label="Etapa do MVP">${buttons(list, state.mvpStage, 'mvp-stage')}</div><div class="s2-start-section-head"><div><h2>Top 10 · ${esc(selected.name)}</h2><p>${state.mvpStage === 'geral' ? 'Classificatória, segunda fase e final somadas.' : 'Estatísticas somente desta etapa.'}</p></div><div class="s2-start-section-actions"><span class="ffws-s2-badge">${entries.length} jogadores</span>${entries.length ? cardButton() : ''}</div></div>`;
    if (!entries.length) return top + '<p class="s2-start-empty">Ainda não há dados deste recorte.</p>' + link(links.mvp, 'Ver Ranking MVP completo');
    const coverage = data.coverage?.[state.mvpStage];
    return top + (coverage === 'completo' ? '' : '<p class="s2-start-notice">Resumo parcial desta etapa.</p>') + `<div class="s2-start-table-wrap ffws-s2-table-wrap"><table class="s2-start-table ffws-s2-table s2-start-mvp"><caption class="s2-start-sr">Top 10 de abates · ${esc(selected.name)}</caption><thead><tr><th scope="col">#</th><th scope="col" class="team-col">Jogador</th><th scope="col" class="team-col">Equipe</th><th scope="col">K</th><th scope="col" class="s2-start-secondary">Dano</th><th scope="col" class="s2-start-secondary">Assist.</th><th scope="col">Q</th><th scope="col" class="s2-start-secondary">K/Q</th></tr></thead><tbody>${entries.map((r, i) => `<tr><td class="ffws-s2-rank">${i + 1}º</td><td class="team-col">${nameLink(r.name, r.team)}</td><td class="team-col">${teamLink(r.team, true)}</td><td class="s2-start-points">${fmt(r.kills)}</td><td class="s2-start-secondary">${fmt(r.damage)}</td><td class="s2-start-secondary">${fmt(r.assists)}</td><td>${fmt(r.matches)}</td><td class="s2-start-secondary">${num(r.matches) ? (num(r.kills) / num(r.matches)).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—'}</td></tr>`).join('')}</tbody></table></div><div class="s2-start-under"><small>K: abates · Q: quedas · K/Q: média por queda</small>${link(links.mvp, 'Ver Ranking MVP completo')}</div>`;
  }
  function squadView(data) {
    const teams = data.teams || [];
    if (!teams.length) return '<p class="s2-start-empty">Elencos indisponíveis.</p>';
    if (!teams.some(t => t.name === state.team)) state.team = teams[0].name;
    const team = teams.find(t => t.name === state.team), players = team.players || [];
    const played = players.filter(p => num(p.matches) > 0).length;
    const roles = {GRAN:'Granadeiro', SUP:'Suporte', RUSH:'Rush', '3':'3º homem'};
    return `<label class="s2-start-team-filter">Escolher equipe<select data-s2-team aria-label="Selecionar equipe">${teams.map(t => `<option value="${esc(t.name)}"${t.name === state.team ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label><div class="s2-start-team-head">${image(team.logo, '')}<div><h2>${esc(team.name)}</h2><p>${played} jogadores com participação · ${players.length} no elenco registrado</p></div></div><div class="s2-start-roster">${players.map(p => `<article class="s2-start-roster-player${p.status === 'Saiu' ? ' is-former' : ''}">${image(p.photo, '', 'player')}<div><h3>${nameLink(p.name, team.name)}</h3><p>${esc(roles[p.role] || p.role || 'Jogador')} · ${esc(p.status || 'Elenco registrado')}${p.captain ? ' · Capitão' : ''}${p.rookie ? ' · Estreante' : ''}</p><div class="s2-start-participation">${stages.filter(s => num(p.matchesByStage?.[s.id]) > 0).map(s => `<span>${esc(s.short || s.name)}: ${num(p.matchesByStage[s.id])} Q</span>`).join('') || '<span>Sem quedas registradas</span>'}</div></div></article>`).join('')}</div><p class="s2-start-caption">Inclui quem participou durante o torneio, mesmo após sair da equipe. Q = quedas jogadas em cada etapa.</p><div class="s2-start-under">${link('/equipe.html?time=' + encodeURIComponent(team.name), 'Perfil da equipe')}${link(links.equipes, 'Ver todas as equipes')}</div>`;
  }
  async function renderPane() {
    const pane = query('#s2-start-pane');
    if (!pane) return;
    pane.setAttribute('aria-labelledby', 's2-start-tab-' + state.tab);
    const seq = ++requestId;
    currentCard = null;
    pane.setAttribute('aria-busy', 'true');
    pane.innerHTML = '<p class="s2-start-loading">Carregando resumo…</p>';
    try {
      const data = await get(state.tab === 'tabela' ? 'summary' : state.tab === 'mvp' ? 'mvp' : 'squads');
      if (seq !== requestId) return;
      pane.innerHTML = state.tab === 'tabela' ? stageTable(data) : state.tab === 'mvp' ? mvpTable(data) : squadView(data);
    } catch (_) {
      if (seq !== requestId) return;
      pane.innerHTML = '<p class="s2-start-empty">Não foi possível carregar o resumo.</p><button class="s2-start-complete" type="button" data-s2-retry>Tentar novamente</button>';
    } finally {if (seq === requestId) pane.removeAttribute('aria-busy');}
  }
  function activateTab(id) {
    if (!tabs.some(t => t.id === id)) return;
    state.tab = id;
    root.querySelectorAll('[data-s2-tab]').forEach(button => {
      const active = button.dataset.s2Tab === id;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    });
    renderPane();
  }
  async function boot() {
    if (initialized) return;
    initialized = true;
    root.innerHTML = '<div class="s2-start"><p class="s2-start-loading">Preparando o resumo da WB 2026 S2…</p></div>';
    try {summaryData = await get('summary'); layout(summaryData); renderPane();}
    catch (_) {initialized = false; root.innerHTML = '<div class="s2-start"><p class="s2-start-empty">Não foi possível carregar o torneio.</p><button type="button" class="s2-start-complete" data-s2-boot-retry>Tentar novamente</button></div>';}
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-s2-share')) shareCard(button);
    else if (button.dataset.s2Tab) activateTab(button.dataset.s2Tab);
    else if (button.dataset.s2Stage && stages.some(s => s.id === button.dataset.s2Stage)) {state.stage = button.dataset.s2Stage; renderPane();}
    else if (button.dataset.s2MvpStage && ['geral', ...stages.map(s => s.id)].includes(button.dataset.s2MvpStage)) {state.mvpStage = button.dataset.s2MvpStage; renderPane();}
    else if (button.hasAttribute('data-s2-retry')) renderPane();
    else if (button.hasAttribute('data-s2-boot-retry')) boot();
  });
  root.addEventListener('keydown', event => {
    const button = event.target.closest('[data-s2-tab]');
    if (!button || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = tabs.findIndex(t => t.id === button.dataset.s2Tab);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    activateTab(tabs[index].id); query(`[data-s2-tab="${tabs[index].id}"]`).focus();
  });
  root.addEventListener('change', event => {if (event.target.matches('[data-s2-team]')) {state.team = event.target.value; renderPane();}});
  root.addEventListener('error', event => {
    const img = event.target;
    if (img.matches?.('img[data-s2-fallback]')) {const fallback = img.dataset.s2Fallback; delete img.dataset.s2Fallback; img.src = fallback;}
  }, true);
  window.CFFS2Inicio = {boot};
  boot();
})();
