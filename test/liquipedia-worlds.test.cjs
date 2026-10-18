const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),tick=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setTimeout(r,0));};
const ids=['ffws-2019','ffws-2021-singapore','ffws-2022-sentosa'];
test('the bounded importer reproduces seven reviewed worlds and independently reconciles each final',()=>{
 execFileSync('python3',['scripts/import-liquipedia-worlds.py','--check']);execFileSync('python3',['scripts/build-tournament-catalog.py','--check']);
 const expected=[['Corinthians',2300,49,8],['Phoenix Force',113,48,6],['Attack All Around',92,42,6]];
 for(const [i,id]of ids.entries()){
  const d=read('novos-torneios/'+id+'.json'),f=d.final,row=f.rows[0];assert.deepEqual([row[2],row[8],row[4],f.maps.length],expected[i]);assert(d.pilot);assert(!d.playerRanking);
  for(const s of [...d.standings,f])for(const row of s.rows){assert.equal(row[8],row[9].reduce((n,m)=>n+m[5],0)+row[3]);assert.equal(row[4],row[9].reduce((n,m)=>n+m[2],0));}
 }
 const m=read('novos-torneios/index.json');assert.equal(m.entries.length,m.files.length);assert.equal(m.files.filter(f=>f.startsWith('ffws-')).length,7);assert(m.files.includes('ffws-2023.json'));
 assert(fs.statSync('novos-torneios/index.json').size<23000);
 const radar=read('novos-torneios/'+m.radarFile).events.find(t=>t.id==='ffws-2019');assert.equal(radar.final.rows[0][2],108); // 49 kills + modern placement points, not 2300/20.
});
test('withdrawn teams, historical aliases, staff roles, explicit ties and source prize discrepancies remain explicit',()=>{
 const d=read('novos-torneios/ffws-2021-singapore.json'),sentosa=read('novos-torneios/ffws-2022-sentosa.json');
 assert.equal(d.teams.items.length,18);assert.equal(d.withdrawnTeams.length,4);assert(d.withdrawnTeams.every(t=>!d.teams.items.some(p=>p.n===t.n)));
 const playins=d.standings[0].rows;assert.equal(playins[5][2],"God's Plan");assert.equal(playins[6][2],'vaiXourar');assert.equal(playins[5][8],playins[6][8]);
 assert.equal(d.prizeTotal,2000000);assert.equal(d.prizePool.rows.reduce((n,r)=>n+r[3],0),1970000);assert(d.dataNotes.some(n=>n.includes('1,970,000')));
 assert.equal(d.teams.items.find(t=>t.n==='LOUD').s.find(p=>p.n==='FRANK').r,'analyst');
 assert.equal(sentosa.teams.items.find(t=>t.n==='Keyd').s[0].personId,'staff-history-stark-coach');
 const ninja=read('novos-torneios/ffws-2019.json').teams.items.find(t=>t.n==='Infinity YT').p.find(p=>p.n==='Ninja');assert.equal(ninja.f,'dz');assert.equal(ninja.l,'Ninja (Algerian Player)');assert(!ninja.personId);
 const sources=fs.readFileSync('scripts/import-liquipedia-worlds.py','utf8');assert(!sources.includes('requests.get'));assert(!sources.includes('urlopen'));
});
test('truncated templates, missing matches and unresolved team aliases fail before publishing',()=>{
 const code=`import importlib.util,json,copy\ns=importlib.util.spec_from_file_location('world_import','scripts/import-liquipedia-worlds.py');m=importlib.util.module_from_spec(s);import sys;sys.modules[s.name]=m;s.loader.exec_module(m)\ntry:m.templates('{{TeamCard|team=X')\nexcept ValueError:pass\nelse:raise AssertionError('Truncation accepted')\nc=copy.deepcopy(json.load(open('imports/liquipedia-worlds/manifest.json'))['events'][0]);del c['teamAliases']['ilmn s2k']\ntry:m.compile_event(c)\nexcept (ValueError,AssertionError):pass\nelse:raise AssertionError('Unknown alias accepted')\nprint('Rejected malformed and ambiguous input')`;
 assert.match(execFileSync('python3',['-c',code],{encoding:'utf8'}),/Rejected malformed/);
});
async function fixture({delay,fail,initialId}={}){
 const html=['ot-list-view','ot-details-view','ot-grid-torneios','ot-details-tabs','ot-details-stats','ot-dynamic-container','ot-title','ot-year','ot-details-badge','ot-roster-modal','ot-roster-title','ot-roster-list','ot-radar-content','ot-count-torneios','ot-count-equipes','ot-count-premios'].map(id=>'<div id="'+id+'"></div>').join('')+'<img id="ot-details-logo"><img id="ot-roster-logo">';
 const dom=new JSDOM(html,{url:'https://centralfreefire.com.br/index.html#outros-torneios',runScripts:'outside-only'}),w=dom.window,calls=[];
 Object.assign(w,{cffInitialTournament:initialId||'',currentOtData:null,logos:{},playerAliasMap:{},AbortSignal,withCacheBuster:u=>u,scrollTo(){},loadLbffData:async()=>{calls.push('FULL_PLAYER_CATALOG');},getTeamLogo:()=> 'escudo.webp',dbTeamLogos:{},teamLogos:{},teamLogoMap:{},dbTeamAliases:{},lbffData:null,
  fetch:async url=>{const p=String(url).split('?')[0];calls.push(p);if(fail?.(p))return {ok:false,status:503};if(delay)await delay(p);if(fs.existsSync(p))return {ok:true,json:async()=>read(p),text:async()=>fs.readFileSync(p,'utf8')};return {ok:false,status:404,text:async()=>''};}});
 try{w.eval(fs.readFileSync('js/other-tournaments.min.js','utf8'));await w.loadNovosTorneios();await tick();}catch(e){w.close();throw e;}
 return {w,calls,dom,close:()=>w.close()};
}
test('cards fetch only a small manifest; opening a world fetches exactly its detail once and safely handles apostrophes',async()=>{
 const f=await fixture();try{
  assert.equal(f.calls.filter(p=>p.startsWith('novos-torneios/')).length,1);assert(!f.calls.includes('FULL_PLAYER_CATALOG'));assert(f.w.dbNovosTorneios.every(t=>t.summary));
  await Promise.all([f.w.openOtherTournament(ids[1]),f.w.otEnsureTournament(ids[1])]);assert.equal(f.calls.filter(p=>p.startsWith('novos-torneios/')).length,2);
  assert(f.w.document.querySelector('#ot-details-stats').textContent.includes('Phoenix Force'));assert(f.w.document.querySelector('#ot-details-stats').textContent.includes('18'));
  assert(!f.w.document.querySelector('#ot-details-tabs').textContent.includes('Ranking de abates'));
  await f.w.changeOtTab('standings');const rows=[...f.w.document.querySelectorAll('.ot-standings-table tbody tr')];assert(rows[5].textContent.includes("God's Plan"));assert(rows[6].textContent.includes('vaiXourar'));
  const cell=rows[5].querySelector('.ot-team-click');f.w.eval(cell.getAttribute('onclick'));assert.equal(f.w.document.querySelector('#ot-roster-title').textContent,"God's Plan");
  await f.w.changeOtTab('teams');assert(!f.w.document.querySelector('.ot-pilot-roster [data-player]'));assert(f.w.document.querySelector('a[href="/carreira.html?id=frois"]'));
  await f.w.changeOtTab('prize');assert(!f.w.document.querySelector('#ot-dynamic-container').textContent.includes('nullº'));assert(f.w.document.querySelector('#ot-dynamic-container').textContent.includes('Não disputou'));
  await f.w.openOtherTournament(ids[1]);assert.equal(f.calls.filter(p=>p.startsWith('novos-torneios/')).length,2);assert(!f.calls.includes('FULL_PLAYER_CATALOG'));
 }finally{f.close();}
});
test('a late detail response cannot replace a newer tournament or reopen a closed view',async()=>{
 let release;const pending=new Promise(r=>release=r);const f=await fixture({delay:p=>p.includes('ffws-2019.json')?pending:undefined});try{
  const first=f.w.openOtherTournament(ids[0]);await f.w.openOtherTournament(ids[2]);release();await first;assert.equal(f.w.currentOtData.id,ids[2]);assert.equal(f.w.document.querySelector('#ot-title').textContent,'FFWS 2022 Sentosa');
  f.w.closeOtherTournament();assert.equal(f.w.document.querySelector('#ot-details-view').style.display,'none');
 }finally{release();f.close();}
});
test('a failed detail offers retry and the Radar uses its compact snapshot without loading every event',async()=>{
 let failed=true;const f=await fixture({fail:p=>p.includes('ffws-2019.json')&&failed});try{
  await f.w.openOtherTournament(ids[0]);assert(f.w.document.querySelector('#ot-dynamic-container button'));failed=false;await f.w.document.querySelector('#ot-dynamic-container button').onclick();assert.equal(f.w.currentOtData.id,ids[0]);
  f.w.otMainView='radar';f.w.renderOtRadar();await tick();assert(f.w.document.querySelector('#ot-radar-content').textContent.includes('Radar Estatístico'));
  assert.equal(f.calls.filter(p=>/^novos-torneios\/radar-/.test(p)).length,1);assert(!f.calls.some(p=>p.includes('stages.json')||p.includes('firebaseio')||p.includes('radar-summary.json')));assert.equal(f.calls.filter(p=>/novos-torneios\/(?:lbff|wb)-/.test(p)).length,0);
 }finally{f.close();}
});

