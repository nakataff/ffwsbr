const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM,VirtualConsole}=require('jsdom');
const tick=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setTimeout(resolve,0));};
const item=(n,extra={})=>({key:'story:ig_user'+n+':s'+n,username:'user'+n,catalogKey:'account:2026-10-12',eventAt:Date.parse('2026-10-13T12:00:00-03:00'),weekStart:'2026-10-12',mediaUrl:'https://lookaside.fbsbx.com/story'+n+'.jpg',status:'pending',...extra});
async function fixture({items=[item(1),item(2),item(3)],respond,more=[]}={}){
 const dom=new JSDOM(fs.readFileSync('admin-stories.html','utf8'),{url:'https://centralfreefire.com.br/admin-stories.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()}),w=dom.window,calls=[];
 const auth={currentUser:{uid:'admin',email:'admin@centralfreefire.com.br',getIdToken:async()=>'test-token'}};let onAuth,listCalls=0;
 Object.assign(w,{AbortSignal,initializeApp:()=>({}),getApps:()=>[],getApp:()=>({}),getAuth:()=>auth,onAuthStateChanged:(_a,fn)=>{onAuth=fn;queueMicrotask(()=>fn(auth.currentUser));},CFF_CONFIG:{firebase:{}}});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.fetch=async(url,init)=>{
  const body=init.body?JSON.parse(init.body):null;calls.push({url:String(url),body});assert.equal(init.headers.Authorization,'Bearer test-token');
  let data;if(body){data=respond?await respond(body):{results:body.keys.map(key=>({key,ok:true,points:body.decision==='approve'?5:0,reversed:body.decision==='reject'&&[...items,...more].find(i=>i.key===key)?.status==='approved',story:{...[...items,...more].find(i=>i.key===key),status:body.decision==='approve'?'approved':'rejected'}}))};}
  else if(String(url).includes('/story-posts?'))data={posts:[{url:'https://www.instagram.com/p/TestPost/',publishedAt:Date.parse('2026-10-12T10:00:00-03:00'),label:'Post da Central'}]};
  else{listCalls++;data={stories:listCalls===1?items:more,counts:{pending:items.filter(i=>i.status==='pending').length,approved:items.filter(i=>i.status==='approved').length+more.length,rejected:0},cursor:listCalls===1&&more.length?'next-page':''};}
  return {ok:true,json:async()=>data};
 };
 w.eval(fs.readFileSync('js/admin-stories.js','utf8').replace(/^import .*\n/gm,''));await tick();
 return {w,auth,calls,get listCalls(){return listCalls;},get d(){return w.document;},async select(...indices){for(const i of indices)w.document.querySelectorAll('[data-select-story]')[i].click();await tick();},async approve(){w.document.querySelector('#sr-approve-selected').hidden=false;w.document.querySelector('#sr-approve-selected').click();await tick();},confirm(){const f=w.document.querySelector('#sr-review-form');f.elements.confirmSamePost.checked=true;},async submit(){w.document.querySelector('#sr-review-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();},logout(){auth.currentUser=null;onAuth(null);},close(){w.close();}};
}
test('queue filters loaded stories locally, selects at most twenty across weeks, and zooms without extra API reads',async()=>{
 const f=await fixture({items:[...Array.from({length:25},(_,i)=>item(i)),item(30,{weekStart:'2026-10-05',catalogKey:'account:2026-10-05'})]});try{
  assert.equal(f.listCalls,1);f.d.querySelector('#sr-select-visible').click();assert.equal(f.d.querySelectorAll('[data-select-story]:checked').length,20);
  const search=f.d.querySelector('#sr-search');search.value='@user30';search.dispatchEvent(new f.w.Event('input'));assert.equal(f.d.querySelectorAll('[data-select-story]:checked').length,0);assert.equal([...f.d.querySelectorAll('[data-key]')].filter(n=>!n.hidden).length,1);assert.equal(f.calls.length,1);
  f.d.querySelector('[data-key="'+item(30).key+'"] [data-preview-story]').click();assert(f.d.querySelector('#sr-preview-dialog').open);assert.match(f.d.querySelector('#sr-preview-image img').src,/story30/);assert.equal(f.calls.length,1);
  f.d.querySelector('#sr-close-preview').click();assert(!f.d.querySelector('#sr-preview-dialog').open);
 }finally{f.close();}
});
test('one approval request reviews a group, requires visual confirmation and updates the queue without reloading it',async()=>{
 const f=await fixture();try{
  await f.select(0,1);await f.approve();assert(f.d.querySelector('#sr-review-dialog').open);assert.equal(f.calls.filter(c=>c.url.includes('/story-posts?')).length,0);
  await f.submit();assert.equal(f.calls.filter(c=>c.body).length,0);assert.match(f.d.querySelector('#sr-review-feedback').textContent,/confirmação/);
  f.confirm();await f.submit();const sent=f.calls.find(c=>c.body).body;assert.deepEqual(sent.keys,[item(1).key,item(2).key]);assert.equal(sent.confirmSamePost,true);assert.equal(sent.auto,true);assert.equal(sent.postUrl,undefined);
  assert.equal(f.listCalls,1);assert.equal(f.d.querySelectorAll('[data-key]').length,1);assert.equal(f.d.querySelector('#sr-count-pending').textContent,'1');assert.equal(f.d.querySelector('#sr-count-approved').textContent,'2');assert.match(f.d.querySelector('#sr-message').textContent,/\+10 pontos/);assert(!f.d.querySelector('#sr-review-dialog').open);
 }finally{f.close();}
});
test('partial failure leaves only failed stories selected and does not consult Meta on retry',async()=>{
 let attempt=0;const f=await fixture({respond:body=>{attempt++;return{results:body.keys.map((key,i)=>attempt===1&&i===1?{key,ok:false,error:'Esta publicação já pontuou para essa pessoa.'}:{key,ok:true,points:5,story:{status:'approved'}})};}});try{
  await f.select(0,1);await f.approve();f.confirm();await f.submit();assert.equal(f.d.querySelectorAll('[data-select-story]:checked').length,1);assert.match(f.d.querySelector('.sr-card-message').textContent,/já pontuou/);
  await f.approve();assert.equal(f.calls.filter(c=>c.url.includes('/story-posts?')).length,0);const form=f.d.querySelector('#sr-review-form');assert.equal(form.elements.confirmSamePost.checked,false);
  form.elements.confirmSamePost.checked=true;await f.submit();assert.deepEqual(f.calls.filter(c=>c.body).at(-1).body.keys,[item(2).key]);assert.equal(f.listCalls,1);
 }finally{f.close();}
});
test('batch rejection has a shared reason, no post lookup and requires an explicit confirmation',async()=>{
 const f=await fixture();try{
  await f.select(0,1);f.d.querySelector('#sr-reject-selected').click();await tick();assert.match(f.d.querySelector('#sr-review-summary').textContent,/retirados/);assert.equal(f.calls.length,1);
  const form=f.d.querySelector('#sr-review-form');form.elements.reason.value='Publicação repetida';form.elements.reason.dispatchEvent(new f.w.Event('change'));await f.submit();assert.equal(f.calls.filter(c=>c.body).length,0);
  form.elements.confirmSamePost.checked=true;await f.submit();assert.equal(f.calls.filter(c=>c.body).length,1);assert.equal(f.calls.at(-1).body.note,'Publicação repetida');assert.equal(f.calls.at(-1).body.decision,'reject');assert.equal(f.listCalls,1);
 }finally{f.close();}
});
test('ambiguous network failures preserve the group for retry and ignore duplicate submissions while saving',async()=>{
 let rejectPending,resolvePending,attempt=0;const f=await fixture({respond:body=>{attempt++;if(attempt===1)return new Promise((resolve,reject)=>{resolvePending=resolve;rejectPending=reject;});return{results:body.keys.map(key=>({key,ok:true,alreadyReviewed:true,points:5,story:{status:'approved'}}))};}});try{
  await f.select(0);await f.approve();f.confirm();await f.submit();await f.submit();assert.equal(f.calls.filter(c=>c.body).length,1);assert(f.d.querySelector('#sr-review-submit').disabled);assert(resolvePending);
  rejectPending(Error('Falha de rede'));await tick();assert(f.d.querySelector('#sr-review-dialog').open);assert(!f.d.querySelector('#sr-review-submit').disabled);assert.match(f.d.querySelector('#sr-review-feedback').textContent,/não serão duplicadas/);assert.equal(f.d.querySelectorAll('[data-key]').length,3);
  await f.submit();assert.equal(f.calls.filter(c=>c.body).length,2);assert(!f.d.querySelector('#sr-review-dialog').open);assert(!f.d.querySelector('#sr-message').textContent.includes('+5 pontos'));
 }finally{f.close();}
});
test('pagination appends without re-fetching; approved credit can be rejected and counts updated',async()=>{
 const f=await fixture({items:[item(1,{status:'approved',verification:'auto'})],more:[item(2,{status:'approved',verification:'auto'})]});try{
  assert.match(f.calls[0].url,/status=approved/);assert(f.d.querySelector('#sr-approve-selected').hidden);assert.match(f.d.querySelector('.sr-status').textContent,/automaticamente/);
  f.d.querySelector('#sr-more').click();await tick();assert.equal(f.listCalls,2);assert.equal(f.d.querySelectorAll('[data-key]').length,2);assert.match(f.calls.at(-1).url,/cursor=next-page/);
  await f.select(0,1);f.d.querySelector('#sr-reject-selected').click();f.confirm();await f.submit();assert.equal(f.calls.at(-1).body.decision,'reject');assert.equal(f.d.querySelector('#sr-count-approved').textContent,'0');assert.equal(f.d.querySelector('#sr-count-rejected').textContent,'2');assert.match(f.d.querySelector('#sr-message').textContent,/pontos de stories retirados/);assert.equal(f.listCalls,2);
 }finally{f.close();}
});
test('logout clears previews and queue and discards a delayed administrative response',async()=>{
 let resolvePending;const f=await fixture({respond:()=>new Promise(resolve=>{resolvePending=resolve;})});try{
  await f.select(0);await f.approve();f.confirm();await f.submit();f.logout();resolvePending({results:[{key:item(1).key,ok:true,points:5,story:{status:'approved'}}]});await tick();
  assert(f.d.querySelector('#story-app').hidden);assert(!f.d.querySelector('#sr-review-dialog').open);assert.equal(f.d.querySelectorAll('[data-key]').length,0);assert(!f.d.querySelector('#sr-message').textContent.includes('+5'));
 }finally{f.close();}
});

test('archived miniatures replace expired Instagram URLs without extra listing fetches or changing moderation',async()=>{
 const old='https://lookaside.fbsbx.com/story1.jpg',preview='/api/admin/story-preview?key=story%3Aig_user1%3As1&expires=1793150000000&sig='+'a'.repeat(64);
 const f=await fixture({items:[item(1,{status:'approved',verification:'auto',mediaUrl:old,previewArchived:true,previewUrl:preview}),item(2,{status:'approved',mediaUrl:old,previewArchived:false,previewUrl:''})]});
 try{
  const first=f.d.querySelectorAll('.sr-card')[0],second=f.d.querySelectorAll('.sr-card')[1];
  assert(first.querySelector('img').getAttribute('src').startsWith('https://cff-instagram-community.nakataffb4.workers.dev/api/admin/story-preview?'));
  assert.match(first.textContent,/Miniatura temporária salva/);
  assert.equal(second.querySelector('img').getAttribute('src'),old);
  first.querySelector('[data-preview-story]').click();
  assert.match(f.d.querySelector('#sr-preview-image img').src,/\/api\/admin\/story-preview/);
  assert.equal(f.calls.length,1);
 }finally{f.close();}
});
