const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),E=require('../economy');
const user={uid:'person',provider:'google.com'};
function setup(){
 const sqlite=new DatabaseSync(':memory:'),sql={exec(q,...args){let out=[];for(const query of q.split(';').filter(s=>s.trim())){const st=sqlite.prepare(query);out=st.columns().length?st.all(...args):(st.run(...args),[]);}return out;}};E.initEconomy(sql);
 const data={'userAccounts/person/profile':{name:'Pessoa',username:'pessoa',gender:'masculino'},'communityInstagramLinks/person':{username:'pessoa'},'userAccounts/person/community':{session:'saved-session'}},db={get:async p=>structuredClone(data[p]||null)},calls={verify:0,checkin:0};let time=Date.parse('2026-10-14T15:00:00Z'),checked=false,offline=false,verified=true;
 const transaction=fn=>{sqlite.exec('BEGIN');try{const r=fn();sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}};
 const core=E.createEconomy({sql,db,transaction,now:()=>time,verifySession:async session=>{calls.verify++;assert.equal(session,'saved-session');if(offline)throw Error('offline');return {status:'verified',username:verified?'pessoa':'other_person',dayKey:E.dayKey(time),checkedInToday:checked};},communityCheckin:async session=>{calls.checkin++;assert.equal(session,'saved-session');if(offline)throw Error('offline');checked=true;return {ok:true,username:'pessoa',awarded:true,dayKey:E.dayKey(time)};}});
 return {core,sql,data,calls,setTime:t=>{time=t;checked=false;},setOffline:v=>offline=v,setChecked:v=>checked=v,setVerified:v=>verified=v};
}
test('profile checkin credits the wallet and the linked ranking with only the server saved session',async()=>{
 const s=setup();assert.deepEqual(await s.core.handle(user,{operation:'profileCheckinStatus'}),{ok:true,day:'2026-10-14',coins:false,ranking:false,wallet:{balance:0}});
 const r=await s.core.handle(user,{operation:'profileCheckin',session:'forged',username:'other',targetUid:'someone',points:9999});assert.equal(r.wallet.balance,1);assert.equal(r.coinsAwarded,true);assert.equal(r.rankingStatus,'done');assert.equal(r.ranking,true);assert.equal(r.coins,true);assert.equal(s.calls.checkin,1);
 const repeated=await s.core.handle(user,{operation:'profileCheckin'});assert.equal(repeated.coinsAwarded,false);assert.equal(repeated.rankingStatus,'done');assert.equal(s.calls.verify,1);assert.equal(s.calls.checkin,1);assert.equal((await s.core.state(user)).wallet.balance,1);
});
test('a ranking failure can be retried without losing or duplicating the wallet coin',async()=>{
 const s=setup();s.setOffline(true);let r=await s.core.handle(user,{operation:'profileCheckin'});assert.equal(r.rankingStatus,'error');assert.equal(r.coins,true);assert.equal(r.ranking,false);assert.equal(r.coinsAwarded,true);
 s.setOffline(false);r=await s.core.handle(user,{operation:'profileCheckin'});assert.equal(r.rankingStatus,'done');assert.equal(r.coinsAwarded,false);assert.equal((await s.core.state(user)).wallet.balance,1);
});
test('legacy wallet checkin and an existing ranking checkin are combined without repeating either reward',async()=>{
 const s=setup();await s.core.handle(user,{operation:'checkin'});s.setChecked(true);const r=await s.core.handle(user,{operation:'profileCheckin'});assert.equal(r.ranking,true);assert.equal(r.coinsAwarded,false);assert.equal(s.calls.checkin,0);assert.equal((await s.core.state(user)).wallet.balance,1);
});
test('unlinked and mismatching Instagram sessions never award another identity but allow the daily wallet coin',async()=>{
 const s=setup();s.setVerified(false);let r=await s.core.handle(user,{operation:'profileCheckin'});assert.equal(r.rankingStatus,'link_required');assert.equal(r.coins,true);assert.equal(s.calls.checkin,0);
 delete s.data['userAccounts/person/community'];r=await s.core.handle(user,{operation:'profileCheckin'});assert.equal(r.rankingStatus,'link_required');assert.equal(s.calls.verify,1);assert.equal(s.calls.checkin,0);
});
test('concurrent requests credit once and both checkins renew at Brasilia midnight',async()=>{
 const s=setup();const all=await Promise.all(Array.from({length:5},()=>s.core.handle(user,{operation:'profileCheckin'})));assert.equal(all.filter(r=>r.coinsAwarded).length,1);assert(all.every(r=>r.ranking));assert.equal(s.sql.exec('SELECT COUNT(*) AS n FROM eco_profile_checkins')[0].n,1);
 s.setTime(Date.parse('2026-10-15T02:59:59Z'));assert.equal((await s.core.handle(user,{operation:'profileCheckinStatus'})).coins,true);
 s.setTime(Date.parse('2026-10-15T03:00:00Z'));assert.equal((await s.core.handle(user,{operation:'profileCheckinStatus'})).coins,false);const r=await s.core.handle(user,{operation:'profileCheckin'});assert.equal(r.coinsAwarded,true);assert.equal(r.ranking,true);assert.equal((await s.core.state(user)).wallet.balance,2);
});
test('profile checkin keeps authentication and registration requirements',async()=>{
 const s=setup();await assert.rejects(s.core.handle({uid:'person',provider:'password'},{operation:'profileCheckin'}),{status:403});delete s.data['userAccounts/person/profile'];await assert.rejects(s.core.handle(user,{operation:'profileCheckin'}),{status:403});assert.equal(s.calls.checkin,0);assert.equal(s.sql.exec('SELECT COUNT(*) AS n FROM eco_ledger')[0].n,0);
});
