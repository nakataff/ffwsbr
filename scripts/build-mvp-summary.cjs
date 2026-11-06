'use strict';
// Shared offline shape: one row per player and smallest filterable period.
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const knownRole=value=>{
 const r=norm(value);
 if(r==='3'||r==='3homem')return '3';
 if(r.includes('gran')||r==='bomber')return 'GRAN';
 if(r.includes('sup')||r==='sniper')return 'SUP';
 if(r.includes('rush')||r==='rifler')return 'RUSH';
 return '';
};
const worldRole=value=>['support','suporte','3','3homem'].includes(norm(value))?'RUSH':knownRole(value);
function build({edition,stages,teams,roster,entries,periods=[]}){
 const teamIndex=new Map(),meta=new Map(),byId=new Map(),people=new Map(),players=[],rows=new Map(),seen=new Set();
 teams.forEach((t,i)=>[t.name,t.id,t.abbreviation].filter(Boolean).forEach(alias=>teamIndex.set(norm(alias),i)));
 for(const p of roster){
  const team=teamIndex.get(norm(p.team));
  if(team===undefined)continue;
  const entry={...p,team};
  if(p.id)byId.set(p.id,entry);
  for(const name of [p.name,p.sourceName,...(p.aliases||[])].filter(Boolean))meta.set(team+':'+norm(name),entry);
 }
 const world=edition==='global';
 for(const e of entries){
  const stage=stages.indexOf(e.stage),team=teamIndex.get(norm(e.team)),name=e.name||e.player;
  const day=Number(e.day),round=world?Number(e.round):0;
  if(stage<0||team===undefined||!name||!Number.isSafeInteger(day)||day<1||!Number.isSafeInteger(round)||round<(world?1:0))throw Error('Registro MVP sem fase, dia, rodada, jogador ou equipe: '+JSON.stringify(e).slice(0,180));
  const person=e.playerId?byId.get(e.playerId):meta.get(team+':'+norm(name));
  if(world&&(!person||person.team!==team||!periods.some(p=>p.stage===e.stage&&p.day===day&&p.round===round)))throw Error('Identidade ou rodada do Mundial inválida: '+name+' / '+e.stage+' '+round);
  const identity=team+':'+(person?.id||norm(person?.name||name));
  const matches=Number(e.matches??1),drop=Number(e.drop);
  if(!Number.isSafeInteger(matches)||matches<1)throw Error('Quantidade de quedas inválida: '+name);
  if(drop>0&&matches===1){
   const key=[stage,day,round,drop,identity].join(':');
   if(seen.has(key))throw Error('Jogador duplicado na mesma queda: '+name+' / '+key);
   seen.add(key);
  }
  const numbers=[e.kills,e.damage,e.assists,e.mvp??e.mvps].map(v=>Number(v??0));
  if(numbers.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('Estatística inválida: '+name);
  if(!people.has(identity)){
   const role=(world?worldRole:knownRole)(person?.roleShort||person?.role||e.roleShort||e.role);
   people.set(identity,players.length);
   players.push([person?.name||name,team,role,person?.rookie?1:0,person?.country||e.country||(world?'':'br'),person?.id||'']);
  }
  const id=people.get(identity),key=[stage,day,round,id].join(':');
  const row=rows.get(key)||[stage,day,round,id,0,0,0,0,0,null];
  row[4]+=numbers[0];row[5]+=numbers[1];row[6]+=numbers[2];row[7]+=matches;row[8]+=numbers[3];
  if(matches===1&&drop>0)row[9]=Math.max(row[9]??0,numbers[0]);
  rows.set(key,row);
 }
 return {version:2,edition,stages,teams:teams.map(t=>[t.name,t.abbreviation||t.name,t.logo||'escudo.webp']),players,rows:[...rows.values()],periods};
}
module.exports={build,norm};
