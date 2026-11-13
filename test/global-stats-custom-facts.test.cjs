const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('js/global-stats-share.js','utf8');
function runtime(){
 const win={},marker='window.CFFGlobalStatsShare={mount,open};';
 assert(script.includes(marker));
 const expose=`window.__metricsTest={state,fromContext,resetSlots,metricValue,rankFor,customFacts,
  setContext:source=>{context=source;},setSource:source=>{currentSource=source;},
  setModal:target=>{modal=target;},settingsUI};`;
 vm.runInNewContext(script.replace(marker,expose+marker),{
  window:win,location:{origin:'https://centralfreefire.com.br'},URL,
  Intl,console
 });
 return win.__metricsTest;
}
const player=(name,team,kills,damage,assists,matches=18)=>({
 name,team,kills,damage,assists,matches,avgKills:kills/matches,
 avgDamage:damage/matches,avgAssists:assists/matches
});
function fixture(){
 const players=[
  player('Butzin','Fluxo W7M',73,31651,58),
  player('RIGBY','LOS',69,30000,60),
  player('TIED','Team Flash',73,28000,39),
  player('UNAVAILABLE','Unknown',0,0,0)
 ];
 return {
  players,
  teams:[
   {team:'Fluxo W7M',kills:198,points:321,booyahs:4,matches:18,avgKills:11,avgPoints:17.83},
   {team:'LOS',kills:180,points:302,booyahs:3,matches:18,avgKills:10,avgPoints:16.78}
  ],
  playerShareRows:[
   {...players[0],avgPartKills:36.9,avgPartDamage:37.1,avgPartAssists:35},
   {...players[1],avgPartKills:34.5,avgPartDamage:33,avgPartAssists:38}
  ],
  records:{
   playerDrop:[
    {name:'Butzin',team:'Fluxo W7M',kills:9,damage:2300,assists:2},
    {name:'Butzin',team:'Fluxo W7M',kills:6,damage:4000,assists:3},
    {name:'RIGBY',team:'LOS',kills:7,damage:2900,assists:4}
   ],
   playerDay:[
    {name:'Butzin',team:'Fluxo W7M',kills:27,damage:12500,assists:17},
    {name:'RIGBY',team:'LOS',kills:22,damage:11500,assists:15}
   ],teamDrop:[
    {team:'Fluxo W7M',kills:19,damage:8000},
    {team:'LOS',kills:17,damage:7200}
   ],teamDay:[{team:'Fluxo W7M',kills:67,damage:25000},{team:'LOS',kills:64,damage:22500}]
  },
  events:[{date:'2026-11-08'},{date:'2026-11-08'}],
  filters:{stage:'classificatoria',days:[],maps:[]},
  summary:{kills:300,drops:2},
  logoForTeam:()=>'',photoForPlayer:()=>''
 };
}
test('six player defaults preserve requested order and rank the highlighted kills in the current recorte',()=>{
 const api=runtime();api.setContext(fixture());api.setSource(null);
 api.state.kind='player';api.state.player='Butzin';api.resetSlots('player');
 const payload=api.fromContext();
 assert.deepEqual(Array.from(api.state.slotMetrics),['kills','damage','assists','matches','avgKills','avgDamage']);
 assert.deepEqual(Array.from(payload.facts.map(x=>x.label)),[
  'ABATES','DANO','ASSISTÊNCIAS','QUEDAS','ABATES / QUEDA','DANO / QUEDA'
 ]);
 assert.equal(payload.facts.length,6);
 assert.equal(payload.mainRank,1);
 assert.equal(payload.mainRankLabel,'ABATES');
 assert.equal(payload.facts[0].value,'73');
 assert.equal(payload.facts[0].rank,1);
 assert.equal(payload.facts[1].value,'31.651');
 assert.equal(payload.facts[1].rank,1);
 assert.equal(api.rankFor(fixture().players[1],'player','kills'),3,'tied leaders share #1; next is #3');
});
test('per-slot custom values use verified records and shares, with absent data displayed as dash',()=>{
 const api=runtime();const ctx=fixture();api.setContext(ctx);api.setSource(null);
 api.state.kind='player';api.state.player='Butzin';api.resetSlots('player');
 api.state.slotMetrics=['bestDropKills','avgPartKills','bestDayDamage','bestDropAssists','avgPartDamage','bestDropDamage'];
 const card=api.fromContext();
 assert.deepEqual(Array.from(card.facts.map(x=>x.value)),['9','36,9%','12.500','3','37,1%','4.000']);
 assert.equal(card.facts[0].rank,1);
 assert.equal(card.facts[1].rank,1);
 ctx.records.playerDrop=[];
 const noRecords=api.fromContext();
 assert.equal(noRecords.facts[0].value,'—');
 assert.equal(noRecords.facts[0].rank,null);
 assert.equal(noRecords.facts[3].value,'—');
 // 0 is a confirmed value; missing record is not silently converted to zero.
 assert.equal(api.metricValue({name:'UNAVAILABLE',team:'Unknown',kills:0},'player','kills'),0);
 api.state.slotMetrics=['kills','', 'assists','','avgKills','avgDamage'];
 assert.equal(api.fromContext().facts.length,4,'hidden slots are not printed');
});
test('teams can use six requested default metrics, but partial player exports never invent team damage',()=>{
 const api=runtime(),ctx=fixture();api.setContext(ctx);api.setSource(null);
 api.state.kind='team';api.state.team='Fluxo W7M';api.resetSlots('team');
 const initial=api.fromContext();
 assert.deepEqual(Array.from(initial.facts.map(x=>x.label)),[
  'ABATES','DANO','ASSISTÊNCIAS','QUEDAS','ABATES / QUEDA','DANO / QUEDA'
 ]);
 assert.equal(initial.facts[1].value,'—');
 assert.equal(initial.facts[2].value,'—');
 assert.equal(initial.facts[5].value,'—');
 // Four player appearances per team match provide a complete aggregation.
 ctx.teams[0].matches=2;
 ctx.players=[0,1,2,3].map(i=>player('Fluxo'+i,'Fluxo W7M',3,1000+i*200,5,2));
 const complete=api.fromContext();
 assert.equal(complete.facts[1].value,'5.200');
 assert.equal(complete.facts[2].value,'20');
 assert.equal(complete.facts[5].value,'2.600,00');
 assert.equal(complete.mainRank,1);
});
test('modal contains exactly six independent selectors and two opt-in ranking toggles',()=>{
 assert.match(script,/Array\.from\(\{length:6\}/);
 assert.match(script,/data-share-slot/);
 assert.match(script,/data-share-field="showMainRank"/);
 assert.match(script,/data-share-field="showFactRanks"/);
 assert.match(script,/data-share-slot\]\x27\)/);
 assert.match(script,/if\(rankShown\)/);
 assert.match(script,/if\(state\.showFactRanks&&Number\.isInteger\(fact\.rank\)/);
 assert.match(script,/const facts=payload\.facts\.slice\(0,6\)/,'all six metrics must render in 16:9 too');
});

