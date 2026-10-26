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
function mount(root,p){
 const data=p.global2026;if(!data||data.generalId!==p.id||root.querySelector('[data-global-2026-summary]'))return;const hero=root.querySelector('.profile-hero');if(!hero)return;
 const s=data.stats?.geral,format=v=>v==null?'—':Number(v).toLocaleString('pt-BR'),average=s?.average==null?'—':Number(s.average).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}),section=document.createElement('section');section.className='profile-section global-2026-summary';section.setAttribute('data-global-2026-summary','');
 section.innerHTML=`<div class="global-2026-summary-head"><div><small>MUNDIAL 2026</small><h2>FFWS Global Finals 2026</h2><p>${data.failed?'Resumo temporariamente indisponível.':esc(data.team.name)+' · Grupo '+esc(data.team.group)}</p></div><a href="/ffws-global-2026/jogador?id=${encodeURIComponent(data.id)}">Ver desempenho completo →</a></div><div class="global-2026-summary-stats">${[['Abates',format(s?.kills)],['Quedas',format(s?.matches)],['Média',average]].map(([label,value])=>`<div><strong>${value}</strong><small>${label}</small></div>`).join('')}</div>${!s?'<p class="global-2026-summary-note">Os números aparecem após o cadastro das partidas do jogador.</p>':''}`;hero.after(section);
}
window.CFF_GLOBAL_2026_BRIDGE={load,merge,mount};
})();
