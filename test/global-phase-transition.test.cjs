const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=name=>JSON.parse(fs.readFileSync('ffws-global-2026/'+name+'.json','utf8'));
const C=require('../js/global-camp-core.js'),meta=read('camp-model'),base=require('../camp-ao-vivo/base.json');
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};

test('phase two closes with day four only, eight finalists and twelve confirmed Last Chance entrants',()=>{
 const stages=read('stages');assert.equal(stages.segundaFase.finished,true);
 const record=meta.officialRounds['segundaFase-4'];assert(record.complete);
 assert.deepEqual(C.rank([record],meta).map(r=>[r.id,r.points,r.kills,r.booyahs]),[
  ['gundynasty',119,65,2],['bru',117,63,2],['rrq',104,56,2],['los',93,58,0],['onic',78,57,0],['resurrection-esports',75,49,0],
  ['gow',67,50,0],['xprojekt',62,42,0],['blue-cheese',58,39,0],['team-inf',50,32,0],['tag',50,31,0],['btr',45,34,0]
 ]);
 const projection=read('stats/raio-x/projecao');assert.equal(projection.finalists.length,8);assert.equal(projection.days[3].forecast[0].id,'los');assert.equal(projection.days[3].forecast[1].id,'rrq');
 const backup=C.backup(base,meta,'lastChance-1'),ids=backup.selectedTeams.map(id=>C.team(meta,id).id);
 assert.deepEqual(ids,['horaa-esports','stellar-esport','rrq','los','onic','resurrection-esports','gow','xprojekt','blue-cheese','team-inf','tag','btr']);
 assert.equal(backup.config.date,'2026-11-27');assert.equal(backup.config.daySettings[0].time,'07:00');
 assert(backup.drops.every(d=>Object.values(d.points).every(v=>v===null)));
 assert(!read('players').entries.some(e=>e.stage==='segundaFase'&&e.day===4));
});

test('between-phase averages handle unequal samples, canonical maps, official opponent ranks and zero baselines',async()=>{
 const {comparePhases,phaseTeam}=await import('../ffws-global-2026/stats/raio-x/entre-fases.mjs');
 const data=read('stats/raio-x/resumo');
 const los=comparePhases(data,'los');assert.equal(los.first.matches,36);assert.equal(los.second.matches,24);
 const collective=read('stages').segundaFase.rounds.flatMap(d=>d.results.filter(r=>r.team==='LOS'));
 assert.equal(los.second.points,collective.reduce((sum,r)=>sum+r.points,0)/24);
 assert(los.metrics.points.percent<0);assert(los.second.opponentRank<los.first.opponentRank);
 assert.equal(data.phaseOneRanks.gundynasty,14);assert(!los.maps.some(m=>m.map==='Nova Terra'));
 assert.equal(comparePhases(data,'p-esports').second.matches,6);
 assert.equal(comparePhases(data,'gundynasty').second.matches,18);
 assert.equal(phaseTeam(data,'segundaFase','pe'),null);
 const fixture={teams:{a:{name:'A'},b:{name:'B'}},phaseOneRanks:{},phases:{classificatoria:{rounds:[{expected:1,day:1,drops:{1:'Nova Terra'},teams:{a:[[1,0,0,0]]}}]},segundaFase:{rounds:[{expected:1,day:1,drops:{1:'Nexterra'},teams:{a:[[1,12,0,1]]}}]}}};
 const zero=comparePhases(fixture,'a');assert.equal(zero.metrics.points.percent,null);assert.equal(zero.maps.length,1);assert.equal(zero.first.opponentRank,null);
});

test('between-phase view changes team locally, preserves focus and exposes counts for map samples',async()=>{
 const {renderBetweenPhases}=await import('../ffws-global-2026/stats/raio-x/entre-fases.mjs');
 const data=read('stats/raio-x/resumo'),w=new JSDOM('<main></main>').window,root=w.document.querySelector('main');
 try{
  const render=id=>renderBetweenPhases(root,data,id,next=>{render(next);root.querySelector('select').focus();});
  render('los');assert.match(root.textContent,/36 quedas.*24 quedas/s);assert.match(root.textContent,/Adversários mais fortes/);
  assert.equal(root.querySelectorAll('.rx-between-metrics section').length,3);assert.equal(root.querySelector('details').open,false);
  const select=root.querySelector('select');select.value='p-esports';select.dispatchEvent(new w.Event('change'));
  assert.equal(root.querySelector('h2').textContent,'P Esports');assert.match(root.textContent,/Fase 2: 6 quedas/);assert.equal(w.document.activeElement.id,'rx-between-team');
  assert(root.querySelector('tbody').textContent.includes('quedas'));assert(!root.textContent.includes('NaN'));
 }finally{w.close();}
});

for(const [at,expectedLive] of [['2026-11-22T08:59:00-03:00',0],['2026-11-22T15:00:00-03:00',1],['2026-11-23T12:00:00-03:00',0]]){
 test('home checks bounded live summary only for an unconsolidated session: '+at,async()=>{
  const sources=Object.fromEntries(['stages','dates','teams','groups','players'].map(k=>[k,read(k)]));sources.stages.segundaFase.finished=false;sources.stages.segundaFase.rounds=sources.stages.segundaFase.rounds.filter(d=>d.day<4);
  const archived=require('../scripts/build-global-overview.cjs').build(sources)['home-resumo.json'];
  const current=read('home-resumo'),calendar=read('inicio-resumo'),ids=new Map(calendar.teams.map(t=>[t.name,t.id]));
  const live={...current,roundKey:'segundaFase-4',dailyTeams:[{stage:'segundaFase',date:'2026-11-22',teams:calendar.tables.segundaFase.days[3].rows.map(r=>[ids.get(r.team),r.points,r.kills,r.booyahs,r.matches,r.lastPlace])}]};
  const w=new JSDOM('<div id="home" class="active"><div id="home-ranking-teams"><h3></h3></div><table><tbody id="home-tbody-teams"></tbody><tbody id="home-tbody-players"></tbody></table></div>',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}).window;
  let calls=0,publications=0;
  try{
   Object.defineProperty(w.document,'hidden',{get:()=>false});w.Date.now=()=>Date.parse(at);w.setInterval=()=>0;
   w.CFFGlobalSelections={renderHome(){},acceptPublishedSummary(){},async getPublishedSummary(){calls++;return live;}};
   w.fetch=async()=>({ok:true,json:async()=>structuredClone(archived)});
   w.addEventListener('cff:global-published-summary',()=>publications++);
   w.eval(fs.readFileSync('js/home-global-results.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
   assert.equal(calls,expectedLive);assert.equal(publications,expectedLive);
   const text=w.document.getElementById('home-tbody-teams').textContent;
   assert(text.includes(expectedLive?'GunDynasty':'LYON'));if(expectedLive)assert(text.includes('DIA 4'));
   assert(w.document.getElementById('home-tbody-players').textContent.includes(archived.rankings.kills[0].name));
   w.cffHomeRenderFinalStats();await settle();assert.equal(calls,expectedLive);
  }finally{w.close();}
 });
}
