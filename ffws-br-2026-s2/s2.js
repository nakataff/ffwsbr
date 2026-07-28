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
    selectionTab: 'classificatoria',
    playerFilters: { stage: [], team: [], role: [], rookie: [], day: [] },
    statsStage: 'geral'
  };

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
      <label class="ffws-s2-filter"><span>Mapa:</span><select onchange="setFFWSS2StageFilter('${stageKey}','map',this.value)"${maps.length ? '' : ' disabled title="Disponível quando os resultados forem cadastrados"'}><option value="all">Todos os mapas</option>${maps.map(map => `<option value="${escapeHtml(map)}"${normalize(selected.map) === normalize(map) ? ' selected' : ''}>${escapeHtml(map)}</option>`).join('')}</select></label>
      <label class="ffws-s2-filter"><span>Queda:</span><select onchange="setFFWSS2StageFilter('${stageKey}','drop',this.value)"${drops.length ? '' : ' disabled title="Disponível quando os resultados forem cadastrados"'}><option value="all">Todas as quedas</option>${drops.map(drop => `<option value="${drop}"${String(selected.drop) === String(drop) ? ' selected' : ''}>Queda ${drop}</option>`).join('')}</select></label>
    </div><div class="ffws-s2-filter-summary">${selected.period === 'all' ? 'Classificação geral' : `${label} ${selected.period}`}${selected.map !== 'all' ? ` • ${escapeHtml(selected.map)}` : ''}${selected.drop !== 'all' ? ` • Queda ${escapeHtml(selected.drop)}` : ''}.</div>`;
  }


  function renderClassificatoria(rootId) {
    const layoutApi = window.FFWSBRSeasonLayout;
    const root = document.getElementById(rootId);
    if (!root) return;
    if (!layoutApi || typeof layoutApi.renderClassification !== 'function') {
      root.innerHTML = '<div class="ffws-s2-empty"><div><strong>Layout compartilhado indisponível</strong>Atualize os arquivos da temporada.</div></div>';
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
        <div class="ffws-s2-panel-head"><div><h2>Classificação</h2><p>Tabela preparada no padrão da FFWS BR 2026 S1 para receber os resultados por rodada, mapa e queda.</p></div><span class="ffws-s2-badge">${rows.length} equipes</span></div>
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
    return {
      stage: [{ value: 'classificatoria', label: 'Classificatória' }, { value: 'segundaFase', label: 'Segunda Fase' }, { value: 'final', label: 'Final' }],
      team: teams.map(team => ({ value: team, label: team })),
      role: [{ value: 'RUSH', label: 'Rush' }, { value: 'SUP', label: 'Suporte' }, { value: 'GRAN', label: 'Granadeiro' }, { value: '3', label: '3º homem' }],
      rookie: [{ value: 'rookie', label: 'Apenas estreantes' }, { value: 'veteran', label: 'Sem estreantes' }],
      day: days.map(day => ({ value: String(day), label: `Dia ${day}` }))
    };
  }

  function filteredPlayers() {
    const entries = allPlayerEntries().filter(entry => {
      const f = state.playerFilters;
      const meta = rosterPlayerByName(entry.name || entry.player, entry.team);
      const isRookie = Boolean(meta?.rookie ?? entry.rookie);
      const rookieMatch = !f.rookie.length
        || (f.rookie.includes('rookie') && isRookie)
        || (f.rookie.includes('veteran') && !isRookie);
      return (!f.stage.length || f.stage.includes(String(entry.stage)))
        && (!f.team.length || f.team.some(team => normalize(team) === normalize(entry.team)))
        && (!f.role.length || f.role.includes(String(entry.roleShort || entry.role || meta?.roleShort || '').toUpperCase()))
        && rookieMatch
        && (!f.day.length || f.day.includes(String(entry.day)));
    });
    const aggregate = new Map();
    entries.forEach(entry => {
      const key = `${normalize(entry.name || entry.player)}__${normalize(entry.team)}`;
      if (!aggregate.has(key)) aggregate.set(key, { name: entry.name || entry.player, team: entry.team, kills: 0, damage: 0, assists: 0, matches: 0, mvps: 0 });
      const row = aggregate.get(key);
      row.kills += number(entry.kills);
      row.damage += number(entry.damage);
      row.assists += number(entry.assists);
      row.matches += number(entry.matches || 1);
      row.mvps += number(entry.mvp || entry.mvps);
    });
    return [...aggregate.values()].sort((a, b) => b.kills - a.kills || b.damage - a.damage || b.assists - a.assists);
  }

  function renderMvp() {
    const root = document.getElementById('ffws-br-s2-mvp-content');
    if (!root) return;
    const options = playerFilterOptions();
    const rows = filteredPlayers();
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Ranking MVP', 'Classificação individual da FFWS Brasil 2026 Split 2')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner">
        <div class="ffws-s2-panel-head"><div><h2>Classificação Geral de Jogadores</h2><p>Filtros múltiplos preparados para combinar etapas, equipes, posições, países e dias.</p></div><span class="ffws-s2-badge">${rows.length} jogadores</span></div>
        <div class="ffws-s2-filters">${multiFilter('stage', 'Etapa', options.stage)}${multiFilter('team', 'Equipe', options.team)}${multiFilter('role', 'Posição', options.role)}${multiFilter('rookie', 'Novatos', options.rookie)}${multiFilter('day', 'Dias', options.day)}</div>
        <div class="ffws-s2-table-wrap"><table class="ffws-s2-table"><thead><tr><th>#</th><th class="team-col">Jogador</th><th>Equipe</th><th>K</th><th class="hide-mobile">Dano</th><th class="hide-mobile">Assist.</th><th>Q</th><th class="hide-mobile">MVP</th></tr></thead><tbody>
        ${rows.length ? rows.map((row, index) => `<tr><td class="ffws-s2-rank">${index + 1}º</td><td class="team-col"><button type="button" class="ffws-s2-inline-link" onclick="openCurrentSeasonPlayer('${jsAttr(row.name)}', '${jsAttr(row.team)}')">${escapeHtml(row.name)}</button></td>${teamCell(row.team)}<td>${row.kills}</td><td class="hide-mobile">${row.damage.toLocaleString('pt-BR')}</td><td class="hide-mobile">${row.assists}</td><td>${row.matches}</td><td class="hide-mobile">${row.mvps}</td></tr>`).join('') : '<tr><td colspan="8"><div class="ffws-s2-empty"><div><strong>Estatísticas em breve</strong>Os 72 participantes já estão cadastrados; o ranking será preenchido quando as primeiras quedas forem importadas.</div></div></td></tr>'}
        </tbody></table></div>
      </div></section></div>`;
  }

  function renderTeams() {
    const root = document.getElementById('ffws-br-s2-equipes-content');
    if (!root) return;
    const totalPlayers = rosterPlayers().length;
    const totalRookies = rosterPlayers().filter(player => player.rookie).length;
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Equipes', 'As 14 organizações e os elencos da FFWS Brasil 2026 Split 2')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Diretório de Equipes</h2><p>Os nicknames foram padronizados com os nomes já usados no site. A marca de estreante considera apenas quem ainda não disputou uma edição anterior da elite brasileira.</p></div><span class="ffws-s2-badge">${totalPlayers} jogadores • ${totalRookies} estreantes</span></div>
      <div class="ffws-s2-teams-grid ffws-s2-rosters-grid">${state.teams.map(team => {
        const roster = playersForTeam(team.name);
        const starters = roster.filter(player => player.starter).length;
        return `<article class="ffws-s2-team-card ffws-s2-team-roster-card" role="button" tabindex="0" onclick="openCurrentSeasonTeam('${jsAttr(team.name)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCurrentSeasonTeam('${jsAttr(team.name)}')}">
          <header class="ffws-s2-team-roster-head"><img loading="lazy" decoding="async" src="${escapeHtml(logo(team.name))}" alt="${escapeHtml(team.name)}" onerror="this.onerror=null;this.src='escudo.webp'"><div><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(team.abbreviation)} • Brasil</small><small class="${team.logoPending ? 'ffws-s2-logo-pending' : ''}">${team.logoPending ? 'Logo pendente • ' : ''}${starters} titulares • ${Math.max(0, roster.length - starters)} reservas</small></div></header>
          <div class="ffws-s2-roster-list">${roster.length ? roster.map(player => `<button type="button" class="ffws-s2-roster-player${player.starter ? '' : ' reserve'}" onclick="event.stopPropagation();openCurrentSeasonPlayer('${jsAttr(player.name)}', '${jsAttr(player.team)}')">
            <span class="ffws-s2-roster-player-main"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(playerRoleLabel(player))} • ${escapeHtml(player.rosterStatus)}</small></span>
            <span class="ffws-s2-roster-badges">${playerBadges(player)}</span>
          </button>`).join('') : '<div class="ffws-s2-roster-empty">Elenco ainda não cadastrado.</div>'}</div>
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
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Datas', 'Calendário oficial da FFWS Brasil 2026 Split 2')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Cronograma Geral</h2><p>Todos os dias começam às 13h, no horário de Brasília. Durante a Classificatória, as equipes indicadas ficam de folga naquela rodada.</p></div><span class="ffws-s2-badge">22 dias de competição</span></div>
      <div class="ffws-s2-dates">${stages.map(stage => `<article class="ffws-s2-date-card"><span>${escapeHtml(stage.status)}</span><h3>${escapeHtml(stage.name)}</h3><p>${escapeHtml(stage.summary)}</p><b>${escapeHtml(stage.date)}</b></article>`).join('')}</div></div></section>
      ${renderScheduleSection('classificatoria', rounds, next?.key, live?.key)}
      ${renderScheduleSection('segundaFase', rounds, next?.key, live?.key)}
      ${renderScheduleSection('final', rounds, next?.key, live?.key)}
    </div>`;
  }

  function renderSelections() {
    const root = document.getElementById('ffws-br-s2-selecoes-content');
    if (!root) return;
    const tabs = [
      ['classificatoria', 'Classificatória'], ['segundaFase', 'Segunda Fase'], ['final', 'Final'], ['torneio', 'Torneio']
    ];
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Seleções da Season', 'Destaques por posição e etapa da temporada')}
      <div class="ffws-s2-stage-tabs">${tabs.map(([key, label]) => `<button type="button" class="ffws-s2-stage-tab${state.selectionTab === key ? ' active' : ''}" onclick="setFFWSS2SelectionTab('${key}')">${escapeHtml(label)}</button>`).join('')}</div>
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>${escapeHtml(tabs.find(tab => tab[0] === state.selectionTab)?.[1] || 'Seleção')}</h2><p>Melhores jogadores por função, seguindo o padrão da FFWS BR 2026 S1.</p></div><span class="ffws-s2-badge">Em breve</span></div>
      <div class="ffws-s2-selection-grid">${['Rush', 'Rush', 'Granadeiro', 'Suporte'].map(role => `<div class="ffws-s2-selection-card"><div><strong>${escapeHtml(role)}</strong><br>Participante a definir</div></div>`).join('')}</div></div></section></div>`;
  }

  function renderStats() {
    const root = document.getElementById('ffws-br-s2-stats-content');
    if (!root) return;
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Estatísticas Gerais', 'Indicadores e rankings das equipes da FFWS Brasil 2026 Split 2')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Filtros do torneio</h2><p>Estrutura baseada na página de Estatísticas Gerais da FFWS BR 2026 S1.</p></div><span class="ffws-s2-badge">Aguardando dados</span></div>
      <div class="ffws-s2-filters"><label class="ffws-s2-filter"><span>Etapa:</span><select onchange="setFFWSS2StatsStage(this.value)"><option value="geral">Geral</option><option value="classificatoria">Classificatória</option><option value="segundaFase">Segunda Fase</option><option value="final">Final</option></select></label><label class="ffws-s2-filter"><span>Dias:</span><select disabled><option>Todos os dias</option></select></label><label class="ffws-s2-filter"><span>Confrontos:</span><select disabled><option>Geral</option></select></label><label class="ffws-s2-filter"><span>Mapa:</span><select disabled><option>Todos os mapas</option></select></label></div>
      <div class="ffws-s2-stats-grid">${[['Total de pontos','—'],['Total de abates','—'],['Total de booyahs','—'],['Média de pontos','—'],['Média de abates','—'],['Colocação média','—']].map(([label, value]) => `<div class="ffws-s2-stat-card"><small>${label}</small><strong>${value}</strong></div>`).join('')}</div></div></section>
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Melhores equipes por quesito</h2><p>Top 4 em pontos, abates, booyahs e médias.</p></div></div><div class="ffws-s2-top-grid">${['Top Pontos','Top Abates','Top Booyahs','Média de Pontos','Média de Abates','Colocação Média'].map(title => `<div class="ffws-s2-top-card"><h3>${title}</h3>${Array.from({length:4},(_,i)=>`<div class="ffws-s2-top-slot"><b>${i+1}º</b><span>Aguardando resultados</span></div>`).join('')}</div>`).join('')}</div></div></section>
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Ranking de Médias e Totais</h2><p>As tabelas serão liberadas assim que houver resultados cadastrados.</p></div></div><div class="ffws-s2-empty"><div><strong>Sem estatísticas disponíveis</strong>Os filtros e rankings já estão preparados para receber os dados.</div></div></div></section></div>`;
  }

  function renderNotes() {
    const root = document.getElementById('ffws-br-s2-notas-content');
    if (!root) return;
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Notas CFF', 'Avaliações por queda no padrão SofaScore da Central Free Fire')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Ranking de Notas</h2><p>As notas dependem dos dados individuais de cada queda.</p></div><span class="ffws-s2-badge">Em breve</span></div>
      <div class="ffws-s2-filters"><label class="ffws-s2-filter"><span>Etapa:</span><select><option>Geral</option><option>Classificatória</option><option>Segunda Fase</option><option>Final</option></select></label><label class="ffws-s2-filter"><span>Equipe:</span><select disabled><option>Todas</option></select></label><label class="ffws-s2-filter"><span>Posição:</span><select disabled><option>Todas</option></select></label><label class="ffws-s2-filter"><span>Dias:</span><select disabled><option>Todos</option></select></label></div>
      <div class="ffws-s2-empty"><div><strong>Participantes e estatísticas pendentes</strong>O ranking será calculado automaticamente após a importação das quedas.</div></div></div></section></div>`;
  }

  function renderCompare() {
    const root = document.getElementById('ffws-br-s2-comparar-content');
    if (!root) return;
    const players = rosterPlayers().slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    const options = players.map(player => `<option value="${escapeHtml(player.name)}">${escapeHtml(player.name)} • ${escapeHtml(abbreviation(player.team))}</option>`).join('');
    root.innerHTML = `<div class="ffws-s2-shell">${hero('Comparar 1V1', 'Compare dois jogadores da FFWS Brasil 2026 Split 2')}
      <section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-compare"><div class="ffws-s2-compare-card"><strong>Jogador 1</strong><select disabled><option>${players.length} participantes cadastrados</option>${options}</select></div><div class="ffws-s2-vs">VS</div><div class="ffws-s2-compare-card"><strong>Jogador 2</strong><select disabled><option>Estatísticas em breve</option>${options}</select></div></div><div class="ffws-s2-empty" style="margin-top:16px;min-height:100px"><div><strong>Elencos cadastrados</strong>A comparação será liberada quando as primeiras estatísticas da temporada forem importadas.</div></div></div></section></div>`;
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
      root.innerHTML = '<div class="ffws-s2-empty"><div><strong>Carregando FFWS BR 2026 S2...</strong></div></div>';
    }
    const needsPlayers = new Set(['ffws-br-s2-mvp', 'ffws-br-s2-equipes', 'ffws-br-s2-selecoes', 'ffws-br-s2-notas', 'ffws-br-s2-comparar']).has(pageId);
    loadData()
      .then(() => needsPlayers ? loadPlayersData() : null)
      .then(() => renderPage(pageId))
      .catch(error => {
        if (root) root.innerHTML = `<div class="ffws-s2-empty"><div><strong>Não foi possível carregar a página</strong>${escapeHtml(error.message)}</div></div>`;
      });
  }

  window.setFFWSS2StageFilter = (stageKey, type, value) => {
    state.stageFilter[stageKey] = state.stageFilter[stageKey] || { period: 'all', map: 'all', drop: 'all' };
    state.stageFilter[stageKey][type] = value;
    const map = { classificatoria: 'ffws-br-s2-classificatoria', segundaFase: 'ffws-br-s2-segunda-fase', final: 'ffws-br-s2-final' };
    renderPage(map[stageKey]);
  };
  window.setFFWSS2SelectionTab = key => { state.selectionTab = key; renderSelections(); };
  window.setFFWSS2StatsStage = value => { state.statsStage = value; };
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
