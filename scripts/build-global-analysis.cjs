'use strict';

const {norm}=require('./build-mvp-summary.cjs');
const BASE='ffws-global-2026/';
const FILE=BASE+'stats/raio-x/resumo.json';
const PHASES=['classificatoria','segundaFase','lastChance','final'];

const metric=value=>value!=null&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;

function build({players,stages,dates,teams},profileSummary){
 const teamList=profileSummary.teams;
 const teamIds=new Map(teams.teams.flatMap(team=>[team.id,team.name,team.abbreviation,team.wikiName].filter(Boolean).map(alias=>[norm(alias),team.id])));
 const photoLarge=new Map(players.players.map(person=>[person.id,person.photoLarge]));
 const people=Object.fromEntries(profileSummary.players.map(({id,name,teamId,role,photo})=>[id,{name,teamId,role,photo:photoLarge.get(id)||photo}]));
 const clubs=Object.fromEntries(teamList.map(({id,name,abbreviation,logo})=>[id,{name,abbreviation,logo}]));
 const phases=Object.fromEntries(PHASES.map(id=>[id,{name:dates.stages.find(stage=>stage.id===id)?.name||id,rounds:[]}]));
 const rounds=new Map(dates.rounds.filter(row=>phases[row.stage]).map(row=>{
  const round={number:row.round,day:row.day,date:row.date,expected:row.matches||null,drops:{},players:{},teams:{}};
  return [row.stage+':'+row.round,round];
 }));
 for(const stage of PHASES){
  for(const drop of stages[stage]?.rounds||[]){
   const round=rounds.get(stage+':'+drop.round);
   const number=Number(drop.roundDrop??drop.drop);
   if(!round||!Number.isInteger(number)||number<1||!Array.isArray(drop.results)||!drop.results.length)continue;
   round.drops[number]=drop.map||'';
   for(const result of drop.results){
    const id=teamIds.get(norm(result.team));
    if(!id)throw Error('Equipe sem cadastro no Raio-X: '+result.team);
    (round.teams[id]??=[]).push([number,metric(result.points),metric(result.kills),metric(result.booyah??result.booyahs??(result.position!=null?Number(Number(result.position)===1):null))]);
   }
  }
 }
 for(const row of players.entries){
  const round=rounds.get(row.stage+':'+row.round),number=Number(row.roundDrop??row.drop);
  if(!round||!people[row.playerId]||(row.matches!=null&&Number(row.matches)!==1)||!Number.isInteger(number)||number<1)continue;
  round.drops[number]??=row.map||'';
  (round.players[row.playerId]??=[]).push([number,metric(row.kills),metric(row.damage),metric(row.assists)]);
 }
 for(const [key,round] of rounds){
  const stage=key.split(':')[0];
  const count=Object.keys(round.drops).length;
  if(!count)continue;
  if(round.expected===null&&stages[stage]?.finished)round.expected=count;
  for(const collection of [round.players,round.teams]){
   for(const [id,rows] of Object.entries(collection)){
    rows.sort((a,b)=>a[0]-b[0]);
    if(new Set(rows.map(row=>row[0])).size!==rows.length)throw Error('Queda duplicada no Raio-X: '+key+' / '+id);
   }
  }
  phases[stage].rounds.push(round);
 }
 const phaseOneRanks=Object.fromEntries((stages.classificatoria?.rows||[]).map(row=>[teamIds.get(norm(row.team)),Number(row.position)]).filter(([id,rank])=>id&&rank>0));
 return {updatedAt:[players.updatedAt,stages.updatedAt].filter(Boolean).sort().at(-1)||'',players:people,teams:clubs,phases,phaseOneRanks};
}

module.exports={build,FILE};
