const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process'),{JSDOM}=require('jsdom');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),settle=async()=>{for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));};
function ui(id='trap'){
 const dom=new JSDOM('<main id="player-root"></main>',{url:'https://centralfreefire.com.br/jogador.html?id='+id,runScripts:'outside-only'}),w=dom.window,calls=[];
 w.fetch=async u=>{const p=String(u).split('?')[0].replace(/^\//,'');calls.push(p);try{return {ok:true,json:async()=>read(p)}}catch{return {ok:false}}};
 for(const p of ['js/global-player-manifest.js','js/global-player-profile.js','js/copa-player-manifest.js','js/copa-player-profile.js'])w.eval(fs.readFileSync(p,'utf8'));
 return {w,calls,close:()=>w.close()};
}
test('Copa snapshots reproduce exact CSV stages and explicit existing player identities',()=>{
 execFileSync('python3',['scripts/build-copa-player-profiles.py','--check']);const report=read('imports/copa-ff-2026/player-profiles-report.json');assert.equal(report.linkedProfiles,100);assert.equal(report.unmapped.length,4);
 const y=read('copa-ff-2026/player-data/yago.json');assert.equal(y.sourceName,'Yago.exe');assert.equal(y.stats.geral.kills,78);assert.equal(y.stats.final.kills,31);assert.equal(y.stats.geral.matches,34);assert(!y.stats.repescagem);
 assert.equal(read('copa-ff-2026/player-data/lost21.json').sourceName,'Lost');assert.equal(read('copa-ff-2026/player-data/byte333.json').sourceName,'BYTE33');assert.equal(read('copa-ff-2026/player-data/xguto7.json').sourceName,'xGuto7');assert(!fs.existsSync('copa-ff-2026/player-data/xguto.json'));
 assert(!read('copa-ff-2026/player-data/mtsexy.json').stats.geral);assert.equal(read('copa-ff-2026/player-data/mtsexy.json').stats.final.kills,9);assert.equal(read('copa-ff-2026/player-data/mtsexy.json').stats.final.average,1.13);
 assert(fs.statSync('js/copa-player-manifest.js').size<2200);for(const file of fs.readdirSync('copa-ff-2026/player-data'))assert(fs.statSync('copa-ff-2026/player-data/'+file).size<1800);
});
test('only the selected Copa tab fetches one player file, stage changes use memory and absent records stay unknown',async()=>{
 const f=ui();try{const {w}=f,api=w.CFF_COPA_2026_BRIDGE;assert.equal(await api.load({id:'someone'}),null);assert.equal(await api.load({id:'trap',profileType:'staff'}),null);assert.equal(f.calls.length,0);
  const panel=w.document.createElement('div');w.document.body.append(panel);await api.render(panel,{id:'trap'});assert.equal(f.calls.length,1);assert.equal(f.calls[0],'copa-ff-2026/player-data/trap.json');assert.equal(panel.querySelector('.stat-card strong').textContent,'66');panel.querySelector('[data-copa-stage="final"]').click();await settle();assert.equal(panel.querySelector('.stat-card strong').textContent,'24');panel.querySelector('[data-copa-stage="repescagem"]').click();await settle();assert.equal(panel.querySelector('.stat-card strong').textContent,'—');assert.match(panel.textContent,/não significa zero/);assert.equal(f.calls.length,1);
  await api.render(panel,{id:'mtsexy'});assert.equal(panel.querySelector('.stat-card strong').textContent,'—');panel.querySelector('[data-copa-stage="final"]').click();await settle();assert.equal(panel.querySelector('.stat-card strong').textContent,'9');assert.equal(f.calls.length,2);
 }finally{f.close();}
});
test('real profile order places Copa after WB S1 and leaves other competitions usable',async()=>{
 for(const id of ['trap','cauan7','lost21','acemvp']){const f=ui(id);try{const {w,calls}=f;w.eval(fs.readFileSync('js/player-page.min.js','utf8'));await settle();const tabs=[...w.document.querySelectorAll('.player-season-tabs button')],copa=tabs.find(b=>b.textContent==='Copa FF 2026');assert(copa,id);assert.equal(calls.filter(p=>p.startsWith('copa-ff-2026/')).length,['cauan7','lost21','acemvp'].includes(id)?1:0);
   if(id==='trap')assert.deepEqual(tabs.map(b=>b.textContent),['GLOBAL SERIES 2026','WB 2026 S2','EWC 2026','WB 2026 S1','Copa FF 2026']);
   copa.click();await settle();assert(w.document.querySelector('#player-season-panel [data-copa-2026-summary]'));const count=calls.length;const other=tabs.find(b=>b!==copa);if(other){other.click();await settle();assert(!w.document.querySelector('[data-copa-2026-summary]'));copa.click();await settle();assert(w.document.querySelector('[data-copa-2026-summary]'));assert.equal(calls.length,count);}
  }finally{f.close();}}
});
test('late or failed Copa responses cannot overwrite another selected competition',async()=>{
 const f=ui();try{const {w}=f,api=w.CFF_COPA_2026_BRIDGE,panel=w.document.createElement('div');w.document.body.append(panel);let release,current=true;w.fetch=()=>new Promise(r=>release=r);const wait=api.render(panel,{id:'trap'},'geral',()=>current);current=false;panel.textContent='WB S1';release({ok:true,json:async()=>read('copa-ff-2026/player-data/trap.json')});await wait;assert.equal(panel.textContent,'WB S1');
  w.fetch=async()=>({ok:false});current=true;await api.render(panel,{id:'yago'});assert(panel.querySelector('[data-copa-retry]'));assert.equal(panel.querySelectorAll('.stat-card').length,0);
 }finally{f.close();}
});
