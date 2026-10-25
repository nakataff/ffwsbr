import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function app(file,fetcher,{session=''}={}){
 const source=fs.readFileSync(new URL('../js/'+file,import.meta.url),'utf8');
 const tail=source.lastIndexOf('})();');
 const exports=file==='community-checkin.js'?'request,renderIdle':'request,load';
 const timers=new Map(),nodes=new Map(),calls=[];let id=0;
 const make=()=>({innerHTML:'',listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);}});
 for(const key of ['cff-checkin-panel','cff-checkin-start','cff-checkin-retry','#cff-community-rewards','#cff-rewards-retry'])nodes.set(key,make());
 const ctx=vm.createContext({AbortController,URLSearchParams,Date,String,Number,Math,Object,JSON,location:{pathname:'/interacoes.html'},window:{addEventListener(){}},document:{readyState:'loading',addEventListener(){},getElementById:id=>nodes.get(id),querySelector:key=>nodes.get(key)||null},localStorage:{getItem:()=>session,setItem(){}},console:{error(){}},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),fetch:(url,options)=>{calls.push({url,options});return fetcher(url,options);}});
 vm.runInContext(source.slice(0,tail)+`globalThis.hooks={${exports}};`+source.slice(tail),ctx);
 return {hooks:ctx.hooks,calls,nodes,timers,timeout:()=>{const item=[...timers.values()].find(x=>x.ms===12000);assert(item);item.fn();}};
}
for(const file of ['community-checkin.js','community-rewards.js']){
 test(file+': a stalled request times out and cleans the timer',async()=>{
  const a=app(file,(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout')))));
  const job=a.hooks.request('/api/test');const rejected=assert.rejects(job,/timeout/);a.timeout();await rejected;assert.equal(a.timers.size,0);
 });
 test(file+': timeout covers the JSON body too',async()=>{
  let signal;const a=app(file,(url,options)=>{signal=options.signal;return Promise.resolve({ok:true,json:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('body timeout'))))});});
  const job=a.hooks.request('/api/test');for(let i=0;i<20;i++)await Promise.resolve();const rejected=assert.rejects(job,/body timeout/);a.timeout();await rejected;assert.equal(a.timers.size,0);
 });
 test(file+': GET avoids unnecessary CORS preflight and POST preserves JSON',async()=>{
  const a=app(file,async()=>({ok:true,json:async()=>({ok:true})}));
  await a.hooks.request('/api/test');assert.equal(a.calls[0].options.headers['Content-Type'],undefined);
  await a.hooks.request('/api/test',{method:'POST',body:'{}'});assert.equal(a.calls[1].options.headers['Content-Type'],'application/json');assert.equal(a.calls[1].options.method,'POST');assert.equal(a.timers.size,0);
 });
 test(file+': a malformed successful body is an error and HTTP errors preserve status',async()=>{
  const a=app(file,async()=>({ok:true,json:async()=>{throw Error('bad JSON');}}));await assert.rejects(a.hooks.request('/api/test'),/bad JSON/);
  const b=app(file,async()=>({ok:false,status:503,json:async()=>{throw Error('bad JSON');}}));await assert.rejects(b.hooks.request('/api/test'),error=>error.status===503);
 });
}
test('check-in leaves Gerando código after a timeout and offers a retry',async()=>{
 const a=app('community-checkin.js',(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout')))));
 a.hooks.renderIdle();const job=a.nodes.get('cff-checkin-start').listeners.get('click')();assert.match(a.nodes.get('cff-checkin-panel').innerHTML,/Gerando código/);a.timeout();await job;assert.match(a.nodes.get('cff-checkin-panel').innerHTML,/Tentar novamente/);assert.doesNotMatch(a.nodes.get('cff-checkin-panel').innerHTML,/Gerando código/);assert.equal(a.calls.length,1);
});
test('weekly bonuses make no anonymous request; linked requests leave the spinner after timeout',async()=>{
 const a=app('community-rewards.js',()=>{throw Error('should not fetch');});await a.hooks.load();assert.equal(a.calls.length,0);assert.match(a.nodes.get('#cff-community-rewards').innerHTML,/Vincule seu Instagram/);
 const b=app('community-rewards.js',(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout')))),{session:'test-session'});
 const job=b.hooks.load();b.timeout();await job;assert.match(b.nodes.get('#cff-community-rewards').innerHTML,/Tentar novamente/);assert.equal(b.calls.length,1);
});
