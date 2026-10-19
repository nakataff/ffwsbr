const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const tick=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setTimeout(resolve,0));};
function adminCoinsFixture(hash='',batches=[]){
 const dom=new JSDOM('<p id="eco-admin-status"></p><div id="eco-admin-root"></div>',{url:'https://centralfreefire.com.br/admin-pontos.html'+hash,runScripts:'outside-only'}),w=dom.window,calls=[],intervals=[];
 const auth={currentUser:{uid:'admin',email:'admin@centralfreefire.com.br'}};let onAuth;
 Object.assign(w,{getApps:()=>[{name:'[DEFAULT]'}],getAuth:()=>auth,getDatabase:()=>({}),ref:(_db,path)=>path,get:async()=>({val:()=>({})}),onAuthStateChanged:(_auth,fn)=>{onAuth=fn;},esc:String,prepareEconomyPhoto:async()=>'',setInterval:fn=>{intervals.push(fn);}});
 w.economyRequest=async(_auth,op,body)=>{calls.push({op,body});
  if(op==='dashboard')return {pending:[],counts:{},chances:[],shop:[],stock:[],gameOrderCounts:{}};
  if(op==='coinRanking')return {entries:[],total:0,totals:{balance:0,earned:0,spent:0},offset:body.offset||0,sort:body.sort||'balance',limit:20,hasMore:false,updatedAt:Date.now()};
  if(op==='syncCoinRanking')return batches.shift()||{checked:1,failed:0,pending:0,complete:true,nextCursor:''};
  throw Error('Unexpected operation '+op);
 };
 w.eval(fs.readFileSync(require.resolve('../js/admin-economy.js'),'utf8').replace(/^import .*\n/gm,''));
 return {w,calls,intervals,root:w.document.querySelector('#eco-admin-root'),start:async()=>{onAuth(auth.currentUser);await tick();},close:()=>w.close()};
}
test('opening and refreshing the admin ranking reads saved balances without checking every wallet or polling',async()=>{
 const a=adminCoinsFixture();try{
  await a.start();assert.deepEqual(a.calls.map(c=>c.op),['dashboard','coinRanking']);assert.equal(a.intervals.length,0);
  a.root.querySelector('[data-refresh-coins]').click();await tick();
  assert.deepEqual(a.calls.map(c=>c.op),['dashboard','coinRanking','coinRanking']);
  const order=a.root.querySelector('[data-coin-sort]');order.value='earned';order.dispatchEvent(new a.w.Event('change',{bubbles:true}));await tick();
  assert.equal(a.calls.at(-1).body.sort,'earned');assert(!a.calls.some(c=>c.op==='syncCoinRanking'));
 }finally{a.close();}
});
test('opening another admin tab loads the ranking only when requested and reuses it on tab switches',async()=>{
 const a=adminCoinsFixture('#eco-panel-stock');try{
  await a.start();assert.deepEqual(a.calls.map(c=>c.op),['dashboard']);
  a.root.querySelector('[data-admin-tab=ranking]').click();await tick();
  assert.deepEqual(a.calls.map(c=>c.op),['dashboard','coinRanking']);
  a.root.querySelector('[data-admin-tab=stock]').click();await tick();a.root.querySelector('[data-admin-tab=ranking]').click();await tick();
  assert.equal(a.calls.filter(c=>c.op==='coinRanking').length,1);assert(!a.calls.some(c=>c.op==='syncCoinRanking'));
 }finally{a.close();}
});
test('only the separate bonus button scans bounded batches, ignores duplicate clicks and then refreshes balances',async()=>{
 const a=adminCoinsFixture('',[{checked:5,failed:0,pending:0,complete:false,nextCursor:'wallet-5'},{checked:1,failed:0,pending:0,complete:true,nextCursor:''}]);try{
  await a.start();const button=a.root.querySelector('[data-sync-bonuses]');button.click();button.click();await tick();
  assert.deepEqual(a.calls.filter(c=>c.op==='syncCoinRanking').map(c=>c.body.cursor),['','wallet-5']);
  assert.equal(a.calls.at(-1).op,'coinRanking');assert(a.root.textContent.includes('6 carteiras'));assert(!button.disabled);
  assert(a.w.document.querySelector('#eco-admin-status').textContent.includes('manual concluída'));
 }finally{a.close();}
});
test('a partial bonus scan waits for an explicit continuation rather than a normal ranking refresh',async()=>{
 const a=adminCoinsFixture('',Array.from({length:13},(_,i)=>({checked:5,failed:0,pending:0,complete:i===12,nextCursor:i===12?'':'wallet-'+(i+1)})));try{
  await a.start();a.root.querySelector('[data-sync-bonuses]').click();await tick();assert.equal(a.calls.filter(c=>c.op==='syncCoinRanking').length,12);
  assert.match(a.root.querySelector('[data-sync-bonuses]').textContent,/Continuar/);
  a.root.querySelector('[data-refresh-coins]').click();await tick();assert.equal(a.calls.filter(c=>c.op==='syncCoinRanking').length,12);
  a.root.querySelector('[data-sync-bonuses]').click();await tick();assert.equal(a.calls.filter(c=>c.op==='syncCoinRanking').length,13);
  assert.equal(a.calls.filter(c=>c.op==='syncCoinRanking').at(-1).body.cursor,'wallet-12');
 }finally{a.close();}
});
function fixture(){const dom=new JSDOM('<div id="root"></div>',{url:'https://centralfreefire.com.br/conta.html',runScripts:'outside-only'}),w=dom.window;w.createCodeGiftOpener=()=>({open:async()=>true,stop(){}});w.esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const evaluate=path=>w.eval(fs.readFileSync(require.resolve('../'+path),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));evaluate('js/profile-checkin.mjs');return {w,root:w.document.querySelector('#root'),evaluate,close:()=>w.close()};}
test('profile checkin survives profile redraws, reports partial success and retries the ranking',async()=>{
 const a=fixture();try{const auth={currentUser:{uid:'person'}},calls=[];let complete=0;
  a.w.economyRequest=async(_auth,op)=>{calls.push(op);return op==='profileCheckinStatus'?{day:today(),coins:false,ranking:false}:{day:today(),coins:true,coinsAwarded:calls.filter(c=>c==='profileCheckin').length===1,ranking:calls.filter(c=>c==='profileCheckin').length>1,rankingStatus:calls.filter(c=>c==='profileCheckin').length>1?'done':'error'};};
  const ui=a.w.createProfileCheckin({auth:()=>auth,onCompleted:()=>complete++});ui.mount(a.root);assert(a.root.querySelector('button').disabled);ui.mount(a.root);await tick();assert.equal(calls.filter(c=>c==='profileCheckinStatus').length,1);
  a.root.querySelector('button').click();a.root.querySelector('button').click();await tick();assert.match(a.root.textContent,/moeda já está garantida/);assert.equal(a.root.querySelector('button').disabled,false);assert.equal(calls.filter(c=>c==='profileCheckin').length,1);
  const replacement=a.w.document.createElement('div');a.root.replaceWith(replacement);ui.mount(replacement);assert.match(replacement.textContent,/Confirmar no ranking/);replacement.querySelector('button').click();await tick();assert(replacement.querySelector('button').disabled);assert.match(replacement.textContent,/Concluído hoje/);assert.match(replacement.textContent,/ranking confirmado/);assert.equal(complete,1);
 }finally{a.close();}
});
test('profile status cannot display a previous account response after switching users',async()=>{
 const a=fixture();try{const auth={currentUser:{uid:'first'}},resolve=[];a.w.economyRequest=()=>new Promise(done=>resolve.push(done));const ui=a.w.createProfileCheckin({auth:()=>auth});ui.mount(a.root);auth.currentUser={uid:'second'};ui.mount(a.root);resolve[0]({day:today(),coins:true,ranking:true});await tick();assert.doesNotMatch(a.root.textContent,/Concluído hoje/);resolve[1]({day:today(),coins:false,ranking:false});await tick();assert.equal(a.root.querySelector('button').disabled,false);assert.match(a.root.textContent,/Fazer check-in/);
 }finally{a.close();}
});
test('the roulette explains voucher prizes and preserves monthly participation progress',async()=>{
 const a=fixture();try{const {WHEEL_PRIZES,prizeAngle,landingAngle,labelPosition}=await import('../js/economy-wheel.mjs');Object.assign(a.w,{WHEEL_PRIZES,prizeAngle,landingAngle,labelPosition,loadEconomyStyle:()=>{},attachPendingReferral:async()=>{}});
  const state={wallet:{balance:400,earned:400,spent:0},interactions:{status:'ready',username:'pessoa',participation:{daily:40,targetDays:25,cap:1000,days:10,credited:400}},chances:[{id:'code',chance:1}],referrals:[],inviteCode:'ABCDEF123456',signupClaimed:true,weekDays:1,codeStock:{roulette:2,shop:0},roulettePrizes:[{title:'Prêmio A',imageUrl:'/edition/item-a.webp',quantity:1},{title:'Prêmio B',imageUrl:'/edition/item-b.webp',quantity:1}],checkin:true,profileCheckin:{coins:true,ranking:false},shop:[],pending:[],ledger:[],paidInvitesThisMonth:0};
  const calls=[];a.w.economyRequest=async(_auth,op)=>{calls.push(op);if(op==='profileCheckin'){state.profileCheckin.ranking=true;return {day:today(),coins:true,ranking:true,coinsAwarded:false,rankingStatus:'done'};}return state;};Object.assign(a.w,await import('../js/economy-shop.mjs'));a.evaluate('js/economy-ui.js');const stop=a.w.mountEconomy(a.root,{auth:{currentUser:{uid:'person'}}});await tick();
  a.root.querySelector('[data-eco-tab=roulette]').click();assert.equal(a.root.querySelector('.eco-wheel-prize img').getAttribute('src'),'/edition/gift.webp');assert.equal(a.root.querySelectorAll('.eco-roulette-prizes img').length,1);assert.match(a.root.querySelector('.eco-roulette-prizes').textContent,/Você escolhe a recompensa/);assert.doesNotMatch(a.root.textContent,/Sem codiguinho disponível na roleta/);a.root.querySelector('[data-eco-tab=earn]').click();const goal=a.root.querySelector('.eco-monthly-goal');assert.match(goal.textContent,/25 dias = 1.000 CFF COINS/);assert.match(goal.textContent,/comentário válido ou Story aprovado/);assert.equal(goal.querySelector('progress').value,10);
  const button=a.root.querySelector('[data-eco="checkin"]');assert.equal(button.disabled,false);button.click();await tick();assert(calls.includes('profileCheckin'));assert.equal(a.root.querySelector('[data-eco="checkin"]').disabled,true);assert.match(a.root.querySelector('.eco-status').textContent,/ranking confirmado/);stop();
 }finally{a.close();}
});

