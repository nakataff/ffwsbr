const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),zlib=require('zlib'),{JSDOM,VirtualConsole}=require('jsdom');
test('actual launcher: workflow navigation, rapid edits, save, switch drop and JSON restore', {timeout:120000},async()=>{
 const errors=[],consoleProxy=new VirtualConsole();consoleProxy.on('jsdomError',e=>{if(!/navigation|canvas|scroll/.test(e.message))errors.push(e.message);});
 const html=fs.readFileSync('admin-camp-ao-vivo.html','utf8').replace(/<script\b[\s\S]*?<\/script>/g,'');
 const d=new JSDOM(html,{url:'https://centralfreefire.com.br/admin-camp-ao-vivo.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:consoleProxy}),w=d.window,wait=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  w.fetch=async()=>({ok:false,json:async()=>({})});w.alert=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.getClientRects=()=>[{}];w.HTMLElement.prototype.scrollIntoView=()=>{};
  const backup=JSON.parse(fs.readFileSync('admin-camp-ao-vivo/data/backup-ffws-br-2026-s2-final.json','utf8'));
  backup.config.cffLaunchExtraFieldsV1={enabled:true,fields:[{id:'tot-k',kind:'totalKills'},{id:'tot-p',kind:'totalPoints'}]};backup.config.detailMode='detailed';backup.currentInputMode='detail-pos-kills';backup.drops=[];w.localStorage.setItem('ffws_autosave',JSON.stringify(backup));
  // These deferred scripts run before the asynchronously decoded legacy bundle.
  for(const f of ['placement-live.js','elimination-focus.js'])w.eval(fs.readFileSync('admin-camp-ao-vivo/'+f,'utf8'));
  let core=zlib.gunzipSync(fs.readFileSync('admin-camp-ao-vivo/app.js.gz')).toString();
  core=core.replace('window.onload = () => {','window.__INIT__ = () => {').replace(/window\.addEventListener\(\s*(['"])load\1\s*,/g,'window.addEventListener("cff:camp-core-ready",');
  w.eval(core);w.__INIT__();w.dispatchEvent(new w.Event('cff:camp-core-ready'));w.__CFF_CAMP_READY__=true;
  for(const f of ['enhancements.js','launch-extras.js','tournament-setup.js','final-wiki.js','workspace.js'])w.eval(fs.readFileSync('admin-camp-ao-vivo/'+f,'utf8'));
  await wait(350);w.document.getElementById('input-mode').value='detail-pos-kills';w.handleInputModeChange();await wait(150);
  const initial=w.document.querySelector('[data-v46-position="12"]'),code=initial.dataset.v46Team;
  const field=()=>w.document.getElementById('place-'+code),radio=n=>w.document.querySelector('[data-v46-team="'+code+'"][data-v46-position="'+n+'"]');
  const eventually=async predicate=>{const end=Date.now()+3000;while(!predicate()&&Date.now()<end)await wait(20);assert(predicate(),'visual state must settle after animation frame')};
  let clickIndex=0;const click=async n=>{const r=radio(n);r.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true}));if(clickIndex++%2===0)r.click();else r.closest('label').querySelector('span').click();await wait(120);};
  await click(12);assert.equal(field().value,'12');assert(radio(12).checked);await eventually(()=>field().closest('.team-row').classList.contains('cff-team-eliminated'));
  await click(6);assert.equal(field().value,'6');assert(radio(6).checked);assert(!radio(12).checked);
  await click(12);assert.equal(field().value,'12');assert(radio(12).checked);
  await click(12);assert.equal(field().value,'');assert(!radio(12).checked);await eventually(()=>!field().closest('.team-row').classList.contains('cff-team-eliminated'));
  field().value='12';field().dispatchEvent(new w.Event('input',{bubbles:true}));await wait(120);assert(radio(12).checked);assert.equal(field().value,'12');
  // Clear a checked radio and type immediately, before the queued clear can run.
  const pick=radio(12);pick.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true}));pick.click();field().value='12';field().dispatchEvent(new w.Event('input',{bubbles:true}));await wait(300);assert.equal(field().value,'12');assert(radio(12).checked);
  const before=field();w.document.querySelector('[data-camp-go="roster"]').click();assert(w.document.getElementById('v76-tournament-panel').classList.contains('open'));assert.equal(w.document.querySelector('[data-v76-panel="roster"]').hidden,false);w.document.querySelector('[data-v76-tab="days"]').click();assert.equal(w.document.querySelector('[data-v76-panel="days"]').hidden,false);w.document.getElementById('v76-close-panel').click();w.document.querySelector('[data-camp-go="launch"]').click();assert.equal(field(),before);assert.equal(w.document.querySelector('.teams-setup').open,false);assert(w.document.getElementById('drop-opt-elimination-focus').closest('#cff-launch-group-entry'));
  w.toggleDropSettingsPanel(true);w.document.querySelector('.cff-settings-close').click();assert(!w.document.getElementById('drop-settings-panel').classList.contains('open'));
  const kills=w.document.getElementById('kills-'+code);kills.value='3';kills.dispatchEvent(new w.Event('input',{bubbles:true}));const drop=w.document.getElementById('drop-num'),savedDrop=Number(drop.value);w.saveDrop();await wait(150);drop.value=String(savedDrop);w.loadDropData();await wait(120);assert.equal(field().value,'12');assert.equal(w.document.getElementById('kills-'+code).value,'3');assert(radio(12).checked);
  const exported=w.collectBackupData(true);assert.equal(exported.drops[savedDrop-1].placements[code],12);assert.equal(exported.drops[savedDrop-1].kills[code],3);w.autoSave(true);assert.equal(JSON.parse(w.localStorage.getItem('ffws_autosave')).drops[savedDrop-1].placements[code],12);
  w.document.getElementById('backup-input').value=JSON.stringify(exported);w.importBackup();await wait(350);drop.value=String(savedDrop);w.loadDropData();await wait(120);assert.equal(field().value,'12');assert.equal(w.document.getElementById('kills-'+code).value,'3');assert(radio(12).checked);
  w.v41SetInterfaceMode('simple');w.document.querySelector('[data-camp-go="summary"]').click();assert(!w.document.body.classList.contains('v41-simple-mode'));assert(w.document.getElementById('summary-section').open);assert.deepEqual(errors,[]);
 }finally{w.close();}
});
