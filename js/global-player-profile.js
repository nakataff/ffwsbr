/* Explicit, optional Mundial bridge. Non-participants make no tournament request. */
(()=>{'use strict';
const VERSION='20261026-world-players-v1',pending=new Map(),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),n=v=>Number(v)||0;
function isEdition(e){return e.eventId==='ffws-global-2026'||String(e.edition||e.name||'').toLowerCase().replace(/[^a-z0-9]/g,'')==='ffwsglobalfinals2026'}
function load(route){const id=window.CFF_GLOBAL_2026_PLAYERS?.[route?.id];if(!id||route.profileType==='staff')return Promise.resolve(null);if(!pending.has(route.id))pending.set(route.id,fetch('/ffws-global-2026/player-data/'+id+'.json?v='+VERSION,{cache:'default'}).then(r=>{if(!r.ok)throw Error('Resumo indisponível');return r.json()}).then(data=>{if(data.id!==id||data.generalId!==route.id)throw Error('Identidade inválida');return data}).catch(()=>({id,generalId:route.id,failed:true})));return pending.get(route.id)}
function merge(p,data){
 if(!data||data.generalId!==p.id)return p;p.global2026=data;if(data.failed)return p;
 const stats=data.stats?.geral;if(!stats?.matches||!Number.isFinite(stats.kills)||!Number.isFinite(stats.matches))return p;
 const editions=Array.isArray(p.editions)?p.editions:[],old=editions.filter(isEdition),prior=Object.fromEntries(['kills','matches','damage','assists'].map(k=>[k,old.reduce((s,e)=>s+n(e[k]),0)]));
 p.editions=[...editions.filter(e=>!isEdition(e)),{eventId:'ffws-global-2026',global2026PlayerId:data.id,edition:'FFWS Global Finals 2026',team:data.team.name,kills:stats.kills,matches:stats.matches,avg:stats.average,damage:stats.damage,assists:stats.assists,status:'Participação no Mundial 2026'}];
 p.allTime={...(p.allTime||{})};for(const k of ['kills','matches','damage','assists'])if(stats[k]!==null&&stats[k]!==undefined)p.allTime[k]=Math.max(0,n(p.allTime[k])-prior[k]+stats[k]);p.allTime.avg=p.allTime.matches?p.allTime.kills/p.allTime.matches:0;return p;
}
function render(panel,p,stage='geral'){
 const data=p.global2026;if(!data||data.generalId!==p.id)return;
 const stages=[['geral','Geral'],['classificatoria','Fase 1'],['segundaFase','Fase 2'],['lastChance','Repescagem'],['final','Final']];
 if(!stages.some(([key])=>key===stage))stage='geral';
 const s=data.stats?.[stage],format=v=>v==null?'—':Number(v).toLocaleString('pt-BR'),average=s?.average==null?'—':Number(s.average).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
 panel.innerHTML=`<nav class="player-stage-tabs" aria-label="Fase do Mundial">${stages.map(([key,name])=>`<button type="button" data-global-stage="${key}" aria-pressed="${stage===key}">${name}</button>`).join('')}</nav><div class="global-2026-summary" data-global-2026-summary><div class="global-2026-summary-head"><div><small>MUNDIAL 2026</small><h2>FFWS Global Finals 2026</h2><p>${data.failed?'Resumo temporariamente indisponível.':esc(data.team.name)+' · Grupo '+esc(data.team.group)}</p></div><a href="/ffws-global-2026/jogador?id=${encodeURIComponent(data.id)}${stage==='geral'?'':'&etapa='+stage}">Ver desempenho completo →</a></div><div class="stats-grid global-2026-summary-stats">${[['Abates',format(s?.kills)],['Quedas',format(s?.matches)],['Média',average],['Dano',format(s?.damage)],['Assistências',format(s?.assists)]].map(([label,value])=>`<div class="stat-card"><small>${label}</small><strong>${value}</strong></div>`).join('')}</div>${!s?'<p class="global-2026-summary-note">Os números aparecem após o cadastro das partidas do jogador nesta fase.</p>':''}</div>`;
 panel.querySelectorAll('[data-global-stage]').forEach(button=>button.addEventListener('click',()=>render(panel,p,button.dataset.globalStage)));
}
window.CFF_GLOBAL_2026_BRIDGE={load,merge,render};
})();
