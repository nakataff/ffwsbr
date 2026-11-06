/* FFWS Global Finals 2026 — selections computed from the published per-drop player feed.
 * Each lineup has 2 rushers, 1 granadeiro, 1 suporte/sniper and 1 known coach.
 * Coaches are scored only from collective player results, never assigned personal kills.
 */
(function(){
  'use strict';
  if(window.CFFGlobalSelections)return;
  const SOURCE='/ffws-global-2026/',ROSTER_VERSION='20261106-snipers-v2';
  const COACHES={
    lyon:'Benja',btr:'Chrisjo',gow:'4Sure','p-esports':'HoangAnh','ag-al':'PEPONLY',
    'team-flash':'Shin',rrq:'Adi',onic:'Afm',bru:'D_LONG',loud:'JOKER',
    los:'LIPÃO',fx:'LUUUKING',gundynasty:'Sullivan','stellar-esport':'BRN',
    'total-winner-esports':'CHACHA','horaa-esports':'RENICE',xprojekt:'MR ALI',tag:'Frois'
  };
  const ROLES=[
    {key:'rush',title:'RUSH',count:2},
    {key:'gran',title:'GRANADEIRO',count:1},
    {key:'support',title:'SUPORTE / SNIPER',count:1},
    {key:'coach',title:'COACH',count:1}
  ];
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const num=value=>Number(value)||0;
  const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const fmt=value=>Math.round(num(value)).toLocaleString('pt-BR');
  const dateText=value=>String(value||'').slice(8,10)+'/'+String(value||'').slice(5,7);
  const stageText=stage=>({classificatoria:'Knockout • Fase 1',segundaFase:'Knockout • Fase 2',lastChance:'Last Chance',final:'Grande Final'}[stage]||'Mundial');
  const imageUrl=value=>{
    const v=String(value||'').trim();
    return /^https:\/\//i.test(v)?v:('/'+v.replace(/^\/+/,''));
  };
  let DATA=null,loading=null;
  const prefs={
    page:{mode:'day',day:'',week:''},
    home:{mode:'day',day:'',week:''},
    start:{mode:'day',day:'',week:''}
  };
  function setData(players,teams){
    if(!players||!Array.isArray(players.entries)||!Array.isArray(players.players))return false;
    const roster=Array.isArray(teams?.teams)?teams.teams:(Array.isArray(teams)?teams:[]);
    DATA={players:players.players,entries:players.entries,teams:roster};
    return true;
  }
  async function load(){
    if(DATA)return DATA;
    if(loading)return loading;
    loading=Promise.all([
      fetch(SOURCE+'players.json?v='+ROSTER_VERSION,{cache:'default'}).then(r=>{if(!r.ok)throw Error('Jogadores indisponíveis');return r.json()}),
      fetch(SOURCE+'teams.json',{cache:'default'}).then(r=>{if(!r.ok)throw Error('Equipes indisponíveis');return r.json()})
    ]).then(([p,t])=>{setData(p,t);return DATA}).finally(()=>{loading=null});
    return loading;
  }
  function periods(){
    if(!DATA)return {days:[],weeks:[]};
    const days=new Map(),weeks=new Map();
    for(const entry of DATA.entries){
      const date=String(entry.date||''),stage=String(entry.stage||'classificatoria');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
      const dayKey=stage+'|'+date;
      if(!days.has(dayKey))days.set(dayKey,{key:dayKey,date,stage,day:num(entry.day),label:dateText(date)+' · '+stageText(stage),entries:[]});
      days.get(dayKey).entries.push(entry);
      let weekNo=1;
      if(stage==='classificatoria')weekNo=num(entry.day)<=3?1:2;
      const weekKey=stage+'|'+weekNo;
      if(!weeks.has(weekKey))weeks.set(weekKey,{key:weekKey,stage,weekNo,dates:new Set(),entries:[]});
      const week=weeks.get(weekKey);
      week.dates.add(date);
      week.entries.push(entry);
    }
    const dayList=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.stage.localeCompare(b.stage));
    const weekList=[...weeks.values()].sort((a,b)=>[...a.dates][0].localeCompare([...b.dates][0]));
    for(const w of weekList){
      const expected=w.stage==='classificatoria'?3:w.stage==='segundaFase'?4:1;
      const dates=[...w.dates].sort();
      w.label=(w.stage==='classificatoria'?'Semana '+w.weekNo:'Etapa')+' · '+stageText(w.stage);
      w.subtitle=dates.map(dateText).join(' • ');
      w.partial=w.dates.size<expected;
    }
    return {days:dayList,weeks:weekList};
  }
  function category(role){
    const r=norm(role);
    if(r.includes('rusher')||r==='rush')return 'rush';
    if(r.includes('bomber')||r.includes('granadeiro')||r==='gran')return 'gran';
    if(r.includes('support')||r.includes('suporte')||r.includes('sniper')||r==='sup')return 'support';
    return '';
  }
  function aggregate(entries){
    const byId=new Map(DATA.players.map(p=>[p.id,p]));
    const teamByName=new Map(DATA.teams.map(t=>[norm(t.name),t]));
    const playerByName=new Map(DATA.players.map(p=>[norm(p.team)+'|'+norm(p.name),p]));
    const teamsById=new Map(DATA.teams.map(t=>[t.id,t]));
    const players=new Map();
    for(const event of entries){
      const key=event.playerId||norm(event.team)+'|'+norm(event.name);
      const meta=byId.get(event.playerId)||playerByName.get(norm(event.team)+'|'+norm(event.name));
      if(!meta||meta.type&&meta.type!=='player')continue;
      const team=teamByName.get(norm(meta.team))||teamByName.get(norm(event.team));
      const role=category(meta.role);
      if(!role||!team)continue;
      let row=players.get(key);
      if(!row){
        row={id:meta.id,name:meta.name,team:team.name,teamId:team.id,teamLogo:team.logo,
          role:meta.role,photo:meta.photoLarge||meta.photo,category:role,
          kills:0,assists:0,damage:0,matches:0};
        players.set(key,row);
      }
      row.matches++;
      row.kills+=num(event.kills??event.abates);
      row.assists+=num(event.assists??event.assistencias);
      row.damage+=num(event.damage??event.dano);
    }
    const rows=[...players.values()].filter(p=>p.matches);
    const teamTotals=new Map();
    for(const p of rows){
      if(!teamTotals.has(p.teamId))teamTotals.set(p.teamId,{teamId:p.teamId,team:p.team,teamLogo:p.teamLogo,kills:0,assists:0,damage:0,matches:0});
      const t=teamTotals.get(p.teamId);
      t.kills+=p.kills;t.assists+=p.assists;t.damage+=p.damage;
      t.matches=Math.max(t.matches,p.matches);
    }
    const coaches=[...teamTotals.values()].filter(t=>COACHES[t.teamId]).map(t=>({
      ...t,id:'coach:'+t.teamId,name:COACHES[t.teamId],category:'coach',role:'Coach',
      coach:true,photo:'',score:(t.kills*5+t.assists+t.damage/420)/Math.max(1,t.matches)
    }));
    return {rows,coaches};
  }
  function score(player,slot){
    const matches=Math.max(1,player.matches);
    if(slot==='rush')return (player.kills*8+player.damage/260+player.assists*1.2)/matches;
    if(slot==='gran')return (player.kills*7+player.damage/260+player.assists*1.6)/matches;
    return (player.assists*4.2+player.damage/210+player.kills*4)/matches;
  }
  function build(entries){
    const {rows,coaches}=aggregate(entries),used=new Set(),lineup=[];
    for(const slot of ROLES){
      const pool=(slot.key==='coach'?coaches:rows.filter(p=>p.category===slot.key))
        .filter(p=>!used.has(p.id))
        .map(p=>({...p,score:slot.key==='coach'?p.score:score(p,slot.key)}))
        .sort((a,b)=>b.score-a.score||b.kills-a.kills||b.damage-a.damage||a.name.localeCompare(b.name,'pt-BR'));
      for(let index=0;index<slot.count;index++){
        const pick=pool.find(p=>!used.has(p.id));
        if(pick){used.add(pick.id);lineup.push({...pick,slot:slot.title})}
        else lineup.push({slot:slot.title,missing:true,name:'Aguardando dados'});
      }
    }
    return lineup;
  }
  function card(row,compact=false){
    if(row.missing)return '<article class="cff-gsel-card cff-gsel-missing"><div class="cff-gsel-slot">'+esc(row.slot)+'</div><strong>Sem dados nesta função</strong></article>';
    const coach=!!row.coach,link=coach?'/ffws-global-2026/equipe?time='+encodeURIComponent(row.teamId):
      '/ffws-global-2026/jogador?id='+encodeURIComponent(row.id);
    const photo=coach?row.teamLogo:row.photo;
    const fallback=coach?'/escudo.webp':'/silhueta.webp';
    const roleNote=coach?'Destaque coletivo':norm(row.role)==='sniper'?'Sniper · vaga de suporte':row.role;
    const metrics=coach?
      '<div class="cff-gsel-numbers"><span><b>'+fmt(row.kills)+'</b><small>Abates do time</small></span><span><b>'+fmt(row.assists)+'</b><small>Assist. do time</small></span></div>':
      '<div class="cff-gsel-numbers"><span><b>'+fmt(row.kills)+'</b><small>Abates</small></span><span><b>'+fmt(row.damage)+'</b><small>Dano</small></span><span><b>'+fmt(row.assists)+'</b><small>Assist.</small></span></div>';
    return '<a class="cff-gsel-card'+(coach?' is-coach':'')+(compact?' is-compact':'')+'" href="'+esc(link)+'" aria-label="'+esc(row.slot+': '+row.name)+'">'+
      '<div class="cff-gsel-card-top"><span class="cff-gsel-slot">'+esc(row.slot)+'</span><img class="cff-gsel-team-logo" src="'+esc(imageUrl(row.teamLogo||'/escudo.webp'))+'" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'/escudo.webp\'"></div>'+
      '<div class="cff-gsel-photo-wrap"><img class="cff-gsel-photo" src="'+esc(imageUrl(photo||fallback))+'" alt="" loading="lazy" onerror="this.onerror=null;this.src=\''+fallback+'\'"></div>'+
      '<div class="cff-gsel-card-bottom"><strong>'+esc(row.name)+'</strong><small>'+esc(row.team)+'</small><em>'+esc(roleNote)+'</em>'+metrics+'</div></a>';
  }
  function render(host,context){
    if(!host||!DATA)return;
    const {days,weeks}=periods(),pref=prefs[context],current=context==='page'?'SELEÇÕES DO MUNDIAL':context==='start'?'DESTAQUES DO MUNDIAL':'SELEÇÃO DO MUNDIAL';
    const list=pref.mode==='week'?weeks:days;
    const property=pref.mode==='week'?'week':'day';
    if(!list.some(p=>p.key===pref[property]))pref[property]=list.at(-1)?.key||'';
    const chosen=list.find(p=>p.key===pref[property])||list.at(-1);
    const lineup=chosen?build(chosen.entries):[];
    const title=pref.mode==='week'?'Seleção da Semana':'Seleção do Dia';
    const status=pref.mode==='week'&&chosen?.partial?' · Semana em andamento':'';
    const options=list.map(p=>'<option value="'+esc(p.key)+'"'+(p.key===pref[property]?' selected':'')+'>'+esc(pref.mode==='week'?p.label+' · '+p.subtitle:p.label)+'</option>').join('');
    const summary='<div class="cff-gsel-summary">2 rush • 1 granadeiro • 1 suporte/sniper • 1 coach</div>';
    host.classList.add('cff-gsel-host','cff-gsel-'+context);
    host.innerHTML='<div class="cff-gsel-heading"><div><span class="cff-gsel-kicker">FFWS GLOBAL FINALS 2026</span><h2>'+esc(context==='page'?current:title)+'</h2><p>'+esc(chosen?title+' · '+(pref.mode==='week'?chosen.subtitle:dateText(chosen.date))+' · '+stageText(chosen.stage)+status:'Aguardando resultados')+'</p></div>'+
      '<a href="/ffws-global-2026/selecoes" class="cff-gsel-view-all"'+(context==='page'?' hidden':'')+'>Ver todas as seleções ↗</a></div>'+
      '<div class="cff-gsel-controls"><div class="cff-gsel-toggle" role="group" aria-label="Período da seleção">'+
      '<button type="button" data-gsel-mode="day" aria-pressed="'+(pref.mode==='day')+'">Seleção do Dia</button>'+
      '<button type="button" data-gsel-mode="week" aria-pressed="'+(pref.mode==='week')+'">Seleção da Semana</button></div>'+
      '<label class="cff-gsel-period">Período<select data-gsel-select aria-label="Escolher período"'+(list.length?'':' disabled')+'>'+ (options||'<option>Aguardando primeiro resultado</option>')+'</select></label></div>'+
      summary+'<div class="cff-gsel-lineup">'+(lineup.length?lineup.map(p=>card(p,context!=='page')).join(''):'<p class="cff-gsel-empty">Os destaques serão apresentados quando os resultados individuais estiverem disponíveis.</p>')+'</div>'+
      '<p class="cff-gsel-method">Jogadores por desempenho na função (abates, dano e assistências por queda). Coach pelo desempenho coletivo da equipe. Snipers disputam a vaga de suporte. Seleção estatística da Central Free Fire.</p>';
    if(host.dataset.gselBound)return;
    host.dataset.gselBound='1';
    host.addEventListener('click',ev=>{
      const button=ev.target.closest('[data-gsel-mode]');
      if(!button)return;
      const next=button.dataset.gselMode;
      if(next==='day'||next==='week'){prefs[context].mode=next;render(host,context)}
    });
    host.addEventListener('change',ev=>{
      if(!ev.target.matches('[data-gsel-select]'))return;
      const key=prefs[context].mode==='week'?'week':'day';
      prefs[context][key]=ev.target.value;
      render(host,context);
    });
  }
  function renderPage(root,players,teams){
    if(!setData(players,teams))return false;
    render(root,'page');
    return true;
  }
  async function renderHome(){
    const host=document.getElementById('global-selection-home-widget');
    if(!host)return;
    try{await load();render(host,'home')}catch(_){host.textContent='Não foi possível carregar as seleções do Mundial.'}
  }
  async function renderStart(){
    const host=document.getElementById('global-start-selection');
    if(!host)return;
    try{await load();render(host,'start')}catch(_){host.textContent='Seleções indisponíveis no momento.'}
  }
  window.CFFGlobalSelections={renderPage,renderHome,renderStart,ownsHome:()=>true,build,periods,
    coachNames:COACHES};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderHome,{once:true});
  else renderHome();
})();
