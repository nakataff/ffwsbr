(() => {
  'use strict';

  const CONFIG = window.FFWS_BR_2026_S1_CONFIG || {};
  const ROOT_ID = 'ffws-br-s1-classificatoria-root';
  let lastRows = [];
  const mvpFilters = { stage: ['classificatoria'], team: [], role: [], rookie: [], day: [] };
  let mvpOpenFilter = null;

  const number = value => Number(value) || 0;
  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const jsAttr = value => String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  function legacyReady() {
    try {
      return typeof db !== 'undefined' && Array.isArray(db?.teams) && db.teams.length > 0
        && typeof getAggregatedTeams === 'function';
    } catch (_) {
      return false;
    }
  }

  function logoFor(name) {
    try {
      if (typeof getTeamLogoSafe === 'function') return getTeamLogoSafe(name);
      if (typeof logos !== 'undefined' && logos?.[name]) return logos[name];
    } catch (_) {}
    return 'escudo.webp';
  }

  function shortFor(name) {
    try {
      if (typeof shortNames !== 'undefined' && shortNames?.[name]) return shortNames[name];
    } catch (_) {}
    return name;
  }

  function selectedDays() {
    try { return Array.isArray(selectedTeamDays) ? selectedTeamDays.map(String) : []; }
    catch (_) { return []; }
  }

  function selectedDrops() {
    try { return typeof getSelectedTeamQuedasArray === 'function' ? getSelectedTeamQuedasArray().map(String) : []; }
    catch (_) { return []; }
  }

  function hasMapFilter() {
    try {
      const select = document.getElementById('filter-team-map');
      if (!select) return false;
      if (typeof getMultiSelectRawState === 'function') return getMultiSelectRawState('filter-team-map').length > 0;
      return select.value && select.value !== 'all';
    } catch (_) { return false; }
  }

  function standardizedRows() {
    if (!legacyReady()) return [];
    let source;
    try { source = getAggregatedTeams(selectedDays()); }
    catch (_) { source = db.teams.map(team => ({ ...team })); }

    const dayFiltered = selectedDays().length > 0;
    const dropList = selectedDrops();
    const singleDrop = dropList.length === 1;
    const filtered = dayFiltered || dropList.length > 0 || hasMapFilter();

    if (dayFiltered) source = source.filter(team => !team.didNotPlay);
    source = source.slice().sort((a, b) => {
      if (!filtered && number(a.posGeral) && number(b.posGeral)) return number(a.posGeral) - number(b.posGeral);
      return number(b.pontos) - number(a.pontos)
        || number(b.booyah) - number(a.booyah)
        || number(b.abates) - number(a.abates)
        || String(a.equipe || '').localeCompare(String(b.equipe || ''), 'pt-BR');
    });

    return source.map((team, index) => ({
      team: team.equipe,
      group: team.grupo || '—',
      position: filtered ? index + 1 : (number(team.posGeral) || index + 1),
      points: number(team.pontos),
      booyahs: number(team.booyah),
      kills: number(team.abates),
      matches: number(team.quedas),
      singleDrop,
      dropPlacement: number(team.posicaoQueda),
      placementPoints: number(team.pontosPosicao),
      hasData: number(team.quedas) > 0 || number(team.pontos) > 0
    }));
  }

  function participantGroups() {
    const layout = CONFIG.layout?.classificatoria || {};
    const names = Array.isArray(layout.groups) ? layout.groups : ['A', 'B', 'C', 'D'];
    if (!legacyReady()) return [];
    return names.map(group => ({
      label: `Grupo ${group}`,
      teams: db.teams
        .filter(team => String(team.grupo || '').toUpperCase() === String(group).toUpperCase())
        .slice()
        .sort((a, b) => number(b.pontos) - number(a.pontos) || String(a.equipe).localeCompare(String(b.equipe), 'pt-BR'))
    }));
  }

  function renderGroupTables(rows = lastRows) {
    const root = document.getElementById('groups-tables-grid');
    if (!root) return;
    const groups = CONFIG.layout?.classificatoria?.groups || ['A', 'B', 'C', 'D'];
    const singleDrop = rows.some(row => row.singleDrop);
    root.innerHTML = groups.map(group => {
      const groupRows = rows.filter(row => String(row.group).toUpperCase() === String(group).toUpperCase());
      return `<div class="group-table-card">
        <h3>GRUPO ${escapeHtml(group)}</h3>
        <div style="overflow-x:auto;">
          <table style="font-size:0.9em;margin-bottom:0;">
            <thead><tr>
              <th style="padding:8px" title="Posição Geral">#</th>
              <th style="padding:8px;text-align:left;">TIME</th>
              <th style="padding:8px">PTS</th>
              <th style="padding:8px" title="Booyahs">B!</th>
              <th style="padding:8px">KILLS</th>
              <th style="padding:8px" title="${singleDrop ? 'Colocação (Pontos de Posição)' : 'Quedas Jogadas'}">${singleDrop ? 'C (Pts)' : 'Q'}</th>
            </tr></thead>
            <tbody>${groupRows.map(row => `<tr>
              <td style="padding:6px;color:#aaa;font-weight:bold;">${row.position}º</td>
              <td style="padding:6px;font-weight:bold;text-align:left;"><span class="clickable" onclick="openTeamProfile('${jsAttr(row.team)}')">${escapeHtml(shortFor(row.team))}</span></td>
              <td style="padding:6px;color:var(--accent);">${row.points}</td>
              <td style="padding:6px;">${row.booyahs}</td>
              <td style="padding:6px;">${row.kills}</td>
              <td style="padding:6px;color:var(--text-muted);">${singleDrop ? `${row.dropPlacement || '—'}º (${row.placementPoints})` : row.matches}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
    }).join('');
  }

  function refreshLegacyFilterWidgets() {
    try { if (typeof buildDayFilters === 'function') buildDayFilters(); } catch (_) {}
    try { if (typeof buildExtraMultiSelectFilters === 'function') buildExtraMultiSelectFilters(); } catch (_) {}
    try { if (typeof updateQuedaFilterOptions === 'function') updateQuedaFilterOptions(); } catch (_) {}
  }

  function renderClassificatoria() {
    const keepDropMenuOpen = document.getElementById('filter-queda-menu')?.style.display === 'grid';
    const root = document.getElementById(ROOT_ID);
    if (!root) return false;
    if (!legacyReady()) {
      root.innerHTML = '<div class="ffws-s2-empty"><div><strong>Carregando WB 2026 S1...</strong></div></div>';
      return false;
    }
    const engine = window.FFWSBRSeasonEngine || window.FFWSBRSeasonLayout;
    if (!engine?.renderClassification) return false;

    const layout = CONFIG.layout?.classificatoria || {};
    lastRows = standardizedRows();
    const singleDrop = lastRows.some(row => row.singleDrop);

    engine.renderClassification({
      rootId: ROOT_ID,
      pageClass: 'ffws-s1-classificatoria-page',
      participants: {
        mode: 'groups',
        title: layout.participantsTitle || 'Divisão de Grupos',
        containerId: 'groups-container',
        groups: participantGroups(),
        nameResolver: team => team?.equipe || team?.name || 'A definir',
        shortResolver: team => shortFor(team?.equipe || team?.name || ''),
        logoResolver: full => logoFor(full)
      },
      format: layout.format || {},
      classificationTitle: layout.classificationTitle || 'Classificação Geral',
      filters: {
        period: { mode: 'container', label: 'Filtrar por Dias:', containerId: 'team-day-filters' },
        map: {
          id: 'filter-team-map', label: 'Mapa:', onchange: 'onMapFilterChanged()', selected: 'all',
          options: [{ value: 'all', label: 'Todos os Mapas' }].concat(layout.maps || [])
        },
        drop: {
          containerId: 'queda-filter-container', id: 'filter-queda', label: 'Queda Específica:',
          onchange: 'onQuedaFilterChanged()', visible: selectedDays().length > 0, selected: 'all',
          options: [{ value: 'all', label: 'Todas as Quedas do Período' }]
        }
      },
      table: {
        id: 'table-teams-full',
        autoRank: false,
        zones: layout.zones || [],
        rows: lastRows,
        resolveTeamName: name => name,
        resolveShortName: name => shortFor(name),
        resolveLogo: name => logoFor(name),
        columns: [
          { key: 'position', label: '#' },
          { key: 'team', label: 'E', numeric: false },
          { key: 'group', label: 'GP', hideMobile: true, numeric: false },
          { key: 'points', label: 'PTS', accent: true },
          { key: 'booyahs', label: 'B', hideMobile: true },
          { key: 'kills', label: 'K', hideMobile: true },
          {
            key: 'matchesDisplay', label: singleDrop ? 'C' : 'Q', title: singleDrop ? 'Colocação (Pontos de Posição)' : 'Quedas Jogadas',
            value: row => singleDrop ? `${row.dropPlacement || '—'}º (${row.placementPoints})` : row.matches
          }
        ]
      },
      afterTableHtml: '<h2 style="margin-top:50px;">Classificação por Grupos</h2><div class="groups-tables-grid" id="groups-tables-grid"></div>'
    });

    refreshLegacyFilterWidgets();
    if (keepDropMenuOpen) { try { if (typeof keepTeamQuedaMenuOpen === 'function') keepTeamQuedaMenuOpen(); } catch (_) {} }
    renderGroupTables(lastRows);
    return true;
  }



  function normalizeRole(value) {
    try { if (typeof normalizePlayerRole === 'function') return String(normalizePlayerRole(value) || '').toUpperCase(); } catch (_) {}
    const role = String(value || '').trim().toUpperCase();
    if (role.includes('GRAN')) return 'GRAN';
    if (role.includes('SUP')) return 'SUP';
    if (role.includes('RUSH')) return 'RUSH';
    return role || 'RUSH';
  }

  function roleForPlayer(name) {
    try { if (typeof cffGetPlayerRoleForMvpFilter === 'function') return normalizeRole(cffGetPlayerRoleForMvpFilter(name)); } catch (_) {}
    return 'RUSH';
  }

  function rookieForPlayer(name) {
    try { return typeof isRookiePlayer === 'function' ? Boolean(isRookiePlayer(name)) : false; }
    catch (_) { return false; }
  }

  function mvpEntries() {
    const stages = ['classificatoria', 'final'];
    const out = [];
    stages.forEach(stage => {
      let rows = [];
      try {
        if (typeof cffGetPlayerDailyByStage === 'function') rows = cffGetPlayerDailyByStage(stage) || [];
        else if (stage === 'classificatoria' && typeof db !== 'undefined') rows = db.playerDaily || [];
      } catch (_) {}
      (rows || []).forEach(row => {
        const sourceName = row.jogador || row.nome || row.player || '';
        if (!sourceName) return;
        let official = null;
        try { if (typeof cffFindOfficialPlayerForMvp === 'function') official = cffFindOfficialPlayerForMvp(sourceName); } catch (_) {}
        const name = official?.jogador || sourceName;
        const team = String(row.equipe || row.team || '').trim() || official?.equipe || '';
        out.push({
          name,
          team,
          stage,
          day: String(row.dia || row.day || ''),
          kills: number(row.abates ?? row.kills),
          damage: number(row.dano ?? row.damage),
          assists: number(row.assists ?? row.assistencias),
          matches: number(row.quedas ?? row.matches),
          mvps: number(row.mvp ?? row.mvps),
          role: roleForPlayer(name),
          rookie: rookieForPlayer(name)
        });
      });
    });
    return out;
  }

  function mvpFilterOptions(entries) {
    const layout = CONFIG.layout?.mvp || {};
    const teams = [...new Set(entries.map(entry => entry.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const days = [...new Set(entries.map(entry => number(entry.day)).filter(Boolean))].sort((a, b) => a - b);
    return {
      stage: layout.stages || [{ value: 'classificatoria', label: 'Classificatória' }, { value: 'final', label: 'Final' }],
      team: teams.map(team => ({ value: team, label: team })),
      role: layout.roles || [{ value: 'RUSH', label: 'Rush' }, { value: 'SUP', label: 'Suporte' }, { value: 'GRAN', label: 'Granadeiro' }],
      rookie: layout.rookies || [{ value: 'rookie', label: 'Apenas novatos' }, { value: 'veteran', label: 'Sem novatos' }],
      day: days.map(day => ({ value: String(day), label: `Dia ${day}` }))
    };
  }

  function filteredMvpRows(entries) {
    const filtered = entries.filter(entry => {
      const rookieMatch = !mvpFilters.rookie.length
        || (mvpFilters.rookie.includes('rookie') && entry.rookie)
        || (mvpFilters.rookie.includes('veteran') && !entry.rookie);
      return (!mvpFilters.stage.length || mvpFilters.stage.includes(String(entry.stage)))
        && (!mvpFilters.team.length || mvpFilters.team.some(team => String(team).toUpperCase() === String(entry.team).toUpperCase()))
        && (!mvpFilters.role.length || mvpFilters.role.includes(normalizeRole(entry.role)))
        && rookieMatch
        && (!mvpFilters.day.length || mvpFilters.day.includes(String(entry.day)));
    });
    const aggregate = new Map();
    filtered.forEach(entry => {
      const key = `${String(entry.name).toUpperCase()}__${String(entry.team).toUpperCase()}`;
      if (!aggregate.has(key)) aggregate.set(key, { name: entry.name, team: entry.team, kills: 0, damage: 0, assists: 0, matches: 0, mvps: 0 });
      const row = aggregate.get(key);
      row.kills += number(entry.kills);
      row.damage += number(entry.damage);
      row.assists += number(entry.assists);
      row.matches += number(entry.matches);
      row.mvps += number(entry.mvps);
    });
    return [...aggregate.values()].filter(row => row.matches > 0).sort((a, b) => b.kills - a.kills || b.damage - a.damage || b.assists - a.assists || a.name.localeCompare(b.name, 'pt-BR'));
  }

  function reopenMvpMenu() {
    if (!mvpOpenFilter) return;
    const menu = document.getElementById(`ffws-s1-mvp-multi-${mvpOpenFilter}`);
    if (menu) menu.hidden = false;
  }

  function renderMvp() {
    const root = document.getElementById('ffws-br-s1-mvp-root');
    if (!root) return false;
    const engine = window.FFWSBRSeasonEngine || window.FFWSBRSeasonLayout;
    if (!engine?.renderMvp) return false;
    const entries = mvpEntries();
    const options = mvpFilterOptions(entries);
    const rows = filteredMvpRows(entries);
    const layout = CONFIG.layout?.mvp || {};
    engine.renderMvp({
      rootId: 'ffws-br-s1-mvp-root',
      pageClass: 'ffws-s1-mvp-page',
      hero: { kicker: layout.heroKicker || 'FFWS BRASIL 2026 SPLIT 1', title: layout.heroTitle || 'Ranking MVP', subtitle: layout.heroSubtitle || 'Classificação individual da WB 2026 S1' },
      section: { title: layout.title || 'Classificação Geral de Jogadores', description: layout.description || 'Filtre o ranking pelos dados disponíveis.' },
      playerCountLabel: `${rows.length} jogadores`,
      filters: [
        { key: 'stage', title: 'Etapa', options: options.stage, selected: mvpFilters.stage, menuId: 'ffws-s1-mvp-multi-stage' },
        { key: 'team', title: 'Equipe', options: options.team, selected: mvpFilters.team, menuId: 'ffws-s1-mvp-multi-team' },
        { key: 'role', title: 'Posição', options: options.role, selected: mvpFilters.role, menuId: 'ffws-s1-mvp-multi-role' },
        { key: 'rookie', title: 'Novatos', options: options.rookie, selected: mvpFilters.rookie, menuId: 'ffws-s1-mvp-multi-rookie' },
        { key: 'day', title: 'Dias', options: options.day, selected: mvpFilters.day, menuId: 'ffws-s1-mvp-multi-day' }
      ],
      handlers: { toggle: 'toggleFFWSBRS1MvpMulti', clear: 'clearFFWSBRS1MvpMulti', set: 'setFFWSBRS1MvpMulti' },
      resolveTeamName: name => name,
      resolveShortName: name => shortFor(name),
      resolveLogo: name => logoFor(name),
      openPlayerHandler: 'openPlayerProfile',
      openTeamHandler: 'openTeamProfile',
      rows
    });
    reopenMvpMenu();
    return true;
  }

  function toggleMvpMulti(key) {
    const menu = document.getElementById(`ffws-s1-mvp-multi-${key}`);
    const willOpen = !!menu && menu.hidden;
    mvpOpenFilter = willOpen ? key : null;
    document.querySelectorAll('[id^="ffws-s1-mvp-multi-"]').forEach(item => { if (item.id !== `ffws-s1-mvp-multi-${key}`) item.hidden = true; });
    if (menu) menu.hidden = !willOpen;
  }

  function clearMvpMulti(key) {
    if (!Array.isArray(mvpFilters[key])) return;
    mvpFilters[key] = [];
    mvpOpenFilter = key;
    renderMvp();
  }

  function setMvpMulti(key, value, checked) {
    if (!Array.isArray(mvpFilters[key])) return;
    const selected = new Set(mvpFilters[key]);
    checked ? selected.add(String(value)) : selected.delete(String(value));
    mvpFilters[key] = [...selected];
    mvpOpenFilter = key;
    renderMvp();
  }

  function installLegacyCompatibility() {
    window.renderFullTeams = renderClassificatoria;
    window.renderGroupsTables = () => renderGroupTables(lastRows.length ? lastRows : standardizedRows());
    try { renderFullTeams = window.renderFullTeams; } catch (_) {}
    try { renderGroupsTables = window.renderGroupsTables; } catch (_) {}
  }

  function activate() {
    installLegacyCompatibility();
    if (renderClassificatoria()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (renderClassificatoria() || tries >= 80) clearInterval(timer);
    }, 100);
  }

  window.toggleFFWSBRS1MvpMulti = toggleMvpMulti;
  window.clearFFWSBRS1MvpMulti = clearMvpMulti;
  window.setFFWSBRS1MvpMulti = setMvpMulti;

  window.FFWSBRS1 = Object.freeze({
    activate,
    renderClassificatoria,
    renderGroupTables,
    renderMvp
  });

  installLegacyCompatibility();
})();