test('an initial tournament survives legacy query cleanup and is restored after its single lazy download',async()=>{
 const f=await fixture({initialId:'ffws-2019'});try{assert.equal(f.w.currentOtData.id,'ffws-2019');assert.equal(new URLSearchParams(f.w.location.search).get('torneio'),'ffws-2019');assert.equal(f.w.cffInitialTournament,'');assert.equal(f.w.document.querySelector('#ot-details-view').style.display,'block');assert.equal(f.calls.filter(p=>p==='novos-torneios/ffws-2019.json').length,1);f.w.closeOtherTournament();assert.equal(f.w.cffInitialTournament,'');assert(!f.w.location.search.includes('torneio'));}finally{f.close();}
});

test('the four remaining worlds preserve headstarts, withdrawals and the Champion Rush winner',()=>{
 const expected=[['ffws-2022-bangkok','EVOS Phoenix',117,8,17],['ffws-2023','Magic Squad',112,6,18],['ffws-2024','Fluxo',86,6,17],['ffws-2025','Buriram United Esports',103,7,18]];
 for(const [id,winner,total,drops,teams] of expected){const d=read('novos-torneios/'+id+'.json');assert.equal(d.final.rows[0][2],winner);assert.equal(d.final.rows[0][8],total);assert.equal(d.final.maps.length,drops);assert.equal(d.teams.items.length,teams);for(const s of [...d.standings,d.final])for(const r of s.rows)assert.equal(r[8],r[9].reduce((n,m)=>n+m[5],0)+r[3]);}
 const d23=read('novos-torneios/ffws-2023.json');assert.equal(d23.final.rows[0][3],12);assert.equal(d23.final.rows[0][7],100);assert.equal(d23.standings.filter(s=>s.type==='pointRush').length,2);assert(d23.standings[0].rows.every(r=>r[9].length===24));
 const d24=read('novos-torneios/ffws-2024.json');assert.equal(d24.withdrawnTeams[0].n,'RZX Esports');assert(d24.prizePool.rows.some(r=>r[2]==='RZX Esports'&&r[4]==='Não disputou'));assert.equal(d24.standings[0].rows[0][8],457);
 const d25=read('novos-torneios/ffws-2025.json');assert.equal(d25.final.championRush.threshold,80);assert.equal(d25.final.championRush.winningMatch,7);assert.equal(d25.clashSquad.champion,'All Gamers Global');assert.equal(d25.clashSquad.series.length,13);assert.equal(d25.clashSquad.swiss.filter(r=>r.wins===2).length,4);assert.equal(d25.awards.find(a=>a.award==='MVP da final').player,'Wassana');assert(!d25.awards.some(a=>a.player==='DEW'));assert.equal(d25.teams.items.find(t=>t.n==='Team Solid').s.find(p=>p.r==='coach').personId,'joker-coach');assert.equal(d25.teams.items.find(t=>t.n==='Rainbow7').p.find(p=>p.n==='Joker').personId,'joker');
 const manifest=read('career-data/results/manifest.json'),fluxo=read('career-data/results/'+manifest.teams.fluxow7m);const world24=fluxo.editions.find(e=>e.id==='ffwsglobalfinals2024');assert(world24.detailHref);assert.equal(world24.stages.find(s=>s.isFinal).points,86);assert.equal(world24.stages.find(s=>s.isFinal).matches,6);assert.equal(world24.stages.filter(s=>s.champion).length,1);
 const radar=read('novos-torneios/'+read('novos-torneios/index.json').radarFile);assert(radar.events.every(d=>d.standings.every(s=>!s.cols.includes('matches')&&!s.cols.includes('results'))));assert(fs.statSync('novos-torneios/'+read('novos-torneios/index.json').radarFile).size<35000);
});
test('only explicit source anomalies are accepted and the eligibility rule cannot be bypassed',()=>{
 const code=`import runpy,json,copy\nm=runpy.run_path('scripts/import-liquipedia-worlds.py');events=json.load(open('imports/liquipedia-worlds/manifest.json'))['events']\nfor year in [2024,2025]:\n c=copy.deepcopy(next(e for e in events if e['year']==year));c.pop('scoreCorrections')\n try:m['compile_event'](c)\n except AssertionError:pass\n else:raise AssertionError('Unreviewed source conflict accepted')\nprint('Unreviewed conflicts rejected')`;
 assert.match(execFileSync('python3',['-c',code],{encoding:'utf8'}),/rejected/);
 const r=read('imports/liquipedia-worlds/report.json');assert.equal(r.imported,7);assert(!r.reports.find(r=>r.id==='ffws-2025').warnings.some(n=>n.includes('Fluxo e Heavy')));assert.equal(r.reports.find(r=>r.id==='ffws-2025').corrections[0].to[0],7);
});
test('shared world UI shows initial bonus, phase drops and independent Clash Squad without extra catalogue reads',async()=>{
 const f=await fixture();try{
  await f.w.openOtherTournament('ffws-2023');assert(f.w.document.querySelector('#ot-details-tabs').textContent.includes('Knockout'));assert(!f.w.document.querySelector('#ot-details-tabs').textContent.includes('Play-ins'));assert(f.w.document.querySelector('.ot-final-table thead').textContent.includes('Inicial'));assert(f.w.document.querySelector('.ot-final-table tbody tr').textContent.includes('112'));
  await f.w.changeOtTab('worldDrops');assert.equal(f.w.document.querySelectorAll('.ot-final-table tbody tr').length,12);assert.equal(f.w.document.querySelectorAll('.ot-world-selects select')[1].options.length,36);f.w.otSelectWorldStage('point-rush-1');assert.equal(f.w.document.querySelectorAll('.ot-world-selects select')[1].options.length,6);
  await f.w.openOtherTournament('ffws-2025');assert(!f.w.document.querySelector('.ot-source-issue'));assert([...f.w.document.querySelectorAll('.ot-final-table tbody tr')].some(r=>r.textContent.includes('Heavy')&&r.querySelector('.ot-total-cell').textContent==='48'));await f.w.changeOtTab('clash');assert(f.w.document.querySelector('#ot-dynamic-container').textContent.includes('All Gamers Global'));assert(!f.w.document.querySelector('#ot-dynamic-container').textContent.includes('COMO O BÔNUS FUNCIONA'));assert(f.w.document.querySelector('#ot-dynamic-container').textContent.includes('Suíça'));assert(!f.calls.includes('FULL_PLAYER_CATALOG'));assert.equal(f.calls.filter(p=>p.startsWith('novos-torneios/')).length,3);
 }finally{f.close();}
});

