const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setTimeout(r,0));};
function fixture(){
 const dom=new JSDOM('<div class="nav-desktop-right"><button data-account-entry>Perfil</button></div><div class="nav-mobile-right"><button data-account-entry>Perfil</button></div>',{url:'https://centralfreefire.com.br',runScripts:'outside-only'}),w=dom.window;
 for(const p of ['wallet-balance.mjs','inbox-store.mjs','header-wallet.mjs'])w.eval(fs.readFileSync(require.resolve('../js/'+p),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));
 return {w,auth:{currentUser:null},links:()=>[...w.document.querySelectorAll('[data-header-wallet]')],close:()=>w.close()};
}
test('desktop and mobile share one cached request, display exact balances and link to the shop',async()=>{
 const f=fixture();let calls=0;try{
  const ui=f.w.createHeaderWallet({auth:()=>f.auth,request:async(_auth,op)=>{assert.equal(op,'wallet');calls++;return {wallet:{balance:1234}};}});
  ui.sync();assert(f.links().every(n=>n.hidden));assert.equal(calls,0);
  f.auth.currentUser={uid:'one'};for(let i=0;i<15;i++)ui.sync();await tick();assert.equal(calls,1);
  for(const n of f.links()){assert(!n.hidden);assert.equal(n.querySelector('strong').textContent,'1.234');assert.equal(n.getAttribute('href'),'/conta.html?tab=points&shopSection=shop#eco-shop');assert.equal(n.querySelector('img').getAttribute('src'),'/edition/moeda%20cff.webp');assert.match(n.getAttribute('aria-label'),/1.234 CFF COINS/);}
  f.w.publishWalletBalance('one',{balance:2345});assert(f.links().every(n=>n.querySelector('strong').textContent==='2.345'));
  f.w.dispatchEvent(new f.w.Event('focus'));ui.sync();await tick();assert.equal(calls,1);assert.equal(f.w.document.querySelectorAll('[data-account-access-group]').length,2);ui.stop();
 }finally{f.close();}
});
test('a fresh cached balance survives navigation and profile/shop reads supply it without another header request',async()=>{
 const f=fixture();try{
  let calls=0;f.auth.currentUser={uid:'one'};f.w.publishInbox('one',{hasNew:false,latest:0});f.w.localStorage.setItem('cff-wallet-balance-v1',JSON.stringify({uid:'one',balance:98765,at:Date.now()}));
  const ui=f.w.createHeaderWallet({auth:()=>f.auth,request:async()=>{calls++;return {wallet:{balance:0}};}});ui.sync();await tick();assert.equal(calls,0);assert(f.links().every(n=>n.textContent.includes('98.765')));ui.stop();
  f.auth.currentUser={uid:'two'};f.w.publishInbox('two',{hasNew:false,latest:0});const deferred=f.w.createHeaderWallet({auth:()=>f.auth,request:async()=>{calls++;},defer:()=>true});deferred.sync();await tick();assert.equal(calls,0);assert(f.links().every(n=>n.querySelector('strong').textContent==='—'));
  f.w.publishWalletBalance('two',{balance:40});assert(f.links().every(n=>n.querySelector('strong').textContent==='40'));assert.equal(calls,0);deferred.stop();
 }finally{f.close();}
});
test('late responses cannot expose another accounts balance and logout clears the header and persisted cache',async()=>{
 const f=fixture();try{
  const resolves=[];const ui=f.w.createHeaderWallet({auth:()=>f.auth,request:()=>new Promise(r=>resolves.push(r))});f.auth.currentUser={uid:'one'};ui.sync();await tick();f.auth.currentUser={uid:'two'};ui.sync();await tick();
  resolves[0]({wallet:{balance:9999}});await tick();assert(f.links().every(n=>n.querySelector('strong').textContent==='—'));
  resolves[1]({wallet:{balance:5}});await tick();assert(f.links().every(n=>n.querySelector('strong').textContent==='5'));
  f.auth.currentUser=null;ui.sync();assert(f.links().every(n=>n.hidden));assert.equal(f.w.localStorage.getItem('cff-wallet-balance-v1'),null);ui.stop();
 }finally{f.close();}
});
test('errors never show a fabricated zero, repeated redraws back off and no polling is installed',async()=>{
 const f=fixture();try{
  let calls=0;f.auth.currentUser={uid:'one'};const ui=f.w.createHeaderWallet({auth:()=>f.auth,request:()=>{calls++;throw Error('offline');}});ui.sync();await tick();for(let i=0;i<10;i++)ui.sync();await tick();
  assert.equal(calls,1);assert(f.links().every(n=>n.querySelector('strong').textContent==='—'));assert(!fs.readFileSync(require.resolve('../js/header-wallet.mjs'),'utf8').includes('setInterval'));ui.stop();
 }finally{f.close();}
});
test('cache expires only on navigation/focus and an older header response cannot undo a recent checkin',async()=>{
 const f=fixture();try{
  let now=Date.now(),calls=0,release;f.w.Date.now=()=>now;f.auth.currentUser={uid:'one'};f.w.publishWalletBalance('one',{balance:50});f.w.publishInbox('one',{hasNew:false,latest:0});
  const ui=f.w.createHeaderWallet({auth:()=>f.auth,request:()=>{calls++;return new Promise(r=>release=r);}});ui.sync();await tick();assert.equal(calls,0);
  now+=5*60*1000+1;assert.equal(calls,0);f.w.dispatchEvent(new f.w.Event('focus'));await tick();assert.equal(calls,1);
  now++;f.w.publishWalletBalance('one',{balance:51});release({wallet:{balance:50}});await tick();assert(f.links().every(n=>n.querySelector('strong').textContent==='51'));ui.stop();
 }finally{f.close();}
});
test('economy responses publish only the signed-in accounts wallet and ignore administrator recipient wallets',async()=>{
 const f=fixture();try{
  f.w.eval(fs.readFileSync(require.resolve('../js/economy-client.mjs'),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));f.w.AbortSignal=AbortSignal;f.auth.currentUser={uid:'one',getIdToken:async()=> 'token'};
  f.w.fetch=async()=>({ok:true,json:async()=>({wallet:{balance:77}})});await f.w.economyRequest(f.auth,'state');assert.equal(f.w.walletSnapshot('one').balance,77);
  f.w.fetch=async()=>({ok:true,json:async()=>({wallet:{balance:999}})});await f.w.economyRequest(f.auth,'memberWallet',{},true);assert.equal(f.w.walletSnapshot('one').balance,77);
  let release;f.w.fetch=()=>new Promise(r=>release=r);const pending=f.w.economyRequest(f.auth,'wallet');await tick();f.auth.currentUser={uid:'two'};release({ok:true,json:async()=>({wallet:{balance:123}})});await assert.rejects(pending,/Sua conta mudou/);assert.equal(f.w.walletSnapshot('two'),null);
 }finally{f.close();}
});

