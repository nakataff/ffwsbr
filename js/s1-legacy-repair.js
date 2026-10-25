(() => {
  'use strict';

  const BUILD = '20260907-s1-standalone-v3';
  const S1_PAGES = new Set([
    'tabela', 'mvp', 'final', 'equipes', 'datas',
    'selecao-da-semana', 'stats', 'notas-cff', 'comparar-1v1'
  ]);
  const DIRECT_PAGES = new Set(['tabela', 'final']);
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
  const LOGOS = Object.freeze({
    'ALPHA7': 'A7 2.webp',
    'AXS FUSION': 'AXS BRANCA.webp',
    'CIVIS': 'Civis.webp',
    'E1 SPORTS': 'E1.webp',
    'FLUXO W7M': 'Fluxo 2.webp',
    'INFLUENCE RAGE': 'Influence Rage.webp',
    'INTZ': 'Intz 1.webp',
    'LOOPS': 'Loops 1.webp',
    'LOS': 'Los.webp',
    'LOUD SNICKERS': 'loud 2.webp',
    'ANGELS OUTPLAY': 'Outplay.webp',
    'RISE GAMING': 'Rise 1.webp',
    'RUSH GAMING': 'Rush.webp',
    'TEAM SOLID': 'Team Solid 2.webp',
    'VASCO ESPORTS': 'Vasco.webp',
    'VIRTUS PRO': 'Virtus Pro.webp'
  });
  const FALLBACK_POINTS = Object.freeze({
    1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5,
    7: 4, 8: 3, 9: 2, 10: 1, 11: 0, 12: 0,
    13: 0, 14: 0, 15: 0, 16: 0
  });

  const state = {
    dataPromise: null,
    data: null,
    legacyPromise: null,
    filters: {
      classificatoria: { day: 'all', map: 'all', drop: 'all' },
      final: { day: 'all', map: 'all', drop: 'all' }
    }
  };

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const num = value => Number(value) || 0;
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function getActiveS1Page() {
    const hash = String(location.hash || '').replace(/^#/, '');
    if (S1_PAGES.has(hash)) return hash;
    const active = document.querySelector('.page.active')?.id || '';
    return S1_PAGES.has(active) ? active : '';
  }

  function injectCss() {
    if (document.getElementById('cff-s1-standalone-css')) return;
    const style = document.createElement('style');
    style.id = 'cff-s1-standalone-css';
    style.textContent = `
      .s1fix-shell{display:grid;gap:18px;max-width:1400px;margin:0 auto;padding:4px 0 28px}
      .s1fix-hero{position:relative;overflow:hidden;border:1px solid rgba(0,200,255,.22);border-radius:18px;background:linear-gradient(135deg,rgba(0,200,255,.12),rgba(7,13,24,.92) 45%,rgba(255,255,255,.02));padding:24px}
      .s1fix-hero::after{content:"";position:absolute;right:-90px;top:-130px;width:290px;height:290px;border-radius:50%;background:rgba(0,200,255,.08);filter:blur(2px);pointer-events:none}
      .s1fix-kicker{color:var(--accent,#00c8ff);font-size:.76rem;font-weight:1000;letter-spacing:1.7px;text-transform:uppercase}
      .s1fix-hero h1{position:relative;z-index:1;margin:7px 0 8px;color:#fff;font-size:clamp(1.7rem,4vw,2.7rem);line-height:1;font-weight:1000;text-transform:uppercase}
      .s1fix-hero p{position:relative;z-index:1;margin:0;color:#9eb5ce;font-weight:750;line-height:1.5}
      .s1fix-champion{display:inline-flex;align-items:center;gap:8px;margin-top:15px;padding:8px 12px;border:1px solid rgba(255,215,0,.32);border-radius:999px;background:rgba(255,215,0,.08);color:#ffd700;font-weight:1000;font-size:.8rem;text-transform:uppercase}
      .s1fix-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .s1fix-metric{min-width:0;padding:14px;border:1px solid var(--border,rgba(255,255,255,.1));border-radius:13px;background:var(--panel-bg,#0d1420)}
      .s1fix-metric small{display:block;color:#7f93aa;font-size:.67rem;font-weight:950;letter-spacing:1px;text-transform:uppercase}
      .s1fix-metric strong{display:block;margin-top:5px;color:#fff;font-size:1.28rem;font-weight:1000}
      .s1fix-panel{border:1px solid var(--border,rgba(255,255,255,.1));border-radius:16px;background:var(--panel-bg,#0d1420);overflow:hidden}
      .s1fix-panel-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;padding:18px 18px 12px;border-bottom:1px solid var(--border,rgba(255,255,255,.1))}
      .s1fix-panel-head h2{margin:0;color:#fff;font-size:1.05rem;text-transform:uppercase}
      .s1fix-panel-head span{color:#7f93aa;font-size:.75rem;font-weight:800}
      .s1fix-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 18px;border-bottom:1px solid var(--border,rgba(255,255,255,.1));background:rgba(255,255,255,.018)}
      .s1fix-filter{display:grid;gap:6px;min-width:0}
      .s1fix-filter label{color:#91a7be;font-size:.68rem;font-weight:950;text-transform:uppercase;letter-spacing:.8px}
      .s1fix-filter select{width:100%;min-width:0;height:40px;padding:0 10px;border:1px solid var(--border,rgba(255,255,255,.12));border-radius:9px;background:#09111d;color:#fff;font-weight:800;outline:none}
      .s1fix-filter select:focus{border-color:var(--accent,#00c8ff)}
      .s1fix-table-wrap{width:100%;overflow-x:auto}
      .s1fix-table{width:100%;min-width:700px;border-collapse:collapse}
      .s1fix-table th{padding:11px 12px;background:#09111d;color:#76ace0;font-size:.72rem;font-weight:1000;letter-spacing:.6px;text-transform:uppercase;text-align:center;white-space:nowrap}
      .s1fix-table td{padding:11px 12px;border-top:1px solid var(--border,rgba(255,255,255,.08));color:#eef6ff;font-weight:750;text-align:center;white-space:nowrap}
      .s1fix-table tbody tr:hover{background:rgba(0,200,255,.035)}
      .s1fix-rank{width:46px;font-weight:1000!important;color:#8a9eb5!important}
      .s1fix-rank.top{color:var(--accent,#00c8ff)!important}
      .s1fix-team{text-align:left!important}
      .s1fix-team-btn{display:inline-flex;align-items:center;gap:10px;border:0;background:transparent;color:#fff;font:inherit;font-weight:950;cursor:pointer;padding:0}
      .s1fix-team-btn:hover{color:var(--accent,#00c8ff)}
      .s1fix-team-btn img{width:28px;height:28px;object-fit:contain;flex:0 0 28px}
      .s1fix-points{color:var(--accent,#00c8ff)!important;font-weight:1000!important}
      .s1fix-status-ewc{box-shadow:inset 4px 0 #3da7ff}.s1fix-status-final{box-shadow:inset 4px 0 #2de879}.s1fix-status-out{box-shadow:inset 4px 0 #ffab40}.s1fix-status-down{box-shadow:inset 4px 0 #ff4c65}
      .s1fix-champion-row{background:linear-gradient(90deg,rgba(255,215,0,.10),rgba(255,215,0,.015))!important;box-shadow:inset 4px 0 #ffd700}
      .s1fix-champion-row .s1fix-rank,.s1fix-champion-row .s1fix-team-btn{color:#ffd700!important}
      .s1fix-badge{display:inline-flex;margin-left:7px;padding:3px 6px;border-radius:999px;font-size:.59rem;font-weight:1000;vertical-align:middle}
      .s1fix-badge.gold{color:#ffd700;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.25)}
      .s1fix-legend{display:flex;flex-wrap:wrap;gap:9px;padding:12px 18px;border-top:1px solid var(--border,rgba(255,255,255,.08));color:#8ea4ba;font-size:.7rem;font-weight:850}
      .s1fix-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px}.s1fix-dot.blue{background:#3da7ff}.s1fix-dot.green{background:#2de879}.s1fix-dot.orange{background:#ffab40}.s1fix-dot.red{background:#ff4c65}
      .s1fix-groups{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .s1fix-group{padding:13px;border:1px solid var(--border,rgba(255,255,255,.1));border-radius:12px;background:var(--panel-bg,#0d1420)}
      .s1fix-group h3{margin:0 0 9px;color:var(--accent,#00c8ff);font-size:.8rem;text-transform:uppercase}
      .s1fix-group div{display:grid;gap:5px;color:#dbe9f7;font-size:.78rem;font-weight:800}
      .s1fix-empty{padding:28px;text-align:center;color:#8ea4ba;font-weight:850}
      .s1fix-error{padding:24px;border:1px solid rgba(255,76,101,.3);border-radius:14px;background:rgba(255,76,101,.06);color:#ff97a5;text-align:center;font-weight:850}
      .s1fix-retry{margin-top:12px;padding:8px 12px;border:1px solid rgba(0,200,255,.35);border-radius:8px;background:rgba(0,200,255,.08);color:#fff;font-weight:900;cursor:pointer}
      @media(max-width:800px){.s1fix-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.s1fix-groups{grid-template-columns:repeat(2,minmax(0,1fr))}.s1fix-filters{grid-template-columns:1fr}.s1fix-panel-head{align-items:flex-start;flex-direction:column}.s1fix-table{min-width:560px}.s1fix-table th,.s1fix-table td{padding:9px 8px}.s1fix-hero{padding:19px}}
      @media(max-width:500px){.s1fix-shell{gap:13px}.s1fix-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.s1fix-metric{padding:11px}.s1fix-metric strong{font-size:1.08rem}.s1fix-groups{grid-template-columns:1fr 1fr}.s1fix-group{padding:10px}.s1fix-table{min-width:510px}.s1fix-team-btn img{width:24px;height:24px;flex-basis:24px}.s1fix-team-btn{gap:7px}}
    `;
    document.head.appendChild(style);
  }

  async function loadStageData() {
    if (state.data) return state.data;
    if (!state.dataPromise) {
      state.dataPromise = fetch(`ffws-br-2026-s1/stages.json?v=${BUILD}`, { cache: 'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error(`stages.json retornou ${response.status}`);
          return response.json();
        })
        .then(data => {
          if (!Array.isArray(data?.teams) || !Array.isArray(data?.maps)) throw new Error('stages.json inválido');
          if (!Array.isArray(data?.classificatoria?.days) || !Array.isArray(data?.final?.days)) throw new Error('Etapas da S1 não encontradas');
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

  function pointFor(data, placement) {
    const source = data?.pointSystem || FALLBACK_POINTS;
    return num(source?.[placement] ?? source?.[String(placement)] ?? FALLBACK_POINTS[placement]);
  }

  function flattenStage(data, stageName) {
    const days = data?.[stageName]?.days || [];
    const out = [];
    days.forEach((dayDrops, dayIndex) => {
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

  function getTeamLogo(name) {
    try {
      if (typeof window.getTeamLogoSafe === 'function') {
        const logo = window.getTeamLogoSafe(name);
        if (logo && logo !== 'escudo.webp') return logo;
      }
    } catch (_) {}
    return LOGOS[name] || 'escudo.webp';
  }

  function stageFilters(stageName) {
    return state.filters[stageName] || (state.filters[stageName] = { day: 'all', map: 'all', drop: 'all' });
  }

  function availableDrops(drops, filters, ignoreDrop = false) {
    return drops.filter(drop => {
      if (filters.day !== 'all' && drop.day !== String(filters.day)) return false;
      if (filters.map !== 'all' && drop.map !== String(filters.map)) return false;
      if (!ignoreDrop && filters.drop !== 'all' && drop.key !== String(filters.drop)) return false;
      return true;
    });
  }

  function aggregateStage(data, stageName, selectedDrops) {
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

    const filters = stageFilters(stageName);
    const fullStage = filters.day === 'all' && filters.map === 'all' && filters.drop === 'all';
    const champion = String(data?.format?.final?.champion || 'LOUD SNICKERS');
    const rows = [...teams.values()];

    rows.sort((a, b) => {
      if (stageName === 'final' && fullStage) {
        if (a.team === champion && b.team !== champion) return -1;
        if (b.team === champion && a.team !== champion) return 1;
      }
      return b.points - a.points
        || b.booyahs - a.booyahs
        || b.kills - a.kills
        || num(teamOrder.get(a.team)) - num(teamOrder.get(b.team))
        || a.team.localeCompare(b.team, 'pt-BR');
    });

    return { rows, fullStage, champion };
  }

  function filterOptions(data, stageName, drops) {
    const filters = stageFilters(stageName);
    const dayCount = data?.[stageName]?.days?.length || 0;
    const mapOptions = (data.maps || []).map(map => `<option value="${esc(map)}"${filters.map === map ? ' selected' : ''}>${esc(map)}</option>`).join('');
    const dayOptions = Array.from({ length: dayCount }, (_, index) => {
      const day = String(index + 1);
      return `<option value="${day}"${filters.day === day ? ' selected' : ''}>Dia ${day}</option>`;
    }).join('');

    const dropBase = availableDrops(drops, filters, true);
    const allowed = new Set(dropBase.map(drop => drop.key));
    if (filters.drop !== 'all' && !allowed.has(filters.drop)) filters.drop = 'all';
    const dropOptions = dropBase.map(drop => `<option value="${esc(drop.key)}"${filters.drop === drop.key ? ' selected' : ''}>D${esc(drop.day)} • Q${esc(drop.drop)} • ${esc(drop.map)}</option>`).join('');

    return `
      <div class="s1fix-filters">
        <div class="s1fix-filter"><label>Dia</label><select onchange="cffS1StandaloneSetFilter('${stageName}','day',this.value)"><option value="all">Todos os dias</option>${dayOptions}</select></div>
        <div class="s1fix-filter"><label>Mapa</label><select onchange="cffS1StandaloneSetFilter('${stageName}','map',this.value)"><option value="all">Todos os mapas</option>${mapOptions}</select></div>
        <div class="s1fix-filter"><label>Queda</label><select onchange="cffS1StandaloneSetFilter('${stageName}','drop',this.value)"><option value="all">Todas as quedas</option>${dropOptions}</select></div>
      </div>
    `;
  }

  function statusClass(stageName, index, fullStage, championRow) {
    if (championRow) return 's1fix-champion-row';
    if (stageName !== 'classificatoria' || !fullStage) return '';
    const pos = index + 1;
    if (pos === 1) return 's1fix-status-ewc';
    if (pos <= 12) return 's1fix-status-final';
    if (pos <= 14) return 's1fix-status-out';
    return 's1fix-status-down';
  }

  function tableHtml(data, stageName, rows, fullStage, champion) {
    const showGroup = stageName === 'classificatoria';
    const body = rows.length ? rows.map((row, index) => {
      const championRow = stageName === 'final' && fullStage && row.team === champion;
      const group = GROUPS[row.team] || '—';
      return `
        <tr class="${statusClass(stageName, index, fullStage, championRow)}">
          <td class="s1fix-rank ${index < 3 ? 'top' : ''}">${index + 1}º</td>
          <td class="s1fix-team"><button type="button" class="s1fix-team-btn" data-s1-team="${esc(row.team)}"><img src="${esc(getTeamLogo(row.team))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='escudo.webp'"><span>${esc(row.team)}</span>${championRow ? '<span class="s1fix-badge gold">CAMPEÃ</span>' : ''}</button></td>
          ${showGroup ? `<td>${esc(group)}</td>` : ''}
          <td class="s1fix-points">${row.points}</td>
          <td>${row.booyahs}</td>
          <td>${row.kills}</td>
          <td>${row.matches}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="${showGroup ? 7 : 6}" class="s1fix-empty">Nenhum dado encontrado com estes filtros.</td></tr>`;

    return `
      <div class="s1fix-table-wrap">
        <table class="s1fix-table">
          <thead><tr><th>#</th><th style="text-align:left">Equipe</th>${showGroup ? '<th>GP</th>' : ''}<th>PTS</th><th>B</th><th>K</th><th>Q</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function metricHtml(label, value) {
    return `<div class="s1fix-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`;
  }

  function bindTeamButtons(root) {
    root.querySelectorAll('[data-s1-team]').forEach(button => {
      button.addEventListener('click', () => {
        const team = button.getAttribute('data-s1-team');
        try { if (typeof window.openTeamProfile === 'function') window.openTeamProfile(team); } catch (_) {}
      });
    });
  }

  function renderGroupCards(data) {
    const grouped = { A: [], B: [], C: [], D: [] };
    (data.teams || []).forEach(team => {
      const group = GROUPS[team];
      if (grouped[group]) grouped[group].push(team);
    });
    return `<div class="s1fix-groups">${Object.entries(grouped).map(([group, teams]) => `<div class="s1fix-group"><h3>Grupo ${group}</h3><div>${teams.map(team => `<span>${esc(team)}</span>`).join('')}</div></div>`).join('')}</div>`;
  }

  async function renderDirectStage(stageName) {
    injectCss();
    const target = stageName === 'classificatoria'
      ? document.getElementById('ffws-br-s1-classificatoria-root')
      : document.getElementById('final');
    if (!target) return false;

    target.innerHTML = '<div class="s1fix-empty">Carregando dados da WB 2026 S1...</div>';

    try {
      const data = await loadStageData();
      const drops = flattenStage(data, stageName);
      const filters = stageFilters(stageName);
      const selectedDrops = availableDrops(drops, filters, false);
      const { rows, fullStage, champion } = aggregateStage(data, stageName, selectedDrops);
      const kills = rows.reduce((sum, row) => sum + row.kills, 0);
      const matchCount = selectedDrops.length;
      const subtitle = stageName === 'classificatoria'
        ? '20 dias de fase classificatória • 16 equipes • 120 quedas no total'
        : 'Grand Finals • Champion Rush • resultado oficial encerrado';
      const format = data?.format?.[stageName] || {};

      const shell = `
        <div class="s1fix-shell" data-s1-direct="${stageName}">
          ${stageName === 'final' ? '<button class="btn-back" type="button" onclick="navigate(\'home\')">← Voltar</button>' : ''}
          <section class="s1fix-hero">
            <div class="s1fix-kicker">WB 2026 S1</div>
            <h1>${stageName === 'classificatoria' ? 'Classificação Geral' : 'Grand Finals'}</h1>
            <p>${esc(subtitle)}</p>
            ${stageName === 'final' && fullStage ? `<div class="s1fix-champion">🏆 ${esc(champion)} • CAMPEÃ</div>` : ''}
          </section>
          <div class="s1fix-metrics">
            ${metricHtml('Quedas exibidas', matchCount)}
            ${metricHtml('Equipes', rows.length)}
            ${metricHtml('Abates', kills)}
            ${metricHtml(stageName === 'final' ? 'Champion Rush' : 'Dias da fase', stageName === 'final' ? `${num(data?.format?.final?.championRushPoint) || 160} PTS` : `${num(format.days) || (data?.classificatoria?.days?.length || 0)}`)}
          </div>
          ${stageName === 'classificatoria' ? renderGroupCards(data) : ''}
          <section class="s1fix-panel">
            <div class="s1fix-panel-head"><div><h2>${stageName === 'classificatoria' ? 'Classificação' : 'Resultado da Final'}</h2><span>${fullStage ? 'Resultado completo da etapa' : 'Resultado recalculado conforme os filtros'}</span></div><span>${matchCount} queda${matchCount === 1 ? '' : 's'}</span></div>
            ${filterOptions(data, stageName, drops)}
            ${tableHtml(data, stageName, rows, fullStage, champion)}
            ${stageName === 'classificatoria' && fullStage ? '<div class="s1fix-legend"><span><i class="s1fix-dot blue"></i>1º • Final + EWC</span><span><i class="s1fix-dot green"></i>2º–12º • Final</span><span><i class="s1fix-dot orange"></i>13º–14º • Eliminados</span><span><i class="s1fix-dot red"></i>15º–16º • Rebaixados</span></div>' : ''}
            ${stageName === 'final' && fullStage ? `<div class="s1fix-legend"><span><i class="s1fix-dot" style="background:#ffd700"></i>${esc(champion)} venceu pelo Champion Rush após ${num(data?.format?.final?.matchesPlayed) || matchCount} quedas.</span></div>` : ''}
          </section>
        </div>`;

      target.innerHTML = shell;
      bindTeamButtons(target);
      return true;
    } catch (error) {
      console.error('[S1 standalone]', error);
      target.innerHTML = `<div class="s1fix-error">Não foi possível carregar os dados da WB 2026 S1.<br><button class="s1fix-retry" type="button" onclick="cffS1StandaloneRetry('${stageName}')">Tentar novamente</button></div>`;
      return false;
    }
  }

  async function ensureLegacyReady() {
    if (!state.legacyPromise) {
      state.legacyPromise = (async () => {
        const deadline = Date.now() + 15000;
        while (typeof window.cffEnsureLegacy !== 'function' && Date.now() < deadline) await delay(50);
        if (typeof window.cffEnsureLegacy !== 'function') throw new Error('cffEnsureLegacy indisponível');
        await window.cffEnsureLegacy();
        if (window.cffCoreReady && typeof window.cffCoreReady.then === 'function') {
          await Promise.race([window.cffCoreReady, delay(15000)]);
        }
        return true;
      })().catch(error => {
        state.legacyPromise = null;
        throw error;
      });
    }
    return state.legacyPromise;
  }

  function renderLegacyPage(page) {
    try {
      try { window.buildDayFilters?.(); } catch (_) {}
      try { window.populateSelects?.(); } catch (_) {}
      try { window.buildExtraMultiSelectFilters?.(); } catch (_) {}

      switch (page) {
        case 'mvp': window.renderAllPlayers?.(); break;
        case 'equipes': window.renderTeamsDirectory?.(); break;
        case 'datas': window.renderSchedule?.(); break;
        case 'selecao-da-semana': window.renderSelection?.(); break;
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
        case 'notas-cff': window.renderNotasCFFPage?.(); break;
        case 'comparar-1v1':
          window.renderCompareTeams?.();
          window.renderComparePlayers?.();
          break;
      }
    } catch (error) {
      console.error('[S1 legacy repair]', page, error);
    }
  }

  async function repairPage(page) {
    page = String(page || getActiveS1Page()).trim();
    if (!S1_PAGES.has(page)) return false;

    if (page === 'tabela') return renderDirectStage('classificatoria');
    if (page === 'final') return renderDirectStage('final');

    try {
      await ensureLegacyReady();
      renderLegacyPage(page);
      setTimeout(() => renderLegacyPage(page), 150);
      setTimeout(() => renderLegacyPage(page), 700);
      return true;
    } catch (error) {
      console.error('[S1 repair]', error);
      return false;
    }
  }

  function wrapNavigation(name) {
    const base = window[name];
    if (typeof base !== 'function' || base.__cffS1StandaloneWrapped) return;
    const wrapped = function(page, ...args) {
      const result = base.call(this, page, ...args);
      const target = String(page || '').trim();
      if (S1_PAGES.has(target)) {
        setTimeout(() => repairPage(target), DIRECT_PAGES.has(target) ? 30 : 80);
        if (DIRECT_PAGES.has(target)) setTimeout(() => repairPage(target), 500);
      }
      return result;
    };
    wrapped.__cffS1StandaloneWrapped = true;
    wrapped.__cffS1StandaloneBase = base;
    window[name] = wrapped;
  }

  function boot() {
    injectCss();
    wrapNavigation('navigate');
    wrapNavigation('navigateAndClose');
    const page = getActiveS1Page();
    if (page) repairPage(page);
  }

  window.cffS1StandaloneSetFilter = (stageName, key, value) => {
    if (!state.filters[stageName]) return;
    state.filters[stageName][key] = String(value || 'all');
    if (key === 'day' || key === 'map') state.filters[stageName].drop = 'all';
    renderDirectStage(stageName);
  };

  window.cffS1StandaloneRetry = stageName => {
    state.data = null;
    state.dataPromise = null;
    renderDirectStage(stageName);
  };

  window.cffRepairS1Page = repairPage;
  window.cffS1StandaloneRenderClassification = () => renderDirectStage('classificatoria');
  window.cffS1StandaloneRenderFinal = () => renderDirectStage('final');

  document.addEventListener('cff:modules-loaded', () => setTimeout(boot, 0));
  window.addEventListener('hashchange', () => setTimeout(boot, 0));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  let attempts = 0;
  const watchdog = setInterval(() => {
    attempts += 1;
    wrapNavigation('navigate');
    wrapNavigation('navigateAndClose');
    const page = getActiveS1Page();
    if (page && DIRECT_PAGES.has(page)) {
      const marker = page === 'tabela'
        ? document.querySelector('#ffws-br-s1-classificatoria-root [data-s1-direct="classificatoria"]')
        : document.querySelector('#final [data-s1-direct="final"]');
      if (!marker) repairPage(page);
    }
    if (attempts >= 80) clearInterval(watchdog);
  }, 375);
})();
