(function(){
'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=v=>Number(v||0).toLocaleString('pt-BR');
const CACHE='cff_home_global_summary_v3_day3',TTL=300000;let booted=false,payload=null,loading=null,lastFetch=0,selectedDay='',dayChosen=false;
function empty(text){return `<tr><td colspan="5" class="home-weekly-empty">${esc(text)}</td></tr>`}
function playerLink(p){return '/ffws-global-2026/jogador/?id='+encodeURIComponent(p.id)}
function playerRows(rows,metric){return rows.length?rows.slice(0,6).map((r,i)=>`<tr><td class="home-rank-pos">${i+1}</td><td class="home-rank-media"><a href="${playerLink(r)}"><img class="home-rank-avatar" src="${esc(r.photo||'/silhueta.webp')}" onerror="this.onerror=null;this.src='/silhueta.webp'" alt="" loading="lazy" width="32" height="32"></a></td><td class="home-rank-main"><a class="home-rank-identity" href="${playerLink(r)}"><span><b>${esc(r.name)}</b><small>${esc(r.team)}${r.coverage?.[metric]<r.matches?' · parcial':''}</small></span></a></td><td class="home-rank-number">${fmt(r[metric])}</td><td class="home-rank-number home-rank-matches">${fmt(r.coverage?.[metric]??r.matches)}</td></tr>`).join(''):empty('Aguardando dados individuais do Mundial.')}
function renderDay(){const host=$('home-weekly-selection-list'),meta=$('home-weekly-selection-meta'),days=payload?.days||[],day=days.find(d=>d.date===selectedDay)||days.at(-1);if(!host)return;if(meta)meta.textContent=day?day.date.split('-').reverse().slice(0,2).join('/')+' · GLOBAL 2026':'GLOBAL 2026 · EM BREVE';
 if(!day?.players?.length){host.innerHTML='<div class="home-weekly-empty">A seleção do dia aparece após a publicação dos dados individuais.</div>';return}
 host.innerHTML=day.players.map(p=>`<a class="home-weekly-player" href="${playerLink(p)}"><img class="home-rank-avatar" src="${esc(p.photo||'/silhueta.webp')}" onerror="this.onerror=null;this.src='/silhueta.webp'" alt="" width="32" height="32" loading="lazy"><span class="home-weekly-player-name"><b>${esc(p.name)}</b><small>${esc(p.team)} · ${esc(p.role)}</small></span><span class="home-weekly-stat"><small>K</small><b>${fmt(p.kills)}</b></span><span class="home-weekly-stat home-weekly-dmg"><small>DMG</small><b>${p.damage==null?'—':fmt(p.damage)}</b></span></a>`).join('')+(day.missingRoles?'<p class="home-weekly-empty">Seleção parcial: aguardando dados das outras funções.</p>':'');
}
function render(){
 const p=payload||{teams:[],rankings:{},days:[]},stage={classificatoria:'FASE 1 · GERAL',segundaFase:'FASE 2 · DIA',lastChance:'REPESCAGEM',final:'GRANDE FINAL'}[p.stage]||'GLOBAL FINALS 2026';
 const teamWidget=$('home-ranking-teams'),title=teamWidget?.querySelector('h3');if(title)title.textContent='🏆 Top 6 · Global Finals';
 if(teamWidget)teamWidget.dataset.homeRankingStage=({classificatoria:'Fase 1 · Geral',segundaFase:'Fase 2',lastChance:'Repescagem',final:'Grande Final'})[p.stage]||'';
 document.querySelectorAll('[data-home-rankings-title]').forEach(el=>el.textContent='GLOBAL FINALS 2026 · DESTAQUES');
 const teams=$('home-tbody-teams');if(teams)teams.innerHTML=p.teams?.length?p.teams.slice(0,6).map((r,i)=>`<tr><td class="home-rank-pos">${i+1}</td><td class="home-rank-media"><a href="/ffws-global-2026/equipe?time=${encodeURIComponent(r.id)}"><img class="home-rank-team-logo" src="/${esc(String(r.logo||'escudo.webp').replace(/^\//,''))}" alt="" width="30" height="30" loading="lazy"></a></td><td class="home-rank-main"><a class="home-rank-identity" href="/ffws-global-2026/equipe?time=${encodeURIComponent(r.id)}"><span><b>${esc(r.name)}</b><small>${stage}${p.stage==='segundaFase'?' '+esc(p.date?.slice(8)):''}${p.partial?' · parcial':''}</small></span></a></td><td class="home-rank-number home-rank-points">${fmt(r.points)}</td><td class="home-rank-number">${fmt(r.kills)}</td></tr>`).join(''):empty('Mundial começa em 06/11. Aguardando resultados.');
 for(const [id,key]of [['home-tbody-players','kills'],['home-tbody-damage','damage'],['home-tbody-assists','assists']])if($(id))$(id).innerHTML=playerRows(p.rankings?.[key]||[],key);
 const selector=$('home-global-selection-day');if(selector){selector.innerHTML=(p.days||[]).length?[...p.days].reverse().map(d=>`<option value="${esc(d.date)}">${d.date.split('-').reverse().slice(0,2).join('/')} · Seleção do dia</option>`).join(''):'<option value="">Aguardando primeiro dia</option>';if(dayChosen&&(p.days||[]).some(d=>d.date===selectedDay))selector.value=selectedDay;else selectedDay=selector.value;selector.disabled=!(p.days||[]).length;selector.onchange=()=>{dayChosen=true;selectedDay=selector.value;renderDay()}}
 renderDay();
}
async function enrich(){
 const helper=window.CFFGlobalSelections;if(!helper)return;
 const p=payload||{teams:[],rankings:{},days:[]};
 const [standings,ranking]=await Promise.allSettled([helper.getStandings(),helper.getHomeRankings()]);
 if(homeActive())helper.renderHome?.();
 if(standings.status==='fulfilled'&&standings.value?.teams?.length){
   const official=standings.value;
   const published=Array.isArray(p.teams)?p.teams:[];
   const officialDrops=Math.max(...official.teams.map(t=>Number(t.matches)||0));
   const oldDrops=Math.max(0,...published.map(t=>Number(t.matches)||0));
   if(!published.length||(official.stage===p.stage&&(!p.date||official.date>=p.date)&&officialDrops>=oldDrops)){
     p.teams=official.teams;p.stage=official.stage;p.date=official.date;p.partial=official.partial;
   }
 }
 if(ranking.status==='fulfilled'&&ranking.value?.kills?.length){
   const current=p.rankings||{};
   const siteMax=Math.max(0,...(current.kills||[]).map(r=>Number(r.matches)||0));
   const fileMax=Math.max(0,...(ranking.value.kills||[]).map(r=>Number(r.matches)||0));
   if(!current.kills?.length||fileMax>=siteMax){
     p.rankings={...current,...ranking.value};
   }
 }
 payload=p;
}
const homeActive=()=>!document.hidden&&$('home')?.classList.contains('active');
async function load(){
 if(!homeActive())return;
 if(loading)return loading;
 if(Date.now()-lastFetch<TTL&&payload){render();window.CFFGlobalSelections?.renderHome();return}
 loading=(async()=>{
  const helper=window.CFFGlobalSelections;
  helper?.renderHome();
  let staticReady=false;
  // The home loads the precomputed 4.8KB summary, not the full match database.
  try{
   const response=await fetch('/ffws-global-2026/home-resumo.json?v=20261108-mundial-dia3-v1',{cache:'default'});
   if(!response.ok)throw Error('Resumo estático indisponível');
   const summary=await response.json();
   if(!Array.isArray(summary.teams)||summary.teams.length<6||!summary.rankings?.kills?.length)throw Error('Resumo incompleto');
   payload=summary;staticReady=true;
  }catch(e){console.warn('[Home Mundial] resumo leve indisponível; usando alternativa',e)}
  if(!staticReady){
   try{
    const base=String(window.CFF_CONFIG?.firebase?.databaseURL||'').replace(/\/$/,'');
    const summary=helper?.getPublishedSummary?await helper.getPublishedSummary():
      base?await fetch(base+'/ffwsLive/global-2026/home.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null):null;
    if(summary&&typeof summary==='object')payload=summary;
   }catch(e){console.warn('[Home Mundial] resumo alternativo indisponível',e)}
   try{await enrich()}catch(e){console.warn('[Home Mundial] estatísticas alternativas indisponíveis',e)}
  }
  lastFetch=Date.now();
  try{sessionStorage.setItem(CACHE,JSON.stringify({at:lastFetch,data:payload}))}catch(_){}
  render();
 })().finally(()=>{loading=null});
 return loading;
}
window.cffHomeRenderFinalStats=()=>{load();return true};
function boot(){
 if(booted||!$('home'))return;
 booted=true;
 try{const cached=JSON.parse(sessionStorage.getItem(CACHE)||'null');if(cached?.data){payload=cached.data;lastFetch=Number(cached.at)||0;window.CFFGlobalSelections?.acceptPublishedSummary(payload)}}catch(_){}
 load();
 const home=$('home');
 let wasActive=home.classList.contains('active');
 new MutationObserver(()=>{
  const active=home.classList.contains('active');
  if(active&&!wasActive)load();
  wasActive=active;
 }).observe(home,{attributes:true,attributeFilter:['class']});
 setInterval(()=>{if(homeActive())load()},TTL);
 document.addEventListener('visibilitychange',()=>{if(homeActive())load()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
