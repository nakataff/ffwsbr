(()=>{'use strict';
if(window.__cffYearRankingSheetLogos)return;
window.__cffYearRankingSheetLogos=true;
const V='20260909-year-sheet-logos-v2';
const DEFAULT_SHEET='https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=1308958099&single=true&output=tsv';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'');
const map={},aliases={};
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
function add(name,url){
 name=String(name||'').trim();url=cleanUrl(url);
 if(name&&url)map[norm(name)]=url;
}
function parseTsv(text){
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
   add(n,u);
 }
}
async function loadSheet(url){
 if(!url)return;
 const join=url.includes('?')?'&':'?';
 const r=await fetch(url+join+'cffv='+Date.now(),{cache:'no-store'});
 if(!r.ok)throw new Error('HTTP '+r.status);
 parseTsv(await r.text());
}
async function load(){
 if(loadPromise)return loadPromise;
 loadPromise=(async()=>{
   Object.entries(fallbackLogos).forEach(([n,u])=>add(n,u));
   try{
     const r=await fetch('team-data/logo-map.json?v='+V,{cache:'no-store'});
     if(r.ok){
       const d=await r.json();
       Object.entries(d?.logos||{}).forEach(([n,u])=>add(n,u));
       Object.entries(d?.aliases||{}).forEach(([a,n])=>aliases[norm(a)]=norm(n));
     }
   }catch(_){}
   const primary=window.CFF_CONFIG?.sheets?.logosEquipes||DEFAULT_SHEET;
   const secondary=window.CFF_CONFIG?.sheets?.logosOutrasEquipes||'';
   await Promise.allSettled([primary,secondary].filter(Boolean).map(loadSheet));
   ready=true;patch();
   document.dispatchEvent(new CustomEvent('cff:year-logos-ready'));
   return map;
 })().finally(()=>{loadPromise=null});
 return loadPromise;
}
function find(name){let k=norm(name);if(aliases[k])k=aliases[k];return map[k]||''}
function setImg(img,team){
 const src=find(team);if(!img||!src)return;
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
function patch(){if(!ready)return;patchHomeChampions();patchHomeTitles();patchDetailed()}
let timer;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(patch,40)}).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('cff:year-rendered',patch);
document.addEventListener('cff:modules-loaded',patch);
window.cffFindLiveTeamLogo=find;
window.cffReloadYearSheetLogos=()=>{ready=false;return load()};
window.cffPatchYearTeamLogos=patch;
load();
})();