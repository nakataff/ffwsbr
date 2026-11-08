const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const share=fs.readFileSync('js/global-stats-share.js','utf8');
const globalScript=fs.readFileSync('ffws-global-2026/global.js','utf8');
function runtime(){
 const win={};
 const marker='window.CFFGlobalStatsShare={mount,open};';
 assert(share.includes(marker));
 const code=share.replace(marker,
  "window.__routingTest={GROUPS,buildOpenSource,fromContext,state,setContext:value=>context=value,setSource:value=>currentSource=value};"+marker);
 vm.runInNewContext(code,{window:win,location:{origin:'https://centralfreefire.com.br'},URL,Intl,console});
 return win.__routingTest;
}
function data(){
 const teams=[
  {team:'FLUXO W7M',points:321,kills:198,booyahs:4,matches:36,
   avgPoints:8.92,avgKills:5.5,avgPosition:5,top3:10,top3Rate:10/36,top12:2},
  {team:'RRQ',points:240,kills:165,booyahs:3,matches:18,
   avgPoints:13.33,avgKills:9.17,avgPosition:4,top3:9,top3Rate:9/18,top12:1},
  {team:'LOS',points:230,kills:140,booyahs:2,matches:36,
   avgPoints:6.39,avgKills:3.89,avgPosition:6,top3:7,top3Rate:7/36,top12:3}
 ];
 const players=[
  {name:'BuTziN',team:'FLUXO W7M',kills:73,damage:31651,assists:58,matches:18,avgKills:4.06,avgDamage:1758.39,avgAssists:3.22},
  {name:'RIGBY',team:'LOS',kills:69,damage:30000,assists:64,matches:18,avgKills:3.83,avgDamage:1666.67,avgAssists:3.56}
 ];
 return {teams,players,playerShareRows:[
  {...players[0],avgPartKills:36.9,avgPartDamage:38.2,avgPartAssists:34.8},
  {...players[1],avgPartKills:35.4,avgPartDamage:35.7,avgPartAssists:39.2}
 ],records:{playerDrop:[{name:'BuTziN',team:'FLUXO W7M',kills:10,damage:4000,assists:5}],
  playerDay:[{name:'RIGBY',team:'LOS',kills:20,damage:10000,assists:13}],
  teamDrop:[{team:'RRQ',points:40,kills:24,damage:7000}],
  teamDay:[{team:'FLUXO W7M',points:110,kills:55,damage:25000}]},
  events:[{date:'2026-11-08'}],filters:{stage:'classificatoria',days:[],maps:[]},
  summary:{kills:500,drops:1},logoForTeam:()=>'',photoForPlayer:()=>''};
}
test('Every team, player and contribution heading opens its own metric, never the previous dropdown metric',()=>{
 const api=runtime();
 const groups=Array.from(api.GROUPS).filter(group=>group[1]!=='record');
 assert.equal(groups.length,6);
 const unique=new Set();
 for(const [anchor,group,entries] of groups){
  assert.equal(entries.length,3,anchor);
  for(const entry of entries){
   assert.equal(entry.length,2,'non-record descriptors have exactly two fields');
   const title=entry[0];
   const source=api.buildOpenSource(group,entry,title);
   assert.equal(source.kind,'top');
   assert.equal(source.entity,group);
   assert.equal(source.metric,entry[1],anchor+' / '+title+' must retain metric');
   assert.equal(source.title,title);
   unique.add(source.metric);
   // Test real page wiring: its rendered card must still have this id.
   assert(globalScript.includes("'"+entry[0]+"'"),'unmatched site card id '+entry[0]);
   // Player/team row buttons must match their parent card, too.
   const row={name:'Jogador',team:'Equipe',kills:10,damage:1200,avgPartKills:30};
   const selected=api.buildOpenSource(group,entry,title,row);
   assert.equal(selected.metric,entry[1],title+' row action mismatch');
   assert.equal(selected.kind,group==='team'?'team':'player');
  }
 }
 assert(unique.size>=12,'All six families must have independently selectable metrics');
});
test('The exact screenshot scenario uses TOP 3 rate, not count, and preserves the correct leader',()=>{
 const api=runtime(),context=data();api.setContext(context);
 api.state.metric='top3'; // Previous dropdown selection previously contaminated the click.
 const entry=Array.from(api.GROUPS).find(g=>g[0]==='anchor-s2-top3-equipe')[2][1];
 assert.equal(entry[1],'top3Rate');
 const source=api.buildOpenSource('team',entry,'Maior Média Top 3');
 api.setSource(source);
 const payload=api.fromContext();
 assert.equal(payload.kind,'top');
 assert.equal(payload.title,'TOP 5 · Maior Média Top 3');
 assert.equal(payload.main,'50%','9/18 is 50%, not 9 occurrences or 10 Top 3');
 assert.equal(payload.mainLabel,'Maior Média Top 3');
 assert.equal(payload.entity,'RRQ','highest top3 rate outranks most top3 appearances');
 assert.equal(payload.rows[0].score,'50%');
 assert.equal(payload.rows[1].score,'27,8%');
});
test('All record headings continue to use their three-field scope/metric descriptor',()=>{
 const api=runtime();
 for(const [anchor,group,entries] of Array.from(api.GROUPS).filter(g=>g[1]==='record')){
  assert.equal(entries.length,3);
  for(const [id,scope,metric] of entries){
   const src=api.buildOpenSource(group,[id,scope,metric],id);
   assert.equal(src.kind,'record');
   assert.deepEqual(Array.from(src.record),[scope,metric,id],anchor+' '+id);
  }
 }
});
