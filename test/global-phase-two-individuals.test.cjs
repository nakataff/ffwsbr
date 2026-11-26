const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=name=>JSON.parse(fs.readFileSync('ffws-global-2026/'+name+'.json','utf8'));
const players=read('players'),entries=players.entries.filter(e=>e.stage==='segundaFase'&&e.day===1);

test('phase-two individual data reconciles all six drops and keeps unavailable damage distinct from zero',()=>{
 assert.equal(entries.length,288);assert.equal(new Set(entries.map(e=>e.playerId)).size,51);assert(entries.every(e=>e.damage===null));
 for(const drop of read('stages').segundaFase.rounds.filter(e=>e.day===1))for(const team of drop.results){
  const rows=entries.filter(e=>e.roundDrop===drop.roundDrop&&e.team===team.team);
  assert.equal(rows.length,4);assert.equal(rows.reduce((sum,e)=>sum+e.kills,0),team.kills);
 }
 const summary=read('mvp-resumo');assert(summary.rows.filter(row=>row[0]===1&&row[1]===1).every(row=>row[5]===null));
 const selections=read('selecoes-resumo').days.find(day=>day.stage==='segundaFase'&&day.date==='2026-11-19');
 assert(selections.players.every(row=>row[2]===null));
});

test('MVP renders a dash for missing damage while retaining kills, assists and played drops',()=>{
 const w=new JSDOM('<main id="ranking"></main>',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}).window;
 try{
  w.eval(fs.readFileSync('js/mvp-ranking.js','utf8').replace('window.CFFMvpRanking={boot};','window.__mvp={setup,rowsOf,render,editions};window.CFFMvpRanking={boot};'));
  const api=w.__mvp,s=api.setup('global',api.editions.global,read('mvp-resumo'));s.filters.stage=new w.Set(['1']);s.filters.day=new w.Set(['1:1']);
  const rows=api.rowsOf(s);assert.equal(rows.length,51);assert(rows.every(row=>row.damage===null));
  api.render(w.document.getElementById('ranking'),s);
  for(const tr of w.document.querySelectorAll('tr.ffws-global-mvp-main-row')){assert.equal(tr.children[5].textContent,'—');assert(Number(tr.children[4].textContent)>=0);}
 }finally{w.close();}
});

test('records, team reports, player charts and CFF notes do not turn unknown damage into a statistic',()=>{
 const w=new JSDOM('<div id="ffws-global-2026-notas-content"></div>',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}).window;
 try{
  w.requestAnimationFrame=()=>0;
  const source=fs.readFileSync('ffws-global-2026/global.js','utf8').replace("  if (document.readyState === 'loading')","  window.__individual={state,aggregateStatsPlayers,statsRecordRows,s2DropReportBuild,s2DropReportDayBuild,s2DropReportTeamsHtml,s2DropReportPlayersHtml,calculateS2CffNote,calculateS2DailyCffNote,renderNotes,s2StatsEvolutionPlayerDayData,s2StatsEvolutionPlayerSeries};\n  if (document.readyState === 'loading')");
  w.eval(source);const api=w.__individual;Object.assign(api.state,{loaded:true,stages:read('stages'),dates:read('dates'),teams:read('teams').teams,players,groups:read('groups')});
  const events=api.state.stages.segundaFase.rounds.filter(e=>e.day===1).map(e=>({...e,_stage:'segundaFase',_day:1}));
  assert(api.aggregateStatsPlayers(entries).every(row=>row.damage===null&&row.avgDamage===null));
  const records=api.statsRecordRows(events,entries);assert(records.playerDrop.every(row=>row.damage===null));assert(records.teamDrop.every(row=>row.damage===null));
  const report=api.s2DropReportBuild(events[0]);assert.equal(report.totals.damage,null);assert.equal(report.leaders.playerDamage,null);
  assert(report.players.every(row=>row.damage===null&&row.note===null));
  assert(api.s2DropReportPlayersHtml(report).includes('—'));assert(api.s2DropReportTeamsHtml(report).includes('—'));
  assert.equal(api.calculateS2CffNote(5,null,3,0,1),null);assert.equal(api.calculateS2DailyCffNote(20,null,0,6,'segundaFase'),null);
  const days=api.s2StatsEvolutionPlayerDayData(events),id=days[0].players.keys().next().value;
  assert(api.s2StatsEvolutionPlayerSeries(days,id,'avgDamage').every(value=>value===null));
  api.state.notesFilters.stage=['segundaFase'];api.renderNotes();assert(w.document.body.textContent.includes('sem dados de dano não recebem Nota CFF'));
 }finally{w.close();}
});

