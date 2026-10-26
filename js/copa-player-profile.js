/* Copa tab: one small selected-player snapshot, fetched only when its tab opens. */
(()=>{'use strict';
const VERSION='20261026-copa-groups-full-v5',cache=new Map(),serial=new WeakMap();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stages=[['geral','Geral'],['grupos','Fase de grupos'],['repescagem','Repescagem'],['final','Final']];
function eligible(p){return p?.profileType!=='staff'&&!!window.CFF_COPA_2026_PLAYERS?.[p?.id];}
function load(p){if(!eligible(p))return Promise.resolve(null);if(!cache.has(p.id))cache.set(p.id,fetch('/copa-ff-2026/player-data/'+encodeURIComponent(p.id)+'.json?v='+VERSION,{cache:'default'}).then(async r=>{if(!r.ok)throw Error('Dados indisponíveis');const d=await r.json();if(d.generalId!==p.id||d.eventId!=='copa-ff-2026')throw Error('Identidade inválida');return d;}).catch(e=>{cache.delete(p.id);throw e;}));return cache.get(p.id);}
async function render(panel,p,stage='geral',current=()=>panel.isConnected){
 if(!eligible(p))return;const request=(serial.get(panel)||0)+1;serial.set(panel,request);const valid=()=>serial.get(panel)===request&&current();
 if(!stages.some(([key])=>key===stage))stage='geral';
 if(!cache.has(p.id))panel.innerHTML='<div class="player-season-loading"><span></span><strong>Carregando Copa FF 2026…</strong></div>';
 try{const data=await load(p);if(!valid())return;const s=data.stats[stage],fmt=v=>v==null?'—':Number(v).toLocaleString('pt-BR'),avg=s?.average==null?'—':Number(s.average).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  panel.innerHTML=`<nav class="player-stage-tabs" aria-label="Etapa da Copa FF 2026">${stages.map(([key,name])=>`<button type="button" data-copa-stage="${key}" aria-pressed="${stage===key}">${name}</button>`).join('')}</nav><div class="global-2026-summary" data-copa-2026-summary><div class="global-2026-summary-head"><div><small>COPA FF 2026</small><h2>Copa FF 2026</h2><p>${esc(data.team)}</p></div><a href="/index.html?torneio=copa-ff-2026#outros-torneios">Ver torneio →</a></div><div class="stats-grid global-2026-summary-stats">${[['Abates',fmt(s?.kills)],['Quedas',fmt(s?.matches)],['Média',avg],['Dano',fmt(s?.damage)],['Assistências',fmt(s?.assists)],['MVP da queda',fmt(s?.mvp)]].map(([label,value])=>`<div class="stat-card"><small>${label}</small><strong>${value}</strong></div>`).join('')}</div><p class="global-2026-summary-note">${!s?'Não há linha deste jogador no CSV desta etapa. A ausência de registro não significa zero. ':''}${data.stageCoverage?.[stage]==='partial'?'Cobertura parcial: exportação incompleta. ':''}Dados agregados, sem detalhamento por queda.</p></div>`;
  panel.querySelectorAll('[data-copa-stage]').forEach(button=>button.addEventListener('click',()=>render(panel,p,button.dataset.copaStage,current)));
 }catch{if(!valid())return;panel.innerHTML='<div class="season-empty">Não foi possível carregar a Copa FF 2026. <button type="button" data-copa-retry>Tentar novamente</button></div>';panel.querySelector('[data-copa-retry]').addEventListener('click',()=>render(panel,p,stage,current));}
}
window.CFF_COPA_2026_BRIDGE={eligible,load,render};
})();
