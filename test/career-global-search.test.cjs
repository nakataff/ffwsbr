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
