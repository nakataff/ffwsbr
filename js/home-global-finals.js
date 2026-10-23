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
    if(support)target.insertBefore(support,board);
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
  const focusedRoundAt=now=>rounds.findIndex((round,index)=>now<estimatedEnd(round,index));
  const displayDate=round=>{
    const [year,month,day]=round.date.split('-');
    return day+'/'+month+'/'+year+' · '+round.time24+'h';
  };
  let rounds=[],groups=null,teams=new Map(),lastRoundKey='',timer=null,target=Date.parse(countdown.dataset.start);
  let loaded=false;

  function setCountdown(round,index,started=false){
    if(!round){countdown.hidden=true;target=NaN;clearInterval(timer);timer=null;return;}
    countdown.hidden=false;
    target=started?estimatedEnd(round,index):startOf(round);
    const localDate=new Date(target-3*60*60*1000);
    const day=String(localDate.getUTCDate()).padStart(2,'0');
    const hour=String(localDate.getUTCHours()).padStart(2,'0'),minute=String(localDate.getUTCMinutes()).padStart(2,'0');
    const iso=localDate.toISOString().slice(0,16)+':00-03:00';
    countdown.dataset.start=iso;
    if(time){time.setAttribute('datetime',iso);time.innerHTML=esc(day)+' NOV · '+esc(hour)+'H'+(minute==='00'?'':esc(minute))+' <small>'+(started?'ESTIMATIVA · ':'')+'BRASÍLIA</small>';}
    if(label)label.textContent=started?'TROCA DE DESTAQUE PREVISTA':index===0?'CONTAGEM PARA A ESTREIA':'CONTAGEM PARA A PRÓXIMA RODADA';
    countdown.classList.remove('has-started');
  }

  function roster(group){
    const ids=groups?.[group]||[];
    return '<div class="home-global-match-group" aria-label="Grupo '+group+'"><div class="home-global-group-head"><span>GRUPO '+group+'</span><small>6 EQUIPES</small></div><div class="home-global-match-teams">'+ids.map(id=>{
      const team=teams.get(id);
      if(!team)return '';
      const short=compact[id]||team.abbreviation||team.name;
      const image=urlImage(team.logo);
      return '<a class="home-global-match-team" href="/ffws-global-2026/equipe?time='+encodeURIComponent(id)+'" aria-label="Ver elenco e estatísticas de '+esc(team.name)+'" title="'+esc(team.name)+'">'+(image?'<img src="'+esc(image)+'" loading="lazy" decoding="async" alt="" onerror="this.hidden=true">':'')+'<strong>'+esc(short)+'</strong></a>';
    }).join('')+'</div></div>';
  }

  function renderRoundRow(round){
    const pair=Array.isArray(round.groups)&&round.groups.length===2?round.groups:null;
    const stage=round.stage==='classificatoria'?'KNOCKOUT · FASE 1':round.stage==='segundaFase'?'KNOCKOUT · FASE 2':round.stage==='lastChance'?'LAST CHANCE':'GRANDE FINAL';
    const match=pair?'GRUPO '+pair[0]+' <span aria-hidden="true">×</span> GRUPO '+pair[1]:
      round.stage==='segundaFase'?'12 equipes · classificadas na fase anterior':
      round.stage==='lastChance'?'12 equipes · 4 vagas na final':'12 equipes · Champion Rush';
    const matchup=pair?'<div class="home-global-matchup">'+roster(pair[0])+'<div class="home-global-versus" aria-label="contra">×</div>'+roster(pair[1])+'</div>':
      '<p class="home-global-future-teams">Os participantes desta fase serão definidos pelos resultados das etapas anteriores.</p>';
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
    if(key!==lastRoundKey){setCountdown(next,idx,started);lastRoundKey=key;}
    if(!next){
      output.innerHTML='<div class="home-global-finished"><strong>CALENDÁRIO DO MUNDIAL ENCERRADO</strong><p>As datas programadas já passaram. Consulte a página do torneio para ver resultados e classificação.</p><a href="/ffws-global-2026/datas">VER CALENDÁRIO DO MUNDIAL →</a></div>';
      return;
    }
    const pair=Array.isArray(next.groups)&&next.groups.length===2?next.groups:null;
    const headline=pair?'<div class="home-global-matchup">'+roster(pair[0])+'<div class="home-global-versus" aria-label="contra">×</div>'+roster(pair[1])+'</div>':
      '<p class="home-global-future-teams">Os participantes desta fase serão definidos pelos resultados anteriores. A data e o horário já estão no calendário.</p>';
    const after=rounds.slice(idx+1,idx+4);
    output.innerHTML='<div class="home-global-match-head"><div><span class="home-global-match-eyebrow">'+(started?'RODADA NO HORÁRIO PROGRAMADO':'PRÓXIMO CONFRONTO')+'</span><h3>'+esc(pair?'GRUPO '+pair[0]+' × GRUPO '+pair[1]:next.stage==='segundaFase'?'KNOCKOUT · FASE 2':next.stage==='lastChance'?'REPESCAGEM · LAST CHANCE':'GRANDE FINAL')+'</h3><p>'+esc(next.label)+' · '+esc(displayDate(next))+' (Brasília)</p></div><span class="home-global-round-tag">'+esc(next.matches?next.matches+' QUEDAS':next.stage==='final'?'CHAMPION RUSH':'12 EQUIPES')+'</span></div>'+headline+
      '<div class="home-global-next-list"><div class="home-global-next-list-title"><h3>PRÓXIMAS RODADAS</h3><small>HORÁRIO DE BRASÍLIA</small></div>'+(after.map(round=>renderRoundRow(round)).join('')||'<p class="home-global-no-more">Nenhuma outra rodada prevista no calendário.</p>')+'</div><a class="home-global-calendar-link" href="/ffws-global-2026/datas">VER CALENDÁRIO COMPLETO <span aria-hidden="true">→</span></a>';
  }

  function tick(){
    if(document.hidden)return;
    if(loaded&&rounds.length&&Number.isFinite(target)&&Date.now()>=target){
      renderUpcoming();
    }
    if(!Number.isFinite(target))return;
    const total=Math.max(0,Math.ceil((target-Date.now())/1000));
    const values=[Math.floor(total/86400),Math.floor(total%86400/3600),Math.floor(total%3600/60),total%60];
    numbers.forEach((node,i)=>{if(node){const value=String(values[i]).padStart(2,'0');if(node.textContent!==value)node.textContent=value;}});
    if(!total&&!loaded){
      countdown.classList.add('has-started');
      if(label)label.textContent='CHEGOU A ESTREIA';
      clearInterval(timer);timer=null;
    }
  }
  function resume(){
    clearInterval(timer);timer=null;
    tick();
    if(!document.hidden&&Number.isFinite(target)&&Date.now()<target){
      timer=setInterval(()=>{if(board.closest('.page')?.classList.contains('active'))tick();},1000);
    }
  }
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('hashchange',tick);
  window.addEventListener('cff:pretty-route',tick);
  resume();

  async function loadSchedule(){
    if(typeof fetch!=='function')return;
    try{
      const paths=['/ffws-global-2026/dates.json?v=20261018-groups-v1','/ffws-global-2026/teams.json?v=20261018-groups-v1','/ffws-global-2026/groups.json?v=20261018-groups-v1'];
      const [calendar,teamData,groupData]=await Promise.all(paths.map(async path=>{
        const response=await fetch(path,{cache:'no-cache'});
        if(!response.ok)throw Error('Falha ao consultar o calendário do Mundial');
        return response.json();
      }));
      const groupList=groupData.groups;
      const teamList=new Map((teamData.teams||[]).map(team=>[team.id,team]));
      const knownIds=['A','B','C','D'].flatMap(key=>groupList?.[key]||[]);
      if(knownIds.length!==24||new Set(knownIds).size!==24||knownIds.some(id=>!teamList.has(id))||
         ['A','B','C','D'].some(key=>!Array.isArray(groupList[key])||groupList[key].length!==6)){
        throw Error('Os grupos precisam conter 24 equipes distintas');
      }
      const upcoming=(calendar.rounds||[]).filter(round=>round.date&&round.time24&&['classificatoria','segundaFase','lastChance','final'].includes(round.stage)).sort((a,b)=>startOf(a)-startOf(b));
      if(!upcoming.length||upcoming.some(round=>!Number.isFinite(startOf(round))||(round.groups&&!round.groups.every(group=>groupList[group]))))throw Error('Calendário inválido');
      groups=groupList;teams=teamList;rounds=upcoming;loaded=true;
      renderUpcoming();resume();
    }catch(error){
      output.innerHTML='<p class="home-global-error">Não foi possível carregar os próximos confrontos agora. O calendário completo continua disponível.</p><a class="home-global-calendar-link" href="/ffws-global-2026/datas">CONSULTAR DATAS DO MUNDIAL →</a>';
    }
  }
  loadSchedule();
})();