test('new message dot refreshes independently from a cached wallet, including deferred account pages, without polling',async()=>{
 const f=fixture();try{let now=Date.now(),calls=[],release;f.w.Date.now=()=>now;f.auth.currentUser={uid:'one'};f.w.publishWalletBalance('one',{balance:50});
  let intervals=0;f.w.setInterval=()=>intervals++;
  const ui=f.w.createHeaderWallet({auth:()=>f.auth,defer:()=>true,request:async(_auth,op)=>{calls.push(op);return new Promise(r=>release=r);}});
  for(let i=0;i<10;i++)ui.sync();await tick();assert.deepEqual(calls,['inboxSummary']);release({summary:{hasNew:true,latest:5}});await tick();assert([...f.w.document.querySelectorAll('[data-header-inbox] i')].every(n=>!n.hidden));assert(f.links().every(n=>n.textContent.includes('50')));
  f.w.dispatchEvent(new f.w.Event('focus'));await tick();assert.equal(calls.length,1);
  now+=60001;assert.equal(calls.length,1);f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));await tick();assert.deepEqual(calls,['inboxSummary','inboxSummary']);
  now++;f.w.publishInbox('one',{hasNew:false,latest:5});release({summary:{hasNew:true,latest:5}});await tick();assert([...f.w.document.querySelectorAll('[data-header-inbox] i')].every(n=>n.hidden),'an older check cannot restore a dot after opening messages');assert.equal(intervals,0);
  assert.match(fs.readFileSync('css/header-wallet.css','utf8'),/background:#ff4655/);ui.stop();
 }finally{f.close();}
});
