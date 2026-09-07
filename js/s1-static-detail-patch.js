(() => {
  'use strict';

  const BUILD = '20260907-s1-compare-only-v1';
  const PAGE = 'comparar-1v1';
  const MAPS = ['Nova Terra','Solara','Purgatório','Bermuda','Kalahari'];
  const state = {
    basePromise:null, detailPromise:null,
    teams:[], players:[], byName:new Map(), details:[],
    compare:{stage:'geral',role:'all',day:'all',map:'all',p1:'',p2:''}
  };

  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const num = value => Number(value) || 0;
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const fmt = value => Math.round(num(value)).toLocaleString('pt-BR');

  async function json(path) {
    const response = await fetch(`${path}?v=${BUILD}`, { cache:'force-cache' });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }

  function injectCss() {
    if (document.getElementById('s1-compare-only-css')) return;
    const style = document.createElement('style');
    style.id = 's1-compare-only-css';
    style.textContent = `
      #comparar-1v1 .s1cmp-picker{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:end;gap:14px;margin:8px 0 20px}
      #comparar-1v1 .s1cmp-picker>b{padding-bottom:12px;color:var(--accent,#00c8ff);font-size:1.08rem;font-weight:1000}
      #comparar-1v1 .s1cmp-label{display:grid;gap:7px;color:#8fa6bd;font-size:.7rem;font-weight:950;text-transform:uppercase;letter-spacing:.7px}
      #comparar-1v1 .s1cmp-label select{width:100%;height:44px;padding:0 12px;border:1px solid var(--border,rgba(255,255,255,.12));border-radius:10px;background:#09111d;color:#fff;font-weight:850;outline:none}
      #comparar-1v1 .s1cmp-label select:focus{border-color:var(--accent,#00c8ff)}
      #comparar-1v1 .s1cmp-note{margin-top:14px;color:#7890a8;font-size:.72rem;font-weight:800;text-align:center}
      @media(max-width:850px){#comparar-1v1 .s1cmp-picker{grid-template-columns:1fr}#comparar-1v1 .s1cmp-picker>b{text-align:center;padding:0}}
    `;
    document.head.appendChild(style);
  }

  function resolvePlayer(meta,key,stat) {
    const candidates = [key,stat?.name,stat?.jogador].map(norm).filter(Boolean);
    for (const [id,item] of Object.entries(meta || {})) {
      const aliases = [id,item?.name,...(Array.isArray(item?.aliases) ? item.aliases : [])].map(norm);
      if (candidates.some(candidate => aliases.includes(candidate))) return {id,item};
    }
    return {id:key,item:{}};
  }

  function roleKey(player) {
    const raw = String(player?.role || 'RUSH').toUpperCase();
    if (raw.includes('GRAN')) return 'GRAN';
    if (raw.includes('SUP')) return 'SUP';
    if (raw === '3' || raw.includes('3º')) return '3';
    return 'RUSH';
  }

  function statFrom(source) {
    const out = source || {};
    const matches = num(out.matches);
    return {
      kills:num(out.kills), damage:num(out.damage), assists:num(out.assists), matches,
      mvps:num(out.mvp ?? out.mvps), bestDrop:num(out.record),
      avgKills:matches ? num(out.kills)/matches : 0,
      avgDamage:matches ? num(out.damage)/matches : 0,
      avgAssists:matches ? num(out.assists)/matches : 0
    };
  }

  async function loadBase() {
    if (state.players.length) return state;
    if (state.basePromise) return state.basePromise;
    state.basePromise = Promise.all([
      json('ffws-br-2026-s1/teams.json'),
      json('ffws-br-2026-s1/player-meta.json'),
      json('ffws-br-2026-s1/player-stats.json')
    ]).then(([teamsPayload,metaPayload,statsPayload]) => {
      state.teams = teamsPayload?.teams || [];
      const meta = metaPayload?.players || {};
      state.players = Object.entries(statsPayload?.players || {}).map(([key,stat]) => {
        const resolved = resolvePlayer(meta,key,stat);
        const item = resolved.item || {};
        return {
          id:String(resolved.id || key),
          name:String(item.name || stat?.name || key),
          team:String(item.team || stat?.team || ''),
          role:String(item.role || 'RUSH'),
          aliases:Array.isArray(item.aliases) ? item.aliases : [],
          general:statFrom(stat),
          stages:{
            classificatoria:statFrom(stat?.stages?.classificatoria),
            final:statFrom(stat?.stages?.final)
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
    if (state.detailPromise) return state.detailPromise;
    state.detailPromise = json('ffws-br-2026-s1/players.json').then(data => {
      const stages = data?.stages || ['classificatoria','final'];
      const names = data?.players || [];
      const teams = data?.teams || [];
      const maps = data?.maps || MAPS;
      state.details = (data?.entries || []).map(entry => {
        const name = names[num(entry?.[4])] || '';
        const player = state.byName.get(norm(name)) || {id:norm(name),name,team:teams[num(entry?.[5])]||'',role:'RUSH',aliases:[]};
        return {
          player,
          stage:stages[num(entry?.[0])] || 'classificatoria',
          day:num(entry?.[1]), map:maps[num(entry?.[3])] || '',
          kills:num(entry?.[6]), damage:num(entry?.[7]), assists:num(entry?.[8]), mvp:num(entry?.[9])
        };
      }).filter(row => row.player?.name);
      return state.details;
    }).finally(() => { state.detailPromise = null; });
    return state.detailPromise;
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
      BIELGOD:'bielgod.webp',Cauan7:'cauan7.webp',WHISKYx:'whisky.webp',Rojão:'silhueta.webp',Mts007:'mts007.webp',Yann7awp:'yan7.webp',Theus:'theus.webp',wLiu:'wliu.webp',ITAL0$$:'italo.webp',IguiNmvp:'iguin.webp',Lost21:'lost21.webp','Keven7!':'keven.webp','DRADE.11':'drade.webp','SEU PAI':'seu pai.webp',YOKO7:'yoko.webp'
    };
    if (known[player?.name]) return known[player.name];
    const id = String(player?.id || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    return id ? `player-photos/s2/${id}.webp` : 'silhueta.webp';
  }

  function aggregateDetails(filters) {
    const out = new Map();
    state.details.forEach(entry => {
      if (filters.stage && filters.stage !== 'geral' && entry.stage !== filters.stage) return;
      if (filters.day && filters.day !== 'all' && entry.day !== num(filters.day)) return;
      if (filters.map && filters.map !== 'all' && entry.map !== filters.map) return;
      const id = entry.player.id || norm(entry.player.name);
      if (!out.has(id)) out.set(id,{player:entry.player,kills:0,damage:0,assists:0,matches:0,mvps:0,bestDrop:0});
      const row = out.get(id);
      row.kills += entry.kills;
      row.damage += entry.damage;
      row.assists += entry.assists;
      row.matches += 1;
      row.mvps += entry.mvp;
      row.bestDrop = Math.max(row.bestDrop,entry.kills);
    });
    return [...out.values()].map(row => ({
      ...row,
      avgKills:row.matches ? row.kills/row.matches : 0,
      avgDamage:row.matches ? row.damage/row.matches : 0,
      avgAssists:row.matches ? row.assists/row.matches : 0
    }));
  }

  async function rowsForCompare() {
    const f = state.compare;
    let rows;
    if (f.day === 'all' && f.map === 'all') {
      rows = state.players.map(player => ({player,...(f.stage === 'geral' ? player.general : player.stages?.[f.stage] || statFrom({}))})).filter(row => row.matches > 0);
    } else {
      await loadDetails();
      rows = aggregateDetails({stage:f.stage,day:f.day,map:f.map});
    }
    if (f.role !== 'all') rows = rows.filter(row => roleKey(row.player) === f.role || (f.role === 'RUSH' && roleKey(row.player) === '3'));
    return rows.sort((a,b) => b.kills-a.kills || b.damage-a.damage || a.player.name.localeCompare(b.player.name,'pt-BR'));
  }

  function compareMetric(label,a,b,formatter=value=>String(value)) {
    const av = num(a), bv = num(b);
    return `<div class="ffws-s2-compare-metric"><strong class="${av>bv?'winner':''}">${esc(formatter(a))}</strong><span>${esc(label)}</span><strong class="${bv>av?'winner':''}">${esc(formatter(b))}</strong></div>`;
  }

  function compareHero(row,side) {
    const player = row?.player;
    return `<article class="ffws-s2-player-compare-hero ${side}" data-s1cmp-player="${esc(player?.id || '')}" role="button" tabindex="0"><img class="ffws-s2-compare-photo" src="${esc(photo(player))}" alt="${esc(player?.name || 'Jogador')}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='silhueta.webp'"><div><img class="ffws-s2-compare-team-logo" src="${esc(teamLogo(player?.team))}" alt="" onerror="this.onerror=null;this.src='escudo.webp'"><strong>${esc(player?.name || '—')}</strong><span>${esc(player?.team || 'Sem equipe')}</span></div></article>`;
  }

  function picker(label,id,rows,selected) {
    const ordered = [...rows].sort((a,b) => a.player.name.localeCompare(b.player.name,'pt-BR'));
    return `<label class="s1cmp-label">${esc(label)}<select id="${id}">${ordered.map(row => `<option value="${esc(row.player.id)}"${row.player.id===selected?' selected':''}>${esc(row.player.name)} • ${esc(teamAbbr(row.player.team))}</option>`).join('')}</select></label>`;
  }

  function dayOptions(stage) {
    const max = stage === 'final' ? 2 : 20;
    return Array.from({length:max},(_,index) => index+1);
  }

  function openPlayer(player) {
    if (!player) return;
    try { if (typeof window.openPlayerProfile === 'function') return window.openPlayerProfile(player.name,player.team); } catch (_) {}
    location.href = `jogador.html?${new URLSearchParams({jogador:player.name,time:player.team})}`;
  }

  async function render() {
    if (String(location.hash || '').replace(/^#/,'') !== PAGE && !document.getElementById(PAGE)?.classList.contains('active')) return false;
    const root = document.getElementById(PAGE);
    if (!root) return false;
    injectCss();
    try {
      await loadBase();
      const rows = await rowsForCompare();
      const f = state.compare;
      if (!rows.some(row => row.player.id === f.p1)) f.p1 = rows[0]?.player.id || '';
      if (!rows.some(row => row.player.id === f.p2) || f.p2 === f.p1) f.p2 = rows.find(row => row.player.id !== f.p1)?.player.id || f.p1;
      const p1 = rows.find(row => row.player.id === f.p1);
      const p2 = rows.find(row => row.player.id === f.p2);
      root.innerHTML = `<div class="ffws-s2-shell" data-s1-detail="compare"><section class="ffws-s2-hero"><div class="ffws-s2-kicker">WB 2026 S1 • ARQUIVO</div><h1>Comparar 1V1</h1><p>Compare dois jogadores da WB 2026 S1.</p></section><section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Escolha o confronto</h2><p>Filtre por posição, etapa, dia e mapa como na WB 2026 S2.</p></div><span class="ffws-s2-badge">${rows.length} jogadores</span></div><div class="ffws-s2-filters"><label class="ffws-s2-filter"><span>Etapa:</span><select id="s1cmp-stage"><option value="classificatoria"${f.stage==='classificatoria'?' selected':''}>Classificatória</option><option value="final"${f.stage==='final'?' selected':''}>Final</option><option value="geral"${f.stage==='geral'?' selected':''}>Geral</option></select></label><label class="ffws-s2-filter"><span>Posição:</span><select id="s1cmp-role"><option value="all"${f.role==='all'?' selected':''}>Todas</option><option value="RUSH"${f.role==='RUSH'?' selected':''}>Rush</option><option value="GRAN"${f.role==='GRAN'?' selected':''}>Granadeiro</option><option value="SUP"${f.role==='SUP'?' selected':''}>Suporte</option></select></label><label class="ffws-s2-filter"><span>Dia:</span><select id="s1cmp-day"><option value="all">Todos</option>${dayOptions(f.stage).map(day => `<option value="${day}"${String(f.day)===String(day)?' selected':''}>Dia ${day}</option>`).join('')}</select></label><label class="ffws-s2-filter"><span>Mapa:</span><select id="s1cmp-map"><option value="all">Todos</option>${MAPS.map(map => `<option value="${esc(map)}"${f.map===map?' selected':''}>${esc(map)}</option>`).join('')}</select></label></div>${p1&&p2 ? `<div class="s1cmp-picker">${picker('Jogador 1','s1cmp-p1',rows,f.p1)}<b>VS</b>${picker('Jogador 2','s1cmp-p2',rows,f.p2)}</div><div class="ffws-s2-player-compare-grid">${compareHero(p1,'left')}<div class="ffws-s2-compare-metrics">${compareMetric('Abates',p1.kills,p2.kills,fmt)}${compareMetric('Dano',p1.damage,p2.damage,fmt)}${compareMetric('Assistências',p1.assists,p2.assists,fmt)}${compareMetric('Quedas',p1.matches,p2.matches,fmt)}${compareMetric('MVPs',p1.mvps,p2.mvps,fmt)}${compareMetric('K / queda',p1.avgKills,p2.avgKills,value=>num(value).toFixed(2))}${compareMetric('Dano / queda',p1.avgDamage,p2.avgDamage,fmt)}${compareMetric('Assist. / queda',p1.avgAssists,p2.avgAssists,value=>num(value).toFixed(2))}${compareMetric('Recorde em queda',p1.bestDrop,p2.bestDrop,fmt)}</div>${compareHero(p2,'right')}</div>` : '<div class="ffws-s2-empty"><div><strong>Nenhum jogador neste recorte</strong>Altere os filtros.</div></div>'}<div class="s1cmp-note">O resumo leve é usado por padrão. O arquivo completo das quedas só é baixado quando você filtra por dia ou mapa.</div></div></section></div>`;

      const rerender = (key,value) => {
        f[key] = value;
        if (['stage','role','day','map'].includes(key)) { f.p1=''; f.p2=''; if (key === 'stage') f.day='all'; }
        render();
      };
      document.getElementById('s1cmp-stage')?.addEventListener('change',event => rerender('stage',event.target.value));
      document.getElementById('s1cmp-role')?.addEventListener('change',event => rerender('role',event.target.value));
      document.getElementById('s1cmp-day')?.addEventListener('change',event => rerender('day',event.target.value));
      document.getElementById('s1cmp-map')?.addEventListener('change',event => rerender('map',event.target.value));
      document.getElementById('s1cmp-p1')?.addEventListener('change',event => { f.p1=event.target.value; render(); });
      document.getElementById('s1cmp-p2')?.addEventListener('change',event => { f.p2=event.target.value; render(); });
      root.querySelectorAll('[data-s1cmp-player]').forEach(card => card.addEventListener('click',() => openPlayer(state.players.find(player => String(player.id) === String(card.dataset.s1cmpPlayer)))));
      return true;
    } catch (error) {
      console.error('[S1 compare]',error);
      root.innerHTML = '<div class="ffws-s2-empty"><div><strong>Não foi possível carregar o comparador.</strong></div></div>';
      return false;
    }
  }

  function schedule() { setTimeout(render,80); }
  window.cffS1DetailRender = page => String(page || '') === PAGE ? render() : false;
  window.addEventListener('hashchange',schedule);
  document.addEventListener('DOMContentLoaded',schedule,{once:true});
  if (document.readyState !== 'loading') schedule();
})();