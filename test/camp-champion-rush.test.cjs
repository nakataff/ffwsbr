const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),{JSDOM,VirtualConsole}=require('jsdom');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function editor(){
 const html=fs.readFileSync('admin-camp-ao-vivo.html','utf8').replace(/<script\b[\s\S]*?<\/script>/g,''),vc=new VirtualConsole();
 const dom=new JSDOM(html,{url:'https://centralfreefire.com.br/admin-camp-ao-vivo.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
 const data=JSON.parse(fs.readFileSync('admin-camp-ao-vivo/data/backup-ffws-br-2026-s2-final.json','utf8')),codes=data.selectedTeams.slice(0,2),[a,b]=codes;
 Object.assign(data.config,{tournamentName:'Copa de teste',quedas:'2',tournamentDays:1,cp:'110',finalMode:'champion',championEnabled:false,startingEnabled:true,detailMode:'detailed',v68ChampionRushUnlimited:true,cffInterfaceMode:'complete'});
 data.config.cffTournamentPhasesV1={version:1,activeId:'old-qualifier',phases:[{id:'old-qualifier',name:'Classificatória',teams:2,advance:1,days:1,firstDrops:2,laterDrops:2,format:'classic',cp:160,unlimited:false}]};
 data.selectedTeams=codes;data.startingPoints={[a]:100,[b]:0};data.drops=[{points:{[a]:11,[b]:8},placements:{[a]:2,[b]:3},kills:{[a]:2,[b]:0},top12:{},booyah:'',map:'Bermuda'},{points:{[a]:15,[b]:9},placements:{[a]:1,[b]:2},kills:{[a]:3,[b]:0},top12:{},booyah:a,map:'Purgatorio'}];
 Object.assign(data.tournamentModeV1,{enabled:true,name:'Copa de teste — Classificatória',days:[],view:'day',editingDayId:'',draftDayNumber:1,rosterCodes:codes,draftActiveCodes:codes});Object.assign(data.tournamentModeV1.config,{expectedTeams:2,teamsPerRound:2,advanceCount:1});
 w.fetch=async()=>({ok:false,json:async()=>({})});w.alert=()=>{};w.confirm=()=>true;w.document.execCommand=()=>true;w.HTMLElement.prototype.getClientRects=()=>[{}];w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.localStorage.setItem('ffws_autosave',JSON.stringify(data));w.localStorage.setItem('ffws_v41_interface_mode','complete');w.__CFF_CAMP_INITIAL_BACKUP__=data;
 let core=zlib.gunzipSync(fs.readFileSync('admin-camp-ao-vivo/app.js.gz')).toString();core=core.replace('window.onload = () => {','window.__INIT__ = () => {').replace(/window\.addEventListener\(\s*(['"])load\1\s*,/g,'window.addEventListener("cff:camp-core-ready",');
 w.eval(core);w.__INIT__();w.dispatchEvent(new w.Event('cff:camp-core-ready'));w.__CFF_CAMP_READY__=true;
 for(const f of ['enhancements.js','tournament-setup.js','final-wiki.js','workspace.js'])w.eval(fs.readFileSync('admin-camp-ao-vivo/'+f,'utf8'));
 await wait(400);w.v41SetInterfaceMode('complete');await wait(50);
 return {w,codes,data,close:()=>w.close()};
}
test('complete final honors advanced Champion Rush despite retained qualifying state and renders the transparent crown', {timeout:60000},async()=>{
 const f=await editor(),w=f.w;try{
  assert(w.document.body.classList.contains('v41-complete-mode'));assert.equal(w.isChampionPointLogicEnabled(),true);
  assert.equal(w.CFF_TOURNAMENT_SETUP.getCurrentSummary().name,'Final');assert.equal(w.document.getElementById('cff-phase-details').hidden,true);
  assert.equal(w.document.querySelectorAll('#cff-camp-mode-chooser [data-v41-mode]').length,3);assert(w.document.getElementById('cff-final-options').contains(w.document.getElementById('final-mode')));assert(w.document.getElementById('cff-final-unlimited').contains(w.document.getElementById('v68-champion-rush-unlimited')));assert(w.document.getElementById('cff-final-schedule').contains(w.document.getElementById('auto-time-panel')));assert(!w.document.getElementById('cff-final-options').hidden);assert(w.document.getElementById('cff-tournament-steps').hidden);
  w.renderSummary();w.updateChampionTableMarkers();const badge=w.document.querySelector('.v91-cp-badge');assert(badge);assert.equal(badge.getAttribute('aria-label'),'Champion Rush ativado');assert(badge.querySelector('img').src.endsWith('/assets/champion-rush/crown-booyah-v1.webp'));assert(!badge.querySelector('svg'));
  w.generateLiquipedia();assert.match(w.document.getElementById('output-code').value,/matchpoint=110/);
  const saved=w.collectBackupData(true);assert.equal(saved.config.cffInterfaceMode,'complete');assert.equal(saved.config.cffTournamentPhasesV1.phases[0].name,'Classificatória');assert.equal(saved.drops[0].points[f.codes[0]],11);
  const format=w.document.getElementById('final-mode');format.value='classic';format.dispatchEvent(new w.Event('change',{bubbles:true}));w.renderSummary();w.updateChampionTableMarkers();assert.equal(w.isChampionPointLogicEnabled(),false);assert.equal(w.document.querySelectorAll('.v91-cp-badge').length,0);
 }finally{f.close();}
});
test('restoring a complete final keeps its mode, results and threshold; tournament mode retains independent phase rules', {timeout:60000},async()=>{
 const f=await editor(),w=f.w;try{
  const saved=w.collectBackupData(true),points=saved.drops.map(d=>d.points[f.codes[0]]);w.document.getElementById('backup-input').value=JSON.stringify(saved);w.importBackup();await wait(600);
  assert(w.document.body.classList.contains('v41-complete-mode'));assert.equal(w.document.getElementById('champion-point').value,'110');assert.deepEqual(w.collectBackupData(true).drops.map(d=>d.points[f.codes[0]]),points);
  w.v41SetInterfaceMode('tournament');await wait(80);assert.equal(w.document.getElementById('cff-phase-details').hidden,false);assert.equal(w.CFF_TOURNAMENT_SETUP.getCurrentSummary().name,'Classificatória');
  assert(w.document.getElementById('cff-final-options').hidden);assert(!w.document.getElementById('cff-tournament-steps').hidden);const dateInput=w.document.getElementById('match-date');assert(w.document.getElementById('cff-current-round-settings').contains(dateInput));
  w.document.querySelector('[data-setup-open="final"]').click();const plan=w.CFF_TOURNAMENT_SETUP.getPlan();assert.equal(plan.activeId,'old-qualifier');assert.equal(plan.phases.at(-1).name,'Final');assert.equal(plan.phases.at(-1).advance,0);assert.equal(w.collectBackupData(true).drops[0].points[f.codes[0]],11);
  w.document.getElementById('champion-enabled').checked=false;assert.equal(w.isChampionPointLogicEnabled(),false);w.v41SetInterfaceMode('complete');assert.equal(w.isChampionPointLogicEnabled(),true);
  assert.equal(w.document.getElementById('match-date'),dateInput);assert(w.document.querySelector('#cff-admin-basic .setup-grid').contains(dateInput));const ids=[...w.document.querySelectorAll('[id]')].map(el=>el.id);assert.equal(ids.length,new Set(ids).size);
 }finally{f.close();}
});
test('a retained qualifying day cannot add points to the complete final or auto-register its last drop', {timeout:60000},async()=>{
 const f=await editor(),w=f.w;try{
  const data=w.collectBackupData(true),[a,b]=f.codes;
  data.tournamentModeV1.days=[{id:'old-day',number:1,name:'Classificatória',activeCodes:f.codes,restingCodes:[],stats:{[a]:{total:900},[b]:{total:800}},editorSnapshot:{config:{cp:160,finalMode:'classic'},selectedTeams:f.codes,drops:[{points:{[a]:900,[b]:800}}]}}];data.tournamentModeV1.draftDayNumber=2;
  w.document.getElementById('backup-input').value=JSON.stringify(data);w.importBackup();await wait(600);
  assert.equal(Object.keys(w.getChampionPriorTotals()).length,0);
  const model=w.CFF_FINAL_WIKI.model(w.collectBackupData(true));assert.equal(model.rows.find(r=>r.code===a).total,126);assert.equal(model.rows.find(r=>r.code===b).total,17);assert.equal(model.winner,a);
  const selector=w.document.getElementById('drop-num');selector.value='2';w.loadDropData();w.saveDrop();await wait(180);
  const restored=w.collectBackupData(true);assert.equal(restored.tournamentModeV1.days.length,1);assert.equal(restored.tournamentModeV1.days[0].stats[a].total,900);assert.equal(restored.drops[1].points[a],15);
 }finally{f.close();}
});
