import {ref,onValue} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js';
import {escapeProfile as esc,approvedImage,findOption} from './community-profile-data.js?v=20261007-profile-v2';
const VERSION='20261007-favorites-v1',STAGES={geral:'Temporada',classificatoria:'Classificatória',segundaFase:'Segunda fase',final:'Grande Final'};
const seed=['LOS','LOUD SNICKERS','FLUXO W7M','INTZ','TEAM SOLID','RISE GAMING','ALPHA7','RUSH GAMING','INFLUENCE RAGE','CPT VOX','AFROGAMES','SX TET'];
const bonus=[50,42,35,29,24,19,15,11,8,5,2,0],fields=['kills','damage','assists','matches','mvp'];
const n=v=>Number(v)||0,values=v=>Array.isArray(v)?v.filter(Boolean):Object.values(v||{}).filter(Boolean);
export const favoriteKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const clone=v=>JSON.parse(JSON.stringify(v));
function drops(stage){return Object.entries(stage?.drops||{}).flatMap(([day,rows])=>Object.entries(rows||{}).filter(([,r])=>r).map(([drop,r])=>({...r,day:n(r.day||day),drop:n(r.drop||drop)}))).sort((a,b)=>a.day-b.day||a.drop-b.drop);}
function canonical(p,aliases){const k=favoriteKey(p.name),team=favoriteKey(p.team),match=r=>[r.canonicalName,r.sourceName,...(r.aliases||[])].some(x=>favoriteKey(x)===k);return aliases.find(r=>favoriteKey(r.team)===team&&match(r))||{canonicalName:p.name,team:p.team};}
function ranked(rows,field){const list=rows.filter(r=>n(r.matches)>0).sort((a,b)=>n(b[field])-n(a[field])||n(b.booyahs)-n(a.booyahs)||n(b.kills)-n(a.kills)||String(a.name||a.team).localeCompare(String(b.name||b.team),'pt-BR'));list.forEach((r,i)=>r.rank=i+1);return rows;}
function champion(events){const pts=new Map();for(const e of events){const win=values(e.teams).find(r=>n(r.position)===1&&n(pts.get(favoriteKey(r.team)))>=160);if(win)return win.team;values(e.teams).forEach(r=>{const k=favoriteKey(r.team);pts.set(k,n(pts.get(k))+n(r.points));});}return '';}
export function buildFavoriteData(base,live){
 const stages=clone(base.stages),players=values(clone(base.stats.players));const latest={};
 for(const key of ['segundaFase','final']){
  if(live[key]===undefined||live[key]===null)continue;
  const events=drops(live[key]);latest[key]=events.at(-1)||null;
  const teamRows=seed.map((team,i)=>({team,points:key==='segundaFase'?bonus[i]:0,bonus:key==='segundaFase'?bonus[i]:0,kills:0,placementPoints:0,booyahs:0,matches:0,rank:null}));
  for(const event of events)for(const result of values(event.teams)){
   let row=teamRows.find(r=>favoriteKey(r.team)===favoriteKey(result.team));if(!row){row={team:result.team,points:0,kills:0,placementPoints:0,booyahs:0,matches:0,rank:null};teamRows.push(row);}
   row.points+=n(result.points);row.kills+=n(result.kills);row.placementPoints+=n(result.placementPoints);row.booyahs+=n(result.position)===1?1:n(result.booyah);row.matches++;
  }
  ranked(teamRows,'points');const winner=key==='final'?champion(events):'';if(winner){const row=teamRows.find(r=>favoriteKey(r.team)===favoriteKey(winner));teamRows.filter(r=>r!==row&&r.rank).sort((a,b)=>a.rank-b.rank).forEach((r,i)=>r.rank=i+2);if(row)row.rank=1;}
  stages[key]={...(stages[key]||{}),rows:teamRows,finished:key==='final'?!!winner:events.length>=36,events,champion:winner};
  players.forEach(p=>{p.stages=p.stages||{};delete p.stages[key];});
  for(const event of events)for(const p of values(event.players)){
   const c=canonical(p,base.aliases.rows||[]);let row=players.find(r=>favoriteKey(r.name)===favoriteKey(c.canonicalName)&&favoriteKey(r.team)===favoriteKey(c.team));
   if(!row){row={name:c.canonicalName,team:c.team,stages:{}};players.push(row);}
   const tally=row.stages[key]||(row.stages[key]={kills:0,damage:0,assists:0,matches:0,mvp:0});fields.forEach(f=>tally[f]+=f==='matches'?1:n(p[f]));
  }
 }
 const playerStages={};for(const stage of Object.keys(STAGES)){playerStages[stage]=players.map(p=>{const stats=stage==='geral'?Object.values(p.stages||{}).reduce((acc,s)=>{fields.forEach(f=>acc[f]+=n(s[f]));return acc;},Object.fromEntries(fields.map(f=>[f,0]))):p.stages?.[stage]||{};return {name:p.name,team:p.team,...Object.fromEntries(fields.map(f=>[f,n(stats[f])])),rank:null};});ranked(playerStages[stage],'kills');}
 for(const k of ['classificatoria','segundaFase','final'])stages[k]?.rows?.forEach(r=>{if(!('rank'in r))r.rank=n(r.matches)>0?r.position:null;});
 return {stages,playerStages,latest,updatedAt:Math.max(n(live.final?.updatedAt),n(live.segundaFase?.updatedAt)),liveReady:Object.values(live).some(x=>x!==undefined&&x!==null)};
}
export function nextAppearance(team,dates,data,now=Date.now()){
 const today=new Date(now-3*3600000).toISOString().slice(0,10),key=favoriteKey(team);
 for(const r of dates.rounds||[]){if(r.date<today||data.stages[r.stage]?.finished)continue;if(r.stage!=='classificatoria'&&!seed.some(t=>favoriteKey(t)===key))continue;if((r.restingTeams||[]).some(t=>favoriteKey(t)===key))continue;
  const day=n(r.day||r.round),events=data.stages[r.stage]?.events||[],played=events.filter(e=>e.day===day).length;
  if((r.stage==='final'&&day===1||r.stage!=='final')&&played>=6)continue;
  return {...r,playing:r.date===today&&(played>0||now>=Date.parse(r.date+'T'+(r.time24||'13:00')+':00-03:00'))};
 }
 return null;
}
function statsHtml(row,kind,stage){const metrics=kind==='player'?[['Abates',row?.kills],['Dano',row?.damage],['Assistências',row?.assists],['Quedas',row?.matches],['MVPs',row?.mvp],['Abates/queda',n(row?.matches)?(n(row.kills)/n(row.matches)).toFixed(2).replace('.',','):'—']]:[['Pontos',row?.points],['Abates',row?.kills],['BOOYAHs',row?.booyahs],['Quedas',row?.matches]];return `<div class="cff-favorite-metrics ${kind==='team'?'is-team':''}">${metrics.map(([label,value])=>`<div><strong>${typeof value==='string'?esc(value):new Intl.NumberFormat('pt-BR').format(n(value))}</strong><small>${label}</small></div>`).join('')}</div>`;}
export function createFavoriteFeed(db,getSelection){
 let base=null,live={},data=null,state='loading',error=false,active=true,stage='geral',timer,unsub=[],job;
 const hosts=()=>[...document.querySelectorAll('[data-favorite-feed]')];
 function paint(){if(!active)return;const {options,catalog,profile,items}=getSelection();
  const selections=new Map();const add=x=>{if(x)selections.set(x.id,x);};
  try{JSON.parse(profile.teamIdsJson||'[]').forEach(id=>add(findOption(options,id)));}catch{}
  add(findOption(options,profile.mainTeam));add(findOption(options,profile.favoritePlayer));
  for(const item of Object.values(items||{})){const pool=item.kind==='team'?options.teams:options.players;add(pool.find(x=>favoriteKey(x.name)===favoriteKey(item.name)&&(item.kind==='team'||!item.team||favoriteKey(findOption(options,x.team)?.name)===favoriteKey(item.team))));}
  const entries=[...selections.values()];
  for(const host of hosts()){
   host.innerHTML=`<div class="cff-profile-panel-head"><div><span class="cff-profile-eyebrow">SUA TORCIDA</span><h2>Meus favoritos</h2><p class="cff-profile-muted">FFWS Brasil 2026 S2</p></div><a class="cff-account-button" href="/conta.html?tab=favorites">Gerenciar</a></div><label class="cff-favorite-stage">Estatísticas<select aria-label="Etapa dos favoritos">${Object.entries(STAGES).map(([k,v])=>`<option value="${k}"${stage===k?' selected':''}>${v}</option>`).join('')}</select></label><div class="cff-favorite-sync" role="status">${state==='loading'?'Carregando estatísticas…':state==='error'?'Estatísticas indisponíveis agora. Tente atualizar a página.':error?'Conexão ao vivo indisponível · mostrando os últimos dados recebidos':data?.updatedAt?'Atualizado às '+new Date(data.updatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Dados publicados da temporada'}</div><div class="cff-favorite-grid">${entries.map(opt=>{
    const isPlayer=!!opt.team,team=isPlayer?findOption(options,opt.team)?.name:opt.name;
    const teamStage=stage==='geral'?(n(data?.stages.final?.rows?.find(r=>favoriteKey(r.team)===favoriteKey(team))?.matches)>0?'final':n(data?.stages.segundaFase?.rows?.find(r=>favoriteKey(r.team)===favoriteKey(team))?.matches)>0?'segundaFase':'classificatoria'):stage;
    const row=isPlayer?data?.playerStages[stage]?.find(r=>favoriteKey(r.name)===favoriteKey(opt.name)&&favoriteKey(r.team)===favoriteKey(team)):data?.stages[teamStage]?.rows?.find(r=>favoriteKey(r.team)===favoriteKey(team));
    const next=data?nextAppearance(team,base.dates,data):null,last=data?.latest[isPlayer?stage:teamStage];
    const lastResult=isPlayer?values(last?.players).find(p=>{const c=canonical(p,base.aliases.rows||[]);return favoriteKey(c.canonicalName)===favoriteKey(opt.name)&&favoriteKey(c.team)===favoriteKey(team);}):values(last?.teams).find(p=>favoriteKey(p.team)===favoriteKey(team));
    const url=isPlayer?'/jogador.html?player='+encodeURIComponent(opt.name):'/equipe.html?time='+encodeURIComponent(team);
    return `<article class="cff-favorite-card"><div class="cff-favorite-identity">${approvedImage(options,catalog,opt.id,'',opt.name)}<div><h3>${esc(opt.name)}</h3><small>${isPlayer?esc(findOption(options,opt.team)?.short)+' · '+STAGES[stage]:STAGES[teamStage]}${n(row?.matches)&&row.rank?' · '+row.rank+'º':''}</small></div></div><div class="cff-favorite-next"><small>${isPlayer?'Próxima rodada do time':'Próxima rodada'}</small><strong>${next?next.playing?'Em andamento · próxima queda':esc(next.dateLabel)+' · '+esc(next.time||'13h'):'Sem nova rodada agendada'}</strong>${next?'<span>'+esc(next.stageName)+' · '+esc(next.label)+'</span>':''}</div>${state==='done'?statsHtml(row,isPlayer?'player':'team',isPlayer?stage:teamStage):'<p>Aguardando dados.</p>'}${lastResult?`<p class="cff-favorite-last">Última queda · Dia ${last.day}, queda ${last.drop}: ${isPlayer?n(lastResult.kills)+' abates':n(lastResult.position)+'º · '+n(lastResult.points)+' pts'}</p>`:''}<a class="cff-favorite-link" href="${url}">Ver dados completos →</a></article>`;
   }).join('')||'<p class="cff-account-empty">Escolha seus times e jogadores para acompanhar por aqui.</p>'}</div>`;
   host.querySelector('select').addEventListener('change',e=>{stage=e.target.value;paint();});
  }
 }
 async function load(){job=Promise.all(['stages','player-stats','dates','player-name-map'].map(p=>fetch('/ffws-br-2026-s2/'+p+'.json?v='+VERSION,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}))).then(([stages,stats,dates,aliases])=>{if(!active)return;base={stages,stats,dates,aliases};rebuild();}).catch(()=>{if(active){state='error';paint();}});}
 function rebuild(){if(!active||!base)return;data=buildFavoriteData(base,live);state='done';paint();}
 function schedule(){clearTimeout(timer);timer=setTimeout(rebuild,120);}
 for(const s of ['segundaFase','final'])unsub.push(onValue(ref(db,'ffwsLive/2026-s2/'+s),snap=>{if(!active)return;live[s]=snap.val();error=false;schedule();},()=>{error=true;paint();}));
 load();
 return {refresh:paint,stop(){active=false;clearTimeout(timer);unsub.forEach(f=>f());hosts().forEach(h=>h.replaceChildren());}};
}