test('integrated admin tabs keep weekly and inventory queries lazy and new shop codes request private control synchronization',async()=>{
 const a=adminCoinsFixture();try{
  a.w.eval(fs.readFileSync(require.resolve('../js/admin-economy-tools.mjs'),'utf8').replace(/^import .*\n/gm,'').replace(/^export /gm,''));
  const original=a.w.economyRequest,recipient={uid:'person',name:'Pessoa',username:'pessoa'};
  a.w.economyRequest=async(auth,op,body,admin)=>{if(['weeklyWinners','findVoucherRecipient','memberInventory','addStock'].includes(op)){a.calls.push({op,body});if(op==='weeklyWinners')return {entries:[],nextBefore:'2026-10-12'};if(op==='findVoucherRecipient')return {recipient};if(op==='memberInventory')return {recipient,category:'codes',entries:[],pending:[],hasMore:false,nextCursor:''};return {ok:true};}return original(auth,op,body,admin);};
  await a.start();assert.deepEqual(a.calls.map(c=>c.op),['dashboard','coinRanking']);
  a.root.querySelector('[data-admin-tab=winners]').click();await tick();assert.equal(a.calls.at(-1).op,'weeklyWinners');
  a.root.querySelector('[data-admin-tab=inventory]').click();await tick();assert.equal(a.calls.at(-1).op,'weeklyWinners');
  const search=a.root.querySelector('[data-tools-find]');search.elements.username.value='@pessoa';search.dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.deepEqual(a.calls.slice(-2).map(c=>c.op),['findVoucherRecipient','memberInventory']);assert.equal(a.calls.at(-1).body.targetUid,'person');
  a.root.querySelector('[data-add-shop-code]').click();const form=a.root.querySelector('#eco-stock');assert.equal(form.elements.bucket.value,'shop');form.elements.title.value='Prêmio teste';form.elements.code.value='PRIVATECODE123';form.dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await tick();const saved=a.calls.find(c=>c.op==='addStock');assert.equal(saved.body.catalogSync,true);assert.equal(saved.body.bucket,'shop');assert(!String(a.w.localStorage.getItem('cff-stock-updated-v1')).includes('PRIVATECODE123'));assert(!a.calls.some(c=>c.op==='syncCoinRanking'));
 }finally{a.close();}
});

test('roulette admin saves voucher validity with the existing odds request',async()=>{const a=adminCoinsFixture('#eco-panel-roulette');try{const original=a.w.economyRequest;a.w.economyRequest=async(auth,op,body,admin)=>{if(op==='saveChances'){a.calls.push({op,body});return {ok:true};}return original(auth,op,body,admin);};await a.start();const form=a.root.querySelector('#eco-chances');assert.equal(form.elements.voucherValidityDays.value,'30');form.elements.voucherValidityDays.value='7';form.dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));await tick();const saved=a.calls.filter(c=>c.op==='saveChances');assert.equal(saved.length,1);assert.equal(saved[0].body.voucherValidityDays,7);assert(!a.calls.some(c=>c.op==='syncCoinRanking'));}finally{a.close();}});
