(function () {
  'use strict';

  const BASE = 'ewc%202026/';
  const CONFIG = Object.assign({
    source: 'spreadsheet',
    standingsTsvUrl: '',
    killsTsvUrl: '',
    teamLogosTsvUrl: '',
    standingsJsonUrl: `${BASE}classificacao.json`,
    killsJsonUrl: `${BASE}abates.json`,
    cacheMinutes: 2,
    logoCacheMinutes: 30
  }, window.EWC_2026_CONFIG || {});
  const PAGE_IDS = new Set([
    'ewc-2026',
    'ewc-tabela',
    'ewc-kills',
    'ewc-equipes',
    'ewc-datas',
    'ewc-stats',
    'ewc-team-profile',
    'ewc-player-profile'
  ]);

  const TEAM_LOGO_ALIASES = {
    'TEAM SECRET VN ORIG': ['Team Secret VN', 'Team Secret', 'Secret WAG'],
    'ALL GAMERS GLOBAL': ['AG.AL', 'All Gamers Global', 'All Gamers'],
    'RRQ': ['RRQ Kazu', 'RRQ'],
    'BIGETRON BY VITALITY': ['Team Vitality ID', 'Team Vitality', 'Bigetron By Vitality'],
    'MIBR LOS': ['MIBR.LOS', 'LOS', 'MIBR LOS'],
    'FLUXO W7M': ['Fluxo W7M', 'Fluxo'],
    'BURIRAM UNITED ESPORTS': ['BRU', 'Buriram United', 'Buriram United Esports'],
    'GUNDYNASTY': ['Gun Dynasty', 'GunDynasty'],
    'MIA CORP': ['MÍA Corp', 'Mia Corp'],
    'TEAM APEX GAMING': ['Team Apex Gaming', 'Team Hind']
  };

  const LOCAL_LOGOS = {
    'LOUD': 'loud 2.webp',
    'MIBR LOS': 'Los.webp',
    'FLUXO W7M': 'Fluxo 2.webp',
    'LYON': 'lyon.webp'
  };

  const COUNTRY_NAMES = {
    ar: 'Argentina', bd: 'Bangladesh', br: 'Brasil', cl: 'Chile', co: 'Colômbia',
    cr: 'Costa Rica', do: 'República Dominicana', dz: 'Argélia', eg: 'Egito',
    id: 'Indonésia', in: 'Índia', my: 'Malásia', np: 'Nepal', pk: 'Paquistão',
    th: 'Tailândia', tn: 'Tunísia', ve: 'Venezuela', vn: 'Vietnã', za: 'África do Sul'
  };

  let teams = [];
  let standings = [];
  let standingsMeta = {};
  let kills = [];
  let schedule = { days: [] };
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

  function logoCandidates(teamName) {
    const normalized = normalize(teamName);
    const aliases = TEAM_LOGO_ALIASES[normalized] || [];
    return [teamName, ...aliases].filter(Boolean);
  }

  function lookupLogoMap(name) {
    const map = window.logos || {};
    if (!name || !map) return '';
    if (map[name]) return map[name];
    if (map[String(name).toUpperCase()]) return map[String(name).toUpperCase()];
    const key = Object.keys(map).find(candidate => normalize(candidate) === normalize(name));
    return key ? map[key] : '';
  }

  function lookupEWCLogo(name) {
    return ewcLogoMap[normalize(name)] || '';
  }

  function resolveLogo(teamName) {
    const normalized = normalize(teamName);

    for (const candidate of logoCandidates(teamName)) {
      const ewcLogo = lookupEWCLogo(candidate);
      if (ewcLogo) return ewcLogo;

      try {
        if (typeof window.getTeamLogoSafe === 'function') {
          const value = window.getTeamLogoSafe(candidate);
          if (value && value !== 'escudo.webp') return value;
        }
      } catch (error) {}

      const direct = lookupLogoMap(candidate);
      if (direct) return direct;
    }

    if (LOCAL_LOGOS[normalized]) return LOCAL_LOGOS[normalized];
    return 'escudo.webp';
  }

  function json(url) {
    return fetch(url, { cache: 'default' }).then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  }

  function parseNumber(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return 0;
    const normalized = text
      .replace(/\s+/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
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
        } else {
          quoted = !quoted;
        }
        continue;
      }
      if (!quoted && char === delimiter) {
        row.push(cell);
        cell = '';
        continue;
      }
      if (!quoted && (char === '\n' || char === '\r')) {
        if (char === '\r' && source[index + 1] === '\n') index += 1;
        row.push(cell);
        if (row.some(value => String(value || '').trim())) rows.push(row);
        row = [];
        cell = '';
        continue;
      }
      cell += char;
    }
    row.push(cell);
    if (row.some(value => String(value || '').trim())) rows.push(row);
    return rows;
  }

  function sheetObjects(text) {
    const rows = parseDelimited(text);
    if (!rows.length) return [];
    const headers = rows[0].map(header => normalize(header));
    return rows.slice(1).map(values => {
      const object = {};
      headers.forEach((header, index) => {
        if (header) object[header] = String(values[index] == null ? '' : values[index]).trim();
      });
      return object;
    });
  }

  function readColumn(row, aliases) {
    for (const alias of aliases) {
      const value = row[normalize(alias)];
      if (value != null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  }

  function parseLogosSheet(text) {
    const map = {};
    sheetObjects(text).forEach(row => {
      const team = readColumn(row, ['equipe', 'time', 'team']);
      const abbreviation = readColumn(row, ['abreviação', 'abreviacao', 'sigla', 'abbr']);
      const logo = readColumn(row, ['logo', 'link da logo', 'url da logo', 'url', 'link']);
      if (!logo) return;
      if (team) map[normalize(team)] = logo;
      if (abbreviation) map[normalize(abbreviation)] = logo;
    });
    return map;
  }

  function roleFromSheet(value) {
    const key = normalize(value);
    if (!key) return { role: '', roleShort: '' };
    if (key.includes('BOMBER') || key.includes('GRAN')) return { role: 'GRANADEIRO', roleShort: 'GRAN' };
    if (key.includes('SNIPER') || key.includes('SUPORTE') || key === 'SUP') return { role: 'SUPORTE', roleShort: 'SUP' };
    if (key.includes('RIFLER') || key.includes('3 HOMEM') || key.includes('TERCEIRO HOMEM')) return { role: '3º HOMEM', roleShort: '3º' };
    if (key.includes('RUSH') || key.includes('SUPPORT')) return { role: 'RUSH', roleShort: 'RUSH' };
    return { role: String(value || '').toUpperCase(), roleShort: String(value || '').toUpperCase() };
  }

  function parseStandingsSheet(text) {
    return sheetObjects(text).map((row, index) => {
      const team = readColumn(row, ['equipe', 'time', 'team']);
      if (!team) return null;
      const explicitPosition = readColumn(row, ['posição', 'posicao', 'pos', 'colocação', 'colocacao', 'rank', '#']);
      return {
        position: parseNumber(explicitPosition) || index + 1,
        team,
        group: readColumn(row, ['grupo', 'group']),
        matches: parseNumber(readColumn(row, ['quedas', 'q', 'partidas', 'matches', 'mapas'])),
        booyahs: parseNumber(readColumn(row, ['booyahs', 'booyah', 'b!', 'vitórias', 'vitorias'])),
        kills: parseNumber(readColumn(row, ['kills', 'abates', 'k'])),
        placementPoints: parseNumber(readColumn(row, ['pontos de colocação', 'pontos de colocacao', 'placement points', 'pp'])),
        points: parseNumber(readColumn(row, ['pontos', 'pts', 'total', 'points'])),
        status: readColumn(row, ['status', 'situação', 'situacao', 'classificação', 'classificacao'])
      };
    }).filter(Boolean);
  }

  function findRosterPerson(name, teamName) {
    const wantedName = normalize(name);
    const wantedTeam = normalize(teamName);
    let fallback = null;
    for (const team of teams) {
      for (const person of (team.players || [])) {
        if (person.staff || normalize(person.name) !== wantedName) continue;
        if (!fallback) fallback = { person, team };
        if (wantedTeam && normalize(team.name) === wantedTeam) return { person, team };
      }
    }
    return fallback;
  }

  function parseKillsSheet(text) {
    return sheetObjects(text).map(row => {
      const name = readColumn(row, ['jogador', 'player', 'nick', 'nome']);
      if (!name) return null;
      const sheetTeam = readColumn(row, ['equipe', 'time', 'team']);
      const roster = findRosterPerson(name, sheetTeam);
      const rawRole = readColumn(row, ['posição', 'posicao', 'função', 'funcao', 'role']) || roster?.person?.role || '';
      const mappedRole = roleFromSheet(rawRole);
      return {
        name,
        team: sheetTeam || roster?.team?.name || '',
        country: readColumn(row, ['bandeira', 'flag', 'país', 'pais', 'country']) || roster?.person?.country || '',
        role: mappedRole.role || roster?.person?.role || '',
        roleShort: mappedRole.roleShort || roster?.person?.roleShort || '',
        kills: parseNumber(readColumn(row, ['kills', 'abates', 'k'])),
        matches: parseNumber(readColumn(row, ['quedas', 'q', 'partidas', 'matches', 'mapas'])),
        damage: parseNumber(readColumn(row, ['dano', 'damage', 'dmg'])),
        assists: parseNumber(readColumn(row, ['assistências', 'assistencias', 'assists', 'assist'])),
        mvp: parseNumber(readColumn(row, ['mvp']))
      };
    }).filter(Boolean);
  }

  function withTimeout(promise, milliseconds) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), milliseconds))
    ]);
  }

  function sheetCacheKey(url) {
    return `cff:ewc2026:sheet:${String(url || '')}`;
  }

  function sheetCacheMinutes(url) {
    return String(url || '') === String(CONFIG.teamLogosTsvUrl || '')
      ? Math.max(1, Number(CONFIG.logoCacheMinutes) || 30)
      : Math.max(1, Number(CONFIG.cacheMinutes) || 2);
  }

  function readSheetCache(url) {
    try {
      const raw = localStorage.getItem(sheetCacheKey(url));
      if (!raw) return '';
      const saved = JSON.parse(raw);
      const ttl = sheetCacheMinutes(url) * 60 * 1000;
      return Date.now() - Number(saved.savedAt || 0) <= ttl ? String(saved.text || '') : '';
    } catch (error) {
      return '';
    }
  }

  function saveSheetCache(url, text) {
    try {
      localStorage.setItem(sheetCacheKey(url), JSON.stringify({ savedAt: Date.now(), text: String(text || '') }));
    } catch (error) {}
  }

  async function fetchSheet(url, force) {
    if (!url) throw new Error('sheet-url-empty');
    if (!force) {
      const cached = readSheetCache(url);
      if (cached) return cached;
    }
    const separator = String(url).includes('?') ? '&' : '?';
    const cacheWindow = Math.floor(Date.now() / (sheetCacheMinutes(url) * 60 * 1000));
    const response = await withTimeout(fetch(`${url}${separator}_cff=${cacheWindow}`, { cache: 'no-store' }), 9000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    saveSheetCache(url, text);
    return text;
  }

  function shouldUseSheets() {
    return String(CONFIG.source || 'spreadsheet').toLowerCase() !== 'json';
  }

  async function refreshLogoData(force) {
    if (!CONFIG.teamLogosTsvUrl) return false;
    const text = await fetchSheet(CONFIG.teamLogosTsvUrl, force);
    const parsed = parseLogosSheet(text);
    if (!Object.keys(parsed).length) return false;
    ewcLogoMap = parsed;
    renderActivePage();
    return true;
  }

  async function refreshCompetitionData(force) {
    if (!shouldUseSheets()) return false;
    const jobs = [];
    if (CONFIG.standingsTsvUrl) {
      jobs.push(fetchSheet(CONFIG.standingsTsvUrl, force).then(text => {
        const parsed = parseStandingsSheet(text);
        if (parsed.length) standings = parsed;
      }));
    }
    if (CONFIG.killsTsvUrl) {
      jobs.push(fetchSheet(CONFIG.killsTsvUrl, force).then(text => {
        const parsed = parseKillsSheet(text);
        if (parsed.length) kills = parsed;
      }));
    }
    if (!jobs.length) return false;
    const results = await Promise.allSettled(jobs);
    const updated = results.some(result => result.status === 'fulfilled');
    if (updated) renderActivePage();
    return updated;
  }

  async function loadData() {
    if (loaded) return { teams, standings, kills, schedule };
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      const [teamsPayload, standingsPayload, killsPayload, schedulePayload] = await Promise.all([
        json(`${BASE}times.json`),
        json(CONFIG.standingsJsonUrl || `${BASE}classificacao.json`).catch(() => ({ rows: [] })),
        json(CONFIG.killsJsonUrl || `${BASE}abates.json`).catch(() => ({ players: [] })),
        json(`${BASE}datas.json`)
      ]);

      teams = Array.isArray(teamsPayload.teams) ? teamsPayload.teams : [];
      standingsMeta = standingsPayload || {};
      standings = Array.isArray(standingsPayload.rows) ? standingsPayload.rows : [];
      kills = Array.isArray(killsPayload.players) ? killsPayload.players : [];
      schedule = schedulePayload || { days: [] };

      loaded = true;
      patchGlobalSearch();

      refreshCompetitionData(false).catch(() => {});
      refreshLogoData(false).catch(() => {});

      if (typeof window.loadTeamLogos === 'function' && !window.__cffTeamLogosLoaded) {
        Promise.resolve(window.loadTeamLogos())
          .then(() => renderActivePage())
          .catch(() => {});
      }

      return { teams, standings, kills, schedule };
    })().finally(() => {
      loadPromise = null;
    });

    return loadPromise;
  }

  function teamByName(name) {
    const target = normalize(name);
    return teams.find(team => normalize(team.name) === target) || null;
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
    return standings.find(row => normalize(row.team) === normalize(teamName)) || null;
  }

  function killsForPlayer(playerName) {
    return kills.find(row => normalize(row.name) === normalize(playerName)) || null;
  }

  function hero(title, subtitle) {
    return `<div class="ewc-hero">
      <div class="ewc-hero-main">
        <div class="ewc-hero-icon" aria-hidden="true">🏆</div>
        <div>
          <div class="ewc-kicker">Esports World Cup 2026</div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle || '')}</p>
        </div>
      </div>
      <div class="ewc-hero-badges">
        <span>24 equipes</span>
        <span>15 a 18 de julho</span>
        <span>Paris, França</span>
      </div>
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
    const short = statusType(row) === 'survival' ? 'REP.' : (statusType(row) === 'eliminated' ? 'ELIM.' : status.toUpperCase());
    return `<span class="ewc-status-badge ${statusType(row)}"><span class="ewc-status-full">${escapeHtml(status)}</span><span class="ewc-status-short">${escapeHtml(short)}</span></span>`;
  }

  function standingsTable(rows) {
    return `<div class="ewc-table-wrap"><table class="ewc-table">
      <thead><tr><th>#</th><th>Equipe</th><th>PTS</th><th>B!</th><th>K</th><th class="ewc-hide-mobile">PP</th><th class="ewc-hide-mobile">Q</th><th>Status</th></tr></thead>
      <tbody>${rows.map(row => `<tr class="ewc-row-${statusType(row)}" data-clickable="true" onclick="openEWCTeamProfile(${jsString(row.team)})">
        <td class="ewc-rank">${Number(row.position) || '—'}</td>
        <td class="ewc-team-cell"><img src="${escapeHtml(resolveLogo(row.team))}" alt="" onerror="this.onerror=null;this.src='escudo.webp'"><span>${escapeHtml(row.team)}</span></td>
        <td>${Number(row.points) || 0}</td><td>${Number(row.booyahs) || 0}</td><td>${Number(row.kills) || 0}</td><td class="ewc-hide-mobile">${Number(row.placementPoints) || 0}</td><td class="ewc-hide-mobile">${Number(row.matches) || 0}</td><td>${tableStatus(row)}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  function renderStandings() {
    const root = document.getElementById('ewc-tabela-content');
    if (!root) return;

    const hasCompetitiveData = standings.some(row => Number(row.points) || Number(row.kills) || Number(row.booyahs) || Number(row.matches));
    const groupNames = [...new Set(standings.map(row => String(row.group || '').trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const hasGroups = groupNames.length > 1;
    const format = standingsMeta.format || {};
    const matchesPerGroup = Number(format.matchesPerGroup) || Math.max(0, ...standings.map(row => Number(row.matches) || 0));

    const content = hasGroups ? groupNames.map(group => {
      const rows = standings.filter(row => String(row.group || '').trim() === group).sort((a, b) => Number(a.position) - Number(b.position));
      return `<section class="ewc-panel"><div class="ewc-panel-inner">
        <div class="ewc-section-head"><div><h2>Grupo ${escapeHtml(group)}</h2><p>Os 4 melhores avançaram à Final; do 5º ao 10º foram para a Repescagem.</p></div><span class="ewc-updated">${rows.length} equipes • ${matchesPerGroup} quedas</span></div>
        ${standingsTable(rows)}
      </div></section>`;
    }).join('') : `<section class="ewc-panel"><div class="ewc-panel-inner">
      <div class="ewc-section-head"><div><h2>Classificação</h2><p>${hasCompetitiveData ? 'Tabela atualizada com os dados cadastrados.' : 'A tabela será atualizada após as primeiras quedas.'}</p></div><span class="ewc-updated">${standings.length} equipes</span></div>
      ${standingsTable([...standings].sort((a, b) => Number(a.position) - Number(b.position)))}
    </div></section>`;

    root.innerHTML = `<div class="ewc-shell">
      ${hero('Tabela', hasGroups ? 'Fase de grupos — Grupos A e B' : 'Classificação da EWC 2026')}
      ${hasGroups ? `<div class="ewc-stage-legend"><span class="final">Final • 1º ao 4º</span><span class="survival">Repescagem • 5º ao 10º</span><span class="eliminated">Eliminado • 11º e 12º</span></div>` : ''}
      ${content}
    </div>`;
  }

  function renderKills() {
    const root = document.getElementById('ewc-kills-content');
    if (!root) return;

    const query = normalize(document.getElementById('ewc-kills-search')?.value || '');
    const withData = kills.filter(player => Number(player.kills) || Number(player.matches) || Number(player.damage) || Number(player.assists) || Number(player.mvp));
    let rows = withData.length ? withData : [];
    if (query) rows = rows.filter(player => normalize(`${player.name} ${player.team} ${player.role}`).includes(query));
    rows.sort((a, b) => Number(b.kills) - Number(a.kills) || Number(b.mvp) - Number(a.mvp) || String(a.name).localeCompare(String(b.name), 'pt-BR'));

    root.innerHTML = `<div class="ewc-shell">
      ${hero('Ranking de kills', 'Desempenho individual dos jogadores')}
      <section class="ewc-panel"><div class="ewc-panel-inner">
        <div class="ewc-section-head"><div><h2>Ranking de kills</h2><p>${withData.length ? 'Ranking atualizado com os dados cadastrados.' : 'O ranking será liberado após as primeiras quedas.'}</p></div><span class="ewc-updated">${withData.length} com dados</span></div>
        <div class="ewc-tools"><input id="ewc-kills-search" class="ewc-search" type="search" placeholder="Buscar jogador ou equipe..." value="${escapeHtml(document.getElementById('ewc-kills-search')?.value || '')}" oninput="renderEWCKills()"></div>
        ${rows.length ? `<div class="ewc-table-wrap"><table class="ewc-table"><thead><tr><th>#</th><th>Jogador</th><th>Equipe</th><th>K</th><th class="ewc-hide-mobile">Q</th><th class="ewc-hide-mobile">K/Q</th><th class="ewc-hide-mobile">MVP</th></tr></thead><tbody>${rows.map((player, index) => {
          const average = Number(player.matches) ? (Number(player.kills) / Number(player.matches)).toFixed(2) : '0.00';
          return `<tr data-clickable="true" onclick="openEWCPlayerProfile(${jsString(player.name)})"><td class="ewc-rank">${index + 1}</td><td>${flagMarkup(player.country)} ${escapeHtml(player.name)}</td><td>${escapeHtml(player.team)}</td><td>${Number(player.kills) || 0}</td><td class="ewc-hide-mobile">${Number(player.matches) || 0}</td><td class="ewc-hide-mobile">${average}</td><td class="ewc-hide-mobile">${Number(player.mvp) || 0}</td></tr>`;
        }).join('')}</tbody></table></div>` : '<div class="ewc-empty">O ranking de kills será exibido aqui quando o torneio começar.</div>'}
      </div></section>
    </div>`;
  }

  function personButton(person) {
    const click = person.staff ? '' : `onclick="openEWCPlayerProfile(${jsString(person.name)})"`;
    return `<button type="button" class="ewc-person${person.staff ? ' staff' : ''}" ${click}>
      ${flagMarkup(person.country)}
      <span class="ewc-person-name">${escapeHtml(person.name)}</span>
      ${roleMarkup(person)}
    </button>`;
  }

  function participantCard(team) {
    const players = (team.players || []).filter(person => !person.staff);
    const staff = (team.players || []).filter(person => person.staff);
    return `<article class="ewc-participant-card">
      <button type="button" class="ewc-participant-head" onclick="openEWCTeamProfile(${jsString(team.name)})">
        <span class="ewc-participant-logo"><img src="${escapeHtml(resolveLogo(team.name))}" alt="${escapeHtml(team.name)}" onerror="this.onerror=null;this.src='escudo.webp'"></span>
        <span class="ewc-participant-title"><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(`${team.group ? `Grupo ${team.group} • ` : ''}${team.qualification || 'A confirmar'}`)}</small></span>
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
      return normalize(`${team.name} ${team.group || ''} ${team.qualification} ${people}`).includes(query);
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

  function renderDates() {
    const root = document.getElementById('ewc-datas-content');
    if (!root) return;
    const days = Array.isArray(schedule.days) ? schedule.days : [];

    root.innerHTML = `<div class="ewc-shell">
      ${hero('Datas', 'Calendário da competição internacional')}
      <section class="ewc-panel"><div class="ewc-panel-inner">
        <div class="ewc-section-head"><div><h2>Calendário</h2><p>${escapeHtml(schedule.location || 'Paris, França')} • ${escapeHtml(days.length ? `${days[0].label} a ${days[days.length - 1].label}` : 'Datas em breve')}</p></div><span class="ewc-updated">${days.length} dias</span></div>
        <div class="ewc-dates-grid">${days.map(day => `<article class="ewc-date-card"><time datetime="${escapeHtml(day.date)}">${escapeHtml(day.label)}</time><strong>${escapeHtml(day.stage)}</strong><span>${escapeHtml(day.status || '')}</span></article>`).join('')}</div>
      </div></section>
    </div>`;
  }

  function statCard(label, value, detail) {
    return `<article class="ewc-stat-card"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong>${detail ? `<em>${escapeHtml(detail)}</em>` : ''}</article>`;
  }

  function renderStats() {
    const root = document.getElementById('ewc-stats-content');
    if (!root) return;

    const competitiveRows = standings.filter(row => Number(row.points) || Number(row.kills) || Number(row.booyahs) || Number(row.matches));
    const playerRows = kills.filter(player => Number(player.kills) || Number(player.matches) || Number(player.damage) || Number(player.assists) || Number(player.mvp));
    const totalKills = competitiveRows.reduce((sum, row) => sum + Number(row.kills || 0), 0);
    const totalBooyahs = competitiveRows.reduce((sum, row) => sum + Number(row.booyahs || 0), 0);
    const totalMatches = Math.max(0, ...competitiveRows.map(row => Number(row.matches || 0)));
    const groupMatchTotal = Object.values(standingsMeta.groups || {}).reduce((sum, group) => sum + (Array.isArray(group.maps) ? group.maps.length : 0), 0);
    const registeredMatches = groupMatchTotal || totalMatches;
    const leaderTeam = [...competitiveRows].sort((a, b) => Number(b.points) - Number(a.points) || Number(b.kills) - Number(a.kills))[0];
    const leaderPlayer = [...playerRows].sort((a, b) => Number(b.kills) - Number(a.kills))[0];

    root.innerHTML = `<div class="ewc-shell">
      ${hero('Estatísticas gerais', 'Resumo geral da EWC 2026')}
      <section class="ewc-panel"><div class="ewc-panel-inner">
        <div class="ewc-section-head"><div><h2>Visão geral</h2><p>${competitiveRows.length ? 'Resumo calculado a partir dos dados de classificação e kills.' : 'Os dados competitivos aparecerão após as primeiras quedas.'}</p></div></div>
        <div class="ewc-stats-grid">
          ${statCard('Equipes', teams.length, 'participantes')}
          ${statCard('Jogadores', teams.reduce((sum, team) => sum + (team.players || []).filter(person => !person.staff).length, 0), 'confirmados')}
          ${statCard('Período', '15–18 JUL', schedule.location || 'Paris, França')}
          ${statCard('Dias', (schedule.days || []).length, 'de competição')}
          ${competitiveRows.length ? statCard('Total de kills', totalKills, `${registeredMatches} quedas registradas`) : ''}
          ${competitiveRows.length ? statCard('Booyahs', totalBooyahs, 'na tabela') : ''}
          ${leaderTeam ? statCard('Líder', leaderTeam.team, `${Number(leaderTeam.points) || 0} pontos`) : ''}
          ${leaderPlayer ? statCard('Líder em kills', leaderPlayer.name, `${Number(leaderPlayer.kills) || 0} kills`) : ''}
        </div>
      </div></section>
    </div>`;
  }

  function profilePersonCard(person) {
    const click = person.staff ? '' : `onclick="openEWCPlayerProfile(${jsString(person.name)})" style="cursor:pointer"`;
    return `<div class="ewc-profile-person" ${click}>${flagMarkup(person.country)}<div class="ewc-profile-copy"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role)}</small></div></div>`;
  }

  async function openTeamProfile(name) {
    await loadData();
    const team = teamByName(name);
    if (!team) return alert('Equipe da EWC não encontrada.');

    if (document.querySelector('.page.active')?.id !== 'ewc-team-profile' && typeof window.navigate === 'function') window.navigate('ewc-team-profile');
    history.replaceState(null, '', `#ewc-team-${slug(team.name)}`);

    const root = document.getElementById('ewc-team-profile-content');
    if (!root) return;

    const players = (team.players || []).filter(person => !person.staff);
    const staff = (team.players || []).filter(person => person.staff);
    const current = standingForTeam(team.name);
    const hasStats = current && (Number(current.points) || Number(current.kills) || Number(current.booyahs) || Number(current.matches));

    root.innerHTML = `<div class="ewc-shell">
      <section class="ewc-profile-hero"><img class="ewc-profile-logo" src="${escapeHtml(resolveLogo(team.name))}" alt="${escapeHtml(team.name)}" onerror="this.onerror=null;this.src='escudo.webp'"><div><div class="ewc-kicker">EWC 2026</div><h1>${escapeHtml(team.name)}</h1><p>${escapeHtml(team.qualification || 'A confirmar')}</p></div></section>
      <section class="ewc-panel ewc-profile-section"><div class="ewc-panel-inner"><h2>Elenco</h2><div class="ewc-profile-roster">${players.map(profilePersonCard).join('')}</div></div></section>
      ${staff.length ? `<section class="ewc-panel ewc-profile-section"><div class="ewc-panel-inner"><h2>Staff</h2><div class="ewc-profile-roster">${staff.map(profilePersonCard).join('')}</div></div></section>` : ''}
      <section class="ewc-panel ewc-profile-section"><div class="ewc-panel-inner"><h2>Informações da equipe</h2><div class="ewc-stats-grid">${statCard('Jogadores', players.length)}${team.group ? statCard('Grupo', team.group) : ''}${statCard('Classificação', team.qualification || 'A confirmar')}${hasStats ? statCard('Pontos', Number(current.points) || 0) : ''}${hasStats ? statCard('Kills', Number(current.kills) || 0) : ''}</div></div></section>
      <button class="btn-action ewc-profile-back" type="button" onclick="navigate('ewc-equipes')">← Voltar para equipes da EWC</button>
    </div>`;
  }

  async function openPlayerProfile(name) {
    await loadData();
    const player = playerByName(name);
    if (!player) return alert('Jogador da EWC não encontrado.');

    if (document.querySelector('.page.active')?.id !== 'ewc-player-profile' && typeof window.navigate === 'function') window.navigate('ewc-player-profile');
    history.replaceState(null, '', `#ewc-player-${slug(player.name)}`);

    const root = document.getElementById('ewc-player-profile-content');
    if (!root) return;

    const stats = killsForPlayer(player.name);
    const hasStats = stats && (Number(stats.kills) || Number(stats.matches) || Number(stats.damage) || Number(stats.assists) || Number(stats.mvp));
    const country = COUNTRY_NAMES[player.country] || String(player.country || '').toUpperCase() || 'País não informado';

    root.innerHTML = `<div class="ewc-shell">
      <section class="ewc-profile-hero"><div class="ewc-profile-flag">${flagEmoji(player.country) || '—'}</div><div><div class="ewc-kicker">Jogador • EWC 2026</div><h1>${escapeHtml(player.name)}</h1><p>${escapeHtml(country)} • ${escapeHtml(player.role)}</p></div></section>
      <section class="ewc-panel ewc-profile-section"><div class="ewc-panel-inner"><h2>Equipe</h2><button type="button" class="ewc-participant-head" onclick="openEWCTeamProfile(${jsString(player.team)})"><span class="ewc-participant-logo"><img src="${escapeHtml(resolveLogo(player.team))}" alt="" onerror="this.onerror=null;this.src='escudo.webp'"></span><span class="ewc-participant-title"><strong>${escapeHtml(player.team)}</strong><small>${escapeHtml(player.qualification || '')}</small></span><span class="ewc-participant-count">ABRIR</span></button></div></section>
      <section class="ewc-panel ewc-profile-section"><div class="ewc-panel-inner"><h2>Informações</h2><div class="ewc-stats-grid">${statCard('Posição', player.role)}${statCard('Bandeira', country)}${hasStats ? statCard('Kills', Number(stats.kills) || 0) : ''}${hasStats ? statCard('Quedas', Number(stats.matches) || 0) : ''}</div>${hasStats ? '' : '<div class="ewc-empty" style="margin-top:14px">O desempenho será exibido após as primeiras quedas.</div>'}</div></section>
      <button class="btn-action ewc-profile-back" type="button" onclick="navigate('ewc-equipes')">← Voltar para equipes da EWC</button>
    </div>`;
  }

  function renderActivePage() {
    const id = document.querySelector('.page.active')?.id || '';
    if (id === 'ewc-2026') {
      if (typeof window.navigate === 'function') window.navigate('ewc-tabela');
      return;
    }
    if (id === 'ewc-tabela') renderStandings();
    if (id === 'ewc-kills') renderKills();
    if (id === 'ewc-equipes') renderTeams();
    if (id === 'ewc-datas') renderDates();
    if (id === 'ewc-stats') renderStats();
    if (id === 'ewc-team-profile' || id === 'ewc-player-profile') resolveHash(location.hash);
  }

  function resolveHash(hashValue) {
    const hash = String(hashValue || '').replace(/^#/, '').trim();
    if (!hash) return false;

    if (hash.startsWith('ewc-team-')) {
      const wanted = hash.slice('ewc-team-'.length);
      const team = teams.find(item => slug(item.name) === wanted);
      if (team) {
        openTeamProfile(team.name);
        return true;
      }
    }

    if (hash.startsWith('ewc-player-')) {
      const wanted = hash.slice('ewc-player-'.length);
      const player = kills.find(item => slug(item.name) === wanted) || teams.flatMap(team => team.players || []).find(item => slug(item.name) === wanted);
      if (player) {
        openPlayerProfile(player.name);
        return true;
      }
    }
    return false;
  }

  function patchNavigation() {
    if (window.__cffEWCPatchedNavigation) return;
    window.__cffEWCPatchedNavigation = true;
    const originalNavigate = window.navigate;
    window.navigate = function (id) {
      const result = typeof originalNavigate === 'function' ? originalNavigate.apply(this, arguments) : null;
      if (PAGE_IDS.has(String(id || ''))) {
        loadData().then(renderActivePage).catch(() => renderLoadError(id));
      }
      return result;
    };
  }

  function renderLoadError(id) {
    const contentId = {
      'ewc-tabela': 'ewc-tabela-content',
      'ewc-kills': 'ewc-kills-content',
      'ewc-equipes': 'ewc-equipes-content',
      'ewc-datas': 'ewc-datas-content',
      'ewc-stats': 'ewc-stats-content'
    }[id];
    const root = contentId ? document.getElementById(contentId) : null;
    if (root) root.innerHTML = '<div class="ewc-empty">Não foi possível carregar os dados da EWC agora. Atualize a página e tente novamente.</div>';
  }

  function patchGlobalSearch() {
    if (window.__cffEWCSearchPatched) return;
    window.__cffEWCSearchPatched = true;

    const originalTeamPool = window.navBuildTeamSearchPool;
    window.navBuildTeamSearchPool = function () {
      const base = typeof originalTeamPool === 'function' ? originalTeamPool() : [];
      const extra = teams.map(team => ({
        type: 'ewc-team',
        name: team.name,
        title: team.name,
        sub: 'Equipe • EWC 2026',
        img: resolveLogo(team.name),
        priority: 11,
        haystack: `${team.name} ${team.qualification || ''} ewc 2026 esports world cup`.toLowerCase()
      }));
      return base.concat(extra);
    };

    const originalPeoplePool = window.navBuildPeopleSearchPool;
    window.navBuildPeopleSearchPool = function () {
      const base = typeof originalPeoplePool === 'function' ? originalPeoplePool() : [];
      const extra = teams.flatMap(team => (team.players || []).filter(person => !person.staff).map(person => ({
        type: 'ewc-player',
        name: person.name,
        title: person.name,
        sub: `${team.name} • EWC 2026`,
        img: 'silhueta.webp',
        priority: 8,
        haystack: `${person.name} ${team.name} ${person.role} ewc 2026`.toLowerCase()
      })));
      return base.concat(extra);
    };

    const originalSelect = window.selectSearchResult;
    window.selectSearchResult = function (type, name) {
      if (type === 'ewc-team') {
        if (typeof window.navCloseSearchUI === 'function') window.navCloseSearchUI();
        return openTeamProfile(name);
      }
      if (type === 'ewc-player') {
        if (typeof window.navCloseSearchUI === 'function') window.navCloseSearchUI();
        return openPlayerProfile(name);
      }
      return typeof originalSelect === 'function' ? originalSelect(type, name) : null;
    };
  }

  window.loadEWCData = loadData;
  window.refreshEWCCompetitionData = () => Promise.allSettled([refreshCompetitionData(true), refreshLogoData(true)]);
  window.renderEWCPageIfVisible = renderActivePage;
  window.renderEWCTeams = renderTeams;
  window.renderEWCKills = renderKills;
  window.openEWCTeamProfile = openTeamProfile;
  window.openEWCPlayerProfile = openPlayerProfile;

  document.addEventListener('DOMContentLoaded', () => {
    patchNavigation();
    const hash = String(location.hash || '').replace(/^#/, '');
    const shouldLoadNow = hash.startsWith('ewc') || PAGE_IDS.has(document.querySelector('.page.active')?.id || '');
    const init = () => loadData().then(() => {
      if (!resolveHash(hash)) renderActivePage();
    }).catch(() => renderLoadError(document.querySelector('.page.active')?.id || ''));

    if (shouldLoadNow) init();
    else (window.cffRunWhenIdle || function (callback) { return setTimeout(callback, 4500); })(init, 4500);
  });
})();
