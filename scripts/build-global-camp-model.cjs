'use strict';
const fs=require('node:fs'),path=require('node:path');
const C=require('../js/global-camp-core.js');
const root=path.join(__dirname,'..'),read=name=>JSON.parse(fs.readFileSync(path.join(root,'ffws-global-2026',name+'.json'),'utf8'));
const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(obj,k)).map(k=>[k,obj[k]]));
function build({dates,groups,teams,players,stages,playerSummary}){
 const photos=new Map(playerSummary.players.map(p=>[p.id,p.photo]));
 const model={version:1,name:dates.tournament,timeZone:dates.timeZone,championPoint:dates.event.championRushPoint,groups:groups.groups,rounds:dates.rounds,
  penalties:(stages?.classificatoria?.penalties||[]).map(p=>({roundKey:'classificatoria-'+p.round,teamId:p.teamId,points:p.points,afterDrop:p.afterDrop})),
  teams:teams.teams.map(t=>pick(t,['id','name','abbreviation','wikiName','logo'])),
  finalists:stages.lastChance?.finished?(stages.final?.qualifiedTeams||[]).map(t=>t.id):[],
  players:players.players.filter(p=>p.type==='player').map(p=>({...pick(p,['id','name','team','role','type','photo','aliases']),...(photos.get(p.id)?{photo:photos.get(p.id)}:{})})),officialRounds:{}};
 // Phase-one pools already contain its final standings. Only later rounds are
 // needed to reopen scores and prepare the next lobby without a database read.
 for(const round of dates.rounds.filter(r=>r.stage!=='classificatoria')){
  const events=(stages?.[round.stage]?.rounds||[]).filter(e=>e.round===round.round&&e.date===round.date).sort((a,b)=>a.roundDrop-b.roundDrop);
  if(!events.length)continue;
  const participants=C.entrants(round.key,model.officialRounds,model);
  const drops=events.map((event,index)=>{
   if(event.roundDrop!==index+1)throw Error('Queda oficial fora de ordem: '+round.key);
   const drop={map:event.map||'',date:event.date,points:{},kills:{},placements:{},booyah:''};
   for(const row of event.results){const id=C.team(model,row.team)?.id;if(!id)throw Error('Equipe oficial desconhecida: '+row.team);drop.points[id]=row.points;drop.kills[id]=row.kills;drop.placements[id]=row.position;if(row.position===1)drop.booyah=id;}
   return drop;
  });
  model.officialRounds[round.key]=C.validate({key:round.key,participants,drops,players:[]},model);
 }
 return model;
}
if(require.main===module){
 const data=build({...Object.fromEntries(['dates','groups','teams','players','stages'].map(k=>[k,read(k)])),playerSummary:read('jogadores-resumo')});
 const file=path.join(root,'ffws-global-2026/camp-model.json'),content=JSON.stringify(data)+'\n';
 if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==content)throw Error('camp-model.json desatualizado: rode node scripts/build-global-camp-model.cjs');console.log('Modelo Global Series atualizado.')}
 else{fs.writeFileSync(file,content);console.log('Modelo Global Series gerado: '+Buffer.byteLength(content)+' bytes.');}
}
module.exports={build};
