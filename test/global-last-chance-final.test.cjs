'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=name=>JSON.parse(fs.readFileSync('ffws-global-2026/'+name+'.json','utf8'));
const C=require('../js/global-camp-core.js'),meta=read('camp-model');
const expected=['p-esports','ag-al','fx','loud','lyon','team-flash','gundynasty','bru','rrq','blue-cheese','resurrection-esports','btr'];
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
test('official Last Chance totals match the supplied table without fabricating drops or individual scores',()=>{
 const s=read('stages'),rows=s.lastChance.rows;
 assert.equal(s.lastChance.finished,true);assert.equal(s.lastChance.rounds.length,0);assert.equal(s.lastChance.coverage.individual,false);
 assert.deepEqual(rows.map(r=>[r.points,r.kills,r.booyahs]),[[161,85,3],[155,86,1],[149,104,1],[139,76,0],[138,84,2],[130,71,1],[124,88,1],[101,73,0],[101,58,0],[81,50,1],[80,44,0],[74,44,0]]);
 assert(rows.every((r,i)=>r.position===i+1&&r.matches===10&&r.points===r.kills+r.placementPoints));
 assert.equal(read('players').entries.filter(e=>e.stage==='lastChance').length,0);
 assert.deepEqual(read('mvp-resumo'),JSON.parse(require('node:child_process').execFileSync('git',['show','HEAD:ffws-global-2026/mvp-resumo.json'],{encoding:'utf8'})));
 const projection=read('stats/raio-x/projecao');assert.equal(projection.lastChance.started,true);assert.equal(projection.lastChance.result.length,12);
 assert.deepEqual(projection.lastChance.result.slice(0,4).map(r=>r.id),expected.slice(8));
 const prior=JSON.parse(require('node:child_process').execFileSync('git',['show','HEAD:ffws-global-2026/stats/raio-x/projecao.json'],{encoding:'utf8'}));
 assert.deepEqual(projection.lastChance.forecast,prior.lastChance.forecast,'published prediction is frozen before seeing results');
});
test('the final opens with twelve confirmed entrants and zero scores in the admin template',()=>{
 assert.deepEqual(C.entrants('final-1',{},meta),expected);
 const backup=C.backup(require('../camp-ao-vivo/base.json'),meta,'final-1');
 assert.equal(backup.selectedTeams.length,12);assert.equal(backup.config.championEnabled,true);assert.equal(backup.config.date,'2026-11-28');
 assert(Object.values(backup.startingPoints).every(n=>n===0));
 assert(backup.drops.every(d=>Object.values(d.points).every(v=>v===null)));
 const invalid={...meta,finalists:Array(12).fill('rrq')};assert.throws(()=>C.entrants('final-1',{},invalid));
});
test('the home presents one responsive finalist grid with a final call to action',async()=>{
 for(const mobile of [false,true]){
  const w=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}).window;
  try{
   w.Date.now=()=>Date.parse('2026-11-27T21:00:00-03:00');w.matchMedia=()=>({matches:mobile,addEventListener(){}});w.setInterval=()=>0;w.setTimeout=()=>0;
   w.fetch=async()=>({ok:true,json:async()=>read('inicio-resumo')});
   w.eval(fs.readFileSync('js/home-global-finals.js','utf8'));await settle();
   const d=w.document;assert.match(d.querySelector('#home-global-title').textContent,/GRANDE FINAL/);
   assert.equal(d.querySelectorAll('.home-global-finalists .home-global-match-team').length,12);
   assert.equal(d.querySelectorAll('#home-global-upcoming-content .home-global-single-roster').length,0);
   assert.equal(d.querySelector('.home-global-final-cta').getAttribute('href'),'/ffws-global-2026/final');
   assert.match(d.querySelector('#home-global-countdown-label').textContent,/GRANDE FINAL/);
   assert.equal(d.querySelector('#home-global-classified').parentElement.className.includes(mobile?'home-left-rail':'home-center-column'),true);
  }finally{w.close();}
 }
});
test('sidebar displays all twelve finalist identities without carrying previous phase scores',async()=>{
 const w=new JSDOM(fs.readFileSync('index.html','utf8'),{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}).window;
 try{
  Object.defineProperty(w.document,'hidden',{get:()=>false});w.document.querySelector('#home').classList.add('active');w.Date.now=()=>Date.parse('2026-11-27T21:00:00-03:00');w.setInterval=()=>0;
  w.fetch=async()=>({ok:true,json:async()=>read('home-resumo')});w.eval(fs.readFileSync('js/home-global-results.js','utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await settle();
  assert.equal(w.document.querySelectorAll('#home-tbody-teams tr').length,12);
  assert.equal(w.document.querySelector('#home-ranking-teams th:last-child').hidden,true);
  assert(!w.document.querySelector('#home-tbody-teams').textContent.includes('161'));
  assert.match(w.document.querySelector('#home-ranking-teams h3').textContent,/12 finalistas/);
 }finally{w.close();}
});
test('full stage pages show official Last Chance totals and final entrants with missing-data labels',()=>{
 const w=new JSDOM('<main id="ffws-global-2026-last-chance-content"></main><main id="ffws-global-2026-final-content"></main>',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}).window;
 try{
  const script=fs.readFileSync('ffws-global-2026/global.js','utf8').replace("  if (document.readyState === 'loading')","  window.testFinal={state,renderPage};\n  if (document.readyState === 'loading')");
  w.eval(script);const {state,renderPage}=w.testFinal;Object.assign(state,{loaded:true,stages:read('stages'),teams:read('teams').teams,dates:read('dates'),groups:read('groups')});
  renderPage('ffws-global-2026-last-chance');let host=w.document.querySelector('#ffws-global-2026-last-chance-content');
  assert.equal(host.querySelectorAll('.ffws-global-table tbody tr').length,12);assert.match(host.textContent,/Classificação final/);assert.match(host.textContent,/dados por queda e individuais/);assert.match(host.textContent,/161/);
  renderPage('ffws-global-2026-final');host=w.document.querySelector('#ffws-global-2026-final-content');assert.equal(host.querySelectorAll('.global-finalists-panel a').length,12);assert.match(host.textContent,/zero pontos/);assert.match(host.textContent,/Aguardando resultados/);
 }finally{w.close();}
});