test('reviewed Heavy and CLG scores reconcile placements, elimination points and final totals',()=>{
 const d=read('novos-torneios/ffws-2025.json'),row=d.final.rows.find(r=>r[2]==='Heavy'),drop=row[9].find(m=>m[0]===4);assert.deepEqual(drop,[4,7,6,4,6,10]);assert.equal(row[8],48);assert.equal(row[0],11);assert.equal(row[4],24);assert.equal(row[5],24);assert.deepEqual(row[9].find(m=>m[0]===7),[7,12,3,0,3,3]);assert.equal(d.final.rows.find(r=>r[2]==='Fluxo')[8],102);assert(!d.final.dataNotes);assert.deepEqual(d.final.rows.map(r=>r[9][3][1]).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));
 const d24=read('novos-torneios/ffws-2024.json'),ko=d24.standings.find(s=>s.stageId==='knockout'),clg=ko.rows.find(r=>r[2]==='CLG');assert.deepEqual(clg[9].find(m=>m[0]===25),[25,10,2,1,2,3]);assert.equal(clg[8],181);assert.equal(clg[4],80);assert.equal(clg[5],101);assert(!ko.dataNotes);assert.deepEqual(ko.rows.flatMap(r=>r[9].filter(m=>m[0]===25).map(m=>m[1])).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));assert(read('imports/liquipedia-worlds/manifest.json').events.every(e=>!Object.keys(e.sourceAnomalies||{}).length));
 const code=`import runpy,json,copy\nm=runpy.run_path('scripts/import-liquipedia-worlds.py');c=copy.deepcopy(json.load(open('imports/liquipedia-worlds/manifest.json'))['events'][-1]);c['scoreCorrections'][0]['from']=[8,6]\ntry:m['compile_event'](c)\nexcept AssertionError:pass\nelse:raise AssertionError('Stale correction accepted')\nprint('Stale correction rejected')`;assert.match(execFileSync('python3',['-c',code],{encoding:'utf8'}),/rejected/);
});

