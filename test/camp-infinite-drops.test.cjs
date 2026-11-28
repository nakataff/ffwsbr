'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),{JSDOM,VirtualConsole}=require('jsdom');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function editor({unlimited=true,champion=false}={}){
 const html=fs.readFileSync('admin-camp-ao-vivo.html','utf8').replace(/<script\b[\s\S]*?<\/script>/g,'');
 const dom=new JSDOM(html,{url:'https://centralfreefire.com.br/admin-camp-ao-vivo.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}),w=dom.window;
 const data=JSON.parse(fs.readFileSync('admin-camp-ao-vivo/data/backup-ffws-br-2026-s2-final.json','utf8')),codes=data.selectedTeams.slice(0,2),[a,b]=codes;
 Object.assign(data.config,{tournamentName:'Final sem limite',quedas:'9',tournamentDays:1,cp:'110',finalMode:'champion',championEnabled:true,startingEnabled:false,detailMode:'detailed',v68ChampionRushUnlimited:unlimited,cffInterfaceMode:'complete'});
 data.config.cffTournamentPhasesV1={version:1,activeId:'final',phases:[{id:'final',name:'Final',teams:2,advance:1,days:1,firstDrops:9,laterDrops:9,format:'champion',cp:110,unlimited}]};
 data.selectedTeams=codes;data.startingPoints={[a]:0,[b]:0};data.drops=Array.from({length:9},(_,i)=>i===8?null:{points:{[a]:2,[b]:1},placements:{[a]:9,[b]:10},kills:{[a]:0,[b]:0},top12:{},booyah:'',map:'Bermuda'});
 if(champion){data.config.quedas='2';data.startingPoints[a]=100;data.config.startingEnabled=true;data.drops=[{points:{[a]:11,[b]:8},placements:{[a]:2,[b]:3},kills:{[a]:2,[b]:0},top12:{},booyah:'',map:'Bermuda'},{points:{[a]:12,[b]:9},placements:{[a]:1,[b]:2},kills:{[a]:0,[b]:0},top12:{},booyah:a,map:'Kalahari'}];}
 Object.assign(data.tournamentModeV1,{enabled:false,name:'Final',days:[],view:'day',editingDayId:'',draftDayNumber:1,rosterCodes:codes,draftActiveCodes:codes});
 w.fetch=async()=>({ok:false,json:async()=>({})});w.alert=()=>{};w.confirm=()=>true;w.document.execCommand=()=>true;w.HTMLElement.prototype.getClientRects=()=>[{}];w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.localStorage.setItem('ffws_autosave',JSON.stringify(data));w.localStorage.setItem('ffws_v41_interface_mode','complete');w.__CFF_CAMP_INITIAL_BACKUP__=data;
 const loader=fs.readFileSync('admin-camp-ao-vivo/app-loader.js','utf8');
 w.eval(loader.slice(loader.indexOf('  function restoreChampionPreferences('),loader.indexOf('  function restoreCloudHandoff(')));
 w.restoreChampionPreferences(data);
 const script=w.document.createElement('script');script.textContent=zlib.gunzipSync(fs.readFileSync('admin-camp-ao-vivo/app.js.gz')).toString().replace('window.onload = () => {','window.__INIT__ = () => {').replace(/window\.addEventListener\(\s*(['"])load\1\s*,/g,'window.addEventListener("cff:camp-core-ready",');w.document.body.append(script);
 w.__INIT__();w.dispatchEvent(new w.Event('cff:camp-core-ready'));w.__CFF_CAMP_READY__=true;
 for(const file of ['enhancements.js','launch-extras.js','tournament-setup.js','final-wiki.js','workspace.js','drop-controls.js']){const s=w.document.createElement('script');s.textContent=fs.readFileSync('admin-camp-ao-vivo/'+file,'utf8');w.document.body.append(s);}
 await wait(450);w.v41SetInterfaceMode('complete');await wait(60);w.CFF_CAMP_DROPS.refresh();
 return {w,codes,close:()=>w.close(),snapshot:()=>JSON.parse(JSON.stringify(w.collectBackupData(false)))};
}
test('Nova Queda extends 9 to 10 and beyond, saves the open edit, preserves earlier scores and persists the new count',{timeout:60000},async()=>{
 const h=await editor(),w=h.w;try{
  const select=w.document.getElementById('drop-num'),button=w.document.getElementById('cff-new-drop');
  assert.equal(select.options.length,9);assert.equal(button.hidden,false);assert.equal(button.disabled,false);
  select.value='9';w.loadDropData();const [a]=h.codes;
  const place=w.document.getElementById('place-'+a),kills=w.document.getElementById('kills-'+a);place.value='2';kills.value='7';
  const before=h.snapshot().drops.slice(0,8);button.click();await wait(100);
  assert.equal(select.options.length,10);assert.equal(select.value,'10');let after=h.snapshot();
  assert.deepEqual(after.drops.slice(0,8),before);assert.equal(after.drops[8].kills[a],7);assert.equal(after.drops[8].points[a],16);
  assert(Object.values(after.drops[9].points).every(v=>v===null));assert.equal(w.document.getElementById('champion-point').value,'110');
  for(let i=11;i<=13;i++){button.click();await wait(35);assert.equal(select.value,String(i));assert.equal(select.options.length,i);}
  after=h.snapshot();assert.equal(after.config.quedas,'13');assert.deepEqual(after.drops.slice(0,8),before);
  assert.equal(JSON.parse(w.localStorage.getItem('ffws_autosave')).drops.length,13);assert.equal(w.document.activeElement,select);
  assert.match(w.document.getElementById('cff-new-drop-status').textContent,/Queda 13 criada/);
 }finally{h.close();}
});
test('automatic extension still creates the tenth after the ninth is saved and the manual button then creates eleven',{timeout:60000},async()=>{
 const h=await editor(),w=h.w;try{
  const select=w.document.getElementById('drop-num');select.value='9';w.loadDropData();
  h.codes.forEach((code,i)=>{w.document.getElementById('place-'+code).value=String(i+9);w.document.getElementById('kills-'+code).value='0';});
  w.saveDrop();for(let i=0;i<60&&select.value!=='10';i++)await wait(25);assert.equal(select.options.length,10);assert.equal(select.value,'10');
  assert.equal(w.CFF_CAMP_DROPS.add(),true);await wait(60);assert.equal(select.options.length,11);
 }finally{h.close();}
});
test('opening a final never appends a drop by itself; fixed-length stages cannot use the new control',{timeout:60000},async()=>{
 const h=await editor({unlimited:false}),w=h.w;try{
  const button=w.document.getElementById('cff-new-drop');assert.equal(button.hidden,true);assert.equal(w.CFF_CAMP_DROPS.add(),false);assert.equal(h.snapshot().drops.length,9);
  w.document.getElementById('v68-champion-rush-unlimited').checked=true;w.document.getElementById('final-mode').value='classic';w.CFF_CAMP_DROPS.refresh();assert.equal(button.hidden,true);
 }finally{h.close();}
});
test('a legitimate Champion Rush winner prevents manual or automatic drops after the title',{timeout:60000},async()=>{
 const h=await editor({champion:true}),w=h.w;try{
  const before=h.snapshot().drops;w.CFF_CAMP_DROPS.refresh();assert.equal(w.document.getElementById('cff-new-drop').disabled,true);assert.equal(w.CFF_CAMP_DROPS.add(),false);assert.deepEqual(h.snapshot().drops,before);
 }finally{h.close();}
});
test('startup restores the saved unlimited flag, respects fixed stages and preserves other Champion Rush preferences',()=>{
 const w=new JSDOM('',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}).window;
 try{
  const loader=fs.readFileSync('admin-camp-ao-vivo/app-loader.js','utf8');w.eval(loader.slice(loader.indexOf('  function restoreChampionPreferences('),loader.indexOf('  function restoreCloudHandoff(')));
  const key='ffws_v68_champion_rush';w.localStorage.setItem(key,JSON.stringify({unlimited:false,showActivatedLogos:true}));
  w.restoreChampionPreferences({config:{v68ChampionRushUnlimited:true}});assert.deepEqual(JSON.parse(w.localStorage.getItem(key)),{unlimited:true,showActivatedLogos:true});
  w.restoreChampionPreferences({config:{v68ChampionRushUnlimited:false}});assert.equal(JSON.parse(w.localStorage.getItem(key)).unlimited,false);
  const before=w.localStorage.getItem(key);w.restoreChampionPreferences({config:{}});assert.equal(w.localStorage.getItem(key),before);
 }finally{w.close();}
});
