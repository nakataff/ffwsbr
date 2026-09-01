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
    selectionWeek: '',
    selectionTab: 'semanal',
    mvpPage: 0,
    playerFilters: { stage: [], team: [], role: [], country: [], rookie: [], day: [] },
    statsFilters: { stage: 'classificatoria', days: [], maps: [] },
    statsEvolution: { metric: 'position', teams: [] },
    notesFilters: { mode: 'day', stage: ['classificatoria'], team: [], role: [], day: [], map: [], drop: [], halfMatches: true },
    notesOpenMulti: '',
    notesPage: 0,
    notesRecordPages: { drops: 0, days: 0, averages: 0 },
    compareFilters: { stage: 'classificatoria', roles: [], day: 'all', map: 'all' },
    comparePlayers: { p1: '', p2: '' },
    statsStage: 'classificatoria',
    dropReport: { mode: 'drop', key: '', tab: 'summary', teamSort: 'points', playerSort: 'kills', playerTeams: [], teamDetail: '' }
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
      .sort((a, b) => Number(Boolean(a.left)) - Number(Boolean(b.left))
        || Number(b.starter) - Number(a.starter)
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
    const departed = Boolean(player?.left) || normalize(player?.rosterStatus) === 'saiu';
    if (departed) badges.push('<span class="ffws-s2-roster-badge departed">Saiu</span>');
    else {
      if (player?.captain) badges.push('<span class="ffws-s2-roster-badge captain">Capitão</span>');
      if (player?.rookie) badges.push('<span class="ffws-s2-roster-badge rookie">Estreante</span>');
      if (player?.highlight) badges.push('<span class="ffws-s2-roster-badge highlight">Destaque</span>');
    }
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
    const layoutApi = window.FFWSBRSeasonLayout;
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
    const periodEvents = selected.period === 'all' ? [] : events.filter((event, index) => {
      const round = number(event.round) || number(event.day) || number(event.number) || index + 1;
      return String(round) === String(selected.period);
    });
    const drops = [...new Set(periodEvents.map((event, index) => number(event.drop) || number(event.queda) || number(event.number) || index + 1).filter(Boolean))].sort((a, b) => a - b);
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
          id: 'ffws-s2-filter-round', label: 'Rodada:',
          onchange: "setFFWSS2StageFilter('classificatoria','period',this.value)", selected: selected.period,
          options: [{ value: 'all', label: 'Todas as rodadas' }].concat(Array.from({ length: 14 }, (_, index) => ({ value: String(index + 1), label: `Rodada ${index + 1}` })))
        },
        map: {
          id: 'ffws-s2-filter-map', label: 'Mapa:',
          onchange: "setFFWSS2StageFilter('classificatoria','map',this.value)", selected: selected.map,
          options: [{ value: 'all', label: 'Todos os Mapas' }].concat(mapOptions)
        },
        drop: {
          containerId: 'ffws-s2-drop-filter-container', id: 'ffws-s2-filter-drop', label: 'Queda:',
          onchange: "setFFWSS2StageFilter('classificatoria','drop',this.value)", selected: selected.period === 'all' ? 'all' : selected.drop,
          visible: true,
          options: selected.period === 'all'
            ? [{ value: 'all', label: 'Selecione uma rodada' }]
            : [{ value: 'all', label: 'Todas as quedas' }].concat(drops.map(drop => ({ value: String(drop), label: `Queda ${drop}` })))
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

    // No S2, os três filtros da classificatória ficam em uma única sequência:
    // Rodada > Queda > Mapa. A queda só é habilitada após escolher uma rodada.
    const filterRow = root.querySelector('.ffws-season-filters');
    const dropContainer = root.querySelector('#ffws-s2-drop-filter-container');
    const mapLabel = filterRow?.querySelector('.ffws-season-map-label');
    const dropLabel = dropContainer?.querySelector('label');
    const dropSelect = root.querySelector('#ffws-s2-filter-drop');
    if (filterRow && dropContainer && mapLabel && dropLabel && dropSelect) {
      filterRow.classList.add('ffws-s2-classification-inline-filters');
      filterRow.insertBefore(dropLabel, mapLabel);
      filterRow.insertBefore(dropSelect, mapLabel);
      dropContainer.remove();
      const dropLocked = selected.period === 'all' || drops.length === 0;
      dropSelect.disabled = dropLocked;
      dropSelect.title = dropLocked ? 'Escolha uma rodada para liberar o filtro de queda' : '';
    }
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

  function multiFilter(key, title, options) {
    const selected = state.playerFilters[key] || [];
    const label = selected.length ? `${selected.length} selecionado${selected.length > 1 ? 's' : ''}` : `Todos`;
    return `<div class="ffws-s2-filter"><span>${escapeHtml(title)}:</span><div class="ffws-s2-multi" data-s2-multi="${escapeHtml(key)}">
      <button type="button" onclick="toggleFFWSS2Multi('${key}')"><b>${escapeHtml(label)}</b><span>⌄</span></button>
      <div class="ffws-s2-multi-menu" id="ffws-s2-multi-${escapeHtml(key)}" hidden>
        <label><input type="checkbox" ${selected.length === 0 ? 'checked' : ''} onchange="clearFFWSS2Multi('${key}')"> Todos</label>
        ${options.map(option => `<label><input type="checkbox" value="${escapeHtml(option.value)}" ${selected.includes(String(option.value)) ? 'checked' : ''} onchange="setFFWSS2Multi('${key}',this.value,this.checked)"> ${option.flag ? `<span>${escapeHtml(option.flag)}</span>` : ''}${escapeHtml(option.label)}</label>`).join('')}
      </div>
    </div></div>`;
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
    const root = document.getElementById('ffws-br-s2-mvp-content');
    if (!root) return;
    const options = playerFilterOptions();
    const rows = filteredPlayers();
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    state.mvpPage = Math.max(0, Math.min(number(state.mvpPage), pageCount - 1));
    const pageStart = state.mvpPage * pageSize;
    const pageRows = rows.slice(pageStart, pageStart + pageSize);
    const pageEnd = Math.min(pageStart + pageRows.length, rows.length);
    const pager = rows.length > pageSize ? `<div class="ffws-s2-mvp-pager">
      <button type="button" aria-label="Top 10 anterior" ${state.mvpPage <= 0 ? 'disabled' : ''} onclick="setFFWSS2MvpPage(${state.mvpPage - 1})">‹</button>
      <span>Top ${pageStart + 1}–${pageEnd} de ${rows.length}</span>
      <button type="button" aria-label="Próximo Top 10" ${state.mvpPage >= pageCount - 1 ? 'disabled' : ''} onclick="setFFWSS2MvpPage(${state.mvpPage + 1})">›</button>
    </div>` : '';
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Ranking MVP', 'Classificação individual da WB 2026 S2')}
      <section class="ffws-s2-panel ffws-s2-mvp-panel"><div class="ffws-s2-panel-inner">
        <div class="ffws-s2-panel-head"><div><h2>Classificação Geral de Jogadores</h2><p>Filtre o ranking por etapa, equipe, posição, país e dia.</p></div><span class="ffws-s2-badge">${rows.length} jogadores</span></div>
        <div class="ffws-s2-filters">${multiFilter('stage', 'Etapa', options.stage)}${multiFilter('team', 'Equipe', options.team)}${multiFilter('role', 'Posição', options.role)}${multiFilter('country', 'País', options.country)}${multiFilter('rookie', 'Novatos', options.rookie)}${multiFilter('day', 'Dias', options.day)}</div>
        <div class="ffws-s2-mvp-mobile-tools"><span>Visual compacto: J · E · K · Q</span><button type="button" class="ffws-s2-mvp-details-toggle" aria-expanded="false">Dados completos</button></div>
        <div class="ffws-s2-table-wrap"><table class="ffws-s2-table ffws-s2-mvp-table"><thead><tr><th class="ffws-s2-mvp-rank-col">#</th><th class="team-col ffws-s2-mvp-player-col"><span class="ffws-s2-desktop">Jogador</span><span class="ffws-s2-mobile">J</span></th><th><span class="ffws-s2-desktop">Eqp</span><span class="ffws-s2-mobile">E</span></th><th>K</th><th class="hide-mobile">Dano</th><th class="hide-mobile">Assist.</th><th>Q</th><th class="hide-mobile">MVP</th><th class="hide-mobile">K/Q</th></tr></thead><tbody>
        ${pageRows.length ? pageRows.map((row, index) => {
          const rank = pageStart + index + 1;
          return `<tr class="ffws-s2-mvp-main-row"><td class="ffws-s2-rank ffws-s2-mvp-rank-col">${rank}º</td><td class="team-col ffws-s2-mvp-player-col"><button type="button" class="ffws-s2-inline-link" onclick="openCurrentSeasonPlayer('${jsAttr(row.name)}', '${jsAttr(row.team)}')">${escapeHtml(row.name)}</button></td>${teamCell(row.team)}<td>${row.kills}</td><td class="hide-mobile">${row.damage.toLocaleString('pt-BR')}</td><td class="hide-mobile">${row.assists}</td><td>${row.matches}</td><td class="hide-mobile">${row.mvps}</td><td class="hide-mobile">${row.matches ? (row.kills / row.matches).toFixed(2) : '0.00'}</td></tr>
          <tr class="ffws-s2-mvp-details-row"><td colspan="9"><div class="ffws-s2-mvp-details-grid">
            <div><span>Posição</span><strong>${rank}º</strong></div>
            <div><span>Dano</span><strong>${row.damage.toLocaleString('pt-BR')}</strong></div>
            <div><span>Assistências</span><strong>${row.assists}</strong></div>
            <div><span>MVP da queda</span><strong>${row.mvps}</strong></div>
            <div><span>K / queda</span><strong>${row.matches ? (row.kills / row.matches).toFixed(2) : '0.00'}</strong></div>
            <div><span>Recorde em queda</span><strong>${row.bestDrop}</strong></div>
          </div></td></tr>`;
        }).join('') : '<tr><td colspan="9"><div class="ffws-s2-empty"><div><strong>Nenhum resultado neste recorte</strong>Altere os filtros para consultar os dados disponíveis.</div></div></td></tr>'}
        </tbody></table></div>
        ${pager}
      </div></section></div>`;

    const detailsButton = root.querySelector('.ffws-s2-mvp-details-toggle');
    if (detailsButton) detailsButton.addEventListener('click', () => {
      const panel = root.querySelector('.ffws-s2-mvp-panel');
      if (!panel) return;
      const expanded = panel.classList.toggle('show-details');
      detailsButton.setAttribute('aria-expanded', String(expanded));
      detailsButton.textContent = expanded ? 'Ocultar detalhes' : 'Dados completos';
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
        const departed = roster.filter(player => Boolean(player.left) || normalize(player.rosterStatus) === 'saiu').length;
        const starters = roster.filter(player => player.starter && !player.left).length;
        const reserves = roster.filter(player => !player.starter && !player.left).length;
        return `<article class="ffws-s2-team-card ffws-s2-team-roster-card" role="button" tabindex="0" onclick="openCurrentSeasonTeam('${jsAttr(team.name)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCurrentSeasonTeam('${jsAttr(team.name)}')}">
          <header class="ffws-s2-team-roster-head"><img loading="lazy" decoding="async" src="${escapeHtml(logo(team.name))}" alt="${escapeHtml(team.name)}" onerror="this.onerror=null;this.src='escudo.webp'"><div><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.abbreviation)} • Brasil</small><small class="${team.logoPending ? 'ffws-s2-logo-pending' : ''}">${starters} titulares • ${reserves} reservas${departed ? ` • ${departed} saiu` : ''}</small></div></header>
          <div class="ffws-s2-roster-list">${roster.length ? roster.map(player => `<button type="button" class="ffws-s2-roster-player${player.left ? ' departed' : (player.starter ? '' : ' reserve')}" onclick="event.stopPropagation();openCurrentSeasonPlayer('${jsAttr(player.name)}', '${jsAttr(player.team)}')">
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
    semanal: { label: 'TIMES DA SEMANA', short: 'SEMANA', color: '#ff0000', panelClass: 'week', title: 'Times da semana' },
    classificatoria: { label: 'CLASSIFICATÓRIA', short: 'CLASSIF.', color: '#00c8ff', panelClass: 'classificatoria', title: 'Seleção da classificatória' },
    segundaFase: { label: 'SEGUNDA FASE', short: '2ª FASE', color: '#21c778', panelClass: 'segunda-fase', title: 'Seleção da segunda fase' },
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
    return Object.keys(S2_WEEKS).filter(key => {
      const days = S2_WEEKS[key] || [];
      return entries.some(entry => days.includes(selectionEntryDay(entry)));
    });
  }

  function selectionTabsHtml() {
    const finalUnlocked = selectionFinalComplete();
    return Object.entries(S2_SELECTION_PHASES).map(([key, config]) => {
      const unlocked = key === 'semanal' || key === 'classificatoria' || ((key === 'final' || key === 'torneio') && finalUnlocked);
      const active = state.selectionTab === key;
      return `<button type="button" class="season-selection-tab ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}" style="--selection-color:${config.color}" ${unlocked ? `onclick="setFFWSS2SelectionTab('${key}')"` : 'disabled aria-disabled="true"'}>
        <span>${config.label}</span>${unlocked ? '' : '<small>EM BREVE</small>'}
      </button>`;
    }).join('');
  }

  function selectionGlow(color) {
    if (color === '#00c8ff') return 'rgba(0,200,255,.48)';
    if (color === '#21c778') return 'rgba(33,199,120,.44)';
    if (color === '#ffd166') return 'rgba(255,209,102,.45)';
    if (color === '#a855f7') return 'rgba(168,85,247,.45)';
    return 'rgba(255,0,0,.50)';
  }

  function selectionBackdrop(color) {
    if (color === '#00c8ff') return '#06283a';
    if (color === '#21c778') return '#063524';
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
    const allWeeks = Object.keys(S2_WEEKS);
    const latestAvailableWeek = availableWeeks[availableWeeks.length - 1] || allWeeks[0] || '1';
    if (!availableWeeks.includes(String(state.selectionWeek))) state.selectionWeek = latestAvailableWeek;
    const week = String(state.selectionWeek || latestAvailableWeek);
    const finalUnlocked = selectionFinalComplete();

    let rows = [];
    let title = config.title;
    let description = '';
    let filters = '';
    let notice = '';
    let content = '';

    if (phaseKey === 'semanal') {
      const weekUnlocked = availableWeeks.includes(week);
      rows = weekUnlocked ? selectionRowsForWeek(week) : [];
      const lineup = buildWeeklySelection(rows);
      title = 'Times da Semana';
      description = 'O resultado mais recente disponível aparece primeiro. Semanas futuras são liberadas quando recebem os primeiros dados.';
      const phaseFilter = `<div class="season-selection-week-stage-filter"><span>Fase:</span><button type="button" class="active">Classificatória</button><button type="button" disabled aria-disabled="true">Segunda Fase <small>EM BREVE</small></button></div>`;
      const weekButtons = allWeeks.map(key => {
        const unlocked = availableWeeks.includes(key);
        const active = unlocked && week === key;
        return `<button type="button" class="btn-day season-selection-week-btn ${active ? 'active' : ''} ${unlocked ? '' : 'is-locked'}" ${unlocked ? `onclick="setFFWSS2SelectionWeek('${key}')"` : 'disabled aria-disabled="true"'} style="${active ? 'background:#ff0000;border-color:#ff0000;color:#fff;' : ''}">SEMANA ${key}${unlocked ? '' : '<small>EM BREVE</small>'}</button>`;
      }).join('');
      filters = `${phaseFilter}<div class="season-selection-filters">${weekButtons}</div>`;
      content = lineup.length ? lineup.map(row => selectionCard(row, phaseKey)).join('') : selectionEmptyHtml(phaseKey, week);
    } else if (phaseKey === 'classificatoria') {
      rows = selectionRowsForDays([]);
      const lineup = buildWeeklySelection(rows);
      description = 'Melhores de cada posição levando em conta os dados já disputados na classificatória.';
      notice = `<div class="season-selection-disclaimer"><strong>CLASSIFICATÓRIA EM ANDAMENTO</strong><span>Esta seleção é parcial e pode mudar a cada nova rodada conforme os números da competição são atualizados.</span></div>`;
      content = lineup.length ? lineup.map(row => selectionCard(row, phaseKey)).join('') : selectionEmptyHtml(phaseKey);
    } else if (phaseKey === 'segundaFase') {
      description = 'A seleção da Segunda Fase será liberada quando essa etapa começar.';
      content = selectionLockedHtml(phaseKey);
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
        <p>Os melhores jogadores por função: times da semana, classificatória, segunda fase, final e torneio.</p>
      </div>
      <div class="season-selection-tabs">${selectionTabsHtml()}</div>
      <section class="season-selection-panel season-selection-panel-${config.panelClass}">
        <div class="season-selection-section-head"><div><span class="season-selection-tag">${escapeHtml(config.label)}</span><h2>${escapeHtml(title)}</h2></div><p>${escapeHtml(description)}</p></div>
        ${notice}
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
    return { days: days.map(day => ({ value: String(day), label: `Dia ${day}` })), maps: maps.map(map => ({ value: map, label: map })) };
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
      return (!filters.days.length || filters.days.includes(String(event._day)))
        && (!filters.maps.length || filters.maps.some(value => normalize(value) === normalize(map)));
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

  function s2StatsStageLabel(stage) {
    return stage === 'classificatoria' ? 'Classificatória' : stage === 'segundaFase' ? 'Segunda Fase' : stage === 'final' ? 'Final' : String(stage || '');
  }

  function s2StatsStageShortLabel(stage) {
    return stage === 'classificatoria' ? 'Class.' : stage === 'segundaFase' ? '2ª Fase' : stage === 'final' ? 'Final' : String(stage || '');
  }

  function s2StatsMapShortLabel(map) {
    const raw = String(map || '').trim();
    const key = normalize(raw);
    if (key === 'NOVATERRA') return 'Nova T.';
    if (key === 'PURGATORIO') return 'Purg.';
    if (key === 'KALAHARI') return 'Kalah.';
    return raw;
  }

  function s2StatsRecordContext(row, daily = false) {
    const parts = [s2StatsStageShortLabel(row.stage)];
    if (row.day) parts.push(`D${row.day}`);
    if (!daily && row.drop) parts.push(`Q${row.drop}`);
    if (!daily && row.map) parts.push(s2StatsMapShortLabel(row.map));
    if (daily && row.matches) parts.push(`${row.matches}Q`);
    return parts.filter(Boolean).join(' • ');
  }

  function s2StatsRecordPlayerCard(key, rows, valueGetter, formatter, valueLabel, daily = false) {
    const ordered = [...rows].sort((a, b) => number(valueGetter(b)) - number(valueGetter(a)) || number(b.kills) - number(a.kills) || number(b.damage) - number(a.damage));
    const header = `<div style="display:grid;grid-template-columns:1.58fr .72fr .62fr;padding:0 10px 8px;font-size:.7em;color:#666;font-weight:bold;text-transform:uppercase;letter-spacing:1px"><div>Jogador</div><div>Equipe</div><div style="text-align:right">${escapeHtml(valueLabel)}</div></div>`;
    return s2StatsPaginatedList(key, ordered, (row, rankIndex) => `<div style="display:grid;grid-template-columns:1.58fr .72fr .62fr;align-items:center;margin-bottom:6px;padding:8px 10px;background:rgba(255,255,255,.02);border-radius:4px;border-left:3px solid ${s2StatsRankColor(rankIndex)};font-size:.85em">
      <div style="min-width:0"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="font-weight:bold;color:#555;margin-right:4px">${rankIndex + 1}º</span><span class="clickable" onclick="openCurrentSeasonPlayer('${jsAttr(row.name)}','${jsAttr(row.team)}')" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span></div><small style="display:block;color:#56606d;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s2StatsRecordContext(row, daily))}</small></div>
      <div class="clickable" onclick="openCurrentSeasonTeam('${jsAttr(row.team)}')" style="display:flex;align-items:center;gap:6px;color:#9aa0a6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><img src="${escapeHtml(logo(row.team))}" style="width:14px;height:14px;object-fit:contain" onerror="this.onerror=null;this.src='escudo.webp'"><span style="font-size:.9em">${escapeHtml(abbreviation(row.team))}</span></div>
      <div style="font-weight:bold;color:var(--accent);text-align:right">${escapeHtml(formatter(valueGetter(row)))}</div>
    </div>`, header, 4);
  }

  function s2StatsRecordTeamCard(key, rows, valueGetter, formatter, valueLabel, daily = false) {
    const ordered = [...rows].sort((a, b) => number(valueGetter(b)) - number(valueGetter(a)) || number(b.kills) - number(a.kills) || number(b.points) - number(a.points));
    const header = `<div style="display:grid;grid-template-columns:1.35fr .62fr;padding:0 10px 8px;font-size:.7em;color:#666;font-weight:bold;text-transform:uppercase;letter-spacing:1px"><div>Equipe</div><div style="text-align:right">${escapeHtml(valueLabel)}</div></div>`;
    return s2StatsPaginatedList(key, ordered, (row, rankIndex) => `<div style="display:grid;grid-template-columns:1.35fr .62fr;align-items:center;margin-bottom:6px;padding:8px 10px;background:rgba(255,255,255,.02);border-radius:4px;border-left:3px solid ${s2StatsRankColor(rankIndex)};font-size:.85em">
      <div class="clickable" onclick="openCurrentSeasonTeam('${jsAttr(row.team)}')" style="min-width:0"><div style="display:flex;align-items:center;gap:6px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="font-weight:bold;color:#555;margin-right:4px">${rankIndex + 1}º</span><img src="${escapeHtml(logo(row.team))}" style="width:16px;height:16px;object-fit:contain" onerror="this.onerror=null;this.src='escudo.webp'"><span style="font-size:.95em;font-weight:bold">${escapeHtml(abbreviation(row.team))}</span></div><small style="display:block;color:#56606d;margin-top:3px;margin-left:26px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s2StatsRecordContext(row, daily))}</small></div>
      <div style="font-weight:bold;color:var(--accent);text-align:right">${escapeHtml(formatter(valueGetter(row)))}</div>
    </div>`, header, 4);
  }

  function statsRecordRows(events, playerEntries) {
    const playerDrop = playerEntries.map(entry => ({
      name: entry.name, team: entry.team, stage: entry.stage || 'classificatoria', day: number(entry.day), drop: number(entry.drop), map: entry.map || '',
      kills: number(entry.kills), damage: number(entry.damage), assists: number(entry.assists), matches: 1
    }));

    const playerDayMap = new Map();
    playerDrop.forEach(row => {
      const key = `${row.stage}:${row.day}:${normalize(row.name)}:${normalize(row.team)}`;
      if (!playerDayMap.has(key)) playerDayMap.set(key, { name: row.name, team: row.team, stage: row.stage, day: row.day, kills: 0, damage: 0, assists: 0, matches: 0 });
      const out = playerDayMap.get(key);
      out.kills += row.kills; out.damage += row.damage; out.assists += row.assists; out.matches += 1;
    });

    const damageByTeamDrop = new Map();
    playerDrop.forEach(row => {
      const key = `${row.stage}:${row.day}:${row.drop}:${normalize(row.team)}`;
      damageByTeamDrop.set(key, number(damageByTeamDrop.get(key)) + row.damage);
    });

    const teamDrop = [];
    events.forEach(event => {
      const stage = event._stage || 'classificatoria';
      const day = number(event._day);
      const drop = number(event.drop || event.queda || event.number);
      const map = String(event.map || event.mapa || '');
      eventResults(event).forEach(result => {
        const team = result.team || result.equipe;
        if (!team) return;
        teamDrop.push({
          team, stage, day, drop, map, matches: 1,
          points: number(result.points ?? result.pontos ?? (number(result.placementPoints) + number(result.kills))),
          kills: number(result.kills ?? result.abates),
          damage: number(damageByTeamDrop.get(`${stage}:${day}:${drop}:${normalize(team)}`))
        });
      });
    });

    const teamDayMap = new Map();
    teamDrop.forEach(row => {
      const key = `${row.stage}:${row.day}:${normalize(row.team)}`;
      if (!teamDayMap.has(key)) teamDayMap.set(key, { team: row.team, stage: row.stage, day: row.day, points: 0, kills: 0, damage: 0, matches: 0 });
      const out = teamDayMap.get(key);
      out.points += row.points; out.kills += row.kills; out.damage += row.damage; out.matches += 1;
    });

    return { playerDrop, playerDay: [...playerDayMap.values()], teamDrop, teamDay: [...teamDayMap.values()] };
  }

  function s2DropReportCache() {
    if (!window.__ffwsS2DropReportCache) window.__ffwsS2DropReportCache = { drops: new Map(), days: new Map(), context: {} };
    const cache = window.__ffwsS2DropReportCache;
    if (!cache.drops) cache.drops = new Map();
    if (!cache.days) cache.days = new Map();
    if (!cache.context || typeof cache.context !== 'object') cache.context = {};
    return cache;
  }

  function s2DropReportEventKey(event) {
    return `${event?._stage || 'classificatoria'}:${number(event?._day || event?.day || event?.round)}:${number(event?.drop || event?.queda || event?.number)}`;
  }

  function s2DropReportDayKey(stage, day) {
    return `day:${String(stage || 'classificatoria')}:${number(day)}`;
  }

  function s2DropReportAllEvents() {
    return ['classificatoria', 'segundaFase', 'final'].flatMap(stage => stageEvents(stage).map((event, index) => ({
      ...event,
      _stage: stage,
      _day: stage === 'final' ? (number(event.day) || index + 1) : (number(event.round) || number(event.day) || index + 1)
    })));
  }

  function s2DropReportFindEvent(key) {
    return s2DropReportAllEvents().find(event => s2DropReportEventKey(event) === String(key || '')) || null;
  }

  function s2DropReportFindDay(stage, day, sourceEvents = null) {
    const events = Array.isArray(sourceEvents) ? sourceEvents : s2DropReportAllEvents();
    return events.filter(event => String(event._stage || 'classificatoria') === String(stage || 'classificatoria') && number(event._day) === number(day));
  }

  function s2DropReportBuild(event) {
    if (!event) return null;
    const cache = s2DropReportCache();
    const key = s2DropReportEventKey(event);
    if (cache.drops.has(key)) return cache.drops.get(key);
    const stage = event._stage || 'classificatoria';
    const day = number(event._day || event.day || event.round);
    const drop = number(event.drop || event.queda || event.number);
    const map = String(event.map || event.mapa || '');
    const rawPlayers = allPlayerEntries().filter(entry => String(entry.stage || 'classificatoria') === stage
      && number(entry.day) === day
      && number(entry.drop) === drop)
      .map(entry => ({
        name: entry.name || entry.player || '—', team: entry.team || entry.equipe || '',
        kills: number(entry.kills ?? entry.abates), damage: number(entry.damage ?? entry.dano),
        assists: number(entry.assists ?? entry.assistencias), mvp: number(entry.mvp ?? entry.mvps), matches: 1
      }));
    const playerTeamTotals = new Map();
    rawPlayers.forEach(player => {
      const teamKey = normalize(player.team);
      if (!playerTeamTotals.has(teamKey)) playerTeamTotals.set(teamKey, { damage: 0, assists: 0, playerKills: 0 });
      const out = playerTeamTotals.get(teamKey);
      out.damage += player.damage; out.assists += player.assists; out.playerKills += player.kills;
    });
    const teams = eventResults(event).map(result => {
      const team = result.team || result.equipe || '';
      const extras = playerTeamTotals.get(normalize(team)) || { damage: 0, assists: 0, playerKills: 0 };
      const position = number(result.position || result.posicao);
      const placementPoints = number(result.placementPoints ?? result.pontosColocacao ?? result.pp);
      const kills = number(result.kills ?? result.abates);
      const points = number(result.points ?? result.pontos ?? (placementPoints + kills));
      return { team, position, placementPoints, kills, points, booyah: number(result.booyah ?? result.booyahs) || (position === 1 ? 1 : 0), damage: extras.damage, assists: extras.assists, matches: 1 };
    });
    const positionByTeam = new Map(teams.map(row => [normalize(row.team), row.position]));
    const players = rawPlayers.map(player => ({
      ...player,
      note: calculateS2CffNote(player.kills, player.damage, player.assists, player.mvp, positionByTeam.get(normalize(player.team)) || 0)
    }));
    const booyah = teams.find(row => row.booyah || row.position === 1) || null;
    const topBy = (rows, getter, asc = false) => [...rows].sort((a, b) => asc ? number(getter(a)) - number(getter(b)) : number(getter(b)) - number(getter(a)))[0] || null;
    const report = {
      mode: 'drop', key, event, stage, day, drop, map, maps: map ? [map] : [], dropsCount: 1, teams, players, booyah, booyahs: booyah ? [{ team: booyah.team, drop, map }] : [],
      totals: {
        kills: teams.reduce((sum, row) => sum + row.kills, 0),
        points: teams.reduce((sum, row) => sum + row.points, 0),
        placementPoints: teams.reduce((sum, row) => sum + row.placementPoints, 0),
        damage: players.reduce((sum, row) => sum + row.damage, 0),
        assists: players.reduce((sum, row) => sum + row.assists, 0)
      },
      leaders: {
        playerKills: topBy(players, row => row.kills), playerDamage: topBy(players, row => row.damage), playerAssists: topBy(players, row => row.assists),
        teamPoints: topBy(teams, row => row.points), teamKills: topBy(teams, row => row.kills), teamDamage: topBy(teams, row => row.damage)
      }
    };
    cache.drops.set(key, report);
    return report;
  }

  function s2DropReportDayBuild(stage, day, sourceEvents = null) {
    const cache = s2DropReportCache();
    const key = s2DropReportDayKey(stage, day);
    if (!sourceEvents && cache.days.has(key)) return cache.days.get(key);
    const dayEvents = s2DropReportFindDay(stage, day, sourceEvents);
    if (!dayEvents.length) return null;
    const reports = dayEvents.sort((a, b) => number(a.drop || a.number) - number(b.drop || b.number)).map(s2DropReportBuild).filter(Boolean);
    const teamMap = new Map();
    const playerMap = new Map();
    reports.forEach(report => {
      report.teams.forEach(row => {
        const teamKey = normalize(row.team);
        if (!teamMap.has(teamKey)) teamMap.set(teamKey, { team: row.team, points: 0, placementPoints: 0, kills: 0, damage: 0, assists: 0, booyah: 0, matches: 0, position: 0 });
        const out = teamMap.get(teamKey);
        out.points += row.points; out.placementPoints += row.placementPoints; out.kills += row.kills; out.damage += row.damage; out.assists += row.assists; out.booyah += row.booyah; out.matches += 1;
      });
      report.players.forEach(row => {
        const playerKey = `${normalize(row.name)}__${normalize(row.team)}`;
        if (!playerMap.has(playerKey)) playerMap.set(playerKey, { name: row.name, team: row.team, kills: 0, damage: 0, assists: 0, mvp: 0, matches: 0, noteSum: 0 });
        const out = playerMap.get(playerKey);
        out.kills += row.kills; out.damage += row.damage; out.assists += row.assists; out.mvp += row.mvp; out.matches += 1; out.noteSum += number(row.note);
      });
    });
    const rankedTeams = [...teamMap.values()].sort((a, b) => b.points - a.points || b.booyah - a.booyah || b.kills - a.kills || b.damage - a.damage || a.team.localeCompare(b.team, 'pt-BR'));
    rankedTeams.forEach((row, index) => { row.position = index + 1; });
    const minDailyMatches = Math.max(1, Math.ceil(reports.length / 2));
    const players = [...playerMap.values()].map(row => {
      const dropAverageNote = row.matches ? row.noteSum / row.matches : 0;
      return {
        ...row,
        dropAverageNote,
        note: row.matches >= minDailyMatches ? calculateS2DailyCffNote(row.kills, row.damage, row.mvp, row.matches, stage) : dropAverageNote
      };
    });
    const topBy = (rows, getter) => [...rows].sort((a, b) => number(getter(b)) - number(getter(a)))[0] || null;
    const maps = [];
    reports.forEach(report => { if (report.map && !maps.some(map => normalize(map) === normalize(report.map))) maps.push(report.map); });
    const booyahs = reports.map(report => report.booyah ? { team: report.booyah.team, drop: report.drop, map: report.map } : null).filter(Boolean);
    const fullDayCount = s2DropReportFindDay(stage, day).length;
    const report = {
      mode: 'day', key, stage: String(stage || 'classificatoria'), day: number(day), drop: 0, map: '', maps, dropsCount: reports.length, reports, teams: rankedTeams, players, booyah: null, booyahs, isPartialDay: Boolean(sourceEvents && reports.length < fullDayCount),
      totals: {
        kills: reports.reduce((sum, row) => sum + row.totals.kills, 0),
        points: reports.reduce((sum, row) => sum + row.totals.points, 0),
        placementPoints: reports.reduce((sum, row) => sum + row.totals.placementPoints, 0),
        damage: reports.reduce((sum, row) => sum + row.totals.damage, 0),
        assists: reports.reduce((sum, row) => sum + row.totals.assists, 0)
      },
      leaders: {
        playerKills: topBy(players, row => row.kills), playerDamage: topBy(players, row => row.damage), playerAssists: topBy(players, row => row.assists),
        teamPoints: topBy(rankedTeams, row => row.points), teamKills: topBy(rankedTeams, row => row.kills), teamDamage: topBy(rankedTeams, row => row.damage)
      }
    };
    if (!sourceEvents) cache.days.set(key, report);
    return report;
  }

  function s2DropReportResolveCurrent() {
    if (state.dropReport?.mode === 'day') {
      const match = String(state.dropReport.key || '').match(/^day:([^:]+):(\d+)$/);
      return match ? s2DropReportDayBuild(match[1], number(match[2]), filteredStatsEvents()) : null;
    }
    return s2DropReportBuild(s2DropReportFindEvent(state.dropReport?.key));
  }

  function s2DropReportSplitContext(mode = 'drop') {
    const cache = s2DropReportCache();
    if (cache.context[mode]) return cache.context[mode];
    let reports;
    if (mode === 'day') {
      const groups = new Map();
      s2DropReportAllEvents().forEach(event => {
        const key = `${event._stage}:${event._day}`;
        if (!groups.has(key)) groups.set(key, { stage: event._stage, day: event._day });
      });
      reports = [...groups.values()].map(group => s2DropReportDayBuild(group.stage, group.day)).filter(Boolean);
    } else reports = s2DropReportAllEvents().map(s2DropReportBuild).filter(Boolean);
    const values = getter => reports.map(report => number(getter(report))).filter(value => Number.isFinite(value));
    const playerValues = metric => reports.flatMap(report => report.players.map(row => number(row[metric])));
    const teamValues = metric => reports.flatMap(report => report.teams.map(row => number(row[metric])));
    cache.context[mode] = {
      totalKills: values(report => report.totals.kills), totalPoints: values(report => report.totals.points), totalDamage: values(report => report.totals.damage),
      playerKills: playerValues('kills'), playerDamage: playerValues('damage'), playerAssists: playerValues('assists'),
      teamPoints: teamValues('points'), teamKills: teamValues('kills'), teamDamage: teamValues('damage')
    };
    return cache.context[mode];
  }

  function s2DropReportRank(value, values) {
    const unique = [...new Set((values || []).map(number))].sort((a, b) => b - a);
    const index = unique.indexOf(number(value));
    return index < 0 ? 0 : index + 1;
  }

  function s2DropReportBadge(rank) {
    if (rank === 1) return '<span class="ffws-s2-drop-record-badge is-record">🔥 RECORDE DO SPLIT</span>';
    if (rank === 2) return '<span class="ffws-s2-drop-record-badge">🥈 TOP 2 DO SPLIT</span>';
    if (rank === 3) return '<span class="ffws-s2-drop-record-badge">🥉 TOP 3 DO SPLIT</span>';
    return '';
  }

  function s2DropReportMetricCard(label, value, sub = '', rank = 0) {
    return `<article class="ffws-s2-drop-summary-card"><small>${escapeHtml(label)}</small><strong>${escapeHtml(String(value))}</strong>${sub ? `<span>${escapeHtml(sub)}</span>` : ''}${s2DropReportBadge(rank)}</article>`;
  }

  function s2DropReportHighlightCard(label, row, metric, formatter, rank = 0, isTeam = false) {
    if (!row) return '';
    const name = isTeam ? row.team : row.name;
    const team = row.team || '';
    const action = isTeam ? `showFFWSS2DropReportTeam('${jsAttr(team)}')` : `openCurrentSeasonPlayer('${jsAttr(name)}','${jsAttr(team)}')`;
    return `<article class="ffws-s2-drop-highlight-card"><small>${escapeHtml(label)}</small><button type="button" onclick="${action}"><span>${isTeam ? `<img src="${escapeHtml(logo(team))}" onerror="this.onerror=null;this.src='escudo.webp'">` : ''}<strong>${escapeHtml(name)}</strong>${!isTeam && team ? `<em>${escapeHtml(abbreviation(team))}</em>` : ''}</span><b>${escapeHtml(formatter(row[metric]))}</b></button>${s2DropReportBadge(rank)}</article>`;
  }

  function s2DropReportBooyahHtml(report) {
    if (report.mode === 'drop') {
      const booyah = report.booyah;
      if (!booyah) return '';
      return `<button type="button" class="ffws-s2-drop-booyah" onclick="showFFWSS2DropReportTeam('${jsAttr(booyah.team)}')"><small>BOOYAH</small><span><img src="${escapeHtml(logo(booyah.team))}" onerror="this.onerror=null;this.src='escudo.webp'"><strong>${escapeHtml(booyah.team)}</strong></span></button>`;
    }
    const counts = new Map();
    report.booyahs.forEach(item => { const key = normalize(item.team); if (!counts.has(key)) counts.set(key, { team: item.team, count: 0 }); counts.get(key).count += 1; });
    const rows = [...counts.values()].sort((a, b) => b.count - a.count || a.team.localeCompare(b.team, 'pt-BR'));
    return `<div class="ffws-s2-day-booyahs"><small>BOOYAHS DO DIA</small><div>${rows.map(row => `<button type="button" onclick="showFFWSS2DropReportTeam('${jsAttr(row.team)}')"><img src="${escapeHtml(logo(row.team))}" onerror="this.onerror=null;this.src='escudo.webp'"><span>${escapeHtml(abbreviation(row.team))}</span><b>${row.count}</b></button>`).join('')}</div></div>`;
  }

  function s2DropReportSummaryHtml(report) {
    const isDay = report.mode === 'day';
    const context = s2DropReportSplitContext(isDay ? 'day' : 'drop');
    const leaders = report.leaders;
    const rankOf = (value, values) => report.isPartialDay ? 0 : s2DropReportRank(value, values);
    const period = isDay ? (report.isPartialDay ? 'no recorte do dia' : 'no dia') : 'na queda';
    const heroTitle = isDay ? `${report.dropsCount} quedas disputadas` : (report.map || 'Mapa não informado');
    const heroMeta = isDay ? `${s2StatsStageLabel(report.stage)} • Dia ${report.day}` : `${s2StatsStageLabel(report.stage)} • Dia ${report.day} • Queda ${report.drop}`;
    const mapLine = isDay && report.maps.length ? `<div class="ffws-s2-day-map-list">${report.maps.map(map => `<span>${escapeHtml(map)}</span>`).join('')}</div>` : '';
    return `<div class="ffws-s2-drop-report-overview">
      <div class="ffws-s2-drop-report-hero"><div><span>${escapeHtml(heroMeta)}</span><h3>${escapeHtml(heroTitle)}</h3>${mapLine}</div>${s2DropReportBooyahHtml(report)}</div>
      <div class="ffws-s2-drop-summary-grid">
        ${s2DropReportMetricCard('Total de abates', report.totals.kills, period, rankOf(report.totals.kills, context.totalKills))}
        ${s2DropReportMetricCard('Total de pontos', report.totals.points, 'somando as equipes', rankOf(report.totals.points, context.totalPoints))}
        ${s2DropReportMetricCard('Dano total', report.totals.damage.toLocaleString('pt-BR'), 'dos jogadores', rankOf(report.totals.damage, context.totalDamage))}
        ${s2DropReportMetricCard('Assistências', report.totals.assists, period)}
        ${s2DropReportMetricCard('Equipes', report.teams.length, 'participantes')}
        ${s2DropReportMetricCard('Pontos de colocação', report.totals.placementPoints, 'distribuídos')}
      </div>
      <div class="ffws-s2-drop-report-subhead"><h4>Destaques ${isDay ? 'do dia' : 'da queda'}</h4><p>Comparação automática com ${isDay ? 'os outros dias' : 'todas as quedas'} já cadastrados no split.</p></div>
      <div class="ffws-s2-drop-highlight-grid">
        ${s2DropReportHighlightCard('Mais abates', leaders.playerKills, 'kills', value => `${value} K`, rankOf(leaders.playerKills?.kills, context.playerKills))}
        ${s2DropReportHighlightCard('Mais dano', leaders.playerDamage, 'damage', value => number(value).toLocaleString('pt-BR'), rankOf(leaders.playerDamage?.damage, context.playerDamage))}
        ${s2DropReportHighlightCard('Mais assistências', leaders.playerAssists, 'assists', value => `${value} AST`, rankOf(leaders.playerAssists?.assists, context.playerAssists))}
        ${s2DropReportHighlightCard('Time com mais pontos', leaders.teamPoints, 'points', value => `${value} PTS`, rankOf(leaders.teamPoints?.points, context.teamPoints), true)}
        ${s2DropReportHighlightCard('Time com mais abates', leaders.teamKills, 'kills', value => `${value} K`, rankOf(leaders.teamKills?.kills, context.teamKills), true)}
        ${s2DropReportHighlightCard('Time com mais dano', leaders.teamDamage, 'damage', value => number(value).toLocaleString('pt-BR'), rankOf(leaders.teamDamage?.damage, context.teamDamage), true)}
      </div>
    </div>`;
  }

  function s2DropReportTeamSort(rows, sortKey) {
    const getters = { points: row => row.points, kills: row => row.kills, placementPoints: row => row.placementPoints, damage: row => row.damage, assists: row => row.assists, position: row => row.position };
    const getter = getters[sortKey] || getters.points;
    return [...rows].sort((a, b) => sortKey === 'position'
      ? getter(a) - getter(b)
      : getter(b) - getter(a) || a.position - b.position || b.kills - a.kills);
  }

  function s2DropReportTeamDetailHtml(report, teamName) {
    const team = report.teams.find(row => normalize(row.team) === normalize(teamName));
    if (!team) return '';
    const players = report.players.filter(row => normalize(row.team) === normalize(team.team)).sort((a, b) => b.kills - a.kills || b.damage - a.damage || b.assists - a.assists);
    const posLabel = report.mode === 'day' ? 'Posição no dia' : 'Posição na queda';
    return `<section class="ffws-s2-drop-team-detail">
      <div class="ffws-s2-drop-team-detail-head"><div><img src="${escapeHtml(logo(team.team))}" onerror="this.onerror=null;this.src='escudo.webp'"><span><small>${escapeHtml(report.mode === 'day' ? `DIA ${report.day}` : `DIA ${report.day} • Q${report.drop}`)}</small><strong>${escapeHtml(team.team)}</strong></span></div><button type="button" onclick="hideFFWSS2DropReportTeam()">Fechar</button></div>
      <div class="ffws-s2-team-detail-metrics">
        ${s2DropReportMetricCard(posLabel, `${team.position || '—'}º`)}
        ${s2DropReportMetricCard('Pontos', team.points)}
        ${s2DropReportMetricCard('Pontos colocação', team.placementPoints)}
        ${s2DropReportMetricCard('Abates', team.kills)}
        ${s2DropReportMetricCard('Dano', team.damage.toLocaleString('pt-BR'))}
        ${s2DropReportMetricCard('Assistências', team.assists)}
        ${s2DropReportMetricCard('Booyahs', team.booyah || 0)}
      </div>
      <div class="ffws-s2-drop-report-subhead"><h4>Jogadores da equipe</h4><p>${players.length} jogadores com dados neste recorte.</p></div>
      <div class="ffws-s2-team-detail-player-head"><span>JOGADOR</span><span>K</span><span>DANO</span><span>AST</span><span>CFF</span></div>
      <div class="ffws-s2-team-detail-players">${players.map(row => `<button type="button" onclick="openCurrentSeasonPlayer('${jsAttr(row.name)}','${jsAttr(row.team)}')"><strong>${escapeHtml(row.name)}</strong><b>${row.kills}</b><span>${row.damage.toLocaleString('pt-BR')}</span><span>${row.assists}</span><em class="ffws-s2-note-badge ${noteBadgeClass(row.note)}">${number(row.note).toFixed(1)}</em></button>`).join('')}</div>
    </section>`;
  }

  function s2DropReportTeamsHtml(report) {
    const sortKey = String(state.dropReport?.teamSort || 'points');
    const rows = s2DropReportTeamSort(report.teams, sortKey);
    const isDay = report.mode === 'day';
    const options = [['points','Pontos'],['kills','Abates'],['placementPoints','Pontos por colocação'],['damage','Dano'],['assists','Assistências'],['position',isDay ? 'Posição no dia' : 'Posição na queda']];
    const detail = state.dropReport.teamDetail ? s2DropReportTeamDetailHtml(report, state.dropReport.teamDetail) : '';
    return `<div class="ffws-s2-drop-report-list-page">${detail}<div class="ffws-s2-drop-report-toolbar"><div><strong>Relatório das equipes</strong><span>${isDay ? 'A posição à esquerda é o ranking acumulado do dia por pontos.' : 'O número à esquerda é a posição real da equipe na queda.'}</span></div><label>Ordenar por <select onchange="setFFWSS2DropReportTeamSort(this.value)">${options.map(([value,label]) => `<option value="${value}"${sortKey===value?' selected':''}>${label}</option>`).join('')}</select></label></div>
      <div class="ffws-s2-drop-place-legend">${isDay ? '<span class="p1">1º do dia</span><span class="p2">2º</span><span class="p3">3º</span><span>Ranking acumulado neste dia</span>' : '<span class="p1">1º Booyah</span><span class="p2">2º</span><span class="p3">3º</span><span>4º–12º colocação na queda</span>'}</div>
      <div class="ffws-s2-drop-team-head"><span>POS</span><span>EQUIPE</span><span>PTS</span><span>PC</span><span>K</span><span>DANO</span><span>AST</span></div>
      <div class="ffws-s2-drop-team-list">${rows.map(row => `<div class="ffws-s2-drop-team-row place-${Math.min(row.position || 12,12)}">
        <span class="ffws-s2-drop-place">${row.position || '—'}º</span>
        <button type="button" class="ffws-s2-drop-team-name" onclick="showFFWSS2DropReportTeam('${jsAttr(row.team)}')"><img src="${escapeHtml(logo(row.team))}" onerror="this.onerror=null;this.src='escudo.webp'"><span><strong>${escapeHtml(abbreviation(row.team))}</strong><small>${escapeHtml(row.team)}</small></span></button>
        <strong class="ffws-s2-drop-primary">${row.points}</strong><span class="ffws-s2-drop-desktop-stat">${row.placementPoints}</span><strong>${row.kills}</strong><span class="ffws-s2-drop-desktop-stat">${row.damage.toLocaleString('pt-BR')}</span><span class="ffws-s2-drop-desktop-stat">${row.assists}</span>
        <div class="ffws-s2-drop-mobile-extra"><span>PC <b>${row.placementPoints}</b></span><span>Dano <b>${row.damage.toLocaleString('pt-BR')}</b></span><span>Ast <b>${row.assists}</b></span>${row.booyah ? `<span>B! <b>${row.booyah}</b></span>` : ''}</div>
      </div>`).join('')}</div></div>`;
  }

  function s2DropReportPlayerSort(rows, sortKey) {
    const getter = sortKey === 'damage' ? row => row.damage : sortKey === 'assists' ? row => row.assists : sortKey === 'note' ? row => row.note : row => row.kills;
    return [...rows].sort((a, b) => getter(b) - getter(a) || b.kills - a.kills || b.damage - a.damage || a.name.localeCompare(b.name, 'pt-BR'));
  }

  function s2DropReportPlayerTeamFiltersHtml(report) {
    const teams = [...new Map(report.players.filter(row => row.team).map(row => [normalize(row.team), row.team])).values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const selected = new Set(state.dropReport.playerTeams || []);
    return `<div class="ffws-s2-player-team-filters"><div class="ffws-s2-player-team-filter-head"><span>Filtrar por equipe</span><button type="button" onclick="clearFFWSS2DropReportPlayerTeams()" ${selected.size ? '' : 'disabled'}>LIMPAR TUDO</button></div><div class="ffws-s2-player-team-filter-logos">${teams.map(team => `<button type="button" class="${selected.has(normalize(team)) ? 'active' : ''}" title="${escapeHtml(team)}" aria-pressed="${selected.has(normalize(team)) ? 'true' : 'false'}" onclick="toggleFFWSS2DropReportPlayerTeam('${jsAttr(team)}')"><img src="${escapeHtml(logo(team))}" alt="${escapeHtml(abbreviation(team))}" onerror="this.onerror=null;this.src='escudo.webp'"></button>`).join('')}</div></div>`;
  }

  function s2DropReportCompactMetric(value) {
    const n = Math.max(0, number(value));
    if (n < 1000) return String(Math.round(n));
    const compact = Math.floor(n / 100) / 10;
    return `${compact.toFixed(1).replace('.', ',')}k`;
  }

  function s2DropReportPlayersHtml(report) {
    const sortKey = String(state.dropReport?.playerSort || 'kills');
    const selectedTeams = new Set(state.dropReport.playerTeams || []);
    const allRows = s2DropReportPlayerSort(report.players, sortKey);
    const rows = selectedTeams.size ? allRows.filter(row => selectedTeams.has(normalize(row.team))) : allRows;
    const options = [['kills','Abates'],['damage','Dano'],['assists','Assistências'],['note','Nota CFF']];
    return `<div class="ffws-s2-drop-report-list-page"><div class="ffws-s2-drop-report-toolbar"><div><strong>Relatório dos jogadores</strong><span>${rows.length}${selectedTeams.size ? ` de ${allRows.length}` : ''} jogadores neste ${report.mode === 'day' ? 'dia' : 'recorte'}.</span></div><label>Ordenar por <select onchange="setFFWSS2DropReportPlayerSort(this.value)">${options.map(([value,label]) => `<option value="${value}"${sortKey===value?' selected':''}>${label}</option>`).join('')}</select></label></div>
      ${s2DropReportPlayerTeamFiltersHtml(report)}
      <div class="ffws-s2-drop-player-head"><span class="ffws-s2-drop-rank-head">#</span><span class="ffws-s2-drop-player-label"><span class="ffws-s2-desktop">JOGADOR</span><span class="ffws-s2-mobile">J</span></span><span><span class="ffws-s2-desktop">EQP</span><span class="ffws-s2-mobile">E</span></span><span><span class="ffws-s2-desktop">KILLS</span><span class="ffws-s2-mobile">K</span></span><span><span class="ffws-s2-desktop">ASSIT.</span><span class="ffws-s2-mobile">AST.</span></span><span><span class="ffws-s2-desktop">DANO</span><span class="ffws-s2-mobile">DMG</span></span><span>CFF</span></div>
      <div class="ffws-s2-drop-player-list">${rows.length ? rows.map((row,index) => `<div class="ffws-s2-drop-player-row">
        <span class="ffws-s2-drop-player-rank">${index + 1}º</span><button type="button" class="ffws-s2-drop-player-name" onclick="openCurrentSeasonPlayer('${jsAttr(row.name)}','${jsAttr(row.team)}')"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.team)}</small></button>
        <button type="button" class="ffws-s2-drop-player-team" title="${escapeHtml(row.team)}" onclick="toggleFFWSS2DropReportPlayerTeam('${jsAttr(row.team)}')"><img src="${escapeHtml(logo(row.team))}" alt="${escapeHtml(abbreviation(row.team))}" onerror="this.onerror=null;this.src='escudo.webp'"></button>
        <strong class="ffws-s2-drop-primary ffws-s2-drop-player-kills">${row.kills}</strong><span class="ffws-s2-drop-player-assists">${row.assists}</span><span class="ffws-s2-drop-player-damage"><span class="ffws-s2-desktop">${row.damage.toLocaleString('pt-BR')}</span><span class="ffws-s2-mobile">${s2DropReportCompactMetric(row.damage)}</span></span><span class="ffws-s2-drop-player-cff"><em class="ffws-s2-note-badge ${noteBadgeClass(row.note)}">${number(row.note).toFixed(1)}</em></span>
      </div>`).join('') : '<div class="ffws-s2-drop-filter-empty">Nenhum jogador das equipes selecionadas.</div>'}</div></div>`;
  }

  function s2DropReportTabsHtml(tab) {
    return `<div class="ffws-s2-drop-report-tabs" role="tablist"><button type="button" class="${tab==='summary'?'active':''}" onclick="setFFWSS2DropReportTab('summary')">Resumo</button><button type="button" class="${tab==='teams'?'active':''}" onclick="setFFWSS2DropReportTab('teams')">Equipes</button><button type="button" class="${tab==='players'?'active':''}" onclick="setFFWSS2DropReportTab('players')">Jogadores</button></div>`;
  }

  function s2DropReportNavigation(report) {
    const events = [...filteredStatsEvents()].sort((a, b) => String(a._stage || '').localeCompare(String(b._stage || '')) || number(a._day) - number(b._day) || number(a.drop || a.number) - number(b.drop || b.number));
    const days = [];
    const seenDays = new Set();
    events.forEach(event => {
      const key = s2DropReportDayKey(event._stage, event._day);
      if (!seenDays.has(key)) { seenDays.add(key); days.push({ key, stage: event._stage, day: number(event._day) }); }
    });
    const currentDayKey = s2DropReportDayKey(report.stage, report.day);
    const dayIndex = days.findIndex(item => item.key === currentDayKey);
    const nextDay = dayIndex >= 0 && dayIndex < days.length - 1 ? days[dayIndex + 1] : null;
    let nextDrop = null;
    if (report.mode === 'day') {
      nextDrop = events.find(event => s2DropReportDayKey(event._stage, event._day) === currentDayKey) || null;
    } else {
      const dropIndex = events.findIndex(event => s2DropReportEventKey(event) === report.key);
      nextDrop = dropIndex >= 0 && dropIndex < events.length - 1 ? events[dropIndex + 1] : null;
    }
    return { nextDrop, nextDay };
  }

  function ensureFFWSS2DropReportModal() {
    let modal = document.getElementById('ffws-s2-drop-report-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'ffws-s2-drop-report-modal';
      modal.className = 'ffws-s2-drop-report-modal';
      modal.hidden = true;
      modal.setAttribute('onclick', 'if(event.target===this)closeFFWSS2DropReport()');
      modal.innerHTML = '<div class="ffws-s2-drop-report-dialog" role="dialog" aria-modal="true" aria-label="Relatório do dia ou da queda"><div id="ffws-s2-drop-report-body"></div></div>';
      document.body.appendChild(modal);
    } else if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    return modal;
  }

  function renderFFWSS2DropReportModal() {
    const modal = document.getElementById('ffws-s2-drop-report-modal');
    const body = document.getElementById('ffws-s2-drop-report-body');
    if (!modal || !body || !state.dropReport?.key) return;
    const report = s2DropReportResolveCurrent();
    if (!report) return;
    const tab = state.dropReport.tab || 'summary';
    const nav = s2DropReportNavigation(report);
    const nextDropLabel = nav.nextDrop ? `D${number(nav.nextDrop._day)} • Q${number(nav.nextDrop.drop || nav.nextDrop.number)}` : 'Última queda';
    const nextDayLabel = nav.nextDay ? `D${number(nav.nextDay.day)}` : 'Último dia';
    const nextDropAction = nav.nextDrop ? `openFFWSS2DropReport('${s2DropReportEventKey(nav.nextDrop)}')` : '';
    const nextDayAction = nav.nextDay ? `openFFWSS2DayReport('${jsAttr(nav.nextDay.stage)}',${number(nav.nextDay.day)})` : '';
    const topTitle = report.mode === 'day' ? `DIA ${report.day} • ${report.dropsCount} QUEDAS` : `DIA ${report.day} • QUEDA ${report.drop}`;
    const topSub = report.mode === 'day' ? `${report.maps.length} mapa${report.maps.length === 1 ? '' : 's'} no recorte` : (report.map || '');
    body.innerHTML = `<div class="ffws-s2-drop-report-top"><div class="ffws-s2-drop-report-title"><small>${escapeHtml(s2StatsStageLabel(report.stage))}</small><strong>${escapeHtml(topTitle)}</strong><span>${escapeHtml(topSub)}</span></div><button type="button" class="ffws-s2-drop-report-close" onclick="closeFFWSS2DropReport()" aria-label="Fechar relatório">×</button></div><div class="ffws-s2-drop-report-nav-v11"><button type="button" class="ffws-s2-drop-report-navbtn" ${nav.nextDrop?'':'disabled'} onclick="${nextDropAction}" aria-label="Ir para ${escapeHtml(nextDropLabel)}"><span class="ffws-s2-drop-report-navcopy"><small>PRÓX. QUEDA</small><strong>${escapeHtml(nextDropLabel)}</strong></span><span class="ffws-s2-drop-report-navarrow" aria-hidden="true">→</span></button><button type="button" class="ffws-s2-drop-report-navbtn" ${nav.nextDay?'':'disabled'} onclick="${nextDayAction}" aria-label="Ir para ${escapeHtml(nextDayLabel)}"><span class="ffws-s2-drop-report-navcopy"><small>PRÓX. DIA</small><strong>${escapeHtml(nextDayLabel)}</strong></span><span class="ffws-s2-drop-report-navarrow" aria-hidden="true">→</span></button></div>${s2DropReportTabsHtml(tab)}<div class="ffws-s2-drop-report-tabbody">${tab === 'teams' ? s2DropReportTeamsHtml(report) : tab === 'players' ? s2DropReportPlayersHtml(report) : s2DropReportSummaryHtml(report)}</div>`;
  }

  function s2DropReportSelectorHtml(events) {
    const groups = new Map();
    events.forEach(event => {
      const key = `${event._stage}:${event._day}`;
      if (!groups.has(key)) groups.set(key, { stage: event._stage, day: event._day, events: [] });
      groups.get(key).events.push(event);
    });
    return `<section id="anchor-s2-relatorio" class="ffws-s2-panel ffws-s2-drop-report-section"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Relatório de Quedas</h2><p>Clique no dia para ver o relatório agregado ou abra uma queda individual.</p></div><span class="ffws-s2-badge">${events.length} quedas</span></div>
      <div class="ffws-s2-drop-day-list">${[...groups.values()].map(group => `<div class="ffws-s2-drop-day-row"><button type="button" class="ffws-s2-drop-day-label" onclick="openFFWSS2DayReport('${jsAttr(group.stage)}',${number(group.day)})"><span><small>${escapeHtml(s2StatsStageShortLabel(group.stage))}</small><strong>DIA ${group.day}</strong></span><em>VER DIA ›</em></button><div class="ffws-s2-drop-buttons">${group.events.sort((a,b)=>number(a.drop||a.number)-number(b.drop||b.number)).map(event => { const report=s2DropReportBuild(event); const recordContext=s2DropReportSplitContext(); const bestPlayer=report?.leaders?.playerKills; const fire=bestPlayer && s2DropReportRank(bestPlayer.kills, recordContext.playerKills) <= 3; return `<button type="button" onclick="openFFWSS2DropReport('${s2DropReportEventKey(event)}')"><span>Q${number(event.drop || event.number)}</span>${fire?'<i aria-label="Top 3 do split">🔥</i>':''}<small>${escapeHtml(s2StatsMapShortLabel(event.map || event.mapa))}</small></button>`; }).join('')}</div></div>`).join('')}</div>
    </div></section>`;
  }

  let s2StatsEvolutionChart = null;
  let s2StatsEvolutionObserver = null;

  function s2StatsStickyNavHtml() {
    const items = [
      ['anchor-s2-resumo','Resumo'], ['anchor-s2-filtros','Filtros'], ['anchor-s2-totais-equipe','Totais Equipe'],
      ['anchor-s2-medias-equipe','Médias Equipe'], ['anchor-s2-top3-equipe','Equipes/Queda'], ['anchor-s2-totais-jogador','Totais Jog.'],
      ['anchor-s2-medias-jogador','Médias Jog.'], ['anchor-s2-participacao','Participação'], ['anchor-s2-novatos','Novatos'],
      ['anchor-s2-rec-drop-player','Rec. Q Jog.'], ['anchor-s2-rec-day-player','Rec. Dia Jog.'], ['anchor-s2-rec-drop-team','Rec. Q Times'],
      ['anchor-s2-rec-day-team','Rec. Dia Times'], ['anchor-s2-relatorio','Relatório'], ['anchor-s2-evolucao','Evolução'],
      ['anchor-s2-ranking-medias','Médias'], ['anchor-s2-ranking-totais','Totais']
    ];
    const cut = Math.ceil(items.length / 2);
    const rows = [items.slice(0, cut), items.slice(cut)];
    return `<div class="cff-stats-sticky-nav" data-stats-sticky-nav="s2"><span>Ir para:</span><div class="cff-stats-sticky-rows">${rows.map(row => `<div class="cff-stats-sticky-row">${row.map(([id,label]) => `<button type="button" onclick="scrollFFWSS2StatsSection('${id}')">${escapeHtml(label)}</button>`).join('')}</div>`).join('')}</div></div>`;
  }

  function s2StatsEvolutionPeriods(events) {
    const order = { classificatoria: 0, segundaFase: 1, final: 2 };
    const map = new Map();
    events.forEach(event => {
      const key = `${event._stage}:${event._day}`;
      if (!map.has(key)) map.set(key, { stage: event._stage, day: event._day, events: [] });
      map.get(key).events.push(event);
    });
    return [...map.values()].sort((a,b) => (order[a.stage] ?? 9) - (order[b.stage] ?? 9) || number(a.day) - number(b.day));
  }

  function s2StatsEvolutionTeamList(events) {
    const ranking = aggregateStatsTeams(events).sort((a,b) => b.points - a.points || b.kills - a.kills);
    const available = ranking.map(row => row.team);
    const allowed = new Set(available.map(normalize));
    state.statsEvolution.teams = (state.statsEvolution.teams || []).filter(team => allowed.has(normalize(team)));
    if (!state.statsEvolution.teams.length) state.statsEvolution.teams = available.slice(0, Math.min(5, available.length));
    return available;
  }

  function s2StatsEvolutionHtml(events) {
    const teams = s2StatsEvolutionTeamList(events);
    const selected = new Set((state.statsEvolution.teams || []).map(normalize));
    return `<section id="anchor-s2-evolucao" class="ffws-s2-panel ffws-s2-stats-evolution"><div class="ffws-s2-panel-inner">
      <div class="ffws-s2-panel-head"><div><h2>Comparação de Evolução das Equipes</h2><p>Gráfico no mesmo estilo da S1, usando o recorte definido nos filtros acima.</p></div><span class="ffws-s2-badge">até 5 equipes</span></div>
      <div class="ffws-s2-evolution-controls"><label class="ffws-s2-filter"><span>Métrica do gráfico:</span><select onchange="setFFWSS2StatsEvolutionMetric(this.value)"><option value="position"${state.statsEvolution.metric==='position'?' selected':''}>Posição geral (acumulada)</option><option value="points"${state.statsEvolution.metric==='points'?' selected':''}>Pontos por dia</option><option value="kills"${state.statsEvolution.metric==='kills'?' selected':''}>Abates por dia</option></select></label><div class="ffws-s2-evolution-team-wrap"><span>Equipes (máx. 5):</span><div class="ffws-s2-evolution-team-buttons">${teams.map(team => `<button type="button" class="${selected.has(normalize(team)) ? 'active' : ''}" onclick="toggleFFWSS2StatsEvolutionTeam('${jsAttr(team)}')" title="${escapeHtml(team)}"><img src="${escapeHtml(logo(team))}" alt="" onerror="this.onerror=null;this.src='escudo.webp'"><b>${escapeHtml(abbreviation(team))}</b></button>`).join('')}</div></div></div>
      <div class="ffws-s2-evolution-canvas-wrap"><canvas id="ffws-s2-stats-evolution-chart"></canvas><div id="ffws-s2-stats-evolution-empty" class="ffws-s2-empty" hidden><div><strong>Sem dados suficientes</strong>Selecione ao menos uma equipe com resultados no recorte.</div></div></div>
    </div></section>`;
  }

  function s2StatsEvolutionSeries(events, teamName, metric) {
    const periods = s2StatsEvolutionPeriods(events);
    const target = normalize(teamName);
    const values = [];
    const cumulative = new Map();
    periods.forEach(period => {
      const daily = new Map();
      period.events.forEach(event => eventResults(event).forEach(result => {
        const team = result.team || result.equipe;
        if (!team) return;
        const key = normalize(team);
        if (!daily.has(key)) daily.set(key, { team, points:0, kills:0, booyahs:0 });
        const row = daily.get(key);
        const pos = number(result.position || result.posicao);
        row.points += number(result.points ?? result.pontos ?? (number(result.placementPoints) + number(result.kills)));
        row.kills += number(result.kills ?? result.abates);
        row.booyahs += number(result.booyahs ?? result.booyah ?? (pos === 1 ? 1 : 0));
      }));
      daily.forEach((row,key) => {
        if (!cumulative.has(key)) cumulative.set(key,{ team:row.team, points:0, kills:0, booyahs:0 });
        const total = cumulative.get(key); total.points += row.points; total.kills += row.kills; total.booyahs += row.booyahs;
      });
      if (metric === 'position') {
        const ordered = [...cumulative.values()].sort((a,b)=>b.points-a.points || b.booyahs-a.booyahs || b.kills-a.kills || a.team.localeCompare(b.team,'pt-BR'));
        const pos = ordered.findIndex(row => normalize(row.team) === target);
        values.push(pos >= 0 ? pos + 1 : null);
      } else {
        const row = daily.get(target);
        values.push(row ? (metric === 'kills' ? row.kills : row.points) : 0);
      }
    });
    return values;
  }

  function renderS2StatsEvolutionChart() {
    const canvas = document.getElementById('ffws-s2-stats-evolution-chart');
    if (!canvas) return;
    const events = filteredStatsEvents();
    const periods = s2StatsEvolutionPeriods(events);
    const selected = (state.statsEvolution.teams || []).slice(0,5);
    const empty = document.getElementById('ffws-s2-stats-evolution-empty');
    if (!periods.length || !selected.length) { canvas.hidden = true; if (empty) empty.hidden = false; return; }
    canvas.hidden = false; if (empty) empty.hidden = true;
    const draw = () => {
      if (!window.Chart || !document.getElementById('ffws-s2-stats-evolution-chart')) return;
      if (s2StatsEvolutionChart) { try { s2StatsEvolutionChart.destroy(); } catch (_) {} s2StatsEvolutionChart = null; }
      const labels = periods.map(period => `${s2StatsStageShortLabel(period.stage)} D${period.day}`);
      const palette = ['#00c8ff','#ffd34d','#7fe29a','#ff7a90','#b68cff'];
      const metric = state.statsEvolution.metric || 'position';
      s2StatsEvolutionChart = new window.Chart(canvas.getContext('2d'), {
        type:'line',
        data:{ labels, datasets:selected.map((team,index)=>({ label:abbreviation(team), data:s2StatsEvolutionSeries(events,team,metric), borderColor:palette[index%palette.length], backgroundColor:palette[index%palette.length], tension:.2, borderWidth:2.25, pointRadius:3, pointHoverRadius:5, spanGaps:true })) },
        options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'nearest',intersect:false}, plugins:{legend:{labels:{color:'#dcecff',boxWidth:14,boxHeight:3}}}, scales:{x:{ticks:{color:'#7893b5',maxRotation:0,autoSkip:true},grid:{color:'rgba(120,147,181,.10)'}},y:{reverse:metric==='position',beginAtZero:metric!=='position',ticks:{color:'#7893b5',precision:0,stepSize:metric==='position'?1:undefined,callback:value=>metric==='position'?`${value}º`:value},grid:{color:'rgba(120,147,181,.10)'}}} }
      });
    };
    const loadAndDraw = () => (typeof window.cffLoadChartJS === 'function' ? window.cffLoadChartJS() : Promise.resolve(window.Chart)).then(draw).catch(()=>{});
    if ('IntersectionObserver' in window) {
      if (s2StatsEvolutionObserver) s2StatsEvolutionObserver.disconnect();
      s2StatsEvolutionObserver = new IntersectionObserver(entries => { if (entries.some(entry=>entry.isIntersecting)) { s2StatsEvolutionObserver.disconnect(); s2StatsEvolutionObserver=null; loadAndDraw(); } }, { rootMargin:'180px' });
      s2StatsEvolutionObserver.observe(canvas);
    } else loadAndDraw();
  }

  function s2StatsBackTopButtonHtml() {
    return '<button type="button" class="cff-stats-back-top" data-stats-back-top="s2" onclick="window.scrollTo({top:0,behavior:\'smooth\'})" aria-label="Voltar ao topo" title="Voltar ao topo">↑</button>';
  }

  function statsRankingTable(rows, averages) {
    return `<div class="ffws-s2-table-wrap"><table class="ffws-s2-table ffws-s2-compact-table"><thead><tr><th>#</th><th>Eqp</th><th>PTS</th><th>K</th><th>${averages ? 'POS' : 'B!'}</th><th class="hide-mobile">Q</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td class="ffws-s2-rank">${index+1}º</td>${teamCell(row.team)}<td>${averages ? row.avgPoints.toFixed(2) : row.points}</td><td>${averages ? row.avgKills.toFixed(2) : row.kills}</td><td>${averages ? `${row.avgPosition.toFixed(2)}º` : row.booyahs}</td><td class="hide-mobile">${row.matches}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderStats() {
    const root = document.getElementById('ffws-br-s2-stats-content');
    if (!root) return;
    if (s2StatsEvolutionChart) { try { s2StatsEvolutionChart.destroy(); } catch (_) {} s2StatsEvolutionChart = null; }
    if (s2StatsEvolutionObserver) { try { s2StatsEvolutionObserver.disconnect(); } catch (_) {} s2StatsEvolutionObserver = null; }
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
      return { ...row,
        avgPartKills: total.kills ? (row.kills / total.kills) * 100 : 0,
        avgPartDamage: total.damage ? (row.damage / total.damage) * 100 : 0,
        avgPartAssists: total.assists ? (row.assists / total.assists) * 100 : 0
      };
    });
    const rookieRows = players.filter(row => Boolean(rosterPlayerByName(row.name, row.team)?.rookie));
    const records = statsRecordRows(events, playerEntries);

    const summaryBlock = events.length ? `<section id="anchor-s2-resumo" class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Resumo do recorte</h2><p>Visão rápida do recorte atualmente selecionado.</p></div><span class="ffws-s2-badge">${events.length} quedas</span></div>
      <div class="ffws-s2-stats-grid">${[['Quedas disputadas',events.length],['Total de pontos',totalPoints],['Total de abates',totalKills],['Total de booyahs',totalBooyahs],['Média de pontos',totalResults ? (totalPoints / totalResults).toFixed(2) : '0.00'],['Colocação média',avgPosition ? `${avgPosition.toFixed(2)}º` : '—']].map(([label, value]) => `<div class="ffws-s2-stat-card"><small>${label}</small><strong>${value}</strong></div>`).join('')}</div></div></section>` : '';

    const filterBlock = `<section id="anchor-s2-filtros" class="ffws-s2-panel ffws-s2-stats-filter-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Filtros do torneio</h2><p>Todos os blocos abaixo usam exatamente o mesmo recorte.</p></div><span class="ffws-s2-badge">${events.length} quedas</span></div>
      <div class="ffws-s2-filters"><label class="ffws-s2-filter"><span>Etapa:</span><select onchange="setFFWSS2StatsStage(this.value)">${stageOptions.map(([value,label]) => `<option value="${value}"${state.statsFilters.stage === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>${statsMultiFilter('days','Dias',options.days)}${statsMultiFilter('maps','Mapa',options.maps)}</div></div></section>`;

    const statsBlocks = events.length ? `<div class="ffws-s2-stats-body" style="margin-top: 4px;">
        <h4 id="anchor-s2-totais-equipe" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Totais por Equipe</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Top Pontos</h3>${s2StatsTeamValueCard('eq-pts', teams, row => row.points, value => String(value), 'Pts')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Abates</h3>${s2StatsTeamValueCard('eq-kills', teams, row => row.kills, value => String(value), 'Kills')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Booyahs</h3>${s2StatsTeamValueCard('eq-booyah', teams, row => row.booyahs, value => String(value), 'B!')}</div>
        </div>

        <h4 id="anchor-s2-medias-equipe" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Médias por Equipe</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Média Pontos</h3>${s2StatsTeamValueCard('eq-avgpts', teams, row => row.avgPoints, value => number(value).toFixed(2), 'Média')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Média Abates</h3>${s2StatsTeamValueCard('eq-avgkills', teams, row => row.avgKills, value => number(value).toFixed(2), 'Média')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Colocação Média</h3>${s2StatsTeamPositionCard('eq-avgpos', teams)}</div>
        </div>

        <h4 id="anchor-s2-top3-equipe" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Top 3 &amp; Último Lugar por Equipe <span style="font-size:0.55em; color:#888; text-transform:none; font-weight:normal;">(número de quedas ao lado)</span></h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>+ Vezes no Top 3</h3>${s2StatsTeamDualValueCard('eq-top3-count', teams, row => row.top3, value => String(value), row => row.matches, 'Top3', 'Q')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Maior Média Top 3</h3>${s2StatsTeamDualValueCard('eq-top3-avg', teams, row => row.top3Rate, value => `${(number(value) * 100).toFixed(1)}%`, row => `${row.top3} x`, '% Top3', 'N')}</div>
            <div class="card"><div class="card-top-border"></div><h3>+ Vezes em Último (12º)</h3>${s2StatsTeamDualValueCard('eq-top12-count', teams, row => row.top12, value => String(value), row => row.matches, '12º', 'Q')}</div>
        </div>

        <h4 id="anchor-s2-totais-jogador" style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Totais por Jogador</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Top Abates</h3>${s2StatsPlayerCard('pl-totkills', players, row => row.kills, value => String(value), 'Kills')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Dano</h3>${s2StatsPlayerCard('pl-totdano', players, row => row.damage, value => number(value).toLocaleString('pt-BR'), 'Dano')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Top Assistências</h3>${s2StatsPlayerCard('pl-totast', players, row => row.assists, value => String(value), 'Ast')}</div>
        </div>

        <h4 id="anchor-s2-medias-jogador" style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Médias por Jogador</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Média Abates</h3>${s2StatsPlayerCard('pl-avgkills', players, row => row.avgKills, value => number(value).toFixed(2), 'Média')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Média Dano</h3>${s2StatsPlayerCard('pl-avgdano', players, row => row.avgDamage, value => number(value).toFixed(0), 'Média')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Média Assistências</h3>${s2StatsPlayerCard('pl-avgast', players, row => row.avgAssists, value => number(value).toFixed(2), 'Média')}</div>
        </div>

        <h4 id="anchor-s2-participacao" style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Participação Relativa à Equipe <span style="font-size:0.6em; color:#666; text-transform: none; font-weight: normal;">(média % de contribuição por queda — min. 3 quedas)</span></h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Part. Kills</h3>${s2StatsPlayerCard('pl-partkills', playerShareRows, row => row.avgPartKills, value => `${number(value).toFixed(1)}%`, '%')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Part. Dano</h3>${s2StatsPlayerCard('pl-partdano', playerShareRows, row => row.avgPartDamage, value => `${number(value).toFixed(1)}%`, '%')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Part. Assists</h3>${s2StatsPlayerCard('pl-partast', playerShareRows, row => row.avgPartAssists, value => `${number(value).toFixed(1)}%`, '%')}</div>
        </div>

        <h4 id="anchor-s2-novatos" style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Jogadores Novatos</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Abates</h3>${s2StatsPlayerCard('rookie-kills', rookieRows, row => row.kills, value => String(value), 'Kills')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Dano</h3>${s2StatsPlayerCard('rookie-damage', rookieRows, row => row.damage, value => number(value).toLocaleString('pt-BR'), 'Dano')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Assistências</h3>${s2StatsPlayerCard('rookie-assists', rookieRows, row => row.assists, value => String(value), 'Ast')}</div>
        </div>

        <h4 id="anchor-s2-rec-drop-player" style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Recordes por Queda - Jogadores</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Mais Abates em uma Queda</h3>${s2StatsRecordPlayerCard('rec-pl-drop-kills', records.playerDrop, row => row.kills, value => String(value), 'Kills')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Mais Assist. em uma Queda</h3>${s2StatsRecordPlayerCard('rec-pl-drop-assists', records.playerDrop, row => row.assists, value => String(value), 'Ast')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Mais Dano em uma Queda</h3>${s2StatsRecordPlayerCard('rec-pl-drop-damage', records.playerDrop, row => row.damage, value => number(value).toLocaleString('pt-BR'), 'Dano')}</div>
        </div>

        <h4 id="anchor-s2-rec-day-player" style="color:var(--accent); margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Recordes por Dia - Jogadores</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Mais Abates em um Dia</h3>${s2StatsRecordPlayerCard('rec-pl-day-kills', records.playerDay, row => row.kills, value => String(value), 'Kills', true)}</div>
            <div class="card"><div class="card-top-border"></div><h3>Mais Assist. em um Dia</h3>${s2StatsRecordPlayerCard('rec-pl-day-assists', records.playerDay, row => row.assists, value => String(value), 'Ast', true)}</div>
            <div class="card"><div class="card-top-border"></div><h3>Mais Dano em um Dia</h3>${s2StatsRecordPlayerCard('rec-pl-day-damage', records.playerDay, row => row.damage, value => number(value).toLocaleString('pt-BR'), 'Dano', true)}</div>
        </div>

        <h4 id="anchor-s2-rec-drop-team" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Recordes por Queda - Times</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Mais Pontos em uma Queda</h3>${s2StatsRecordTeamCard('rec-eq-drop-points', records.teamDrop, row => row.points, value => String(value), 'Pts')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Mais Abates em uma Queda</h3>${s2StatsRecordTeamCard('rec-eq-drop-kills', records.teamDrop, row => row.kills, value => String(value), 'Kills')}</div>
            <div class="card"><div class="card-top-border"></div><h3>Mais Dano em uma Queda</h3>${s2StatsRecordTeamCard('rec-eq-drop-damage', records.teamDrop, row => row.damage, value => number(value).toLocaleString('pt-BR'), 'Dano')}</div>
        </div>

        <h4 id="anchor-s2-rec-day-team" style="color:#66b3ff; margin: 0 0 15px 0; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px;">Recordes por Dia - Times</h4>
        <div class="grid-cards" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 40px;">
            <div class="card"><div class="card-top-border"></div><h3>Mais Pontos em um Dia</h3>${s2StatsRecordTeamCard('rec-eq-day-points', records.teamDay, row => row.points, value => String(value), 'Pts', true)}</div>
            <div class="card"><div class="card-top-border"></div><h3>Mais Abates em um Dia</h3>${s2StatsRecordTeamCard('rec-eq-day-kills', records.teamDay, row => row.kills, value => String(value), 'Kills', true)}</div>
            <div class="card"><div class="card-top-border"></div><h3>Mais Dano em um Dia</h3>${s2StatsRecordTeamCard('rec-eq-day-damage', records.teamDay, row => row.damage, value => number(value).toLocaleString('pt-BR'), 'Dano', true)}</div>
        </div>
      </div>
      ${s2DropReportSelectorHtml(events)}
      ${s2StatsEvolutionHtml(events)}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-ranking-columns"><div id="anchor-s2-ranking-medias"><div class="ffws-s2-panel-head"><div><h2>Ranking de Médias</h2><p>Desempenho por queda.</p></div></div>${statsRankingTable(avgRanking, true)}</div><div id="anchor-s2-ranking-totais"><div class="ffws-s2-panel-head"><div><h2>Ranking de Totais</h2><p>Desempenho acumulado.</p></div></div>${statsRankingTable(totalRanking, false)}</div></div></div></section>
    ` : `<section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-empty"><div><strong>Etapa ainda sem resultados</strong>Escolha a Classificatória para consultar as quedas já disputadas.</div></div></div></section>`;

    root.innerHTML = `<div class="ffws-s2-shell">${hero('Estatísticas Gerais', 'Indicadores e rankings das equipes da WB 2026 S2')}
      ${s2StatsStickyNavHtml()}
      ${summaryBlock}
      ${filterBlock}
      ${statsBlocks}
      ${s2StatsBackTopButtonHtml()}
    </div>`;
    requestAnimationFrame(() => { renderS2StatsEvolutionChart(); updateCffStatsBackTopVisibility(); });
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


  const s2DailyNoteContextCache = new Map();

  function s2Percentile(values, percentile) {
    const sorted = (values || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const position = (sorted.length - 1) * percentile;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  }

  function s2DailyNoteContext(stage = 'classificatoria') {
    const stageKey = String(stage || 'classificatoria');
    if (s2DailyNoteContextCache.has(stageKey)) return s2DailyNoteContextCache.get(stageKey);
    const daily = new Map();
    allPlayerEntries().forEach(entry => {
      if (stageKey !== 'geral' && String(entry.stage) !== stageKey) return;
      const key = `${normalize(entry.name || entry.player)}__${normalize(entry.team)}__${entry.stage}__${number(entry.day)}`;
      if (!daily.has(key)) daily.set(key, { kills: 0, damage: 0, mvp: 0, matches: 0 });
      const row = daily.get(key);
      row.kills += number(entry.kills);
      row.damage += number(entry.damage);
      row.mvp += number(entry.mvp || entry.mvps);
      row.matches += number(entry.matches || 1);
    });
    const rows = [...daily.values()].filter(row => row.matches > 0);
    const kills = rows.map(row => row.kills);
    const damage = rows.map(row => row.damage);
    const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const context = {
      avgKills: Math.max(mean(kills), 5),
      avgDamage: Math.max(mean(damage), 6500),
      p20Kills: s2Percentile(kills, 0.2) || 2,
      p20Damage: s2Percentile(damage, 0.2) || 3500,
      p80Kills: s2Percentile(kills, 0.8) || 12,
      p80Damage: s2Percentile(damage, 0.8) || 14000,
      maxKills: Math.max(30, ...kills),
      maxDamage: Math.max(24000, ...damage)
    };
    s2DailyNoteContextCache.set(stageKey, context);
    return context;
  }

  function calculateS2DailyCffNote(kills, damage, mvps, matches = 6, stage = 'classificatoria') {
    kills = number(kills); damage = number(damage); mvps = number(mvps); matches = Math.max(1, number(matches) || 6);
    const context = s2DailyNoteContext(stage);
    const paceFactor = 6 / matches;
    const normalizedKills = kills * paceFactor;
    const normalizedDamage = damage * paceFactor;

    if (kills <= 1 && damage < 3500 && mvps === 0) {
      const lowNote = 3.6 + 0.25 * kills + 0.25 * Math.min(damage / 3500, 1);
      return Number(Math.max(3.5, Math.min(lowNote, 4.2)).toFixed(1));
    }

    let impact = (normalizedKills / Math.max(context.avgKills, 1)) * 0.7
      + (normalizedDamage / Math.max(context.avgDamage, 1)) * 0.25
      + 0.2 * (context.maxKills ? normalizedKills / context.maxKills : 0);
    impact += Math.min(0.05 * mvps, 0.2);
    impact = Math.max(impact, 0.2);

    let note = 6.35 + 1.75 * Math.log2(impact);
    if (normalizedKills <= context.p20Kills && normalizedDamage <= context.p20Damage) note -= 0.35;
    if (normalizedKills >= context.p80Kills || normalizedDamage >= context.p80Damage) note += 0.25;
    if (kills >= 3 && damage >= 5000) note = Math.max(note, 4.9);
    if (kills >= 5 || damage >= 7500) note = Math.max(note, 5.8);
    if (kills >= Math.max(8, Math.round(context.avgKills)) || damage >= Math.max(10000, 1.25 * context.avgDamage)) note = Math.max(note, 6.3);
    if (kills >= 18 || damage >= 18000) note = Math.max(note, 8);
    if (kills >= 24 || damage >= 23000) note = Math.max(note, 9);
    if (kills >= 30) note = 10;
    note += Math.min(0.1 * mvps, 0.3);
    return Number(Math.max(3.5, Math.min(note, 10)).toFixed(1));
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

  function notesFilterMatch(list, value, normalizer = String) {
    const selected = Array.isArray(list) ? list : [];
    if (!selected.length) return true;
    const target = normalizer(value);
    return selected.some(item => normalizer(item) === target);
  }

  function notesFilteredEntries() {
    const f = state.notesFilters;
    return allPlayerEntries().filter(entry => {
      const meta = rosterPlayerByName(entry.name, entry.team);
      const role = String(entry.roleShort || meta?.roleShort || '').toUpperCase();
      return notesFilterMatch(f.stage, entry.stage)
        && notesFilterMatch(f.team, entry.team, normalize)
        && notesFilterMatch(f.role, role, value => String(value || '').toUpperCase())
        && notesFilterMatch(f.day, String(entry.day))
        && notesFilterMatch(f.map, entry.map, normalize)
        && notesFilterMatch(f.drop, String(entry.drop));
    });
  }

  function notesParticipationEvents() {
    const f = state.notesFilters;
    return s2DropReportAllEvents().filter(event => {
      const stage = String(event._stage || 'classificatoria');
      const day = String(number(event._day));
      const drop = String(number(event.drop || event.queda || event.number));
      const map = String(event.map || event.mapa || '');
      return notesFilterMatch(f.stage, stage)
        && notesFilterMatch(f.day, day)
        && notesFilterMatch(f.map, map, normalize)
        && notesFilterMatch(f.drop, drop);
    });
  }

  function notesTeamMatchCounts() {
    const counts = new Map();
    const seen = new Set();
    notesParticipationEvents().forEach(event => {
      eventResults(event).forEach(result => {
        const team = result.team || result.equipe;
        const teamKey = normalize(team);
        if (!teamKey) return;
        const matchKey = `${teamKey}__${s2DropReportEventKey(event)}`;
        if (seen.has(matchKey)) return;
        seen.add(matchKey);
        counts.set(teamKey, (counts.get(teamKey) || 0) + 1);
      });
    });
    return counts;
  }

  function notesDailyTeamMatchCounts() {
    const counts = new Map();
    const seen = new Set();
    notesParticipationEvents().forEach(event => {
      eventResults(event).forEach(result => {
        const team = result.team || result.equipe;
        const teamKey = normalize(team);
        if (!teamKey) return;
        const dayKey = `${event._stage}__${number(event._day)}__${teamKey}`;
        const matchKey = `${dayKey}__${number(event.drop || event.queda || event.number)}`;
        if (seen.has(matchKey)) return;
        seen.add(matchKey);
        counts.set(dayKey, (counts.get(dayKey) || 0) + 1);
      });
    });
    return counts;
  }

  function resetNotesPagination() {
    state.notesPage = 0;
    state.notesRecordPages = { drops: 0, days: 0, averages: 0 };
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
    const mode = f.mode === 'drop' ? 'drop' : 'day';
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
      if (!aggregate.has(key)) aggregate.set(key,{key,name:entry.name,team:entry.team,sum:0,bestDropNote:0,kills:0,damage:0,assists:0,mvps:0,matches:0});
      const row=aggregate.get(key);
      row.sum+=entry.note;
      row.bestDropNote=Math.max(row.bestDropNote,entry.note);
      row.kills+=number(entry.kills);
      row.damage+=number(entry.damage);
      row.assists+=number(entry.assists);
      row.mvps+=number(entry.mvp);
      row.matches+=1;
    });

    const dailyMap = new Map();
    detailed.forEach(entry => {
      const playerKey = `${normalize(entry.name)}__${normalize(entry.team)}`;
      const key = `${playerKey}__${entry.stage}__${number(entry.day)}`;
      if (!dailyMap.has(key)) dailyMap.set(key,{key,playerKey,name:entry.name,team:entry.team,stage:entry.stage,day:number(entry.day),kills:0,damage:0,assists:0,mvp:0,notes:0,matches:0});
      const row=dailyMap.get(key);
      row.kills+=number(entry.kills);
      row.damage+=number(entry.damage);
      row.assists+=number(entry.assists);
      row.mvp+=number(entry.mvp);
      row.notes+=entry.note;
      row.matches+=1;
    });

    const dailyTeamMatchCounts = notesDailyTeamMatchCounts();

    let dailyRows = [...dailyMap.values()].map(row => ({
      ...row,
      dropAverageNote: row.matches ? row.notes / row.matches : 0,
      note: calculateS2DailyCffNote(row.kills,row.damage,row.mvp,row.matches,row.stage)
    }));
    if (f.halfMatches !== false) {
      dailyRows = dailyRows.filter(row => {
        const teamMatches = dailyTeamMatchCounts.get(`${row.stage}__${number(row.day)}__${normalize(row.team)}`) || row.matches;
        return row.matches >= Math.ceil(teamMatches / 2);
      });
    }

    const dailyByPlayer = new Map();
    dailyRows.forEach(day => {
      if (!dailyByPlayer.has(day.playerKey)) dailyByPlayer.set(day.playerKey,{sum:0,best:0,days:0});
      const row=dailyByPlayer.get(day.playerKey);
      row.sum+=day.note;
      row.best=Math.max(row.best,day.note);
      row.days+=1;
    });

    const teamMatchCounts = notesTeamMatchCounts();
    let rows=[...aggregate.values()].map(row=>{
      const dropAverageNote = row.matches ? row.sum / row.matches : 0;
      const dayStats = dailyByPlayer.get(row.key) || {sum:0,best:0,days:0};
      const dailyAverageNote = dayStats.days ? dayStats.sum / dayStats.days : 0;
      return {
        ...row,
        dropAverageNote,
        dailyAverageNote,
        dayCount:dayStats.days,
        note:mode==='day'?dailyAverageNote:dropAverageNote,
        best:mode==='day'?dayStats.best:row.bestDropNote
      };
    });
    if (f.halfMatches !== false) {
      rows = rows.filter(row => {
        const teamMatches = teamMatchCounts.get(normalize(row.team)) || row.matches;
        const hasOverallParticipation = row.matches >= Math.ceil(teamMatches / 2);
        return hasOverallParticipation && (mode !== 'day' || row.dayCount > 0);
      });
    }
    rows.sort((a,b)=>b.note-a.note||b.kills-a.kills||b.damage-a.damage);

    const eligibleKeys = new Set(rows.map(row => row.key));
    const visibleDetailed = f.halfMatches === false ? detailed : detailed.filter(entry => eligibleKeys.has(`${normalize(entry.name)}__${normalize(entry.team)}`));
    const allEntries = allPlayerEntries();
    const stageScopedEntries = allEntries.filter(entry => notesFilterMatch(f.stage, entry.stage));
    const teams=[...new Set(allEntries.map(entry=>entry.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const days=[...new Set(stageScopedEntries.map(entry=>number(entry.day)).filter(Boolean))].sort((a,b)=>a-b);
    const maps=[...new Set(stageScopedEntries.map(entry=>entry.map).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const drops=!f.day.length?[]:[...new Set(stageScopedEntries.filter(entry=>notesFilterMatch(f.day,String(entry.day))).map(entry=>number(entry.drop)).filter(Boolean))].sort((a,b)=>a-b);

    const eligibleDailyRows = f.halfMatches === false ? dailyRows : dailyRows.filter(row => eligibleKeys.has(row.playerKey));
    const topDrops=[...visibleDetailed].sort((a,b)=>b.note-a.note||b.kills-a.kills||b.damage-a.damage);
    const topDays=[...eligibleDailyRows].sort((a,b)=>b.note-a.note||b.kills-a.kills||b.damage-a.damage);
    const generalAverageRows=[...rows].sort((a,b)=>b.note-a.note||b.kills-a.kills||b.damage-a.damage);
    const noteRecord=(key,title,list,subtitle,action)=>{
      const pageSize=4;
      const pageCount=Math.max(1,Math.ceil(list.length/pageSize));
      const current=Math.max(0,Math.min(number(state.notesRecordPages?.[key]),pageCount-1));
      state.notesRecordPages[key]=current;
      const start=current*pageSize;
      const pageRows=list.slice(start,start+pageSize);
      const end=Math.min(start+pageRows.length,list.length);
      const pager=list.length>pageSize?`<div class="ffws-s2-mvp-pager ffws-s2-note-record-pager"><button type="button" aria-label="Página anterior" ${current<=0?'disabled':''} onclick="setFFWSS2NotesRecordPage('${key}',${current-1})">‹</button><span>${start+1}–${end} de ${list.length}</span><button type="button" aria-label="Próxima página" ${current>=pageCount-1?'disabled':''} onclick="setFFWSS2NotesRecordPage('${key}',${current+1})">›</button></div>`:'';
      return `<article class="ffws-s2-top-card"><h3>${title}</h3>${pageRows.length?pageRows.map((row,index)=>`<button type="button" class="ffws-s2-note-record" onclick="${action(row)}"><b>${start+index+1}º</b><span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(subtitle(row))}</small></span><em class="ffws-s2-note-badge ${noteBadgeClass(row.note)}">${row.note.toFixed(1)}</em></button>`).join(''):'<div class="ffws-s2-empty-mini">Nenhum resultado neste recorte.</div>'}${pager}</article>`;
    };

    const pageSize=10;
    const pageCount=Math.max(1,Math.ceil(rows.length/pageSize));
    state.notesPage=Math.max(0,Math.min(number(state.notesPage),pageCount-1));
    const pageStart=state.notesPage*pageSize;
    const pageRows=rows.slice(pageStart,pageStart+pageSize);
    const pageEnd=Math.min(pageStart+pageRows.length,rows.length);
    const pager=rows.length>pageSize?`<div class="ffws-s2-mvp-pager ffws-s2-notes-pager"><button type="button" aria-label="Ranking anterior" ${state.notesPage<=0?'disabled':''} onclick="setFFWSS2NotesPage(${state.notesPage-1})">‹</button><span>${pageStart+1}–${pageEnd} de ${rows.length}</span><button type="button" aria-label="Próximo ranking" ${state.notesPage>=pageCount-1?'disabled':''} onclick="setFFWSS2NotesPage(${state.notesPage+1})">›</button></div>`:'';
    const rankingDescription=mode==='day'
      ? 'Por dia, a nota geral é a média das Notas do Dia, calculadas pelo desempenho acumulado de cada dia. Esse é o modo padrão.'
      : 'Por queda, a nota geral é a média direta das avaliações de cada queda.';
    const bestLabel=mode==='day'?'Melhor dia':'Melhor queda';

    root.innerHTML = `<div class="ffws-s2-shell">${hero('Notas CFF', 'Avaliações por queda e por dia da Central Free Fire')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Ranking de Notas</h2><p>${rankingDescription}</p></div><span class="ffws-s2-badge">${visibleDetailed.length} atuações</span></div>
      ${notesModeControl()}
      <div class="ffws-s2-filters ffws-s2-notes-filters">${notesMultiFilter('stage','Etapa',[{value:'classificatoria',label:'Classificatória'},{value:'segundaFase',label:'Segunda Fase'},{value:'final',label:'Final'}])}${notesMultiFilter('team','Equipe',teams.map(v=>({value:v,label:v})))}${notesMultiFilter('role','Posição',[{value:'RUSH',label:'Rush'},{value:'GRAN',label:'Granadeiro'},{value:'SUP',label:'Suporte'},{value:'3',label:'3º homem'}])}${notesMultiFilter('day','Dia',days.map(v=>({value:String(v),label:`Dia ${v}`})))}${notesMultiFilter('drop','Queda',drops.map(v=>({value:String(v),label:`Queda ${v}`})),{disabled:!f.day.length,title:'Escolha ao menos um dia para liberar o filtro de queda',disabledLabel:'Selecione um dia'})}${notesMultiFilter('map','Mapa',maps.map(v=>({value:v,label:v})))}${notesHalfMatchesControl()}</div>
      ${rows.length?`<div class="ffws-s2-table-wrap"><table class="ffws-s2-table"><thead><tr><th>#</th><th>Jogador</th><th>Eqp</th><th>Nota</th><th>K</th><th class="hide-mobile">Dano</th><th class="hide-mobile">Ast.</th><th>Q</th><th class="hide-mobile" title="${bestLabel}">${bestLabel}</th></tr></thead><tbody>${pageRows.map((row,index)=>`<tr><td class="ffws-s2-rank">${pageStart+index+1}º</td><td><button type="button" class="ffws-s2-inline-link" onclick="openCurrentSeasonPlayer('${jsAttr(row.name)}','${jsAttr(row.team)}')">${escapeHtml(row.name)}</button></td>${teamCell(row.team)}<td><span class="ffws-s2-note-badge ${noteBadgeClass(row.note)}">${row.note.toFixed(1)}</span></td><td>${row.kills}</td><td class="hide-mobile">${row.damage.toLocaleString('pt-BR')}</td><td class="hide-mobile">${row.assists}</td><td>${row.matches}</td><td class="hide-mobile">${row.best.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>${pager}`:'<div class="ffws-s2-empty"><div><strong>Nenhuma nota neste recorte</strong>Altere os filtros para consultar as atuações disponíveis.</div></div>'}</div></section>
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Recordes de avaliação</h2><p>Melhores atuações individuais por queda, dia e média do recorte. Use as setas para ver as próximas posições.</p></div></div><div class="ffws-s2-top-grid">${noteRecord('drops','Top Quedas',topDrops,row=>`Dia ${row.day} • Q${row.drop} • ${row.kills} K`,row=>`openFFWSS2NoteDropReport('${jsAttr(row.stage)}',${number(row.day)},${number(row.drop)})`)}${noteRecord('days','Top Dias',topDays,row=>`Dia ${row.day} • ${row.kills} K • ${row.damage.toLocaleString('pt-BR')} dano`,row=>`openFFWSS2NoteDayReport('${jsAttr(row.stage)}',${number(row.day)})`)}${noteRecord('averages','Médias Gerais',generalAverageRows,row=>mode==='day'?`${row.dayCount} dia${row.dayCount===1?'':'s'} • ${row.matches} quedas`:`${row.matches} quedas • ${row.kills} K`,row=>`openCurrentSeasonPlayer('${jsAttr(row.name)}','${jsAttr(row.team)}')`)}</div></div></section>
      ${s2NotesBackTopButtonHtml()}
    </div>`;
    requestAnimationFrame(() => window.updateCffStatsBackTopVisibility?.());
  }

  function notesModeControl() {
    const selected = state.notesFilters.mode === 'drop' ? 'drop' : 'day';
    return `<div class="ffws-s2-notes-mode-row"><label class="ffws-s2-filter ffws-s2-notes-mode-filter"><span>Cálculo do ranking:</span><select onchange="setFFWSS2NotesFilter('mode',this.value)"><option value="day"${selected==='day'?' selected':''}>Por dia</option><option value="drop"${selected==='drop'?' selected':''}>Por queda</option></select></label></div>`;
  }

  function s2NotesBackTopButtonHtml() {
    return '<button type="button" class="cff-stats-back-top" data-stats-back-top="notes" onclick="window.scrollTo({top:0,behavior:\'smooth\'})" aria-label="Voltar ao topo" title="Voltar ao topo">↑</button>';
  }

  function notesMultiFilter(key, label, options, config = {}) {
    const selected = Array.isArray(state.notesFilters[key]) ? state.notesFilters[key] : [];
    const disabled = Boolean(config.disabled);
    const buttonLabel = disabled && config.disabledLabel
      ? config.disabledLabel
      : selected.length ? `${selected.length} selecionado${selected.length > 1 ? 's' : ''}` : 'Todos';
    const open = !disabled && state.notesOpenMulti === key;
    return `<div class="ffws-s2-filter"><span>${escapeHtml(label)}:</span><div class="ffws-s2-multi ffws-s2-notes-multi" data-s2-notes-multi="${escapeHtml(key)}">
      <button type="button" onclick="toggleFFWSS2NotesMulti('${key}')"${disabled?' disabled':''}${config.title?` title="${escapeHtml(config.title)}"`:''}><b>${escapeHtml(buttonLabel)}</b><span>⌄</span></button>
      <div class="ffws-s2-multi-menu" id="ffws-s2-notes-multi-${escapeHtml(key)}"${open?'':' hidden'}>
        <label><input type="checkbox" ${selected.length===0?'checked ':''}onchange="clearFFWSS2NotesMulti('${key}')"> Todos</label>
        ${options.map(option=>`<label><input type="checkbox" value="${escapeHtml(option.value)}" ${selected.includes(String(option.value))?'checked ':''}onchange="setFFWSS2NotesMulti('${key}',this.value,this.checked)"> ${escapeHtml(option.label)}</label>`).join('')}
      </div>
    </div></div>`;
  }

  function notesHalfMatchesControl() {
    const checked = state.notesFilters.halfMatches !== false;
    return `<div class="ffws-s2-filter ffws-s2-notes-half-filter"><span>Participação:</span><label class="ffws-s2-notes-half-check" title="Exibe somente jogadores que disputaram pelo menos 50% das quedas realizadas pela própria equipe em todo o recorte atual"><input type="checkbox" ${checked?'checked ':''}onchange="setFFWSS2NotesHalfMatches(this.checked)"><b>50% das quedas</b></label></div>`;
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
    if (pageId !== 'ffws-br-s2-stats' && state.dropReport?.bodyOverflow !== undefined) {
      const modal = document.getElementById('ffws-s2-drop-report-modal');
      if (modal) modal.hidden = true;
      document.body.style.overflow = state.dropReport.bodyOverflow ?? '';
      delete state.dropReport.bodyOverflow;
    }
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
    if (type === 'drop' && state.stageFilter[stageKey].period === 'all') return;
    state.stageFilter[stageKey][type] = value;
    if (type === 'period') state.stageFilter[stageKey].drop = 'all';
    const map = { classificatoria: 'ffws-br-s2-classificatoria', segundaFase: 'ffws-br-s2-segunda-fase', final: 'ffws-br-s2-final' };
    renderPage(map[stageKey]);
  };
  window.setFFWSS2SelectionWeek = week => { state.selectionTab = 'semanal'; state.selectionWeek = String(week || '1'); renderSelections(); };
  window.setFFWSS2SelectionTab = tab => { state.selectionTab = S2_SELECTION_PHASES[tab] ? tab : 'semanal'; renderSelections(); };
  window.setFFWSS2StatsStage = value => { state.statsStage = value; state.statsFilters.stage = String(value || 'classificatoria'); state.statsFilters.days = []; state.statsFilters.maps = []; renderStats(); };
  window.toggleFFWSS2StatsMulti = key => { document.querySelectorAll('.ffws-s2-multi-menu').forEach(menu => { if (menu.id !== `ffws-s2-stats-multi-${key}`) menu.hidden = true; }); const menu = document.getElementById(`ffws-s2-stats-multi-${key}`); if (menu) menu.hidden = !menu.hidden; };
  window.clearFFWSS2StatsMulti = key => { state.statsFilters[key] = []; renderStats(); };
  window.setFFWSS2StatsMulti = (key, value, checked) => { const selected = new Set(state.statsFilters[key] || []); checked ? selected.add(String(value)) : selected.delete(String(value)); state.statsFilters[key] = [...selected]; renderStats(); };
  window.ffwsS2StatsPageNav = (key, delta) => { const pages = s2StatsPageState(); pages[key] = delta === 'reset' ? 0 : number(pages[key]) + number(delta); renderStats(); };
  window.scrollFFWSS2StatsSection = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setFFWSS2StatsEvolutionMetric = value => { state.statsEvolution.metric = ['position','points','kills'].includes(String(value)) ? String(value) : 'position'; renderS2StatsEvolutionChart(); };
  window.toggleFFWSS2StatsEvolutionTeam = team => {
    const selected = new Set(state.statsEvolution.teams || []);
    const current = [...selected].find(item => normalize(item) === normalize(team));
    if (current) selected.delete(current); else if (selected.size < 5) selected.add(String(team));
    state.statsEvolution.teams = [...selected];
    document.querySelectorAll('.ffws-s2-evolution-team-buttons button').forEach(button => {
      const text = button.getAttribute('title') || ''; button.classList.toggle('active', state.statsEvolution.teams.some(item => normalize(item) === normalize(text)));
    });
    renderS2StatsEvolutionChart();
  };
  window.updateCffStatsBackTopVisibility = () => {
    document.querySelectorAll('.cff-stats-back-top').forEach(button => {
      const owner = button.dataset.statsBackTop;
      const active = owner === 's2'
        ? document.getElementById('ffws-br-s2-stats')?.classList.contains('active')
        : owner === 'notes'
          ? document.getElementById('ffws-br-s2-notas')?.classList.contains('active')
          : document.getElementById('stats')?.classList.contains('active');
      button.classList.toggle('is-visible', Boolean(active && window.scrollY > 520));
    });
  };
  window.openFFWSS2DropReport = key => {
    const event = s2DropReportFindEvent(key);
    if (!event) return;
    state.dropReport.mode = 'drop';
    state.dropReport.key = String(key);
    state.dropReport.teamDetail = '';
    state.dropReport.playerTeams = [];
    if (!state.dropReport.tab) state.dropReport.tab = 'summary';
    const modal = ensureFFWSS2DropReportModal();
    renderFFWSS2DropReportModal();
    const reportBody = document.getElementById('ffws-s2-drop-report-body');
    if (reportBody) reportBody.scrollTop = 0;
    modal.hidden = false;
    if (state.dropReport.bodyOverflow === undefined) state.dropReport.bodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.querySelector('.ffws-s2-drop-report-close')?.focus({ preventScroll: true }));
  };
  window.openFFWSS2DayReport = (stage, day) => {
    const report = s2DropReportDayBuild(stage, day, filteredStatsEvents());
    if (!report) return;
    state.dropReport.mode = 'day';
    state.dropReport.key = report.key;
    state.dropReport.teamDetail = '';
    state.dropReport.playerTeams = [];
    if (!state.dropReport.tab) state.dropReport.tab = 'summary';
    const modal = ensureFFWSS2DropReportModal();
    renderFFWSS2DropReportModal();
    const reportBody = document.getElementById('ffws-s2-drop-report-body');
    if (reportBody) reportBody.scrollTop = 0;
    modal.hidden = false;
    if (state.dropReport.bodyOverflow === undefined) state.dropReport.bodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.querySelector('.ffws-s2-drop-report-close')?.focus({ preventScroll: true }));
  };
  window.closeFFWSS2DropReport = () => {
    const modal = document.getElementById('ffws-s2-drop-report-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = state.dropReport.bodyOverflow ?? '';
    delete state.dropReport.bodyOverflow;
    state.dropReport.teamDetail = '';
  };
  window.setFFWSS2DropReportTab = tab => {
    state.dropReport.tab = ['summary','teams','players'].includes(String(tab)) ? String(tab) : 'summary';
    if (state.dropReport.tab !== 'teams') state.dropReport.teamDetail = '';
    renderFFWSS2DropReportModal();
    const reportBody = document.getElementById('ffws-s2-drop-report-body');
    if (reportBody) reportBody.scrollTop = 0;
  };
  window.setFFWSS2DropReportTeamSort = value => { state.dropReport.teamSort = String(value || 'points'); renderFFWSS2DropReportModal(); };
  window.setFFWSS2DropReportPlayerSort = value => { state.dropReport.playerSort = String(value || 'kills'); renderFFWSS2DropReportModal(); };
  window.showFFWSS2DropReportTeam = team => { state.dropReport.tab = 'teams'; state.dropReport.teamDetail = String(team || ''); renderFFWSS2DropReportModal(); document.querySelector('.ffws-s2-drop-team-detail')?.scrollIntoView({ block: 'start' }); };
  window.hideFFWSS2DropReportTeam = () => { state.dropReport.teamDetail = ''; renderFFWSS2DropReportModal(); };
  window.toggleFFWSS2DropReportPlayerTeam = team => {
    const key = normalize(team);
    const selected = new Set(state.dropReport.playerTeams || []);
    selected.has(key) ? selected.delete(key) : selected.add(key);
    state.dropReport.playerTeams = [...selected];
    renderFFWSS2DropReportModal();
  };
  window.clearFFWSS2DropReportPlayerTeams = () => { state.dropReport.playerTeams = []; renderFFWSS2DropReportModal(); };
  window.setFFWSS2NotesFilter = (key, value) => {
    if (key !== 'mode') return;
    state.notesFilters.mode = String(value) === 'drop' ? 'drop' : 'day';
    resetNotesPagination();
    renderNotes();
  };
  window.toggleFFWSS2NotesMulti = key => {
    if (key === 'drop' && !state.notesFilters.day.length) return;
    const nextOpen = state.notesOpenMulti === key ? '' : key;
    state.notesOpenMulti = nextOpen;
    document.querySelectorAll('.ffws-s2-multi-menu').forEach(menu => {
      menu.hidden = menu.id !== `ffws-s2-notes-multi-${key}` || !nextOpen;
    });
  };
  window.clearFFWSS2NotesMulti = key => {
    if (!Array.isArray(state.notesFilters[key])) return;
    state.notesFilters[key] = [];
    if (key === 'stage') { state.notesFilters.day = []; state.notesFilters.map = []; state.notesFilters.drop = []; }
    if (key === 'day') state.notesFilters.drop = [];
    state.notesOpenMulti = key;
    resetNotesPagination();
    renderNotes();
  };
  window.setFFWSS2NotesMulti = (key, value, checked) => {
    if (!Array.isArray(state.notesFilters[key])) return;
    if (key === 'drop' && !state.notesFilters.day.length) return;
    const selected = new Set(state.notesFilters[key]);
    checked ? selected.add(String(value)) : selected.delete(String(value));
    state.notesFilters[key] = [...selected];
    if (key === 'stage') { state.notesFilters.day = []; state.notesFilters.map = []; state.notesFilters.drop = []; }
    if (key === 'day') state.notesFilters.drop = [];
    state.notesOpenMulti = key;
    resetNotesPagination();
    renderNotes();
  };
  window.setFFWSS2NotesHalfMatches = checked => { state.notesFilters.halfMatches = Boolean(checked); resetNotesPagination(); renderNotes(); };
  window.setFFWSS2NotesPage = page => { state.notesPage = Math.max(0, number(page)); renderNotes(); };
  window.setFFWSS2NotesRecordPage = (key, page) => {
    if (!['drops','days','averages'].includes(String(key))) return;
    state.notesRecordPages[key] = Math.max(0, number(page));
    renderNotes();
  };
  function openS2StatsReportFromNotes(mode, stage, day, drop = 0) {
    const targetStage = ['classificatoria','segundaFase','final'].includes(String(stage)) ? String(stage) : 'classificatoria';
    state.statsStage = targetStage;
    state.statsFilters.stage = targetStage;
    state.statsFilters.days = [];
    state.statsFilters.maps = [];
    ensureFFWSS2DropReportModal();
    if (mode === 'day') {
      window.openFFWSS2DayReport(targetStage, number(day));
      return;
    }
    const event = s2DropReportAllEvents().find(item => String(item._stage) === targetStage && number(item._day) === number(day) && number(item.drop || item.queda || item.number) === number(drop));
    if (event) window.openFFWSS2DropReport(s2DropReportEventKey(event));
  }
  window.openFFWSS2NoteDropReport = (stage, day, drop) => openS2StatsReportFromNotes('drop', stage, day, drop);
  window.openFFWSS2NoteDayReport = (stage, day) => openS2StatsReportFromNotes('day', stage, day, 0);
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
  window.toggleFFWSS2MvpDetails = button => {
    const panel = button?.closest('.ffws-s2-mvp-panel');
    if (!panel) return;
    const expanded = panel.classList.toggle('show-details');
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? 'Ocultar detalhes' : 'Dados completos';
  };
  window.toggleFFWSS2Multi = key => {
    document.querySelectorAll('.ffws-s2-multi-menu').forEach(menu => { if (menu.id !== `ffws-s2-multi-${key}`) menu.hidden = true; });
    const menu = document.getElementById(`ffws-s2-multi-${key}`);
    if (menu) menu.hidden = !menu.hidden;
  };
  window.setFFWSS2MvpPage = page => { state.mvpPage = Math.max(0, number(page)); renderMvp(); };
  window.clearFFWSS2Multi = key => { state.playerFilters[key] = []; state.mvpPage = 0; renderMvp(); };
  window.setFFWSS2Multi = (key, value, checked) => {
    const list = new Set(state.playerFilters[key] || []);
    checked ? list.add(String(value)) : list.delete(String(value));
    state.playerFilters[key] = [...list];
    state.mvpPage = 0;
    renderMvp();
  };

  document.addEventListener('click', event => {
    if (!event.target.closest('.ffws-s2-multi')) {
      document.querySelectorAll('.ffws-s2-multi-menu').forEach(menu => { menu.hidden = true; });
      state.notesOpenMulti = '';
    }
    if (!event.target.closest('.ffws-s2-compare-picker')) document.querySelectorAll('.ffws-s2-compare-picker-menu').forEach(menu => { menu.hidden = true; });
  });

  window.addEventListener('scroll', () => window.updateCffStatsBackTopVisibility?.(), { passive: true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.getElementById('ffws-s2-drop-report-modal')?.hidden) closeFFWSS2DropReport();
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
    // Observe somente a troca de página da própria S2.
    // Antes o observer ficava no body inteiro e qualquer mudança de classe
    // (menu, busca, widgets etc.) podia reativar/renderizar a Stats e destruir
    // um Relatório de Quedas que estivesse aberto.
    let observedActivePage = document.querySelector(`.page.active[id^="${PAGE_PREFIX}"]`)?.id || '';
    const observer = new MutationObserver(mutations => {
      let nextActivePage = '';
      for (const mutation of mutations) {
        const target = mutation.target;
        if (!(target instanceof Element)) continue;
        if (!PAGE_IDS.has(target.id) || !target.classList.contains('active')) continue;
        nextActivePage = target.id;
        break;
      }
      if (!nextActivePage || nextActivePage === observedActivePage) return;
      observedActivePage = nextActivePage;
      activate(nextActivePage);
    });
    document.querySelectorAll(`.page[id^="${PAGE_PREFIX}"]`).forEach(page => {
      observer.observe(page, { attributes: true, attributeFilter: ['class'] });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
