(() => {
  'use strict';

  const CONFIG = window.FFWS_BR_2026_S2_CONFIG || {
    teamsUrl: 'ffws-br-2026-s2/teams.json',
    stagesUrl: 'ffws-br-2026-s2/stages.json',
    playersUrl: 'ffws-br-2026-s2/players.json',
    datesUrl: 'ffws-br-2026-s2/dates.json'
  };
  const PAGE_PREFIX = 'ffws-br-s2-';
  const PAGE_IDS = new Set([
    'ffws-br-s2-classificatoria', 'ffws-br-s2-segunda-fase', 'ffws-br-s2-final',
    'ffws-br-s2-mvp', 'ffws-br-s2-equipes', 'ffws-br-s2-datas', 'ffws-br-s2-selecoes',
    'ffws-br-s2-stats', 'ffws-br-s2-notas', 'ffws-br-s2-comparar'
  ]);
  const state = {
    loading: null,
    loaded: false,
    playersLoading: null,
    playersLoaded: false,
    teams: [],
    stages: null,
    players: { players: [], entries: [] },
    dates: { stages: [] },
    stageFilter: {
      classificatoria: { period: 'all', map: 'all', drop: 'all' },
      segundaFase: { period: 'all', map: 'all', drop: 'all' },
      final: { period: 'all', map: 'all', drop: 'all' }
    },
    selectionWeek: '1',
    selectionTab: 'semanal',
    playerFilters: { stage: [], team: [], role: [], country: [], rookie: [], day: [] },
    statsFilters: { stage: 'classificatoria', days: [], confrontations: [], maps: [] },
    statsOpenMulti: null,
    notesFilters: { stage: 'classificatoria', team: 'all', role: 'all', day: 'all', map: 'all', drop: 'all' },
    compareFilters: { stage: 'classificatoria', roles: [], day: 'all', map: 'all' },
    comparePlayers: { p1: '', p2: '' },
    statsStage: 'classificatoria'
  };

  const S2_WEEKS = { '1': [1, 2], '2': [3, 4], '3': [5, 6], '4': [7, 8], '5': [9, 10], '6': [11, 12], '7': [13, 14] };

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const number = value => Number(value) || 0;
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const jsAttr = value => String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  async function getJson(url) {
    const response = await fetch(url, { cache: 'default' });
    if (!response.ok) throw new Error(`Falha ao carregar ${url}`);
    return response.json();
  }

  function loadData() {
    if (state.loaded) return Promise.resolve(state);
    if (state.loading) return state.loading;
    state.loading = Promise.all([
      getJson(CONFIG.teamsUrl),
      getJson(CONFIG.stagesUrl),
      getJson(CONFIG.datesUrl)
    ]).then(([teams, stages, dates]) => {
      state.teams = Array.isArray(teams?.teams) ? teams.teams : [];
      state.stages = stages || {};
      state.dates = dates || { stages: [] };
      state.loaded = true;
      return state;
    }).finally(() => { state.loading = null; });
    return state.loading;
  }

  function loadPlayersData() {
    if (state.playersLoaded) return Promise.resolve(state.players);
    if (state.playersLoading) return state.playersLoading;
    state.playersLoading = getJson(CONFIG.playersUrl).then(players => {
      state.players = players || { players: [], entries: [] };
      state.playersLoaded = true;
      return state.players;
    }).finally(() => { state.playersLoading = null; });
    return state.playersLoading;
  }

  function hero(title, subtitle) {
    return `<section class="ffws-s2-hero">
      <div class="ffws-s2-kicker">FFWS BRASIL 2026 SPLIT 2</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(subtitle)}</p>
    </section>`;
  }

  function stageFormat(stageKey) {
    return state.stages?.format?.[stageKey] || {};
  }

  function teamByName(name) {
    const key = normalize(name);
    return state.teams.find(team => normalize(team.name) === key || normalize(team.abbreviation) === key) || null;
  }

  function logo(teamName) {
    try {
      if (typeof window.getTeamLogoByAliases === 'function') {
        const resolved = window.getTeamLogoByAliases(teamName);
        if (resolved && resolved !== 'escudo.webp') return resolved;
      }
      if (window.logos && typeof window.logos === 'object') {
        const direct = window.logos[teamName] || window.logos[String(teamName || '').toUpperCase()];
        if (direct) return direct;
      }
    } catch (_) {}
    return teamByName(teamName)?.logo || 'escudo.webp';
  }

  function abbreviation(teamName) {
    return teamByName(teamName)?.abbreviation || String(teamName || '—');
  }

  function rosterPlayers() {
    return Array.isArray(state.players?.players) ? state.players.players : [];
  }

  function playersForTeam(teamName) {
    return rosterPlayers()
      .filter(player => normalize(player.team) === normalize(teamName))
      .sort((a, b) => Number(b.starter) - Number(a.starter)
        || Number(b.captain) - Number(a.captain)
        || number(a.order) - number(b.order)
        || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  }

  function rosterPlayerByName(name, teamName = '') {
    const nameKey = normalize(name);
    const teamKey = normalize(teamName);
    return rosterPlayers().find(player => {
      const aliases = [player.name, player.sourceName, ...(Array.isArray(player.aliases) ? player.aliases : [])];
      const nameMatch = aliases.some(alias => normalize(alias) === nameKey);
      return nameMatch && (!teamKey || normalize(player.team) === teamKey);
    }) || null;
  }

  function playerRoleLabel(player) {
    const role = String(player?.roleShort || player?.role || '').toUpperCase();
    if (role === 'GRAN') return 'Granadeiro';
    if (role === 'SUP') return 'Suporte';
    if (role === '3') return '3º homem';
    return role === 'RUSH' ? 'Rush' : (player?.role || 'Função não informada');
  }

  function playerBadges(player) {
    const badges = [];
    if (player?.captain) badges.push('<span class="ffws-s2-roster-badge captain">Capitão</span>');
    if (player?.rookie) badges.push('<span class="ffws-s2-roster-badge rookie">Estreante</span>');
    if (player?.highlight) badges.push('<span class="ffws-s2-roster-badge highlight">Destaque</span>');
    return badges.join('');
  }

  function playerPhoto(player) {
    const explicit = player?.photo || player?.image || '';
    if (typeof window.cffResolvePlayerPhoto === 'function') return window.cffResolvePlayerPhoto(player?.name || player?.player, explicit);
    return explicit || 'silhueta.webp';
  }

  function teamCell(teamName, subtitle = '') {
    const team = teamByName(teamName);
    const full = team?.name || teamName || 'A definir';
    const short = team?.abbreviation || full;
    return `<td class="team-col"><div class="ffws-s2-team-cell">
      <img loading="lazy" decoding="async" src="${escapeHtml(logo(full))}" alt="${escapeHtml(full)}" onerror="this.onerror=null;this.src='escudo.webp'">
      <span class="ffws-s2-team-name"><strong><span class="ffws-s2-desktop">${escapeHtml(full)}</span><span class="ffws-s2-mobile">${escapeHtml(short)}</span></strong>${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ''}</span>
    </div></td>`;
  }

  function formatPanel(stageKey) {
    const format = stageFormat(stageKey);
    if (stageKey === 'classificatoria') {
      return `<section class="ffws-s2-format">
        <div><h2>Formato da Classificatória</h2><p>${escapeHtml(format.description || '')}</p></div>
        <div class="ffws-s2-format-grid">
          <div class="ffws-s2-format-card"><small>Equipes</small><strong>14</strong><span>Participantes na primeira fase</span></div>
          <div class="ffws-s2-format-card"><small>Rodadas</small><strong>14</strong><span>Duas equipes ficam de folga por rodada</span></div>
          <div class="ffws-s2-format-card"><small>Avançam</small><strong>12</strong><span>Classificados à Segunda Fase</span></div>
          <div class="ffws-s2-format-card"><small>Rebaixados</small><strong>2</strong><span>13º e 14º colocados</span></div>
        </div>
        <div class="ffws-s2-legend"><span class="advance"><i></i>1º ao 12º • Segunda Fase</span><span class="relegated"><i></i>13º e 14º • Rebaixados</span></div>
      </section>`;
    }
    if (stageKey === 'segundaFase') {
      return `<section class="ffws-s2-format">
        <div><h2>Formato da Segunda Fase</h2><p>${escapeHtml(format.description || '')}</p></div>
        <div class="ffws-s2-format-grid">
          <div class="ffws-s2-format-card"><small>Equipes</small><strong>12</strong><span>Classificadas da primeira fase</span></div>
          <div class="ffws-s2-format-card"><small>Rodadas</small><strong>6</strong><span>Disputa da segunda fase</span></div>
          <div class="ffws-s2-format-card"><small>Bônus</small><strong>Ativo</strong><span>Baseado na Classificatória</span></div>
          <div class="ffws-s2-format-card"><small>Mundial</small><strong>Top 2</strong><span>Vagas garantidas diretamente</span></div>
        </div>
        <div class="ffws-s2-legend"><span class="world"><i></i>1º e 2º • Final + Mundial</span><span class="final"><i></i>3º ao 12º • Final</span></div>
      </section>`;
    }
    return `<section class="ffws-s2-format">
      <div><h2>Formato da Final</h2><p>${escapeHtml(format.description || '')}</p></div>
      <div class="ffws-s2-format-grid">
        <div class="ffws-s2-format-card"><small>Equipes</small><strong>12</strong><span>Finalistas da temporada</span></div>
        <div class="ffws-s2-format-card"><small>Duração</small><strong>2 dias</strong><span>Grande Final</span></div>
        <div class="ffws-s2-format-card"><small>Formato</small><strong>Champion Rush</strong><span>Primeiro Booyah elegível fecha o título</span></div>
        <div class="ffws-s2-format-card"><small>Linha de chegada</small><strong>160 pts</strong><span>Champion Rush Point</span></div>
      </div>
      <div class="ffws-s2-legend"><span class="final"><i></i>Campeão • Mundial</span><span class="world"><i></i>Próximo elegível caso o campeão já esteja no Top 2</span></div>
      <details class="ffws-s2-champion-rush"><summary>Ver regra do Champion Rush</summary><ul><li>A equipe precisa alcançar 160 pontos para ficar elegível.</li><li>Após ficar elegível, precisa conquistar um Booyah para ser campeã.</li><li>Caso o campeão já esteja classificado pelo Top 2 da Segunda Fase, a terceira vaga mundial vai ao próximo melhor colocado elegível da Final.</li></ul></details>
    </section>`;
  }

  function stageEvents(stageKey) {
    const payload = state.stages?.[stageKey] || {};
    if (stageKey === 'final') {
      const direct = Array.isArray(payload.days) ? payload.days : [];
      return direct.flatMap((day, dayIndex) => {
        const matches = Array.isArray(day?.matches) ? day.matches : (Array.isArray(day?.rounds) ? day.rounds : []);
        if (matches.length) return matches.map((match, index) => ({ ...match, day: number(match.day) || number(day.day) || dayIndex + 1, number: number(match.number) || index + 1 }));
        return Array.isArray(day?.results) ? [{ ...day, day: number(day.day) || dayIndex + 1, number: number(day.number) || dayIndex + 1 }] : [];
      });
    }
    return Array.isArray(payload.rounds) ? payload.rounds : [];
  }

  function eventResults(event) {
    return Array.isArray(event?.results) ? event.results : (Array.isArray(event?.rows) ? event.rows : []);
  }

  function filteredStageEvents(stageKey) {
    const filter = state.stageFilter[stageKey] || { period: 'all', map: 'all', drop: 'all' };
    return stageEvents(stageKey).filter((event, index) => {
      const periodValue = stageKey === 'final' ? (number(event.day) || 1) : (number(event.round) || number(event.number) || index + 1);
      const eventMap = String(event.map || event.mapa || '').trim();
      const eventDrop = number(event.drop) || number(event.queda) || number(event.number) || index + 1;
      return (filter.period === 'all' || String(periodValue) === String(filter.period))
        && (filter.map === 'all' || normalize(eventMap) === normalize(filter.map))
        && (filter.drop === 'all' || String(eventDrop) === String(filter.drop));
    });
  }

  function aggregateStageRows(stageKey, events) {
    const payload = state.stages?.[stageKey] || {};
    const baseRows = Array.isArray(payload.rows) ? payload.rows : [];
    const map = new Map();
    const addTeam = (name, extra = {}) => {
      if (!name) return null;
      const key = normalize(name);
      if (!map.has(key)) map.set(key, { team: name, position: null, points: 0, booyahs: 0, kills: 0, placementPoints: 0, matches: 0, bonus: 0, ...extra });
      return map.get(key);
    };
    if (stageKey === 'classificatoria') state.teams.forEach(team => addTeam(team.name));
    else baseRows.forEach(row => addTeam(row.team, { bonus: number(row.bonus), placeholder: Boolean(row.placeholder) }));
    events.forEach(event => eventResults(event).forEach(result => {
      const row = addTeam(result.team || result.equipe);
      if (!row) return;
      row.points += number(result.points ?? result.pontos ?? (number(result.placementPoints) + number(result.kills)));
      row.booyahs += number(result.booyahs ?? result.booyah ?? (number(result.position || result.posicao) === 1 ? 1 : 0));
      row.kills += number(result.kills ?? result.abates);
      row.placementPoints += number(result.placementPoints ?? result.pontosColocacao ?? result.pp);
      row.matches += number(result.matches || 1);
      if (stageKey === 'segundaFase') row.bonus = number(result.bonus ?? row.bonus);
      if (result.worldQualified) row.worldQualified = true;
    }));
    const rows = [...map.values()];
    const hasEvents = events.some(event => eventResults(event).length);
    if (stageKey === 'segundaFase' && hasEvents) rows.forEach(row => { row.points += number(row.bonus); });
    if (hasEvents) {
      rows.sort((a, b) => b.points - a.points || b.booyahs - a.booyahs || b.kills - a.kills || a.team.localeCompare(b.team, 'pt-BR'));
      rows.forEach((row, index) => { row.position = index + 1; });
    }
    return rows;
  }

  function filterStageRows(stageKey) {
    const payload = state.stages?.[stageKey] || {};
    const events = filteredStageEvents(stageKey);
    if (stageEvents(stageKey).length) return aggregateStageRows(stageKey, events);
    const rawRows = Array.isArray(payload.rows) ? payload.rows : [];
    if (rawRows.length) return rawRows.map(row => ({ ...row }));
    if (stageKey === 'classificatoria') {
      return state.teams.map(team => ({ team: team.name, position: null, points: 0, booyahs: 0, kills: 0, placementPoints: 0, matches: 0 }));
    }
    const total = 12;
    const prefix = stageKey === 'segundaFase' ? 'CLASSIFICATÓRIA' : 'SEGUNDA FASE';
    return Array.from({ length: total }, (_, index) => ({ team: `${prefix} #${index + 1}`, position: null, points: 0, booyahs: 0, kills: 0, placementPoints: 0, matches: 0, bonus: 0, placeholder: true }));
  }

  function rowClass(stageKey, row) {
    const pos = number(row.position);
    if (!pos) return '';
    if (stageKey === 'classificatoria') return pos <= 12 ? 'ffws-s2-row-advance' : 'ffws-s2-row-relegated';
    if (stageKey === 'segundaFase') return pos <= 2 ? 'ffws-s2-row-world' : 'ffws-s2-row-final';
    if (pos === 1) return 'ffws-s2-row-champion';
    if (row.worldQualified) return 'ffws-s2-row-world';
    return '';
  }

  function stageTable(stageKey) {
    const rows = filterStageRows(stageKey);
    const showBonus = stageKey === 'segundaFase';
    return `<div class="ffws-s2-table-wrap"><table class="ffws-s2-table"><thead><tr>
      <th>#</th><th class="team-col"><span class="ffws-s2-desktop">Equipe</span><span class="ffws-s2-mobile">Eqp</span></th>
      ${showBonus ? '<th>BÔNUS</th>' : ''}<th>PTS</th><th>B!</th><th>K</th><th class="hide-mobile">PP</th><th>Q</th>
    </tr></thead><tbody>${rows.map((row, index) => {
      const hasData = number(row.matches) > 0 || number(row.points) > 0 || number(row.position) > 0;
      const rank = number(row.position) || '—';
      const subtitle = row.placeholder ? 'Vaga a definir' : (hasData ? '' : 'Aguardando resultados');
      return `<tr class="${rowClass(stageKey, row)}">
        <td class="ffws-s2-rank">${rank}</td>${teamCell(row.team, subtitle)}
        ${showBonus ? `<td>${hasData ? number(row.bonus) : '—'}</td>` : ''}
        <td>${hasData ? number(row.points) : '—'}</td><td>${hasData ? number(row.booyahs) : '—'}</td><td>${hasData ? number(row.kills) : '—'}</td>
        <td class="hide-mobile">${hasData ? number(row.placementPoints) : '—'}</td><td>${hasData ? number(row.matches) : '—'}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function stageFilters(stageKey) {
    const total = stageKey === 'classificatoria' ? 14 : (stageKey === 'segundaFase' ? 6 : 2);
    const label = stageKey === 'final' ? 'Dia' : 'Rodada';
    const selected = state.stageFilter[stageKey] || { period: 'all', map: 'all', drop: 'all' };
    const events = stageEvents(stageKey);
    const maps = [...new Set(events.map(event => String(event.map || event.mapa || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const drops = [...new Set(events.map((event, index) => number(event.drop) || number(event.queda) || number(event.number) || index + 1).filter(Boolean))].sort((a, b) => a - b);
    return `<div class="ffws-s2-filters">
      <label class="ffws-s2-filter"><span>${label}:</span><select onchange="setFFWSS2StageFilter('${stageKey}','period',this.value)"><option value="all">Geral</option>${Array.from({ length: total }, (_, index) => `<option value="${index + 1}"${String(selected.period) === String(index + 1) ? ' selected' : ''}>${label} ${index + 1}</option>`).join('')}</select></label>
      <label class="ffws-s2-filter"><span>Mapa:</span><select onchange="setFFWSS2StageFilter('${stageKey}','map',this.value)"${maps.length ? '' : ' disabled title="Disponível após o início da etapa"'}><option value="all">Todos os mapas</option>${maps.map(map => `<option value="${escapeHtml(map)}"${normalize(selected.map) === normalize(map) ? ' selected' : ''}>${escapeHtml(map)}</option>`).join('')}</select></label>
      <label class="ffws-s2-filter"><span>Queda:</span><select onchange="setFFWSS2StageFilter('${stageKey}','drop',this.value)"${drops.length ? '' : ' disabled title="Disponível após o início da etapa"'}><option value="all">Todas as quedas</option>${drops.map(drop => `<option value="${drop}"${String(selected.drop) === String(drop) ? ' selected' : ''}>Queda ${drop}</option>`).join('')}</select></label>
    </div><div class="ffws-s2-filter-summary">${selected.period === 'all' ? 'Classificação geral' : `${label} ${selected.period}`}${selected.map !== 'all' ? ` • ${escapeHtml(selected.map)}` : ''}${selected.drop !== 'all' ? ` • Queda ${escapeHtml(selected.drop)}` : ''}.</div>`;
  }


  function renderClassificatoria(rootId) {
    const layoutApi = window.FFWSBRSeasonEngine || window.FFWSBRSeasonLayout;
    const root = document.getElementById(rootId);
    if (!root) return;
    if (!layoutApi || typeof layoutApi.renderClassification !== 'function') {
      root.innerHTML = '<div class="ffws-s2-empty"><div><strong>Não foi possível exibir a classificação</strong>Tente novamente em instantes.</div></div>';
      return;
    }

    const layout = CONFIG.layout?.classificatoria || {};
    const selected = state.stageFilter.classificatoria || { period: 'all', map: 'all', drop: 'all' };
    const events = stageEvents('classificatoria');
    const eventMaps = [...new Set(events.map(event => String(event.map || event.mapa || '').trim()).filter(Boolean))];
    const mapOptions = eventMaps.length
      ? eventMaps.map(map => ({ value: map, label: map }))
      : (layout.defaultMaps || []);
    const drops = [...new Set(events.map((event, index) => number(event.drop) || number(event.queda) || number(event.number) || index + 1).filter(Boolean))].sort((a, b) => a - b);
    const rows = filterStageRows('classificatoria');

    layoutApi.renderClassification({
      rootId,
      pageClass: 'ffws-s2-classificatoria-page',
      participants: {
        mode: 'teams',
        title: layout.participantsTitle || 'Times Participantes',
        teams: state.teams,
        nameResolver: team => team?.name || 'A definir',
        shortResolver: team => team?.abbreviation || team?.name || '—',
        logoResolver: full => logo(full)
      },
      format: layout.format || {},
      classificationTitle: layout.classificationTitle || 'Classificação Geral',
      filters: {
        period: {
          id: 'ffws-s2-filter-round', label: 'Filtrar por Rodadas:',
          onchange: "setFFWSS2StageFilter('classificatoria','period',this.value)", selected: selected.period,
          options: [{ value: 'all', label: 'Todas as rodadas' }].concat(Array.from({ length: 14 }, (_, index) => ({ value: String(index + 1), label: `Rodada ${index + 1}` })))
        },
        map: {
          id: 'ffws-s2-filter-map', label: 'Mapa:',
          onchange: "setFFWSS2StageFilter('classificatoria','map',this.value)", selected: selected.map,
          options: [{ value: 'all', label: 'Todos os Mapas' }].concat(mapOptions)
        },
        drop: {
          containerId: 'ffws-s2-drop-filter-container', id: 'ffws-s2-filter-drop', label: 'Queda Específica:',
          onchange: "setFFWSS2StageFilter('classificatoria','drop',this.value)", selected: selected.drop,
          visible: drops.length > 0,
          options: [{ value: 'all', label: 'Todas as Quedas do Período' }].concat(drops.map(drop => ({ value: String(drop), label: `Queda ${drop}` })))
        }
      },
      table: {
        id: 'ffws-s2-classificatoria-table',
        autoRank: true,
        zones: layout.zones || [],
        rows,
        resolveTeamName: teamName => teamByName(teamName)?.name || teamName,
        resolveShortName: teamName => abbreviation(teamName),
        resolveLogo: teamName => logo(teamName),
        columns: [
          { key: 'position', label: '#' },
          { key: 'team', label: 'E', numeric: false },
          { key: 'points', label: 'PTS', accent: true },
          { key: 'booyahs', label: 'B', hideMobile: true },
          { key: 'kills', label: 'K', hideMobile: true },
          { key: 'matches', label: 'Q', title: 'Quedas Jogadas' }
        ]
      }
    });
  }

  function renderStage(stageKey, rootId, title, subtitle) {
    if (stageKey === 'classificatoria') return renderClassificatoria(rootId);
    const root = document.getElementById(rootId);
    if (!root) return;
    const rows = filterStageRows(stageKey);
    root.innerHTML = `<div class="ffws-s2-shell">${hero(title, subtitle)}${formatPanel(stageKey)}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner">
        <div class="ffws-s2-panel-head"><div><h2>Classificação</h2><p>Resultados atualizados por rodada, mapa e queda.</p></div><span class="ffws-s2-badge">${rows.length} equipes</span></div>
        ${stageFilters(stageKey)}${stageTable(stageKey)}
      </div></section></div>`;
  }

  function allPlayerEntries() {
    return Array.isArray(state.players?.entries) ? state.players.entries : [];
  }


  function playerFilterOptions() {
    const entries = allPlayerEntries();
    const roster = rosterPlayers();
    const playerSource = entries.length ? entries : roster;
    const teams = [...new Set((playerSource.length ? playerSource.map(entry => entry.team) : state.teams.map(team => team.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const days = [...new Set(entries.map(entry => number(entry.day)).filter(Boolean))].sort((a, b) => a - b);
    const countries = [...new Set(playerSource.map(entry => String(entry.country || rosterPlayerByName(entry.name || entry.player, entry.team)?.country || 'br').toLowerCase()).filter(Boolean))];
    const countryNames = { br: 'Brasil' };
    return {
      stage: [{ value: 'classificatoria', label: 'Classificatória' }, { value: 'segundaFase', label: 'Segunda Fase' }, { value: 'final', label: 'Final' }],
      team: teams.map(team => ({ value: team, label: team })),
      role: [{ value: 'RUSH', label: 'Rush' }, { value: 'SUP', label: 'Suporte' }, { value: 'GRAN', label: 'Granadeiro' }, { value: '3', label: '3º homem' }],
      country: countries.map(country => ({ value: country, label: countryNames[country] || country.toUpperCase(), flag: country === 'br' ? '🇧🇷' : '' })),
      rookie: [{ value: 'rookie', label: 'Apenas estreantes' }, { value: 'veteran', label: 'Sem estreantes' }],
      day: days.map(day => ({ value: String(day), label: `Dia ${day}` }))
    };
  }

  function filteredPlayers() {
    const entries = allPlayerEntries().filter(entry => {
      const f = state.playerFilters;
      const meta = rosterPlayerByName(entry.name || entry.player, entry.team);
      const isRookie = Boolean(meta?.rookie ?? entry.rookie);
      const country = String(entry.country || meta?.country || 'br').toLowerCase();
      const rookieMatch = !f.rookie.length
        || (f.rookie.includes('rookie') && isRookie)
        || (f.rookie.includes('veteran') && !isRookie);
      return (!f.stage.length || f.stage.includes(String(entry.stage)))
        && (!f.team.length || f.team.some(team => normalize(team) === normalize(entry.team)))
        && (!f.role.length || f.role.includes(String(entry.roleShort || entry.role || meta?.roleShort || '').toUpperCase()))
        && (!f.country.length || f.country.includes(country))
        && rookieMatch
        && (!f.day.length || f.day.includes(String(entry.day)));
    });
    const aggregate = new Map();
    entries.forEach(entry => {
      const key = `${normalize(entry.name || entry.player)}__${normalize(entry.team)}`;
      if (!aggregate.has(key)) aggregate.set(key, { name: entry.name || entry.player, team: entry.team, kills: 0, damage: 0, assists: 0, matches: 0, mvps: 0, bestDrop: 0 });
      const row = aggregate.get(key);
      row.kills += number(entry.kills);
      row.damage += number(entry.damage);
      row.assists += number(entry.assists);
      row.matches += number(entry.matches || 1);
      row.mvps += number(entry.mvp || entry.mvps);
      row.bestDrop = Math.max(row.bestDrop, number(entry.kills));
    });
    return [...aggregate.values()].sort((a, b) => b.kills - a.kills || b.damage - a.damage || b.assists - a.assists);
  }

  function renderMvp() {
    const engine = window.FFWSBRSeasonEngine || window.FFWSBRSeasonLayout;
    if (!engine?.renderMvp) return;
    const options = playerFilterOptions();
    const rows = filteredPlayers();
    engine.renderMvp({
      rootId: 'ffws-br-s2-mvp-content',
      pageClass: 'ffws-s2-mvp-page',
      hero: { kicker: 'FFWS BRASIL 2026 SPLIT 2', title: 'Ranking MVP', subtitle: 'Classificação individual da WB 2026 S2' },
      section: { title: 'Classificação Geral de Jogadores', description: 'Filtre o ranking por etapa, equipe, posição, país, novatos e dia.' },
      playerCountLabel: `${rows.length} jogadores`,
      filters: [
        { key: 'stage', title: 'Etapa', options: options.stage, selected: state.playerFilters.stage, menuId: 'ffws-s2-multi-stage' },
        { key: 'team', title: 'Equipe', options: options.team, selected: state.playerFilters.team, menuId: 'ffws-s2-multi-team' },
        { key: 'role', title: 'Posição', options: options.role, selected: state.playerFilters.role, menuId: 'ffws-s2-multi-role' },
        { key: 'country', title: 'País', options: options.country, selected: state.playerFilters.country, menuId: 'ffws-s2-multi-country' },
        { key: 'rookie', title: 'Novatos', options: options.rookie, selected: state.playerFilters.rookie, menuId: 'ffws-s2-multi-rookie' },
        { key: 'day', title: 'Dias', options: options.day, selected: state.playerFilters.day, menuId: 'ffws-s2-multi-day' }
      ],
      handlers: { toggle: 'toggleFFWSS2Multi', clear: 'clearFFWSS2Multi', set: 'setFFWSS2Multi' },
      resolveTeamName: teamName => teamByName(teamName)?.name || teamName,
      resolveShortName: teamName => abbreviation(teamName),
      resolveLogo: teamName => logo(teamName),
      openPlayerHandler: 'openCurrentSeasonPlayer',
      openTeamHandler: 'openCurrentSeasonTeam',
      rows
    });
  }

  function renderTeams() {
    const root = document.getElementById('ffws-br-s2-equipes-content');
    if (!root) return;
    const totalPlayers = rosterPlayers().length;
    const totalRookies = rosterPlayers().filter(player => player.rookie).length;
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Equipes', 'As 14 organizações e os elencos da WB 2026 S2')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Diretório de Equipes</h2><p>Confira os elencos, funções e estreantes da temporada.</p></div><span class="ffws-s2-badge">${totalPlayers} jogadores • ${totalRookies} estreantes</span></div>
      <div class="ffws-s2-teams-grid ffws-s2-rosters-grid">${state.teams.map(team => {
        const roster = playersForTeam(team.name);
        const starters = roster.filter(player => player.starter).length;
        return `<article class="ffws-s2-team-card ffws-s2-team-roster-card" role="button" tabindex="0" onclick="openCurrentSeasonTeam('${jsAttr(team.name)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCurrentSeasonTeam('${jsAttr(team.name)}')}">
          <header class="ffws-s2-team-roster-head"><img loading="lazy" decoding="async" src="${escapeHtml(logo(team.name))}" alt="${escapeHtml(team.name)}" onerror="this.onerror=null;this.src='escudo.webp'"><div><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.abbreviation)} • Brasil</small><small class="${team.logoPending ? 'ffws-s2-logo-pending' : ''}">${starters} titulares • ${Math.max(0, roster.length - starters)} reservas</small></div></header>
          <div class="ffws-s2-roster-list">${roster.length ? roster.map(player => `<button type="button" class="ffws-s2-roster-player${player.starter ? '' : ' reserve'}" onclick="event.stopPropagation();openCurrentSeasonPlayer('${jsAttr(player.name)}', '${jsAttr(player.team)}')">
            <img class="ffws-s2-roster-player-avatar" loading="lazy" decoding="async" src="${escapeHtml(playerPhoto(player))}" alt="${escapeHtml(player.name)}" onerror="this.onerror=null;this.src='silhueta.webp'">
            <span class="ffws-s2-roster-player-main"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(playerRoleLabel(player))} • ${escapeHtml(player.rosterStatus)}</small></span>
            <span class="ffws-s2-roster-badges">${playerBadges(player)}</span>
          </button>`).join('') : '<div class="ffws-s2-roster-empty">Elenco em breve.</div>'}</div>
        </article>`;
      }).join('')}</div>
      </div></section></div>`;
  }

  function scheduleStart(item) {
    const time = String(item?.time24 || '13:00');
    const parsed = Date.parse(`${String(item?.date || '')}T${time}:00-03:00`);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function scheduleStageMeta(stageKey) {
    const map = {
      classificatoria: {
        title: '1ª Fase • Classificatória',
        description: '14 rodadas. Em cada dia, 12 equipes jogam e duas ficam de folga.',
        badge: '14 rodadas'
      },
      segundaFase: {
        title: '2ª Fase • Rumo ao Mundial',
        description: 'As 12 classificadas disputam seis rodadas com bônus de pontuação da fase anterior.',
        badge: '6 rodadas'
      },
      final: {
        title: '3ª Fase • Grande Final',
        description: 'Dois dias de decisão no formato Champion Rush, com linha de chegada em 160 pontos.',
        badge: '2 dias'
      }
    };
    return map[stageKey] || { title: stageKey, description: '', badge: '' };
  }

  function renderScheduleSection(stageKey, rounds, nextKey, liveKey) {
    const meta = scheduleStageMeta(stageKey);
    const rows = rounds.filter(item => item.stage === stageKey);
    if (!rows.length) return '';
    return `<section class="ffws-s2-panel ffws-s2-calendar-stage ffws-s2-calendar-${escapeHtml(stageKey)}">
      <div class="ffws-s2-panel-inner">
        <div class="ffws-s2-panel-head">
          <div><h2>${escapeHtml(meta.title)}</h2><p>${escapeHtml(meta.description)}</p></div>
          <span class="ffws-s2-badge">${escapeHtml(meta.badge)}</span>
        </div>
        <div class="ffws-s2-calendar-list">
          ${rows.map(item => {
            const isLive = item.key === liveKey;
            const isNext = item.key === nextKey;
            const isPast = scheduleStart(item) + (6 * 60 * 60 * 1000) < Date.now();
            const status = isLive ? 'AO VIVO' : isNext ? 'PRÓXIMA' : isPast ? 'ENCERRADA' : 'AGENDADA';
            const resting = Array.isArray(item.restingTeams) ? item.restingTeams : [];
            const detail = stageKey === 'classificatoria'
              ? `<span class="ffws-s2-calendar-rest${resting.length ? '' : ' is-empty'}"><b>Folga:</b> ${resting.length ? resting.map(escapeHtml).join(' e ') : 'Nenhuma equipe'}</span>`
              : stageKey === 'segundaFase'
                ? '<span class="ffws-s2-calendar-rest"><b>Formato:</b> 12 equipes</span>'
                : '<span class="ffws-s2-calendar-rest"><b>Formato:</b> Champion Rush 160</span>';
            return `<article class="ffws-s2-calendar-row${isLive ? ' is-live' : ''}${isNext ? ' is-next' : ''}${isPast ? ' is-past' : ''}">
              <span class="ffws-s2-calendar-status">${status}</span>
              <strong>${escapeHtml(item.label)}</strong>
              <time datetime="${escapeHtml(item.date)}T${escapeHtml(item.time24 || '13:00')}:00-03:00">${escapeHtml(item.dateLabel)} • ${escapeHtml(item.time || '13h')}</time>
              ${detail}
            </article>`;
          }).join('')}
        </div>
      </div>
    </section>`;
  }

  function renderDates() {
    const root = document.getElementById('ffws-br-s2-datas-content');
    if (!root) return;
    const stages = Array.isArray(state.dates?.stages) ? state.dates.stages : [];
    const rounds = Array.isArray(state.dates?.rounds) ? state.dates.rounds : [];
    const now = Date.now();
    const live = rounds.find(item => now >= scheduleStart(item) && now < scheduleStart(item) + (6 * 60 * 60 * 1000));
    const next = rounds.find(item => scheduleStart(item) > now);
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Datas', 'Calendário oficial da WB 2026 S2')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Cronograma Geral</h2><p>Todos os dias começam às 13h, no horário de Brasília. Durante a Classificatória, as equipes indicadas ficam de folga naquela rodada.</p></div><span class="ffws-s2-badge">22 dias de competição</span></div>
      <div class="ffws-s2-dates">${stages.map(stage => `<article class="ffws-s2-date-card"><span>${escapeHtml(stage.status)}</span><h3>${escapeHtml(stage.name)}</h3><p>${escapeHtml(stage.summary)}</p><b>${escapeHtml(stage.date)}</b></article>`).join('')}</div></div></section>
      ${renderScheduleSection('classificatoria', rounds, next?.key, live?.key)}
      ${renderScheduleSection('segundaFase', rounds, next?.key, live?.key)}
      ${renderScheduleSection('final', rounds, next?.key, live?.key)}
    </div>`;
  }

  function selectionEntryDay(entry) {
    return number(entry?.day ?? entry?.dia ?? entry?.round ?? entry?.rodada);
  }

  function selectionEntryIsClassificatoria(entry) {
    const stage = normalize(entry?.stage || entry?.etapa || 'classificatoria');
    return !stage || stage === 'CLASSIFICATORIA' || stage === 'CLASSIFICATORIA1';
  }

  function selectionRowsForWeek(week) {
    return selectionRowsForDays(S2_WEEKS[String(week)] || []);
  }

  function selectionRowsForDays(days = []) {
    const aggregate = new Map();
    allPlayerEntries().filter(entry => selectionEntryIsClassificatoria(entry) && (!days.length || days.includes(selectionEntryDay(entry)))).forEach(entry => {
      const name = entry.name || entry.player || entry.jogador;
      if (!name) return;
      const team = entry.team || entry.equipe || '';
      const key = `${normalize(name)}__${normalize(team)}`;
      const meta = rosterPlayerByName(name, team);
      if (!aggregate.has(key)) aggregate.set(key, { name, team, meta, kills: 0, damage: 0, assists: 0, matches: 0, mvps: 0 });
      const row = aggregate.get(key);
      row.kills += number(entry.kills ?? entry.abates);
      row.damage += number(entry.damage ?? entry.dano);
      row.assists += number(entry.assists ?? entry.assistencias);
      row.matches += number(entry.matches ?? entry.quedas) || 1;
      row.mvps += number(entry.mvp ?? entry.mvps);
    });
    return [...aggregate.values()].sort((a, b) => b.kills - a.kills || b.damage - a.damage || b.assists - a.assists);
  }

  function selectionRole(row) {
    const raw = String(row?.meta?.roleShort || row?.meta?.role || row?.roleShort || row?.role || 'RUSH').toUpperCase();
    if (raw.includes('GRAN')) return 'GRAN';
    if (raw.includes('SUP')) return 'SUP';
    if (raw === '3' || raw.includes('3º')) return '3';
    return 'RUSH';
  }

  function buildWeeklySelection(rows) {
    const used = new Set();
    const take = (roles, amount) => rows.filter(row => !used.has(row) && roles.includes(selectionRole(row))).slice(0, amount).map(row => (used.add(row), row));
    let lineup = [...take(['RUSH', '3'], 2), ...take(['GRAN'], 1), ...take(['SUP'], 1)];
    if (lineup.length < 4) lineup = lineup.concat(rows.filter(row => !used.has(row)).slice(0, 4 - lineup.length));
    return lineup;
  }

  function selectionScheduleLabel(week) {
    const days = S2_WEEKS[String(week)] || [];
    const rounds = Array.isArray(state.dates?.rounds) ? state.dates.rounds : [];
    const labels = rounds.filter(item => item.stage === 'classificatoria' && days.includes(number(item.round))).map(item => item.dateLabel);
    return labels.length ? labels.join(' e ') : `Rodadas ${days.join(' e ')}`;
  }

  const S2_SELECTION_PHASES = {
    semanal: { label: 'TIMES DA SEMANA', short: 'SEMANA', color: '#ff0000', panelClass: 'week', title: 'Seleções semanais' },
    classificatoria: { label: 'CLASSIFICATÓRIA', short: 'CLASSIF.', color: '#00c8ff', panelClass: 'classificatoria', title: 'Seleção da classificatória' },
    final: { label: 'FINAL', short: 'FINAL', color: '#ffd166', panelClass: 'final', title: 'Seleção da final' },
    torneio: { label: 'TORNEIO', short: 'TORNEIO', color: '#a855f7', panelClass: 'torneio', title: 'Seleção do torneio' }
  };

  function selectionPhaseConfig(key = 'semanal') {
    return S2_SELECTION_PHASES[key] || S2_SELECTION_PHASES.semanal;
  }

  function selectionFinalComplete() {
    const finalEntries = allPlayerEntries().filter(entry => normalize(entry?.stage || entry?.etapa) === 'FINAL');
    return finalEntries.length >= 16 * 48;
  }

  function availableSelectionWeeks() {
    const entries = allPlayerEntries().filter(selectionEntryIsClassificatoria);
    const available = Object.keys(S2_WEEKS).filter(key => {
      const days = S2_WEEKS[key] || [];
      return entries.some(entry => days.includes(selectionEntryDay(entry)));
    });
    return available.length ? available : ['1'];
  }

  function selectionTabsHtml() {
    const finalUnlocked = selectionFinalComplete();
    return Object.entries(S2_SELECTION_PHASES).map(([key, config]) => {
      const unlocked = key === 'semanal' || key === 'classificatoria' || finalUnlocked;
      const active = state.selectionTab === key;
      return `<button type="button" class="season-selection-tab ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}" style="--selection-color:${config.color}" onclick="setFFWSS2SelectionTab('${key}')">
        <span>${config.label}</span>${unlocked ? '' : '<small>EM BREVE</small>'}
      </button>`;
    }).join('');
  }

  function selectionGlow(color) {
    if (color === '#00c8ff') return 'rgba(0,200,255,.48)';
    if (color === '#ffd166') return 'rgba(255,209,102,.45)';
    if (color === '#a855f7') return 'rgba(168,85,247,.45)';
    return 'rgba(255,0,0,.50)';
  }

  function selectionBackdrop(color) {
    if (color === '#00c8ff') return '#06283a';
    if (color === '#ffd166') return '#3b2d05';
    if (color === '#a855f7') return '#2b123e';
    return '#400';
  }

  function selectionCard(row, phaseKey = 'semanal') {
    if (!row) return '';
    const config = selectionPhaseConfig(phaseKey);
    const meta = row.meta || rosterPlayerByName(row.name, row.team) || { name: row.name };
    const role = selectionRole(row);
    const photo = playerPhoto(meta);
    const teamLogo = logo(row.team);
    const damage = `${(row.damage / 1000).toFixed(1)}K`;
    const glow = selectionGlow(config.color);
    const backdrop = selectionBackdrop(config.color);
    return `<div class="ffws-s2-s1-selection-card" role="button" tabindex="0" aria-label="Abrir perfil de ${escapeHtml(row.name)}" onclick="openCurrentSeasonPlayer('${jsAttr(row.name)}','${jsAttr(row.team)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCurrentSeasonPlayer('${jsAttr(row.name)}','${jsAttr(row.team)}')}">
      <div style="cursor:pointer;width:280px;height:420px;background:#000;border:4px solid ${config.color};border-radius:15px;position:relative;overflow:hidden;box-shadow:0 0 25px ${glow};margin:0 auto;box-sizing:border-box;">
        <div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 30%,${backdrop},#000);opacity:.95;"></div>
        <div style="position:absolute;top:15px;left:15px;z-index:10;background:${config.color};color:#fff;padding:4px 12px;border-radius:4px;font-size:.75em;font-weight:900;text-transform:uppercase;letter-spacing:1px;">${config.short}</div>
        <div style="position:absolute;top:50px;left:25px;z-index:4;text-align:center;color:${config.color};">
          <div style="font-size:22px;font-weight:900;">${escapeHtml(role)}</div>
          <div style="margin:8px auto;width:35px;height:3px;background:${config.color};"></div>
          <img src="${escapeHtml(teamLogo)}" alt="${escapeHtml(row.team)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='escudo.webp'" style="width:50px;height:50px;object-fit:contain;margin-top:5px;filter:drop-shadow(0 0 5px ${glow});">
        </div>
        <img src="${escapeHtml(photo)}" alt="${escapeHtml(row.name)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='silhueta.webp'" style="position:absolute;top:20px;right:-35px;height:270px;max-width:245px;object-fit:contain;object-position:right bottom;z-index:2;filter:drop-shadow(5px 5px 15px #000);-webkit-mask-image:linear-gradient(to bottom,#000 75%,transparent 100%);">
        <div style="position:absolute;bottom:0;width:100%;height:170px;background:linear-gradient(transparent,#000 45%);z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:20px;box-sizing:border-box;">
          <div style="color:#fff;font-size:24px;font-weight:900;text-transform:uppercase;padding:6px 10px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-sizing:border-box;">${escapeHtml(row.name)}</div>
          <div style="display:flex;justify-content:space-around;width:90%;color:#fff;border-top:1px solid color-mix(in srgb,${config.color} 38%,transparent);padding-top:10px;">
            <div style="text-align:center;"><div style="font-size:.65em;color:#888;">KILLS</div><div style="font-size:1.1em;font-weight:900;color:${config.color};">${row.kills}</div></div>
            <div style="text-align:center;"><div style="font-size:.65em;color:#888;">DANO</div><div style="font-size:1.1em;font-weight:900;">${damage}</div></div>
            <div style="text-align:center;"><div style="font-size:.65em;color:#888;">QUEDAS</div><div style="font-size:1.1em;font-weight:900;">${row.matches}</div></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function selectionLockedHtml(phaseKey) {
    const config = selectionPhaseConfig(phaseKey);
    return `<div class="season-selection-locked" style="--selection-color:${config.color}"><div class="season-selection-lock-icon">🔒</div><h3>${config.title} em breve</h3></div>`;
  }

  function selectionEmptyHtml(phaseKey, week = '') {
    const config = selectionPhaseConfig(phaseKey);
    const text = phaseKey === 'semanal' ? `Nenhum dado disponível para a Semana ${week}.` : 'Ainda não há dados suficientes para montar essa seleção.';
    return `<div class="season-selection-empty" style="--selection-color:${config.color}"><p>${text}</p></div>`;
  }

  function renderSelections() {
    const root = document.getElementById('ffws-br-s2-selecoes-content');
    if (!root) return;
    const phaseKey = state.selectionTab || 'semanal';
    const config = selectionPhaseConfig(phaseKey);
    const availableWeeks = availableSelectionWeeks();
    if (!availableWeeks.includes(String(state.selectionWeek))) state.selectionWeek = availableWeeks[0];
    const week = String(state.selectionWeek || availableWeeks[0] || '1');
    const finalUnlocked = selectionFinalComplete();

    let rows = [];
    let title = config.title;
    let description = '';
    let filters = '';
    let content = '';

    if (phaseKey === 'semanal') {
      rows = selectionRowsForWeek(week);
      const lineup = buildWeeklySelection(rows);
      title = 'Seleções semanais';
      description = 'Escolha a semana para ver os destaques por posição.';
      filters = `<div class="season-selection-filters">${availableWeeks.map(key => `<button type="button" class="btn-day ${week === key ? 'active' : ''}" onclick="setFFWSS2SelectionWeek('${key}')" style="${week === key ? 'background:#ff0000;border-color:#ff0000;color:#fff;' : ''}">SEMANA ${key}</button>`).join('')}</div>`;
      content = lineup.length ? lineup.map(row => selectionCard(row, phaseKey)).join('') : selectionEmptyHtml(phaseKey, week);
    } else if (phaseKey === 'classificatoria') {
      rows = selectionRowsForDays([]);
      const lineup = buildWeeklySelection(rows);
      description = 'Melhores de cada posição levando em conta todos os dados da classificatória.';
      content = lineup.length ? lineup.map(row => selectionCard(row, phaseKey)).join('') : selectionEmptyHtml(phaseKey);
    } else if (!finalUnlocked) {
      description = phaseKey === 'final' ? 'A seleção será liberada quando a Final tiver dados suficientes.' : 'A seleção será definida depois do encerramento da temporada.';
      content = selectionLockedHtml(phaseKey);
    } else {
      const targetStage = phaseKey === 'final' ? 'FINAL' : '';
      const phaseEntries = allPlayerEntries().filter(entry => !targetStage || normalize(entry?.stage || entry?.etapa) === targetStage);
      const aggregate = new Map();
      phaseEntries.forEach(entry => {
        const name = entry.name || entry.player || entry.jogador;
        const team = entry.team || entry.equipe || '';
        if (!name) return;
        const key = `${normalize(name)}__${normalize(team)}`;
        if (!aggregate.has(key)) aggregate.set(key, { name, team, meta: rosterPlayerByName(name, team), kills: 0, damage: 0, assists: 0, matches: 0, mvps: 0 });
        const row = aggregate.get(key);
        row.kills += number(entry.kills ?? entry.abates);
        row.damage += number(entry.damage ?? entry.dano);
        row.assists += number(entry.assists ?? entry.assistencias);
        row.matches += number(entry.matches ?? entry.quedas) || 1;
        row.mvps += number(entry.mvp ?? entry.mvps);
      });
      const lineup = buildWeeklySelection([...aggregate.values()].sort((a, b) => b.kills - a.kills || b.damage - a.damage));
      description = phaseKey === 'final' ? 'Melhores de cada posição considerando somente a Final.' : 'Melhores de cada posição considerando toda a temporada.';
      content = lineup.length ? lineup.map(row => selectionCard(row, phaseKey)).join('') : selectionEmptyHtml(phaseKey);
    }

    root.innerHTML = `<div class="ffws-s2-selection-page">
      <div class="season-selection-hero">
        <div class="season-selection-kicker">WB 2026 S2</div>
        <h1>SELEÇÕES DA SEASON</h1>
        <p>Os melhores jogadores por função: seleções semanais, classificatória, final e torneio.</p>
      </div>
      <div class="season-selection-tabs">${selectionTabsHtml()}</div>
      <section class="season-selection-panel season-selection-panel-${config.panelClass}">
        <div class="season-selection-section-head"><div><span class="season-selection-tag">${escapeHtml(config.label)}</span><h2>${escapeHtml(title)}</h2></div><p>${escapeHtml(description)}</p></div>
        ${filters}
        <div class="selection-grid season-selection-grid">${content}</div>
      </section>
    </div>`;
  }

  function statsStageEvents(stageValue = state.statsFilters.stage) {
    const keys = stageValue === 'geral' ? ['classificatoria', 'segundaFase', 'final'] : [stageValue];
    return keys.flatMap(stage => stageEvents(stage).map((event, index) => ({ ...event, _stage: stage, _day: number(event.day || event.round || event.number) || index + 1 })));
  }

  function statsFilterOptions() {
    const events = statsStageEvents();
    const days = [...new Set(events.map(event => event._day).filter(Boolean))].sort((a, b) => a - b);
    const maps = [...new Set(events.map(event => String(event.map || event.mapa || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const confrontations = [...new Map(events.map(event => [`${event._stage}:${event._day}`, { value: `${event._stage}:${event._day}`, label: `${event._stage === 'classificatoria' ? 'Rodada' : 'Dia'} ${event._day}` }])).values()];
    return { days: days.map(day => ({ value: String(day), label: `Dia ${day}` })), maps: maps.map(map => ({ value: map, label: map })), confrontations };
  }

  function statsMultiFilter(key, title, options) {
    const selected = state.statsFilters[key] || [];
    const label = selected.length === 0 ? 'Todos' : selected.length === 1 ? (options.find(option => String(option.value) === String(selected[0]))?.label || selected[0]) : `${selected.length} selecionados`;
    return `<div class="ffws-s2-filter"><span>${escapeHtml(title)}:</span><div class="ffws-s2-multi" data-s2-multi="stats-${escapeHtml(key)}"><button type="button" onclick="toggleFFWSS2StatsMulti('${key}')"><b>${escapeHtml(label)}</b><span>⌄</span></button><div class="ffws-s2-multi-menu" id="ffws-s2-stats-multi-${escapeHtml(key)}" hidden><label><input type="checkbox" ${selected.length === 0 ? 'checked' : ''} onchange="clearFFWSS2StatsMulti('${key}')"> Todos</label>${options.map(option => `<label><input type="checkbox" value="${escapeHtml(option.value)}" ${selected.includes(String(option.value)) ? 'checked' : ''} onchange="setFFWSS2StatsMulti('${key}',this.value,this.checked)"> ${escapeHtml(option.label)}</label>`).join('')}</div></div></div>`;
  }

  function filteredStatsEvents() {
    const filters = state.statsFilters;
    return statsStageEvents().filter(event => {
      const map = String(event.map || event.mapa || '');
      const confrontation = `${event._stage}:${event._day}`;
      return (!filters.days.length || filters.days.includes(String(event._day)))
        && (!filters.maps.length || filters.maps.some(value => normalize(value) === normalize(map)))
        && (!filters.confrontations.length || filters.confrontations.includes(confrontation));
    });
  }

  function aggregateStatsTeams(events) {
    const rows = new Map();
    events.forEach(event => eventResults(event).forEach(result => {
      const team = result.team || result.equipe;
      if (!team) return;
      const key = normalize(team);
      if (!rows.has(key)) rows.set(key, { team, points: 0, booyahs: 0, kills: 0, placementPoints: 0, matches: 0, positionSum: 0, top3: 0, top12: 0, days: new Set() });
      const row = rows.get(key);
      const position = number(result.position || result.posicao);
      row.points += number(result.points ?? result.pontos ?? (number(result.placementPoints) + number(result.kills)));
      row.booyahs += number(result.booyahs ?? result.booyah ?? (position === 1 ? 1 : 0));
      row.kills += number(result.kills ?? result.abates);
      row.placementPoints += number(result.placementPoints ?? result.pontosColocacao ?? result.pp);
      row.matches += 1;
      row.positionSum += position;
      row.top3 += position > 0 && position <= 3 ? 1 : 0;
      row.top12 += position === 12 ? 1 : 0;
      row.days.add(event._day);
    }));
    return [...rows.values()].map(row => ({ ...row, days: row.days.size, avgPoints: row.matches ? row.points / row.matches : 0, avgKills: row.matches ? row.kills / row.matches : 0, avgPosition: row.matches ? row.positionSum / row.matches : 0, top3Rate: row.matches ? row.top3 / row.matches : 0 }));
  }

  function filteredStatsPlayerEntries(events) {
    const allowed = new Set(events.map(event => `${event._stage}:${event._day}:${number(event.drop || event.queda || event.number)}:${normalize(event.map || event.mapa)}`));
    return allPlayerEntries().filter(entry => allowed.has(`${entry.stage || 'classificatoria'}:${number(entry.day)}:${number(entry.drop)}:${normalize(entry.map)}`));
  }

  function aggregateStatsPlayers(entries) {
    const rows = new Map();
    entries.forEach(entry => {
      const key = `${normalize(entry.name)}__${normalize(entry.team)}`;
      if (!rows.has(key)) rows.set(key, { name: entry.name, team: entry.team, kills: 0, damage: 0, assists: 0, matches: 0, mvps: 0 });
      const row = rows.get(key);
      row.kills += number(entry.kills); row.damage += number(entry.damage); row.assists += number(entry.assists); row.matches += 1; row.mvps += number(entry.mvp);
    });
    return [...rows.values()].map(row => ({ ...row, avgKills: row.matches ? row.kills / row.matches : 0, avgDamage: row.matches ? row.damage / row.matches : 0, avgAssists: row.matches ? row.assists / row.matches : 0 }));
  }

  function s2StatsPageState() {
    if (!window.__ffwsS2StatsPages) window.__ffwsS2StatsPages = {};
    return window.__ffwsS2StatsPages;
  }

  function s2StatsRankColor(index) {
    return index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#888';
  }

  function s2StatsPaginatedList(key, rows, renderRow, headerHtml, pageSize = 4) {
    const pages = s2StatsPageState();
    let page = number(pages[key]);
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page >= totalPages) page = 0;
    if (page < 0) page = 0;
    pages[key] = page;
    const visible = rows.slice(page * pageSize, page * pageSize + pageSize);
    const listHtml = visible.length
      ? visible.map((row, index) => renderRow(row, page * pageSize + index)).join('')
      : '<div style="padding: 14px 10px; color: #888; font-size: 0.85em; text-align:center;">Sem resultados neste recorte.</div>';
    const hasPagination = rows.length > pageSize;
    const prevButton = page === 0
      ? '<button disabled style="background:rgba(255,255,255,0.02); border:1px solid #222; color:#333; border-radius:50%; width:26px; height:26px; cursor:default; font-size:1em; display:flex; align-items:center; justify-content:center;">&#8249;</button>'
      : `<button onclick="event.stopPropagation(); ffwsS2StatsPageNav('${key}', -1)" style="background:rgba(255,255,255,0.07); border:1px solid #333; color:#aaa; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:1em; display:flex; align-items:center; justify-content:center;">&#8249;</button>`;
    const nextButton = page >= totalPages - 1
      ? `<button onclick="event.stopPropagation(); ffwsS2StatsPageNav('${key}', 'reset')" title="Voltar ao início" style="background:rgba(255,255,255,0.07); border:1px solid #333; color:var(--accent); border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:0.85em; display:flex; align-items:center; justify-content:center;">&#8635;</button>`
      : `<button onclick="event.stopPropagation(); ffwsS2StatsPageNav('${key}', 1)" style="background:rgba(255,255,255,0.07); border:1px solid #333; color:#aaa; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:1em; display:flex; align-items:center; justify-content:center;">&#8250;</button>`;
    return headerHtml + listHtml + (hasPagination ? `
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:10px; padding-top:8px; border-top:1px solid #222;">
                ${prevButton}
                <span style="font-size:0.75em; color:#666;">Top ${page * pageSize + 1}&#8211;${Math.min((page + 1) * pageSize, rows.length)}</span>
                ${nextButton}
            </div>` : '');
  }

  function s2StatsTeamValueCard(key, rows, valueGetter, formatter, valueLabel) {
    const ordered = [...rows].sort((a, b) => number(valueGetter(b)) - number(valueGetter(a)) || b.kills - a.kills || b.points - a.points);
    const header = `<div style="display: grid; grid-template-columns: 1fr 0.5fr; padding: 0 10px 8px 10px; font-size: 0.7em; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"><div>Equipe</div><div style="text-align: right;">${escapeHtml(valueLabel)}</div></div>`;
    return s2StatsPaginatedList(key, ordered, (row, rankIndex) => `<div style="display: grid; grid-template-columns: 1fr 0.5fr; align-items: center; margin-bottom: 6px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border-left: 3px solid ${s2StatsRankColor(rankIndex)}; font-size: 0.85em;">
                <div class="clickable" onclick="openCurrentSeasonTeam('${jsAttr(row.team)}')" style="display: flex; align-items: center; gap: 6px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="font-weight:bold; color: #555; margin-right: 4px;">${rankIndex + 1}º</span><img src="${escapeHtml(logo(row.team))}" style="width:16px; height:16px; object-fit: contain;" onerror="this.onerror=null;this.src='escudo.webp'"><span style="font-size: 0.95em; font-weight:bold;">${escapeHtml(abbreviation(row.team))}</span></div>
                <div style="font-weight: bold; color: var(--accent); text-align: right;">${escapeHtml(formatter(valueGetter(row)))}</div>
            </div>`, header, 4);
  }

  function s2StatsTeamDualValueCard(key, rows, primaryGetter, primaryFormatter, secondaryGetter, primaryLabel, secondaryLabel) {
    const ordered = [...rows].sort((a, b) => number(primaryGetter(b)) - number(primaryGetter(a)) || b.kills - a.kills || b.points - a.points);
    const header = `<div style="display: grid; grid-template-columns: 1fr 0.5fr 0.4fr; padding: 0 10px 8px 10px; font-size: 0.7em; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"><div>Equipe</div><div style="text-align: right;">${escapeHtml(primaryLabel)}</div><div style="text-align: right; color:#444;">${escapeHtml(secondaryLabel)}</div></div>`;
    return s2StatsPaginatedList(key, ordered, (row, rankIndex) => `<div style="display: grid; grid-template-columns: 1fr 0.5fr 0.4fr; align-items: center; margin-bottom: 6px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border-left: 3px solid ${s2StatsRankColor(rankIndex)}; font-size: 0.85em;">
                <div class="clickable" onclick="openCurrentSeasonTeam('${jsAttr(row.team)}')" style="display: flex; align-items: center; gap: 6px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="font-weight:bold; color: #555; margin-right: 4px;">${rankIndex + 1}º</span><img src="${escapeHtml(logo(row.team))}" style="width:16px; height:16px; object-fit: contain;" onerror="this.onerror=null;this.src='escudo.webp'"><span style="font-size: 0.95em; font-weight:bold;">${escapeHtml(abbreviation(row.team))}</span></div>
                <div style="font-weight: bold; color: var(--accent); text-align: right;">${escapeHtml(primaryFormatter(primaryGetter(row)))}</div>
                <div style="color: #555; font-size: 0.9em; text-align: right;">${escapeHtml(String(secondaryGetter(row)))}</div>
            </div>`, header, 4);
  }

  function s2StatsTeamPositionCard(key, rows) {
    const ordered = [...rows].sort((a, b) => a.avgPosition - b.avgPosition || b.kills - a.kills || b.points - a.points);
    const header = '<div style="display: grid; grid-template-columns: 1fr 0.5fr; padding: 0 10px 8px 10px; font-size: 0.7em; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"><div>Equipe</div><div style="text-align: right;">Pos</div></div>';
    return s2StatsPaginatedList(key, ordered, (row, rankIndex) => `<div style="display: grid; grid-template-columns: 1fr 0.5fr; align-items: center; margin-bottom: 6px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border-left: 3px solid ${s2StatsRankColor(rankIndex)}; font-size: 0.85em;">
                <div class="clickable" onclick="openCurrentSeasonTeam('${jsAttr(row.team)}')" style="display: flex; align-items: center; gap: 6px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="font-weight:bold; color: #555; margin-right: 4px;">${rankIndex + 1}º</span><img src="${escapeHtml(logo(row.team))}" style="width:16px; height:16px; object-fit: contain;" onerror="this.onerror=null;this.src='escudo.webp'"><span style="font-size: 0.95em; font-weight:bold;">${escapeHtml(abbreviation(row.team))}</span></div>
                <div style="font-weight: bold; color: var(--accent); text-align: right;">${row.avgPosition.toFixed(2)}º</div>
            </div>`, header, 4);
  }

  function s2StatsPlayerCard(key, rows, valueGetter, formatter, valueLabel) {
    const ordered = [...rows].sort((a, b) => number(valueGetter(b)) - number(valueGetter(a)) || b.kills - a.kills || b.damage - a.damage);
    const header = `<div style="display: grid; grid-template-columns: 1.2fr 1fr 0.7fr; padding: 0 10px 8px 10px; font-size: 0.7em; color: #666; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;"><div>Jogador</div><div>Equipe</div><div style="text-align: right;">${escapeHtml(valueLabel)}</div></div>`;
    return s2StatsPaginatedList(key, ordered, (row, rankIndex) => `<div style="display: grid; grid-template-columns: 1.2fr 1fr 0.7fr; align-items: center; margin-bottom: 6px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 4px; border-left: 3px solid ${s2StatsRankColor(rankIndex)}; font-size: 0.85em;">
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="font-weight:bold; color: #555; margin-right: 4px;">${rankIndex + 1}º</span><span class="clickable" onclick="openCurrentSeasonPlayer('${jsAttr(row.name)}','${jsAttr(row.team)}')" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span></div>
                <div class="clickable" onclick="openCurrentSeasonTeam('${jsAttr(row.team)}')" style="display: flex; align-items: center; gap: 6px; color: #9aa0a6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><img src="${escapeHtml(logo(row.team))}" style="width:14px; height:14px; object-fit: contain;" onerror="this.onerror=null;this.src='escudo.webp'"><span style="font-size: 0.9em;">${escapeHtml(abbreviation(row.team))}</span></div>
                <div style="font-weight: bold; color: var(--accent); text-align: right;">${escapeHtml(formatter(valueGetter(row)))}</div>
            </div>`, header, 4);
  }

  function statsRankingTable(rows, averages) {
    return `<div class="ffws-s2-table-wrap"><table class="ffws-s2-table ffws-s2-compact-table"><thead><tr><th>#</th><th>Eqp</th><th>PTS</th><th>K</th><th>${averages ? 'POS' : 'B!'}</th><th class="hide-mobile">Q</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td class="ffws-s2-rank">${index+1}º</td>${teamCell(row.team)}<td>${averages ? row.avgPoints.toFixed(2) : row.points}</td><td>${averages ? row.avgKills.toFixed(2) : row.kills}</td><td>${averages ? `${row.avgPosition.toFixed(2)}º` : row.booyahs}</td><td class="hide-mobile">${row.matches}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderStats() {
    const root = document.getElementById('ffws-br-s2-stats-content');
    if (!root) return;
    const options = statsFilterOptions();
    const events = filteredStatsEvents();
    const teams = aggregateStatsTeams(events);
    const playerEntries = filteredStatsPlayerEntries(events);
    const players = aggregateStatsPlayers(playerEntries);
    const totalResults = teams.reduce((sum, row) => sum + row.matches, 0);
    const totalPoints = teams.reduce((sum, row) => sum + row.points, 0);
    const totalKills = teams.reduce((sum, row) => sum + row.kills, 0);
    const totalBooyahs = teams.reduce((sum, row) => sum + row.booyahs, 0);
    const avgPosition = totalResults ? teams.reduce((sum, row) => sum + row.positionSum, 0) / totalResults : 0;
    const totalRanking = [...teams].sort((a, b) => b.points - a.points || b.booyahs - a.booyahs || b.kills - a.kills);
    const avgRanking = [...teams].sort((a, b) => b.avgPoints - a.avgPoints || b.avgKills - a.avgKills || a.avgPosition - b.avgPosition);
    const stageOptions = [['classificatoria','Classificatória'],['segundaFase','Segunda Fase'],['final','Final'],['geral','Geral']];

    const teamTotals = new Map();
    playerEntries.forEach(entry => {
      const key = normalize(entry.team);
      if (!teamTotals.has(key)) teamTotals.set(key, { kills: 0, damage: 0, assists: 0 });
      const row = teamTotals.get(key);
      row.kills += number(entry.kills);
      row.damage += number(entry.damage);
      row.assists += number(entry.assists);
    });
    const playerShareRows = players.filter(row => row.matches >= 3).map(row => {
      const total = teamTotals.get(normalize(row.team)) || { kills: 0, damage: 0, assists: 0 };
      return {
        ...row,
        avgPartKills: total.kills ? (row.kills / total.kills) * 100 : 0,
        avgPartDamage: total.damage ? (row.damage / total.damage) * 100 : 0,
        avgPartAssists: total.assists ? (row.assists / total.assists) * 100 : 0
      };
    });

    const statsBlocks = events.length ? `
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Resumo do recorte</h2><p>Todos os cards abaixo seguem o mesmo padrão visual da WB 2026 S1.</p></div><span class="ffws-s2-badge">${events.length} quedas</span></div>
      <div class="ffws-s2-stats-grid">${[['Quedas disputadas',events.length],['Total de pontos',totalPoints],['Total de abates',totalKills],['Total de booyahs',totalBooyahs],['Média de pontos',totalResults ? (totalPoints / totalResults).toFixed(2) : '0.00'],['Colocação média',avgPosition ? `${avgPosition.toFixed(2)}º` : '—']].map(([label, value]) => `<div class="ffws-s2-stat-card"><small>${label}</small><strong>${value}</strong></div>`).join('')}</div></div></section>
      <div style="margin-top: 26px;">
        <h4 id="anchor-totais-equipe" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Totais por Equipe</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Top Pontos</h3>${s2StatsTeamValueCard('eq-pts', teams, row => row.points, value => String(value), 'Pts')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Abates</h3>${s2StatsTeamValueCard('eq-kills', teams, row => row.kills, value => String(value), 'Kills')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Booyahs</h3>${s2StatsTeamValueCard('eq-booyah', teams, row => row.booyahs, value => String(value), 'B!')}</div>
        </div>

        <h4 id="anchor-medias-equipe" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Médias por Equipe</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Média Pontos</h3>${s2StatsTeamValueCard('eq-avgpts', teams, row => row.avgPoints, value => number(value).toFixed(2), 'Média')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Média Abates</h3>${s2StatsTeamValueCard('eq-avgkills', teams, row => row.avgKills, value => number(value).toFixed(2), 'Média')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Colocação Média</h3>${s2StatsTeamPositionCard('eq-avgpos', teams)}</div>
        </div>

        <h4 id="anchor-top3-equipe" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Top 3 &amp; Último Lugar por Equipe <span style="font-size:0.55em; color:#888; text-transform:none; font-weight:normal;">(número de quedas ao lado)</span></h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>+ Vezes no Top 3</h3>${s2StatsTeamDualValueCard('eq-top3-count', teams, row => row.top3, value => String(value), row => row.matches, 'Top3', 'Q')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Maior Média Top 3</h3>${s2StatsTeamDualValueCard('eq-top3-avg', teams, row => row.top3Rate, value => `${(number(value) * 100).toFixed(1)}%`, row => `${row.top3} x`, '% Top3', 'N')}</div>
            <div class="card"><div class="card-top-border"></div><h3>+ Vezes em Último (12º)</h3>${s2StatsTeamDualValueCard('eq-top12-count', teams, row => row.top12, value => String(value), row => row.matches, '12º', 'Q')}</div>
        </div>

        <h4 style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Totais por Jogador</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Top Abates</h3>${s2StatsPlayerCard('pl-totkills', players, row => row.kills, value => String(value), 'Kills')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Dano</h3>${s2StatsPlayerCard('pl-totdano', players, row => row.damage, value => number(value).toLocaleString('pt-BR'), 'Dano')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Assistências</h3>${s2StatsPlayerCard('pl-totast', players, row => row.assists, value => String(value), 'Ast')}</div>
        </div>

        <h4 style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Médias por Jogador</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Média Abates</h3>${s2StatsPlayerCard('pl-avgkills', players, row => row.avgKills, value => number(value).toFixed(2), 'Média')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Média Dano</h3>${s2StatsPlayerCard('pl-avgdano', players, row => row.avgDamage, value => number(value).toFixed(0), 'Média')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Média Assistências</h3>${s2StatsPlayerCard('pl-avgast', players, row => row.avgAssists, value => number(value).toFixed(2), 'Média')}</div>
        </div>

        <h4 style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Participação Relativa à Equipe <span style="font-size:0.6em; color:#666; text-transform: none; font-weight: normal;">(média % de contribuição por queda — min. 3 quedas)</span></h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Part. Kills</h3>${s2StatsPlayerCard('pl-partkills', playerShareRows, row => row.avgPartKills, value => `${number(value).toFixed(1)}%`, '%')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Part. Dano</h3>${s2StatsPlayerCard('pl-partdano', playerShareRows, row => row.avgPartDamage, value => `${number(value).toFixed(1)}%`, '%')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Part. Assists</h3>${s2StatsPlayerCard('pl-partast', playerShareRows, row => row.avgPartAssists, value => `${number(value).toFixed(1)}%`, '%')}</div>
        </div>
      </div>
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-ranking-columns"><div><div class="ffws-s2-panel-head"><div><h2>Ranking de Médias</h2><p>Desempenho por queda.</p></div></div>${statsRankingTable(avgRanking, true)}</div><div><div class="ffws-s2-panel-head"><div><h2>Ranking de Totais</h2><p>Desempenho acumulado.</p></div></div>${statsRankingTable(totalRanking, false)}</div></div></div></section>
    ` : `<section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-empty"><div><strong>Etapa ainda sem resultados</strong>Escolha a Classificatória para consultar as quedas já disputadas.</div></div></div></section>`;

    root.innerHTML = `<div class="ffws-s2-shell">${hero('Estatísticas Gerais', 'Indicadores e rankings das equipes da WB 2026 S2')}
      <section class="ffws-s2-panel ffws-s2-filter-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Filtros do torneio</h2><p>Todos os blocos abaixo usam exatamente o mesmo recorte.</p></div><span class="ffws-s2-badge">${events.length} quedas</span></div>
      <div class="ffws-s2-filters"><label class="ffws-s2-filter"><span>Etapa:</span><select onchange="setFFWSS2StatsStage(this.value)">${stageOptions.map(([value,label]) => `<option value="${value}"${state.statsFilters.stage === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>${statsMultiFilter('days','Dias',options.days)}${statsMultiFilter('confrontations','Confrontos',options.confrontations)}${statsMultiFilter('maps','Mapa',options.maps)}</div></div></section>
      ${statsBlocks}
    </div>`;
    if (state.statsOpenMulti) {
      const openMenu = document.getElementById(`ffws-s2-stats-multi-${state.statsOpenMulti}`);
      if (openMenu) openMenu.hidden = false;
    }
  }
  function calculateS2CffNote(kills, damage, assists, mvp, position) {
    kills = number(kills); damage = number(damage); assists = number(assists); position = number(position);
    if (!(kills >= 1 || damage >= 200)) {
      if (damage === 0 && assists === 0) return 3;
      let note = 3;
      if (damage > 0 && damage < 200) note += 0.8 + (damage / 199) * 0.5;
      note += 0.15 * assists;
      return Number(Math.min(note, 5.9).toFixed(1));
    }
    let note = 6 + 0.9 * Math.sqrt(kills);
    if (kills === 0) note += Math.min(Math.sqrt(0.25 * damage) / 55, 0.65);
    else {
      const expected = 620 * kills;
      const base = Math.min(damage, expected);
      const extra = Math.max(0, damage - expected);
      note += Math.min(Math.sqrt(base) / 90, 0.88);
      note += Math.min(Math.sqrt(extra) / 300, 0.1);
    }
    note += Math.min(0.08 * assists, 0.35);
    if (mvp) note += 0.25;
    if (note < 7.5) {
      if (position === 1) note += 0.2;
      else if (position <= 3) note += 0.1;
      else if (position <= 6) note += 0.06;
    }
    return Number(Math.min(note, 10).toFixed(1));
  }

  function s2EventLookup() {
    const lookup = new Map();
    ['classificatoria','segundaFase','final'].forEach(stage => stageEvents(stage).forEach((event,index) => {
      const day = number(event.day || event.round || event.number) || index + 1;
      const drop = number(event.drop || event.queda || event.number) || index + 1;
      lookup.set(`${stage}:${day}:${drop}`, event);
    }));
    return lookup;
  }

  function notesFilteredEntries() {
    const f = state.notesFilters;
    return allPlayerEntries().filter(entry => {
      const meta = rosterPlayerByName(entry.name, entry.team);
      const role = String(entry.roleShort || meta?.roleShort || '').toUpperCase();
      return (f.stage === 'geral' || String(entry.stage) === f.stage)
        && (f.team === 'all' || normalize(entry.team) === normalize(f.team))
        && (f.role === 'all' || role === f.role)
        && (f.day === 'all' || String(entry.day) === String(f.day))
        && (f.map === 'all' || normalize(entry.map) === normalize(f.map))
        && (f.drop === 'all' || String(entry.drop) === String(f.drop));
    });
  }

  function noteBadgeClass(note) {
    if (note >= 9) return 'elite';
    if (note >= 8) return 'great';
    if (note >= 7) return 'good';
    if (note >= 6) return 'average';
    return 'low';
  }

  function renderNotes() {
    const root = document.getElementById('ffws-br-s2-notas-content');
    if (!root) return;
    const f = state.notesFilters;
    const entries = notesFilteredEntries();
    const events = s2EventLookup();
    const detailed = entries.map(entry => {
      const event = events.get(`${entry.stage}:${number(entry.day)}:${number(entry.drop)}`);
      const result = eventResults(event).find(row => normalize(row.team || row.equipe) === normalize(entry.team));
      const position = number(result?.position || result?.posicao);
      const note = calculateS2CffNote(entry.kills, entry.damage, entry.assists, entry.mvp, position);
      return { ...entry, position, note };
    });
    const aggregate = new Map();
    detailed.forEach(entry => {
      const key = `${normalize(entry.name)}__${normalize(entry.team)}`;
      if (!aggregate.has(key)) aggregate.set(key,{name:entry.name,team:entry.team,sum:0,best:0,kills:0,damage:0,assists:0,mvps:0,matches:0});
      const row=aggregate.get(key); row.sum+=entry.note; row.best=Math.max(row.best,entry.note); row.kills+=number(entry.kills); row.damage+=number(entry.damage); row.assists+=number(entry.assists); row.mvps+=number(entry.mvp); row.matches+=1;
    });
    const rows=[...aggregate.values()].map(row=>({...row,note:row.matches?row.sum/row.matches:0})).sort((a,b)=>b.note-a.note||b.kills-a.kills||b.damage-a.damage);
    const teams=[...new Set(allPlayerEntries().map(entry=>entry.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const days=[...new Set(allPlayerEntries().filter(entry=>f.stage==='geral'||entry.stage===f.stage).map(entry=>number(entry.day)).filter(Boolean))].sort((a,b)=>a-b);
    const maps=[...new Set(allPlayerEntries().filter(entry=>f.stage==='geral'||entry.stage===f.stage).map(entry=>entry.map).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const drops=[...new Set(allPlayerEntries().filter(entry=>(f.stage==='geral'||entry.stage===f.stage)&&(f.day==='all'||String(entry.day)===String(f.day))).map(entry=>number(entry.drop)).filter(Boolean))].sort((a,b)=>a-b);
    const topDrops=[...detailed].sort((a,b)=>b.note-a.note||b.kills-a.kills||b.damage-a.damage).slice(0,4);
    const dayMap=new Map();
    detailed.forEach(entry=>{const key=`${normalize(entry.name)}__${entry.day}`;if(!dayMap.has(key))dayMap.set(key,{name:entry.name,team:entry.team,day:entry.day,kills:0,damage:0,mvp:0,notes:0,matches:0});const row=dayMap.get(key);row.kills+=number(entry.kills);row.damage+=number(entry.damage);row.mvp+=number(entry.mvp);row.notes+=entry.note;row.matches+=1});
    const topDays=[...dayMap.values()].map(row=>({...row,note:row.matches?row.notes/row.matches:0})).sort((a,b)=>b.note-a.note||b.kills-a.kills).slice(0,4);
    const noteRecord=(title,list,subtitle)=>`<article class="ffws-s2-top-card"><h3>${title}</h3>${list.length?list.map((row,index)=>`<button type="button" class="ffws-s2-note-record" onclick="openCurrentSeasonPlayer('${jsAttr(row.name)}','${jsAttr(row.team)}')"><b>${index+1}º</b><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(subtitle(row))}</small></span><em class="ffws-s2-note-badge ${noteBadgeClass(row.note)}">${row.note.toFixed(1)}</em></button>`).join(''):'<div class="ffws-s2-empty-mini">Nenhum resultado neste recorte.</div>'}</article>`;
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Notas CFF', 'Avaliações por queda no padrão SofaScore da Central Free Fire')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Ranking de Notas</h2><p>A nota combina abates, dano, assistências, MVP e posição final da equipe.</p></div><span class="ffws-s2-badge">${detailed.length} atuações</span></div>
      <div class="ffws-s2-filters">${notesSelect('stage','Etapa',[['classificatoria','Classificatória'],['segundaFase','Segunda Fase'],['final','Final'],['geral','Geral']])}${notesSelect('team','Equipe',[['all','Todas'],...teams.map(v=>[v,v])])}${notesSelect('role','Posição',[['all','Todas'],['RUSH','Rush'],['GRAN','Granadeiro'],['SUP','Suporte'],['3','3º homem']])}${notesSelect('day','Dias',[['all','Todos'],...days.map(v=>[String(v),`Dia ${v}`])])}${notesSelect('map','Mapa',[['all','Todos'],...maps.map(v=>[v,v])])}${notesSelect('drop','Queda',[['all','Todas'],...drops.map(v=>[String(v),`Queda ${v}`])])}</div>
      ${rows.length?`<div class="ffws-s2-table-wrap"><table class="ffws-s2-table"><thead><tr><th>#</th><th>Jogador</th><th>Eqp</th><th>Nota</th><th>K</th><th class="hide-mobile">Dano</th><th class="hide-mobile">Ast.</th><th>Q</th><th class="hide-mobile">Melhor</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td class="ffws-s2-rank">${index+1}º</td><td><button type="button" class="ffws-s2-inline-link" onclick="openCurrentSeasonPlayer('${jsAttr(row.name)}','${jsAttr(row.team)}')">${escapeHtml(row.name)}</button></td>${teamCell(row.team)}<td><span class="ffws-s2-note-badge ${noteBadgeClass(row.note)}">${row.note.toFixed(1)}</span></td><td>${row.kills}</td><td class="hide-mobile">${row.damage.toLocaleString('pt-BR')}</td><td class="hide-mobile">${row.assists}</td><td>${row.matches}</td><td class="hide-mobile">${row.best.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="ffws-s2-empty"><div><strong>Nenhuma nota neste recorte</strong>Altere os filtros para consultar as atuações disponíveis.</div></div>'}</div></section>
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Recordes de avaliação</h2><p>Melhores atuações individuais por queda, dia e média do recorte.</p></div></div><div class="ffws-s2-top-grid">${noteRecord('Top Quedas',topDrops,row=>`Dia ${row.day} • Q${row.drop} • ${row.kills} K`)}${noteRecord('Top Dias',topDays,row=>`Dia ${row.day} • ${row.kills} K`)}${noteRecord('Médias Gerais',rows.slice(0,4),row=>`${row.matches} quedas • ${row.kills} K`)}</div></div></section>
    </div>`;
  }

  function notesSelect(key, label, options) {
    const selected = String(state.notesFilters[key]);
    return `<label class="ffws-s2-filter"><span>${escapeHtml(label)}:</span><select onchange="setFFWSS2NotesFilter('${key}',this.value)">${options.map(([value,text])=>`<option value="${escapeHtml(value)}"${selected===String(value)?' selected':''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;
  }

  function compareFilteredEntries() {
    const f = state.compareFilters;
    return allPlayerEntries().filter(entry => {
      const meta = rosterPlayerByName(entry.name || entry.player, entry.team);
      const role = String(entry.roleShort || entry.role || meta?.roleShort || meta?.role || '').toUpperCase();
      return (f.stage === 'geral' || entry.stage === f.stage)
        && (!f.roles.length || f.roles.includes(role))
        && (f.day === 'all' || String(entry.day) === String(f.day))
        && (f.map === 'all' || normalize(entry.map) === normalize(f.map));
    });
  }

  function compareAggregate(entries) {
    const rows = new Map();
    entries.forEach(entry => {
      const key = `${normalize(entry.name)}__${normalize(entry.team)}`;
      if (!rows.has(key)) rows.set(key,{key,name:entry.name,team:entry.team,kills:0,damage:0,assists:0,matches:0,mvps:0,bestDrop:0});
      const row=rows.get(key);row.kills+=number(entry.kills);row.damage+=number(entry.damage);row.assists+=number(entry.assists);row.matches+=1;row.mvps+=number(entry.mvp);row.bestDrop=Math.max(row.bestDrop,number(entry.kills));
    });
    return [...rows.values()].map(row=>({...row,avgKills:row.matches?row.kills/row.matches:0,avgDamage:row.matches?row.damage/row.matches:0,avgAssists:row.matches?row.assists/row.matches:0})).sort((a,b)=>b.kills-a.kills||b.damage-a.damage);
  }

  function compareHero(row, side) {
    const meta=rosterPlayerByName(row?.name,row?.team)||{};
    return `<article class="ffws-s2-player-compare-hero ${side}"><img class="ffws-s2-compare-photo" src="${escapeHtml(playerPhoto(meta))}" alt="${escapeHtml(row?.name||'Jogador')}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='silhueta.webp'"><div><img class="ffws-s2-compare-team-logo" src="${escapeHtml(logo(row?.team))}" alt=""><strong>${escapeHtml(row?.name||'—')}</strong><span>${escapeHtml(row?.team||'Sem equipe')}</span></div></article>`;
  }

  function compareMetric(label, a, b, lowerBetter = false, formatter = value => String(value)) {
    const av=number(a),bv=number(b);const aWin=lowerBetter?av<bv:av>bv;const bWin=lowerBetter?bv<av:bv>av;
    return `<div class="ffws-s2-compare-metric"><strong class="${aWin?'winner':''}">${escapeHtml(formatter(a))}</strong><span>${escapeHtml(label)}</span><strong class="${bWin?'winner':''}">${escapeHtml(formatter(b))}</strong></div>`;
  }

  function comparePlayerPicker(side, rows, selectedRow, label) {
    const ordered = [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR') || String(a.team).localeCompare(String(b.team), 'pt-BR'));
    const selectedText = selectedRow ? `${selectedRow.name} • ${abbreviation(selectedRow.team)}` : '';
    return `<label class="ffws-s2-compare-picker-label"><span>${escapeHtml(label)}</span><div class="ffws-s2-compare-picker" data-compare-picker="${side}">
      <div class="ffws-s2-compare-search-box"><span aria-hidden="true">⌕</span><input id="ffws-s2-compare-search-${side}" type="search" value="${escapeHtml(selectedText)}" placeholder="Pesquisar jogador..." autocomplete="off" spellcheck="false" onfocus="this.select();openFFWSS2ComparePicker('${side}')" oninput="filterFFWSS2ComparePicker('${side}',this.value)" onkeydown="handleFFWSS2ComparePickerKey(event,'${side}')"></div>
      <div class="ffws-s2-compare-picker-menu" id="ffws-s2-compare-picker-${side}" hidden>
        <div class="ffws-s2-compare-picker-hint">Digite o nome do jogador</div>
        <div class="ffws-s2-compare-picker-options">${ordered.map(row => `<button type="button" class="ffws-s2-compare-picker-option${selectedRow?.key === row.key ? ' is-selected' : ''}" data-compare-search="${escapeHtml(`${row.name} ${row.team} ${abbreviation(row.team)}`)}" onclick="chooseFFWSS2ComparePlayer('${side}','${jsAttr(row.key)}')"><img src="${escapeHtml(logo(row.team))}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='escudo.webp'"><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.team)}</small></span>${selectedRow?.key === row.key ? '<b>✓</b>' : ''}</button>`).join('')}</div>
        <div class="ffws-s2-compare-picker-empty" hidden>Nenhum jogador encontrado.</div>
      </div>
    </div></label>`;
  }

  function renderCompare() {
    const root = document.getElementById('ffws-br-s2-comparar-content');
    if (!root) return;
    const rows=compareAggregate(compareFilteredEntries());
    if (!state.comparePlayers.p1 || !rows.some(row=>row.key===state.comparePlayers.p1)) state.comparePlayers.p1=rows[0]?.key||'';
    if (!state.comparePlayers.p2 || !rows.some(row=>row.key===state.comparePlayers.p2) || state.comparePlayers.p2===state.comparePlayers.p1) state.comparePlayers.p2=rows.find(row=>row.key!==state.comparePlayers.p1)?.key||state.comparePlayers.p1;
    const p1=rows.find(row=>row.key===state.comparePlayers.p1)||null;
    const p2=rows.find(row=>row.key===state.comparePlayers.p2)||null;
    const days=[...new Set(allPlayerEntries().filter(e=>state.compareFilters.stage==='geral'||e.stage===state.compareFilters.stage).map(e=>number(e.day)).filter(Boolean))].sort((a,b)=>a-b);
    const maps=[...new Set(allPlayerEntries().filter(e=>state.compareFilters.stage==='geral'||e.stage===state.compareFilters.stage).map(e=>e.map).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const roleOptions=playerFilterOptions().role;
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Comparar 1V1', 'Compare dois jogadores da WB 2026 S2')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Escolha o confronto</h2><p>Pesquise pelo nome e filtre os jogadores por posição, etapa, dia ou mapa.</p></div><span class="ffws-s2-badge">${rows.length} jogadores ativos</span></div>
      <div class="ffws-s2-filters">${compareSelect('stage','Etapa',[['classificatoria','Classificatória'],['segundaFase','Segunda Fase'],['final','Final'],['geral','Geral']])}${compareMultiFilter('roles','Posição',roleOptions)}${compareSelect('day','Dia',[['all','Todos'],...days.map(v=>[String(v),`Dia ${v}`])])}${compareSelect('map','Mapa',[['all','Todos'],...maps.map(v=>[v,v])])}</div>
      ${p1&&p2?`<div class="ffws-s2-compare-selectors">${comparePlayerPicker('p1',rows,p1,'Jogador 1')}<b>VS</b>${comparePlayerPicker('p2',rows,p2,'Jogador 2')}</div><div class="ffws-s2-player-compare-grid">${compareHero(p1,'left')}<div class="ffws-s2-compare-metrics">${compareMetric('Abates',p1.kills,p2.kills)}${compareMetric('Dano',p1.damage,p2.damage,false,v=>number(v).toLocaleString('pt-BR'))}${compareMetric('Assistências',p1.assists,p2.assists)}${compareMetric('Quedas',p1.matches,p2.matches)}${compareMetric('MVPs',p1.mvps,p2.mvps)}${compareMetric('K / queda',p1.avgKills,p2.avgKills,false,v=>number(v).toFixed(2))}${compareMetric('Dano / queda',p1.avgDamage,p2.avgDamage,false,v=>Math.round(number(v)).toLocaleString('pt-BR'))}${compareMetric('Assist. / queda',p1.avgAssists,p2.avgAssists,false,v=>number(v).toFixed(2))}${compareMetric('Recorde em queda',p1.bestDrop,p2.bestDrop)}</div>${compareHero(p2,'right')}</div>`:'<div class="ffws-s2-empty"><div><strong>Nenhum jogador neste recorte</strong>Altere a posição, etapa, dia ou mapa para comparar os jogadores disponíveis.</div></div>'}</div></section></div>`;
  }

  function compareSelect(key,label,options){const selected=String(state.compareFilters[key]);return `<label class="ffws-s2-filter"><span>${escapeHtml(label)}:</span><select onchange="setFFWSS2CompareFilter('${key}',this.value)">${options.map(([value,text])=>`<option value="${escapeHtml(value)}"${selected===String(value)?' selected':''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;}

  function compareMultiFilter(key, title, options) {
    const selected = state.compareFilters[key] || [];
    const label = selected.length ? `${selected.length} selecionado${selected.length > 1 ? 's' : ''}` : 'Todos';
    return `<div class="ffws-s2-filter"><span>${escapeHtml(title)}:</span><div class="ffws-s2-multi" data-s2-compare-multi="${escapeHtml(key)}">
      <button type="button" onclick="toggleFFWSS2CompareMulti('${key}')"><b>${escapeHtml(label)}</b><span>⌄</span></button>
      <div class="ffws-s2-multi-menu" id="ffws-s2-compare-multi-${escapeHtml(key)}" hidden>
        <label><input type="checkbox" ${selected.length === 0 ? 'checked' : ''} onchange="clearFFWSS2CompareMulti('${key}')"> Todos</label>
        ${options.map(option => `<label><input type="checkbox" value="${escapeHtml(option.value)}" ${selected.includes(String(option.value)) ? 'checked' : ''} onchange="setFFWSS2CompareMulti('${key}',this.value,this.checked)"> ${escapeHtml(option.label)}</label>`).join('')}
      </div>
    </div></div>`;
  }

  function renderPage(pageId) {
    if (!state.loaded) return;
    switch (pageId) {
      case 'ffws-br-s2-classificatoria': renderStage('classificatoria', 'ffws-br-s2-classificatoria-content', 'Classificatória', 'Primeira fase com 14 equipes, 14 rodadas e dois rebaixamentos diretos'); break;
      case 'ffws-br-s2-segunda-fase': renderStage('segundaFase', 'ffws-br-s2-segunda-fase-content', 'Segunda Fase', 'Doze equipes, bônus da primeira fase e duas vagas diretas no Mundial'); break;
      case 'ffws-br-s2-final': renderStage('final', 'ffws-br-s2-final-content', 'Final', 'Dois dias de Champion Rush com linha de chegada em 160 pontos'); break;
      case 'ffws-br-s2-mvp': renderMvp(); break;
      case 'ffws-br-s2-equipes': renderTeams(); break;
      case 'ffws-br-s2-datas': renderDates(); break;
      case 'ffws-br-s2-selecoes': renderSelections(); break;
      case 'ffws-br-s2-stats': renderStats(); break;
      case 'ffws-br-s2-notas': renderNotes(); break;
      case 'ffws-br-s2-comparar': renderCompare(); break;
    }
  }

  function activate(pageId) {
    if (!PAGE_IDS.has(pageId)) return;
    const root = document.getElementById(`${pageId}-content`);
    if (root && !root.dataset.s2Loading) {
      root.dataset.s2Loading = '1';
      root.innerHTML = '<div class="ffws-s2-empty"><div><strong>Carregando WB 2026 S2...</strong></div></div>';
    }
    const needsPlayers = new Set(['ffws-br-s2-mvp', 'ffws-br-s2-equipes', 'ffws-br-s2-selecoes', 'ffws-br-s2-stats', 'ffws-br-s2-notas', 'ffws-br-s2-comparar']).has(pageId);
    const needsPhotos = new Set(['ffws-br-s2-equipes', 'ffws-br-s2-selecoes']).has(pageId);
    loadData()
      .then(() => needsPlayers ? loadPlayersData() : null)
      .then(() => needsPhotos && typeof window.cffLoadPlayerPhotoMap === 'function' ? window.cffLoadPlayerPhotoMap().catch(() => null) : null)
      .then(() => renderPage(pageId))
      .catch(error => {
        if (root) root.innerHTML = `<div class="ffws-s2-empty"><div><strong>Não foi possível exibir esta página</strong>Tente novamente em instantes.</div></div>`;
      });
  }

  window.setFFWSS2StageFilter = (stageKey, type, value) => {
    state.stageFilter[stageKey] = state.stageFilter[stageKey] || { period: 'all', map: 'all', drop: 'all' };
    state.stageFilter[stageKey][type] = value;
    const map = { classificatoria: 'ffws-br-s2-classificatoria', segundaFase: 'ffws-br-s2-segunda-fase', final: 'ffws-br-s2-final' };
    renderPage(map[stageKey]);
  };
  window.setFFWSS2SelectionWeek = week => { state.selectionTab = 'semanal'; state.selectionWeek = String(week || '1'); renderSelections(); };
  window.setFFWSS2SelectionTab = tab => { state.selectionTab = S2_SELECTION_PHASES[tab] ? tab : 'semanal'; renderSelections(); };
  window.setFFWSS2StatsStage = value => { state.statsStage = value; state.statsFilters.stage = String(value || 'classificatoria'); state.statsFilters.days = []; state.statsFilters.confrontations = []; state.statsFilters.maps = []; state.statsOpenMulti = null; renderStats(); };
  window.toggleFFWSS2StatsMulti = key => { const menu = document.getElementById(`ffws-s2-stats-multi-${key}`); const willOpen = !!menu && menu.hidden; state.statsOpenMulti = willOpen ? key : null; document.querySelectorAll('.ffws-s2-multi-menu').forEach(item => { if (item.id !== `ffws-s2-stats-multi-${key}`) item.hidden = true; }); if (menu) menu.hidden = !willOpen ? true : false; };
  window.clearFFWSS2StatsMulti = key => { state.statsFilters[key] = []; state.statsOpenMulti = key; renderStats(); };
  window.setFFWSS2StatsMulti = (key, value, checked) => { const selected = new Set(state.statsFilters[key] || []); checked ? selected.add(String(value)) : selected.delete(String(value)); state.statsFilters[key] = [...selected]; state.statsOpenMulti = key; renderStats(); };
  window.ffwsS2StatsPageNav = (key, delta) => { const pages = s2StatsPageState(); pages[key] = delta === 'reset' ? 0 : number(pages[key]) + number(delta); renderStats(); };
  window.setFFWSS2NotesFilter = (key, value) => { state.notesFilters[key] = String(value); if (key === 'stage') { state.notesFilters.day = 'all'; state.notesFilters.map = 'all'; state.notesFilters.drop = 'all'; } if (key === 'day') state.notesFilters.drop = 'all'; renderNotes(); };
  window.setFFWSS2CompareFilter = (key, value) => { state.compareFilters[key] = String(value); if (key === 'stage') { state.compareFilters.day = 'all'; state.compareFilters.map = 'all'; } renderCompare(); };
  window.toggleFFWSS2CompareMulti = key => {
    document.querySelectorAll('.ffws-s2-multi-menu').forEach(menu => { if (menu.id !== `ffws-s2-compare-multi-${key}`) menu.hidden = true; });
    const menu = document.getElementById(`ffws-s2-compare-multi-${key}`);
    if (menu) menu.hidden = !menu.hidden;
  };
  window.clearFFWSS2CompareMulti = key => { if (Array.isArray(state.compareFilters[key])) state.compareFilters[key] = []; renderCompare(); };
  window.setFFWSS2CompareMulti = (key, value, checked) => {
    if (!Array.isArray(state.compareFilters[key])) return;
    const selected = new Set(state.compareFilters[key]);
    checked ? selected.add(String(value)) : selected.delete(String(value));
    state.compareFilters[key] = [...selected];
    renderCompare();
  };
  window.setFFWSS2ComparePlayer = (side, value) => { state.comparePlayers[side] = String(value); renderCompare(); };
  window.openFFWSS2ComparePicker = side => {
    document.querySelectorAll('.ffws-s2-compare-picker-menu').forEach(menu => { menu.hidden = menu.id !== `ffws-s2-compare-picker-${side}`; });
    const menu = document.getElementById(`ffws-s2-compare-picker-${side}`);
    if (menu) menu.hidden = false;
    window.filterFFWSS2ComparePicker(side, '');
  };
  window.filterFFWSS2ComparePicker = (side, term) => {
    const menu = document.getElementById(`ffws-s2-compare-picker-${side}`);
    if (!menu) return;
    menu.hidden = false;
    const query = normalize(term);
    let visible = 0;
    menu.querySelectorAll('.ffws-s2-compare-picker-option').forEach(option => {
      const match = !query || normalize(option.dataset.compareSearch).includes(query);
      option.hidden = !match;
      if (match) visible += 1;
    });
    const empty = menu.querySelector('.ffws-s2-compare-picker-empty');
    if (empty) empty.hidden = visible > 0;
  };
  window.chooseFFWSS2ComparePlayer = (side, value) => {
    state.comparePlayers[side] = String(value);
    renderCompare();
  };
  window.handleFFWSS2ComparePickerKey = (event, side) => {
    const menu = document.getElementById(`ffws-s2-compare-picker-${side}`);
    if (!menu) return;
    if (event.key === 'Escape') { menu.hidden = true; event.currentTarget.blur(); return; }
    if (event.key === 'Enter') {
      const first = [...menu.querySelectorAll('.ffws-s2-compare-picker-option')].find(option => !option.hidden);
      if (first) { event.preventDefault(); first.click(); }
    }
  };
  window.toggleFFWSS2Multi = key => {
    document.querySelectorAll('.ffws-s2-multi-menu').forEach(menu => { if (menu.id !== `ffws-s2-multi-${key}`) menu.hidden = true; });
    const menu = document.getElementById(`ffws-s2-multi-${key}`);
    if (menu) menu.hidden = !menu.hidden;
  };
  window.clearFFWSS2Multi = key => { state.playerFilters[key] = []; renderMvp(); };
  window.setFFWSS2Multi = (key, value, checked) => {
    const list = new Set(state.playerFilters[key] || []);
    checked ? list.add(String(value)) : list.delete(String(value));
    state.playerFilters[key] = [...list];
    renderMvp();
  };

  document.addEventListener('click', event => {
    if (!event.target.closest('.ffws-s2-multi')) document.querySelectorAll('.ffws-s2-multi-menu').forEach(menu => { menu.hidden = true; });
    if (!event.target.closest('.ffws-s2-compare-picker')) document.querySelectorAll('.ffws-s2-compare-picker-menu').forEach(menu => { menu.hidden = true; });
  });

  function wrapNavigate() {
    const original = window.navigate;
    if (typeof original !== 'function' || original.__ffwsS2Wrapped) return false;
    const wrapped = function(pageId) {
      const result = original.apply(this, arguments);
      activate(String(pageId || ''));
      return result;
    };
    wrapped.__ffwsS2Wrapped = true;
    window.navigate = wrapped;
    return true;
  }

  function init() {
    wrapNavigate();
    const hash = String(location.hash || '').replace(/^#/, '');
    if (PAGE_IDS.has(hash)) activate(hash);
    const observer = new MutationObserver(() => {
      const active = document.querySelector(`.page.active[id^="${PAGE_PREFIX}"]`);
      if (active) activate(active.id);
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
