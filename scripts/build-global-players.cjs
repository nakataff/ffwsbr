/* Generate edition-only profiles offline. Never resolve identities by nick alone. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{build:overview}=require('./build-global-overview.cjs');
const ROOT=path.join(__dirname,'..'),BASE='ffws-global-2026/',KEYS=['classificatoria','segundaFase','lastChance','final'],V='20261026-world-players-v1';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const sum=(rows,key)=>rows.length&&rows.every(e=>numeric(e[key])!==null)?rows.reduce((s,e)=>s+Number(e[key]),0):null;
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
function aggregate(rows){if(!rows.length)return null;const r={matches:rows.reduce((s,e)=>s+e.matches,0),kills:sum(rows,'kills'),damage:sum(rows,'damage'),assists:sum(rows,'assists')};r.average=r.kills===null||!r.matches?null:r.kills/r.matches;return r;}
function localPhoto(value){const p=String(value||'').replace(/^\//,'');return p&&!p.includes('..')&&!/[:\\]/.test(p)&&!/(silhueta|escudo)/i.test(p)&&fs.existsSync(path.join(ROOT,p))?p:'';}
function profileFor(id,routes){const r=routes[id];const file=r?.startsWith('s:')?'player-data/s2/'+r.slice(2)+'.json':r==='h'?'player-data/historical.json':({e:'ewc-2026',a:'ffws-sea-2026',l:'laff-2026-s1'}[r]?'player-data/basic/'+({e:'ewc-2026',a:'ffws-sea-2026',l:'laff-2026-s1'}[r])+'.json':'');return file?read(file).players?.[id]:null;}
function build(input){
 const {stages,dates,teams,groups,players,identities,routes}=input;
 const summaries=overview({stages,dates,teams,groups,players}),profiles=summaries['equipes-resumo.json'].teams;
 const groupOf=new Map(Object.entries(groups.groups).flatMap(([group,ids])=>ids.map(id=>[id,group])));
 const people=players.players.filter(p=>p.type!=='staff'&&!p.left&&norm(p.rosterStatus)!=='saiu');
 const used=new Set(),generalIds=new Set(),rows=[];const output={};
 for(const person of people){
  const team=teams.teams.find(t=>[t.name,t.id,t.wikiName,t.abbreviation].some(a=>norm(a)===norm(person.team)));if(!team)throw Error('Unknown roster team '+person.team);
  const identity=identities.players.filter(p=>p.teamId===team.id&&(person.id?p.id===person.id:[p.name,...(p.aliases||[])].some(a=>norm(a)===norm(person.name))));
  if(identity.length!==1)throw Error('Missing/ambiguous identity: '+person.name+' / '+team.id);
  const item=identity[0];if(!/^[a-z0-9-]{1,100}$/.test(item.id)||used.has(item.id))throw Error('Invalid/duplicate identity '+item.id);used.add(item.id);
  if(item.generalId&&(generalIds.has(item.generalId)||!routes[item.generalId]||routes[item.generalId].startsWith('f:')))throw Error('Invalid/duplicate general identity '+item.generalId);
  if(item.generalId)generalIds.add(item.generalId);
  const general=item.generalId?(input.profileFor||profileFor)(item.generalId,routes):null;
  if(item.generalId&&!general)throw Error('Missing general profile '+item.generalId);
  const entries=(players.entries||[]).filter(e=>KEYS.includes(e.stage)&&(e.playerId?e.playerId===item.id:[person.name,...(item.aliases||[])].some(name=>norm(e.name||e.player)===norm(name)))&&[team.name,team.id,team.abbreviation,team.wikiName].some(a=>norm(a)===norm(e.team))&&e.matches!==0).map(e=>{if(e.matches!=null&&(!Number.isInteger(Number(e.matches))||Number(e.matches)<1))throw Error('Invalid matches '+item.id);for(const key of ['kills','damage','assists'])if(e[key]!=null&&String(e[key]).trim()!==''&&numeric(e[key])===null)throw Error('Invalid '+key+' '+item.id);return{...e,matches:numeric(e.matches)||1}});
  const stats=Object.fromEntries(['geral',...KEYS].map(k=>[k,aggregate(entries.filter(e=>k==='geral'||e.stage===k))]));
  const row={id:item.id,name:person.name,teamId:team.id,country:person.country||'',role:person.role||'',photo:localPhoto(item.photo||person.photo||general?.photo),generalId:item.generalId||null,stats,ranks:{}};
  const details=entries.map(e=>({stage:e.stage,round:numeric(e.round)>0?Number(e.round):null,day:numeric(e.day)>0?Number(e.day):null,drop:numeric(e.drop??e.queda)>0?Number(e.drop??e.queda):null,date:e.date||'',map:e.map||e.mapa||'',matches:e.matches,kills:numeric(e.kills),damage:numeric(e.damage),assists:numeric(e.assists)}));
  const games=new Set();for(const e of details){if(e.matches!==1||e.drop===null||(e.round===null&&e.day===null))continue;const key=[e.stage,e.round,e.day,e.drop].join(':');if(games.has(key))throw Error('Duplicate game '+item.id+' '+key);games.add(key)}
  const rounds=new Map();for(const e of details){if(e.round===null&&e.day===null)continue;const id=[e.stage,e.round,e.day,e.date].join(':');if(!rounds.has(id))rounds.set(id,[]);rounds.get(id).push(e);}
  const roundRows=[...rounds.values()].map(es=>({stage:es[0].stage,round:es[0].round,day:es[0].day,date:es[0].date,...aggregate(es)}));
  const bestDrop=details.filter(e=>e.matches===1&&e.drop!==null&&e.kills!==null).sort((a,b)=>b.kills-a.kills)[0]||null,bestRound=roundRows.filter(e=>e.kills!==null).sort((a,b)=>b.kills-a.kills)[0]||null;
  const campaign=Object.fromEntries(KEYS.map(k=>{const table=summaries['inicio-resumo.json'].tables[k],match=r=>norm(r.team)===norm(team.name);return[k,{stats:profiles.find(t=>t.id===team.id)?.statsByStage[k]||null,position:k==='segundaFase'?null:table.rows.find(match)?.position||null,days:table.days.flatMap(d=>{const r=d.rows.find(match);return r?[{day:d.day,date:d.date,position:r.position,points:r.points}]:[]})}]}));
  const highlights=Object.fromEntries(['geral',...KEYS].map(stage=>{const selected=details.filter(e=>stage==='geral'||e.stage===stage),selectedRounds=roundRows.filter(e=>stage==='geral'||e.stage===stage);return[stage,{drop:selected.filter(e=>e.matches===1&&e.drop!==null&&e.kills!==null).sort((a,b)=>b.kills-a.kills)[0]||null,round:selectedRounds.filter(e=>e.kills!==null).sort((a,b)=>b.kills-a.kills)[0]||null}]}));
  const full={...row,highlights,team:{id:team.id,name:team.name,abbreviation:team.abbreviation,logo:team.logo,group:groupOf.get(team.id),qualification:team.qualification},fixtures:profiles.find(t=>t.id===team.id).fixtures,campaign,bestDrop,bestRound,rounds:roundRows,historyFile:details.length?BASE+'player-details/'+row.id+'.json':null};
  if(details.length)output[BASE+'player-details/'+row.id+'.json']={updatedAt:players.updatedAt,entries:details};
  output[BASE+'player-data/'+row.id+'.json']=full;rows.push(row);
 }
 for(const key of ['geral',...KEYS]){const ranked=rows.filter(p=>p.stats[key]?.kills!==null&&p.stats[key]?.matches>0).sort((a,b)=>b.stats[key].kills-a.stats[key].kills||(b.stats[key].damage||0)-(a.stats[key].damage||0)||(b.stats[key].assists||0)-(a.stats[key].assists||0)||a.name.localeCompare(b.name));ranked.forEach((p,i)=>p.ranks[key]=i+1);}
 for(const p of rows){const full=output[BASE+'player-data/'+p.id+'.json'];full.ranks=p.ranks;full.peers=rows.filter(q=>q.teamId===p.teamId&&q.id!==p.id).map(q=>({id:q.id,name:q.name,country:q.country,role:q.role,photo:q.photo}));full.updatedAt=players.updatedAt;}
 const manifest=Object.fromEntries(rows.filter(p=>p.generalId).map(p=>[p.generalId,p.id]));
 output[BASE+'jogadores-resumo.json']={updatedAt:players.updatedAt,teams:teams.teams.map(t=>({id:t.id,name:t.name,abbreviation:t.abbreviation,logo:t.logo,group:groupOf.get(t.id)})),players:rows};
 output['js/global-player-manifest.js']='/* Generated explicit identity links. No nickname guessing. */\nwindow.CFF_GLOBAL_2026_PLAYERS='+JSON.stringify(manifest)+';\n';
 return output;
}
function main(){const input=Object.fromEntries(['stages','dates','teams','groups','players'].map(k=>[k,read(BASE+k+'.json')]));input.identities=read(BASE+'player-identities.json');input.routes=read('player-data/routes.json').routes;const output=build(input);let bytes=0;for(const [file,data]of Object.entries(output)){const text=typeof data==='string'?data:JSON.stringify(data)+'\n';bytes+=Buffer.byteLength(text);if(process.argv.includes('--check')){if(!fs.existsSync(path.join(ROOT,file))||fs.readFileSync(path.join(ROOT,file),'utf8')!==text)throw Error('Regenerate '+file)}else{fs.mkdirSync(path.dirname(path.join(ROOT,file)),{recursive:true});fs.writeFileSync(path.join(ROOT,file),text)}}for(const dir of [BASE+'player-data',BASE+'player-details']){const folder=path.join(ROOT,dir);if(!fs.existsSync(folder))continue;for(const name of fs.readdirSync(folder)){const file=dir+'/'+name;if(!name.endsWith('.json')||Object.hasOwn(output,file))continue;if(process.argv.includes('--check'))throw Error('Stale generated file '+file);fs.unlinkSync(path.join(folder,name))}}
console.log(Object.keys(output).length+' generated files, '+bytes+' bytes; index '+Buffer.byteLength(JSON.stringify(output[BASE+'jogadores-resumo.json']))+' bytes');}
if(require.main===module)main();module.exports={build,aggregate};
