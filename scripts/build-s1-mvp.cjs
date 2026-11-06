'use strict';
const fs=require('node:fs'),path=require('node:path'),{build:shared}=require('./build-mvp-summary.cjs');
const base=path.join(__dirname,'../ffws-br-2026-s1');
const read=name=>JSON.parse(fs.readFileSync(path.join(base,name+'.json'),'utf8'));
function build({archive,meta,teams}){
 const entries=archive.entries.map(([phase,day,drop,,player,team,kills,damage,assists,mvp])=>({stage:archive.stages[phase],day,drop,name:archive.players[player],team:archive.teams[team],kills,damage,assists,mvp}));
 return shared({edition:'s1',stages:archive.stages,teams:teams.teams,roster:Object.values(meta.players),entries});
}
if(require.main===module){
 const data=build({archive:read('players'),meta:read('player-meta'),teams:read('teams')});
 const output=JSON.stringify(data)+'\n',file=path.join(base,'mvp-resumo.json');
 if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==output)throw Error('Regere mvp-resumo.json');}
 else fs.writeFileSync(file,output);
 console.log(data.rows.length+' totais por jogador/dia, '+Buffer.byteLength(output)+' bytes');
}
module.exports={build};
