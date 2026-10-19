const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,0));
test('stock bridge imports only bounded incremental pages, caches checks and discards responses after locking',async()=>{
 const {createStockBridge}=await import('../js/admin-stock-bridge.mjs');let cursor=0,locked=false,reads=0;const imported=[];
 const source={inventory:()=>locked?null:[],bridgeCursor:()=>cursor,importStock:async(rows,next)=>{imported.push(...rows);cursor=next;}};
 const bridge=createStockBridge({source:()=>source,owner:()=>locked?'':'admin',request:async()=>{reads++;return {entries:reads===1?[{code:'FIXTURE'}]:[],nextCursor:1,hasMore:false};}});
 await bridge.sync();await bridge.sync();assert.equal(reads,1);assert.equal(imported.length,1);assert.equal(cursor,1);await bridge.sync(true);assert.equal(reads,2);
 let resolve;const late=createStockBridge({source:()=>source,owner:()=>locked?'':'admin',request:()=>new Promise(r=>resolve=r)});const pending=late.sync();locked=true;late.invalidate();resolve({entries:[{code:'SECRET'}],nextCursor:2,hasMore:false});await pending;assert.equal(imported.length,1);
});
function fixture(){
 const dom=new JSDOM('<body><div id="host"></div></body>',{url:'https://centralfreefire.com.br/admin-pontos.html',runScripts:'outside-only'}),w=dom.window,host=w.document.querySelector('#host'),calls=[];w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 w.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const person={uid:'person',name:'Pessoa vencedora',username:'pessoa'},record={week:'2026-10-12',end:'2026-10-18',winner:{instagram:'pessoainsta',points:123,recipient:person},award:null};
 const request=async(a,op,b,admin)=>{assert.equal(admin,true);calls.push({op,b});if(op==='weeklyWinners')return {entries:[record],nextBefore:'2026-10-12'};if(op==='grantWeeklyVoucher'){record.award={id:'voucher',sentAt:Date.now(),username:'pessoa'};return {ok:true};}if(op==='findVoucherRecipient')return {recipient:person};if(op==='memberInventory')return {recipient:person,category:b.category,entries:[{id:'gift1',title:'Presente recebido',kind:'code',sentAt:Date.now(),openedAt:0}],pending:[],hasMore:false,nextCursor:'gift1'};throw Error('Unexpected operation '+op);};
 w.eval(fs.readFileSync(require.resolve('../js/admin-economy-tools.mjs'),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));const auth={currentUser:{uid:'admin',email:'admin@centralfreefire.com.br'}};
 const tools=w.mountEconomyAdminTools(host,{auth,request});return {w,host,calls,tools,auth,close:()=>{tools.stop();w.close();}};
}
test('weekly tab loads on demand, confirms expiry in a dialog and stamps the awarded week',async()=>{
 const f=fixture();try{await tick();assert.deepEqual(f.calls.map(c=>c.op),['weeklyWinners']);assert.match(f.host.textContent,/@pessoainsta/);f.host.querySelector('[data-weekly-send]').click();const dialog=f.w.document.querySelector('dialog');assert(dialog.open);const form=dialog.querySelector('form');form.elements.expires.value='2026-12-01';form.elements.confirmed.checked=true;form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();const send=f.calls.find(c=>c.op==='grantWeeklyVoucher');assert.equal(send.b.targetUid,'person');assert.equal(send.b.week,'2026-10-12');assert.equal(send.b.expiresAt,Date.parse('2026-12-01T23:59:59.999-03:00'));assert.match(f.host.textContent,/VALE ENVIADO/);assert(!f.host.querySelector('[data-weekly-send]'));}finally{f.close();}
});
test('winner opens the selected persons inventory without downloading other profiles or opening a gift',async()=>{
 const f=fixture();try{await tick();f.host.querySelector('[data-weekly-inventory]').click();await tick();assert.equal(f.calls.filter(c=>c.op==='memberInventory').length,1);assert.equal(f.calls.at(-1).b.targetUid,'person');assert.match(f.host.textContent,/Entregue · ainda fechado/);assert.equal(f.host.querySelectorAll('[data-inventory-kind]').length,6);assert(!f.calls.some(c=>c.op==='openCodeGift'||c.op==='state'||c.op==='syncCoinRanking'));f.tools.stop();assert.equal(f.host.textContent,'');}finally{f.close();}
});
