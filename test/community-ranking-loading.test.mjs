import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../interacoes.html',import.meta.url),'utf8');
const source=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes("const CACHE_PREFIX='cff-community-ranking-cache-v2:'"));
const PREFIX='cff-community-ranking-cache-v2:';
const NOW=Date.parse('2026-10-14T21:10:00Z');
const raw=(period='week',count=1,label='person',extra={})=>({updatedAt:NOW,period:{type:period,weekStart:'2026-10-12',weekEnd:'2026-10-18',monthKey:'2026-10'},users:Object.fromEntries(Array.from({length:count},(_,i)=>['ig_'+i,{username:label+i,points:count-i,comments:1,storyMentions:0,activeDays:1}])),...extra});
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function boot({saved={},storageBlocked=false,now=NOW,fetcher}={}){
  let clock=now,timerId=0;
  const timers=new Map(),nodes=new Map(),listeners=new Map(),windows=new Map(),calls=[];
  const storage=new Map(Object.entries(saved).map(([p,value])=>[PREFIX+p,JSON.stringify(value)]));
  const node=()=>({hidden:false,innerHTML:'',textContent:'',value:'',dataset:{},listeners:new Map(),classList:{add(){},remove(){},toggle(){}},addEventListener(name,fn){this.listeners.set(name,fn);}});
  for(const [,id] of html.matchAll(/\bid="([^"]+)"/g))nodes.set(id,node());
  const tabs=['week','month','all'].map(period=>Object.assign(node(),{dataset:{period}}));
  const document={hidden:false,getElementById:id=>nodes.get(id),querySelectorAll:()=>tabs,addEventListener:(name,fn)=>listeners.set(name,fn)};
  const ctx=vm.createContext({Intl,Date:class extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}},Number,String,Object,Array,Map,Set,JSON,AbortController,encodeURIComponent,console:{error(){}},document,window:{addEventListener:(name,fn)=>windows.set(name,fn)},localStorage:{getItem:key=>{if(storageBlocked)throw Error('blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(storageBlocked)throw Error('blocked');storage.set(key,value);}},setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),setInterval(){},fetch:(url,options)=>{
    const period=new URL(url).searchParams.get('period');
    if(fetcher){calls.push({period,options});return fetcher(period,options);}
    return new Promise((resolve,reject)=>{const item={period,options,resolve:data=>resolve({ok:true,json:async()=>data}),reject};calls.push(item);options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});
  }});
  vm.runInContext(source,ctx);
  return {nodes,calls,storage,timers,tab:p=>tabs.find(x=>x.dataset.period===p).listeners.get('click')(),search:q=>{nodes.get('ig-search').value=q;nodes.get('ig-search').listeners.get('input')();},visible:()=>listeners.get('visibilitychange')(),online:()=>windows.get('online')(),advance:ms=>{clock+=ms;},runTimer:ms=>{const entry=[...timers].find(([,x])=>x.ms===ms);assert(entry,'timer '+ms);timers.delete(entry[0]);entry[1].fn();}};
}
const rows=app=>(app.nodes.get('ig-tbody').innerHTML.match(/<tr>/g)||[]).length;

test('saved ranking renders immediately while a slow update is pending; only 20 rows are created and search keeps the true rank',async()=>{
 const a=boot({saved:{week:{savedAt:NOW-6*60_000,raw:raw('week',500)}}});
 assert.equal(rows(a),20);assert.equal(a.nodes.get('ig-stat-users').textContent,'500');assert.equal(a.calls.length,1);
 a.search('person499');assert.equal(rows(a),1);assert.match(a.nodes.get('ig-tbody').innerHTML,/500º/);
 a.search('');assert.equal(rows(a),20);
 a.calls[0].resolve(raw('week',25,'fresh'));await settle();
 assert.match(a.nodes.get('ig-tbody').innerHTML,/fresh0/);assert.equal(a.nodes.get('ig-stat-users').textContent,'25');
 assert(![...a.timers.values()].some(x=>x.ms===12000));
});

