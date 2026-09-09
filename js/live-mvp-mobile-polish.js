(()=>{'use strict';
if(window.__cffLiveMvpMobilePolish)return;
window.__cffLiveMvpMobilePolish=true;
const V='20260909-live-mvp-top5-mobile-v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const date=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||'')};

function installCss(){
 if(document.getElementById('cff-live-mvp-polish-css'))return;
 const s=document.createElement('style');
 s.id='cff-live-mvp-polish-css';
 s.textContent=`
.home-left-rail #lives-on-container .live-card.ativo[href]{
 display:grid!important;
 grid-template-columns:auto minmax(0,1fr) auto;
 grid-template-areas:"dot info badge" ". watch watch";
 align-items:center;
 column-gap:8px;
 row-gap:0;
 min-width:0;
 max-width:100%;
 box-sizing:border-box;
 overflow:hidden;
}
.home-left-rail #lives-on-container .live-card.ativo[href] .live-dot{grid-area:dot}
.home-left-rail #lives-on-container .live-card.ativo[href] .live-card-info{grid-area:info;min-width:0;overflow:hidden}
.home-left-rail #lives-on-container .live-card.ativo[href] .live-card-titulo,
.home-left-rail #lives-on-container .live-card.ativo[href] .live-card-canal{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.home-left-rail #lives-on-container .live-card.ativo[href] .live-card-badge{grid-area:badge;max-width:100%;white-space:nowrap}
.cff-live-watch-cta{
 grid-area:watch;
 display:flex;
 width:100%;
 min-height:32px;
 margin-top:8px;
 padding:0 10px;
 box-sizing:border-box;
 align-items:center;
 justify-content:center;
 gap:7px;
 border-radius:8px;
 background:#ff1738;
 color:#fff;
 font-size:.62rem;
 font-weight:1000;
 letter-spacing:.075em;
 line-height:1;
 text-transform:uppercase;
 white-space:nowrap;
 box-shadow:0 6px 16px rgba(255,23,56,.22);
}
.cff-live-watch-cta::before{
 content:"▶";
 display:inline-flex;
 width:18px;
 height:18px;
 flex:0 0 18px;
 align-items:center;
 justify-content:center;
 border-radius:5px;
 background:#fff;
 color:#ff1738;
 font-size:.58rem;
 line-height:1;
 padding-left:1px;
 box-sizing:border-box;
}
.home-left-rail #lives-on-container .live-card.ativo[href]:hover .cff-live-watch-cta{filter:brightness(1.08)}
#ot-year-mvp-content{min-width:0;max-width:100%;overflow:hidden}
#ot-year-mvp-content .ot-year-table-wrap{max-width:100%;overflow-x:auto!important;-webkit-overflow-scrolling:touch;overscroll-behavior-inline:contain}
#ot-year-mvp-content .ot-year-mvp-table{min-width:640px}
#ot-year-mvp-content .ot-year-mvp-events{min-width:0;max-width:100%;overflow:hidden}
#ot-year-mvp-content .ot-year-mvp-events-grid{
 display:grid;
 grid-template-columns:repeat(3,minmax(0,1fr));
 gap:10px;
 min-width:0;
 max-width:100%;
}
#ot-year-mvp-content .cff-mvp-event-card{
 min-width:0;
 max-width:100%;
 overflow:hidden;
 display:flex;
 flex-direction:column;
 box-sizing:border-box;
}
.cff-mvp-event-head{display:flex;flex-direction:column;gap:4px;min-width:0}
.cff-mvp-event-head strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cff-mvp-event-head small{opacity:.75}
.cff-mvp-top5-list{display:grid;gap:5px;margin-top:10px;min-width:0}
.cff-mvp-top5-row{
 display:grid;
 grid-template-columns:25px minmax(0,1fr) auto;
 gap:7px;
 align-items:center;
 min-width:0;
 padding:5px 7px;
 border-radius:7px;
 background:rgba(255,255,255,.035);
 box-sizing:border-box;
}
.cff-mvp-top5-pos{font-weight:1000;color:#7ea9d3;white-space:nowrap}
.cff-mvp-top5-row:first-child .cff-mvp-top5-pos{color:#ffd166}
.cff-mvp-top5-player{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#eef7ff;font-weight:850}
.cff-mvp-top5-stats{white-space:nowrap;color:#7195ba;font-size:.66rem;font-weight:850}
@media(max-width:980px){
 #ot-year-mvp-content .ot-year-mvp-events-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:620px){
 #ot-year-mvp-content .ot-year-ranking-head{flex-wrap:wrap;max-width:100%;box-sizing:border-box}
 #ot-year-mvp-content .ot-year-mvp-events-grid{grid-template-columns:minmax(0,1fr)!important}
 #ot-year-mvp-content .ot-year-mvp-event{min-width:0;max-width:100%;box-sizing:border-box}
 .home-left-rail #lives-on-container .live-card.ativo[href]{
  grid-template-columns:auto minmax(0,1fr);
  grid-template-areas:"dot info" "badge badge" "watch watch";
 }
 .home-left-rail #lives-on-container .live-card.ativo[href] .live-card-badge{justify-self:start;margin-top:5px}
 .cff-live-watch-cta{min-height:36px;font-size:.66rem}
}
@media(max-width:390px){
 .cff-mvp-top5-row{grid-template-columns:23px minmax(0,1fr);gap:6px}
 .cff-mvp-top5-stats{grid-column:2;justify-self:start;margin-top:-2px;white-space:normal}
}
`;
 document.head.appendChild(s);
}

function decorateLives(){
 document.querySelectorAll('#lives-on-container a.live-card.ativo[href]').forEach(card=>{
  if(card.querySelector('.cff-live-watch-cta'))return;
  const cta=document.createElement('span');
  cta.className='cff-live-watch-cta';
  cta.textContent='Assistir transmissão';
  card.appendChild(cta);
  const title=card.querySelector('.live-card-titulo')?.textContent?.trim()||'Transmissão ao vivo';
  card.setAttribute('aria-label',`${title} — assistir transmissão`);
  card.title='Abrir transmissão';
 });
}

let adminMap=null,adminPromise=null;
function dbBase(){return String(window.CFF_CONFIG?.firebase?.databaseURL||'').replace(/\/$/,'')}
async function loadAdminMap(){
 if(adminMap)return adminMap;
 if(adminPromise)return adminPromise;
 const base=dbBase();
 if(!base)return new Map();
 adminPromise=fetch(base+'/adminTitles.json?ts='+Date.now(),{cache:'no-store'})
  .then(r=>r.ok?r.json():Promise.reject(new Error('HTTP '+r.status)))
  .then(raw=>{
   adminMap=new Map();
   Object.entries(raw||{}).forEach(([key,v])=>{if(v)adminMap.set(String(v.id||key),v)});
   return adminMap;
  })
  .catch(()=>new Map())
  .finally(()=>{adminPromise=null});
 return adminPromise;
}
function rankingFor(ev,raw){
 const source=raw?.mvpRanking??ev?.mvpRanking;
 const items=(Array.isArray(source)?source:Object.values(source||{})).map((x,i)=>{
  const position=Number(x?.position||i+1),player=String(x?.player||'').trim();
  if(!player||position<1||position>5)return null;
  const out={position,player};
  const kills=x?.kills,falls=x?.matches??x?.quedas;
  if(kills!==undefined&&kills!==''&&Number.isFinite(Number(kills)))out.kills=Number(kills);
  if(falls!==undefined&&falls!==''&&Number.isFinite(Number(falls)))out.matches=Number(falls);
  return out;
 }).filter(Boolean).sort((a,b)=>a.position-b.position);
 if(items.length)return items;
 const winners=Array.isArray(ev?.mvp)?ev.mvp.filter(Boolean):[];
 return winners.length?[{position:1,player:winners.join(' / ')}]:[];
}
function statsText(x){
 const p=[];
 if(Number.isFinite(x?.kills))p.push(`${x.kills} K`);
 if(Number.isFinite(x?.matches))p.push(`${x.matches} Q`);
 return p.join(' • ');
}
async function patchMvpEvents(){
 const grid=document.querySelector('#ot-year-mvp-content .ot-year-mvp-events-grid');
 if(!grid||grid.dataset.cffTop5==='1')return;
 const data=window.otYear2026Data;
 if(!data?.events?.length)return;
 const map=await loadAdminMap();
 if(!grid.isConnected||grid.dataset.cffTop5==='1')return;
 const events=[...data.events].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const section=grid.closest('.ot-year-mvp-events');
 const h=section?.querySelector('.ot-year-ranking-head h3'),p=section?.querySelector('.ot-year-ranking-head p');
 if(h)h.textContent='TOP 5 MVP por torneio';
 if(p)p.textContent='Ranking individual de cada evento. Kills e quedas aparecem quando cadastradas.';
 grid.innerHTML=events.map(ev=>{
  const raw=map.get(String(ev.id||''))||null,r=rankingFor(ev,raw),by=new Map(r.map(x=>[Number(x.position),x]));
  const rows=[1,2,3,4,5].map(pos=>{
   const x=by.get(pos),stats=x?statsText(x):'';
   return `<div class="cff-mvp-top5-row"><span class="cff-mvp-top5-pos">${pos}º</span><span class="cff-mvp-top5-player">${x?esc(x.player):'—'}</span><span class="cff-mvp-top5-stats">${esc(stats)}</span></div>`;
  }).join('');
  return `<article class="ot-year-mvp-event cff-mvp-event-card"><div class="cff-mvp-event-head"><strong>${esc(ev.name||'Torneio')}</strong><small>${esc(date(ev.date))}</small></div><div class="cff-mvp-top5-list">${rows}</div></article>`;
 }).join('');
 grid.dataset.cffTop5='1';
}

let timer;
function patchAll(){decorateLives();patchMvpEvents().catch(()=>{})}
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(patchAll,60)}).observe(document.documentElement,{childList:true,subtree:true});
installCss();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patchAll,{once:true});else patchAll();
document.addEventListener('cff:modules-loaded',patchAll);
window.CFF_LIVE_MVP_MOBILE_POLISH_VERSION=V;
})();
