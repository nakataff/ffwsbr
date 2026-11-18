(() => {
  'use strict';
  const board=document.getElementById('home-global-classified');
  const rail=document.querySelector('.home-left-rail'),center=document.querySelector('.home-center-column');
  if(!board||!rail||!center)return;
  const mobile=window.matchMedia('(max-width: 900px)');
  function place(){
    const target=mobile.matches?rail:center;
    const support=document.querySelector('#home .home-support');
    target.insertBefore(board,target.firstElementChild);
    if(support)board.after(support);
  }
  place();
  mobile.addEventListener('change',place);

  const tabs=[...board.querySelectorAll('.home-global-tab')];
  const panels={upcoming:board.querySelector('#home-global-panel-upcoming'),slots:board.querySelector('#home-global-panel-slots')};
  function selectTab(which,focus=false){
    tabs.forEach(tab=>{
      const active=tab.id==='home-global-tab-'+which;
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
      tab.classList.toggle('is-active',active);
      if(active&&focus)tab.focus();
    });
    Object.entries(panels).forEach(([key,panel])=>{if(panel)panel.hidden=key!==which;});
  }
  tabs.forEach(tab=>{
    const key=tab.id.replace('home-global-tab-','');
    tab.addEventListener('click',()=>selectTab(key));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const keys=['upcoming','slots'],current=keys.indexOf(key);
      const next=event.key==='Home'?0:event.key==='End'?keys.length-1:(current+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
      selectTab(keys[next],true);
    });
  });
  selectTab('upcoming');

  const countdown=board.querySelector('.home-global-countdown');
  const output=board.querySelector('#home-global-upcoming-content');
  if(!countdown||!output)return;
  const label=countdown.querySelector('#home-global-countdown-label');
  const time=countdown.querySelector('time');
  const tabUpcoming=board.querySelector('#home-global-tab-upcoming');
  const watch=countdown.querySelector('.home-global-watch');
  const liveLink=()=>'<a class="home-global-watch home-global-watch-live" href="'+esc(watch.href)+'" target="_blank" rel="noopener noreferrer">'+(watch.querySelector('svg')?.outerHTML||'')+'<span>ASSISTIR À TRANSMISSÃO<small>FF ESPORTS BR · YOUTUBE</small></span></a>';
  const units=['days','hours','minutes','seconds'];
  const numbers=units.map(unit=>countdown.querySelector('[data-countdown-unit="'+unit+'"]'));
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const urlImage=value=>{
    const src=String(value||'');
    return /^\/?home-assets\/teams\/global\/[a-z0-9-]+\.webp$/.test(src)?'/'+src.replace(/^\//,''):'';
  };
  const compact={ 'stellar-esport':'STG','total-winner-esports':'TW','pe':'PRT','p-esports':'PE' };
  const startOf=round=>Date.parse(round.date+'T'+round.time24+':00-03:00');
  // Six-drop sessions last approximately 4h30; these are display windows, not official end times.
  // Limit a window to the start of the next scheduled session to avoid overlapping fixtures.
  const estimatedEnd=(round,index)=>{
    const start=startOf(round),following=rounds[index+1],nextStart=following?startOf(following):Infinity;
    if(round.stage==='final')return Date.parse(round.date+'T23:59:59-03:00')+1000;
    const duration=round.stage==='lastChance'?7.5:4.5;
    return Math.min(start+duration*60*60*1000,nextStart);
  };
  const focusedRoundAt=now=>rounds.findIndex((round,index)=>
    now<estimatedEnd(round,index)&&!(now>=startOf(round)&&completed.has(round.key)));
  const displayDate=round=>{
    const [year,month,day]=round.date.split('-');
    return day+'/'+month+'/'+year+' · '+round.time24+'h';
  };
  let rounds=[],groups={},teams=new Map(),lastRoundKey='',timer=null,boundary=null,target=Date.parse(countdown.dataset.start);
  const completed=new Map();
  const lobbySize=12, finalistsPerDay=2, finalistsFromLastChance=4;
  let loaded=false,showClock=true;

  function setCountdown(round,index,started=false){
    showClock=!!round&&!started;
    countdown.hidden=!showClock;
    target=!round?NaN:started?estimatedEnd(round,index):startOf(round);
    if(tabUpcoming)tabUpcoming.textContent=started?'CONFRONTO ATUAL':round?'PRÓXIMOS CONFRONTOS':'CONFRONTOS';
    if(!showClock){delete countdown.dataset.start;return;}
    const [,,day]=round.date.split('-');
    const [hour,minute]=round.time24.split(':');
    const iso=round.date+'T'+round.time24+':00-03:00';
    countdown.dataset.start=iso;
    if(time){time.setAttribute('datetime',iso);time.innerHTML=esc(day)+' NOV · '+esc(hour)+'H'+(minute==='00'?'':esc(minute))+' <small>BRASÍLIA</small>';}
    if(label)label.textContent=index===0?'CONTAGEM PARA A ESTREIA':'CONTAGEM PARA A PRÓXIMA RODADA';
    countdown.classList.remove('has-started');
  }

  function roster(group){
    return matchupRoster(groups?.[group]||[],'Grupo '+group);
  }
  function teamCard(id,detail='',highlight=false,fullName=false){
    const team=teams.get(id);
    if(!team)return '';
    const short=compact[id]||team.abbreviation||team.name;
    const image=urlImage(team.logo);
    return '<a class="home-global-match-team'+(highlight?' is-new':'')+'" href="/ffws-global-2026/equipe?time='+encodeURIComponent(id)+'" aria-label="Ver elenco e estatísticas de '+esc(team.name)+(detail?' · '+esc(detail):'')+'" title="'+esc(team.name)+'">'+
      (image?'<img src="'+esc(image)+'" loading="lazy" decoding="async" alt="" onerror="this.hidden=true">':'')+
      '<strong>'+esc(fullName?team.name:short)+'</strong>'+(detail?'<small>'+esc(detail)+'</small>':'')+'</a>';
  }
  function matchupRoster(ids,title){
    return '<div class="home-global-match-group" aria-label="'+esc(title)+'"><div class="home-global-group-head"><span>'+esc(title.toUpperCase())+'</span><small>'+ids.length+' EQUIPES</small></div><div class="home-global-match-teams">'+ids.map(id=>teamCard(id)).join('')+'</div></div>';
  }

  function finalQualifiers(){
    const qualified=new Map();
    for(const round of rounds){
      const podium=round.stage==='segundaFase'?finalistsPerDay:finalistsFromLastChance;
      for(const [index,id] of (completed.get(round.key)||[]).slice(0,podium).entries()){
        const source=round.stage==='segundaFase'?'Fase 2 · Dia '+round.day:'Repescagem';
        if(!qualified.has(id))qualified.set(id,source+' · '+(index+1)+'º');
      }
    }
    return qualified;
  }
  function matchRoster(round){
    const seeds=(round.seededTeams||[]).filter(id=>teams.has(id));
    if(round.stage==='final'){
      const ids=[...finalQualifiers().keys()];
      return {ids,newcomers:[],pending:'As vagas restantes serão definidas na Fase 2 e na Repescagem.'};
    }
    const previous=round.stage==='lastChance'?rounds.filter(item=>item.stage==='segundaFase').at(-1):
      rounds.find(item=>item.stage==='segundaFase'&&item.day===round.day-1);
    const carry=(completed.get(previous?.key)||[]).slice(finalistsPerDay);
    const newcomers=round.stage==='segundaFase'&&round.day>1?seeds:[];
    const pending=round.stage==='lastChance'?'As vagas restantes serão definidas no Dia '+(previous?.day||4)+' da Fase 2.':
      'As vagas restantes serão definidas pelo resultado do Dia '+(round.day-1)+' da Fase 2.';
    return {ids:[...new Set([...seeds,...carry])],newcomers,pending};
  }
  function seededRoster(round){
    const {ids,newcomers,pending}=matchRoster(round);
    const heading=round.stage==='segundaFase'?'Equipes do Dia '+round.day:round.stage==='lastChance'?'Equipes da Repescagem':'Equipes da Grande Final';
    return '<div class="home-global-match-group home-global-single-roster" aria-label="'+esc(heading)+'"><div class="home-global-group-head"><span>'+esc(heading)+'</span><small>'+ids.length+' DE '+lobbySize+' CONFIRMADAS</small></div>'+
      (ids.length?'<div class="home-global-match-teams">'+ids.map(id=>{const isNew=newcomers.includes(id);return teamCard(id,isNew?'Estreia neste dia':'',isNew);}).join('')+'</div>':'')+
      (ids.length<lobbySize?'<p class="home-global-roster-note">'+esc(pending)+'</p>':'')+'</div>';
  }
  function nextEntrants(round){
    if(round?.stage!=='segundaFase'||round.day===1||!round.seededTeams?.length)return '';
    return '<section class="home-global-entrants" aria-labelledby="home-global-entrants-title"><div class="home-global-group-head"><h3 id="home-global-entrants-title">Estreiam no Dia '+round.day+'</h3><small>'+esc(displayDate(round))+'</small></div><div class="home-global-match-teams">'+
      round.seededTeams.map(id=>teamCard(id,'',false,true)).join('')+'</div></section>';
  }
  function qualificationPanel(){
    const qualified=finalQualifiers();
    return '<section class="home-global-finalists" aria-labelledby="home-global-finalists-title"><div class="home-global-group-head"><h3 id="home-global-finalists-title">Classificados para a Grande Final</h3><small>'+qualified.size+' DE '+lobbySize+' VAGAS</small></div>'+
      (qualified.size?'<div class="home-global-match-teams">'+[...qualified].map(([id,source])=>teamCard(id,source)).join('')+'</div>':
        '<p class="home-global-roster-note">Os dois melhores de cada dia da Fase 2 e os quatro melhores da Repescagem garantem vaga.</p>')+'</section>';
  }

  function renderRoundRow(round){
    const pair=Array.isArray(round.groups)&&round.groups.length===2?round.groups:null;
    const stage=round.stage==='classificatoria'?'KNOCKOUT · FASE 1':round.stage==='segundaFase'?'KNOCKOUT · FASE 2':round.stage==='lastChance'?'LAST CHANCE':'GRANDE FINAL';
    const match=pair?'GRUPO '+pair[0]+' <span aria-hidden="true">×</span> GRUPO '+pair[1]:
      round.stage==='segundaFase'?esc(round.label)+' · 12 equipes':
      round.stage==='lastChance'?'12 equipes · 4 vagas na final':'12 equipes · Champion Rush';
    const matchup=pair?'<div class="home-global-matchup">'+roster(pair[0])+'<div class="home-global-versus" aria-label="contra">×</div>'+roster(pair[1])+'</div>':
      seededRoster(round);
    return '<details class="home-global-fixture"><summary class="home-global-fixture-row"><div class="home-global-fixture-date"><strong>'+esc(round.date.split('-').slice(1).reverse().join('/'))+'</strong><span>'+esc(round.time24)+'</span></div><div class="home-global-fixture-main"><span>'+esc(stage)+'</span><strong>'+match+'</strong></div><small>'+esc(round.stage==='final'?'110 pontos para ativar':round.matches?round.matches+' QUEDAS':'HORÁRIO DE BRASÍLIA')+'</small><span class="home-global-fixture-chevron" aria-hidden="true">⌄</span></summary><div class="home-global-fixture-expanded"><p class="home-global-fixture-expanded-heading">'+esc(round.label)+' · '+esc(displayDate(round))+' (Brasília)</p>'+matchup+'</div></details>';
  }
  // Keep one preview expanded at a time while allowing native keyboard interaction.
  output.addEventListener('toggle',event=>{
    const opened=event.target;
    if(!opened.matches?.('.home-global-fixture')||!opened.open)return;
    output.querySelectorAll('.home-global-fixture[open]').forEach(other=>{if(other!==opened)other.open=false;});
  },true);

  function renderUpcoming(){
    if(!loaded)return;
    const idx=focusedRoundAt(Date.now());
    const next=idx>=0?rounds[idx]:null;
    const started=!!next&&Date.now()>=startOf(next);
    const key=(next?.key||'ended')+(started?':in-window':':upcoming');
    if(key===lastRoundKey)return;
    setCountdown(next,idx,started);lastRoundKey=key;
    if(!next){
      output.innerHTML='<div class="home-global-finished"><strong>CALENDÁRIO DO MUNDIAL ENCERRADO</strong><p>As datas programadas já passaram. Consulte a página do torneio para ver resultados e classificação.</p><a href="/ffws-global-2026/datas">VER CALENDÁRIO DO MUNDIAL →</a></div>'+qualificationPanel();
      return;
    }
    const pair=Array.isArray(next.groups)&&next.groups.length===2?next.groups:null;
    const headline=pair?'<div class="home-global-matchup">'+roster(pair[0])+'<div class="home-global-versus" aria-label="contra">×</div>'+roster(pair[1])+'</div>':
      seededRoster(next);
    const after=rounds.slice(idx+1,idx+4);
    output.innerHTML='<div class="home-global-match-head'+(started?' is-live':'')+'"><div><span class="home-global-match-eyebrow">'+(started?'RODADA EM ANDAMENTO':'PRÓXIMO CONFRONTO')+'</span><h3>'+esc(pair?'GRUPO '+pair[0]+' × GRUPO '+pair[1]:next.stage==='segundaFase'?'KNOCKOUT · FASE 2':next.stage==='lastChance'?'REPESCAGEM · LAST CHANCE':'GRANDE FINAL')+'</h3><p>'+esc(next.label)+' · '+esc(displayDate(next))+' (Brasília)</p></div><span class="home-global-round-tag">'+esc(next.matches?next.matches+' QUEDAS':next.stage==='final'?'CHAMPION RUSH':'12 EQUIPES')+'</span></div>'+(started?liveLink():'')+headline+
      (next.stage==='segundaFase'?nextEntrants(after[0]):'')+(next.stage!=='classificatoria'?qualificationPanel():'')+
      '<div class="home-global-next-list"><div class="home-global-next-list-title"><h3>PRÓXIMAS RODADAS</h3><small>HORÁRIO DE BRASÍLIA</small></div>'+(after.map(round=>renderRoundRow(round)).join('')||'<p class="home-global-no-more">Nenhuma outra rodada prevista no calendário.</p>')+'</div><a class="home-global-calendar-link" href="/ffws-global-2026/datas">VER CALENDÁRIO COMPLETO <span aria-hidden="true">→</span></a>';
  }

  function updateClock(){
    if(!showClock||!Number.isFinite(target))return;
    const total=Math.max(0,Math.ceil((target-Date.now())/1000));
    const values=[Math.floor(total/86400),Math.floor(total%86400/3600),Math.floor(total%3600/60),total%60];
    numbers.forEach((node,i)=>{if(node){const value=String(values[i]).padStart(2,'0');if(node.textContent!==value)node.textContent=value;}});
    if(!total&&!loaded){
      countdown.classList.add('has-started');
      if(label)label.textContent='TRANSMISSÃO OFICIAL';
      showClock=false;
    }
  }
  function resume(){
    clearInterval(timer);timer=null;clearTimeout(boundary);boundary=null;
    if(document.hidden)return;
    if(loaded)renderUpcoming();
    updateClock();
    const remaining=target-Date.now();
    if(remaining>0)boundary=setTimeout(resume,Math.min(remaining,2147483647));
    if(showClock&&remaining>0)timer=setInterval(updateClock,1000);
  }
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('hashchange',resume);
  window.addEventListener('cff:pretty-route',resume);
  resume();

  async function loadSchedule(){
    if(typeof fetch!=='function')return;
    try{
      const response=await fetch('/ffws-global-2026/inicio-resumo.json',{cache:'no-cache'});
      if(!response.ok)throw Error('Falha ao consultar o calendário do Mundial');
      const calendar=await response.json();
      const teamList=new Map(calendar.teams.map(team=>[team.id,team]));
      const groupList=Object.fromEntries(['A','B','C','D'].map(group=>[group,calendar.teams.filter(team=>team.group===group).map(team=>team.id)]));
      const knownIds=['A','B','C','D'].flatMap(key=>groupList?.[key]||[]);
      if(knownIds.length!==24||new Set(knownIds).size!==24||knownIds.some(id=>!teamList.has(id))||
         ['A','B','C','D'].some(key=>!Array.isArray(groupList[key])||groupList[key].length!==6)){
        throw Error('Os grupos precisam conter 24 equipes distintas');
      }
      const upcoming=(calendar.rounds||[]).filter(round=>round.date&&round.time24&&['classificatoria','segundaFase','lastChance','final'].includes(round.stage)).sort((a,b)=>startOf(a)-startOf(b));
      if(!upcoming.length||upcoming.some(round=>!Number.isFinite(startOf(round))||(round.groups&&!round.groups.every(group=>groupList[group]))))throw Error('Calendário inválido');
      const idsByName=new Map(calendar.teams.map(team=>[team.name,team.id]));
      for(const round of upcoming.filter(round=>['segundaFase','lastChance'].includes(round.stage))){
        const day=calendar.tables?.[round.stage]?.days.find(day=>day.day===round.day);
        if(day?.rows.length!==lobbySize||!round.matches)continue;
        const ordered=[...day.rows].sort((a,b)=>a.position-b.position);
        const ids=ordered.map(row=>idsByName.get(row.team));
        if(new Set(ids).size!==lobbySize||ids.includes(undefined))continue;
        if(ordered.every((row,index)=>row.position===index+1&&row.matches===round.matches))completed.set(round.key,ids);
      }
      groups=groupList;teams=teamList;rounds=upcoming;loaded=true;
      renderUpcoming();resume();
    }catch(error){
      output.innerHTML='<p class="home-global-error">Não foi possível carregar os próximos confrontos agora. O calendário completo continua disponível.</p><a class="home-global-calendar-link" href="/ffws-global-2026/datas">CONSULTAR DATAS DO MUNDIAL →</a>';
    }
  }
  loadSchedule();
})();
