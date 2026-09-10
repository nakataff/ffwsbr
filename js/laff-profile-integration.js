(()=>{'use strict';
if(window.__cffLaffProfileIntegration)return;
window.__cffLaffProfileIntegration=true;
const V='20260910-laff-profile-v2';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
const fmt=v=>(Number(v)||0).toLocaleString('pt-BR');
const TEAM_SLUGS={cptvox:'cpt-vox',afrogames:'afrogames',sxtet:'sx-tet'};
const TEAM_RESULTS={
 cptvox:{event:'LAFF 2026 S1',place:'1º',tier:'Campeã',champion:true},
 sxtet:{event:'LAFF 2026 S1 (como SX GG)',place:'2º',tier:'Vice-campeã'},
 afrogames:{event:'LAFF 2026 S1',place:'5º',tier:'Final'}
};
const PLAYER_RESULTS={
 gbtrem22:{team:'CPT VOX',place:'1º lugar',label:'CAMPEÃ',champion:true},
 bad9:{team:'CPT VOX',place:'1º lugar',label:'CAMPEÃ',champion:true},
 trevor9:{team:'CPT VOX',place:'1º lugar',label:'CAMPEÃ',champion:true},
 angelo7:{team:'CPT VOX',place:'1º lugar',label:'CAMPEÃ',champion:true},
 seven7zk:{team:'CPT VOX',place:'1º lugar',label:'CAMPEÃ',champion:true},
 isacksr:{team:'SX GG',place:'2º lugar',label:'VICE-CAMPEÃ'},
 furiazz7:{team:'SX GG',place:'2º lugar',label:'VICE-CAMPEÃ'},
 redxzzz:{team:'SX GG',place:'2º lugar',label:'VICE-CAMPEÃ'},
 mexico:{team:'SX GG',place:'2º lugar',label:'VICE-CAMPEÃ'},
 nielffx:{team:'AFROGAMES',place:'5º lugar',label:'FINAL'},
 braboxx7:{team:'AFROGAMES',place:'5º lugar',label:'FINAL'},
 gbzinn7:{team:'AFROGAMES',place:'5º lugar',label:'FINAL'},
 sant10s:{team:'AFROGAMES',place:'5º lugar',label:'FINAL'}
};
const CPT_CHAMPIONS=new Set(['gbtrem22','bad9','trevor9','angelo7','seven7zk']);
function css(){
 if(document.getElementById('cff-laff-profile-css'))return;
 const s=document.createElement('style');s.id='cff-laff-profile-css';s.textContent=`
.cff-season-tabs .cff-laff-team-tab{white-space:nowrap}
.cff-laff-season-note{display:inline-flex;align-items:center;gap:7px;max-width:100%;margin-top:7px;padding:6px 10px;border:1px solid rgba(0,200,255,.22);border-radius:999px;background:rgba(0,200,255,.06);color:#9dc8eb;font-size:.68rem;font-weight:850;box-sizing:border-box}
.cff-laff-season-note.is-champion{border-color:rgba(255,204,70,.38);background:rgba(255,204,70,.08);color:#ffd46b}
.cff-laff-player-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important}
.cff-laff-result-banner{display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:100%;margin:0 0 13px;padding:10px 12px;border:1px solid rgba(0,200,255,.22);border-radius:12px;background:rgba(0,200,255,.055);box-sizing:border-box;overflow:hidden}
.cff-laff-result-banner.is-champion{border-color:rgba(255,204,70,.42);background:rgba(255,204,70,.075)}
.cff-laff-result-banner span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bad8ef;font-size:.72rem;font-weight:850}
.cff-laff-result-banner strong{flex:0 0 auto;color:#00c8ff;font-size:.74rem;letter-spacing:.055em;white-space:nowrap}
.cff-laff-result-banner.is-champion strong{color:#ffd46b}
@media(max-width:720px){.cff-laff-result-banner{align-items:flex-start;flex-direction:column;gap:4px}.cff-laff-result-banner span{width:100%;white-space:normal}.cff-laff-player-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important}.cff-laff-season-note{border-radius:10px;white-space:normal}}
@media(max-width:380px){.cff-laff-player-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important}.cff-laff-player-stats .cff-player-stat{padding-left:1px;padding-right:1px}}
`;
 document.head.appendChild(s);
}
function teamLogo(name){return window.cffResolveTeamLogo?.(name)||'escudo.webp'}
function stageCards(stages){return `<div class="cff-season-stage-grid">${stages.map(x=>`<article class="cff-season-stage-card${x.champion?' is-champion':''}"><div class="cff-season-stage-top"><strong>${esc(x.label||x.id)}</strong><span>${x.position?fmt(x.position)+'º':'—'}</span></div><div class="cff-season-stage-stats"><span><b>${fmt(x.points)}</b><small>Pontos</small></span><span><b>${fmt(x.kills)}</b><small>Abates</small></span><span><b>${fmt(x.booyahs)}</b><small>Booyahs</small></span><span><b>${fmt(x.matches)}</b><small>Quedas</small></span></div>${x.status?`<div class="cff-season-status">${esc(x.status)}</div>`:''}</article>`).join('')}</div>`}
function laffPlayerCard(p,currentTeam){const avg=Number(p.avg??(p.matches?Number(p.kills)/Number(p.matches):0)).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});return `<a class="cff-player-card" href="jogador.html?id=${encodeURIComponent(p.id||p.name)}"><div class="cff-player-photo-wrap"><img class="cff-player-photo" loading="lazy" decoding="async" src="${esc(p.photo||'silhueta.webp')}" alt="${esc(p.name)}" onerror="this.onerror=null;this.src='silhueta.webp'"><img class="cff-player-team-mini" src="${esc(teamLogo(currentTeam))}" data-team-logo="${esc(currentTeam)}" alt=""></div><div class="cff-player-info"><h3>${esc(p.name)}</h3><span class="cff-player-role">${esc(p.role||'Jogador')}</span></div><div class="cff-player-stats cff-laff-player-stats"><div class="cff-player-stat"><small>Abates</small><strong>${fmt(p.kills)}</strong></div><div class="cff-player-stat"><small>Quedas</small><strong>${fmt(p.matches)}</strong></div><div class="cff-player-stat"><small>Média</small><strong>${avg}</strong></div></div></a>`}
async function renderTeamLaff(slug,teamName,button){
 const panel=document.getElementById('cff-season-panel');if(!panel)return;
 button.disabled=true;panel.innerHTML='<section class="cff-inline-loading"><span></span><strong>Carregando LAFF...</strong></section>';
 try{
  const r=await fetch(`team-data/seasons/${slug}.json?v=${V}`,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json(),c=data?.seasons?.laff;if(!c)throw new Error('LAFF ausente');
  const stages=c.stages||[],final=stages.find(x=>x.id==='final')||stages[stages.length-1]||{},totals=stages.reduce((a,x)=>(a.kills+=Number(x.kills)||0,a.matches+=Number(x.matches)||0,a.booyahs+=Number(x.booyahs)||0,a),{kills:0,matches:0,booyahs:0});
  const isChampion=Number(c.finalPosition)===1||final.champion;
  const note=c.teamAtEvent&&norm(c.teamAtEvent)!==norm(teamName)?`Disputou a competição como ${c.teamAtEvent}`:(isChampion?'Título da LAFF registrado no histórico da equipe':'Campanha registrada na LAFF');
  panel.innerHTML=`<div class="cff-team-section-head cff-season-head"><div><h2>LAFF 2026 S1</h2><p>${esc(c.status||final.status||'Desempenho da equipe')}</p><span class="cff-laff-season-note${isChampion?' is-champion':''}">${isChampion?'🏆 ':''}${esc(note)}</span></div></div><section class="cff-team-stats"><div class="cff-team-stat"><small>Final</small><strong>${c.finalPosition?fmt(c.finalPosition)+'º':'—'}</strong></div><div class="cff-team-stat"><small>Abates</small><strong>${fmt(totals.kills)}</strong></div><div class="cff-team-stat"><small>Booyahs</small><strong>${fmt(totals.booyahs)}</strong></div><div class="cff-team-stat"><small>Quedas</small><strong>${fmt(totals.matches)}</strong></div></section>${stageCards(stages)}<section class="cff-team-section cff-season-roster-section"><div class="cff-team-section-head"><div><h2>Jogadores na LAFF</h2><p>${c.teamAtEvent&&norm(c.teamAtEvent)!==norm(teamName)?`Line registrada como ${esc(c.teamAtEvent)}`:'Elenco utilizado na competição'}</p></div><span class="cff-team-badge">${(c.players||[]).length} jogadores</span></div><div class="cff-team-roster">${(c.players||[]).map(p=>laffPlayerCard(p,teamName)).join('')}</div></section>`;
 }catch(e){panel.innerHTML='<div class="cff-public-empty">Não foi possível carregar os dados da LAFF desta equipe.</div>'}finally{button.disabled=false}
}
function currentTeamName(){return document.querySelector('#team-page-root .cff-team-hero h1')?.textContent?.trim()||''}
function patchTeamPage(){
 const nav=document.querySelector('#team-page-root .cff-season-tabs'),name=currentTeamName();if(!nav||!name)return false;
 const slug=TEAM_SLUGS[norm(name)];if(!slug||nav.querySelector('[data-cff-team-laff]'))return true;
 const b=document.createElement('button');b.type='button';b.className='cff-laff-team-tab';b.dataset.cffTeamLaff='1';b.textContent='LAFF 2026 S1';b.setAttribute('aria-selected','false');nav.appendChild(b);
 b.addEventListener('click',()=>{nav.querySelectorAll('button').forEach(x=>{x.classList.toggle('is-active',x===b);x.setAttribute('aria-selected',x===b?'true':'false')});renderTeamLaff(slug,name,b)});
 nav.querySelectorAll('[data-team-season]').forEach(x=>x.addEventListener('click',()=>{b.classList.remove('is-active');b.setAttribute('aria-selected','false')}));
 return true;
}
function patchTeamHistoryLaff(){
 const name=currentTeamName(),key=norm(name),info=TEAM_RESULTS[key];if(!info)return;
 const titlesMount=document.getElementById('cff-team-titles-mount');
 if(info.champion&&titlesMount){
  const grid=titlesMount.querySelector('.cff-title-grid');
  if(grid&&!norm(grid.textContent).includes('laff2026s1')){
   grid.querySelector('.cff-public-empty')?.remove();
   grid.insertAdjacentHTML('afterbegin','<article class="cff-title-card" data-cff-laff-team-title="1"><img src="laff.webp" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'trofeu.webp\'"><div><strong>Campeã</strong><span>LAFF 2026 S1</span><small>2026 • LAFF</small></div></article>');
   const badge=titlesMount.querySelector('.cff-team-badge'),n=Number((badge?.textContent||'').match(/\d+/)?.[0]);if(badge)badge.textContent=`${(Number.isFinite(n)?n:0)+1} conquistas`;
  }
 }
 const resultsMount=document.getElementById('cff-team-results-mount'),list=resultsMount?.querySelector('.cff-results-list');
 if(list&&!norm(list.textContent).includes('laff2026s1')){
  list.querySelector('.cff-public-empty')?.remove();
  list.insertAdjacentHTML('afterbegin',`<article class="cff-result-row" data-cff-laff-team-result="1"><strong>${esc(info.event)}</strong><span>2026</span><b>${esc(info.place)}</b><small>${esc(info.tier)}</small></article>`);
 }
}
function playerKey(){return norm(document.querySelector('#player-root .profile-name')?.textContent||'')}
function patchPlayerResult(){
 const key=playerKey(),info=PLAYER_RESULTS[key],tab=document.querySelector('#player-root [data-player-season="laff"]'),panel=document.getElementById('player-season-panel');if(!info||!tab||!panel||!tab.classList.contains('is-active'))return;
 if(panel.querySelector('.cff-laff-result-banner'))return;
 const head=panel.querySelector('.player-season-head');if(!head||!norm(head.textContent).includes('laff2026s1'))return;
 const el=document.createElement('div');el.className='cff-laff-result-banner'+(info.champion?' is-champion':'');el.innerHTML=`<span>Resultado da equipe • ${esc(info.team)}</span><strong>${info.champion?'🏆 ':''}${esc(info.label)} · ${esc(info.place)}</strong>`;head.insertAdjacentElement('afterend',el);
}
function patchCptPlayerTitle(){
 const key=playerKey();if(!CPT_CHAMPIONS.has(key))return;
 const box=document.getElementById('profile-trophies'),sec=document.getElementById('profile-trophies-section');if(!box||!sec)return;
 const has=[...box.querySelectorAll('.trophy-card')].some(x=>norm(x.textContent).includes('laff2026s1'));
 if(has){sec.hidden=false;return}
 const card=document.createElement('div');card.className='trophy-card';card.dataset.cffLaffTitle='1';card.innerHTML='<span>🏆</span><div><strong>LAFF 2026 S1</strong><small>Campeã • CPT VOX</small></div>';box.appendChild(card);sec.hidden=false;
 const counter=document.querySelector('[data-title-collective] strong');if(counter){const n=Number(counter.textContent);counter.textContent=String((Number.isFinite(n)?n:0)+1)}
 const sub=document.querySelector('[data-title-collective] span');if(sub)sub.textContent='Conquistas registradas';
}
let timer=0,tries=0;
function patch(){css();patchTeamPage();patchTeamHistoryLaff();patchPlayerResult();patchCptPlayerTitle()}
function schedule(){clearTimeout(timer);timer=setTimeout(patch,50)}
const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});
function boot(){patch();const t=setInterval(()=>{tries++;patch();if(((document.querySelector('.cff-team-hero')||document.querySelector('.profile-name'))&&tries>10)||tries>80)clearInterval(t)},150)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
document.addEventListener('click',e=>{if(e.target.closest?.('[data-player-season="laff"]'))setTimeout(patchPlayerResult,40)});
window.CFF_LAFF_PROFILE_INTEGRATION_VERSION=V;
})();
