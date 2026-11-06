'use strict';
/* Read-only preview by default. --write prepares local files for one git release. */
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const overview=require('./build-global-overview.cjs'),profiles=require('./build-global-players.cjs'),camp=require('./build-global-camp-model.cjs');
const {norm,build:buildMvp}=require('./build-mvp-summary.cjs'),s1=require('./build-s1-mvp.cjs'),s2=require('./build-s2-overview.cjs');
const ROOT=path.join(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const source=(base,keys)=>Object.fromEntries(keys.map(key=>[key,read(base+key+'.json')]));
const prefixed=(base,data)=>Object.fromEntries(Object.entries(data).map(([key,v])=>[base+key,v]));
function verifyWorld(data,standings){
 const rounds=new Map(data.dates.rounds.map(r=>[r.stage+':'+r.round,r]));
 const teams=new Map(data.teams.teams.map(t=>[norm(t.name),t]));
 const played=new Map(),dropTeams=new Map(),dayTotals=new Map();
 for(const entry of data.players.entries){
  const {stage,round,day,date,drop,roundDrop,playerId,team,kills}=entry,game=rounds.get(stage+':'+round),teamId=teams.get(norm(team))?.id;
  if(!teamId||!game||game.date!==date||game.day!==day||!playerId)throw Error('Equipe, jogador ou data incompatível com o calendário: '+JSON.stringify(entry).slice(0,180));
  if(game.groups?.length&&!game.groups.some(g=>data.groups.groups[g]?.includes(teamId)))throw Error('Equipe não joga nesta rodada: '+team+' / '+date+' R'+round);
  if(!Number.isInteger(drop)||drop<1||(roundDrop!==undefined&&(!Number.isInteger(roundDrop)||roundDrop<1||(game.matches&&roundDrop>game.matches))))throw Error('Queda inválida: '+date+' / '+team+' / '+drop);
  if(entry.matches>1)throw Error('O arquivo de quedas do Mundial precisa de registros individuais por queda: '+playerId);
  const dayKey=stage+':'+date,key=dayKey+':'+round+':'+drop;
  const bucket=played.get(dayKey)||new Set();bucket.add(key);played.set(dayKey,bucket);
  const field=dropTeams.get(key)||new Map();
  field.set(teamId,(field.get(teamId)||0)+1);dropTeams.set(key,field);
  const total=dayTotals.get(dayKey)||new Map();total.set(teamId,(total.get(teamId)||0)+kills);dayTotals.set(dayKey,total);
 }
 for(const [key,rows] of dropTeams){
  if(rows.size!==12||[...rows.values()].some(n=>n!==4))throw Error('Queda incompleta: '+key+' ('+rows.size+' equipes; esperado: 12 com 4 jogadores cada)');
 }
 const reference=standings.stage+':'+standings.date;
 const actual=dayTotals.get(reference);
 if(actual)for(const t of standings.teams)if(actual.get(t.id)!==t.kills)throw Error('Abates não batem com o placar oficial: '+t.id+' / '+reference+' ('+actual.get(t.id)+' x '+t.kills+')');
 return [...played.entries()].map(([key,rows])=>({period:key,drops:rows.size}));
}
async function prepare(edition,exportFile){
 if(edition==='global'){
  const base='ffws-global-2026/';
  const data=source(base,['stages','dates','teams','groups','players']),standingsDay1=read(base+'standings-day1.json');
  const coverage=verifyWorld(data,standingsDay1);
  const views=overview.build({...data,standingsDay1,includeMvp:true});
  const individual=profiles.build({...data,identities:read(base+'player-identities.json'),routes:read('player-data/routes.json').routes});
  const model=camp.build({...data,playerSummary:individual[base+'jogadores-resumo.json']});
  return {coverage,files:{...prefixed(base,views),...individual,[base+'camp-model.json']:model},generatedFolders:[base+'player-data',base+'player-details']};
 }
 if(edition==='s1'){
  const base='ffws-br-2026-s1/',data=s1.build({archive:read(base+'players.json'),meta:read(base+'player-meta.json'),teams:read(base+'teams.json')});
  return {coverage:[],files:{[base+'mvp-resumo.json']:data},generatedFolders:[]};
 }
 if(edition==='s2'){
  if(!exportFile)throw Error('Para a S2, informe --live=/caminho/do/export-publico.json; nenhuma consulta de rede é feita.');
  const base='ffws-br-2026-s2/',live=JSON.parse(fs.readFileSync(exportFile,'utf8'));
  const players=await s2.mergeSources(read(base+'players.json'),live,read(base+'player-name-map.json'));
  const teams=read(base+'teams.json');
  const views=s2.buildSummaries({players,live,teams,summary:read(base+'career-summary.json'),dates:read(base+'dates.json'),photos:read('player-data/photo-map.json')});
  views['mvp-resumo.json']=buildMvp({edition:'s2',stages:['classificatoria','segundaFase','final'],teams:teams.teams,roster:players.players,entries:players.entries});
  return {coverage:Object.entries(views['inicio-mvp-top10.json'].drops).map(([period,drops])=>({period,drops})),files:prefixed(base,views),generatedFolders:[]};
 }
 throw Error('Use global, s1 ou s2.');
}
async function main(){
 const args=process.argv.slice(2),edition=args.find(a=>!a.startsWith('--')),check=args.includes('--check'),write=args.includes('--write');
 if(check&&write)throw Error('Use apenas --check ou --write.');
 const result=await prepare(edition,args.find(a=>a.startsWith('--live='))?.slice(7));
 const artifacts=Object.entries(result.files).map(([name,body])=>{
  const content=typeof body==='string'?body:JSON.stringify(body)+'\n',file=path.join(ROOT,name);
  const old=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null;
  return {name,file,content,old};
 });
 const stale=result.generatedFolders.flatMap(dir=>fs.existsSync(path.join(ROOT,dir))?fs.readdirSync(path.join(ROOT,dir)).filter(name=>name.endsWith('.json')&&!Object.hasOwn(result.files,dir+'/'+name)).map(name=>dir+'/'+name):[]);
 const changed=artifacts.filter(a=>a.old!==a.content);
 for(const {period,drops} of result.coverage)console.log(period+': '+drops+' quedas verificadas');
 for(const a of artifacts.filter(a=>/mvp-resumo|selecoes-resumo/.test(a.name)))console.log(a.name+': '+Buffer.byteLength(a.content)+' bytes / '+zlib.gzipSync(a.content).length+' gzip');
 console.log(changed.length+' de '+artifacts.length+' arquivos a atualizar; '+stale.length+' arquivos gerados obsoletos.');
 for(const a of changed.slice(0,24))console.log('  '+a.name+' ('+Buffer.byteLength(a.old||'')+' → '+Buffer.byteLength(a.content)+' bytes)');
 if(changed.length>24)console.log('  … mais '+(changed.length-24)+' arquivos.');
 if(check&&(changed.length||stale.length))throw Error('Resumos fora de sincronia. Rode a preparação com --write e revise o diff.');
 if(write){
  for(const a of changed){fs.mkdirSync(path.dirname(a.file),{recursive:true});const temp=a.file+'.release-tmp';fs.writeFileSync(temp,a.content);fs.renameSync(temp,a.file);}
  for(const name of stale)fs.unlinkSync(path.join(ROOT,name));
  console.log('Preparado localmente. Revise e publique as fontes e todos os resumos no mesmo commit.');
 }
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={prepare,verifyWorld};
