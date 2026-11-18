'use strict';

const {norm}=require('./build-mvp-summary.cjs');
const FILE='ffws-global-2026/stats/raio-x/projecao.json';
const MODEL=1, RUNS=20000;
const PLACEMENT=[12,9,8,7,6,5,4,3,2,1,0,0];
const LOBBY=PLACEMENT.length;
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const roundTo=(value,places=1)=>Number(value.toFixed(places));

function completeDrops(round){
 if(!round||!round.expected||Object.keys(round.teams).length!==LOBBY)return [];
 const teams=Object.entries(round.teams);
 if(teams.some(([,rows])=>rows.length!==round.expected||rows.some((row,i)=>row[0]!==i+1||row.slice(1).some(value=>!Number.isFinite(value)))))return [];
 return Array.from({length:round.expected},(_,i)=>Object.fromEntries(teams.map(([id,rows])=>[id,rows[i]])));
}

function learn(analysis,batches,ranks){
 const leagueSize=ranks.size;
 const strength=id=>1-2*(ranks.get(id)-1)/(leagueSize-1);
 const samples=new Map([...ranks.keys()].map(id=>[id,[]]));
 const lobbyKills=[];
 const combat=[[],[],[]];
 for(const {round,drops,weight} of batches){
  const playersByTeam={};
  for(const [id,rows] of Object.entries(round.players)){
   const teamId=analysis.players[id]?.teamId;
   if(!teamId)continue;
   for(const [drop,kills,damage,assists] of rows){
    if(![kills,damage,assists].every(Number.isFinite))continue;
    ((playersByTeam[teamId]??={})[drop]??=[]).push([kills,damage,assists]);
   }
  }
  for(const [index,drop] of drops.entries()){
   let totalKills=0;
   const ids=Object.keys(drop);
   const lobbyStrength=ids.reduce((sum,id)=>sum+strength(id),0);
   for(const id of ids){
    const [,points,kills,booyah]=drop[id];
    const opponents=(lobbyStrength-strength(id))/(ids.length-1);
    const lineup=playersByTeam[id]?.[index+1];
    const player=lineup?.length===4?[0,1,2].map(metric=>mean(lineup.map(row=>row[metric]))):null;
    if(player)player.forEach((value,i)=>combat[i].push(value));
    samples.get(id).push({points,kills,booyah,opponents,weight,player});
    totalKills+=kills;
   }
   lobbyKills.push(totalKills);
  }
 }
 const combatMeans=combat.map(mean);
 const baseKills=mean(lobbyKills)/LOBBY;
 const basePlacement=mean(PLACEMENT);
 const skills=new Map([...samples].map(([id,rows])=>{
  const weight=rows.reduce((sum,row)=>sum+row.weight,0);
  const rate=estimate=>rows.reduce((sum,row)=>sum+row.weight*estimate(row),0)/weight;
  // Express historical rates against a neutral schedule before fitting the new lobby.
  // The coefficients are conservative fixed assumptions and are versioned with the model.
  const kills=rate(row=>row.kills+1.5*row.opponents);
  const position=rate(row=>row.points-row.kills+1.5*row.opponents);
  const combatSamples=rows.filter(row=>row.player);
  const impact=1+combatSamples.reduce((sum,row)=>{
   const relative=row.player.map((value,i)=>combatMeans[i]?value/combatMeans[i]:1);
   return sum+row.weight*(.25*relative[0]+.5*relative[1]+.25*relative[2]-1);
  },0)/(12+combatSamples.reduce((sum,row)=>sum+row.weight,0));
  return [id,{offense:Math.max(.4,.8*kills+.2*baseKills*impact),
   placement:.27*(position-basePlacement)+1.5*(rate(row=>row.booyah)-1/LOBBY)}];
 }));
 return {skills,lobbyKills};
}

function randomFrom(seed){
 return ()=>{
  seed=(seed+0x6D2B79F5)|0;
  let value=Math.imul(seed^(seed>>>15),1|seed);
  value=(value+Math.imul(value^(value>>>7),61|value))^value;
  return ((value^(value>>>14))>>>0)/4294967296;
 };
}
function percentile(histogram,p){
 let seen=0;
 for(let points=0;points<histogram.length;points++){
  seen+=histogram[points];
  if(seen>=p*RUNS)return points;
 }
 return 0;
}

