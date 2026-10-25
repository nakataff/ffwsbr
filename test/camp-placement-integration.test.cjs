const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),zlib=require('zlib'),{JSDOM,VirtualConsole}=require('jsdom');
test('actual legacy launcher handles Top 12 clicks, changes and clearing with all new launch scripts', {timeout:120000},async()=>{
 const errors=[],consoleProxy=new VirtualConsole();consoleProxy.on('jsdomError',e=>{if(!/navigation|canvas|scroll/.test(e.message))errors.push(e.message);});
 const html=fs.readFileSync('admin-camp-ao-vivo.html','utf8').replace(/<script\b[\s\S]*?<\/script>/g,'');
 const d=new JSDOM(html,{url:'https://centralfreefire.com.br/admin-camp-ao-vivo.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:consoleProxy}),w=d.window,wait=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  w.fetch=async()=>({ok:false,json:async()=>({})});w.alert=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.getClientRects=()=>[{}];w.HTMLElement.prototype.scrollIntoView=()=>{};
  const backup=JSON.parse(fs.readFileSync('admin-camp-ao-vivo/data/backup-ffws-br-2026-s2-final.json','utf8'));
  backup.config.detailMode='detailed';backup.currentInputMode='detail-pos-kills';backup.drops=[];w.localStorage.setItem('ffws_autosave',JSON.stringify(backup));
  // These deferred scripts run before the asynchronously decoded legacy bundle.
  for(const f of ['placement-live.js','elimination-focus.js'])w.eval(fs.readFileSync('admin-camp-ao-vivo/'+f,'utf8'));
  let core=zlib.gunzipSync(fs.readFileSync('admin-camp-ao-vivo/app.js.gz')).toString();
  core=core.replace('window.onload = () => {','window.__INIT__ = () => {').replace(/window\.addEventListener\(\s*(['"])load\1\s*,/g,'window.addEventListener("cff:camp-core-ready",');
  w.eval(core);w.__INIT__();w.dispatchEvent(new w.Event('cff:camp-core-ready'));w.__CFF_CAMP_READY__=true;
  for(const f of ['enhancements.js','launch-extras.js'])w.eval(fs.readFileSync('admin-camp-ao-vivo/'+f,'utf8'));
  await wait(350);w.document.getElementById('input-mode').value='detail-pos-kills';w.handleInputModeChange();await wait(150);
  const initial=w.document.querySelector('[data-v46-position="12"]'),code=initial.dataset.v46Team;
  const field=()=>w.document.getElementById('place-'+code),radio=n=>w.document.querySelector('[data-v46-team="'+code+'"][data-v46-position="'+n+'"]');
  const click=async n=>{const r=radio(n);r.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true}));r.closest('label').querySelector('span').click();await wait(120);};
  await click(12);assert.equal(field().value,'12');assert(radio(12).checked);assert(field().closest('.team-row').classList.contains('cff-team-eliminated'));
  await click(6);assert.equal(field().value,'6');assert(radio(6).checked);assert(!radio(12).checked);
  await click(12);assert.equal(field().value,'12');assert(radio(12).checked);
  await click(12);assert.equal(field().value,'');assert(!radio(12).checked);assert(!field().closest('.team-row').classList.contains('cff-team-eliminated'));
  field().value='12';field().dispatchEvent(new w.Event('input',{bubbles:true}));await wait(120);assert(radio(12).checked);assert.equal(field().value,'12');assert.deepEqual(errors,[]);
 }finally{w.close();}
});
