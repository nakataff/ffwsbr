(() => {
  'use strict';

  const S1_PAGES = new Set([
    'tabela',
    'mvp',
    'final',
    'equipes',
    'datas',
    'selecao-da-semana',
    'stats',
    'notas-cff',
    'comparar-1v1'
  ]);
  const S1_MOBILE_PAGES = new Set(['tabela', 'mvp', 'stats', 'equipes', 'datas', 'final']);
  const FINAL_POINTS = Object.freeze({ 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0 });
  const FINAL_CHAMPION = 'LOUD SNICKERS';

  const repairState = new Map();
  const loadedScripts = new Map();
  const finalSelectedDrops = new Set();
  let legacyPromise = null;
  let s1ModulePromise = null;

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const num = value => Number(value) || 0;
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const jsAttr = value => String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  function getActiveS1Page() {
    const hash = String(location.hash || '').replace(/^#/, '');
    if (S1_PAGES.has(hash)) return hash;
    const active = document.querySelector('.page.active')?.id || '';
    return S1_PAGES.has(active) ? active : '';
  }

  function loadClassicScript(src) {
    if (loadedScripts.has(src)) return loadedScripts.get(src);

    const existing = [...document.scripts].find(script => {
      const raw = script.getAttribute('src') || '';
      return raw === src || raw.split('?')[0] === src.split('?')[0];
    });
    if (existing) {
      const ready = Promise.resolve(src);
      loadedScripts.set(src, ready);
      return ready;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve(src);
      script.onerror = () => {
        loadedScripts.delete(src);
        reject(new Error(`Falha ao carregar ${src}`));
      };
      document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
  }

  async function ensureS1Module() {
    if (window.FFWSBRS1?.renderClassificatoria) return true;
    if (!s1ModulePromise) {
      s1ModulePromise = (async () => {
        if (!window.FFWS_BR_2026_S1_CONFIG) {
          await loadClassicScript('ffws-br-2026-s1/config.js?v=20260907-s1-repair-v2');
        }
        if (!window.FFWSBRS1?.renderClassificatoria) {
          await loadClassicScript('ffws-br-2026-s1/s1.js?v=20260907-s1-repair-v2');
        }
        return Boolean(window.FFWSBRS1?.renderClassificatoria);
      })().catch(error => {
        s1ModulePromise = null;
        throw error;
      });
    }
    return s1ModulePromise;
  }

  async function ensureLegacyReady() {
    if (!legacyPromise) {
      legacyPromise = (async () => {
        const deadline = Date.now() + 15000;
        while (typeof window.cffEnsureLegacy !== 'function' && Date.now() < deadline) {
          await delay(50);
        }
        if (typeof window.cffEnsureLegacy !== 'function') {
          throw new Error('cffEnsureLegacy indisponível');
        }

        await window.cffEnsureLegacy();

        if (window.cffCoreReady && typeof window.cffCoreReady.then === 'function') {
          await Promise.race([window.cffCoreReady, delay(15000)]);
        }

        await ensureS1Module();
        return true;
      })().catch(error => {
        legacyPromise = null;
        throw error;
      });
    }
    return legacyPromise;
  }

  function prepareLegacyFilters() {
    try { window.buildDayFilters?.(); } catch (_) {}
    try { window.populateSelects?.(); } catch (_) {}
    try { window.buildExtraMultiSelectFilters?.(); } catch (_) {}
  }

  function getTeamLogo(name) {
    try {
      if (typeof window.getTeamLogoSafe === 'function') {
        const logo = window.getTeamLogoSafe(name);
        if (logo) return logo;
      }
    } catch (_) {}
    try {
      if (typeof logos !== 'undefined' && logos?.[name]) return logos[name];
    } catch (_) {}
    return 'escudo.webp';
  }

  function finalDropRows() {
    let source = {};
    try {
      if (typeof window.cffGetStageQuedas === 'function') source = window.cffGetStageQuedas('final') || {};
      else if (typeof dbFinalQuedas !== 'undefined') source = dbFinalQuedas || {};
    } catch (_) {}

    const rows = [];
    Object.entries(source || {}).forEach(([day, drops]) => {
      Object.entries(drops || {}).forEach(([dropNo, drop]) => {
        rows.push({
          key: `${day}-${dropNo}`,
          day: String(day),
          drop: String(dropNo),
          map: String(drop?.mapa || drop?.map || ''),
          results: Array.isArray(drop?.resultados) ? drop.resultados : []
        });
      });
    });

    return rows.sort((a, b) => num(a.day) - num(b.day) || num(a.drop) - num(b.drop));
  }

  function getFinalBaseFilteredDrops(allDrops) {
    const day = document.getElementById('final-day-filter')?.value || 'all';
    const map = document.getElementById('final-map-filter')?.value || 'all';

    return allDrops.filter(drop =>
      (day === 'all' || drop.day === String(day)) &&
      (map === 'all' || drop.map === String(map))
    );
  }

  function getFinalFilteredDrops(allDrops) {
    const base = getFinalBaseFilteredDrops(allDrops);
    if (!finalSelectedDrops.size) return base;
    return base.filter(drop => finalSelectedDrops.has(drop.key));
  }

  function aggregateFinal(drops) {
    const teams = new Map();

    drops.forEach(drop => {
      drop.results.forEach(result => {
        const name = String(result?.equipe || result?.team || '').trim();
        if (!name) return;

        if (!teams.has(name)) {
          teams.set(name, { team: name, points: 0, booyahs: 0, kills: 0, matches: 0 });
        }

        const row = teams.get(name);
        const kills = num(result?.kills ?? result?.abates);
        const placement = num(result?.posicao ?? result?.position);
        const placementPoints = FINAL_POINTS[placement] || 0;
        const isBooyah = Boolean(num(result?.booyah)) || placement === 1;

        row.kills += kills;
        row.points += kills + placementPoints;
        row.booyahs += isBooyah ? 1 : 0;
        row.matches += 1;
      });
    });

    const day = document.getElementById('final-day-filter')?.value || 'all';
    const map = document.getElementById('final-map-filter')?.value || 'all';
    const fullFinal = day === 'all' && map === 'all' && finalSelectedDrops.size === 0;

    return [...teams.values()].sort((a, b) => {
      if (fullFinal) {
        if (a.team === FINAL_CHAMPION && b.team !== FINAL_CHAMPION) return -1;
        if (b.team === FINAL_CHAMPION && a.team !== FINAL_CHAMPION) return 1;
      }
      return b.points - a.points
        || b.booyahs - a.booyahs
        || b.kills - a.kills
        || a.team.localeCompare(b.team, 'pt-BR');
    });
  }

  function renderFinalDropMenu(allDrops) {
    const menu = document.getElementById('final-drop-menu');
    const toggle = document.getElementById('final-drop-toggle');
    if (!menu || !toggle) return;

    const available = getFinalBaseFilteredDrops(allDrops);
    const availableKeys = new Set(available.map(drop => drop.key));
    [...finalSelectedDrops].forEach(key => {
      if (!availableKeys.has(key)) finalSelectedDrops.delete(key);
    });

    const count = finalSelectedDrops.size;
    toggle.textContent = count
      ? `${count} QUEDA${count === 1 ? '' : 'S'} SELECIONADA${count === 1 ? '' : 'S'}`
      : 'TODAS AS QUEDAS';

    if (!available.length) {
      menu.innerHTML = '<div style="padding:12px;color:var(--text-muted);">Nenhuma queda disponível.</div>';
      return;
    }

    menu.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-bottom:1px solid var(--border);">
        <strong style="font-size:.78rem;">Selecionar quedas</strong>
        <button type="button" class="btn-action" style="padding:5px 8px;font-size:.7rem;" onclick="cffFinalClearDropFilter()">Limpar</button>
      </div>
      ${available.map(drop => `
        <label style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;">
          <input type="checkbox" ${finalSelectedDrops.has(drop.key) ? 'checked' : ''} onchange="cffFinalToggleDropSelection('${jsAttr(drop.key)}', this.checked)">
          <span>Dia ${esc(drop.day)} • Q${esc(drop.drop)}${drop.map ? ` • ${esc(drop.map)}` : ''}</span>
        </label>
      `).join('')}
    `;
  }

  function renderFinalTable() {
    const tbody = document.querySelector('#final-teams-table tbody');
    if (!tbody) return false;

    const allDrops = finalDropRows();
    if (!allDrops.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Carregando dados da final...</td></tr>';
      return false;
    }

    renderFinalDropMenu(allDrops);
    const drops = getFinalFilteredDrops(allDrops);
    const rows = aggregateFinal(drops);

    tbody.innerHTML = rows.length ? rows.map((row, index) => {
      const champion = row.team === FINAL_CHAMPION
        && (document.getElementById('final-day-filter')?.value || 'all') === 'all'
        && (document.getElementById('final-map-filter')?.value || 'all') === 'all'
        && finalSelectedDrops.size === 0;
      return `
        <tr${champion ? ' class="final-champion-row"' : ''}>
          <td style="${champion ? 'color:#ffd700;font-weight:950;' : ''}">${index + 1}º</td>
          <td class="team-cell" style="text-align:left;">
            <img src="${esc(getTeamLogo(row.team))}" class="team-logo clickable" alt="${esc(row.team)}" onerror="this.onerror=null;this.src='escudo.webp'" onclick="openTeamProfile('${jsAttr(row.team)}')">
            <span class="clickable" style="font-weight:900;${champion ? 'color:#ffd700;' : ''}" onclick="openTeamProfile('${jsAttr(row.team)}')">${esc(row.team)}</span>
            ${champion ? '<span style="margin-left:6px;color:#ffd700;font-size:.72em;font-weight:950;">CAMPEÃ</span>' : ''}
          </td>
          <td style="color:var(--accent);font-weight:950;">${row.points}</td>
          <td>${row.booyahs}</td>
          <td>${row.kills}</td>
          <td>${row.matches}</td>
        </tr>
      `;
    }).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhuma queda encontrada com estes filtros.</td></tr>';

    const summary = document.getElementById('final-live-summary');
    if (summary) {
      const day = document.getElementById('final-day-filter')?.value || 'all';
      const map = document.getElementById('final-map-filter')?.value || 'all';
      const filterText = [
        day === 'all' ? 'Geral' : `Dia ${day}`,
        map === 'all' ? 'Todos os mapas' : map,
        finalSelectedDrops.size ? `${finalSelectedDrops.size} queda${finalSelectedDrops.size === 1 ? '' : 's'}` : `${drops.length} quedas`
      ].join(' • ');
      summary.innerHTML = `<strong>${esc(filterText)}</strong><span>${rows.length} equipes com dados</span>`;
    }

    const probability = document.getElementById('final-probability-grid');
    if (probability) {
      probability.innerHTML = `
        <div class="home-confrontation-empty" style="grid-column:1/-1;">
          <strong style="color:#ffd700;">FINAL ENCERRADA</strong><br>
          ${esc(FINAL_CHAMPION)} foi a campeã da WB 2026 S1 pelo Champion Rush.
        </div>
      `;
    }

    return true;
  }

  function installFinalHandlers() {
    window.cffFinalOnDayFilterChanged = () => {
      finalSelectedDrops.clear();
      renderFinalTable();
    };
    window.cffFinalOnMapFilterChanged = () => {
      finalSelectedDrops.clear();
      renderFinalTable();
    };
    window.cffFinalToggleDropFilter = () => {
      const menu = document.getElementById('final-drop-menu');
      if (!menu) return;
      menu.style.display = menu.style.display === 'block' || menu.style.display === 'grid' ? 'none' : 'block';
    };
    window.cffFinalToggleDropSelection = (key, checked) => {
      if (checked) finalSelectedDrops.add(String(key));
      else finalSelectedDrops.delete(String(key));
      renderFinalTable();
    };
    window.cffFinalClearDropFilter = () => {
      finalSelectedDrops.clear();
      renderFinalTable();
    };
  }

  function renderPage(page) {
    try {
      prepareLegacyFilters();

      switch (page) {
        case 'tabela':
          if (window.FFWSBRS1?.renderClassificatoria) {
            window.FFWSBRS1.renderClassificatoria();
          } else {
            window.renderFullTeams?.();
            window.renderGroupsTables?.();
          }
          break;
        case 'mvp':
          window.renderAllPlayers?.();
          break;
        case 'final':
          installFinalHandlers();
          if (!renderFinalTable()) window.renderFinalPossibilities?.();
          break;
        case 'equipes':
          window.renderTeamsDirectory?.();
          break;
        case 'datas':
          window.renderSchedule?.();
          break;
        case 'selecao-da-semana':
          window.renderSelection?.();
          break;
        case 'stats':
          window.cffSyncStatsStageControls?.();
          window.renderTop5Stats?.();
          window.renderTableAvg?.();
          window.renderTableTotal?.();
          window.renderCFFStats?.();
          window.renderPlayerStats?.();
          window.buildMultiTeamFilters?.();
          window.renderMultiTeamChart?.();
          break;
        case 'notas-cff':
          window.renderNotasCFFPage?.();
          break;
        case 'comparar-1v1':
          window.renderCompareTeams?.();
          window.renderComparePlayers?.();
          break;
      }
    } catch (_) {}
  }

  async function repairPage(page) {
    page = String(page || getActiveS1Page()).trim();
    if (!S1_PAGES.has(page)) return;

    if (repairState.has(page)) return repairState.get(page);

    const task = (async () => {
      try {
        await ensureLegacyReady();
        renderPage(page);
        setTimeout(() => renderPage(page), 120);
        setTimeout(() => renderPage(page), 650);
        setTimeout(() => {
          if (page === 'stats') {
            try { window.buildMultiTeamFilters?.(); } catch (_) {}
            try { window.renderMultiTeamChart?.(); } catch (_) {}
          }
          if (page === 'final') renderFinalTable();
        }, 1100);
      } finally {
        setTimeout(() => repairState.delete(page), 300);
      }
    })().catch(() => {});

    repairState.set(page, task);
    return task;
  }

  function wrapNavigateFunction(name) {
    const base = window[name];
    if (typeof base !== 'function' || base.__cffS1RepairWrapped) return;

    const wrapped = function(page, ...args) {
      const result = base.call(this, page, ...args);
      if (S1_PAGES.has(String(page || '').trim())) {
        repairPage(page);
      }
      return result;
    };

    wrapped.__cffS1RepairWrapped = true;
    wrapped.__cffS1RepairBase = base;
    window[name] = wrapped;
  }

  function wrapMobileTab() {
    const base = window.mobileTabClick;
    if (typeof base !== 'function' || base.__cffS1RepairWrapped) return;

    const wrapped = function(key, button, ...args) {
      const target = String(key || '').trim();
      const activeS1 = getActiveS1Page();

      if (activeS1 && S1_MOBILE_PAGES.has(target)) {
        const result = typeof window.navigate === 'function'
          ? window.navigate(target)
          : base.call(this, key, button, ...args);
        document.querySelectorAll('.nav-mobile-tab').forEach(el => el.classList.remove('active'));
        button?.classList?.add('active');
        repairPage(target);
        return result;
      }

      return base.call(this, key, button, ...args);
    };

    wrapped.__cffS1RepairWrapped = true;
    wrapped.__cffS1RepairBase = base;
    window.mobileTabClick = wrapped;
  }

  function installWrappers() {
    wrapNavigateFunction('navigate');
    wrapNavigateFunction('navigateAndClose');
    wrapMobileTab();
    installFinalHandlers();
  }

  function bootRepair() {
    installWrappers();
    repairPage(getActiveS1Page());
  }

  document.addEventListener('cff:modules-loaded', () => {
    setTimeout(bootRepair, 0);
  });

  window.addEventListener('hashchange', () => {
    setTimeout(bootRepair, 0);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRepair, { once: true });
  } else {
    bootRepair();
  }

  let attempts = 0;
  const watchdog = setInterval(() => {
    attempts += 1;
    installWrappers();
    const page = getActiveS1Page();
    if (page) repairPage(page);
    if (attempts >= 40) clearInterval(watchdog);
  }, 250);

  window.cffRepairS1Page = repairPage;
  window.cffRenderS1Final = renderFinalTable;
})();