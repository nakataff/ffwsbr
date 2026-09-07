(() => {
  'use strict';

  const BUILD = '20260907-s1-selection-s2-match-v1';
  const WEEKS = Object.freeze({
    '1':[1,2],'2':[3,4],'3':[5,6],'4':[7,8],'5':[9,10],
    '6':[11,12],'7':[13,14],'8':[15,16],'9':[17,18],'10':[19,20]
  });
  const PHASES = Object.freeze({
    semanal: { label:'TIMES DA SEMANA', tag:'SEMANA', color:'#ff0000', title:'TIMES DA SEMANA' },
    classificatoria: { label:'CLASSIFICATÓRIA', tag:'CLASSIFICATÓRIA', color:'#00c8ff', title:'SELEÇÃO DA CLASSIFICATÓRIA' },
    final: { label:'FINAL', tag:'FINAL', color:'#22c55e', title:'SELEÇÃO DA FINAL' },
    torneio: { label:'TORNEIO', tag:'TORNEIO', color:'#a855f7', title:'SELEÇÃO DO TORNEIO' }
  });

  const state = {
    tab: 'semanal',
    week: '10',
    basePromise: null,
    detailsPromise: null,
    teams: [],
    players: [],
    byName: new Map(),
    details: []
  };

  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const num = value => Number(value) || 0;
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const jsq = value => String(value ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');

  async function getJson(path) {
    const response = await fetch(`${path}?v=${BUILD}`, { cache:'force-cache' });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  function roleKey(player) {
    const raw = String(player?.role || 'RUSH').toUpperCase();
    if (raw.includes('GRAN')) return 'GRAN';
    if (raw.includes('SUP')) return 'SUP';
    if (raw === '3' || raw.includes('3º')) return '3';
    return 'RUSH';
  }

  function roleLabel(player) {
    const role = roleKey(player);
    if (role === 'GRAN') return 'GRAN';
    if (role === 'SUP') return 'SUP';
    if (role === '3') return '3º HOMEM';
    return 'RUSH';
  }

  function resolvePlayer(meta, key, stat) {
    const keys = [key, stat?.name, stat?.jogador].map(norm).filter(Boolean);
    for (const [id,item] of Object.entries(meta || {})) {
      const aliases = [id,item?.name,...(Array.isArray(item?.aliases)?item.aliases:[])].map(norm);
      if (keys.some(candidate => aliases.includes(candidate))) return { id, item };
    }
    return { id:key, item:{} };
  }

  async function loadBase() {
    if (state.players.length) return state;
    if (state.basePromise) return state.basePromise;
    state.basePromise = Promise.all([
      getJson('ffws-br-2026-s1/teams.json'),
      getJson('ffws-br-2026-s1/player-meta.json'),
      getJson('ffws-br-2026-s1/player-stats.json')
    ]).then(([teams,meta,stats]) => {
      state.teams = teams?.teams || [];
      state.players = Object.entries(stats?.players || {}).map(([key,stat]) => {
        const resolved = resolvePlayer(meta?.players || {}, key, stat);
        const item = resolved.item || {};
        return {
          id:String(resolved.id || key),
          name:String(item.name || stat?.name || key),
          team:String(item.team || stat?.team || ''),
          role:String(item.role || 'RUSH'),
          aliases:Array.isArray(item.aliases) ? item.aliases : [],
          general:{kills:num(stat?.kills),damage:num(stat?.damage),assists:num(stat?.assists),matches:num(stat?.matches),mvps:num(stat?.mvp)},
          stages:{
            classificatoria:{kills:num(stat?.stages?.classificatoria?.kills),damage:num(stat?.stages?.classificatoria?.damage),assists:num(stat?.stages?.classificatoria?.assists),matches:num(stat?.stages?.classificatoria?.matches),mvps:num(stat?.stages?.classificatoria?.mvp)},
            final:{kills:num(stat?.stages?.final?.kills),damage:num(stat?.stages?.final?.damage),assists:num(stat?.stages?.final?.assists),matches:num(stat?.stages?.final?.matches),mvps:num(stat?.stages?.final?.mvp)}
          }
        };
      });
      state.byName = new Map();
      state.players.forEach(player => [player.id,player.name,...player.aliases].filter(Boolean).forEach(alias => state.byName.set(norm(alias),player)));
      return state;
    }).finally(() => { state.basePromise = null; });
    return state.basePromise;
  }

  async function loadDetails() {
    if (state.details.length) return state.details;
    if (state.detailsPromise) return state.detailsPromise;
    state.detailsPromise = getJson('ffws-br-2026-s1/players.json').then(data => {
      const stages = data?.stages || ['classificatoria','final'];
      const names = data?.players || [];
      const teams = data?.teams || [];
      const maps = data?.maps || [];
      state.details = (data?.entries || []).map(entry => {
        const name = names[num(entry?.[4])] || '';
        const player = state.byName.get(norm(name)) || {id:norm(name),name,team:teams[num(entry?.[5])]||'',role:'RUSH',aliases:[]};
        return {
          player,
          stage:stages[num(entry?.[0])] || 'classificatoria',
          day:num(entry?.[1]),
          drop:num(entry?.[2]),
          map:maps[num(entry?.[3])] || '',
          kills:num(entry?.[6]),
          damage:num(entry?.[7]),
          assists:num(entry?.[8]),
          mvp:num(entry?.[9])
        };
      }).filter(row => row.player?.name);
      return state.details;
    }).finally(() => { state.detailsPromise = null; });
    return state.detailsPromise;
  }

  function teamMeta(name) {
    return state.teams.find(team => norm(team?.name) === norm(name)) || {};
  }

  function teamLogo(name) {
    try {
      const found = window.getTeamLogoSafe?.(name);
      if (found && found !== 'escudo.webp') return found;
    } catch (_) {}
    return teamMeta(name).logo || 'escudo.webp';
  }

  function teamAbbr(name) {
    return teamMeta(name).abbreviation || name;
  }

  function photo(player) {
    try {
      const found = window.cffResolvePlayerPhoto?.(player?.name || '', '');
      if (found) return found;
    } catch (_) {}
    const known = {
      BIELGOD:'bielgod.webp',Cauan7:'cauan7.webp',WHISKYx:'whisky.webp',Rojão:'silhueta.webp',Mts007:'mts007.webp',Yann7awp:'yan7.webp',Theus:'theus.webp',wLiu:'wliu.webp',ITAL0$$:'italo.webp',IguiNmvp:'iguin.webp',Lost21:'lost21.webp',Keven7!:'keven.webp','DRADE.11':'drade.webp','SEU PAI':'seu pai.webp',YOKO7:'yoko.webp'
    };
    if (known[player?.name]) return known[player.name];
    const id = String(player?.id || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    return id ? `player-photos/s2/${id}.webp` : 'silhueta.webp';
  }

  function aggregateDetails(filters) {
    const out = new Map();
    state.details.forEach(entry => {
      if (filters.stage && entry.stage !== filters.stage) return;
      if (filters.days?.length && !filters.days.includes(entry.day)) return;
      const id = entry.player.id || norm(entry.player.name);
      if (!out.has(id)) out.set(id,{player:entry.player,kills:0,damage:0,assists:0,matches:0,mvps:0});
      const row = out.get(id);
      row.kills += entry.kills;
      row.damage += entry.damage;
      row.assists += entry.assists;
      row.matches += 1;
      row.mvps += entry.mvp;
    });
    return [...out.values()];
  }

  function lightRows(stage) {
    return state.players.map(player => {
      const source = stage === 'geral' ? player.general : player.stages?.[stage] || {};
      return {player,kills:num(source.kills),damage:num(source.damage),assists:num(source.assists),matches:num(source.matches),mvps:num(source.mvps)};
    }).filter(row => row.matches > 0);
  }

  function lineup(rows) {
    const ordered = [...rows].sort((a,b) => b.kills-a.kills || b.damage-a.damage || b.assists-a.assists || String(a.player.name).localeCompare(String(b.player.name),'pt-BR'));
    const used = new Set();
    const take = (roles,amount) => ordered.filter(row => !used.has(row.player.id) && roles.includes(roleKey(row.player))).slice(0,amount).map(row => (used.add(row.player.id),row));
    let result = [...take(['RUSH','3'],2),...take(['GRAN'],1),...take(['SUP'],1)];
    if (result.length < 4) result = result.concat(ordered.filter(row => !used.has(row.player.id)).slice(0,4-result.length));
    return result;
  }

  function phaseConfig() {
    return PHASES[state.tab] || PHASES.semanal;
  }

  function card(row) {
    const config = phaseConfig();
    const player = row.player;
    const damage = `${(row.damage / 1000).toFixed(1)}K`;
    const color = config.color;
    const glow = color === '#ff0000' ? 'rgba(255,0,0,.28)' : color === '#00c8ff' ? 'rgba(0,200,255,.24)' : color === '#22c55e' ? 'rgba(34,197,94,.24)' : 'rgba(168,85,247,.24)';
    return `<article class="s1s2-card" style="--s1s2-color:${color};--s1s2-glow:${glow}" data-s1s2-player="${esc(player.id)}" role="button" tabindex="0" aria-label="Abrir perfil de ${esc(player.name)}">
      <div class="s1s2-card-top"><span class="s1s2-card-tag">${esc(state.tab === 'semanal' ? 'SEMANA' : config.tag)}</span><strong class="s1s2-card-role">${esc(roleLabel(player))}</strong><span class="s1s2-card-role-line"></span><img class="s1s2-card-logo" src="${esc(teamLogo(player.team))}" alt="${esc(teamAbbr(player.team))}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='escudo.webp'"></div>
      <img class="s1s2-card-photo" src="${esc(photo(player))}" alt="${esc(player.name)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='silhueta.webp'">
      <div class="s1s2-card-fade"></div>
      <div class="s1s2-card-bottom"><h3>${esc(player.name)}</h3><div class="s1s2-card-stats"><div><small>KILLS</small><strong>${row.kills}</strong></div><div><small>DANO</small><strong>${damage}</strong></div><div><small>QUEDAS</small><strong>${row.matches}</strong></div></div></div>
    </article>`;
  }

  function injectCss() {
    if (document.getElementById('s1-selection-s2-match-css')) return;
    const style = document.createElement('style');
    style.id = 's1-selection-s2-match-css';
    style.textContent = `
      #selecao-da-semana [data-s1s2-selection-root]{max-width:1500px;margin:0 auto;padding:0 14px 30px}
      #selecao-da-semana .s1s2-hero{margin-bottom:18px;padding:20px 22px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.025),rgba(255,255,255,.008));}
      #selecao-da-semana .s1s2-kicker{font-size:.74rem;font-weight:1000;letter-spacing:1.7px;color:#7fa7cc;text-transform:uppercase}
      #selecao-da-semana .s1s2-hero h1{margin:6px 0 6px;color:#fff;font-size:clamp(1.75rem,3vw,2.6rem);font-weight:1000;line-height:1;text-transform:uppercase}
      #selecao-da-semana .s1s2-hero p{margin:0;color:#8db0d3;font-size:.96rem;font-weight:700}
      #selecao-da-semana .s1s2-tabs{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:0 0 14px}
      #selecao-da-semana .s1s2-tab{border:1px solid rgba(255,255,255,.10);border-radius:999px;padding:9px 17px;background:#0a0f18;color:#77869a;font-size:.76rem;font-weight:1000;text-transform:uppercase;cursor:pointer;transition:.18s ease}
      #selecao-da-semana .s1s2-tab:hover{color:#fff;border-color:var(--tab-color)}
      #selecao-da-semana .s1s2-tab.active{color:#fff;border-color:var(--tab-color);background:color-mix(in srgb,var(--tab-color) 13%,#0a0f18);box-shadow:0 0 16px color-mix(in srgb,var(--tab-color) 18%,transparent)}
      #selecao-da-semana .s1s2-panel{padding:28px 20px 20px;border:1px solid rgba(255,255,255,.10);border-radius:18px;background:#090e16;overflow:hidden}
      #selecao-da-semana .s1s2-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:32px;margin-bottom:16px}
      #selecao-da-semana .s1s2-panel-title{min-width:0}
      #selecao-da-semana .s1s2-panel-tag{display:inline-flex;padding:7px 12px;border-radius:999px;background:var(--phase-color);color:#fff;font-size:.68rem;font-weight:1000;letter-spacing:.7px;text-transform:uppercase}
      #selecao-da-semana .s1s2-panel-title h2{margin:8px 0 0;color:#fff;font-size:1.55rem;font-weight:1000;line-height:1;text-transform:uppercase}
      #selecao-da-semana .s1s2-panel-copy{max-width:480px;margin:0;color:#77a7d5;font-size:1rem;line-height:1.45}
      #selecao-da-semana .s1s2-week-area{display:grid;gap:12px;margin:8px 0 26px}
      #selecao-da-semana .s1s2-stage-row{display:flex;align-items:center;justify-content:center;gap:9px;color:#7aa6d0;font-size:.72rem;font-weight:1000;text-transform:uppercase}
      #selecao-da-semana .s1s2-stage-pill{border:1px solid var(--phase-color);border-radius:999px;padding:9px 15px;background:color-mix(in srgb,var(--phase-color) 13%,#080d15);color:#fff;font-weight:1000}
      #selecao-da-semana .s1s2-weeks{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
      #selecao-da-semana .s1s2-week{min-width:86px;border:1px solid rgba(255,255,255,.16);border-radius:4px;padding:7px 12px;background:#f4f4f4;color:#050505;font-size:.78rem;font-weight:900;text-transform:uppercase;cursor:pointer;transition:.16s ease}
      #selecao-da-semana .s1s2-week:hover{transform:translateY(-1px);border-color:var(--phase-color)}
      #selecao-da-semana .s1s2-week.active{background:var(--phase-color);border-color:var(--phase-color);color:#fff;box-shadow:0 0 16px var(--phase-glow)}
      #selecao-da-semana .s1s2-grid{display:grid;grid-template-columns:repeat(4,minmax(0,280px));justify-content:center;gap:28px;margin:0 auto}
      #selecao-da-semana .s1s2-card{width:100%;max-width:280px;height:460px;position:relative;overflow:hidden;border:4px solid var(--s1s2-color);border-radius:15px;background:#000;box-shadow:0 0 25px var(--s1s2-glow);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease;isolation:isolate}
      #selecao-da-semana .s1s2-card:hover{transform:translateY(-4px);box-shadow:0 0 34px var(--s1s2-glow)}
      #selecao-da-semana .s1s2-card-top{position:absolute;z-index:4;left:18px;top:17px;display:flex;flex-direction:column;align-items:flex-start}
      #selecao-da-semana .s1s2-card-tag{display:inline-flex;padding:7px 12px;border-radius:4px;background:var(--s1s2-color);color:#fff;font-size:.68rem;font-weight:1000;letter-spacing:.8px;text-transform:uppercase}
      #selecao-da-semana .s1s2-card-role{margin-top:17px;color:var(--s1s2-color);font-size:1.22rem;font-weight:1000;text-transform:uppercase}
      #selecao-da-semana .s1s2-card-role-line{width:39px;height:4px;margin:7px 0 22px;background:var(--s1s2-color)}
      #selecao-da-semana .s1s2-card-logo{width:47px;height:47px;object-fit:contain;object-position:left center;filter:drop-shadow(0 0 4px rgba(255,255,255,.05))}
      #selecao-da-semana .s1s2-card-photo{position:absolute;z-index:2;right:-9px;top:58px;width:84%;height:74%;object-fit:contain;object-position:center bottom;pointer-events:none}
      #selecao-da-semana .s1s2-card-fade{position:absolute;z-index:3;inset:0;background:linear-gradient(180deg,transparent 0%,transparent 43%,rgba(0,0,0,.12) 57%,rgba(0,0,0,.93) 77%,#000 90%);pointer-events:none}
      #selecao-da-semana .s1s2-card-bottom{position:absolute;z-index:5;left:15px;right:15px;bottom:13px}
      #selecao-da-semana .s1s2-card-bottom h3{margin:0 0 8px;color:#fff;font-size:1.45rem;font-weight:1000;text-align:center;text-transform:uppercase;line-height:1;text-shadow:0 2px 5px #000}
      #selecao-da-semana .s1s2-card-stats{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid color-mix(in srgb,var(--s1s2-color) 70%,transparent);padding-top:10px}
      #selecao-da-semana .s1s2-card-stats div{text-align:center}
      #selecao-da-semana .s1s2-card-stats small{display:block;color:#89a3be;font-size:.57rem;letter-spacing:.5px}
      #selecao-da-semana .s1s2-card-stats strong{display:block;margin-top:3px;color:#fff;font-size:1rem;font-weight:1000}
      #selecao-da-semana .s1s2-card-stats div:first-child strong{color:var(--s1s2-color)}
      #selecao-da-semana .s1s2-archive{margin:18px auto 0;max-width:900px;color:#7194b6;text-align:center;font-size:.73rem;font-weight:800}
      #selecao-da-semana .s1s2-loading{padding:42px;text-align:center;color:#8ca9c4;font-weight:900}
      @media(max-width:1180px){#selecao-da-semana .s1s2-grid{grid-template-columns:repeat(2,minmax(0,280px))}}
      @media(max-width:760px){#selecao-da-semana [data-s1s2-selection-root]{padding:0 7px 22px}#selecao-da-semana .s1s2-panel{padding:19px 11px 15px}#selecao-da-semana .s1s2-panel-head{flex-direction:column;gap:8px}#selecao-da-semana .s1s2-panel-copy{font-size:.82rem}#selecao-da-semana .s1s2-weeks{gap:6px}#selecao-da-semana .s1s2-week{min-width:0;padding:7px 10px;font-size:.68rem}#selecao-da-semana .s1s2-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#selecao-da-semana .s1s2-card{max-width:none;height:360px;border-width:3px}#selecao-da-semana .s1s2-card-top{left:11px;top:11px}#selecao-da-semana .s1s2-card-tag{padding:5px 8px;font-size:.55rem}#selecao-da-semana .s1s2-card-role{margin-top:11px;font-size:.92rem}#selecao-da-semana .s1s2-card-role-line{height:3px;width:29px;margin:5px 0 12px}#selecao-da-semana .s1s2-card-logo{width:34px;height:34px}#selecao-da-semana .s1s2-card-photo{width:90%;height:72%;right:-12px;top:52px}#selecao-da-semana .s1s2-card-bottom{left:8px;right:8px;bottom:8px}#selecao-da-semana .s1s2-card-bottom h3{font-size:1rem}#selecao-da-semana .s1s2-card-stats small{font-size:.45rem}#selecao-da-semana .s1s2-card-stats strong{font-size:.78rem}}
      @media(max-width:430px){#selecao-da-semana .s1s2-grid{grid-template-columns:1fr}#selecao-da-semana .s1s2-card{width:min(280px,100%);height:420px;margin:0 auto}#selecao-da-semana .s1s2-card-bottom h3{font-size:1.28rem}#selecao-da-semana .s1s2-card-stats strong{font-size:.92rem}}
    `;
    document.head.appendChild(style);
  }

  function copyForTab(tab) {
    if (tab === 'semanal') return 'O resultado mais recente disponível aparece primeiro. Escolha uma semana para ver os quatro destaques daquele período.';
    if (tab === 'classificatoria') return 'Os quatro destaques da classificatória com a mesma composição por função.';
    if (tab === 'final') return 'Os quatro destaques da Final com a mesma composição por função.';
    return 'Os quatro destaques da temporada completa com a mesma composição por função.';
  }

  async function render() {
    const root = document.getElementById('selecao-da-semana');
    if (!root) return;
    if (String(location.hash || '').replace(/^#/,'') !== 'selecao-da-semana' && !root.classList.contains('active')) return;
    injectCss();
    root.innerHTML = '<div data-s1s2-selection-root><div class="s1s2-loading">Carregando seleções...</div></div>';
    try {
      await loadBase();
      let rows;
      if (state.tab === 'semanal') {
        await loadDetails();
        rows = aggregateDetails({stage:'classificatoria',days:WEEKS[state.week] || WEEKS['10']});
      } else {
        rows = lightRows(state.tab === 'torneio' ? 'geral' : state.tab);
      }
      const picks = lineup(rows);
      const config = phaseConfig();
      const weekControls = state.tab === 'semanal' ? `<div class="s1s2-week-area"><div class="s1s2-stage-row"><span>FASE:</span><span class="s1s2-stage-pill">CLASSIFICATÓRIA</span></div><div class="s1s2-weeks">${Object.keys(WEEKS).map(week => `<button type="button" class="s1s2-week ${week===state.week?'active':''}" data-s1s2-week="${week}">SEMANA ${week}</button>`).join('')}</div></div>` : '';
      root.innerHTML = `<div data-s1s2-selection-root style="--phase-color:${config.color};--phase-glow:${config.color}44">
        <div class="s1s2-hero"><div class="s1s2-kicker">WB 2026 S1 • SELEÇÕES DA SEASON</div><h1>SELEÇÕES DA SEASON</h1><p>Times da semana, classificatória, final e seleção geral da edição.</p></div>
        <div class="s1s2-tabs">${Object.entries(PHASES).map(([key,item]) => `<button type="button" class="s1s2-tab ${state.tab===key?'active':''}" style="--tab-color:${item.color}" data-s1s2-tab="${key}">${esc(item.label)}</button>`).join('')}</div>
        <section class="s1s2-panel"><div class="s1s2-panel-head"><div class="s1s2-panel-title"><span class="s1s2-panel-tag">${esc(state.tab==='semanal'?'TIMES DA SEMANA':config.tag)}</span><h2>${esc(config.title)}</h2></div><p class="s1s2-panel-copy">${esc(copyForTab(state.tab))}</p></div>
        ${weekControls}
        <div class="s1s2-grid">${picks.map(card).join('')}</div>
        <div class="s1s2-archive">Dados finais congelados da WB 2026 S1. O arquivo detalhado de quedas só é carregado quando a aba semanal é aberta.</div></section>
      </div>`;
    } catch (error) {
      root.innerHTML = `<div data-s1s2-selection-root><div class="s1s2-loading">Não foi possível carregar as seleções. Atualize a página.</div></div>`;
      console.error('[S1 Selection S2 Match]', error);
    }
  }

  function openPlayer(id) {
    const player = state.players.find(item => String(item.id) === String(id));
    if (!player) return;
    try {
      if (typeof window.openPlayerProfile === 'function') return window.openPlayerProfile(player.name,player.team);
    } catch (_) {}
    location.href = `jogador.html?${new URLSearchParams({jogador:player.name,time:player.team})}`;
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest?.('[data-s1s2-tab]');
    if (tab) { event.preventDefault(); state.tab = tab.dataset.s1s2Tab || 'semanal'; render(); return; }
    const week = event.target.closest?.('[data-s1s2-week]');
    if (week) { event.preventDefault(); state.week = week.dataset.s1s2Week || '10'; render(); return; }
    const player = event.target.closest?.('[data-s1s2-player]');
    if (player) { event.preventDefault(); openPlayer(player.dataset.s1s2Player); }
  }, true);

  document.addEventListener('keydown', event => {
    const player = event.target.closest?.('[data-s1s2-player]');
    if (player && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openPlayer(player.dataset.s1s2Player); }
  });

  function scheduleRender() { setTimeout(render, 80); }
  window.addEventListener('hashchange', scheduleRender);
  document.addEventListener('DOMContentLoaded', scheduleRender, { once:true });
  if (document.readyState !== 'loading') scheduleRender();

  const observer = new MutationObserver(() => {
    const root = document.getElementById('selecao-da-semana');
    if (!root || (String(location.hash || '').replace(/^#/,'') !== 'selecao-da-semana' && !root.classList.contains('active'))) return;
    if (!root.querySelector('[data-s1s2-selection-root]')) scheduleRender();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();
