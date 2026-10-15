(()=>{'use strict';
if(window.__cffYearRankingSheetLogos)return;
window.__cffYearRankingSheetLogos=true;
const V='20261015-career-directory-v1';
const DEFAULT_SHEET='https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=1308958099&single=true&output=tsv';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
const map={},aliases={},priorities={};
const LYON_TEAM_LOGO='https://i.postimg.cc/XYGTQnxR/inco.webp';
let ready=false,loadPromise=null;
const fallbackLogos={'SIX EIGHT':'https://i.postimg.cc/QNSc7JY0/SIX8.webp'};
function cleanUrl(value){
 const raw=String(value||'').trim();
 if(!raw)return'';
 const md=raw.match(/\]\((https?:\/\/[^)\s]+)\)/i);if(md)return md[1];
 const href=raw.match(/href=["'](https?:\/\/[^"']+)["']/i);if(href)return href[1];
 const formula=raw.match(/HYPERLINK\s*\(\s*["'](https?:\/\/[^"']+)["']/i);if(formula)return formula[1];
 const direct=raw.match(/https?:\/\/[^\s"'<>]+/i);if(direct)return direct[0].replace(/[),.;]+$/,'');
 return /\.(?:png|webp|jpe?g|svg)(?:\?|$)/i.test(raw)?raw:'';
}
function add(name,url,priority=0){
 name=String(name||'').trim();url=cleanUrl(url);
 const key=norm(name);
 if(name&&url&&priority>=(priorities[key]??-1)){map[key]=url;priorities[key]=priority}
}
function parseTsv(text,priority=0){
 const lines=String(text||'').split(/\r?\n/).filter(x=>x.trim());
 if(!lines.length)return;
 const first=lines[0].split('\t').map(x=>norm(x));
 const nameHeaders=['EQUIPE','TIME','TEAM','NOME','ORGANIZACAO','ORGANIZATION','NOMEDOTIME','NOMEDAEQUIPE','NOMEEQUIPE','NOMETIME'];
 const urlHeaders=['LOGO','URL','LINK','IMAGEM','IMAGE','ESCUDO','LOGOURL','LINKLOGO','URLLOGO','LOGODOTIME','LOGODAEQUIPE'];
 const ni=first.findIndex(x=>nameHeaders.includes(x));
 const ui=first.findIndex(x=>urlHeaders.includes(x));
 for(const line of lines){
   const c=line.split('\t').map(x=>x.trim());
   let n=ni>=0?(c[ni]||''):'',u=ui>=0?(c[ui]||''):'';
   if(!cleanUrl(u)){
     const i=c.findIndex(x=>!!cleanUrl(x));
     if(i>=0){u=c[i];if(!n)n=c.find((x,j)=>j!==i&&x&&!cleanUrl(x))||''}
   }
   if(!n&&c.length)n=c.find(x=>x&&!cleanUrl(x))||c[0];
   add(n,u,priority);
 }
}
async function loadSheet(url){
 if(!url)return;
 const join=url.includes('?')?'&':'?';
 const r=await fetch(url+join+'cffv='+Math.floor(Date.now()/300000),{cache:'default'});
 if(!r.ok)throw new Error('HTTP '+r.status);
 return r.text();
}
function notify(){patch();document.dispatchEvent(new CustomEvent('cff:year-logos-ready'))}
async function load(){
 if(loadPromise)return loadPromise;
 loadPromise=(async()=>{
   Object.entries(fallbackLogos).forEach(([n,u])=>add(n,u));
   // Paint available same-origin logos immediately; Google Sheets refreshes in the background.
   ready=true;notify();
   const primary=window.CFF_CONFIG?.sheets?.logosEquipes||DEFAULT_SHEET;
   const secondary=window.CFF_CONFIG?.sheets?.logosOutrasEquipes||'';
   const tasks=[fetch('team-data/logo-map.json?v='+V,{cache:'default'}).then(r=>r.ok?r.json():{}).then(d=>{
     Object.entries(d?.logos||{}).forEach(([n,u])=>add(n,u));
     Object.entries(d?.aliases||{}).forEach(([a,n])=>aliases[norm(a)]=norm(n));notify();
   })];
   if(secondary)tasks.push(loadSheet(secondary).then(text=>{parseTsv(text,1);notify()}));
   tasks.push(loadSheet(primary).then(text=>{parseTsv(text,2);notify()}));
   await Promise.allSettled(tasks);return map;
 })().finally(()=>{loadPromise=null});
 return loadPromise;
}
function find(name){const central=window.cffCareerTeamIdentity?.(name);if(central?.logo)return central.logo;const k=norm(name);if(k==='LYON')return window.CFF_GLOBAL_TEAM_LOGOS?.logos?.LYON||LYON_TEAM_LOGO;const best=[k,aliases[k]].filter(key=>key&&map[key]).sort((a,b)=>(priorities[b]??-1)-(priorities[a]??-1))[0];return map[best]||''}
function globalLogo(name){const central=window.cffCareerTeamIdentity?.(name);if(central?.logo)return central.logo;
 const k=norm(name),assets=window.CFF_GLOBAL_TEAM_LOGOS;
 const local=assets?.logos?.[k];
 if(k==='LYON')return local||LYON_TEAM_LOGO;
 const keys=assets?.keys?.[k]||[k];
 // Only explicit team rows from the primary logo sheet can update an optimized asset.
 const liveKey=keys.find(key=>(priorities[key]??0)>=2),live=liveKey?map[liveKey]:'';
 const source=liveKey?assets?.sources?.[liveKey]:'';
 if(local&&(!live||live===source||live===local))return local;
 return live||local||find(name)||'';
}

function setImg(img,team){
 if(img?.dataset?.careerTeamLogo)return;
 const central=window.cffCareerTeamIdentity?.(team);if(central?.logo){if(img&&img.getAttribute('src')!==central.logo)img.src=central.logo;return;}
 const isGlobal=Boolean(img?.dataset?.cffGlobalTeamLogo);
 const src=isGlobal?globalLogo(team):find(team);if(!img||!src)return;
 const warning=img.closest?.('.ffws-global-team-roster-head')?.querySelector('.ffws-global-logo-pending');
 if(warning)warning.hidden=true;
 if((img.getAttribute('src')||'')===src)return;
 img.dataset.cffSheetLogo=String(team||'');
 img.src=src;
 img.onerror=()=>{img.onerror=null;img.src='escudo.webp'};
}
function patchHomeChampions(){document.querySelectorAll('#home-year-latest-champions .home-latest-champion').forEach(card=>{const team=card.querySelector('strong')?.textContent?.trim();if(team)setImg(card.querySelector('img'),team)})}
function patchHomeTitles(){document.querySelectorAll('#home-year-titles-ranking tbody tr').forEach(row=>{const team=row.querySelector('.home-year-team-full')?.textContent?.trim()||row.querySelector('.home-name-cell')?.textContent?.trim();if(team)setImg(row.querySelector('img'),team)})}
function patchDetailed(){
 document.querySelectorAll('#ot-year-titles-content [data-title-team]').forEach(btn=>{const team=btn.dataset.titleTeam||btn.textContent?.trim();if(team)setImg(btn.querySelector('img'),team)});
 document.querySelectorAll('#ot-year2026-panel .ot-year-team-link[data-team]').forEach(btn=>{const team=btn.dataset.team||btn.textContent?.trim();if(team)setImg(btn.querySelector('img'),team)});
 document.querySelectorAll('#ot-year-titles-content tbody tr').forEach(row=>{const cell=row.children?.[1];if(!cell)return;const team=cell.querySelector('[data-title-team]')?.dataset.titleTeam||cell.querySelector('[data-title-team]')?.textContent?.trim()||cell.textContent?.trim();if(team)cell.querySelectorAll('img').forEach(img=>setImg(img,team))});
}
function patchWorldSeries(){
 document.querySelectorAll('img[data-cff-global-team-logo]').forEach(img=>setImg(img,img.dataset.cffGlobalTeamLogo));
 document.querySelectorAll('#home-global-classified .home-global-team').forEach(card=>{
   const name=card.querySelector('strong')?.textContent?.trim();
   const monogram=card.querySelector('.home-global-monogram');
   const short=monogram?.textContent?.trim();
   const team=globalLogo(name)?name:globalLogo(short)?short:'';
   if(!team)return;
   const box=card.querySelector('.home-global-team-image');if(!box)return;
   let img=box.querySelector('img');
   if(!img){img=document.createElement('img');img.loading='lazy';img.decoding='async';img.width=72;img.height=72;img.alt=name||short;box.prepend(img)}
   img.dataset.cffGlobalTeamLogo=team;img.hidden=false;
   if(monogram)monogram.hidden=true;
   setImg(img,team);
   const caption=card.querySelector('small');
   if(caption?.textContent?.trim()==='Logo pendente')caption.textContent=short||name;
 });
}
function patchTeamProfiles(){document.querySelectorAll('img[data-team-logo]').forEach(img=>setImg(img,img.dataset.teamLogo));}
function patch(){if(!ready)return;patchTeamProfiles();patchHomeChampions();patchHomeTitles();patchDetailed();patchWorldSeries()}
let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(patch,40)}).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('cff:year-rendered',patch);
document.addEventListener('cff:modules-loaded',patch);
window.cffFindLiveTeamLogo=find;
window.cffResolveGlobalTeamLogo=globalLogo;
window.cffReloadYearSheetLogos=()=>{ready=false;return load()};
window.cffPatchYearTeamLogos=patch;
import('/js/career-team-identities.mjs?v=20261015-career-directory-v1').catch(()=>{});
document.addEventListener('cff:career-identities-ready',patch);
load();
})();