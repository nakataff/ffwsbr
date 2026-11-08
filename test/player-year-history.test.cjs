const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const settle=async()=>{for(let i=0;i<45;i++)await new Promise(resolve=>setImmediate(resolve));};
function yearAPI(){
 const w={CFF_COPA_2026_BRIDGE:{eligible:p=>p?.id==='rigby245'}};
 const dom=new JSDOM('<main></main>',{url:'https://centralfreefire.com.br/jogador/rigby245',runScripts:'outside-only'});
 dom.window.CFF_COPA_2026_BRIDGE=w.CFF_COPA_2026_BRIDGE;
 dom.window.eval(fs.readFileSync('js/player-year-history.js','utf8'));
 return dom.window;
}
test('annual kill history groups verified records by year and distinguishes absent values from genuine zero',()=>{
 const w=yearAPI();
 try{
  const p=read('player-data/s2/los.json').players.rigby245;
  const list=w.CFF_PLAYER_YEAR_HISTORY.collect(p);
  assert.equal(list.find(row=>row.name==='LBFF 6').year,2021);
  assert.equal(list.find(row=>row.name==='WB 2025 S1').kills,213);
  assert.equal(list.find(row=>row.name==='Copa FF 2026').kills,null);
  assert(!list.some(row=>row.name==='WB 2026 S2'), 'not started placeholders must not count as participation');
  p.editions.push({edition:'Camp Teste 2023',year:2023,kills:0,matches:3});
  p.editions.push({edition:'Mundial Teste 2022',year:2022,kills:null,matches:12});
  const rows=w.CFF_PLAYER_YEAR_HISTORY.collect(p);
  assert.equal(rows.find(r=>r.name==='Camp Teste 2023').kills,0);
  assert.equal(rows.find(r=>r.name==='Mundial Teste 2022').kills,null);
  const html=w.CFF_PLAYER_YEAR_HISTORY.markup(p);
  assert.match(html,/Histórico por ano/);
  assert.match(html,/O símbolo/);
  assert.match(html,/Abates não informados|sem registro/);
  assert.match(html,/is-unknown/);
  assert(!html.includes('NaN'));
 }finally{w.close();}
});
test('Copa totals enrich one annual record on first expansion without eager event downloads',async()=>{
 const w=yearAPI();try{
  const p=read('player-data/s2/los.json').players.rigby245;
  let loads=0;
  w.CFF_COPA_2026_BRIDGE.load=async()=>{loads++;return read('copa-ff-2026/player-data/rigby245.json');};
  w.document.body.innerHTML=w.CFF_PLAYER_YEAR_HISTORY.markup(p);
  const details=w.document.querySelector('[data-player-year-history]');
  w.CFF_PLAYER_YEAR_HISTORY.attach(p);
  assert.equal(loads,0);
  assert.match(details.textContent,/Copa FF 2026/);
  assert.equal(w.CFF_PLAYER_YEAR_HISTORY.collect(p).find(r=>r.name==='Copa FF 2026').kills,null);
  details.open=true;details.dispatchEvent(new w.Event('toggle'));await settle();
  assert.equal(loads,1);
  assert.equal(w.CFF_PLAYER_YEAR_HISTORY.collect(p).find(r=>r.name==='Copa FF 2026').kills,80);
  assert.match(details.textContent,/80/);
  details.open=false;details.dispatchEvent(new w.Event('toggle'));
  details.open=true;details.dispatchEvent(new w.Event('toggle'));await settle();
  assert.equal(loads,1);
 }finally{w.close();}
});
test('real Rigby profile uses exactly the WB S2 stat grid for Global, Copa and WB tabs',async()=>{
 const w=new JSDOM('<main id="player-root"></main>',{url:'https://centralfreefire.com.br/jogador.html?id=rigby245',runScripts:'outside-only'}).window,calls=[];
 try{
  w.fetch=async url=>{
   const file=String(url).split('?')[0].replace(/^\//,'');calls.push(file);
   try{return {ok:true,json:async()=>read(file)}}catch{return {ok:false}}
  };
  for(const file of ['js/global-player-manifest.js','js/global-player-profile.js','js/copa-player-manifest.js','js/copa-player-profile.js','js/player-year-history.js','js/player-page.min.js'])w.eval(fs.readFileSync(file,'utf8'));
  await settle();
  const root=w.document.getElementById('player-root'),panel=()=>root.querySelector('#player-season-panel');
  assert(root.querySelector('.profile-year')===null);
  assert(root.querySelector('[data-player-year-history]'));
  assert.equal(root.querySelector('[data-player-year-history]').previousElementSibling?.classList.contains('profile-history-details'),true);
  assert(root.querySelector('[data-global-2026-summary] .current-grid'));
  assert.equal(panel().querySelector('.current-grid .stat-card').length,4,'Global only shows its four registered metrics');
  assert.match(panel().querySelector('.player-season-head h3').textContent,/Rigby245/i);
  root.querySelector('[data-player-season="s2"]').click();await settle();assert(panel().querySelector('.current-grid .stat-card'));
  root.querySelector('[data-player-season="s1"]').click();await settle();assert(panel().querySelector('.current-grid .stat-card'));
  root.querySelector('[data-player-season="copa2026"]').click();await settle();
  assert(panel().querySelector('[data-copa-2026-summary] .current-grid'));
  assert.equal(panel().querySelector('.current-grid .stat-card').length,5,'Copa has five recorded metrics');
  const year=root.querySelector('[data-player-year-history]');
  year.open=true;year.dispatchEvent(new w.Event('toggle'));await settle();
  const rows=w.CFF_PLAYER_YEAR_HISTORY.collect({id:'rigby245',editions:read('player-data/s2/los.json').players.rigby245.editions,copa2026:read('copa-ff-2026/player-data/rigby245.json')});
  assert.equal(rows.find(r=>r.name==='Copa FF 2026').kills,80);
  assert.match(year.textContent,/2026/);
  assert(calls.filter(x=>x==='copa-ff-2026/player-data/rigby245.json').length<=1);
 }finally{w.close();}
});
