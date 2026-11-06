'use strict';
const fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'../ffws-br-2026-s1');
const read=name=>JSON.parse(fs.readFileSync(path.join(base,name+'.json'),'utf8'));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function build({archive,meta,teams}){
 const positions=new Map();
 for(const p of Object.values(meta.players))for(const n of [p.name,...(p.aliases||[])]){
  const k=norm(p.team)+':'+norm(n);
  if(!positions.has(k))positions.set(k,p);
 }
 const daily=new Map(),people=new Map(),roster=[];
 for(const [phase,day,,,player,team,kills,damage,assists,mvp] of archive.entries){
  const raw=archive.players[player], teamName=archive.teams[team];
  if(!raw||!teamName||!archive.stages[phase])throw Error('Invalid S1 entry');
  const key=team+':'+player;
  if(!people.has(key)){
   const p=positions.get(norm(teamName)+':'+norm(raw));
   people.set(key,roster.length);roster.push([p?.name||raw,team,p?.role||'',p?.rookie?1:0]);
  }
  const person=people.get(key),group=phase+':'+day+':'+person;
  const row=daily.get(group)||[phase,day,person,0,0,0,0,0];
  row[3]+=Number(kills)||0;row[4]+=Number(damage)||0;row[5]+=Number(assists)||0;row[6]++;row[7]+=Number(mvp)||0;
  daily.set(group,row);
 }
 return {version:1,stages:archive.stages,teams:archive.teams.map(name=>{
  const t=teams.teams.find(t=>norm(t.name)===norm(name));return [name,t?.abbreviation||name,t?.logo||'escudo.webp'];
 }),roster,days:[...daily.values()]};
}
if(require.main===module){
 const data=build({archive:read('players'),meta:read('player-meta'),teams:read('teams')});
 const output=JSON.stringify(data)+'\n',file=path.join(base,'mvp-resumo.json');
 if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==output)throw Error('Regere mvp-resumo.json');}
 else fs.writeFileSync(file,output);
 console.log(data.days.length+' totais por jogador/dia, '+Buffer.byteLength(output)+' bytes');
}
module.exports={build};
