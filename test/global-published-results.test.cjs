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
  const bands=['pool-1','pool-2','pool-3','pool-4','repechage','eliminated'];
  const legend=[...classRoot.querySelectorAll('.ffws-global-pool-legend li')];
  assert.equal(legend.length,6);
  assert.deepEqual(legend.map(item=>item.querySelector('b').textContent),['1º–12º · Pool 1','13º–14º · Pool 2','15º–16º · Pool 3','17º–18º · Pool 4','19º–20º · Repescagem','21º–24º · Eliminação']);
  assert.deepEqual(bands.map((band,i)=>[classRoot.querySelectorAll('tbody .ffws-global-band-'+band).length,legend[i].classList.contains('ffws-global-band-'+band)]),[[12,true],[2,true],[2,true],[2,true],[2,true],[4,true]]);
  assert(statsRoot.querySelector('#anchor-s2-totais-equipe'));
  assert(statsRoot.querySelector('#anchor-s2-medias-equipe'));
  assert(statsRoot.querySelector('#anchor-s2-rec-day-team'));
  assert(!statsRoot.querySelector('#anchor-s2-totais-jogador'));
  assert.match(statsRoot.textContent,/estatísticas individuais serão exibidas/);
  assert(!statsRoot.textContent.includes('Mais Dano em uma Queda'));
  if(published===fixture){
   assert.deepEqual(Array.from(api.stageEvents('classificatoria'),e=>[e.day,e.round,e.roundDrop,e.drop]),[[1,1,1,1],[1,2,1,7]]);
   const rounds=[...statsRoot.querySelectorAll('.ffws-global-drop-round')];
   assert.equal(rounds.length,2);
   assert.match(rounds[0].querySelector('h3').textContent,/Rodada 1.*Grupos A × B.*04h00/);
   assert.match(rounds[1].querySelector('h3').textContent,/Rodada 2.*Grupos C × D.*09h00/);
   assert.equal(rounds[0].querySelector('button span').textContent,'Q1');
   assert.equal(rounds[1].querySelector('button span').textContent,'Q1');
   w.openFFWSGlobalDropReport('classificatoria:1:1');
   const report=d.querySelector('#ffws-global-drop-report-body');
   assert.match(report.querySelector('.ffws-global-drop-report-navbtn').textContent,/D1 • R2 • Q1/);
   w.openFFWSGlobalDropReport('classificatoria:1:7');
   assert.match(report.querySelector('.ffws-global-drop-report-title').textContent,/DIA 1 • RODADA 2 • QUEDA 1/);
   assert.match(report.querySelector('.ffws-global-drop-booyah').textContent,new RegExp(C.team(meta,fixture['classificatoria-2'].participants[0]).name));
   w.openFFWSGlobalDayReport('classificatoria',1);
   assert.match(report.querySelector('.ffws-global-drop-report-title').textContent,/DIA 1 • 2 QUEDAS/);
   w.closeFFWSGlobalDropReport();
   w.setFFWSGlobalStageFilter('classificatoria','period','2');
   assert.equal(classRoot.querySelectorAll('tbody tr').length,12);
   assert(!classRoot.querySelector('.ffws-global-pool-legend,.ffws-global-pool-band'));
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
