'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM,VirtualConsole}=require('jsdom');
const source=fs.readFileSync('admin-camp-ao-vivo/persistence.js','utf8').replace(/async function firebase\(\)\{[\s\S]+?\n  function cloudStatus/,'async function firebase(){return window.testFirebase;}\n  function cloudStatus');
const read=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fixture=(kills=3)=>({version:17,selectedTeams:['ag.al'],drops:[{kills:{'ag.al':kills}}],config:{tournamentName:'Global Finals',summaryTableStyle:'compact',showDropColumns:false}});
async function mount(db,data){
 const dom=new JSDOM('<button id="cff-camp-cloud-open"></button><p id="cff-camp-cloud-status"></p><select id="drop-num"><option value="2">2</option></select>',{url:'https://centralfreefire.com.br/admin-camp-ao-vivo.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 const w=dom.window;w.__CFF_CAMP_READY__=true;w.collectBackupData=()=>data;w.confirm=()=>true;
 w.testFirebase={auth:{currentUser:{email:'admin@centralfreefire.com.br'},authStateReady:async()=>{}},ref:(_,path)=>path,get:async path=>({val:()=>db[path]||null}),runTransaction:async(path,write)=>{const next=write(db[path]||null);if(!next)return{committed:false};db[path]=next;return{committed:true}}};
 w.eval(source);await read(0);return w;
}
test('private draft keeps Wiki keys and settings; a stale PC cannot overwrite it and can stage restore',async()=>{
 const db={},mobile=await mount(db,fixture()),pc=await mount(db,fixture(1)),path='adminCampDraft/current';
 try{
  mobile.localStorage.setItem('ffws_v57_stable_features','{"headerWrap":true}');
  const save=w=>w.CFF_CAMP.persistence.saveRemoteAfterDrop(w.CFF_CAMP.persistence.saveLocalNow());
  assert.equal(await save(mobile),true);
  assert.equal(await save(pc),false);
  assert.match(pc.document.querySelector('#cff-camp-cloud-status').textContent,/Outro aparelho/);
  assert.deepEqual(Object.keys(db),[path]);
  pc.document.querySelector('#cff-camp-cloud-open').click();await read(20);
  const staged=JSON.parse(pc.sessionStorage.getItem('cff_camp_cloud_restore_v1'));
  assert.equal(staged.revision,db[path].revision);
  assert.deepEqual(staged.backup,fixture());
  assert.equal(staged.drop,'2');
  assert.equal(staged.preferences.ffws_v57_stable_features,'{"headerWrap":true}');
  assert.deepEqual(JSON.parse(pc.localStorage.getItem('cff_camp_before_cloud_v1')).backup,fixture(1));
  // Verify the real loader consumes the handoff before initializing the editor.
  const loader=fs.readFileSync('admin-camp-ao-vivo/app-loader.js','utf8').replace('  load();','  window.restoreCloudForTest=restoreCloudHandoff;');
  pc.eval(loader);assert.equal(pc.restoreCloudForTest().revision,staged.revision);
  assert.deepEqual(JSON.parse(pc.localStorage.getItem('ffws_autosave')),fixture());
  assert.equal(pc.localStorage.getItem('ffws_v57_stable_features'),staged.preferences.ffws_v57_stable_features);
  assert.equal(pc.restoreCloudForTest(),null);
 }finally{mobile.close();pc.close()}
});
