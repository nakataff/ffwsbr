(() => {
  'use strict';

  const BUILD = '20260911-s1-multifilters-v1';
  const DATA_URL = `ffws-br-2026-s1/stages.json?v=${BUILD}`;
  const ROOT_SELECTOR = '#ffws-br-s1-classificatoria-root';
  const GROUPS = Object.freeze({
    'FLUXO W7M': 'A',
    'E1 SPORTS': 'A',
    'AXS FUSION': 'A',
    'LOOPS': 'A',
    'TEAM SOLID': 'B',
    'INFLUENCE RAGE': 'B',
    'VASCO ESPORTS': 'B',
    'CIVIS': 'B',
    'LOS': 'C',
    'LOUD SNICKERS': 'C',
    'INTZ': 'C',
    'RISE GAMING': 'C',
    'VIRTUS PRO': 'D',
    'ALPHA7': 'D',
    'RUSH GAMING': 'D',
    'ANGELS OUTPLAY': 'D'
  });
  const FALLBACK_POINTS = Object.freeze({
    1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5,
    7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0,
    13: 0, 14: 0, 15: 0, 16: 0
  });

  const state = {
    data: null,
    dataPromise: null,
    days: [],
    maps: [],
    drops: [],
    openFilter: null,
    scheduled: false
  };

  const num = value => Number(value) || 0;
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function injectCss() {
    if (document.getElementById('cff-s1-multifilter-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-s1-multifilter-css';
    style.textContent = `
      .s1fix-panel.s1mf-enabled{overflow:visible}
      .s1mf-filter{display:grid;gap:6px;min-width:0}
      .s1mf-filter>label{color:#91a7be;font-size:.68rem;font-weight:950;text-transform:uppercase;letter-spacing:.8px}
      .s1mf-menu{position:relative;min-width:0}
      .s1mf-menu summary{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;height:40px;padding:0 11px;border:1px solid var(--border,rgba(255,255,255,.12));border-radius:9px;background:#09111d;color:#fff;font-size:.82rem;font-weight:850;cursor:pointer;list-style:none;user-select:none}
      .s1mf-menu summary::-webkit-details-marker{display:none}
      .s1mf-menu summary::after{content:'⌄';color:#72a8d7;font-size:.9rem;transition:transform .16s ease}
      .s1mf-menu[open] summary{border-color:var(--accent,#00c8ff)}
      .s1mf-menu[open] summary::after{transform:rotate(180deg)}
      .s1mf-menu.is-disabled summary{opacity:.52;cursor:not-allowed}
      .s1mf-options{position:absolute;z-index:120;left:0;top:calc(100% + 6px);width:max(100%,240px);max-height:290px;overflow:auto;padding:6px;border:1px solid #263a54;border-radius:10px;background:#09111d;box-shadow:0 18px 45px rgba(0,0,0,.45)}
      .s1mf-option{display:flex!important;align-items:center;gap:9px;padding:9px 8px;border-radius:7px;color:#dcecff!important;font-size:.76rem!important;font-weight:800!important;letter-spacing:0!important;text-transform:none!important;cursor:pointer}
      .s1mf-option:hover{background:rgba(0,200,255,.08)}
      .s1mf-option input{width:16px;height:16px;margin:0;accent-color:var(--accent,#00c8ff);flex:none}
      .s1mf-option.s1mf-all{margin-bottom:4px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.08);border-radius:7px 7px 0 0}
      .s1mf-empty{padding:12px 10px;color:#7188a2;font-size:.74rem;font-weight:800;line-height:1.4}
      @media(max-width:800px){.s1mf-options{width:100%;min-width:0}}
    `;
    document.head.appendChild(style);
  }

  function loadData() {
    if (state.data) return Promise.resolve(state.data);
    if (!state.dataPromise) {
      state.dataPromise = fetch(DATA_URL, { cache: 'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error(`stages.json retornou ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (!Array.isArray(data?.teams) || !Array.isArray(data?.classificatoria?.days)) {
            throw new Error('Dados da classificatória inválidos');
          }
          state.data = data;
          return data;
        })
        .catch(error => {
          state.dataPromise = null;
          throw error;
        });
    }
    return state.dataPromise;
  }

  function flattenDrops(data) {
    const out = [];
    (data?.classificatoria?.days || []).forEach((dayDrops, dayIndex) => {
      (dayDrops || []).forEach((drop, dropIndex) => {
        const mapIndex = num(drop?.[0]);
        const results = Array.isArray(drop?.[1]) ? drop[1] : [];
        out.push({
          key: `${dayIndex + 1}-${dropIndex + 1}`,
          day: String(dayIndex + 1),
          drop: String(dropIndex + 1),
          map: data.maps?.[mapIndex] || 'Mapa',
          results: results.map(raw => {
            const placement = num(raw?.[2]);
            return {
              team: data.teams?.[num(raw?.[0])] || '',
              kills: num(raw?.[1]),
              placement,
              booyah: Boolean(num(raw?.[3])) || placement === 1
            };
          }).filter(row => row.team)
        });
      });
    });
    return out;
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function matches(value, selected) {
    return !selected.length || selected.includes(String(value));
  }

  function availableMaps(allDrops) {
    return unique(allDrops.filter(drop => matches(drop.day, state.days)).map(drop => drop.map));
  }

  function availableDropRows(allDrops) {
    if (!state.days.length) return [];
    return allDrops.filter(drop => matches(drop.day, state.days) && matches(drop.map, state.maps));
  }

  function pruneSelections(allDrops) {
    const validMaps = new Set(availableMaps(allDrops));
    state.maps = state.maps.filter(map => validMaps.has(map));
    const validDrops = new Set(availableDropRows(allDrops).map(drop => drop.key));
    state.drops = state.drops.filter(key => validDrops.has(key));
  }

  function selectedDropRows(allDrops) {
    return allDrops.filter(drop =>
      matches(drop.day, state.days)
      && matches(drop.map, state.maps)
      && matches(drop.key, state.drops)
    );
  }

  function pointFor(data, placement) {
    const source = data?.pointSystem || FALLBACK_POINTS;
    return num(source?.[placement] ?? source?.[String(placement)] ?? FALLBACK_POINTS[placement]);
  }

  function aggregate(data, selectedDrops) {
    const teams = new Map();
    const teamOrder = new Map((data.teams || []).map((team, index) => [team, index]));
    selectedDrops.forEach(drop => {
      drop.results.forEach(result => {
        if (!teams.has(result.team)) {
          teams.set(result.team, { team: result.team, points: 0, booyahs: 0, kills: 0, matches: 0 });
        }
        const row = teams.get(result.team);
        row.kills += result.kills;
        row.points += result.kills + pointFor(data, result.placement);
        row.booyahs += result.booyah ? 1 : 0;
        row.matches += 1;
      });
    });
    return [...teams.values()].sort((a, b) =>
      b.points - a.points
      || b.booyahs - a.booyahs
      || b.kills - a.kills
      || num(teamOrder.get(a.team)) - num(teamOrder.get(b.team))
      || a.team.localeCompare(b.team, 'pt-BR')
    );
  }

  function summaryLabel(type, selected) {
    if (!selected.length) {
      if (type === 'day') return 'Todos os dias';
      if (type === 'map') return 'Todos os mapas';
      return state.days.length ? 'Todas as quedas' : 'Selecione um dia';
    }
    if (selected.length === 1) {
      if (type === 'day') return `Dia ${selected[0]}`;
      if (type === 'map') return selected[0];
      return '1 queda selecionada';
    }
    if (type === 'day') return `${selected.length} dias selecionados`;
    if (type === 'map') return `${selected.length} mapas selecionados`;
    return `${selected.length} quedas selecionadas`;
  }

  function optionHtml(type, value, label, checked) {
    return `<label class="s1mf-option"><input type="checkbox" data-s1mf-type="${type}" data-s1mf-value="${esc(value)}"${checked ? ' checked' : ''}><span>${esc(label)}</span></label>`;
  }

  function filterHtml(type, label, selected, options, allLabel, disabled = false) {
    const open = state.openFilter === type && !disabled ? ' open' : '';
    const allChecked = selected.length === 0 ? ' checked' : '';
    return `
      <div class="s1mf-filter">
        <label>${esc(label)}</label>
        <details class="s1mf-menu${disabled ? ' is-disabled' : ''}" data-s1mf-menu="${type}"${open}>
          <summary>${esc(summaryLabel(type, selected))}</summary>
          <div class="s1mf-options">
            ${disabled
              ? '<div class="s1mf-empty">Selecione pelo menos um dia para listar somente as quedas desse período.</div>'
              : `<label class="s1mf-option s1mf-all"><input type="checkbox" data-s1mf-type="${type}" data-s1mf-all="1"${allChecked}><span>${esc(allLabel)}</span></label>${options.join('')}`}
          </div>
        </details>
      </div>`;
  }

  function getLogo(team) {
    try {
      if (typeof window.getTeamLogoSafe === 'function') return window.getTeamLogoSafe(team) || 'escudo.webp';
    } catch (_) {}
    return 'escudo.webp';
  }

  function statusClass(index, fullStage) {
    if (!fullStage) return '';
    const pos = index + 1;
    if (pos === 1) return 's1fix-status-ewc';
    if (pos <= 12) return 's1fix-status-final';
    if (pos <= 14) return 's1fix-status-out';
    return 's1fix-status-down';
  }

  function renderTable(shell, rows, fullStage) {
    const tbody = shell.querySelector('.s1fix-table tbody');
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="s1fix-empty">Nenhum dado encontrado com estes filtros.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((row, index) => `
      <tr class="${statusClass(index, fullStage)}">
        <td class="s1fix-rank ${index < 3 ? 'top' : ''}">${index + 1}º</td>
        <td class="s1fix-team"><button type="button" class="s1fix-team-btn" data-s1mf-team="${esc(row.team)}"><img src="${esc(getLogo(row.team))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='escudo.webp'"><span>${esc(row.team)}</span></button></td>
        <td>${esc(GROUPS[row.team] || '—')}</td>
        <td class="s1fix-points">${row.points}</td>
        <td>${row.booyahs}</td>
        <td>${row.kills}</td>
        <td>${row.matches}</td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-s1mf-team]').forEach(button => {
      button.addEventListener('click', () => {
        try { window.openTeamProfile?.(button.getAttribute('data-s1mf-team')); } catch (_) {}
      });
    });
  }

  function bindFilterEvents(shell, allDrops) {
    shell.querySelectorAll('[data-s1mf-menu]').forEach(details => {
      details.addEventListener('toggle', () => {
        if (!details.open) {
          if (state.openFilter === details.dataset.s1mfMenu) state.openFilter = null;
          return;
        }
        if (details.classList.contains('is-disabled')) {
          details.open = false;
          return;
        }
        state.openFilter = details.dataset.s1mfMenu;
        shell.querySelectorAll('[data-s1mf-menu]').forEach(other => {
          if (other !== details) other.open = false;
        });
      });
      if (details.classList.contains('is-disabled')) {
        details.querySelector('summary')?.addEventListener('click', event => event.preventDefault());
      }
    });

    shell.querySelectorAll('input[data-s1mf-type]').forEach(input => {
      input.addEventListener('change', () => {
        const type = input.dataset.s1mfType;
        state.openFilter = type;
        if (input.dataset.s1mfAll === '1') {
          state[`${type}s`] = [];
        } else {
          const key = `${type}s`;
          const value = String(input.dataset.s1mfValue || '');
          const next = new Set(state[key]);
          if (input.checked) next.add(value);
          else next.delete(value);
          state[key] = [...next];
        }
        pruneSelections(allDrops);
        render(shell, allDrops);
      });
    });
  }

  function render(shell, allDrops) {
    if (!shell?.isConnected) return;
    pruneSelections(allDrops);

    const dayCount = state.data?.classificatoria?.days?.length || 0;
    const days = Array.from({ length: dayCount }, (_, index) => String(index + 1));
    const maps = availableMaps(allDrops);
    const dropRows = availableDropRows(allDrops);

    const filterRoot = shell.querySelector('.s1fix-filters');
    if (filterRoot) {
      const dayOptions = days.map(day => optionHtml('day', day, `Dia ${day}`, state.days.includes(day)));
      const mapOptions = maps.map(map => optionHtml('map', map, map, state.maps.includes(map)));
      const dropOptions = dropRows.map(drop => optionHtml('drop', drop.key, `D${drop.day} • Q${drop.drop} • ${drop.map}`, state.drops.includes(drop.key)));
      filterRoot.innerHTML = [
        filterHtml('day', 'Dia', state.days, dayOptions, 'Todos os dias'),
        filterHtml('map', 'Mapa', state.maps, mapOptions, 'Todos os mapas'),
        filterHtml('drop', 'Queda', state.drops, dropOptions, 'Todas as quedas do período', !state.days.length)
      ].join('');
    }

    const selectedDrops = selectedDropRows(allDrops);
    const rows = aggregate(state.data, selectedDrops);
    const fullStage = !state.days.length && !state.maps.length && !state.drops.length;
    const kills = rows.reduce((sum, row) => sum + row.kills, 0);

    renderTable(shell, rows, fullStage);

    const metrics = shell.querySelectorAll('.s1fix-metric strong');
    if (metrics[0]) metrics[0].textContent = String(selectedDrops.length);
    if (metrics[1]) metrics[1].textContent = String(rows.length);
    if (metrics[2]) metrics[2].textContent = String(kills);

    const head = shell.querySelector('.s1fix-panel-head');
    if (head) {
      const status = head.querySelector('div span');
      if (status) status.textContent = fullStage ? 'Resultado completo da etapa' : 'Resultado recalculado conforme os filtros';
      const count = head.lastElementChild;
      if (count && count.tagName === 'SPAN') count.textContent = `${selectedDrops.length} queda${selectedDrops.length === 1 ? '' : 's'}`;
    }

    const legend = shell.querySelector('.s1fix-legend');
    if (legend) legend.style.display = fullStage ? '' : 'none';

    bindFilterEvents(shell, allDrops);
  }

  async function enhance() {
    state.scheduled = false;
    const shell = document.querySelector(`${ROOT_SELECTOR} [data-s1-direct="classificatoria"]`);
    if (!shell || shell.dataset.s1MultifilterEnhanced === '1') return;

    try {
      injectCss();
      const data = await loadData();
      if (!shell.isConnected) return;
      state.data = data;
      const allDrops = flattenDrops(data);
      shell.dataset.s1MultifilterEnhanced = '1';
      shell.querySelector('.s1fix-panel')?.classList.add('s1mf-enabled');
      render(shell, allDrops);
    } catch (error) {
      console.error('[S1 multi-filters]', error);
    }
  }

  function scheduleEnhance() {
    if (state.scheduled) return;
    state.scheduled = true;
    setTimeout(enhance, 0);
  }

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleEnhance);
  document.addEventListener('cff:modules-loaded', scheduleEnhance);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleEnhance, { once: true });
  else scheduleEnhance();
})();