test('fresh cache opens without a request; a week/month from the previous period is never reused',()=>{
 const a=boot({saved:{week:{savedAt:NOW-60_000,raw:raw()}}});assert.equal(a.calls.length,0);assert.equal(rows(a),1);
 const wrong=raw('week',1,'old',{period:{type:'week',weekStart:'2026-10-05'}});
 const b=boot({saved:{week:{savedAt:NOW-60_000,raw:wrong}}});assert.equal(b.calls.length,1);assert.equal(b.nodes.get('ig-table').hidden,true);assert.doesNotMatch(b.nodes.get('ig-empty').innerHTML,/ainda não iniciado/);
 const c=boot({saved:{month:{savedAt:NOW-60_000,raw:raw('month',1,'old',{period:{type:'month',monthKey:'2026-09'}})}}});c.tab('month');assert.equal(c.calls.length,2);assert.equal(c.nodes.get('ig-table').hidden,true);
});

test('late response from a different tab cannot replace the selected period, but remains cached for the return',async()=>{
 const a=boot();a.tab('month');assert.equal(a.calls.length,2);
 a.calls[0].resolve(raw('week',1,'weekly'));await settle();
 assert.doesNotMatch(a.nodes.get('ig-tbody').innerHTML,/weekly/);
 a.calls[1].resolve(raw('month',1,'monthly'));await settle();assert.match(a.nodes.get('ig-tbody').innerHTML,/monthly0/);
 a.tab('week');assert.equal(a.calls.length,2);assert.match(a.nodes.get('ig-tbody').innerHTML,/weekly0/);
});

test('repeated focus events share one request and keep the last ranking visible through failure and retry',async()=>{
 const a=boot({saved:{week:{savedAt:NOW-6*60_000,raw:raw()}}});
 a.visible();a.visible();assert.equal(a.calls.length,1);
 a.calls[0].reject(Error('offline'));await settle();assert.equal(a.nodes.get('ig-table').hidden,false);assert.match(a.nodes.get('ig-status-text').textContent,/salva/);
 a.visible();assert.equal(a.calls.length,1);
 a.advance(60_000);a.runTimer(60_000);assert.equal(a.calls.length,2);
 a.calls[1].resolve(raw('week',2,'recovered'));await settle();assert.match(a.nodes.get('ig-tbody').innerHTML,/recovered/);
});

test('invalid API payload is an error, is not cached and never says the ranking has not started',async()=>{
 const a=boot();a.calls[0].resolve({ok:false,error:'unavailable'});await settle();
 assert.equal(a.storage.has(PREFIX+'week'),false);assert.match(a.nodes.get('ig-empty').innerHTML,/Não foi possível/);assert.doesNotMatch(a.nodes.get('ig-empty').innerHTML,/ainda não iniciado/);
});

test('timeout also covers a stalled JSON body and recovery can resume on the online event',async()=>{
 const a=boot({fetcher:(period,options)=>Promise.resolve({ok:true,json:()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('body timeout')),{once:true}))})});
 await settle();a.runTimer(12000);await settle();assert.match(a.nodes.get('ig-status-text').textContent,/indisponível/);assert.equal(a.calls.length,1);
 a.online();assert.equal(a.calls.length,2);
});

test('blocked local storage still keeps successful per-period results in memory',async()=>{
 const a=boot({storageBlocked:true});a.calls[0].resolve(raw('week',1,'weekly'));await settle();a.tab('month');a.calls[1].resolve(raw('month',1,'monthly'));await settle();a.tab('week');assert.equal(a.calls.length,2);assert.match(a.nodes.get('ig-tbody').innerHTML,/weekly/);
});

test('period boundaries follow Brasília rather than UTC',()=>{
 const now=Date.parse('2026-10-19T01:30:00Z');
 const a=boot({now,saved:{week:{savedAt:now-60_000,raw:raw()}}});assert.equal(a.calls.length,0);
 const later=Date.parse('2026-10-19T03:30:00Z');
 const b=boot({now:later,saved:{week:{savedAt:later-60_000,raw:raw()}}});assert.equal(b.calls.length,1);
});
