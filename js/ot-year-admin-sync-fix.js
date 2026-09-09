(()=>{'use strict';
const V='20260909-ot-year-admin-sync-v1';
let syncPromise=null;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function dbBase(){return String(window.CFF_CONFIG?.firebase?.databaseURL||'').replace(/\/$/,'')}
async function fetchAdminIds(){const base=dbBase();if(!base)return null;for(let i=0;i<3;i++){try{const r=await fetch(base+'/adminTitles.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const raw=await r.json();return Object.keys(raw||{})}catch(_){if(i<2)await wait(250*(i+1))}}return null}
function hasAllAdminIds(ids){if(!ids)return true;const events=window.otYear2026Data?.events||[];const set=new Set(events.map(e=>String(e?.id||'')));return ids.every(id=>set.has(String(id)))}
async function syncYear(){if(syncPromise)return syncPromise;syncPromise=(async()=>{const ids=await fetchAdminIds();for(let i=0;i<3;i++){try{if(typeof window.cffRenderHomeYear2026==='function')await window.cffRenderHomeYear2026()}catch(_){}if(window.otYear2026Data&&hasAllAdminIds(ids))return window.otYear2026Data;if(i<2)await wait(220*(i+1))}return window.otYear2026Data||null})().finally(()=>{syncPromise=null});return syncPromise}
function wrapEntry(){const fn=window.renderOutrosTorneiosEntry;if(typeof fn!=='function'||fn.__cffYearAdminSync)return;const wrapped=function(...args){return syncYear().catch(()=>null).then(()=>fn.apply(this,args))};wrapped.__cffYearAdminSync=true;wrapped.__cffOriginal=fn;window.renderOutrosTorneiosEntry=wrapped}
function wrapOpen(){const fn=window.openOt2026View;if(typeof fn!=='function'||fn.__cffYearAdminSync)return;const wrapped=function(...args){return syncYear().catch(()=>null).then(()=>fn.apply(this,args))};wrapped.__cffYearAdminSync=true;wrapped.__cffOriginal=fn;window.openOt2026View=wrapped}
function install(){wrapEntry();wrapOpen()}
document.addEventListener('cff:modules-loaded',install);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
let tries=0;const timer=setInterval(()=>{install();if(++tries>120||window.renderOutrosTorneiosEntry?.__cffYearAdminSync)clearInterval(timer)},100);
window.cffSyncYear2026AdminTitles=syncYear;
window.CFF_OT_YEAR_ADMIN_SYNC_VERSION=V;
})();