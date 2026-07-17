(function () {
  'use strict';

  const BASE = 'ewc%202026/';
  const CONFIG = Object.assign({
    groupJsonUrl: `${BASE}classificacao.json`,
    survivalJsonUrl: `${BASE}repescagem.json`,
    finalJsonUrl: `${BASE}final.json`,
    killsJsonUrl: `${BASE}abates.json`,
    teamLogosTsvUrl: '',
    logoCacheMinutes: 30
  }, window.EWC_2026_CONFIG || {});

  const PAGE_ALIASES = {
    'ewc-2026': 'ewc-grupos',
    'ewc-tabela': 'ewc-grupos',
    'ewc-kills': 'ewc-mvp',
    'ewc-datas': 'ewc-grupos'
  };

  const PAGE_IDS = new Set([
    'ewc-2026', 'ewc-tabela', 'ewc-kills', 'ewc-datas',
    'ewc-grupos', 'ewc-repescagem', 'ewc-final', 'ewc-mvp',
    'ewc-equipes', 'ewc-stats', 'ewc-team-profile', 'ewc-player-profile'
  ]);

  const COUNTRY_NAMES = {
    ar: 'Argentina', bd: 'Bangladesh', br: 'Brasil', cl: 'Chile', co: 'Colômbia',
    cr: 'Costa Rica', do: 'República Dominicana', dz: 'Argélia', eg: 'Egito',
    id: 'Indonésia', in: 'Índia', my: 'Malásia', np: 'Nepal', pk: 'Paquistão',
    th: 'Tailândia', tn: 'Tunísia', ve: 'Venezuela', vn: 'Vietnã', za: 'África do Sul'
  };

  const filters = {
    groups: { day: 'all', drop: 'all' },
    survival: { day: 'all', drop: 'all' },
    final: { day: 'all', drop: 'all' }
  };

  const statsFilters = {
    stage: 'general',
    day: 'all',
    map: 'all',
    confrontation: 'all'
  };

  const statsRankingFilters = {
    avg: { stage: 'general', day: 'all', map: 'all', confrontation: 'all' },
    total: { stage: 'general', day: 'all', map: 'all', confrontation: 'all', totalMode: 'total' }
  };

  const statsExpanded = { avg: false, total: false };
  const statsCardPages = Object.create(null);
  let activeGroup = 'A';
  let teams = [];
  let groupData = { rows: [], groups: {} };
  let survivalData = { rows: [], teams: [] };
  let finalData = { rows: [], teams: [] };
  let kills = [];
  let ewcLogoMap = {};
  let loaded = false;
  let loadPromise = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function jsString(value) {
    return escapeHtml(JSON.stringify(String(value == null ? '' : value)));
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
  }

  function slug(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function json(url) {
    return fetch(url, { cache: 'default' }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  }

  function flagEmoji(code) {
    const clean = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(clean)) return '';
    return String.fromCodePoint(...clean.split('').map(char => 127397 + char.charCodeAt(0)));
  }

  function flagMarkup(code) {
    const emoji = flagEmoji(code);
    if (!emoji) return '<span class="ewc-flag" aria-hidden="true"></span>';
    const title = COUNTRY_NAMES[String(code || '').toLowerCase()] || String(code || '').toUpperCase();
    return `<span class="ewc-flag" role="img" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}">${emoji}</span>`;
  }

  function roleMarkup(person) {
    return `<span class="ewc-role"><span class="ewc-role-full">${escapeHtml(person.role || 'JOGADOR')}</span><span class="ewc-role-short">${escapeHtml(person.roleShort || person.role || 'JOG')}</span></span>`;
  }

  function teamAliases(team) {
    return [team.name, team.dataName, team.abbreviation, ...(team.aliases || [])].filter(Boolean);
  }

  function teamByName(name) {
    const wanted = normalize(name);
    return teams.find(team => teamAliases(team).some(alias => normalize(alias) === wanted)) || null;
  }

  function lookupLogoMap(name) {
    const map = window.logos || {};
    if (!name || !map) return '';
    if (map[name]) return map[name];
    if (map[String(name).toUpperCase()]) return map[String(name).toUpperCase()];
    const key = Object.keys(map).find(candidate => normalize(candidate) === normalize(name));
    return key ? map[key] : '';
  }

  function resolveLogo(teamName) {
    const team = teamByName(teamName);
    if (team?.logo) return team.logo;

    for (const candidate of team ? teamAliases(team) : [teamName]) {
      const sheetLogo = ewcLogoMap[normalize(candidate)];
      if (sheetLogo) return sheetLogo;
      try {
        if (typeof window.getTeamLogoSafe === 'function') {
          const value = window.getTeamLogoSafe(candidate);
          if (value && value !== 'escudo.webp') return value;
        }
      } catch (error) {}
      const direct = lookupLogoMap(candidate);
      if (direct) return direct;
    }
    return 'escudo.webp';
  }

  function resolveTeamFlag(teamName) {
    const team = teamByName(teamName);
    return team?.countryFlag ? `${BASE}${team.countryFlag}` : '';
  }

  function teamAbbreviation(teamName) {
    const team = teamByName(teamName);
    const survivalSlot = String(teamName || '').match(/^REPESCAGEM\s*#\s*(\d+)$/i);
    if (survivalSlot) return `REP #${survivalSlot[1]}`;
    return team?.abbreviation || String(teamName || '').slice(0, 4).toUpperCase();
  }

  function teamDisplayName(teamName) {
    return teamByName(teamName)?.name || teamName;
  }

  function parseDelimited(text) {
    const source = String(text || '').replace(/^\uFEFF/, '');
    const firstLine = source.split(/\r?\n/, 1)[0] || '';
    const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      if (char === '"') {
        if (quoted && source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = !quoted;
        continue;
      }
      if (!quoted && char === delimiter) {
        row.push(cell); cell = ''; continue;
      }
      if (!quoted && (char === '\n' || char === '\r')) {
        if (char === '\r' && source[index + 1] === '\n') index += 1;
        row.push(cell);
        if (row.some(value => String(value || '').trim())) rows.push(row);
        row = []; cell = ''; continue;
      }
      cell += char;
    }
    row.push(cell);
    if (row.some(value => String(value || '').trim())) rows.push(row);
    return rows;
  }

  function parseLogosSheet(text) {
    const rows = parseDelimited(text);
    if (rows.length < 2) return {};
    const headers = rows[0].map(normalize);
    const indexOf = aliases => headers.findIndex(header => aliases.some(alias => header === normalize(alias)));
    const teamIndex = indexOf(['equipe', 'time', 'team']);
    const abbreviationIndex = indexOf(['abreviação', 'abreviacao', 'sigla', 'abbr']);
    const logoIndex = indexOf(['logo', 'link da logo', 'url da logo', 'url', 'link']);
    const map = {};
    rows.slice(1).forEach(values => {
      const logo = String(values[logoIndex] || '').trim();
      if (!logo) return;
      const name = String(values[teamIndex] || '').trim();
      const abbreviation = String(values[abbreviationIndex] || '').trim();
      if (name) map[normalize(name)] = logo;
      if (abbreviation) map[normalize(abbreviation)] = logo;
    });
    return map;
  }

  function logoCacheKey() {
    return `cff:ewc2026:logos:${String(CONFIG.teamLogosTsvUrl || '')}`;
  }

  function readLogoCache() {
    try {
      const saved = JSON.parse(localStorage.getItem(logoCacheKey()) || 'null');
      const ttl = Math.max(1, Number(CONFIG.logoCacheMinutes) || 30) * 60000;
      return saved && Date.now() - Number(saved.savedAt || 0) <= ttl ? String(saved.text || '') : '';
    } catch (error) {
      return '';
    }
  }

  async function refreshLogoData(force) {
    if (!CONFIG.teamLogosTsvUrl) return false;
    let text = !force ? readLogoCache() : '';
    if (!text) {
      const separator = CONFIG.teamLogosTsvUrl.includes('?') ? '&' : '?';
      const response = await fetch(`${CONFIG.teamLogosTsvUrl}${separator}_cff=${Math.floor(Date.now() / 1800000)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
      try { localStorage.setItem(logoCacheKey(), JSON.stringify({ savedAt: Date.now(), text })); } catch (error) {}
    }
    const parsed = parseLogosSheet(text);
    if (!Object.keys(parsed).length) return false;
    ewcLogoMap = parsed;
    renderActivePage();
    return true;
  }

  async function loadData() {
    if (loaded) return true;
    if (loadPromise) return loadPromise;

    loadPromise = Promise.all([
      json(`${BASE}times.json`),
      json(CONFIG.groupJsonUrl || `${BASE}classificacao.json`).catch(() => ({ rows: [], groups: {} })),
      json(CONFIG.survivalJsonUrl || `${BASE}repescagem.json`).catch(() => ({ rows: [], teams: [] })),
      json(CONFIG.finalJsonUrl || `${BASE}final.json`).catch(() => ({ rows: [], teams: [] })),
      json(CONFIG.killsJsonUrl || `${BASE}abates.json`).catch(() => ({ players: [] }))
    ]).then(([teamsPayload, groupsPayload, survivalPayload, finalPayload, killsPayload]) => {
      teams = Array.isArray(teamsPayload.teams) ? teamsPayload.teams : [];
      groupData = groupsPayload || { rows: [], groups: {} };
      survivalData = survivalPayload || { rows: [], teams: [] };
      finalData = finalPayload || { rows: [], teams: [] };
      kills = Array.isArray(killsPayload.players) ? killsPayload.players : [];
      loaded = true;
      patchGlobalSearch();
      refreshLogoData(false).catch(() => {});
      return true;
    }).finally(() => { loadPromise = null; });

    return loadPromise;
  }

  function playerByName(name) {
    const target = normalize(name);
    for (const team of teams) {
      const person = (team.players || []).find(item => normalize(item.name) === target);
      if (person) return { ...person, team: team.name, qualification: team.qualification };
    }
    return null;
  }

  function standingForTeam(teamName) {
    return (groupData.rows || []).find(row => teamByName(row.team) === teamByName(teamName)) || null;
  }

  function killsForPlayer(playerName) {
    return kills.find(row => normalize(row.name) === normalize(playerName)) || null;
  }

  function hero(title, subtitle) {
    return `<div class="ewc-hero">
      <div class="ewc-hero-main">
        <div class="ewc-hero-icon" aria-hidden="true">🏆</div>
        <div><div class="ewc-kicker">Esports World Cup 2026</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle || '')}</p></div>
      </div>
      <div class="ewc-hero-badges"><span>24 equipes</span><span>15 a 18 de julho</span><span>2 grupos</span></div>
    </div>`;
  }

  function statusType(row) {
    const explicit = normalize(row.statusCode || '');
    if (explicit === 'FINAL' || explicit === 'SURVIVAL' || explicit === 'ELIMINATED') return explicit.toLowerCase();
    const status = normalize(row.status || '');
    if (status.includes('FINAL')) return 'final';
    if (status.includes('REPESC') || status.includes('SURVIVAL')) return 'survival';
    if (status.includes('ELIMIN')) return 'eliminated';
    return 'neutral';
  }

  function tableStatus(row) {
    const status = String(row.status || '').trim();
    if (!status) return '—';
    const type = statusType(row);
    const short = type === 'survival' ? 'REP.' : (type === 'eliminated' ? 'ELIM.' : 'FINAL');
    return `<span class="ewc-status-badge ${type}"><span class="ewc-status-full">${escapeHtml(status)}</span><span class="ewc-status-short">${escapeHtml(short)}</span></span>`;
  }

  function teamCell(teamName) {
    const team = teamByName(teamName);
    const flag = resolveTeamFlag(teamName);
    const full = teamDisplayName(teamName);
    const short = teamAbbreviation(teamName);
    return `<td class="ewc-team-cell">
      <span class="ewc-team-visuals">
        ${flag ? `<img class="ewc-team-country" src="${escapeHtml(flag)}" alt="${escapeHtml(team?.countryName || '')}" title="${escapeHtml(team?.countryName || '')}" onerror="this.style.display='none'">` : '<span class="ewc-team-country-placeholder" aria-hidden="true"></span>'}
        <img class="ewc-team-logo" src="${escapeHtml(resolveLogo(teamName))}" alt="${escapeHtml(full)}" onerror="this.onerror=null;this.src='escudo.webp'">
      </span>
      <span class="ewc-team-name-full">${escapeHtml(full)}</span>
      <span class="ewc-team-name-short">${escapeHtml(short)}</span>
    </td>`;
  }

  function metric(value, hasMatches) {
    return hasMatches ? String(Number(value) || 0) : '—';
  }

  function allStageMatches(payload) {
    const stageTeams = Array.isArray(payload?.teams) ? payload.teams : [];
    return stageTeams.flatMap(team => Array.isArray(team.matches) ? team.matches : []);
  }

  function filterMatches(matches, selected) {
    return (matches || []).filter(match => {
      if (selected.day !== 'all' && String(match.day) !== String(selected.day)) return false;
      if (selected.drop !== 'all' && String(match.number) !== String(selected.drop)) return false;
      return true;
    });
  }

  function aggregateMatches(matches) {
    return (matches || []).reduce((result, match) => {
      result.matches += 1;
      result.booyahs += match.booyah ? 1 : 0;
      result.kills += Number(match.kills) || 0;
      result.placementPoints += Number(match.placementPoints) || 0;
      result.points += Number(match.points) || 0;
      return result;
    }, { matches: 0, booyahs: 0, kills: 0, placementPoints: 0, points: 0 });
  }

  function sortRows(rows) {
    return rows.sort((a, b) => Number(b.points) - Number(a.points)
      || Number(b.booyahs) - Number(a.booyahs)
      || Number(b.kills) - Number(a.kills)
      || Number(a.basePosition || 999) - Number(b.basePosition || 999));
  }

  function groupRows(groupName) {
    const group = groupData.groups?.[groupName] || {};
    const selected = filters.groups;
    const statusRows = (groupData.rows || []).filter(row => String(row.group) === String(groupName));
    const rows = (group.teams || []).map(entry => {
      const base = statusRows.find(row => teamByName(row.team) === teamByName(entry.team)) || {};
      const totals = aggregateMatches(filterMatches(entry.matches, selected));
      return { ...totals, team: entry.team, group: groupName, status: base.status, statusCode: base.statusCode, basePosition: base.position };
    });
    sortRows(rows);
    rows.forEach((row, index) => { row.position = index + 1; });
    return rows;
  }

  function stageRows(payload, filterKey) {
    const selected = filters[filterKey];
    const baseRows = Array.isArray(payload?.rows) ? payload.rows : [];
    const entries = Array.isArray(payload?.teams) ? payload.teams : [];
    const rows = (entries.length ? entries : baseRows.map(row => ({ team: row.team, sourceGroup: row.group, sourcePosition: row.sourcePosition, matches: [] }))).map((entry, index) => {
      const base = baseRows.find(row => teamByName(row.team) === teamByName(entry.team)) || {};
      const totals = aggregateMatches(filterMatches(entry.matches, selected));
      return {
        ...totals,
        team: entry.team,
        group: entry.sourceGroup || base.group || '',
        sourcePosition: entry.sourcePosition || base.sourcePosition || '',
        basePosition: base.position || index + 1
      };
    });
    const hasMatches = rows.some(row => row.matches > 0);
    if (hasMatches) sortRows(rows);
    else rows.sort((a, b) => Number(a.basePosition) - Number(b.basePosition));
    rows.forEach((row, index) => { row.position = index + 1; });
    return rows;
  }

  function filterOptions(payload, filterKey, groupMode) {
    let matches = [];
    if (groupMode) {
      const firstGroup = Object.values(groupData.groups || {})[0] || {};
      matches = (firstGroup.teams || []).flatMap(team => team.matches || []);
    } else matches = allStageMatches(payload);

    const days = [...new Set(matches.map(match => Number(match.day)).filter(Boolean))].sort((a, b) => a - b);
    const selected = filters[filterKey];
    const drops = [...new Set(matches
      .filter(match => selected.day === 'all' || String(match.day) === String(selected.day))
      .map(match => Number(match.number)).filter(Boolean))].sort((a, b) => a - b);
    return { days, drops };
  }

  function filtersMarkup(payload, filterKey, groupMode) {
    const options = filterOptions(payload, filterKey, groupMode);
    const selected = filters[filterKey];
    return `<div class="filters ewc-live-filters">
      <label><span>Dia:</span>
        <select onchange="setEWCDayFilter('${filterKey}', this.value)">
          <option value="all"${selected.day === 'all' ? ' selected' : ''}>Geral</option>
          ${options.days.map(day => `<option value="${day}"${String(selected.day) === String(day) ? ' selected' : ''}>Dia ${day}</option>`).join('')}
        </select>
      </label>
      <label><span>Queda:</span>
        <select onchange="setEWCDropFilter('${filterKey}', this.value)"${options.drops.length ? '' : ' disabled'}>
          <option value="all"${selected.drop === 'all' ? ' selected' : ''}>Todas as quedas</option>
          ${options.drops.map(drop => `<option value="${drop}"${String(selected.drop) === String(drop) ? ' selected' : ''}>Queda ${drop}</option>`).join('')}
        </select>
      </label>
    </div>`;
  }

  function filterSummary(payload, filterKey, groupMode) {
    const selected = filters[filterKey];
    if (selected.drop !== 'all') {
      let matches = groupMode
        ? Object.values(groupData.groups || {})[0]?.teams?.flatMap(team => team.matches || []) || []
        : allStageMatches(payload);
      const match = matches.find(item => String(item.number) === String(selected.drop));
      return `Queda ${selected.drop}${match?.map ? ` • ${match.map}` : ''}`;
    }
    if (selected.day !== 'all') return `Dia ${selected.day}`;
    return 'Classificação geral';
  }

  function standingsTable(rows, options) {
    const settings = Object.assign({ status: false, origin: false, rowClass: null }, options || {});
    return `<div class="table-container ewc-table-wrap"><table class="ewc-table">
      <thead><tr>
        <th>#</th>
        <th><span class="desktop-label">Equipe</span><span class="mobile-label">Eqp</span></th>
        ${settings.origin ? '<th class="ewc-hide-mobile">Origem</th>' : ''}
        <th>PTS</th><th>B!</th><th>K</th><th class="ewc-hide-mobile">PP</th><th class="ewc-hide-mobile">Q</th>
        ${settings.status ? '<th>Status</th>' : ''}
      </tr></thead>
      <tbody>${rows.map(row => {
        const hasMatches = Number(row.matches) > 0;
        const knownTeam = Boolean(teamByName(row.team));
        const type = typeof settings.rowClass === 'function' ? settings.rowClass(row) : (settings.status ? statusType(row) : '');
        const rowClass = type ? `ewc-row-${type}` : '';
        const clickAttrs = knownTeam ? `data-clickable="true" onclick="openEWCTeamProfile(${jsString(row.team)})"` : 'data-placeholder="true"';
        return `<tr class="${rowClass}" ${clickAttrs}>
          <td class="ewc-rank">${Number(row.position) || '—'}</td>
          ${teamCell(row.team)}
          ${settings.origin ? `<td class="ewc-hide-mobile">Grupo ${escapeHtml(row.group || '—')}</td>` : ''}
          <td>${metric(row.points, hasMatches)}</td><td>${metric(row.booyahs, hasMatches)}</td><td>${metric(row.kills, hasMatches)}</td>
          <td class="ewc-hide-mobile">${metric(row.placementPoints, hasMatches)}</td><td class="ewc-hide-mobile">${metric(row.matches, hasMatches)}</td>
          ${settings.status ? `<td>${tableStatus(row)}</td>` : ''}
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }

  function renderGroups() {
    const root = document.getElementById('ewc-grupos-content');
    if (!root) return;
    const groupNames = Object.keys(groupData.groups || {}).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!groupNames.includes(activeGroup)) activeGroup = groupNames[0] || 'A';
    const rows = groupRows(activeGroup);
    root.innerHTML = `<div class="ewc-shell">
      ${hero('Fase de grupos', 'Grupos A e B • 12 quedas por grupo')}
      <div class="ewc-stage-tabs" role="tablist" aria-label="Grupos da EWC 2026">
        ${groupNames.map(groupName => `<button type="button" role="tab" aria-selected="${groupName === activeGroup ? 'true' : 'false'}" class="ewc-stage-tab${groupName === activeGroup ? ' active' : ''}" onclick="setEWCGroupTab('${escapeHtml(groupName)}')">GRUPO ${escapeHtml(groupName)}</button>`).join('')}
      </div>
      ${filtersMarkup(groupData, 'groups', true)}
      <div class="ewc-filter-summary">${escapeHtml(filterSummary(groupData, 'groups', true))}</div>
      <div class="ewc-stage-legend"><span class="final">Final • 1º ao 4º</span><span class="survival">Repescagem • 5º ao 10º</span><span class="eliminated">Eliminado • 11º e 12º</span></div>
      <section class="ewc-panel"><div class="ewc-panel-inner">
        <div class="ewc-section-head"><div><h2>Grupo ${escapeHtml(activeGroup)}</h2><p>Os quatro melhores avançaram diretamente para a Final.</p></div><span class="ewc-updated">${rows.length} equipes</span></div>
        ${standingsTable(rows, { rowClass: row => Number(row.position) <= 4 ? 'final' : (Number(row.position) <= 10 ? 'survival' : 'eliminated') })}
      </div></section>
    </div>`;
  }

  function renderStage(rootId, payload, filterKey, title, subtitle) {
    const root = document.getElementById(rootId);
    if (!root) return;
    const rows = stageRows(payload, filterKey);
    const count = rows.length;
    const isSurvival = filterKey === 'survival';
    const legend = isSurvival
      ? '<div class="ewc-stage-legend"><span class="final">Final • 1º ao 4º</span><span class="eliminated">Eliminado • 5º ao 12º</span></div>'
      : '';
    root.innerHTML = `<div class="ewc-shell">
      ${hero(title, subtitle)}
      ${filtersMarkup(payload, filterKey, false)}
      <div class="ewc-filter-summary">${escapeHtml(filterSummary(payload, filterKey, false))}</div>
      ${legend}
      <section class="ewc-panel"><div class="ewc-panel-inner">
        <div class="ewc-section-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(payload.description || 'Equipes confirmadas para esta etapa.')}</p></div><span class="ewc-updated">${count} equipes</span></div>
        ${standingsTable(rows, { rowClass: isSurvival ? row => Number(row.position) <= 4 ? 'final' : 'eliminated' : null })}
      </div></section>
    </div>`;
  }

  function statsContexts() {
    return [
      { key: 'group-a', stage: 'groups', confrontation: 'group-a', label: 'Grupo A', teams: groupData.groups?.A?.teams || [] },
      { key: 'group-b', stage: 'groups', confrontation: 'group-b', label: 'Grupo B', teams: groupData.groups?.B?.teams || [] },
      { key: 'survival', stage: 'survival', confrontation: 'survival', label: 'Repescagem', teams: survivalData.teams || [] },
      { key: 'final', stage: 'final', confrontation: 'final', label: 'Final', teams: finalData.teams || [] }
    ];
  }

  function selectedStatsContexts(filterState) {
    const current = filterState || statsFilters;
    return statsContexts().filter(context => {
      const stageOk = current.stage === 'general' || context.stage === current.stage;
      const confrontationOk = current.confrontation === 'all' || context.confrontation === current.confrontation;
      return stageOk && confrontationOk;
    });
  }

  function statsFilterOptions(filterState) {
    const current = filterState || statsFilters;
    const matches = selectedStatsContexts(current).flatMap(context => (context.teams || []).flatMap(team => team.matches || []));
    const days = [...new Set(matches.map(match => Number(match.day)).filter(Boolean))].sort((a, b) => a - b);
    const maps = [...new Set(matches.map(match => String(match.map || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (current.day !== 'all' && !days.some(day => String(day) === String(current.day))) current.day = 'all';
    if (current.map !== 'all' && !maps.includes(current.map)) current.map = 'all';
    return { days, maps };
  }

  function statsStageOptions(current) {
    return `<option value="groups"${current.stage === 'groups' ? ' selected' : ''}>Fase de grupos</option>
      <option value="survival"${current.stage === 'survival' ? ' selected' : ''}>Repescagem</option>
      <option value="final"${current.stage === 'final' ? ' selected' : ''}>Final</option>
      <option value="general"${current.stage === 'general' ? ' selected' : ''}>Geral</option>`;
  }

  function statsConfrontationOptions(current) {
    return `<option value="all"${current.confrontation === 'all' ? ' selected' : ''}>Geral</option>
      <option value="group-a"${current.confrontation === 'group-a' ? ' selected' : ''}>Grupo A</option>
      <option value="group-b"${current.confrontation === 'group-b' ? ' selected' : ''}>Grupo B</option>
      <option value="survival"${current.confrontation === 'survival' ? ' selected' : ''}>Repescagem</option>
      <option value="final"${current.confrontation === 'final' ? ' selected' : ''}>Final</option>`;
  }

  function statsFiltersMarkup() {
    const options = statsFilterOptions(statsFilters);
    return `<div class="filters ewc-live-filters ewc-stats-filters">
      <label><span>Etapa:</span>
        <select onchange="setEWCStatsFilter('stage', this.value)">${statsStageOptions(statsFilters)}</select>
      </label>
      <label><span>Dias:</span>
        <select onchange="setEWCStatsFilter('day', this.value)">
          <option value="all"${statsFilters.day === 'all' ? ' selected' : ''}>Todos os dias</option>
          ${options.days.map(day => `<option value="${day}"${String(statsFilters.day) === String(day) ? ' selected' : ''}>Dia ${day}</option>`).join('')}
        </select>
      </label>
      <label><span>Confrontos:</span>
        <select onchange="setEWCStatsFilter('confrontation', this.value)">${statsConfrontationOptions(statsFilters)}</select>
      </label>
      <label><span>Mapas:</span>
        <select onchange="setEWCStatsFilter('map', this.value)">
          <option value="all"${statsFilters.map === 'all' ? ' selected' : ''}>Todos os mapas</option>
          ${options.maps.map(map => `<option value="${escapeHtml(map)}"${statsFilters.map === map ? ' selected' : ''}>${escapeHtml(map)}</option>`).join('')}
        </select>
      </label>
    </div>`;
  }

  function rankingFiltersMarkup(type) {
    const current = statsRankingFilters[type];
    const options = statsFilterOptions(current);
    const isTotal = type === 'total';
    return `<div class="filters ewc-live-filters ewc-ranking-filters">
      <label><span>Etapa:</span>
        <select onchange="setEWCRankingFilter('${type}', 'stage', this.value)">${statsStageOptions(current)}</select>
      </label>
      <label><span>Dias:</span>
        <select onchange="setEWCRankingFilter('${type}', 'day', this.value)">
          <option value="all"${current.day === 'all' ? ' selected' : ''}>Todos os dias</option>
          ${options.days.map(day => `<option value="${day}"${String(current.day) === String(day) ? ' selected' : ''}>Dia ${day}</option>`).join('')}
        </select>
      </label>
      ${isTotal ? `<label><span>Exibição:</span><select onchange="setEWCTotalMode(this.value)"><option value="total"${current.totalMode === 'total' ? ' selected' : ''}>TOTAL</option><option value="day-average"${current.totalMode === 'day-average' ? ' selected' : ''}>MÉDIA POR DIA</option></select></label>` : ''}
      <label><span>Confrontos:</span>
        <select onchange="setEWCRankingFilter('${type}', 'confrontation', this.value)">${statsConfrontationOptions(current)}</select>
      </label>
      <label><span>Mapas:</span>
        <select onchange="setEWCRankingFilter('${type}', 'map', this.value)">
          <option value="all"${current.map === 'all' ? ' selected' : ''}>Todos os mapas</option>
          ${options.maps.map(map => `<option value="${escapeHtml(map)}"${current.map === map ? ' selected' : ''}>${escapeHtml(map)}</option>`).join('')}
        </select>
      </label>
    </div>`;
  }

  function aggregateStatsTeams(filterState) {
    const current = filterState || statsFilters;
    const aggregated = new Map();
    selectedStatsContexts(current).forEach(context => {
      (context.teams || []).forEach(entry => {
        const name = entry.team;
        const team = teamByName(name);
        if (!name || !team) return;
        const canonicalName = team.name;
        const canonicalKey = normalize(canonicalName);
        if (!aggregated.has(canonicalKey)) {
          aggregated.set(canonicalKey, {
            team: canonicalName, matches: 0, points: 0, kills: 0, booyahs: 0,
            placementPoints: 0, placementSum: 0, top3: 0, last: 0, days: new Set()
          });
        }
        const row = aggregated.get(canonicalKey);
        (entry.matches || []).forEach(match => {
          if (current.day !== 'all' && String(match.day) !== String(current.day)) return;
          if (current.map !== 'all' && String(match.map || '') !== String(current.map)) return;
          row.matches += 1;
          row.points += Number(match.points) || 0;
          row.kills += Number(match.kills) || 0;
          row.booyahs += match.booyah ? 1 : 0;
          row.placementPoints += Number(match.placementPoints) || 0;
          row.placementSum += Number(match.placement) || 0;
          if (Number(match.placement) <= 3) row.top3 += 1;
          if (Number(match.placement) === 12) row.last += 1;
          row.days.add(String(match.date || `${context.key}-dia-${match.day || 0}`));
        });
      });
    });

    return [...aggregated.values()].filter(row => row.matches > 0).map(row => ({
      ...row,
      dayCount: Math.max(1, row.days.size),
      avgPoints: row.points / row.matches,
      avgKills: row.kills / row.matches,
      avgPlacement: row.placementSum / row.matches,
      top3Rate: row.top3 / row.matches * 100
    }));
  }

  function formatDecimal(value, digits) {
    return Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function statsCard(label, value, detail) {
    return `<article class="ewc-stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</article>`;
  }

  function statsTeamIdentity(teamName) {
    const team = teamByName(teamName);
    const flag = resolveTeamFlag(teamName);
    const full = teamDisplayName(teamName);
    const short = teamAbbreviation(teamName);
    return `<button type="button" class="ewc-leader-team" onclick="openEWCTeamProfile(${jsString(teamName)})" title="${escapeHtml(full)}">
      <span class="ewc-leader-visuals">
        ${flag ? `<img class="ewc-leader-flag" src="${escapeHtml(flag)}" alt="${escapeHtml(team?.countryName || '')}" onerror="this.style.display='none'">` : '<span class="ewc-leader-flag-placeholder" aria-hidden="true"></span>'}
        <img class="ewc-leader-logo" src="${escapeHtml(resolveLogo(teamName))}" alt="" onerror="this.onerror=null;this.src='escudo.webp'">
      </span>
      <span class="ewc-leader-name-full">${escapeHtml(full)}</span>
      <span class="ewc-leader-name-short">${escapeHtml(short)}</span>
    </button>`;
  }

  function statsLeaderboardCard(id, title, rows, metric, formatter, valueLabel, options) {
    const settings = Object.assign({ ascending: false, detail: null }, options || {});
    const sorted = [...rows].sort((a, b) => {
      const difference = Number(metric(a) || 0) - Number(metric(b) || 0);
      if (difference) return settings.ascending ? difference : -difference;
      return Number(b.points || 0) - Number(a.points || 0) || Number(b.kills || 0) - Number(a.kills || 0);
    });
    const pageSize = 4;
    const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
    let page = Math.max(0, Math.min(pageCount - 1, Number(statsCardPages[id]) || 0));
    statsCardPages[id] = page;
    const start = page * pageSize;
    const visible = sorted.slice(start, start + pageSize);
    const rowsHtml = visible.length ? visible.map((row, offset) => {
      const rank = start + offset + 1;
      const detail = typeof settings.detail === 'function' ? settings.detail(row) : '';
      return `<div class="ewc-leader-row rank-${Math.min(rank, 4)}">
        <span class="ewc-leader-rank">${rank}º</span>
        ${statsTeamIdentity(row.team)}
        <span class="ewc-leader-value"><strong>${escapeHtml(formatter(metric(row), row))}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}</span>
      </div>`;
    }).join('') : '<div class="ewc-leader-empty">Sem resultados neste recorte.</div>';
    const pagination = sorted.length > pageSize ? `<div class="ewc-leader-pagination">
      <button type="button" ${page === 0 ? 'disabled' : ''} onclick="setEWCStatsCardPage('${id}', -1)" aria-label="Página anterior">‹</button>
      <span>Top ${start + 1}–${Math.min(start + pageSize, sorted.length)}</span>
      <button type="button" ${page >= pageCount - 1 ? 'disabled' : ''} onclick="setEWCStatsCardPage('${id}', 1)" aria-label="Próxima página">›</button>
    </div>` : '';
    return `<article class="ewc-leader-card">
      <div class="ewc-leader-card-border"></div>
      <h3>${escapeHtml(title)}</h3>
      <div class="ewc-leader-columns"><span>Equipe</span><span>${escapeHtml(valueLabel)}</span></div>
      <div class="ewc-leader-list">${rowsHtml}</div>
      ${pagination}
    </article>`;
  }

  function statsLeaderSections(rows) {
    const integer = value => Math.round(Number(value || 0)).toLocaleString('pt-BR');
    const oneDecimal = value => formatDecimal(value, 1);
    return `<section class="ewc-leader-section">
      <h2>Totais por equipe</h2>
      <div class="ewc-leader-grid">
        ${statsLeaderboardCard('points', 'Top Pontos', rows, row => row.points, integer, 'PTS')}
        ${statsLeaderboardCard('kills', 'Top Abates', rows, row => row.kills, integer, 'KILLS')}
        ${statsLeaderboardCard('booyahs', 'Top Booyahs', rows, row => row.booyahs, integer, 'B!')}
      </div>
    </section>
    <section class="ewc-leader-section">
      <h2>Médias por equipe</h2>
      <div class="ewc-leader-grid">
        ${statsLeaderboardCard('avg-points', 'Média de Pontos', rows, row => row.avgPoints, oneDecimal, 'MÉDIA')}
        ${statsLeaderboardCard('avg-kills', 'Média de Abates', rows, row => row.avgKills, oneDecimal, 'MÉDIA')}
        ${statsLeaderboardCard('avg-placement', 'Colocação Média', rows, row => row.avgPlacement, value => `${oneDecimal(value)}º`, 'POS', { ascending: true })}
      </div>
    </section>
    <section class="ewc-leader-section">
      <h2>Top 3 e último lugar por equipe <small>(número de quedas ao lado)</small></h2>
      <div class="ewc-leader-grid">
        ${statsLeaderboardCard('top3-count', '+ Vezes no Top 3', rows, row => row.top3, integer, 'TOP 3', { detail: row => `${row.matches} Q` })}
        ${statsLeaderboardCard('top3-rate', 'Maior Média de Top 3', rows, row => row.top3Rate, value => `${oneDecimal(value)}%`, '% TOP 3', { detail: row => `${row.top3}x` })}
        ${statsLeaderboardCard('last-count', '+ Vezes em Último (12º)', rows, row => row.last, integer, '12º', { detail: row => `${row.matches} Q` })}
      </div>
    </section>`;
  }

  function averageRankingTable(rows) {
    const sorted = [...rows].sort((a, b) => b.avgPoints - a.avgPoints || b.avgKills - a.avgKills || a.avgPlacement - b.avgPlacement);
    const visible = statsExpanded.avg ? sorted : sorted.slice(0, 6);
    if (!sorted.length) return '<div class="ewc-empty">Ainda não há resultados para estes filtros.</div>';
    return `<div class="table-container ewc-table-wrap"><table class="ewc-table ewc-stats-ranking-table">
      <thead><tr><th>#</th><th><span class="desktop-label">Equipe</span><span class="mobile-label">E</span></th><th>PTS</th><th>KILLS</th><th>POS</th><th class="ewc-hide-mobile">Q</th></tr></thead>
      <tbody>${visible.map((row, index) => `<tr data-clickable="true" onclick="openEWCTeamProfile(${jsString(row.team)})"><td class="ewc-rank">${index + 1}º</td>${teamCell(row.team)}<td class="ewc-stat-primary">${formatDecimal(row.avgPoints, 1)}</td><td>${formatDecimal(row.avgKills, 1)}</td><td>${formatDecimal(row.avgPlacement, 1)}º</td><td class="ewc-hide-mobile">${row.matches}</td></tr>`).join('')}</tbody>
    </table></div>${sorted.length > 6 ? `<button type="button" class="ewc-expand-button" onclick="toggleEWCStatsRanking('avg')">${statsExpanded.avg ? 'Ocultar' : 'Ver mais'}</button>` : ''}`;
  }

  function totalRankingTable(rows) {
    const mode = statsRankingFilters.total.totalMode;
    const ranked = rows.map(row => ({
      ...row,
      displayPoints: mode === 'day-average' ? row.points / row.dayCount : row.points,
      displayBooyahs: mode === 'day-average' ? row.booyahs / row.dayCount : row.booyahs,
      displayKills: mode === 'day-average' ? row.kills / row.dayCount : row.kills
    })).sort((a, b) => b.displayPoints - a.displayPoints || b.displayKills - a.displayKills || b.points - a.points);
    const visible = statsExpanded.total ? ranked : ranked.slice(0, 6);
    if (!ranked.length) return '<div class="ewc-empty">Ainda não há resultados para estes filtros.</div>';
    const format = value => mode === 'day-average' ? formatDecimal(value, 1) : String(Math.round(value));
    return `<div class="table-container ewc-table-wrap"><table class="ewc-table ewc-stats-ranking-table">
      <thead><tr><th>#</th><th><span class="desktop-label">Equipe</span><span class="mobile-label">E</span></th><th>${mode === 'day-average' ? 'PTS/DIA' : 'PTS'}</th><th>${mode === 'day-average' ? 'B!/DIA' : 'BOOYAH'}</th><th>${mode === 'day-average' ? 'K/DIA' : 'KILLS'}</th></tr></thead>
      <tbody>${visible.map((row, index) => `<tr data-clickable="true" onclick="openEWCTeamProfile(${jsString(row.team)})"><td class="ewc-rank">${index + 1}º</td>${teamCell(row.team)}<td class="ewc-stat-primary">${format(row.displayPoints)}</td><td>${format(row.displayBooyahs)}</td><td>${format(row.displayKills)}</td></tr>`).join('')}</tbody>
    </table></div>${ranked.length > 6 ? `<button type="button" class="ewc-expand-button" onclick="toggleEWCStatsRanking('total')">${statsExpanded.total ? 'Ocultar' : 'Ver mais'}</button>` : ''}`;
  }

  function renderStats() {
    const root = document.getElementById('ewc-stats-content');
    if (!root) return;
    const rows = aggregateStatsTeams(statsFilters);
    const averageRows = aggregateStatsTeams(statsRankingFilters.avg);
    const totalRows = aggregateStatsTeams(statsRankingFilters.total);
    const totals = rows.reduce((acc, row) => {
      acc.points += row.points;
      acc.kills += row.kills;
      acc.booyahs += row.booyahs;
      acc.matches += row.matches;
      acc.placementSum += row.placementSum;
      return acc;
    }, { points: 0, kills: 0, booyahs: 0, matches: 0, placementSum: 0 });
    const teamCount = rows.length;

    root.innerHTML = `<div class="ewc-shell">
      ${hero('Estatísticas gerais', 'Melhores equipes e rankings coletivos da EWC 2026')}
      <section class="ewc-stats-filter-section">
        <h2>Filtros dos destaques</h2>
        ${statsFiltersMarkup()}
      </section>
      ${rows.length ? `${statsLeaderSections(rows)}
        <section class="ewc-stats-section ewc-summary-section"><h2>Resumo geral do recorte</h2><div class="ewc-stat-cards">
          ${statsCard('Total de pontos', totals.points.toLocaleString('pt-BR'))}
          ${statsCard('Total de abates', totals.kills.toLocaleString('pt-BR'))}
          ${statsCard('Total de booyahs', totals.booyahs.toLocaleString('pt-BR'))}
          ${statsCard('Pontos por equipe', formatDecimal(teamCount ? totals.points / teamCount : 0, 1), `${teamCount} equipes`)}
          ${statsCard('Abates por equipe', formatDecimal(teamCount ? totals.kills / teamCount : 0, 1), `${teamCount} equipes`)}
          ${statsCard('Colocação média', `${formatDecimal(totals.matches ? totals.placementSum / totals.matches : 0, 1)}º`, `${totals.matches} quedas de equipe`)}
        </div></section>` : '<div class="ewc-empty">Ainda não há resultados para esta combinação de filtros.</div>'}
      <section class="ewc-panel ewc-ranking-section"><div class="ewc-panel-inner">
        <div class="ewc-ranking-head"><div><h2>Ranking de Médias <small>(por queda)</small></h2><p>PTS, kills e colocação média de cada equipe.</p></div></div>
        ${rankingFiltersMarkup('avg')}
        ${averageRankingTable(averageRows)}
      </div></section>
      <section class="ewc-panel ewc-ranking-section"><div class="ewc-panel-inner">
        <div class="ewc-ranking-head"><div><h2>Ranking de Totais <small>(acumulado)</small></h2><p>Pontuação, booyahs e kills no recorte selecionado.</p></div></div>
        ${rankingFiltersMarkup('total')}
        ${totalRankingTable(totalRows)}
      </div></section>
    </div>`;
  }

  function comingSoon(rootId, title, subtitle) {
    const root = document.getElementById(rootId);
    if (!root) return;
    root.innerHTML = `<div class="ewc-shell">
      ${hero(title, subtitle)}
      <section class="ewc-panel"><div class="ewc-coming-soon"><span>EM BREVE</span><strong>${escapeHtml(title)}</strong><p>Esta página será liberada durante a EWC 2026.</p></div></section>
    </div>`;
  }

  function personButton(person) {
    const click = person.staff ? '' : `onclick="openEWCPlayerProfile(${jsString(person.name)})"`;
    return `<button type="button" class="ewc-person${person.staff ? ' staff' : ''}" ${click}>${flagMarkup(person.country)}<span class="ewc-person-name">${escapeHtml(person.name)}</span>${roleMarkup(person)}</button>`;
  }

  function participantCard(team) {
    const players = (team.players || []).filter(person => !person.staff);
    const staff = (team.players || []).filter(person => person.staff);
    const countryFlag = team.countryFlag ? `${BASE}${team.countryFlag}` : '';
    return `<article class="ewc-participant-card">
      <button type="button" class="ewc-participant-head" onclick="openEWCTeamProfile(${jsString(team.name)})">
        <span class="ewc-participant-logo"><img src="${escapeHtml(resolveLogo(team.name))}" alt="${escapeHtml(team.name)}" onerror="this.onerror=null;this.src='escudo.webp'"></span>
        <span class="ewc-participant-title"><strong>${escapeHtml(team.name)}</strong><small>${countryFlag ? `<img class="ewc-card-country" src="${escapeHtml(countryFlag)}" alt="">` : ''}${escapeHtml(`${team.countryName ? `${team.countryName} • ` : ''}${team.group ? `Grupo ${team.group} • ` : ''}${team.qualification || 'A confirmar'}`)}</small></span>
        <span class="ewc-participant-count">${players.length} J</span>
      </button>
      <div class="ewc-participant-roster">
        <div class="ewc-subhead"><span>Jogadores</span><small>${players.length}</small></div>
        <div class="ewc-people">${players.map(personButton).join('')}</div>
        ${staff.length ? `<div class="ewc-subhead staff"><span>Staff</span><small>${staff.length}</small></div><div class="ewc-people">${staff.map(personButton).join('')}</div>` : ''}
      </div>
    </article>`;
  }

  function renderTeams() {
    const root = document.getElementById('ewc-equipes-content');
    if (!root) return;
    const currentValue = document.getElementById('ewc-team-search')?.value || '';
    const query = normalize(currentValue);
    const filtered = teams.filter(team => {
      if (!query) return true;
      const people = (team.players || []).map(person => `${person.name} ${person.role}`).join(' ');
      return normalize(`${teamAliases(team).join(' ')} ${team.countryName || ''} ${team.group || ''} ${team.qualification || ''} ${people}`).includes(query);
    });

    root.innerHTML = `<div class="ewc-shell">
      ${hero('Equipes', 'Participantes confirmados na EWC 2026')}
      <section class="ewc-panel"><div class="ewc-panel-inner">
        <div class="ewc-section-head"><div><h2>Equipes participantes</h2><p>Elencos, bandeiras, posições e origem da classificação.</p></div><span class="ewc-updated">${teams.length} equipes</span></div>
        <div class="ewc-tools"><input id="ewc-team-search" class="ewc-search" type="search" placeholder="Buscar time ou jogador..." value="${escapeHtml(currentValue)}" oninput="renderEWCTeams()"></div>
        ${filtered.length ? `<div class="ewc-participants-grid">${filtered.map(participantCard).join('')}</div>` : '<div class="ewc-empty">Nenhuma equipe encontrada.</div>'}
      </div></section>
    </div>`;
  }

  function profilePersonCard(person) {
    const click = person.staff ? '' : `onclick="openEWCPlayerProfile(${jsString(person.name)})" style="cursor:pointer"`;
    return `<div class="ewc-profile-person" ${click}>${flagMarkup(person.country)}<div class="ewc-profile-copy"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role)}</small></div></div>`;
  }

  function statCard(label, value, detail) {
    return `<article class="ewc-stat-card"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong>${detail ? `<em>${escapeHtml(detail)}</em>` : ''}</article>`;
  }

  async function openTeamProfile(name) {
    await loadData();
    const team = teamByName(name);
    if (!team) return;
    if (document.querySelector('.page.active')?.id !== 'ewc-team-profile' && typeof window.navigate === 'function') window.navigate('ewc-team-profile');
    history.replaceState(null, '', `#ewc-team-${slug(team.name)}`);
    const root = document.getElementById('ewc-team-profile-content');
    if (!root) return;

    const players = (team.players || []).filter(person => !person.staff);
    const staff = (team.players || []).filter(person => person.staff);
    const current = standingForTeam(team.name);
    const countryFlag = team.countryFlag ? `${BASE}${team.countryFlag}` : '';
    root.innerHTML = `<div class="ewc-shell">
      <section class="ewc-profile-hero">
        <span class="ewc-profile-team-visual"><img class="ewc-profile-logo" src="${escapeHtml(resolveLogo(team.name))}" alt="${escapeHtml(team.name)}" onerror="this.onerror=null;this.src='escudo.webp'">${countryFlag ? `<img class="ewc-profile-country" src="${escapeHtml(countryFlag)}" alt="${escapeHtml(team.countryName || '')}">` : ''}</span>
        <div><div class="ewc-kicker">EWC 2026</div><h1>${escapeHtml(team.name)}</h1><p>${escapeHtml(`${team.countryName ? `${team.countryName} • ` : ''}${team.qualification || 'A confirmar'}`)}</p></div>
      </section>
      <section class="ewc-panel ewc-profile-section"><div class="ewc-panel-inner"><h2>Elenco</h2><div class="ewc-profile-roster">${players.map(profilePersonCard).join('')}</div></div></section>
      ${staff.length ? `<section class="ewc-panel ewc-profile-section"><div class="ewc-panel-inner"><h2>Staff</h2><div class="ewc-profile-roster">${staff.map(profilePersonCard).join('')}</div></div></section>` : ''}
      <section class="ewc-panel ewc-profile-section"><div class="ewc-panel-inner"><h2>Informações da equipe</h2><div class="ewc-stats-grid">${statCard('Jogadores', players.length)}${team.group ? statCard('Grupo', team.group) : ''}${statCard('Classificação', team.qualification || 'A confirmar')}${current ? statCard('Fase de grupos', `${current.position}º`, `${current.points} PTS • ${current.kills} K`) : ''}</div></div></section>
      <button class="btn-action ewc-profile-back" type="button" onclick="navigate('ewc-equipes')">← Voltar para equipes da EWC</button>
    </div>`;
  }

  async function openPlayerProfile(name) {
    await loadData();
    const player = playerByName(name);
    if (!player) return;
    if (document.querySelector('.page.active')?.id !== 'ewc-player-profile' && typeof window.navigate === 'function') window.navigate('ewc-player-profile');
    history.replaceState(null, '', `#ewc-player-${slug(player.name)}`);
    const root = document.getElementById('ewc-player-profile-content');
    if (!root) return;
    const stats = killsForPlayer(player.name);
    const country = COUNTRY_NAMES[player.country] || String(player.country || '').toUpperCase() || 'País não informado';
    root.innerHTML = `<div class="ewc-shell">
      <section class="ewc-profile-hero"><div class="ewc-profile-flag">${flagEmoji(player.country) || '—'}</div><div><div class="ewc-kicker">Jogador • EWC 2026</div><h1>${escapeHtml(player.name)}</h1><p>${escapeHtml(country)} • ${escapeHtml(player.role)}</p></div></section>
      <section class="ewc-panel ewc-profile-section"><div class="ewc-panel-inner"><h2>Equipe</h2><button type="button" class="ewc-participant-head" onclick="openEWCTeamProfile(${jsString(player.team)})"><span class="ewc-participant-logo"><img src="${escapeHtml(resolveLogo(player.team))}" alt="" onerror="this.onerror=null;this.src='escudo.webp'"></span><span class="ewc-participant-title"><strong>${escapeHtml(player.team)}</strong><small>${escapeHtml(player.qualification || '')}</small></span><span class="ewc-participant-count">ABRIR</span></button></div></section>
      <section class="ewc-panel ewc-profile-section"><div class="ewc-panel-inner"><h2>Informações</h2><div class="ewc-stats-grid">${statCard('Posição', player.role)}${statCard('Bandeira', country)}${stats && Number(stats.kills) ? statCard('Kills', Number(stats.kills)) : ''}</div></div></section>
      <button class="btn-action ewc-profile-back" type="button" onclick="navigate('ewc-equipes')">← Voltar para equipes da EWC</button>
    </div>`;
  }

  function renderActivePage() {
    let id = document.querySelector('.page.active')?.id || '';
    id = PAGE_ALIASES[id] || id;
    if (id === 'ewc-grupos') renderGroups();
    if (id === 'ewc-repescagem') renderStage('ewc-repescagem-content', survivalData, 'survival', 'Repescagem', 'Equipes que disputam as vagas restantes na Final');
    if (id === 'ewc-final') renderStage('ewc-final-content', finalData, 'final', 'Final', 'Doze equipes classificadas para a Grande Final');
    if (id === 'ewc-mvp') comingSoon('ewc-mvp-content', 'Ranking MVP', 'Destaques individuais da EWC 2026');
    if (id === 'ewc-equipes') renderTeams();
    if (id === 'ewc-stats') renderStats();
    if (id === 'ewc-team-profile' || id === 'ewc-player-profile') resolveHash(location.hash);
  }

  function resolveHash(hashValue) {
    const hash = String(hashValue || '').replace(/^#/, '').trim();
    if (!hash) return false;
    if (hash.startsWith('ewc-team-')) {
      const wanted = hash.slice('ewc-team-'.length);
      const team = teams.find(item => slug(item.name) === wanted || (item.aliases || []).some(alias => slug(alias) === wanted));
      if (team) { openTeamProfile(team.name); return true; }
    }
    if (hash.startsWith('ewc-player-')) {
      const wanted = hash.slice('ewc-player-'.length);
      const player = teams.flatMap(team => team.players || []).find(item => slug(item.name) === wanted);
      if (player) { openPlayerProfile(player.name); return true; }
    }
    return false;
  }

  function setDayFilter(key, value) {
    if (!filters[key]) return;
    filters[key].day = String(value || 'all');
    filters[key].drop = 'all';
    renderActivePage();
  }

  function setDropFilter(key, value) {
    if (!filters[key]) return;
    filters[key].drop = String(value || 'all');
    renderActivePage();
  }

  function setGroupTab(groupName) {
    activeGroup = String(groupName || 'A').toUpperCase();
    renderActivePage();
  }

  function applyStatsFilterChange(target, key, value) {
    if (!target || !Object.prototype.hasOwnProperty.call(target, key)) return false;
    target[key] = String(value || 'all');
    if (key === 'stage') {
      target.day = 'all';
      target.map = 'all';
      target.confrontation = 'all';
    }
    if (key === 'confrontation') {
      target.day = 'all';
      target.map = 'all';
      if (target.confrontation === 'group-a' || target.confrontation === 'group-b') target.stage = 'groups';
      if (target.confrontation === 'survival') target.stage = 'survival';
      if (target.confrontation === 'final') target.stage = 'final';
    }
    return true;
  }

  function setStatsFilter(key, value) {
    if (!applyStatsFilterChange(statsFilters, key, value)) return;
    Object.keys(statsCardPages).forEach(pageKey => { statsCardPages[pageKey] = 0; });
    renderActivePage();
  }

  function setRankingFilter(type, key, value) {
    const target = statsRankingFilters[type];
    if (!target || !applyStatsFilterChange(target, key, value)) return;
    statsExpanded[type] = false;
    renderActivePage();
  }

  function setTotalMode(value) {
    statsRankingFilters.total.totalMode = value === 'day-average' ? 'day-average' : 'total';
    statsExpanded.total = false;
    renderActivePage();
  }

  function setStatsCardPage(id, delta) {
    statsCardPages[id] = Math.max(0, (Number(statsCardPages[id]) || 0) + Number(delta || 0));
    renderActivePage();
  }

  function toggleStatsRanking(type) {
    if (!Object.prototype.hasOwnProperty.call(statsExpanded, type)) return;
    statsExpanded[type] = !statsExpanded[type];
    renderActivePage();
  }

  function patchNavigation() {
    if (window.__cffEWCPatchedNavigation) return;
    window.__cffEWCPatchedNavigation = true;
    const originalNavigate = window.navigate;
    window.navigate = function (id) {
      const requested = String(id || '');
      const target = PAGE_ALIASES[requested] || requested;
      const result = typeof originalNavigate === 'function' ? originalNavigate.call(this, target) : null;
      if (PAGE_IDS.has(requested) || PAGE_IDS.has(target)) loadData().then(renderActivePage).catch(() => renderLoadError(target));
      return result;
    };
  }

  function renderLoadError(id) {
    const contentId = {
      'ewc-grupos': 'ewc-grupos-content', 'ewc-repescagem': 'ewc-repescagem-content',
      'ewc-final': 'ewc-final-content', 'ewc-mvp': 'ewc-mvp-content',
      'ewc-equipes': 'ewc-equipes-content', 'ewc-stats': 'ewc-stats-content'
    }[PAGE_ALIASES[id] || id];
    const root = contentId ? document.getElementById(contentId) : null;
    if (root) root.innerHTML = '<div class="ewc-empty">Não foi possível abrir esta página agora. Atualize e tente novamente.</div>';
  }

  function patchGlobalSearch() {
    if (window.__cffEWCSearchPatched) return;
    window.__cffEWCSearchPatched = true;
    const originalTeamPool = window.navBuildTeamSearchPool;
    window.navBuildTeamSearchPool = function () {
      const base = typeof originalTeamPool === 'function' ? originalTeamPool() : [];
      return base.concat(teams.map(team => ({
        type: 'ewc-team', name: team.name, title: team.name,
        sub: `${team.countryName || 'Equipe'} • EWC 2026`, img: resolveLogo(team.name), priority: 11,
        haystack: `${teamAliases(team).join(' ')} ${team.countryName || ''} ${team.qualification || ''} ewc 2026`.toLowerCase()
      })));
    };
    const originalPeoplePool = window.navBuildPeopleSearchPool;
    window.navBuildPeopleSearchPool = function () {
      const base = typeof originalPeoplePool === 'function' ? originalPeoplePool() : [];
      return base.concat(teams.flatMap(team => (team.players || []).filter(person => !person.staff).map(person => ({
        type: 'ewc-player', name: person.name, title: person.name, sub: `${team.name} • EWC 2026`,
        img: 'silhueta.webp', priority: 8,
        haystack: `${person.name} ${teamAliases(team).join(' ')} ${person.role} ewc 2026`.toLowerCase()
      }))));
    };
    const originalSelect = window.selectSearchResult;
    window.selectSearchResult = function (type, name) {
      if (type === 'ewc-team') { if (typeof window.navCloseSearchUI === 'function') window.navCloseSearchUI(); return openTeamProfile(name); }
      if (type === 'ewc-player') { if (typeof window.navCloseSearchUI === 'function') window.navCloseSearchUI(); return openPlayerProfile(name); }
      return typeof originalSelect === 'function' ? originalSelect(type, name) : null;
    };
  }

  window.loadEWCData = loadData;
  window.refreshEWCCompetitionData = () => Promise.allSettled([refreshLogoData(true)]);
  window.renderEWCPageIfVisible = renderActivePage;
  window.renderEWCTeams = renderTeams;
  window.openEWCTeamProfile = openTeamProfile;
  window.openEWCPlayerProfile = openPlayerProfile;
  window.setEWCDayFilter = setDayFilter;
  window.setEWCDropFilter = setDropFilter;
  window.setEWCGroupTab = setGroupTab;
  window.setEWCStatsFilter = setStatsFilter;
  window.setEWCRankingFilter = setRankingFilter;
  window.setEWCTotalMode = setTotalMode;
  window.setEWCStatsCardPage = setStatsCardPage;
  window.toggleEWCStatsRanking = toggleStatsRanking;

  document.addEventListener('DOMContentLoaded', () => {
    patchNavigation();
    const hash = String(location.hash || '').replace(/^#/, '');
    const activeId = document.querySelector('.page.active')?.id || '';
    const shouldLoadNow = hash.startsWith('ewc') || PAGE_IDS.has(activeId);
    const init = () => loadData().then(() => {
      if (!resolveHash(hash)) renderActivePage();
    }).catch(() => renderLoadError(activeId));
    if (shouldLoadNow) init();
    else (window.cffRunWhenIdle || function (callback) { return setTimeout(callback, 4500); })(init, 4500);
  });
})();
