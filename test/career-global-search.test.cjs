const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const staticIndex={items:[
 {type:'player',id:'mt7',title:'MT7',sub:'FLUXO W7M',image:'silhueta.webp',aliases:['MT7']},
 {type:'team',id:'santos',title:'SANTOS',sub:'Equipe histórica',image:'santos.webp',aliases:[]},
 {type:'player',id:'offline',title:'Offline',sub:'Equipe histórica',image:'silhueta.webp',aliases:[]}
]};
test('global search takes current team from live careers, finds new staff and falls back offline',async()=>{
 const dom=new JSDOM('<input id="global-search-desktop"><div id="search-results-desktop"></div>',{url:'https://centralfreefire.com.br/index.html',runScripts:'outside-only'}),w=dom.window;
 const queries=[],input=w.document.querySelector('#global-search-desktop'),results=w.document.querySelector('#search-results-desktop');
 w.requestIdleCallback=()=>{};w.AbortSignal=AbortSignal;
 w.fetch=async url=>{
  const target=String(url);
  if(target.includes('search-index-lite.json'))return {ok:true,json:async()=>staticIndex};
  if(target.includes('teams.json'))return {ok:true,json:async()=>({teams:[]})};
  const query=new URL(target).searchParams.get('query');queries.push(query);
  if(query==='offline')throw Error('Sem internet');
  return {ok:true,json:async()=>({entries:query==='mt7'?[{id:'mt7',name:'MT7',kind:'player',team:'LOUD',role:'player',status:'active',photo:'mt7.webp'}]:query==='santos'?[{id:'person-123',name:'Santos',kind:'staff',team:'',role:'analyst',status:'free_agent',photo:'silhueta.webp'}]:[]})};
 };
 try{
  w.eval(fs.readFileSync(require.resolve('../js/search-fast.min.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded',{bubbles:true}));
  const search=async query=>{input.value=query;input.dispatchEvent(new w.Event('input',{bubbles:true}));await sleep(430);};
  await search('mt7');
  assert.equal(results.querySelectorAll('[data-fast-type=player]').length,1);
  assert.match(results.textContent,/LOUD/);
  assert.doesNotMatch(results.textContent,/FLUXO W7M/);
  await search('santos');
  assert(results.querySelector('[data-fast-type=staff][data-fast-id="person-123"]'));
  assert(results.querySelector('[data-fast-type=team][data-fast-id=santos]'));
  assert.match(results.textContent,/Sem equipe \/ F\/A/);
  await search('offline');
  assert(results.querySelector('[data-fast-id=offline]'));
  assert(queries.includes('mt7')&&queries.includes('santos'));
 }finally{dom.window.close();}
});

test('local suggestions stay fast while server lookup waits for a pause in typing',async()=>{
 const dom=new JSDOM('<input id="global-search-desktop"><div id="search-results-desktop"></div>',{url:'https://centralfreefire.com.br/index.html',runScripts:'outside-only'}),w=dom.window;
 const queries=[],input=w.document.querySelector('input'),results=w.document.querySelector('#search-results-desktop');
 w.requestIdleCallback=()=>{};w.AbortSignal=AbortSignal;
 w.fetch=async url=>{
  const target=String(url);
  if(target.includes('search-index-lite.json'))return {ok:true,json:async()=>staticIndex};
  if(target.includes('teams.json'))return {ok:true,json:async()=>({teams:[]})};
  queries.push(new URL(target).searchParams.get('query'));
  return {ok:true,json:async()=>({entries:[]})};
 };
 const type=q=>{input.value=q;input.dispatchEvent(new w.Event('input',{bubbles:true}));};
 try{
  w.eval(fs.readFileSync(require.resolve('../js/search-fast.min.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded',{bubbles:true}));
  type('mt7');await sleep(170);
  assert(results.querySelector('[data-fast-id=mt7]'));
  assert.deepEqual(queries,[]);
  type('sant');await sleep(120);type('santo');await sleep(120);type('santos');await sleep(430);
  assert.deepEqual(queries,['santos']);
  type('santos');await sleep(430);assert.deepEqual(queries,['santos']);
  type('ca');await sleep(120);type('');await sleep(430);
  assert.deepEqual(queries,['santos']);
 }finally{dom.window.close();}
});


test('Joker staff and LYON player are separate search suggestions even when the live career API is unavailable',async()=>{
 const actual=JSON.parse(fs.readFileSync(require.resolve('../search-index-lite.json'),'utf8'));
 const player=actual.items.find(x=>x.id==='joker'),coach=actual.items.find(x=>x.id==='joker-coach');
 assert.equal(player.type,'player');assert.match(player.sub,/LYON/i);
 assert.equal(coach.type,'staff');assert.match(coach.sub,/LOUD/);
 assert.equal(coach.url,'/carreira.html?id=joker-coach');
 assert.notEqual(player.id,coach.id);
 const dom=new JSDOM('<input id="global-search-desktop"><div id="search-results-desktop"></div>',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}),w=dom.window;
 w.requestIdleCallback=()=>{};w.AbortSignal=AbortSignal;
 w.fetch=async url=>String(url).includes('search-index-lite.json')?{ok:true,json:async()=>actual}:String(url).includes('teams.json')?{ok:true,json:async()=>({teams:[]})}:Promise.reject(Error('Quota Cloudflare excedida'));
 try{
  w.eval(fs.readFileSync(require.resolve('../js/search-fast.min.js'),'utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded',{bubbles:true}));
  const input=w.document.querySelector('#global-search-desktop');input.value='joker';input.dispatchEvent(new w.Event('input',{bubbles:true}));
  await sleep(500);
  const result=w.document.querySelector('#search-results-desktop');
  assert(result.querySelector('[data-fast-type="staff"][data-fast-id="joker-coach"]'));
  assert(result.querySelector('[data-fast-type="player"][data-fast-id="joker"]'));
  assert(result.querySelector('[data-fast-type="player"][data-fast-id="joker7"]'));
  input.value='joker coach';input.dispatchEvent(new w.Event('input',{bubbles:true}));await sleep(160);
  assert(result.querySelector('[data-fast-id="joker-coach"]'));
 }finally{w.close();}
});


test('LUUUKING is the same pictured Head Coach in instant and live search results, with no duplicate historic profile',async()=>{
 const actual=JSON.parse(fs.readFileSync(require.resolve('../search-index-lite.json'),'utf8'));
 const original=actual.items.filter(x=>x.id==='luuuking');
 assert.equal(original.length,1);
 assert.equal(original[0].type,'player');
 assert.equal(original[0].image,'/luuuking.webp');
 assert.match(original[0].sub,/Head Coach · FLUXO W7M/);
 const w=new JSDOM('<input id="global-search-desktop"><div id="search-results-desktop"></div>',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}).window;
 w.requestIdleCallback=()=>{};w.AbortSignal=AbortSignal;
 w.fetch=async url=>{
  const u=String(url);
  if(u.includes('search-index-lite.json'))return {ok:true,json:async()=>actual};
  if(u.includes('teams.json'))return {ok:true,json:async()=>({teams:[]})};
  return {ok:true,json:async()=>({entries:[{id:'luuuking',name:'LUUUKING',kind:'player',team:'FLUXO W7M',role:'head_coach',status:'active',photo:'silhueta.webp'}]})};
 };
 try{
  w.eval(fs.readFileSync(require.resolve('../js/search-fast.min.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded',{bubbles:true}));
  const input=w.document.querySelector('input'),result=w.document.querySelector('#search-results-desktop');
  input.value='luuuking';input.dispatchEvent(new w.Event('input',{bubbles:true}));await sleep(190);
  assert.equal(result.querySelectorAll('[data-fast-id=luuuking]').length,1);
  assert.equal(result.querySelector('[data-fast-id=luuuking] img').getAttribute('src'),'/luuuking.webp');
  assert.match(result.querySelector('[data-fast-id=luuuking] small').textContent,/Head Coach · FLUXO W7M/);
  await sleep(400);
  assert.equal(result.querySelectorAll('[data-fast-id=luuuking]').length,1);
  assert.equal(result.querySelector('[data-fast-id=luuuking] img').getAttribute('src'),'/luuuking.webp');
  assert.match(result.querySelector('[data-fast-id=luuuking] small').textContent,/Head Coach · FLUXO W7M/);
  assert.doesNotMatch(result.textContent,/Perfil histórico/);
 }finally{w.close();}
});
test('LUUUKING championship history and awards include verified coaching years without duplicating the athlete LBFF 1',()=>{
 const j=JSON.parse(fs.readFileSync(require.resolve('../player-data/titles-local.json'),'utf8'));
 const collective=j.collective.filter(x=>(x.players||[]).some(name=>name.toLowerCase()==='luuuking'));
 const personal=j.individual.filter(x=>x.player?.toLowerCase()==='luuuking');
 assert.equal(collective.length,11);
 assert.equal(personal.length,6);
 assert.equal(new Set(collective.map(x=>x.event+'|'+x.team)).size,collective.length);
 for(const event of ['LBFF 1','FFWS 2023','WB 2024','FFWS Global Finals 2024','WB 2025 S2','WB 2026 S2','C.O.P.A. Free Fire 2025','C.O.P.A. Free Fire 2026']){
  assert(collective.some(x=>x.event===event),event);
 }
 assert(collective.find(x=>x.event==='LBFF 1').type==='Campeão');
 assert(collective.filter(x=>x.event!=='LBFF 1').every(x=>x.team==='FLUXO W7M'||x.team==='MAGIC SQUAD'));
 assert(personal.some(x=>x.event==='WB 2026 S1'&&x.type.includes('Coach')));
 const hist=JSON.parse(fs.readFileSync(require.resolve('../player-data/historical.json'),'utf8')).players.luuuking;
 const current=JSON.parse(fs.readFileSync(require.resolve('../player-data/staff/fluxo-w7m.json'),'utf8')).players.luuuking;
 assert.equal(hist.photo,'/luuuking.webp');assert.equal(current.photo,'/luuuking.webp');
 assert.equal(hist.allTime.kills,116);
 assert.equal(hist.allTime.matches,167);
});

test('Nikeboy search does not announce an outdated team or switch shirt after live status arrives',async()=>{
 const dom=new JSDOM('<input id="global-search-desktop"><div id="search-results-desktop"></div>',{url:'https://centralfreefire.com.br/index.html',runScripts:'outside-only'}),w=dom.window;
 const input=w.document.querySelector('input'),box=w.document.querySelector('#search-results-desktop');
 w.requestIdleCallback=()=>{};w.AbortSignal=AbortSignal;
 w.fetch=async url=>{
  const target=String(url);
  if(target.includes('search-index-lite.json'))return {ok:true,json:async()=>({items:[{type:'player',id:'nikeboy',title:'Nikeboy',sub:'SX TET',image:'player-photos/s2/nikeboy.webp',aliases:[]}]})};
  if(target.includes('teams.json'))return {ok:true,json:async()=>({teams:[]})};
  await sleep(70);
  return {ok:true,json:async()=>({entries:[{id:'nikeboy',name:'Nikeboy',kind:'player',team:'',role:'player',status:'free_agent',photo:'outro-uniforme.webp'}]})};
 };
 try{
  w.eval(fs.readFileSync(require.resolve('../js/search-fast.min.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded',{bubbles:true}));
  input.value='nikeboy';input.dispatchEvent(new w.Event('input',{bubbles:true}));await sleep(180);
  assert.match(box.textContent,/Consultando situação atual/);
  assert.doesNotMatch(box.textContent,/SX TET/);
  assert.match(box.querySelector('img').getAttribute('src'),/player-photos\/s2\/nikeboy\.webp/);
  await sleep(400);
  assert.match(box.textContent,/Sem equipe \/ F\/A/);
  assert.equal(box.querySelectorAll('[data-fast-id=nikeboy]').length,1);
  assert.match(box.querySelector('img').getAttribute('src'),/player-photos\/s2\/nikeboy\.webp/);
 }finally{w.close();}
});

test('standalone career page shares the standard site header and navigation',()=>{
 const html=fs.readFileSync(require.resolve('../carreira.html'),'utf8');
 for(const id of ['cff-public-menu-open','cff-public-sidebar-nav','cff-public-search-input','cff-public-search-results','career-public-root'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/js\/shared-navigation\.js/);
 assert.match(html,/js\/public-shell\.min\.js/);
});
