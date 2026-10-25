const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setTimeout(r,0));};
const row=(id=1,extra={})=>({id,category:'reward',scope:'personal',sentAt:1792500000000,title:'Você recebeu um vale!',body:'Seu vale já está disponível na loja.',url:'/conta.html?tab=points&shopSection=vouchers',button:'Ver vale',read:false,...extra});
const page=(entries=[row()],snapshot=entries[0]?.id||0)=>({ok:true,entries,snapshot,summary:{hasNew:false,latest:snapshot}});
function fixture(handler=async(op)=>op==='inboxPreview'?page():{wallet:{balance:12},summary:{hasNew:false,latest:1}}){
 const dom=new JSDOM('<header><button data-account-entry>Perfil</button></header><main><button id="other">Outro</button></main>',{url:'https://centralfreefire.com.br/',runScripts:'outside-only'}),w=dom.window,calls=[],auth={currentUser:{uid:'alice'}},counts={modules:0};
 w.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 for(const p of ['wallet-balance.mjs','inbox-store.mjs','user-inbox.mjs','inbox-popover.mjs','header-wallet.mjs'])w.eval(fs.readFileSync('js/'+p,'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));
 const ui=w.createHeaderWallet({auth:()=>auth,request:async(_auth,op,b)=>{calls.push({uid:auth.currentUser?.uid,op,b});return handler(op,b);},loadInbox:async()=>{counts.modules++;return{createInboxPopover:w.createInboxPopover};}});ui.sync();
 const $=s=>w.document.querySelector(s);return{w,auth,ui,calls,counts,$,open:async()=>{$('[data-header-inbox]').click();await tick();},close:()=>{ui.stop();w.close();}};
}
test('header lazily opens six recent messages, retains the complete-inbox link and caches close/reopen without polling',async()=>{
 const f=fixture(async op=>op==='inboxPreview'?page(Array.from({length:9},(_,i)=>row(9-i)),9):{wallet:{balance:12}});try{
  await tick();assert.deepEqual(f.calls.map(c=>c.op),['wallet']);assert.equal(f.counts.modules,0);assert.equal(f.$('dialog'),null);assert(!f.w.document.querySelector('[data-inbox-popover-style]'));
  let intervals=0;f.w.setInterval=()=>intervals++;await f.open();assert.equal(f.counts.modules,1);assert(f.$('dialog').open);assert.equal(f.$('dialog').getAttribute('aria-labelledby'),'cff-inbox-popover-title');assert.equal(f.$('[data-header-inbox]').getAttribute('aria-expanded'),'true');assert.equal(f.$('dialog').querySelectorAll('details').length,6);assert.equal(f.$('.cff-inbox-popover-foot a').getAttribute('href'),'/conta.html?tab=inbox');assert.equal(f.w.document.activeElement,f.$('[data-inbox-close]'));
  f.$('[data-inbox-close]').click();await tick();assert(!f.$('dialog').open);assert.equal(f.w.document.activeElement,f.$('[data-header-inbox]'));await f.open();assert.equal(f.calls.filter(c=>c.op==='inboxPreview').length,1);assert.equal(intervals,0);assert.equal(f.w.localStorage.getItem('cff-inbox-summary-v1')?.includes('Seu vale'),false);assert.equal(f.w.document.querySelectorAll('[data-inbox-popover-style]').length,1);
 }finally{f.close();}
});
test('opening a message marks only that message, preserves its contents and escapes unsafe content and links',async()=>{
 const f=fixture(async(op,b)=>op==='inboxPreview'?page([row(1,{title:'<img src=x>',body:'<script>bad</script>\nTexto completo',url:'javascript:alert(1)'})]):{ok:true,wallet:{balance:12},summary:{hasNew:false,latest:1}});try{
  await f.open();assert(!f.$('dialog img,dialog script'));assert.equal(f.$('[data-inbox-open]'),null);assert.match(f.$('summary').textContent,/<img src=x>/);assert.equal(f.calls.filter(c=>c.op==='inboxRead').length,0);
  f.$('details').open=true;await tick();assert.equal(f.calls.filter(c=>c.op==='inboxRead').length,1);assert.equal(f.calls.find(c=>c.op==='inboxRead').b.id,1);assert(f.$('details').open);assert.match(f.$('.cff-inbox-popover-content p').textContent,/<script>bad<\/script>/);assert(f.$('[data-inbox-unread]').hidden);f.$('details').open=false;f.$('details').open=true;await tick();assert.equal(f.calls.filter(c=>c.op==='inboxRead').length,1);
 }finally{f.close();}
});
test('rapid clicks share one request, new metadata invalidates cache and refresh is throttled',async()=>{
 let release,now=1792500000000;const f=fixture(async op=>op==='inboxPreview'?new Promise(r=>release=r):{wallet:{balance:1}});try{f.w.Date.now=()=>now;f.$('[data-header-inbox]').click();f.$('[data-header-inbox]').click();await tick();assert.equal(f.counts.modules,1);assert.equal(f.calls.filter(c=>c.op==='inboxPreview').length,1);release(page());await tick();f.$('[data-inbox-refresh]').click();await tick();assert.equal(f.calls.filter(c=>c.op==='inboxPreview').length,1);
  f.$('[data-inbox-close]').click();f.w.publishInbox('alice',{latest:2,hasNew:true});await f.open();assert.equal(f.calls.filter(c=>c.op==='inboxPreview').length,2);release(page([row(2)],2));await tick();assert.equal(f.$('details').dataset.inboxItem,'2');f.$('[data-inbox-close]').click();now+=60001;await f.open();assert.equal(f.calls.filter(c=>c.op==='inboxPreview').length,3);release(page([row(2)],2));await tick();
 }finally{f.close();}
});
test('failed loads can retry and late private responses never cross accounts or survive destruction',async()=>{
 let fail=true,release;const f=fixture(async op=>{if(op==='inboxPreview'){if(fail)throw Error('Sem conexão');return new Promise(r=>release=r);}return{wallet:{balance:1}};});try{
  await f.open();assert.match(f.$('[role=status]').textContent,/Sem conexão/);assert(f.$('.cff-inbox-popover-foot a'));fail=false;f.$('[data-inbox-refresh]').click();await tick();f.auth.currentUser={uid:'bob'};f.ui.sync();assert.equal(f.$('dialog'),null);release(page([row(1,{title:'Privada de Alice'})]));await tick();assert(!f.w.document.body.textContent.includes('Privada de Alice'));await f.open();release(page([row(2,{title:'Mensagem de Bob'})],2));await tick();assert.match(f.$('dialog').textContent,/Mensagem de Bob/);
  f.auth.currentUser=null;f.ui.sync();assert.equal(f.$('dialog'),null);assert(f.$('[data-header-inbox]').hidden);
 }finally{f.close();}
});
test('a failed read leaves a retry button and external reward links retain safe navigation',async()=>{
 let fail=true;const f=fixture(async op=>{if(op==='inboxPreview')return page([row(1,{url:'https://example.test/prize'})]);if(op==='inboxRead'&&fail)throw Error('Falha ao marcar');return{wallet:{balance:1},summary:{hasNew:false,latest:1}};});try{
  await f.open();const a=f.$('[data-inbox-open]');assert.equal(a.target,'_blank');assert.match(a.rel,/noopener/);f.$('details').open=true;await tick();assert.match(f.$('[role=status]').textContent,/Falha ao marcar/);assert(!f.$('[data-inbox-read]').disabled);fail=false;f.$('[data-inbox-read]').click();await tick();assert(f.$('[data-inbox-read]').hidden);assert.equal(f.calls.filter(c=>c.op==='inboxRead').length,2);
 }finally{f.close();}
});