test('daily selection keeps the half-drop minimum and renders missing damage without a fake zero',async()=>{
 const w=new JSDOM('<main></main>',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}).window;
 try{
  w.fetch=async()=>({ok:true,json:async()=>read('selecoes-resumo')});
  w.eval(fs.readFileSync('js/global-selection-lineups.js','utf8').replace('window.CFFGlobalSelections={','window.__selectionCard=selectionCard;window.CFFGlobalSelections={'));
  await w.CFFGlobalSelections.getHomeRankings();
  const lineup=w.CFFGlobalSelections.selectLineup({type:'date',stage:'segundaFase',date:'2026-11-19'},true);
  const selected=lineup.filter(p=>!p.coach);assert.equal(selected.length,4);
  assert(selected.every(p=>!p.missing&&p.matches>=3&&p.damage===null));
  const coach=lineup.find(p=>p.coach);assert.equal(coach.teamId,'p-esports');assert.equal(coach.points,101);
  w.document.querySelector('main').innerHTML=selected.map(p=>w.__selectionCard(p,{color:'#ff0000',short:'DIA'})).join('');
  assert(!w.document.body.textContent.includes('0.0K'));assert(w.document.body.textContent.includes('—'));
 }finally{w.close();}
});

test('phase-two days two, three and four retain real damage, reconcile every team/drop and expose both MVP filters',()=>{
 const summary=read('mvp-resumo'),stage=summary.stages.indexOf('segundaFase');
 for(const [day,count] of [[2,50],[3,48],[4,50]]){
  const rows=players.entries.filter(e=>e.stage==='segundaFase'&&e.day===day);
  assert.equal(rows.length,288);assert.equal(new Set(rows.map(e=>e.playerId)).size,count);
  assert(rows.every(e=>Number.isInteger(e.damage)&&e.damage>=0&&Number.isInteger(e.assists)&&e.assists>=0));
  assert.equal(new Set(rows.map(e=>e.playerId+':'+e.roundDrop)).size,288);
  for(const drop of read('stages').segundaFase.rounds.filter(e=>e.day===day))for(const team of drop.results){
   const teamRows=rows.filter(e=>e.roundDrop===drop.roundDrop&&e.team===team.team);
   assert.equal(teamRows.length,4);assert.equal(teamRows.reduce((sum,e)=>sum+e.kills,0),team.kills);
   assert(teamRows.every(e=>e.map===drop.map));
  }
  const mvp=summary.rows.filter(row=>row[0]===stage&&row[1]===day);
  assert.equal(mvp.length,count);assert(mvp.every(row=>row[5]!==null));
  assert.equal(mvp.reduce((sum,row)=>sum+row[4],0),rows.reduce((sum,row)=>sum+row.kills,0));
  assert.equal(mvp.reduce((sum,row)=>sum+row[5],0),rows.reduce((sum,row)=>sum+row.damage,0));
  const selection=read('selecoes-resumo').days.find(d=>d.stage==='segundaFase'&&d.date==='2026-11-'+(18+day));
  assert(selection);assert(selection.players.every(row=>row[2]!==null));
 }
 const yago=players.entries.find(e=>e.stage==='segundaFase'&&e.day===2&&e.roundDrop===1&&e.playerId==='los-yago');
 assert.deepEqual([yago.kills,yago.assists,yago.damage],[1,4,2268]);
 const mink=players.entries.find(e=>e.stage==='segundaFase'&&e.day===3&&e.roundDrop===1&&e.playerId==='team-flash-minkcuog');
 assert.deepEqual([mink.kills,mink.assists,mink.damage],[3,2,590]);
});


test('day four keeps substitutions as one drop and reconciles complete daily totals and profiles',()=>{
 const rows=players.entries.filter(e=>e.stage==='segundaFase'&&e.day===4);
 assert.deepEqual([rows.reduce((s,e)=>s+e.kills,0),rows.reduce((s,e)=>s+e.damage,0),rows.reduce((s,e)=>s+e.assists,0)],[576,408102,698]);
 const reserve=rows.filter(e=>e.playerId==='xprojekt-peruvi');assert.equal(reserve.length,1);assert.deepEqual([reserve[0].roundDrop,reserve[0].kills,reserve[0].damage],[6,0,6]);
 const matrix=rows.filter(e=>e.playerId==='team-inf-matrix');assert.equal(matrix.length,1);
 for(const id of ['xprojekt-peruvi','team-inf-matrix']){
  const profile=read('player-details/'+id);assert(profile.entries.some(e=>e.stage==='segundaFase'&&e.date==='2026-11-22'));
 }
 const imported=players.individualImports.find(item=>item.stage==='segundaFase'&&item.day===4);assert.equal(imported.rows,288);assert.deepEqual(imported.missingMetrics,[]);
});
