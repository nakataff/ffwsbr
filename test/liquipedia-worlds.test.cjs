const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),tick=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setTimeout(r,0));};
const ids=['ffws-2019','ffws-2021-singapore','ffws-2022-sentosa'];
test('the bounded importer reproduces exactly three reviewed worlds and independently reconciles each final',()=>{
 execFileSync('python3',['scripts/import-liquipedia-worlds.py','--check']);execFileSync('python3',['scripts/build-tournament-catalog.py','--check']);
 const expected=[['Corinthians',2300,49,8],['Phoenix Force',113,48,6],['Attack All Around',92,42,6]];
 for(const [i,id]of ids.entries()){
  const d=read('novos-torneios/'+id+'.json'),f=d.final,row=f.rows[0];assert.deepEqual([row[2],row[8],row[4],f.maps.length],expected[i]);assert(d.pilot);assert(!d.playerRanking);
  for(const s of [...d.standings,f])for(const row of s.rows){assert.equal(row[8],row[9].reduce((n,m)=>n+m[5],0));assert.equal(row[4],row[9].reduce((n,m)=>n+m[2],0));}
 }
 const m=read('novos-torneios/index.json');assert.equal(m.entries.length,m.files.length);assert.equal(m.files.filter(f=>f.startsWith('ffws-')).length,3);assert(!m.files.includes('ffws-2023.json'));
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