test('2026 archive opens tournament details with one click, without loading old WB modules',async()=>{
 const f=await fixture();try{
  const w=f.w;
  w.cffEnsureLegacy=async()=>{f.calls.push('FULL_PLAYER_CATALOG');};
  w.document.body.insertAdjacentHTML('beforeend','<div id="ot-year2026-panel"><div id="ot-year-events-panel"><div id="ot-year-events-content"></div></div><div id="ot-year-titles-panel" hidden><div id="ot-year-titles-content"></div></div><div id="ot-year-mvp-panel" hidden><div id="ot-year-mvp-content"></div></div></div><div id="ot-tournaments-panel" hidden></div><div id="ot-radar-panel" hidden></div>');
  w.setOtMainView('year2026');await tick();await tick();
  const btn=w.document.querySelector('#ot-year-events-content [data-detail]');
  assert(btn,'A tournament in 2026 should have a details button');
  const target=btn.dataset.detail;
  btn.click();await tick();await tick();
  assert.equal(w.currentOtData?.id,target,'First click must open the requested tournament');
  assert.equal(w.document.getElementById('ot-details-view').style.display,'block');
  assert.equal(f.calls.filter(p=>p==='FULL_PLAYER_CATALOG').length,0);
  assert.equal(f.calls.filter(p=>p==='novos-torneios/index.json').length,1);
 }finally{f.close();}
});

