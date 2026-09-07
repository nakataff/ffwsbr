(() => {
  'use strict';

  const BUILD = '20260907-s1-static-detail-v2';
  const WEEKS = Object.freeze({
    '1':[1,2],'2':[3,4],'3':[5,6],'4':[7,8],'5':[9,10],
    '6':[11,12],'7':[13,14],'8':[15,16],'9':[17,18],'10':[19,20]
  });
  const MAPS = ['Nova Terra','Solara','Purgatório','Bermuda','Kalahari'];
  const state = {
    basePromise: null,
    detailPromise: null,
    teams: [], meta: {}, stats: {}, players: [], byName: new Map(), details: [],
    selectionTab: 'torneio', selectionWeek: '10',
    compare: { stage:'geral', role:'all', day:'all', map:'all', p1:'', p2:'' }
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

  function canonical(meta, key, stat) {
    const keys = [key, stat?.name, stat?.jogador].map(norm).filter(Boolean);
    for (const [id,item] of Object.entries(meta || {})) {
      const aliases = [id,item?.name,...(Array.isArray(item?.aliases)?item.aliases:[])].map(norm);
      if (keys.some(candidate => aliases.includes(candidate))) return { id, item };
    }
    return { id:key, item:{} };
  }

  function roleKey(player) {
    const raw = String(player?.role || 'RUSH').toUpperCase();
    if (raw.includes('GRAN')) return 'GRAN';
    if (raw.includes('SUP')) return 'SUP';
    if (raw === '3' || raw.includes('3º')) return '3';
    return 'RUSH';
  }

  function stageStat(player, stage) {
    const row = stage === 'geral' ? player?.general : player?.stages?.[stage];
    const out = row || {};
    return {
      kills:num(out.kills), damage:num(out.damage), assists:num(out.assists), matches:num(out.matches),
      mvps:num(out.mvp ?? out.mvps), bestDrop:num(out.record),
      avgKills:num(out.matches)?num(out.kills)/num(out.matches):0,
      avgDamage:num(out.matches)?num(out.damage)/num(out.matches):0,
      avgAssists:num(out.matches)?num(out.assists)/num(out.matches):0
    };
  }

  async function loadBase() {
    if (state.players.length) return state;
    if (state.basePromise) return state.basePromise;
    state.basePromise = Promise.all([
      json('ffws-br-2026-s1/teams.json'),
      json('ffws-br-2026-s1/player-meta.json'),
      json('ffws-br-2026-s1/player-stats.json')
    ]).then(([teams,meta,stats]) => {
      state.teams = teams?.teams || [];
      state.meta = meta?.players || {};
      state.stats = stats?.players || {};
      state.players = Object.entries(state.stats).map(([key,stat]) => {
        const resolved = canonical(state.meta,key,stat);
        const item = resolved.item || {};
        const player = {
          id:String(resolved.id || key), name:String(item.name || stat?.name || key),
          team:String(item.team || stat?.team || ''), role:String(item.role || 'RUSH'), rookie:Boolean(item.rookie),
          aliases:Array.isArray(item.aliases)?item.aliases:[],
          general:{kills:num(stat?.kills),damage:num(stat?.damage),assists:num(stat?.assists),matches:num(stat?.matches),mvp:num(stat?.mvp),record:num(stat?.record)},
          stages:{
            classificatoria:{kills:num(stat?.stages?.classificatoria?.kills),damage:num(stat?.stages?.classificatoria?.damage),assists:num(stat?.stages?.classificatoria?.assists),matches:num(stat?.stages?.classificatoria?.matches),mvp:num(stat?.stages?.classificatoria?.mvp)},
            final:{kills:num(stat?.stages?.final?.kills),damage:num(stat?.stages?.final?.damage),assists:num(stat?.stages?.final?.assists),matches:num(stat?.stages?.final?.matches),mvp:num(stat?.stages?.final?.mvp)}
          }
        };
        return player;
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
      const players = data?.players || [];
      const teams = data?.teams || [];
      const maps = data?.maps || MAPS;
      state.details = (data?.entries || []).map(entry => {
        const name = players[num(entry?.[4])] || '';
        const canonicalPlayer = state.byName.get(norm(name));
        return {
          player: canonicalPlayer || { id:norm(name),name,team:teams[num(entry?.[5])]||'',role:'RUSH',aliases:[] },
          stage: stages[num(entry?.[0])] || 'classificatoria', day:num(entry?.[1]), drop:num(entry?.[2]), map:maps[num(entry?.[3])] || '',
          kills:num(entry?.[6]), damage:num(entry?.[7]), assists:num(entry?.[8]), mvp:num(entry?.[9])
        };
      }).filter(row => row.player?.name);
      return state.details;
    }).finally(() => { state.detailPromise = null; });
    return state.detailPromise;
  }

  function teamLogo(name) {
    const team = state.teams.find(row => norm(row?.name) === norm(name));
    try { const found = window.getTeamLogoSafe?.(team?.name || name); if (found && found !== 'escudo.webp') return found; } catch (_) {}
    return team?.logo || 'escudo.webp';
  }

  function teamAbbr(name) {
    return state.teams.find(row => norm(row?.name) === norm(name))?.abbreviation || name;
  }

  function photo(player) {
    try { const found = window.cffResolvePlayerPhoto?.(player?.name || '', ''); if (found) return found; } catch (_) {}
    const known = {
      BIELGOD:'bielgod.webp',Cauan7:'cauan7.webp',WHISKYx:'whisky.webp',Rojão:'silhueta.webp',
      Mts007:'mts007.webp',Yann7awp:'yan7.webp',Theus:'theus.webp',wLiu:'wliu.webp',ITAL0$$:'italo.webp',
      IguiNmvp:'iguin.webp',Lost21:'lost21.webp',Keven7!:'keven.webp',DRADE.11:'drade.webp','SEU PAI':'seu pai.webp',YOKO7:'yoko.webp'
    };
    if (known[player?.name]) return known[player.name];
    const id = String(player?.id || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    return id ? `player-photos/s2/${id}.webp` : 'silhueta.webp';
  }

  function openPlayer(player) {
    if (!player) return;
    try { if (typeof window.openPlayerProfile === 'function') return window.openPlayerProfile(player.name,player.team); } catch (_) {}
    const query = new URLSearchParams({ jogador:player.name,time:player.team });
    location.href = `jogador.html?${query}`;
  }

  function lineupFromRows(rows) {
    const ordered = [...rows].sort((a,b) => b.kills-a.kills || b.damage-a.damage || a.player.name.localeCompare(b.player.name,'pt-BR'));
    const used = new Set();
    const take = (roles,amount) => ordered.filter(row => !used.has(row.player.id) && roles.includes(roleKey(row.player))).slice(0,amount).map(row => (used.add(row.player.id),row));
    let lineup = [...take(['RUSH','3'],2),...take(['GRAN'],1),...take(['SUP'],1)];
    if (lineup.length < 4) lineup = lineup.concat(ordered.filter(row => !used.has(row.player.id)).slice(0,4-lineup.length));
    return lineup;
  }

  function lightSelectionRows(stage) {
    return state.players.map(player => ({ player, ...stageStat(player,stage) })).filter(row => row.matches > 0);
  }

  function detailAggregate(filters = {}) {
    const map = new Map();
    state.details.forEach(entry => {
      if (filters.stage && filters.stage !== 'geral' && entry.stage !== filters.stage) return;
      if (filters.days?.length && !filters.days.includes(entry.day)) return;
      if (filters.day && filters.day !== 'all' && entry.day !== num(filters.day)) return;
      if (filters.map && filters.map !== 'all' && entry.map !== filters.map) return;
      const id = entry.player.id || norm(entry.player.name);
      if (!map.has(id)) map.set(id,{player:entry.player,kills:0,damage:0,assists:0,matches:0,mvps:0,bestDrop:0});
      const row = map.get(id);
      row.kills += entry.kills; row.damage += entry.damage; row.assists += entry.assists; row.matches += 1; row.mvps += entry.mvp; row.bestDrop = Math.max(row.bestDrop,entry.kills);
    });
    return [...map.values()].map(row => ({...row,avgKills:row.matches?row.kills/row.matches:0,avgDamage:row.matches?row.damage/row.matches:0,avgAssists:row.matches?row.assists/row.matches:0}));
  }

  function selectionCard(row) {
    const player = row.player;
    return `<article class="s1-static-selection-card" role="button" tabindex="0" data-s1-detail-player="${esc(player.id)}">
      <img class="s1-static-selection-photo" src="${esc(photo(player))}" alt="${esc(player.name)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='silhueta.webp'">
      <div class="s1-static-selection-shade"></div><div class="s1-static-selection-info">
      <span class="s1-static-selection-role">${esc(roleKey(player)==='SUP'?'Suporte':roleKey(player)==='GRAN'?'Granadeiro':roleKey(player)==='3'?'3º homem':'Rush')}</span>
      <h3>${esc(player.name)}</h3><div class="s1-static-selection-team"><img src="${esc(teamLogo(player.team))}" alt="" onerror="this.onerror=null;this.src='escudo.webp'"><span>${esc(player.team)}</span></div>
      <div class="s1-static-selection-stats"><div class="s1-static-selection-stat"><small>Abates</small><strong>${fmt(row.kills)}</strong></div><div class="s1-static-selection-stat"><small>K / queda</small><strong>${num(row.avgKills).toFixed(2)}</strong></div><div class="s1-static-selection-stat"><small>Dano</small><strong>${fmt(row.damage)}</strong></div><div class="s1-static-selection-stat"><small>Assist.</small><strong>${fmt(row.assists)}</strong></div></div>
      </div></article>`;
  }

  async function renderSelection() {
    await loadBase();
    const root = document.getElementById('selecao-da-semana');
    if (!root) return;
    let rows, title, description, filters = '';
    if (state.selectionTab === 'semanal') {
      await loadDetails();
      const days = WEEKS[state.selectionWeek] || WEEKS['10'];
      rows = detailAggregate({stage:'classificatoria',days});
      title = 'Times da Semana';
      description = `Semana ${state.selectionWeek} • Dias ${days.join(' e ')}. Os melhores de cada posição no período.`;
      filters = `<div class="season-selection-week-stage-filter"><span>Fase:</span><button type="button" class="active">Classificatória</button></div><div class="season-selection-filters">${Object.keys(WEEKS).reverse().map(week => `<button type="button" class="${week===state.selectionWeek?'active':''}" data-s1-week="${week}">Semana ${week}</button>`).join('')}</div>`;
    } else {
      const stage = state.selectionTab === 'torneio' ? 'geral' : state.selectionTab;
      rows = lightSelectionRows(stage);
      title = state.selectionTab === 'torneio' ? 'Seleção do Torneio' : state.selectionTab === 'final' ? 'Seleção da Final' : 'Seleção da Classificatória';
      description = state.selectionTab === 'torneio' ? 'Melhores de cada posição considerando toda a temporada.' : state.selectionTab === 'final' ? 'Melhores de cada posição considerando somente a Final.' : 'Melhores de cada posição considerando toda a Classificatória.';
    }
    const lineup = lineupFromRows(rows);
    const tabs = [['semanal','Times da semana'],['classificatoria','Classificatória'],['final','Final'],['torneio','Torneio']];
    root.innerHTML = `<div class="ffws-s2-selection-page" data-s1-detail="selection"><div class="season-selection-hero"><div class="season-selection-kicker">WB 2026 S1 • ARQUIVO</div><h1>SELEÇÕES DA SEASON</h1><p>Os melhores jogadores por função: seleções semanais, classificatória, final e torneio.</p></div>
      <div class="season-selection-tabs">${tabs.map(([key,label]) => `<button type="button" class="season-selection-tab ${key===state.selectionTab?'active':''}" data-s1-selection-tab="${key}">${label}</button>`).join('')}</div>
      <section class="season-selection-panel"><div class="season-selection-section-head"><div><span class="season-selection-tag">${esc(state.selectionTab==='semanal'?`Semana ${state.selectionWeek}`:state.selectionTab)}</span><h2>${esc(title)}</h2></div><p>${esc(description)}</p></div>${filters}<div class="selection-grid season-selection-grid">${lineup.map(selectionCard).join('')}</div>
      <div class="s1-static-archive-note">Arquivo congelado da WB 2026 S1. A página não consulta planilhas externas; os dados detalhados só são carregados ao abrir Times da Semana.</div></section></div>`;
    root.querySelectorAll('[data-s1-selection-tab]').forEach(button => button.addEventListener('click',()=>{state.selectionTab=button.dataset.s1SelectionTab;renderSelection();}));
    root.querySelectorAll('[data-s1-week]').forEach(button => button.addEventListener('click',()=>{state.selectionWeek=button.dataset.s1Week;renderSelection();}));
    root.querySelectorAll('[data-s1-detail-player]').forEach(card => card.addEventListener('click',()=>openPlayer(state.players.find(p=>p.id===card.dataset.s1DetailPlayer))));
  }

  async function compareRows() {
    const f = state.compare;
    let rows;
    if (f.day === 'all' && f.map === 'all') {
      rows = state.players.map(player => ({player,...stageStat(player,f.stage)})).filter(row=>row.matches>0);
    } else {
      await loadDetails();
      rows = detailAggregate({stage:f.stage,day:f.day,map:f.map});
    }
    if (f.role !== 'all') rows = rows.filter(row => roleKey(row.player) === f.role || (f.role === 'RUSH' && roleKey(row.player)==='3'));
    return rows.sort((a,b)=>b.kills-a.kills||b.damage-a.damage||a.player.name.localeCompare(b.player.name,'pt-BR'));
  }

  function compareMetric(label,a,b,formatter=value=>String(value)) {
    const av=num(a),bv=num(b);
    return `<div class="ffws-s2-compare-metric"><strong class="${av>bv?'winner':''}">${esc(formatter(a))}</strong><span>${esc(label)}</span><strong class="${bv>av?'winner':''}">${esc(formatter(b))}</strong></div>`;
  }

  function compareHero(row,side) {
    const player=row?.player;
    return `<article class="ffws-s2-player-compare-hero ${side}" role="button" tabindex="0" data-s1-detail-player="${esc(player?.id||'')}"><img class="ffws-s2-compare-photo" src="${esc(photo(player))}" alt="${esc(player?.name||'Jogador')}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='silhueta.webp'"><div><img class="ffws-s2-compare-team-logo" src="${esc(teamLogo(player?.team))}" alt="" onerror="this.onerror=null;this.src='escudo.webp'"><strong>${esc(player?.name||'—')}</strong><span>${esc(player?.team||'Sem equipe')}</span></div></article>`;
  }

  function picker(label,id,rows,selected) {
    const ordered=[...rows].sort((a,b)=>a.player.name.localeCompare(b.player.name,'pt-BR'));
    return `<label class="s1-static-select-label">${esc(label)}<select id="${id}">${ordered.map(row=>`<option value="${esc(row.player.id)}"${row.player.id===selected?' selected':''}>${esc(row.player.name)} • ${esc(teamAbbr(row.player.team))}</option>`).join('')}</select></label>`;
  }

  function dayOptions(stage) {
    const max = stage === 'final' ? 2 : 20;
    return Array.from({length:max},(_,i)=>i+1);
  }

  async function renderCompare() {
    await loadBase();
    const root=document.getElementById('comparar-1v1');
    if(!root)return;
    root.innerHTML='<div class="ffws-s2-empty"><div><strong>Carregando comparação...</strong></div></div>';
    const rows=await compareRows();
    const f=state.compare;
    if(!rows.some(row=>row.player.id===f.p1))f.p1=rows[0]?.player.id||'';
    if(!rows.some(row=>row.player.id===f.p2)||f.p2===f.p1)f.p2=rows.find(row=>row.player.id!==f.p1)?.player.id||f.p1;
    const p1=rows.find(row=>row.player.id===f.p1),p2=rows.find(row=>row.player.id===f.p2);
    root.innerHTML=`<div class="ffws-s2-shell" data-s1-detail="compare"><section class="ffws-s2-hero"><div class="ffws-s2-kicker">WB 2026 S1 • ARQUIVO</div><h1>Comparar 1V1</h1><p>Compare dois jogadores da WB 2026 S1.</p></section><section class="ffws-s2-panel"><div class="ffws-s2-panel-inner"><div class="ffws-s2-panel-head"><div><h2>Escolha o confronto</h2><p>Filtre por posição, etapa, dia e mapa como na WB 2026 S2.</p></div><span class="ffws-s2-badge">${rows.length} jogadores</span></div>
      <div class="ffws-s2-filters"><label class="ffws-s2-filter"><span>Etapa:</span><select id="s1-detail-stage"><option value="classificatoria"${f.stage==='classificatoria'?' selected':''}>Classificatória</option><option value="final"${f.stage==='final'?' selected':''}>Final</option><option value="geral"${f.stage==='geral'?' selected':''}>Geral</option></select></label><label class="ffws-s2-filter"><span>Posição:</span><select id="s1-detail-role"><option value="all"${f.role==='all'?' selected':''}>Todas</option><option value="RUSH"${f.role==='RUSH'?' selected':''}>Rush</option><option value="GRAN"${f.role==='GRAN'?' selected':''}>Granadeiro</option><option value="SUP"${f.role==='SUP'?' selected':''}>Suporte</option></select></label><label class="ffws-s2-filter"><span>Dia:</span><select id="s1-detail-day"><option value="all">Todos</option>${dayOptions(f.stage).map(day=>`<option value="${day}"${String(f.day)===String(day)?' selected':''}>Dia ${day}</option>`).join('')}</select></label><label class="ffws-s2-filter"><span>Mapa:</span><select id="s1-detail-map"><option value="all">Todos</option>${MAPS.map(map=>`<option value="${esc(map)}"${f.map===map?' selected':''}>${esc(map)}</option>`).join('')}</select></label></div>
      ${p1&&p2?`<div class="s1-static-compare-picker">${picker('Jogador 1','s1-detail-p1',rows,f.p1)}<b>VS</b>${picker('Jogador 2','s1-detail-p2',rows,f.p2)}</div><div class="ffws-s2-player-compare-grid">${compareHero(p1,'left')}<div class="ffws-s2-compare-metrics">${compareMetric('Abates',p1.kills,p2.kills,fmt)}${compareMetric('Dano',p1.damage,p2.damage,fmt)}${compareMetric('Assistências',p1.assists,p2.assists,fmt)}${compareMetric('Quedas',p1.matches,p2.matches,fmt)}${compareMetric('MVPs',p1.mvps,p2.mvps,fmt)}${compareMetric('K / queda',p1.avgKills,p2.avgKills,v=>num(v).toFixed(2))}${compareMetric('Dano / queda',p1.avgDamage,p2.avgDamage,fmt)}${compareMetric('Assist. / queda',p1.avgAssists,p2.avgAssists,v=>num(v).toFixed(2))}${compareMetric('Recorde em queda',p1.bestDrop,p2.bestDrop,fmt)}</div>${compareHero(p2,'right')}</div>`:'<div class="ffws-s2-empty"><div><strong>Nenhum jogador neste recorte</strong>Altere os filtros para comparar jogadores disponíveis.</div></div>'}
      <div class="s1-static-archive-note">Geral, Classificatória e Final usam o resumo leve. O arquivo detalhado das quedas só é baixado quando você filtra por dia ou mapa.</div></div></section></div>`;
    const rerender=(key,value)=>{f[key]=value;if(['stage','role','day','map'].includes(key)){f.p1='';f.p2='';if(key==='stage')f.day='all';}renderCompare();};
    document.getElementById('s1-detail-stage')?.addEventListener('change',e=>rerender('stage',e.target.value));
    document.getElementById('s1-detail-role')?.addEventListener('change',e=>rerender('role',e.target.value));
    document.getElementById('s1-detail-day')?.addEventListener('change',e=>rerender('day',e.target.value));
    document.getElementById('s1-detail-map')?.addEventListener('change',e=>rerender('map',e.target.value));
    document.getElementById('s1-detail-p1')?.addEventListener('change',e=>{f.p1=e.target.value;renderCompare();});
    document.getElementById('s1-detail-p2')?.addEventListener('change',e=>{f.p2=e.target.value;renderCompare();});
    root.querySelectorAll('[data-s1-detail-player]').forEach(card=>card.addEventListener('click',()=>openPlayer(state.players.find(p=>p.id===card.dataset.s1DetailPlayer))));
  }

  async function render(page) {
    if (page === 'selecao-da-semana') return renderSelection();
    if (page === 'comparar-1v1') return renderCompare();
  }

  function activePage() { return String(location.hash||'').replace(/^#/,''); }
  function schedule(page) {
    if (!['selecao-da-semana','comparar-1v1'].includes(page)) return;
    setTimeout(()=>render(page).catch(error=>console.error('[S1 detail patch]',error)),180);
    setTimeout(()=>render(page).catch(error=>console.error('[S1 detail patch]',error)),950);
  }

  window.cffS1DetailRender = render;
  window.addEventListener('hashchange',()=>schedule(activePage()));
  const boot=()=>{
    schedule(activePage());
    ['navigate','navigateAndClose'].forEach(name=>{
      const base=window[name];
      if(typeof base!=='function'||base.__cffS1DetailWrapped)return;
      const wrapped=function(page,...args){const result=base.call(this,page,...args);schedule(String(page||''));return result;};
      wrapped.__cffS1DetailWrapped=true;window[name]=wrapped;
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  let attempts=0;const watch=setInterval(()=>{attempts++;boot();const page=activePage();if(page==='selecao-da-semana'&&!document.querySelector('#selecao-da-semana [data-s1-detail="selection"]'))schedule(page);if(page==='comparar-1v1'&&!document.querySelector('#comparar-1v1 [data-s1-detail="compare"]'))schedule(page);if(attempts>20)clearInterval(watch);},600);
})();