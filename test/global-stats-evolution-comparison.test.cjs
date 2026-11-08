const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('ffws-global-2026/global.js','utf8');
const css=fs.readFileSync('ffws-global-2026/global.css','utf8');
function extract(from,to){
 const start=source.indexOf('  function '+from+'('),end=source.indexOf('  function '+to+'(',start+10);
 assert(start>=0&&end>start,'could not extract '+from);
 return source.slice(start,end);
}
const chosen=[
 ['s2StatsEvolutionTeamList','s2StatsEvolutionHtml'],
 ['s2StatsEvolutionPlayerCatalog','s2StatsEvolutionPlayerSearchHtml'],
 ['s2StatsEvolutionPlayerSearchHtml','s2StatsEvolutionPlayerSelectionsHtml'],
 ['s2StatsEvolutionPlayerDayData','s2StatsEvolutionPlayerSeries'],
 ['s2StatsEvolutionPlayerSeries','renderS2StatsEvolutionPlayerChart']
].map(pair=>extract(...pair)).join('\n');
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
const num=value=>Number(value)||0;
const roster=Array.from({length:120},(_,i)=>({name:'Jogador '+String(i+1).padStart(3,'0'),team:'Time '+(i%24+1)}));
const teams=Array.from({length:24},(_,i)=>({name:'Time '+(i+1),abbreviation:'T'+(i+1)}));
const player=(name,team,kills,damage,assists,extra={})=>({name,team,kills,damage,assists,stage:'classificatoria',...extra});
function fakePeriods(events){
 const periods=new Map();
 for(const event of events){
  const k=event._stage+':'+event._day;
  if(!periods.has(k))periods.set(k,{stage:event._stage,day:event._day,events:[]});
  periods.get(k).events.push(event);
 }
 return [...periods.values()];
}
function makeRuntime(){
 const state={teams,statsEvolution:{teams:[]},statsEvolutionPlayers:{players:[],metric:'kills',search:''}};
 const mock={
  state,normalize:norm,number:num,rosterPlayers:()=>roster,
  teamByName:name=>teams.find(t=>norm(t.name)===norm(name))||null,
  aggregateStatsTeams:events=>events.flatMap(e=>e.teamResults||[]),
  aggregateStatsPlayers:entries=>{
   const out=new Map();
   for(const e of entries){
    const key=norm(e.name)+'__'+norm(e.team);
    if(!out.has(key))out.set(key,{name:e.name,team:e.team,kills:0,damage:0});
    out.get(key).kills+=num(e.kills);out.get(key).damage+=num(e.damage);
   }
   return [...out.values()];
  },
  s2StatsEvolutionPeriods:fakePeriods,
  filteredStatsPlayerEntries:events=>events.flatMap(e=>e.players||[]),
  escapeHtml:text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  jsAttr:text=>String(text).replace(/'/g,"\\'"),
  s2StatsEvolutionPlayerOptions:[],
 };
 vm.runInNewContext(chosen+'\nthis.fn={s2StatsEvolutionTeamList,s2StatsEvolutionPlayerCatalog,s2StatsEvolutionPlayerSearchHtml,s2StatsEvolutionPlayerDayData,s2StatsEvolutionPlayerSeries};',mock);
 return mock;
}
test('team comparison offers all 24 official participants even when just five have played',()=>{
 const r=makeRuntime();
 const events=[{_stage:'classificatoria',_day:1,teamResults:teams.slice(0,5).map((team,i)=>({...team,team:team.name,points:120-i*5,kills:30-i}))}];
 const actual=Array.from(r.fn.s2StatsEvolutionTeamList(events));
 assert.equal(actual.length,24);
 assert(actual.includes('Time 24')&&actual.includes('Time 20'));
 assert.deepEqual(Array.from(r.state.statsEvolution.teams),teams.slice(0,5).map(t=>t.name));
 assert.match(css,/full 24-team comparison/);
 assert.match(css,/flex-wrap:wrap;overflow-x:visible/);
});
test('search catalog covers all 120 players, matches nick and team, and limits visible suggestions',()=>{
 const r=makeRuntime(),entries=[
  player('Jogador 024','Time 24',9,2000,3),
  player('Jogador 048','Time 24',7,1900,2),
  player('Extra nickname','Time 24',2,800,1)
 ];
 const catalog=Array.from(r.fn.s2StatsEvolutionPlayerCatalog(entries));
 assert.equal(catalog.length,121,'registered 120 plus one valid extra tournament player');
 assert.equal(catalog[0].name,'Jogador 024');
 assert(catalog.some(p=>p.name==='Jogador 120'));
 r.s2StatsEvolutionPlayerOptions=catalog;
 const byName=r.fn.s2StatsEvolutionPlayerSearchHtml('jogador 024');
 assert.match(byName,/Jogador 024/);
 assert.doesNotMatch(byName,/Jogador 025/);
 const byTeam=r.fn.s2StatsEvolutionPlayerSearchHtml('time 24');
 assert.match(byTeam,/Jogador 024/);
 const general=r.fn.s2StatsEvolutionPlayerSearchHtml('jogador');
 assert.equal((general.match(/class="ffws-global-evolution-player-result/g)||[]).length,12);
 assert.match(r.fn.s2StatsEvolutionPlayerSearchHtml(''),/Digite o nome/);
 assert(!r.fn.s2StatsEvolutionPlayerSearchHtml('').includes('Jogador 120'));
});
test('daily series honor stage/day recorte, zero values, no-data gaps, per-drop averages and contribution percentages',()=>{
 const r=makeRuntime();
 const events=[
  {_stage:'classificatoria',_day:1,players:[
   player('Alice','FX',3,1000,2,{day:1,mvp:1}),
   player('Alice','FX',4,2000,1,{day:1,mvp:0}),
   player('Bob','FX',2,500,1,{day:1,mvp:1}),
   player('Bob','FX',1,400,2,{day:1,mvp:0})
  ]},
  {_stage:'classificatoria',_day:2,players:[
   player('Alice','FX',0,0,0,{day:2,mvp:0}),
   player('Bob','FX',2,100,1,{day:2,mvp:0})
  ]},
  {_stage:'classificatoria',_day:3,players:[player('Other','LOS',3,300,1,{day:3})]},
  {_stage:'segundaFase',_day:1,players:[
   player('Alice','FX',5,1500,3,{stage:'segundaFase',day:1,mvp:1})
  ]}
 ];
 const days=Array.from(r.fn.s2StatsEvolutionPlayerDayData(events));
 assert.equal(days.length,4);
 const id='ALICE__FX';
 const get=metric=>Array.from(r.fn.s2StatsEvolutionPlayerSeries(days,id,metric));
 assert.deepEqual(get('kills'),[7,0,null,5]);
 assert.deepEqual(get('damage'),[3000,0,null,1500]);
 assert.deepEqual(get('assists'),[3,0,null,3]);
 assert.deepEqual(get('mvps'),[1,0,null,1]);
 assert.deepEqual(get('avgKills'),[3.5,0,null,5]);
 assert.deepEqual(get('avgDamage'),[1500,0,null,1500]);
 assert.deepEqual(get('avgAssists'),[1.5,0,null,3]);
 assert.deepEqual(get('avgPartKills'),[70,0,null,100]);
 assert.deepEqual(get('avgPartDamage'),[76.92,0,null,100]);
 assert.deepEqual(get('avgPartAssists'),[50,0,null,100]);
 const filtered=days.slice(0,2);
 assert.deepEqual(Array.from(r.fn.s2StatsEvolutionPlayerSeries(filtered,id,'kills')),[7,0]);
});
test('player chart keeps filters, searches and 5-player limit without loading separate data',()=>{
 assert(source.includes('s2StatsEvolutionPlayerHtml()'));
 assert(source.includes('renderS2StatsEvolutionPlayerChart(); updateGlobalStatsBackTopVisibility();'));
 assert(source.includes('state.statsEvolutionPlayers.players=selected.includes(id)?selected.filter'));
 assert(source.includes(':selected.length<5?[...selected,id]:selected;'));
 assert(source.includes('window.searchFFWSGlobalStatsEvolutionPlayer = text =>'));
 assert(source.includes('state.statsEvolutionPlayers.search=String(text||'));
 assert(!source.includes('value="matches"'),'comparison must not expose falls as a metric');
 for(const value of ['kills','damage','assists','mvps','avgKills','avgDamage','avgAssists','avgPartKills','avgPartDamage','avgPartAssists']){
  assert(source.includes("['"+value+"',")||source.includes("'"+value+"'"),value);
 }
 assert(source.includes("const events=filteredStatsEvents(),days=s2StatsEvolutionPlayerDayData(events)"));
});
