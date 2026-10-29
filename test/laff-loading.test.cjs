'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM,VirtualConsole}=require('jsdom');
const read=p=>fs.readFileSync(p,'utf8'),wait=ms=>new Promise(r=>setTimeout(r,ms));
async function editor({fail=false,shell=false}={}) {
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(['classificatoria','equipes','mvp','stats','datas','selecoes','team-profile','player-profile'].map(id=>`<div class="page ${id==='classificatoria'?'active':''}" id="laff-${id}"><div id="laff-${id}-content"></div></div>`).join(''),{url:'https://centralfreefire.com.br/index.html#laff-classificatoria',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window,calls=[],scripts=[];let offline=fail;
 w.scrollTo=()=>{};w.alert=()=>{};w.navigate=id=>w.document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));
 w.loadMercado=()=>{throw Error('Historical LAFF must not load the live market')};w.loadTeamLogos=()=>{throw Error('LAFF must not wait for a Google Sheet')};
 w.fetch=async url=>{const path=decodeURI(new URL(String(url),w.location.href).pathname).slice(1);calls.push(path);if(offline&&path==='dados laff/classificacao.json')return{ok:false,status:503};assert(/^(dados laff\/|team-data\/logo-map.json)/.test(path),'unexpected dependency '+path);const text=read(path);return{ok:true,text:async()=>text,json:async()=>JSON.parse(text)};};
 // Deliberately load after DOMContentLoaded: this is how the real lazy shell runs.
 await wait(0);
 if(shell){
  const append=w.document.head.appendChild.bind(w.document.head);
  w.document.head.appendChild=node=>{const result=append(node);if(node.tagName==='SCRIPT'){
   const path=new URL(node.src).pathname.slice(1);scripts.push(path);
   if(!['js/team-logo-resolver.min.js','js/laff.min.js'].includes(path)){node.onerror?.();return result;}
   w.eval(read(path));node.onload?.();
  }return result;};
  w.eval(read('js/site-shell-fast.min.js'));await w.cffEnsureRoute('laff-classificatoria');
 }else{w.eval(read('js/team-logo-resolver.min.js'));w.eval(read('js/laff.min.js'));}
 return {w,calls,scripts,errors,online:()=>offline=false,close:()=>w.close()};
}
test('LAFF loads lazily after DOM ready, with official standings and no legacy/Sheets/market dependency',async()=>{
 const f=await editor({shell:true});try{
  await wait(950);const d=f.w.document;
  assert.equal(d.querySelectorAll('.laff-classificacao-table tbody tr').length,24);assert(d.querySelector('#laff-classificatoria-content').textContent.includes('KABUM! FDS'));
  const row=[...d.querySelectorAll('.laff-classificacao-table tbody tr')].find(r=>r.textContent.includes('KABUM! FDS'));assert(row.textContent.includes('208'));assert(row.querySelector('img').src.includes('kabum-fds.webp'));
  assert.deepEqual(f.scripts,['js/team-logo-resolver.min.js','js/laff.min.js']);assert.equal(f.calls.filter(p=>p==='dados laff/classificacao.json').length,1);
  const count=f.calls.length;await f.w.cffEnsureRoute('laff-equipes');await f.w.cffEnsureRoute('laff-classificatoria');await f.w.loadLAFFData();assert.equal(f.calls.length,count);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('phase switches retain official rows and reuse previously loaded stages',async()=>{
 const f=await editor();try{
  await f.w.loadLAFFData();await wait(950);
  f.w.cffSetLAFFTablePhase('repescagem');await wait(30);let rows=f.w.document.querySelectorAll('.laff-classificacao-table tbody tr');assert.equal(rows.length,12);assert([...rows].some(r=>r.textContent.includes('KABUM! FDS')&&r.textContent.includes('48')));
  f.w.cffSetLAFFTablePhase('final');await wait(30);rows=f.w.document.querySelectorAll('.laff-classificacao-table tbody tr');assert.equal(rows.length,12);assert(rows[0].textContent.includes('CPT VOX'));assert(rows[0].textContent.includes('200'));
  f.w.cffSetLAFFTablePhase('repescagem');await wait(30);assert.equal(f.calls.filter(p=>p==='dados laff/repescagem.json').length,1);assert.equal(f.calls.filter(p=>p==='dados laff/final.json').length,1);assert.deepEqual(f.errors,[]);
 }finally{f.close();}
});
test('an unavailable classification shows recovery, and a retry loads real results instead of invented zeroes',async()=>{
 const f=await editor({fail:true});try{
  await assert.rejects(f.w.loadLAFFData());await wait(950);const root=f.w.document.getElementById('laff-classificatoria-content');assert(root.textContent.includes('Não foi possível carregar'));assert.equal(root.querySelectorAll('tbody tr').length,0);
  f.online();root.querySelector('button[onclick]').click();await wait(60);assert.equal(root.querySelectorAll('tbody tr').length,24);assert(root.textContent.includes('309'));
 }finally{f.close();}
});
