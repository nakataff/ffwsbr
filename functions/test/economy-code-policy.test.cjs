'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const E=require('../economy'),C=require('../economy-code-policy'),chat=require('../global-chat');
const admin={uid:'admin',email:'admin@centralfreefire.com.br'},user={uid:'alice',provider:'google.com'},other={uid:'bob',provider:'google.com'},VERSION='20261101-code-policy-v1',BASE=Date.parse('2026-11-01T12:00:00-03:00');
function fixture(){
 const sqlite=new DatabaseSync(':memory:'),queries=[],data={},dbReads=[];let time=BASE;
 const sql={exec(q,...args){queries.push(q);if(!args.length&&q.includes(';')){sqlite.exec(q);return{toArray:()=>[]}}const s=sqlite.prepare(q),r=s.columns().length?s.all(...args):(s.run(...args),[]);return{toArray:()=>r}}};E.initEconomy(sql);
 for(const uid of ['alice','bob','admin'])data['userAccounts/'+uid+'/profile']={name:uid,username:uid,gender:'masculino'};
 const db={get:async p=>{dbReads.push(p);return structuredClone(data[p]??null)},transact:async(p,f)=>{const v=f(structuredClone(data[p]??null));data[p]=v;return structuredClone(v)},update:async v=>Object.assign(data,v),recentChat:async()=>Object.fromEntries(Object.entries(data).filter(([k,v])=>k.startsWith('globalChat/messages/')&&v).map(([k,v])=>[k.split('/').at(-1),v]))};
 const transaction=f=>{sqlite.exec('BEGIN');try{const r=f();sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}};
 const core=E.createEconomy({sql,transaction,db,now:()=>time,verifySession:async()=>({})}),rows=(q,...a)=>sql.exec(q,...a).toArray();
 const add=async(title='Dino',code='PRIVATECODE1234',imageUrl='')=>core.adminHandle(admin,{operation:'addStock',title,code,imageUrl,bucket:'shop'});
 const fund=async(uid='alice',delta=10000)=>core.adminHandle(admin,{operation:'adjust',targetUid:uid,delta,reason:'Teste',nonce:crypto.randomUUID()});
 const voucher=async(uid='alice')=>(await core.adminHandle(admin,{operation:'grantVoucher',targetUid:uid,expectedUsername:uid,expiresAt:time+86400000,message:'Teste',nonce:crypto.randomUUID()})).voucher;
 const buy=async(title='Dino',extra={},who=user)=>core.handle(who,{operation:'redeem',itemId:'code-default',codePolicyVersion:VERSION,codeChoice:{title,imageUrl:''},nonce:crypto.randomUUID(),...extra});
 const open=async(giftId,who=user)=>{let r=await core.openReservedCode(who,giftId);return r?.confirmation?core.openReservedCode(who,giftId,r.confirmation.word):r};
 return{core,sql,rows,db,data,queries,dbReads,add,fund,voucher,buy,open,time:t=>time=t,close:()=>sqlite.close()};
}
test('codes stay out of readable inventory until the correct server word; retries never reset the three-minute deadline',async()=>{
 const f=fixture();try{await f.add();await f.fund();const b=await f.buy(),path='communityCodeGifts/alice/'+b.giftId;assert.equal(b.reservationUntil,BASE+C.WINDOW);assert.equal(f.data[path].code,undefined);assert(!JSON.stringify(C.publicFeed(f.sql)).includes('PRIVATECODE'));assert(!JSON.stringify(await f.core.state(other)).includes('PRIVATECODE'));
 const challenge=await f.core.openReservedCode(user,b.giftId);assert(challenge.confirmation.word);assert(!JSON.stringify(challenge).includes('PRIVATECODE'));await assert.rejects(f.core.openReservedCode(user,b.giftId,'ERRADO'),{status:400});assert.equal(f.rows('SELECT openedAt FROM eco_code_reservations')[0].openedAt,0);assert.equal(await f.core.openReservedCode(other,b.giftId),null);
 f.time(BASE+60000);const opened=await f.core.openReservedCode(user,b.giftId,challenge.confirmation.word.toLowerCase());assert.equal(opened.gift.code,'PRIVATECODE1234');assert.equal(opened.gift.openedAt,BASE+60000);assert.equal((await f.open(b.giftId)).gift.openedAt,opened.gift.openedAt);assert.equal(E.nextCodeDeadline(f.sql),BASE+C.WINDOW);
 }finally{f.close()}
});
test('an opened code is published exactly after three minutes, never restocked or refunded, and remains in the quota',async()=>{
 const f=fixture();try{await f.add();await f.fund();const b=await f.buy();await f.open(b.giftId);f.time(BASE+C.WINDOW-1);f.core.releaseCodes();assert.equal(C.publicFeed(f.sql).entries.length,0);f.time(BASE+C.WINDOW);assert.equal(f.core.releaseCodes(),1);const pub=C.publicFeed(f.sql).entries;assert.equal(pub.length,1);assert.equal(pub[0].code,'PRIVATECODE1234');assert(!JSON.stringify(pub).includes('alice'));assert(!JSON.stringify(pub).includes('stockHash'));assert.equal(f.rows('SELECT receipt FROM eco_stock')[0].receipt,pub[0].id);assert.equal(f.rows('SELECT COUNT(*) AS n FROM eco_stock WHERE receipt IS NULL')[0].n,0);assert.equal(f.rows("SELECT COUNT(*) AS n FROM eco_ledger WHERE kind='code_refund'")[0].n,0);assert.equal(f.rows('SELECT balance FROM eco_wallet WHERE uid=?','alice')[0].balance,9000);assert.equal(f.core.releaseCodes(),0);const state=await f.core.state(user);assert.equal(state.codeStock.shop,0);assert.equal(state.codePolicy.used,1);await assert.rejects(f.core.adminHandle(admin,{operation:'returnCode',receiptId:pub[0].id,confirmUnused:true,bucket:'shop',reason:'Não pode reciclar'}),/divulgado publicamente/);
 }finally{f.close()}
});
test('an unopened voucher code is also public after the deadline, retains its spent voucher and can be read by the original owner',async()=>{
 const f=fixture();try{await f.add();const v=await f.voucher(),b=await f.buy('Dino',{payment:'voucher',voucherId:v.id});assert.equal(f.data['communityCodeGifts/alice/'+b.giftId].code,undefined);f.time(BASE+C.WINDOW);f.core.releaseCodes();const state=await f.core.state(user);assert.equal(state.vouchers.availableCount,0);assert.equal(state.vouchers.entries[0].status,'used');assert.equal(state.codePolicy.used,1);assert.equal(f.rows('SELECT COUNT(*) AS n FROM eco_code_returns')[0].n,0);assert.equal((await f.open(b.giftId)).gift.code,'PRIVATECODE1234');
 }finally{f.close()}
});
test('coin and voucher purchases share an atomic cap; reward duplicates ignore punctuation, accents, image and price changes',async()=>{
 const f=fixture();try{await f.fund();await f.add('Calça Dino','CODEPANTS111');await f.add('CALCA-DINO','CODEPANTS222');await f.add('Camisa','CODESHIRT111');await f.add('Mochila','CODEBAG111');const first=await f.buy('Calça Dino');await f.open(first.giftId);await assert.rejects(f.buy('CALCA-DINO'),/já resgatou/);const v=await f.voucher();const results=await Promise.allSettled([f.buy('Camisa',{payment:'voucher',voucherId:v.id}),f.buy('Mochila')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await f.core.state(user)).codePolicy.used,2);assert.equal(f.rows('SELECT COUNT(*) AS n FROM eco_receipts')[0].n,2);f.time(BASE+C.WINDOW);f.core.releaseCodes();assert.equal((await f.core.state(user)).codePolicy.remaining,0);
 f.time(Date.parse('2026-12-01T02:59:59Z'));assert.equal((await f.core.state(user)).codePolicy.remaining,0);f.time(Date.parse('2026-12-01T03:00:00Z'));assert.equal((await f.core.state(user)).codePolicy.remaining,2);await assert.rejects(f.buy('CALCA-DINO'),/já resgatou/);
 }finally{f.close()}
});
test('old purchases count toward limits without publishing legacy gifts; admin returns before the deadline cancel future publication',async()=>{
 const f=fixture();try{await f.add();await f.fund();const b=await f.buy();const receipt=f.rows('SELECT id FROM eco_receipts')[0].id;await f.core.adminHandle(admin,{operation:'returnCode',receiptId:receipt,confirmUnused:true,bucket:'shop',reason:'Teste sem uso'});f.time(BASE+C.WINDOW);f.core.releaseCodes();assert.equal(C.publicFeed(f.sql).entries.length,0);assert.equal((await f.core.state(user)).codePolicy.used,0);
 const hash=f.rows('SELECT hash FROM eco_stock')[0].hash,id=crypto.randomUUID();f.sql.exec('INSERT INTO eco_receipts VALUES(?,?,?,?,?,?,?,?)',id,'alice',crypto.randomUUID(),BASE,'redeem','code-default',JSON.stringify({stockHash:hash,giftId:'codegift-'+crypto.randomUUID(),result:{label:'Prêmio antigo'}}),'done');f.time(BASE+86400000);f.core.releaseCodes();assert.equal(C.publicFeed(f.sql).entries.length,0);assert.equal((await f.core.state(user)).codePolicy.used,1);
 }finally{f.close()}
});
test('clients must see the new policy before a new code purchase; expiry and publication never need Firebase reads',async()=>{
 const f=fixture();try{await f.add();await f.fund();await assert.rejects(f.buy('Dino',{codePolicyVersion:undefined}),/Recarregue/);assert.equal(f.rows('SELECT COUNT(*) AS n FROM eco_receipts')[0].n,0);const b=await f.buy();f.time(BASE+C.WINDOW);f.db.get=f.db.transact=f.db.update=async()=>{throw Error('No Firebase')};assert.equal(f.core.releaseCodes(),1);assert(C.publicFeed(f.sql).entries[0].code);assert.equal(f.rows('SELECT balance FROM eco_wallet WHERE uid=?','alice')[0].balance,9000);
 const plan=f.rows("EXPLAIN QUERY PLAN SELECT * FROM eco_code_reservations WHERE status='held' AND deadline<=? ORDER BY deadline LIMIT 100",BASE+C.WINDOW);assert(plan.some(r=>r.detail.includes('eco_code_reservations_due')));assert.equal(b.reservationUntil,BASE+C.WINDOW);
 }finally{f.close()}
});
test('automatic chat announcements are idempotent, bounded, disclose no buyer and retain the warning that the code may already be used',async()=>{
 const f=fixture();try{await f.add();await f.fund();await f.buy();f.time(BASE+C.WINDOW);f.core.releaseCodes();const p=C.publicFeed(f.sql).entries[0];const first=await chat.publishCodeNotice(f.db,p),again=await chat.publishCodeNotice(f.db,p);assert.equal(first.id,again.id);const messages=Object.entries(f.data).filter(([k])=>k.startsWith('globalChat/messages/'));assert.equal(messages.length,1);assert(messages[0][1].text.includes('PRIVATECODE1234'));assert(messages[0][1].text.includes('pode já ter sido resgatado'));assert(!JSON.stringify(messages).includes('alice'));assert.equal(f.data['globalChat/latest'].id,first.id);
 }finally{f.close()}
});