test('record cards do not repeat the highlighted points and show daily Booyahs',()=>{
 const api=runtime(),ctx=fixture();
 ctx.records.teamDay=[{
  team:'Buriram United Esports',stage:'classificatoria',day:4,
  points:151,kills:97,booyahs:4,damage:55649,matches:6
 }];
 api.setContext(ctx);
 api.setSource({kind:'record',record:['teamDay','points','Maior pontuação em um dia']});
 const payload=api.fromContext();
 assert.equal(payload.kind,'record');
 assert.equal(payload.main,'151');
 assert.equal(payload.mainLabel,'PONTOS');
 assert.equal(payload.entity,'Buriram United Esports');
 assert.deepEqual(Array.from(payload.facts.map(f=>[f.label,f.value])),[
  ['ABATES','97'],['BOOYAHS','4'],['DANO','55.649'],['QUEDAS','6']
 ]);
 assert.equal(payload.facts.filter(f=>f.label==='PONTOS').length,0);
});
test('team record side facts exclude any main metric and preserve Booyahs per drop',()=>{
 const api=runtime(),ctx=fixture();
 ctx.records.teamDrop=[{team:'Buriram United Esports',stage:'classificatoria',day:4,
  points:34,kills:21,booyahs:1,damage:7430,matches:1}];
 api.setContext(ctx);
 for(const [metric,headline,sideLabels] of [
  ['points','34',['ABATES','BOOYAHS','DANO','QUEDAS']],
  ['kills','21',['PONTOS','BOOYAHS','DANO','QUEDAS']],
  ['damage','7.430',['ABATES','PONTOS','BOOYAHS','QUEDAS']]
 ]){
  api.setSource({kind:'record',record:['teamDrop',metric,'Recorde da queda']});
  const card=api.fromContext();
  assert.equal(card.main,headline);
  assert.deepEqual(Array.from(card.facts.map(f=>f.label)),sideLabels);
  assert.equal(card.facts.find(f=>f.label==='BOOYAHS').value,'1');
 }
});
test('published Mundial day 4 has four Buriram Booyahs and records aggregate each drop',()=>{
 const results=JSON.parse(fs.readFileSync('ffws-global-2026/stages.json','utf8'));
 const day=results.classificatoria.rounds.filter(round=>round.day===4);
 const buriram=day.flatMap(round=>round.results.filter(team=>team.team==='Buriram United Esports'));
 assert.equal(day.length,12);
 assert.equal(buriram.length,6);
 assert.equal(buriram.reduce((a,row)=>a+row.points,0),151);
 assert.equal(buriram.reduce((a,row)=>a+row.kills,0),97);
 assert.equal(buriram.reduce((a,row)=>a+row.booyah,0),4);
 const global=fs.readFileSync('ffws-global-2026/global.js','utf8');
 assert.match(global,/booyahs: number\(result\.booyahs \?\? result\.booyah/);
 assert.match(global,/out\.booyahs \+= row\.booyahs/);
});