test('Copa FF 2020: published standings, final points, MVP and source-only fields are consistent',async()=>{
 const d=read('novos-torneios/copa-ff-2020.json'),manifest=read('novos-torneios/index.json');
 const card=manifest.copaEntries.find(e=>e.id==='copa-ff-2020');
 assert(card);assert.equal(card.logo,'copaff20.webp');
 assert.equal(d.teams.items.length,18);
 assert.equal(d.teams.items.reduce((n,t)=>n+t.p.length,0),104);
 assert.equal(d.teams.items.reduce((n,t)=>n+t.s.length,0),18);
 const stage=d.standings[0],final=d.final;
 assert.equal(stage.rows.length,18);
 assert.deepEqual(stage.rows.map(row=>row[3]),stage.rows.map(row=>row[4].reduce((a,b)=>a+b,0)));
 assert.equal(stage.rows[0][2],'B4 ESPORTS');
 assert.equal(stage.rows[0][3],1417);
 assert.equal(final.rows.length,12);
 assert.equal(final.maps.length,12);
 assert.equal(final.scoreMode,'pointsOnly');
 assert.deepEqual(final.matchCols,['match','total']);
 assert(final.rows.every(row=>row[6].length===12&&row[5]===row[3]+row[6].reduce((sum,m)=>sum+m[1],0)));
 assert.deepEqual(final.rows.slice(0,3).map(row=>[row[2],row[5]]),[['BLACK DRAGONS',309],['PAIN GAMING',264],['RED CANIDS',259]]);
 assert.equal(d.prizePool.rows.reduce((n,r)=>n+(r[3]||0),0),35000);
 assert.equal(d.awards[0].player,'Geerty');
 assert(d.teams.items.find(t=>t.n==='FEAR').s.some(p=>p.n==='Frois'&&p.personId==='frois'));
 const f=await fixture();try{
  assert(f.w.dbNovosTorneios.some(e=>e.id===d.id));
  await f.w.openOtherTournament(d.id);
  assert.equal(f.w.currentOtData.id,d.id);
  assert.match(f.w.document.getElementById('ot-title').textContent,/C.O.P.A. Free Fire 2020/);
  assert.match(f.w.document.getElementById('ot-details-tabs').textContent,/Final/);
  assert.match(f.w.document.getElementById('ot-dynamic-container').textContent,/309/);
  assert(!f.calls.includes('FULL_PLAYER_CATALOG'));
 }finally{f.close();}
});

