/* Seleções FFWS Global 2026 — mantém o visual da FFWS BR S2.
 * Dia/semana e etapas usam a mesma escalação: 2 rush, granadeiro,
 * suporte (snipers incluídos) e técnico do melhor time por PONTOS oficiais.
 */
(function(){
'use strict';
if(window.CFFGlobalSelections)return;
const BASE='/ffws-global-2026/';
const COACHES={lyon:'Benja',btr:'Chrisjo',gow:'4Sure','p-esports':'HoangAnh','ag-al':'PEPONLY','team-flash':'Shin',
 rrq:'Adi',onic:'Afm',bru:'D_LONG',loud:'JOKER',los:'LIPÃO',fx:'LUUUKING',
 gundynasty:'Sullivan','stellar-esport':'BRN','total-winner-esports':'CHACHA','horaa-esports':'RENICE',
 xprojekt:'MR ALI',tag:'Frois'};
const COACH_PHOTOS={lyon:'lyon-benja.webp',btr:'btr-chrisjo.webp',gow:'gow-4sure.webp','p-esports':'p-esports-hoanganh.webp','ag-al':'ag-al-peponly.webp','team-flash':'team-flash-shin.webp',rrq:'rrq-ady.webp',onic:'onic-afm.webp',bru:'bru-dlong.webp',loud:'loud-joker.webp',los:'los-lipao.webp',fx:'fx-luuking.webp',gundynasty:'gundynasty-sullivan.webp','stellar-esport':'stellar-esport-brn.webp',xprojekt:'xprojekt-mrali.webp',tag:'tag-frois.webp'};
const TABS=[
 {key:'semanal',title:'TIMES DA SEMANA',short:'SEMANA',color:'#ff0000',panel:'week',name:'Times da semana'},
 {key:'classificatoria',title:'PRIMEIRA FASE',short:'FASE 1',color:'#00c8ff',panel:'classificatoria',name:'Seleção da Primeira Fase'},
 {key:'segundaFase',title:'SEGUNDA FASE',short:'FASE 2',color:'#21c778',panel:'segunda-fase',name:'Seleção da Segunda Fase'},
 {key:'lastChance',title:'REPESCAGEM',short:'REP.',color:'#69d7be',panel:'last-chance',name:'Seleção da Repescagem'},
 {key:'final',title:'FINAL',short:'FINAL',color:'#ffd166',panel:'final',name:'Seleção da Final'},
 {key:'torneio',title:'TORNEIO',short:'TORNEIO',color:'#a855f7',panel:'torneio',name:'Seleção do Torneio'}
];
const MATCH_DAYS=[
 ['classificatoria','2026-11-06',1],['classificatoria','2026-11-07',2],['classificatoria','2026-11-08',3],
 ['classificatoria','2026-11-13',4],['classificatoria','2026-11-14',5],['classificatoria','2026-11-15',6],
 ['segundaFase','2026-11-19',1],['segundaFase','2026-11-20',2],['segundaFase','2026-11-21',3],['segundaFase','2026-11-22',4],
 ['lastChance','2026-11-27',1],['final','2026-11-28',1]
].map(([stage,date,day])=>({stage,date,day,key:stage+'|'+date}));
const WEEKS=[
 {key:'classificatoria|1',stage:'classificatoria',title:'SEMANA 1',days:MATCH_DAYS.slice(0,3)},
 {key:'classificatoria|2',stage:'classificatoria',title:'SEMANA 2',days:MATCH_DAYS.slice(3,6)},
 {key:'segundaFase|1',stage:'segundaFase',title:'FASE 2',days:MATCH_DAYS.slice(6,10)}
];
const STAGE_NAMES={classificatoria:'Primeira Fase',segundaFase:'Segunda Fase',lastChance:'Repescagem',final:'Final'};
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const number=v=>Number(v)||0,fmt=v=>Math.round(number(v)).toLocaleString('pt-BR');
const shortDate=date=>String(date||'').slice(8,10)+'/'+String(date||'').slice(5,7);
const url=v=>/^https:\/\//i.test(String(v||''))?String(v):'/'+String(v||'').replace(/^\/+/,'');
const state={page:{tab:'semanal',mode:'day',day:'',week:''},home:{mode:'day',day:'',week:''},start:{mode:'day',day:'',week:''}};
let DATA=null,playersPromise=null,officialRecords=null,staticDays=[],officialPromise=null,officialAt=0;
let phaseCompletion={},publishedDays=[],homeSummary=null,homeSummaryAt=0,homeSummaryPromise=null;
const SUMMARY_URL=BASE+'selecoes-resumo.json?v=20261108-mundial-dia3-v1';
function setData(players,teams){
 if(!Array.isArray(players?.entries)||!Array.isArray(players?.players))return false;
 const list=Array.isArray(teams?.teams)?teams.teams:Array.isArray(teams)?teams:[];
 if(!list.length)return false;
 DATA={players:players.players,entries:players.entries,teams:list};
 return true;
}
async function loadPlayers(){
 if(DATA)return DATA;
 if(playersPromise)return playersPromise;
 playersPromise=fetch(SUMMARY_URL,{cache:'default'}).then(r=>{if(!r.ok)throw Error('Falha no resumo de jogadores');return r.json()})
  .then(data=>{
   if(data.version!==1||!Array.isArray(data.days))throw Error('Resumo de jogadores inválido');
   const entries=data.days.flatMap(({stage,date,players})=>players.map(([playerId,kills,damage,assists,matches])=>({stage,date,playerId,kills,damage,assists,matches})));
   if(!setData({players:data.players,entries},data.teams))throw Error('Resumo de jogadores inválido');
   staticDays=Array.isArray(data.teamDays)?data.teamDays:[];
   if(data.fallback?.teams?.length&&!staticDays.some(d=>d.date===data.fallback.date)){
    const d=data.fallback;
    staticDays=[...staticDays,{date:d.date,stage:d.stage,teams:d.teams.map(r=>[r.id,r.points,r.kills,r.booyahs,r.matches,r.lastPlace])}];
   }
   staticDays.sort((a,b)=>a.date.localeCompare(b.date));
   phaseCompletion=data.finished||{};
   return DATA;
  }).finally(()=>{playersPromise=null});
 return playersPromise;
}
function database(){
 return String(window.CFF_CONFIG?.firebase?.databaseURL||'').replace(/\/$/,'');
}
function acceptPublishedSummary(summary){
 if(Array.isArray(summary?.dailyTeams))publishedDays=summary.dailyTeams;
}
function getPublishedSummary(){
 if(homeSummaryPromise)return homeSummaryPromise;
 if(homeSummaryAt&&Date.now()-homeSummaryAt<90000)return Promise.resolve(homeSummary);
 const base=database();
 if(!base)return Promise.resolve(null);
 homeSummaryPromise=fetch(base+'/ffwsLive/global-2026/home.json',{cache:'no-cache',signal:window.AbortSignal?.timeout?.(8000)})
  .then(r=>{if(!r.ok)throw Error('Resumo indisponível');return r.json()}).then(summary=>{
   homeSummary=summary;homeSummaryAt=Date.now();
   acceptPublishedSummary(summary);
   return summary;
  }).finally(()=>{homeSummaryPromise=null});
 return homeSummaryPromise;
}
function roundStage(key){if(key.startsWith('classificatoria-'))return 'classificatoria';if(key.startsWith('segundaFase-'))return 'segundaFase';if(key.startsWith('lastChance-'))return 'lastChance';if(key.startsWith('final-'))return 'final';return ''}
function roundDate(key,rec){
 const stage=roundStage(key),no=Number(key.split('-').at(-1));
 const item=MATCH_DAYS.filter(d=>d.stage===stage)[stage==='classificatoria'?Math.ceil(no/2)-1:no-1];
 return item?.date||String(rec?.date||'');
}
async function loadOfficial(force=false){
 if(!force&&officialAt&&Date.now()-officialAt<90000)return officialRecords;
 if(officialPromise)return officialPromise;
 const base=database();
 if(!base)return null;
 officialPromise=fetch(base+'/ffwsLive/global-2026/rounds.json',{cache:'no-cache',signal:window.AbortSignal?.timeout?.(8000)})
  .then(r=>r.ok?r.json():null).then(records=>{if(records&&typeof records==='object')officialRecords=records;return officialRecords})
  .catch(()=>officialRecords).finally(()=>{officialAt=Date.now();officialPromise=null});
 return officialPromise;
}
function collectStandings(filter,compact=false){
 if(!DATA)return [];
 const teams=new Map(DATA.teams.map(t=>[t.id,t])),totals=new Map();
 const usableDrop=(ids,drop)=>ids.length===12&&drop&&ids.every(id=>
   drop.points?.[id]!=null&&drop.kills?.[id]!=null&&drop.placements?.[id]!=null&&
   Number.isFinite(Number(drop.points[id]))&&Number.isFinite(Number(drop.kills[id]))&&
   Number.isInteger(Number(drop.placements[id]))&&Number(drop.placements[id])>=1&&Number(drop.placements[id])<=12);
 const records=compact?[]:Object.entries(officialRecords||{});
 const confirmed=new Set(staticDays.map(day=>day.stage+'|'+day.date));
 const add=(id,points,kills,booyahs,matches,lastPlace)=>{
   const team=teams.get(id);if(!team||!matches)return;
   let row=totals.get(id);
   if(!row){row={id,name:team.name,logo:team.logo,team:team.name,points:0,kills:0,booyahs:0,matches:0,lastPlace:99};totals.set(id,row)}
   row.points+=Number(points)||0;row.kills+=Number(kills)||0;row.booyahs+=Number(booyahs)||0;
   row.matches+=Number(matches)||0;row.lastPlace=Number(lastPlace)||99;
 };
 for(const day of staticDays){
   if(filter&&!filter(day.stage,day.date))continue;
   for(const row of day.teams)add(...row);
 }
 if(compact){
   for(const day of publishedDays){
    if(confirmed.has(day.stage+'|'+day.date)||(filter&&!filter(day.stage,day.date)))continue;
    for(const row of day.teams||[])add(...row);
   }
 }
 for(const [key,rec] of records){
  const stage=roundStage(key),date=roundDate(key,rec);
  if(!stage||!Array.isArray(rec?.participants)||!Array.isArray(rec?.drops))continue;
  if(confirmed.has(stage+'|'+date))continue;
  if(filter&&!filter(stage,date))continue;
  const ids=rec.participants.filter(id=>teams.has(id));
  for(const drop of rec.drops){
   if(!usableDrop(ids,drop))continue;
   for(const id of ids){
    const p=Number(drop.points[id]),k=Number(drop.kills[id]),place=Number(drop.placements[id]);
    if(p<k)continue;
    add(id,p,k,Number(place===1),1,place);
   }
  }
 }
 return [...totals.values()].sort((a,b)=>b.points-a.points||b.booyahs-a.booyahs||b.kills-a.kills||a.lastPlace-b.lastPlace||a.name.localeCompare(b.name,'pt-BR'));
}
function availableDates(){return new Set((DATA?.entries||[]).map(e=>String(e.stage||'classificatoria')+'|'+String(e.date||'')))}
function bucketEntries(selection){
 if(!DATA||!selection)return [];
 if(selection.type==='all')return DATA.entries;
 if(selection.type==='stage')return DATA.entries.filter(e=>String(e.stage||'classificatoria')===selection.stage);
 if(selection.type==='date')return DATA.entries.filter(e=>String(e.stage||'classificatoria')===selection.stage&&e.date===selection.date);
 if(selection.type==='week')return DATA.entries.filter(e=>selection.days.some(day=>String(e.stage||'classificatoria')===day.stage&&e.date===day.date));
 return [];
}
function standingsForSelection(s,compact){
 if(!s)return [];
 if(s.type==='all')return collectStandings(null,compact);
 if(s.type==='stage')return collectStandings(stage=>stage===s.stage,compact);
 if(s.type==='date')return collectStandings((stage,date)=>stage===s.stage&&date===s.date,compact);
 if(s.type==='week')return collectStandings((stage,date)=>s.days.some(d=>d.stage===stage&&d.date===date),compact);
 return [];
}
function roleType(role){
 const r=norm(role);
 if(['rusher','rush','rifler','suporte','support','3','3homem'].includes(r))return 'rush';
 if(r.includes('granadeiro')||r.includes('bomber')||r==='gran')return 'gran';
 if(r.includes('sniper')||r==='sup')return 'support';
 return '';
}
function playerRankings(entries){
 if(!DATA)return [];
 const metaById=new Map(DATA.players.map(p=>[p.id,p]));
 const byKey=new Map();
 for(const e of entries){
  const meta=metaById.get(e.playerId);
  if(!meta||!roleType(meta.role))continue;
  const id=meta.id;
  if(!byKey.has(id)){const team=DATA.teams.find(t=>norm(t.name)===norm(meta.team));byKey.set(id,{
   id,name:meta.name,role:meta.role,roleType:roleType(meta.role),
   team:meta.team,teamId:team?.id||'',teamLogo:team?.logo||'',photo:meta.photoLarge||meta.photo,photoSmall:meta.photo,
   kills:0,damage:0,assists:0,matches:0
  })}
  const r=byKey.get(id);r.kills+=number(e.kills);r.damage+=number(e.damage);r.assists+=number(e.assists);r.matches+=number(e.matches)||1;
 }
 return [...byKey.values()];
}
function rankScore(p,slot){
 const n=Math.max(1,p.matches);
 return slot==='rush'?(p.kills*8+p.damage/260+p.assists*1.2)/n:
 slot==='gran'?(p.kills*7+p.damage/260+p.assists*1.6)/n:
 (p.assists*4.2+p.damage/210+p.kills*4)/n;
}
function selectLineup(selection,compact=false){
 const entries=bucketEntries(selection),ranked=playerRankings(entries),used=new Set(),lineup=[];
 const slots=[['RUSH','rush'],['RUSH','rush'],['GRAN','gran'],['SUP','support']];
 for(const [label,type] of slots){
  const pool=ranked.filter(p=>p.roleType===type&&!used.has(p.id)).sort((a,b)=>rankScore(b,type)-rankScore(a,type)||b.kills-a.kills||b.damage-a.damage);
  const p=pool[0];
  if(p){used.add(p.id);lineup.push({...p,slot:label})}else lineup.push({slot:label,missing:true});
 }
 const best=standingsForSelection(selection,compact)[0];
 if(best){
  const name=COACHES[best.id]||'Técnico não cadastrado';
  lineup.push({...best,slot:'COACH',name,coach:true,missingCoach:!COACHES[best.id],
    photo:COACH_PHOTOS[best.id]?BASE+'photos/480/staff/'+COACH_PHOTOS[best.id]:'',
    photoSmall:COACH_PHOTOS[best.id]?BASE+'photos/160/staff/'+COACH_PHOTOS[best.id]:'',
    teamLogo:best.logo,teamId:best.id});
 }else lineup.push({slot:'COACH',missing:true,coach:true,reason:'Aguardando pontuação oficial da equipe'});
 return lineup;
}
function selectionCard(row,config,mini=false){
 const color=config.color,glow=color==='#ff0000'?'rgba(255,0,0,.50)':'color-mix(in srgb,'+color+' 45%,transparent)';
 if(row.missing)return '<div class="ffws-global-s1-selection-card cff-global-selection-empty"><div class="cff-global-card-shape" style="--selection-accent:'+color+'"><b>'+html(row.slot)+'</b><p>'+html(row.reason||'Aguardando dados desta função')+'</p></div></div>';
 const coach=!!row.coach;
 const photo=row.photo?url(row.photo):'/silhueta.webp',logo=url(row.teamLogo||'/escudo.webp');
 const urlPlayer=coach?BASE+'equipe?time='+encodeURIComponent(row.teamId):BASE+'jogador?id='+encodeURIComponent(row.id);
 const stat=coach?[['PONTOS',fmt(row.points)],['ABATES',fmt(row.kills)],['BOOYAHS',fmt(row.booyahs)]]:
 [['KILLS',fmt(row.kills)],['DANO',(number(row.damage)/1000).toFixed(1)+'K'],['QUEDAS',fmt(row.matches)]];
 const headline=coach?(row.missingCoach?'COACH INDISPONÍVEL':'MELHOR TIME DO PERÍODO'):norm(row.role)==='sniper'?'SNIPER / SUPORTE':'';
 return '<a class="ffws-global-s1-selection-card cff-global-player-card'+(coach?' is-coach':'')+'" href="'+html(urlPlayer)+'" aria-label="'+html(row.slot+': '+row.name)+'">'+
 '<div class="cff-global-card-shape" style="--selection-accent:'+color+';--selection-glow:'+glow+'">'+
 '<div class="cff-global-card-bg"></div><div class="cff-global-card-tag">'+html(config.short)+'</div>'+
 '<div class="cff-global-card-role">'+html(row.slot)+'<i></i><img src="'+html(logo)+'" alt="'+html(row.team||row.name)+'" onerror="this.onerror=null;this.src=\'/escudo.webp\'" loading="lazy"></div>'+
 '<img class="cff-global-card-photo" src="'+html(photo)+'" alt="'+html(row.name)+'" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'/silhueta.webp\'">'+
 '<div class="cff-global-card-bottom"><strong>'+html(row.name)+'</strong>'+
 (headline?'<small>'+html(headline)+'</small>':'')+
 '<div class="cff-global-card-stats">'+stat.map((x,i)=>'<span><small>'+html(x[0])+'</small><b'+(!i?' class="emphasized"':'')+'>'+html(x[1])+'</b></span>').join('')+'</div>'+
 '</div></div></a>';
}
function getPageSelection(){
 const ui=state.page;
 if(ui.tab!=='semanal')return ui.tab==='torneio'?{type:'all'}:{type:'stage',stage:ui.tab};
 const dayList=MATCH_DAYS.filter(d=>d.stage==='classificatoria'||d.stage==='segundaFase');
 if(ui.mode==='week'){
  const w=WEEKS.find(w=>w.key===ui.week)||WEEKS.find(w=>bucketEntries({type:'week',days:w.days}).length)||WEEKS[0];
  ui.week=w.key;return {type:'week',days:w.days};
 }
 const available=dayList.filter(d=>bucketEntries({type:'date',stage:d.stage,date:d.date}).length);
 const day=dayList.find(d=>d.key===ui.day)||available.at(-1)||dayList[0];
 ui.day=day.key;return {type:'date',stage:day.stage,date:day.date};
}
function phaseProgress(stage){
 const scheduled=MATCH_DAYS.filter(day=>day.stage===stage);
 const published=scheduled.filter(day=>bucketEntries({type:'date',stage,date:day.date}).length>0);
 const completed=phaseCompletion?.[stage]?.finished===true||
  (stage==='classificatoria'&&availableDates().size>0&&MATCH_DAYS.filter(day=>day.stage==='segundaFase').some(day=>availableDates().has(day.key)))||
  (stage==='segundaFase'&&MATCH_DAYS.some(day=>(day.stage==='lastChance'||day.stage==='final')&&availableDates().has(day.key)))||
  (stage==='lastChance'&&MATCH_DAYS.some(day=>day.stage==='final'&&availableDates().has(day.key)));
 return {count:published.length,total:scheduled.length,completed,
  first:published[0]?.date||'',last:published.at(-1)?.date||''};
}
function pageFilter(){
 const ui=state.page,available=availableDates();
 if(ui.mode==='week'){
  return '<div class="season-selection-filters cff-global-period-list">'+WEEKS.map(w=>{
   const active=ui.week===w.key,hasData=w.days.some(d=>available.has(d.key));
   return '<button type="button" class="btn-day season-selection-week-btn'+(active?' active':'')+'" data-global-week="'+w.key+'"'+(hasData?'':' disabled')+'>'+html(w.title)+' <small>'+html(STAGE_NAMES[w.stage])+'</small></button>';
  }).join('')+'</div>';
 }
 const days=MATCH_DAYS.filter(d=>['classificatoria','segundaFase'].includes(d.stage));
 return '<div class="season-selection-filters cff-global-period-list">'+days.map(d=>
  '<button type="button" class="btn-day season-selection-week-btn'+(ui.day===d.key?' active':'')+'" data-global-day="'+d.key+'"'+(available.has(d.key)?'':' disabled')+'>'+
  'DIA '+d.day+' · '+shortDate(d.date)+'<small>'+html(STAGE_NAMES[d.stage])+'</small></button>'
 ).join('')+'</div>';
}

function renderPage(root,players,teams,stages){
 if(!root)return false;
 if(stages&&typeof stages==='object')phaseCompletion=stages;
 if(players&&!setData(players,teams))return false;
 if(!DATA)return false;
 const ui=state.page,tab=TABS.find(t=>t.key===ui.tab)||TABS[0],selection=getPageSelection();
 const entries=bucketEntries(selection),hasEntries=entries.length>0;
 const progress=ui.tab!=='semanal'&&ui.tab!=='torneio'?phaseProgress(ui.tab):null;
 const available=new Set(DATA.entries.map(e=>String(e.stage||'classificatoria')));
 const tabs='<div class="season-selection-tabs">'+TABS.map(t=>{
  const active=ui.tab===t.key,enabled=t.key==='semanal'||t.key==='torneio'&&available.has('final')||available.has(t.key);
  return '<button class="season-selection-tab'+(active?' active':'')+(enabled?'':' locked')+'" style="--selection-color:'+t.color+'" type="button" data-global-tab="'+t.key+'"'+(enabled?'':' disabled aria-disabled="true"')+'>'+
   html(t.title)+(enabled?'':'<small>EM BREVE</small>')+'</button>';
 }).join('')+'</div>';
 const controls=ui.tab==='semanal'?
  '<div class="season-selection-week-stage-filter cff-global-mode"><span>MODO:</span>'+
  '<button type="button" data-global-mode="day" class="'+(ui.mode==='day'?'active':'')+'">DIÁRIO</button>'+
  '<button type="button" data-global-mode="week" class="'+(ui.mode==='week'?'active':'')+'">SEMANAL</button></div>'+pageFilter():'';
 const subtitle=ui.tab==='semanal'?
   (ui.mode==='day'?shortDate(selection.date)+' · '+STAGE_NAMES[selection.stage]:
      WEEKS.find(w=>w.key===ui.week)?.days.map(d=>shortDate(d.date)).join(' a ')):
   progress&&progress.count?
    'Acumulado: '+progress.count+' de '+progress.total+' dias · '+shortDate(progress.first)+(progress.first!==progress.last?' a '+shortDate(progress.last):''):
    tab.name;
 const status=progress&&progress.count?
   '<span class="cff-global-phase-status '+(progress.completed?'is-complete':'is-running')+'" role="status">'+
   (progress.completed?'ENCERRADA':'EM ANDAMENTO')+'</span>':'';
 const cards=hasEntries?selectLineup(selection).map(p=>selectionCard(p,tab)).join(''):
  '<div class="season-selection-empty" style="--selection-color:'+tab.color+'"><p>Esta seleção ainda não tem resultados individuais publicados.</p></div>';
 root.innerHTML='<div class="ffws-global-selection-page cff-global-selections-page">'+
 '<div class="season-selection-hero"><div class="season-selection-kicker">FFWS GLOBAL FINALS 2026</div><h1>SELEÇÕES DA SEASON</h1></div>'+
 tabs+'<section class="season-selection-panel season-selection-panel-'+tab.panel+'">'+
 '<div class="season-selection-section-head"><div><span class="season-selection-tag">'+html(tab.title)+'</span><h2>'+html(ui.tab==='semanal'?'TIMES DA SEMANA':tab.name.toUpperCase())+'</h2>'+
 '<p class="cff-global-period-caption">'+html(subtitle||'')+'</p></div>'+status+'</div>'+controls+
 '<div class="selection-grid season-selection-grid cff-global-selection-grid">'+cards+'</div>'+
 '<p class="cff-global-selection-note">2 Rush · 1 Granadeiro · 1 Suporte/Sniper · 1 Coach. A escolha do técnico considera o time com mais pontos oficiais no período; desempate por Booyahs e abates. Se os pontos ainda não estiverem publicados, o coach fica pendente.</p>'+
 '</section></div>';
 if(!root.dataset.cffGlobalSelectionBound){
  root.dataset.cffGlobalSelectionBound='1';
  root.addEventListener('click',event=>{
   const button=event.target.closest('[data-global-tab],[data-global-mode],[data-global-day],[data-global-week]');
   if(!button||button.disabled)return;
   const b=button.dataset;if(b.globalTab)ui.tab=b.globalTab;
   if(b.globalMode)ui.mode=b.globalMode;
   if(b.globalDay)ui.day=b.globalDay;
   if(b.globalWeek)ui.week=b.globalWeek;
   renderPage(root);
  });
 }
 return true;
}
async function bootPage(root){
 if(!root)return;
 try{
  await loadPlayers();
  renderPage(root);
  await loadOfficial();
  if(root.isConnected)renderPage(root);
 }catch(_){root.textContent='Não foi possível carregar as seleções. Recarregue para tentar novamente.'}
}
function miniCard(p,color){
 if(p.missing)return '<div class="cff-gsel-home-row"><b>'+html(p.slot)+'</b><span>'+html(p.reason||'Aguardando resultados')+'</span></div>';
 const link=p.coach?BASE+'equipe?time='+encodeURIComponent(p.teamId):BASE+'jogador?id='+encodeURIComponent(p.id);
 const detail=p.coach?'PONTOS '+fmt(p.points)+' · K '+fmt(p.kills)+' · B! '+fmt(p.booyahs):
  'K '+fmt(p.kills)+' · DANO '+(p.damage/1000).toFixed(1)+'K · Q '+fmt(p.matches);
 return '<a class="cff-gsel-home-row" href="'+html(link)+'" style="--selection-accent:'+color+'"><img src="'+html(url(p.photoSmall||p.photo||'/silhueta.webp'))+'" alt="" onerror="this.onerror=null;this.src=\'/silhueta.webp\'" loading="lazy">'+
 '<span><em>'+html(p.slot)+'</em><b>'+html(p.name)+'</b><small>'+html(p.team||'')+'</small></span><strong>'+html(detail)+'</strong></a>';
}
function miniSelection(context){
 const ui=state[context],days=MATCH_DAYS.filter(d=>['classificatoria','segundaFase'].includes(d.stage)),found=availableDates();
 const choices=ui.mode==='week'?WEEKS:days,attribute=ui.mode==='week'?'week':'day';
 const candidates=choices.filter(c=>ui.mode==='week'?c.days.some(d=>found.has(d.key)):found.has(c.key));
 if(!candidates.some(c=>c.key===ui[attribute]))ui[attribute]=candidates.at(-1)?.key||choices[0]?.key||'';
 const selected=choices.find(c=>c.key===ui[attribute]);
 const filter=selected?(ui.mode==='week'?{type:'week',days:selected.days}:{type:'date',stage:selected.stage,date:selected.date}):null;
 const rows=filter?selectLineup(filter,true):[];
 return {ui,choices,found,selected,rows};
}
function renderSmall(host,context){
 if(!host||!DATA)return;
 const d=miniSelection(context);
 const options=d.choices.map(choice=>{
  const has=d.ui.mode==='week'?choice.days.some(day=>d.found.has(day.key)):d.found.has(choice.key);
  const label=d.ui.mode==='week'?choice.title+' · '+STAGE_NAMES[choice.stage]:shortDate(choice.date)+' · '+STAGE_NAMES[choice.stage]+' · Dia '+choice.day;
  return '<option value="'+choice.key+'"'+(d.selected?.key===choice.key?' selected':'')+(has?'':' disabled')+'>'+html(label)+'</option>';
 }).join('');
 host.innerHTML='<div class="cff-gsel-compact-head"><div><b>SELEÇÃO DO '+(d.ui.mode==='week'?'SEMANA':'DIA')+'</b><small>FFWS GLOBAL FINALS 2026</small></div>'+
 '<a href="/ffws-global-2026/selecoes">Ver todas ↗</a></div>'+
 '<div class="cff-gsel-compact-filters"><div class="cff-gsel-compact-toggle"><button data-cff-mode="day" aria-pressed="'+(d.ui.mode==='day')+'">DIÁRIO</button><button data-cff-mode="week" aria-pressed="'+(d.ui.mode==='week')+'">SEMANAL</button></div>'+
 '<select data-cff-period aria-label="Selecionar dia ou semana">'+options+'</select></div>'+
 '<div class="cff-gsel-compact-list">'+(d.rows.length?d.rows.map(p=>miniCard(p,'#ff0000')).join(''):
 '<p>Aguardando o primeiro dia.</p>')+'</div><a class="cff-gsel-compact-link" href="/ffws-global-2026/selecoes">Ver seleção completa →</a>';
 if(!host.dataset.cffCompactBound){
  host.dataset.cffCompactBound='1';
  host.addEventListener('click',e=>{const b=e.target.closest('[data-cff-mode]');if(!b)return;d.ui.mode=b.dataset.cffMode;renderSmall(host,context)});
  host.addEventListener('change',e=>{if(!e.target.matches('[data-cff-period]'))return;d.ui[d.ui.mode==='week'?'week':'day']=e.target.value;renderSmall(host,context)});
 }

}
async function renderHome(){
 const host=document.getElementById('global-selection-home-widget');if(!host)return;
 try{await loadPlayers();renderSmall(host,'home')}catch(_){host.textContent='Seleção indisponível no momento.'}
}
async function renderStart(){
 const host=document.getElementById('global-start-selection');if(!host)return;
 try{await loadPlayers();renderSmall(host,'start');if(DATA.entries.some(e=>e.date>(staticDays.at(-1)?.date||''))){await getPublishedSummary().catch(()=>null);renderSmall(host,'start')}}catch(_){host.textContent='Seleção indisponível no momento.'}
}
async function getStandings(){
 await loadPlayers();
 const live=publishedDays.at(-1),archived=staticDays.at(-1),latest=live?.date>archived?.date||!archived?live:archived;
 const stage=latest?.stage||'classificatoria',date=latest?.date||'';
 const standings=collectStandings((s,d)=>s===stage&&(stage==='classificatoria'||d===date),true);
 return {teams:standings,stage,date,partial:latest===live&&!!homeSummary?.partial};
}
async function getHomeRankings(){
 await loadPlayers();const all=playerRankings(DATA.entries);const rank=metric=>[...all].sort((a,b)=>b[metric]-a[metric]||b.kills-a.kills).slice(0,6).map(p=>({
  ...p,photo:url(DATA.players.find(x=>x.id===p.id)?.photo||p.photo),coverage:{kills:p.matches,damage:p.matches,assists:p.matches}
 }));
 return {kills:rank('kills'),damage:rank('damage'),assists:rank('assists')};
}
window.CFFGlobalSelections={bootPage,renderPage,renderHome,renderStart,getStandings,getHomeRankings,getPublishedSummary,acceptPublishedSummary,selectLineup,loadOfficial,setData,coachNames:COACHES};
})();
