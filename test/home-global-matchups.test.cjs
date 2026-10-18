const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const read=file=>fs.readFileSync(file,'utf8');
const calendar=JSON.parse(read('ffws-global-2026/dates.json')),teamData=JSON.parse(read('ffws-global-2026/teams.json')),groupData=JSON.parse(read('ffws-global-2026/groups.json'));
const sleep=()=>new Promise(resolve=>setImmediate(resolve));
async function mount(at,{mobile=false,offline=false}={}){
 const dom=new JSDOM(read('index.html'),{url:'https://centralfreefire.com.br/',runScripts:'outside-only'});
 const w=dom.window,requests=[];let now=Date.parse(at),interval=null;
 w.Date.now=()=>now;
 w.matchMedia=()=>({matches:mobile,addEventListener(){}});
 w.setInterval=fn=>{interval=fn;return 5;};w.clearInterval=()=>{interval=null;};
 w.fetch=async url=>{
  requests.push(String(url));
  if(offline)throw Error('Fora do ar');
  const data=String(url).includes('dates.json')?calendar:String(url).includes('teams.json')?teamData:groupData;
  return {ok:true,json:async()=>JSON.parse(JSON.stringify(data))};
 };
 w.document.getElementById('home').classList.add('active');
 vm.runInContext(read('js/home-global-finals.js'),dom.getInternalVMContext());
 await sleep();await sleep();
 return {w,requests,dom,get now(){return now;},setNow(value){now=Date.parse(value);},tick(){interval?.();},close(){dom.window.close();}};
}
test('official knockout groups use all 24 classified teams without duplicates or swapping P Esports and Pirate Esports',()=>{
 const teamIds=new Set(teamData.teams.map(t=>t.id)),groups=groupData.groups;
 assert.equal(Object.keys(groups).length,4);
 assert(Object.values(groups).every(v=>v.length===6));
 const ids=Object.values(groups).flat();
 assert.equal(ids.length,24);assert.equal(new Set(ids).size,24);
 assert(ids.every(id=>teamIds.has(id)));
 assert(groups.C.includes('pe')&&groups.C.includes('p-esports'));
 assert(groups.A.includes('stellar-esport')&&groups.A.includes('total-winner-esports'));
 assert(groups.B.includes('loud')&&groups.C.includes('fx')&&groups.D.includes('los'));
 assert.deepEqual(calendar.rounds.slice(0,6).map(r=>r.groups),[['A','B'],['C','D'],['A','C'],['B','D'],['A','D'],['B','C']]);
});
test('homepage opens on knockout matchups from published dates and displays correct crests and next sessions',async()=>{
 const x=await mount('2026-10-18T11:00:00-03:00');
 try{
  const d=x.w.document;
  assert.equal(d.querySelector('#home-global-tab-upcoming').getAttribute('aria-selected'),'true');
  assert.equal(d.querySelector('#home-global-panel-upcoming').hidden,false);
  assert.equal(d.querySelector('#home-global-panel-slots').hidden,true);
  const first=d.querySelector('.home-global-match-head');
  assert.match(first.textContent,/GRUPO A × GRUPO B/);
  assert.match(first.textContent,/06\/11\/2026 · 04:00h/);
  assert.equal(d.querySelectorAll('.home-global-match-group').length,2);
  assert.equal(d.querySelectorAll('.home-global-match-team').length,12);
  assert.equal(d.querySelectorAll('.home-global-match-team img[src^="/home-assets/teams/global/"]').length,12);
  assert.match(d.querySelector('.home-global-match-group').textContent,/STG/);
  assert.match(d.querySelectorAll('.home-global-match-group')[1].textContent,/LOUD/);
  assert.equal(d.querySelectorAll('.home-global-fixture-row').length,3);
  assert.match(d.querySelector('.home-global-fixture-row').textContent,/GRUPO C/);
  assert.match(d.querySelector('.home-global-fixture-row').textContent,/GRUPO D/);
  assert.equal(d.querySelector('.home-global-countdown').dataset.start,'2026-11-06T04:00:00-03:00');
  assert.equal(d.querySelector('.home-global-calendar-link').getAttribute('href'),'/ffws-global-2026/datas');
  assert(x.requests.some(p=>p.includes('groups.json')));
  assert(x.requests.some(p=>p.includes('dates.json')));
 }finally{x.close();}
});
test('tabs preserve original slot sections and support keyboard navigation on mobile',async()=>{
 const x=await mount('2026-10-18T11:00:00-03:00',{mobile:true});
 try{
  const d=x.w.document,board=d.querySelector('#home-global-classified'),slots=d.querySelector('#home-global-panel-slots');
  assert(board.parentElement.classList.contains('home-left-rail'));
  assert.equal(slots.querySelectorAll('.home-global-team').length,24);
  assert.equal(slots.querySelectorAll('.home-global-region').length,11);
  const tab=d.querySelector('#home-global-tab-slots');tab.click();
  assert.equal(slots.hidden,false);
  assert.equal(d.querySelector('#home-global-panel-upcoming').hidden,true);
  assert.equal(tab.getAttribute('aria-selected'),'true');
  tab.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(d.querySelector('#home-global-panel-upcoming').hidden,false);
  assert.equal(slots.hidden,true);
  assert.equal(d.querySelector('#home-global-tab-upcoming').getAttribute('tabindex'),'0');
 }finally{x.close();}
});
test('countdown advances to following confirmed group matchup, with no invented live status',async()=>{
 const x=await mount('2026-11-06T03:59:59-03:00');
 try{
  const d=x.w.document;
  assert.equal(d.querySelector('.home-global-countdown').dataset.start,'2026-11-06T04:00:00-03:00');
  x.setNow('2026-11-06T04:00:01-03:00');x.tick();
  assert.equal(d.querySelector('.home-global-countdown').dataset.start,'2026-11-06T09:00:00-03:00');
  assert.match(d.querySelector('.home-global-match-head').textContent,/GRUPO C × GRUPO D/);
  assert.equal(d.querySelectorAll('.home-global-match-team').length,12);
  assert(!d.querySelector('.home-global-match-head').textContent.includes('AO VIVO'));
 }finally{x.close();}
});
test('later phase shows scheduled dates but does not guess team identities; after final it shows results shortcut',async()=>{
 const x=await mount('2026-11-23T12:00:00-03:00');
 try{
  const d=x.w.document;
  assert.match(d.querySelector('.home-global-match-head').textContent,/LAST CHANCE/);
  assert.equal(d.querySelectorAll('.home-global-match-team').length,0);
  assert.match(d.querySelector('.home-global-future-teams').textContent,/definidos pelos resultados/);
  x.setNow('2026-11-29T12:00:00-03:00');x.tick();
  assert(d.querySelector('.home-global-finished'));
  assert.equal(d.querySelector('.home-global-countdown').hidden,true);
 }finally{x.close();}
});
test('an unavailable static calendar gives a clear fallback and leaves qualification slots usable',async()=>{
 const x=await mount('2026-10-18T11:00:00-03:00',{offline:true});
 try{
  const d=x.w.document;
  assert(d.querySelector('.home-global-error'));
  assert(d.querySelector('.home-global-calendar-link'));
  d.querySelector('#home-global-tab-slots').click();
  assert.equal(d.querySelector('#home-global-panel-slots').hidden,false);
  assert.equal(d.querySelectorAll('.home-global-team').length,24);
 }finally{x.close();}
});
