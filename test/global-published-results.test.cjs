const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const C=require('../js/global-camp-core'),meta=require('../ffws-global-2026/camp-model.json');
const json=name=>JSON.parse(fs.readFileSync('ffws-global-2026/'+name+'.json','utf8'));
const makeRound=(key,kills)=>{
 const participants=C.entrants(key,{},meta),drop=C.emptyDrop(participants);
 participants.forEach((id,i)=>{drop.placements[id]=i+1;drop.kills[id]=i?0:kills;drop.points[id]=[12,9,8,7,6,5,4,3,2,1,0,0][i]+drop.kills[id];});
 drop.map='Bermuda';
 return C.validate({key,participants,drops:[drop],players:[]},meta);
};
const fixture={'classificatoria-1':makeRound('classificatoria-1',7),'classificatoria-2':makeRound('classificatoria-2',2)};
test('Classificatória and Stats share published scores, preserve session filters, and do not invent individual data',async()=>{
 const body=['classificatoria','stats'].map(page=>`<section class="page" id="ffws-global-2026-${page}"><div id="ffws-global-2026-${page}-content"></div></section>`).join('');
 const w=new JSDOM(body,{url:'https://centralfreefire.com.br/index.html',runScripts:'outside-only'}).window;
 let calls=0,fail=false,published=process.env.CFF_WORLD_LIVE_FIXTURE?JSON.parse(fs.readFileSync(process.env.CFF_WORLD_LIVE_FIXTURE)):fixture;
 try{
  w.CFF_CONFIG={firebase:{databaseURL:'https://fixture.invalid/'}};
  w.requestAnimationFrame=()=>0;
  w.fetch=async url=>{const path=String(url);if(path.includes('fixture.invalid')){calls++;assert.match(path,/\/ffwsLive\/global-2026\/rounds\.json$/);return {ok:!fail,json:async()=>published};}
   return {ok:true,json:async()=>json(path.split('/').at(-1).split('.')[0])};
  };
  const source=fs.readFileSync('ffws-global-2026/global.js','utf8').replace("  if (document.readyState === 'loading')","  window.__resultTest={state,loadData,loadLiveResults,stageEvents,renderPage,aggregateStatsTeams,statsStageEvents};\n  if (document.readyState === 'loading')");
  w.eval(source);
  const api=w.__resultTest,d=w.document;
  await api.loadData();await Promise.all([api.loadLiveResults(),api.loadLiveResults()]);await api.loadLiveResults();
  assert.equal(calls,1);
  api.renderPage('ffws-global-2026-classificatoria');api.renderPage('ffws-global-2026-stats');
  const classRoot=d.querySelector('#ffws-global-2026-classificatoria-content'),statsRoot=d.querySelector('#ffws-global-2026-stats-content');
  const winner=C.rank(Object.values(published),meta)[0];
  const first=classRoot.querySelector('tbody tr');
  assert(first.textContent.includes(winner.name));
  assert.equal(Number(first.querySelector('.ffws-global-points-col').textContent),winner.points);
  assert(statsRoot.querySelector('#anchor-s2-totais-equipe'));
  assert(statsRoot.querySelector('#anchor-s2-medias-equipe'));
  assert(statsRoot.querySelector('#anchor-s2-rec-day-team'));
  assert(!statsRoot.querySelector('#anchor-s2-totais-jogador'));
  assert.match(statsRoot.textContent,/estatísticas individuais serão exibidas/);
  assert(!statsRoot.textContent.includes('Mais Dano em uma Queda'));
  if(published===fixture){
   assert.deepEqual(Array.from(api.stageEvents('classificatoria'),e=>[e.day,e.round,e.roundDrop,e.drop]),[[1,1,1,1],[1,2,1,7]]);
   w.setFFWSGlobalStageFilter('classificatoria','period','2');
   assert.equal(classRoot.querySelectorAll('tbody tr').length,12);
   assert.equal(Number(classRoot.querySelector('tbody .ffws-global-points-col').textContent),14);
   const teams=api.aggregateStatsTeams(api.statsStageEvents('classificatoria'));
   assert.equal(teams.reduce((total,row)=>total+row.points,0),123);
   published={...fixture,'classificatoria-1':makeRound('classificatoria-1',8)};
   await api.loadLiveResults(true);
   assert.equal(api.stageEvents('classificatoria').length,2);
   assert.equal(api.stageEvents('classificatoria')[0].results[0].points,20);
  }
  fail=true;const count=api.stageEvents('classificatoria').length;
  await api.loadLiveResults(true);assert.equal(api.stageEvents('classificatoria').length,count);
 }finally{w.close();}
});
