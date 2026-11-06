'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=name=>JSON.parse(fs.readFileSync(path.join(root,'ffws-global-2026',name+'.json'),'utf8'));
const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(obj,k)).map(k=>[k,obj[k]]));
function build({dates,groups,teams,players,playerSummary}){
 const photos=new Map(playerSummary.players.map(p=>[p.id,p.photo]));
 return {version:1,name:dates.tournament,timeZone:dates.timeZone,championPoint:dates.event.championRushPoint,groups:groups.groups,rounds:dates.rounds,
  teams:teams.teams.map(t=>pick(t,['id','name','abbreviation','wikiName','logo'])),
  players:players.players.filter(p=>p.type==='player').map(p=>({...pick(p,['id','name','team','role','type','photo','aliases']),...(photos.get(p.id)?{photo:photos.get(p.id)}:{})}))};
}
if(require.main===module){
 const data=build({...Object.fromEntries(['dates','groups','teams','players'].map(k=>[k,read(k)])),playerSummary:read('jogadores-resumo')});
 const file=path.join(root,'ffws-global-2026/camp-model.json'),content=JSON.stringify(data)+'\n';
 if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==content)throw Error('camp-model.json desatualizado: rode node scripts/build-global-camp-model.cjs');console.log('Modelo Global Series atualizado.')}
 else{fs.writeFileSync(file,content);console.log('Modelo Global Series gerado: '+Buffer.byteLength(content)+' bytes.');}
}
module.exports={build};