test('Copa FF 2022: 24 equipes, seis dias, 8 quedas com pontos por colocação e abates',async()=>{
 const d=read('novos-torneios/copa-ff-2022.json'),manifest=read('novos-torneios/index.json');
 const card=manifest.copaEntries.find(e=>e.id===d.id);
 assert(card);assert.equal(card.logo,'copaff22.webp');
 assert.equal(card.champion,'BD VASCO');assert.equal(card.teamCount,24);
 assert.equal(d.teams.items.length,24);
 assert.equal(d.teams.items.reduce((n,t)=>n+t.p.length,0),130);
 assert.equal(d.teams.items.reduce((n,t)=>n+t.s.length,0),18);
 assert.deepEqual([...new Set(d.teams.items.map(t=>t.group))].sort(),['A','B','C','D']);
 const groups=d.standings[0];assert.equal(groups.rows.length,24);
 assert.deepEqual(groups.rounds,['Dia 1','Dia 2','Dia 3','Dia 4','Dia 5','Dia 6']);
 for(const r of groups.rows){
  assert.equal(r[4].length,6);
  assert.equal(r[4].reduce((n,v)=>n+(v??0),0),r[3]);
  assert.equal(r[4].filter(v=>v!==null).length,3);
 }
 const f=d.final;assert.equal(f.maps.length,8);assert.equal(f.rows.length,12);
 assert.equal(f.scoreMode,'placementKills');
 assert.deepEqual(f.matchCols,['match','placement','kills','placementPts','killPts','total']);
 const c=Object.fromEntries(f.cols.map((k,i)=>[k,i]));
 for(const r of f.rows){
  const matches=r[c.matches];assert.equal(matches.length,8);
  for(const m of matches){
   assert.equal(m[3],f.placementPoints[m[1]-1]);
   assert.equal(m[4],m[2]);
   assert.equal(m[5],m[3]+m[4]);
  }
  assert.equal(r[c.kills],matches.reduce((n,m)=>n+m[2],0));
  assert.equal(r[c.finalPts],matches.reduce((n,m)=>n+m[5],0));
  assert.equal(r[c.total],r[c.headstart]+r[c.finalPts]);
 }
 assert.deepEqual(f.rows.slice(0,3).map(r=>[r[c.team],r[c.total]]),[['BD VASCO',105],['LOUD',99],['TEAM LIQUID',84]]);
 assert.equal(d.prizePool.currency,'BRL');
 assert.equal(d.prizePool.rows.reduce((n,r)=>n+(r[3]||0),0),1000000);
 assert.deepEqual(d.awards.map(a=>a.player),['RAONE7','Ruan']);
 assert(d.teams.items.find(t=>t.n==='MAGIC SQUAD').s.some(p=>p.personId==='luuuking'));
 assert(d.teams.items.find(t=>t.n==='LOUD').s.some(p=>p.personId==='frois'));
 const ui=await fixture();try{
  assert(ui.w.dbNovosTorneios.some(x=>x.id===d.id));
  await ui.w.openOtherTournament(d.id);
  assert.equal(ui.w.currentOtData.id,d.id);
  assert.match(ui.w.document.getElementById('ot-title').textContent,/C.O.P.A. Free Fire 2022/);
  assert(ui.calls.includes('novos-torneios/copa-ff-2022.json'));
  assert(!ui.calls.includes('FULL_PLAYER_CATALOG'));
 }finally{ui.close();}
});
