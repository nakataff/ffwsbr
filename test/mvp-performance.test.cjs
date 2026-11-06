'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const file=url=>new URL(url,'https://centralfreefire.com.br').pathname.slice(1);
const wait=async fn=>{for(let i=0;i<100&&!fn();i++)await new Promise(r=>setTimeout(r,15));assert(fn());};
const response=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
const code=path=>fs.readFileSync(path,'utf8');

test('home waits for its route and uses a compact snapshot plus one Firebase summary',async()=>{
 const w=new JSDOM('<div id="home" class="page"><div id="global-selection-home-widget"></div><div id="home-ranking-teams"><h3></h3></div><table><tbody id="home-tbody-teams"></tbody><tbody id="home-tbody-players"></tbody></table></div>',{pretendToBeVisual:true,runScripts:'outside-only',url:'https://centralfreefire.com.br/ffws-global-2026/mvp'}).window;
 const calls=[],d=w.document;
 w.CFF_CONFIG={firebase:{databaseURL:'https://fixture.invalid'}};
 w.fetch=async url=>{calls.push(file(url));return response(String(url).includes('fixture.invalid')?{stage:'classificatoria',date:'2026-11-06',teams:[],rankings:{}}:read(file(url)));};
 try{
  w.eval(code('js/global-selection-lineups.js'));w.eval(code('js/home-global-results.js'));
  await new Promise(r=>setTimeout(r,25));assert.deepEqual(calls,[]);
  d.getElementById('home').classList.add('active');
  await wait(()=>d.querySelector('#home-tbody-players tr a'));
  assert.deepEqual(calls.sort(),['ffws-global-2026/selecoes-resumo.json','ffwsLive/global-2026/home.json']);
  assert.match(d.getElementById('home-tbody-teams').textContent,/LOUD/);
  assert.match(d.getElementById('home-tbody-players').textContent,/BuTziN/);
  assert.equal(d.querySelectorAll('.cff-gsel-home-row').length,5);
  assert.match(d.getElementById('global-selection-home-widget').textContent,/COACH.*JOKER/i);
  assert(d.querySelector('.cff-gsel-home-row img[src*="/160/"]'));
  w.cffHomeRenderFinalStats();w.cffHomeRenderFinalStats();assert.equal(calls.length,2);
 }finally{w.close();}
});

test('S1 ranks daily totals with working filters and sortable columns without legacy requests',async()=>{
 const w=new JSDOM('<div id="cff-s1-mvp-root"></div>',{runScripts:'outside-only',url:'https://centralfreefire.com.br/ffws-br-s1.html#mvp'}).window;
 const calls=[],d=w.document;
 w.fetch=async url=>{calls.push(file(url));return response(read(file(url)));};
 try{
  w.eval(code('ffws-br-2026-s1/mvp.js'));await w.cffS1MvpBoot();
  const set=(key,value)=>{const control=d.querySelector(`[data-s1-mvp-filter="${key}"]`);control.value=value;control.dispatchEvent(new w.Event('change',{bubbles:true}));};
  const first=()=>d.querySelector('.ffws-s2-mvp-main-row');
  const sort=key=>d.querySelector(`[data-mvp-column="${key}"]`).click();
  const published=Object.values(read('ffws-br-2026-s1/player-stats.json').players);
  assert.equal(Number(first().cells[3].textContent),Math.max(...published.map(p=>p.stages.classificatoria?.kills||0)));
  sort('damage');
  assert.equal(d.querySelector('th[aria-sort]').getAttribute('aria-sort'),'descending');
  const high=Number(first().cells[4].textContent.replace(/\./g,''));
  sort('damage');assert(Number(first().cells[4].textContent.replace(/\./g,''))<high);
  set('stage','1');set('team','0');set('role','RUSH');set('day','1:1');
  assert(first());assert.equal(first().cells[2].textContent,'FX');
  assert(Number(first().cells[6].textContent)<10);
  assert.deepEqual(calls,['ffws-br-2026-s1/mvp-resumo.json']);
 }finally{w.close();}
});

for(const [edition,route,js] of [['Global','ffws-global-2026-mvp','ffws-global-2026/global.js'],['S2','ffws-br-s2-mvp','ffws-br-2026-s2/s2.js']]){
 test(edition+' sorts the entire result before pagination and keeps filters',async()=>{
  const w=new JSDOM(`<section class="page active" id="${route}"><div id="${route}-content"></div></section>`,{runScripts:'outside-only',url:'https://centralfreefire.com.br/index.html#'+route}).window,d=w.document;
  w.fetch=async url=>response(read(file(url)));
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
  w.HTMLDialogElement.prototype.close=function(){this.open=false};
  try{
   const config=js.replace(/[^/]+$/,'config.js');w.eval(code(config));w.eval(code(js));
   await wait(()=>d.querySelector('[data-mvp-column="damage"]'));
   assert(!d.querySelector('[data-mvp-sort]'));
   d.querySelector('[data-mvp-filter="team"]').click();
   const dialog=d.querySelector('dialog');assert(dialog.open);
   const input=dialog.querySelector('input');assert(input);
   input.checked=true;
   dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
   assert.match(d.querySelector('[data-mvp-filter="team"]').textContent,new RegExp(input.value,'i'));
   const sort=key=>d.querySelector(`[data-mvp-column="${key}"]`).click();
   sort('assists');assert.equal(d.querySelector('[aria-sort="descending"] [data-mvp-column]').dataset.mvpColumn,'assists');
   const matches=[...d.querySelectorAll('[data-mvp-table] tbody tr[class$="mvp-main-row"]')];
   assert(matches.length>1);
   const high=Number(matches[0].cells[5].textContent);
   sort('assists');assert.equal(d.querySelector('[aria-sort="ascending"] [data-mvp-column]').dataset.mvpColumn,'assists');
   assert(Number(d.querySelector('[data-mvp-table] tbody tr').cells[5].textContent)<=high);
  }finally{w.close();}
 });
}