function simulate(ids,matches,learned,day){
 const random=randomFrom(20261119+day);
 const logOpen=()=>-Math.log(Math.max(Number.EPSILON,random()));
 const skills=ids.map(id=>learned.skills.get(id));
 const maxPoints=matches*(Math.max(...learned.lobbyKills)+PLACEMENT[0]);
 const cutoff=new Uint32Array(maxPoints+1);
 const marks=ids.map(()=>({qualifies:0,points:0,histogram:new Uint32Array(maxPoints+1)}));
 for(let run=0;run<RUNS;run++){
  const field=skills.map(({placement,offense},index)=>{
   const form=random()+random()+random()+random()-2;
   return {index,placement:placement+.60*form,offense:offense*Math.exp(.45*form),points:0,booyahs:0,kills:0,lastPlace:0,lastPoints:0};
  });
  for(let match=0;match<matches;match++){
   const placements=field.map(team=>({team,score:team.placement-Math.log(logOpen())})).sort((a,b)=>b.score-a.score);
   const kills=learned.lobbyKills[Math.floor(random()*learned.lobbyKills.length)];
   let weight=0;
   const shares=placements.map(({team},position)=>{
    team.lastPlace=position;
    team.lastPoints=PLACEMENT[position];
    team.booyahs+=Number(position===0);
    weight+=team.offense*(1.23-.045*position);
    return weight;
   });
   for(let kill=0;kill<kills;kill++){
    const pick=random()*weight;
    const team=placements[shares.findIndex(threshold=>pick<threshold)].team;
    team.kills++;
    team.lastPoints++;
   }
   for(const team of field)team.points+=team.lastPoints;
  }
  field.sort((a,b)=>b.points-a.points||b.booyahs-a.booyahs||b.kills-a.kills||a.lastPlace-b.lastPlace||b.lastPoints-a.lastPoints);
  cutoff[field[1].points]++;
  for(const [position,team] of field.entries()){
   const mark=marks[team.index];
   mark.qualifies+=Number(position<2);
   mark.points+=team.points;
   mark.histogram[team.points]++;
  }
 }
 const forecast=marks.map((mark,i)=>({
  id:ids[i], probability:roundTo(mark.qualifies*100/RUNS,2), points:roundTo(mark.points/RUNS),
  low:percentile(mark.histogram,.10),high:percentile(mark.histogram,.90)
 })).sort((a,b)=>b.probability-a.probability||b.points-a.points||a.id.localeCompare(b.id));
 return {forecast,cutoff:percentile(cutoff,.50)};
}

function build({data,overview,analysis,previous}){
 const aliases=new Map(data.teams.teams.flatMap(team=>[team.id,team.name,team.abbreviation,team.wikiName].filter(Boolean).map(alias=>[norm(alias),team.id])));
 const idOf=name=>aliases.get(norm(name));
 const phaseOne=overview.tables.classificatoria;
 const ranks=new Map(phaseOne.rows.map(row=>[idOf(row.team),row.position]));
 const phaseOneBatches=analysis.phases.classificatoria.rounds.map(round=>({round,drops:completeDrops(round),weight:1}));
 const ready=phaseOne.finished&&ranks.size===24&&!ranks.has(undefined)&&phaseOneBatches.length===12&&phaseOneBatches.every(batch=>batch.drops.length===6);
 const schedule=data.dates.rounds.filter(round=>round.stage==='segundaFase').sort((a,b)=>a.day-b.day);
 const second=analysis.phases.segundaFase.rounds;
 const secondTable=overview.tables.segundaFase.days;
 const played=[],finalists=[],days=[];
 const strengthOf=Object.fromEntries(phaseOne.rows.filter(row=>idOf(row.team)).map(row=>{
  const id=idOf(row.team);
  const peers=phaseOneBatches.flatMap(({drops})=>drops.flatMap(drop=>drop[id]?Object.keys(drop).filter(peer=>peer!==id).map(peer=>ranks.get(peer)).filter(Number.isFinite):[]));
  return [id,{rank:row.position,opponentRank:peers.length?roundTo(mean(peers)):null}];
 }));
 for(const fixture of schedule){
  const {day,date,time24:time,matches}=fixture;
  const newcomers=fixture.seededTeams||[];
  const prior=days.at(-1);
  const record={day,date,time,matches,newcomers,forecast:[],result:[]};
  if(!ready||prior&&!prior.result.length){
   days.push(record);
   continue;
  }
  const ids=[...new Set([...newcomers,...(prior?.result.slice(2).map(row=>row.id)||[])])];
  if(ids.length!==LOBBY||ids.some(id=>!ranks.has(id))){
   days.push(record);
   continue;
  }
  const matchRound=second.find(round=>round.day===day);
  const drops=completeDrops(matchRound);
  const actual=secondTable.find(entry=>entry.day===day)?.rows||[];
  const actualIds=actual.map(row=>idOf(row.team));
  const complete=drops.length===matches&&actual.length===LOBBY&&new Set(actualIds).size===LOBBY&&
   actualIds.every(id=>ids.includes(id))&&actual.every((row,i)=>row.position===i+1&&row.matches===matches);
  const started=Boolean(matchRound?.teams&&Object.keys(matchRound.teams).length);
  const archive=previous?.days?.find(stored=>stored.day===day);
  const canPreserve=started&&archive?.forecast.length===LOBBY&&new Set(archive.forecast.map(row=>row.id)).size===LOBBY&&archive.forecast.every(row=>ids.includes(row.id));
  if(canPreserve){
   Object.assign(record,{forecast:archive.forecast,cutoff:archive.cutoff,basis:archive.basis,model:archive.model});
  }else{
   const priorBatches=played.map(batch=>({...batch,weight:2.4*.75**(day-batch.round.day-1)}));
   const learned=learn(analysis,[...phaseOneBatches,...priorBatches],ranks);
   Object.assign(record,simulate(ids,matches,learned,day),{basis:started?'retrospective':'published',model:MODEL});
  }
  record.started=started;
  if(complete){
   record.result=actual.map((row,i)=>({id:actualIds[i],rank:row.position,points:row.points}));
   finalists.push(...record.result.slice(0,2).map(row=>({...row,day})));
   played.push({round:matchRound,drops});
  }
  days.push(record);
 }
 return {model:MODEL,runs:RUNS,qualificationSlots:8,strengthOf,days,finalists};
}

module.exports={FILE,build};
