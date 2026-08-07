(() => {
  'use strict';

  const CONFIG = window.FFWS_BR_2026_S1_CONFIG || {};
  const ROOT_ID = 'ffws-br-s1-classificatoria-root';
  let lastRows = [];

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

  window.FFWSBRS1 = Object.freeze({
    activate,
    renderClassificatoria,
    renderGroupTables
  });

  installLegacyCompatibility();
})();
