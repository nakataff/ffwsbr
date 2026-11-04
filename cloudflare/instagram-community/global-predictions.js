/* FFWS Global Finals 2026: calendário, participantes e resultados de cada sessão.
 * O servidor é a autoridade para a lista elegível e o início em Brasília.
 * Nenhum placar incompleto pode distribuir pontos.
 */
export const GLOBAL_PREDICTION_VERSION='20261104-global-palpite-v1';
export const globalKey=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const globalStart=(date,time)=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&/^\d{2}:\d{2}$/.test(time||'')
 ?Date.parse(date+'T'+time+':00-03:00'):0;
const array=v=>Array.isArray(v)?v:[];
const number=v=>Number.isFinite(Number(v))?Number(v):0;
export function globalRounds(calendar,groups,teams,roster,results={},now=Date.now()){
 const groupsById=groups?.groups||{};
 const teamsList=array(teams?.teams);
 const teamById=new Map(teamsList.map(t=>[String(t.id),t]));
 const byName=new Map();
 for(const t of teamsList)for(const s of [t.id,t.name,t.abbreviation,t.wikiName]){const k=globalKey(s);if(k)byName.set(k,t);}
 const playerList=array(roster?.players).filter(p=>p?.name&&p?.id&&p?.type!=='coach'&&!p?.left&&globalKey(p?.rosterStatus)!=='saiu');
 const official=results&&typeof results==='object'?(results.rounds||{}):{};
 return array(calendar?.rounds).filter(r=>/^(classificatoria|segundaFase|lastChance|final)$/.test(r?.stage||'')).map(r=>{
  const cutoff=globalStart(String(r.date||''),String(r.time24||''));
  const ids=array(r.teamIds||r.teams||r.participants);
  const fromGroups=array(r.groups).flatMap(id=>array(groupsById[id]));
  const selected=[...new Set((ids.length?ids:fromGroups).map(x=>String(x?.id||x)))].map(id=>teamById.get(id)||byName.get(globalKey(id))).filter(Boolean);
  // Se a etapa não tem inscritos confirmados, nunca mostrar equipes de outra rodada.
  const eligible=selected.length===Number(r.teamCount||12)||(!r.teamCount&&selected.length>=12);
  const active=eligible?selected:[];
  const activeKeys=new Set(active.map(t=>globalKey(t.name)));
  const teamOpts=active.map(t=>({id:t.id,label:t.name,short:t.abbreviation||t.name,logo:t.logo?'/'+String(t.logo).replace(/^\/+/,''):''}));
  const players=playerList.filter(p=>activeKeys.has(globalKey(p.team))).map(p=>({id:String(p.id),label:String(p.name),team:String(p.team)}));
  const base={key:String(r.key),stage:r.stage,round:Number(r.round)||1,date:String(r.date),time:String(r.time24),closesAt:cutoff,
   groups:array(r.groups),label:String(r.label||'Rodada '+r.round),ready:eligible&&players.length>0,
   teams:teamOpts,players};
  const resolved=official[base.key]?.verified===true?official[base.key]:null;
  const outcome=resolved?normalizeGlobalResult(resolved,base):autoGlobalResult(r,base,roster,results);
  const status=!base.ready?'unavailable':cutoff>now?'open':outcome.complete?'settled':'closed';
  return {...base,status,result:outcome};
 }).filter(r=>r.closesAt).sort((a,b)=>a.closesAt-b.closesAt);
}
function normalizeGlobalResult(raw,round){
 const teamIds=new Set(round.teams.map(t=>t.id)),playerIds=new Set(round.players.map(p=>p.id));
 const one=(value,allowed)=>[...new Set(array(value).filter(x=>allowed.has(String(x))).map(String))];
 const best=one(raw.best||raw.bestTeams,teamIds),worst=one(raw.worst||raw.worstTeams,teamIds);
 const mvp=one(raw.mvp||raw.mvpPlayers,playerIds);
 return {best,worst,mvp,complete:best.length>0&&worst.length>0&&mvp.length>0,verified:true};
}
function autoGlobalResult(calendarRound,round,roster,results){
 const stage=results?.stages?.[calendarRound.stage]||results?.[calendarRound.stage]||{};
 const events=array(stage.rounds).filter(e=>{
  if(e?.key===calendarRound.key||e?.roundKey===calendarRound.key)return true;
  return Number(e?.round)===Number(calendarRound.round) && (!e?.stage||e.stage===calendarRound.stage);
 });
 const byDrop=new Map();
 for(const e of events){
  const n=number(e.drop||e.number||e.queda);
  const rows=array(e.results||e.rows);
  if(n>=1&&n<=6&&rows.length>=round.teams.length)byDrop.set(n,rows);
 }
 if(byDrop.size!==6||round.teams.length!==12)return {best:[],worst:[],mvp:[],complete:false};
 const totals=new Map(round.teams.map(t=>[t.id,0]));
 const teamByName=new Map(round.teams.flatMap(t=>[t.label,t.id,t.short].filter(Boolean).map(name=>[globalKey(name),t.id])));
 for(const rows of byDrop.values()){
  const seen=new Set();
  for(const entry of rows){
   const id=teamByName.get(globalKey(entry.team||entry.equipe));
   if(!id||seen.has(id))continue;
   seen.add(id);totals.set(id,totals.get(id)+number(entry.points??entry.pontos??(number(entry.placementPoints)+number(entry.kills))));
  }
  if(seen.size!==round.teams.length)return {best:[],worst:[],mvp:[],complete:false};
 }
 const scores=[...totals.values()],hi=Math.max(...scores),lo=Math.min(...scores);
 const best=[...totals].filter(([,s])=>s===hi).map(([id])=>id),worst=[...totals].filter(([,s])=>s===lo).map(([id])=>id);
 // Entradas por queda do elenco; evita eleger MVP com apenas parte da rodada importada.
 const validTeams=new Set(round.teams.map(t=>globalKey(t.label)));
 const matching=array(roster?.entries).filter(e=>e.stage===calendarRound.stage
  && (Number(e.round)===Number(calendarRound.round)||(e.round==null&&Number(e.day)===Number(calendarRound.day)))
  && validTeams.has(globalKey(e.team)));
 const kills=new Map();const contributions=new Map();
 const rosterNames=new Map(round.players.map(p=>[globalKey(p.label)+'|'+globalKey(p.team),p.id]));
 for(const e of matching){
  const id=rosterNames.get(globalKey(e.name||e.player)+'|'+globalKey(e.team));
  if(!id)continue;
  kills.set(id,(kills.get(id)||0)+number(e.kills??e.abates));
  contributions.set(id,(contributions.get(id)||0)+1);
 }
 const aggregated=[...kills];
 // Sem entradas individuais confiáveis, melhor/pior ficam prontos, mas MVP espera validação oficial.
 const mvp=matching.length>=round.teams.length*6*3&&aggregated.length
  ?aggregated.filter(([,value])=>value===Math.max(...aggregated.map(([,value])=>value))).map(([id])=>id):[];
 return {best,worst,mvp,complete:best.length>0&&worst.length>0&&mvp.length>0,verified:false};
}
export function globalPredictionChoices(round){
 if(!round?.ready)return [];
 return [
  {id:'gf26-'+round.key+'-best',metric:'best',label:'Melhor equipe',options:round.teams},
  {id:'gf26-'+round.key+'-worst',metric:'worst',label:'Pior equipe',options:round.teams},
  {id:'gf26-'+round.key+'-mvp',metric:'mvp',label:'MVP da rodada',options:round.players},
 ].map(p=>({...p,closesAt:round.closesAt,roundKey:round.key,status:round.status,
  accepted:round.result?.[p.metric]||[],reward:5}));
}
