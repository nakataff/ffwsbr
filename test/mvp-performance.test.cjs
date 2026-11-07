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
  assert.match(d.getElementById('home-tbody-teams').querySelector('tr').textContent,/FLUXO W7M.*233/);
  assert.match(d.getElementById('home-tbody-players').textContent,/BuTziN/);
  assert.equal(d.querySelectorAll('.cff-gsel-home-row').length,5);
  assert.match(d.getElementById('global-selection-home-widget').textContent,/COACH.*Adi/i);
  assert(d.querySelector('.cff-gsel-home-row img[src*="/160/"]'));
  w.cffHomeRenderFinalStats();w.cffHomeRenderFinalStats();assert.equal(calls.length,2);
 }finally{w.close();}
});

const editions={s1:'ffws-br-2026-s1',s2:'ffws-br-2026-s2',global:'ffws-global-2026'};
for(const [key,base] of Object.entries(editions)){
 test(key+' shares the ranking UI and requests only one compact data file',async()=>{
  const w=new JSDOM('<section class="page active"><div id="mvp"></div></section>',{runScripts:'outside-only',url:'https://centralfreefire.com.br/'}).window,d=w.document,calls=[];
  const root=d.getElementById('mvp'),snapshot=read(base+'/mvp-resumo.json');
  w.fetch=async url=>{calls.push(file(url));return response(snapshot);};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
  w.HTMLDialogElement.prototype.close=function(){this.open=false};
  try{
   w.eval(code('js/mvp-ranking.js'));
   await w.CFFMvpRanking.boot(root,key);await w.CFFMvpRanking.boot(root,key);
   const sort=key=>root.querySelector(`[data-mvp-column="${key}"]`).click();
   const first=()=>root.querySelector('tbody tr');
   const n=(row,column)=>Number(row.cells[column].textContent.replace(/\./g,''));
   const pick=(kind,...values)=>{
    root.querySelector(`[data-mvp-filter="${kind}"]`).click();
    const dialog=root.querySelector('dialog');assert(dialog.open);
    dialog.querySelectorAll('input').forEach(input=>input.checked=values.includes(input.value));
    dialog.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));
   };
   assert.equal(root.querySelector('th[aria-sort="descending"] [data-mvp-column]').dataset.mvpColumn,'kills');
   const archive=key==='s1'?read(base+'/player-stats.json'):read(base+'/inicio-mvp-top10.json');
   assert.equal(n(first(),3),key==='s1'?Math.max(...Object.values(archive.players).map(p=>p.stages.classificatoria?.kills||0)):archive.top10.geral[0].kills);
   if(key==='global'){
    const roleHeader=root.querySelector('th.cff-mvp-role-col');
    assert.equal(roleHeader.textContent,'Posição');
    assert(roleHeader.classList.contains('hide-mobile'));
    const rowRole=first().querySelector('.cff-mvp-role-col.hide-mobile');
    assert.equal(rowRole.textContent,'Rush');
    assert(!root.querySelector('.ffws-global-mvp-panel').classList.contains('show-details'));
    root.querySelector('[data-mvp-details]').click();
    assert(root.querySelector('.ffws-global-mvp-panel').classList.contains('show-details'));
    const details=first().nextElementSibling;
    assert.equal(details.cells[0].colSpan,first().cells.length);
    assert.equal(details.querySelector('.cff-mvp-role-detail span').textContent,'Posição');
    assert.equal(details.querySelector('.cff-mvp-role-detail strong').textContent,'Rush');
    assert.match(details.textContent,/Colocação1º/);
    pick('role','SUP');
    assert.equal(first().querySelector('.cff-mvp-role-col').textContent,'Suporte / Sniper');
    assert.equal(first().nextElementSibling.querySelector('.cff-mvp-role-detail strong').textContent,'Suporte / Sniper');
    pick('role');
    root.querySelector('[data-mvp-details]').click();
    assert(!root.querySelector('.ffws-global-mvp-panel').classList.contains('show-details'));
   }else{
    assert.equal(root.querySelector('.cff-mvp-role-col,.cff-mvp-role-detail'),null);
   }
   root.querySelector('[data-mvp-page="1"]').click();
   assert.match(root.querySelector('tbody tr').textContent,/^11º/);
   sort('damage');const high=n(first(),4);assert.match(first().textContent,/^1º/);
   sort('damage');assert(n(first(),4)<high);
   assert.equal(root.querySelector('[aria-sort="ascending"] [data-mvp-column]').dataset.mvpColumn,'damage');
   const team=key==='s1'?0:snapshot.players[snapshot.rows[0][3]][1];
   pick('team',String(team));assert.equal(first().cells[2].querySelector('img').alt,snapshot.teams[team][1]);
   if(key==='global'){
    pick('round','0:2');assert(root.querySelector('[data-mvp-filter="round"]').textContent.includes('C × D'));
    assert(!root.querySelector('[data-mvp-filter="rookie"]'));
   }
   if(key==='s1'){pick('stage','1');pick('day','1:1');assert(n(first(),6)<10);}
   assert.deepEqual(calls,[base+'/mvp-resumo.json']);
  }finally{w.close();}
 });
}
test('S2 compact totals match official team totals in all three stages',()=>{
 const base=editions.s2,snapshot=read(base+'/mvp-resumo.json'),official=read(base+'/career-summary.json');
 for(const [index,phase] of snapshot.stages.entries()){
  const totals=new Map();
  for(const r of snapshot.rows.filter(r=>r[0]===index)){
   const team=snapshot.teams[snapshot.players[r[3]][1]][0];totals.set(team,(totals.get(team)||0)+r[4]);
  }
  for(const t of official[phase].rows)assert.equal(totals.get(t.team)||0,t.kills,phase+' / '+t.team);
 }
});
test('publication rejects duplicate drop rows and a conflicting team total',()=>{
 const {verifyWorld}=require('../scripts/prepare-competition-publication.cjs'),{build}=require('../scripts/build-mvp-summary.cjs');
 const base=editions.global,data=Object.fromEntries(['dates','teams','groups','players'].map(k=>[k,read(base+'/'+k+'.json')]));
 const standings=read(base+'/standings-day1.json');
 assert.equal(verifyWorld(data,standings)[0].drops,12);
 const entry=data.players.entries[0];
 assert.throws(()=>build({edition:'global',stages:['classificatoria'],teams:data.teams.teams,roster:data.players.players,entries:[entry,entry],periods:data.dates.rounds}),/duplicado/);
 entry.kills++;
 assert.throws(()=>verifyWorld(data,standings),/Abates não batem/);
});
