'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const E=require('../economy'),P=require('../season-pass');
const admin={uid:'admin',email:'admin@centralfreefire.com.br'},user={uid:'person',provider:'google.com'},friend={uid:'friend',provider:'google.com'},NOV=Date.parse('2026-11-01T12:00:00-03:00');
function fixture(){
 const sqlite=new DatabaseSync(':memory:'),queries=[],reads=[];
 const sql={exec(query,...args){queries.push({query,args});let result=[];for(const q of query.split(';').map(x=>x.trim()).filter(Boolean)){const stmt=sqlite.prepare(q);result=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);}return result;}};E.initEconomy(sql);
 let time=NOV,report={userKey:'instagram-person',username:'person',retroPoints:0,weeks:[],months:[],participationDays:[]};
 const data={};for(const id of ['person','friend','admin'])data['userAccounts/'+id+'/profile']={name:id,username:id,gender:'masculino'};
 data['communityProfileCatalog/frame-one']={title:'Moldura mensal',kind:'frame',enabled:true,accessRule:'manual'};data['communityProfileCatalog/badge-one']={title:'Concluiu o passe',kind:'badge',enabled:true,accessRule:'manual'};
 const db={get:async p=>{reads.push(p);return structuredClone(data[p]??null)},transact:async(p,fn)=>{data[p]=fn(structuredClone(data[p]??null));return data[p]},update:async changes=>Object.assign(data,changes)};
 const transaction=fn=>{sqlite.exec('BEGIN');try{const r=fn();sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}};
 const core=E.createEconomy({sql,transaction,db,ranking:{profile:async()=>structuredClone(report),podium:async()=>{throw Error('No podium expected')}},now:()=>time,random:()=>.25,verifySession:async s=>({status:'verified',username:s})});
 const pass=()=>P.create({sql,transaction,db,dayKey:E.dayKey,now:()=>time,credit:()=>{},eligible:()=>{},grantVoucher:()=>{},notify:()=>{}});
 const record=(uid,kind,day=E.dayKey(time))=>transaction(()=>pass().record(uid,kind,day));
 const earn=(uid='person',days=1)=>{for(let i=0;i<days;i++){const day='2026-11-'+String(i+1).padStart(2,'0');for(const kind of ['checkin','quiz','interaction'])record(uid,kind,day)}};
 const config=async()=>structuredClone((await core.adminHandle(admin,{operation:'passConfig',season:'2026-11'})).config);
 return {core,sql,data,db,queries,reads,record,earn,config,time:v=>{time=v},report:r=>{report={...report,...r}},close:()=>sqlite.close()};
}
const state=(f,u=user)=>f.core.handle(u,{operation:'passState'});
const claim=(f,level,revision=1,u=user)=>f.core.handle(u,{operation:'passClaim',season:'2026-11',level,expectedRevision:revision});
test('November is scheduled; Brasilia month boundaries, one hundred XP per day and no browser-selected identity',async()=>{
 const f=fixture();try{f.time(Date.parse('2026-11-01T02:59:59Z'));assert.equal((await state(f)).pass.status,'upcoming');await f.core.handle(user,{operation:'checkin'});assert.equal((await state(f)).pass.xp,0);
 f.time(Date.parse('2026-11-01T03:00:00Z'));await f.core.handle(user,{operation:'checkin',targetUid:'friend',xp:50000,day:'2026-11-30'});for(const kind of ['quiz','interaction'])f.record('person',kind);for(const kind of ['checkin','quiz','interaction'])f.record('person',kind);
 const r=(await state(f)).pass;assert.equal(r.xp,100);assert.equal(r.level,1);assert.equal(r.ready,1);assert.equal((await state(f,friend)).pass.xp,0);assert.equal(f.sql.exec('SELECT COUNT(*) AS n FROM eco_pass_days')[0].n,1);assert.equal(r.today.filter(x=>x.done).length,3);
 await assert.rejects(claim(f,2),{status:403});await assert.rejects(f.core.handle({}, {operation:'passState'}),{status:401});await assert.rejects(f.core.adminHandle(user,{operation:'passSave'}),{status:403});
 }finally{f.close()}
});
test('twenty participating days complete the pass; level claims credit exactly 150 coins and never spend ranking or wallet points',async()=>{
 const f=fixture();try{f.time(Date.parse('2026-11-20T15:00:00Z'));f.earn('person',20);assert.equal((await state(f)).pass.xp,2000);
 await Promise.all([claim(f,1),claim(f,1)]);for(let level=2;level<=20;level++)await claim(f,level);const r=await state(f);assert.equal(r.pass.ready,0);assert(r.pass.completed);assert.equal(r.wallet.balance,150);assert.equal(f.sql.exec("SELECT COUNT(*) AS n FROM eco_ledger WHERE kind='pass'")[0].n,20);assert.equal(f.sql.exec('SELECT COUNT(*) AS n FROM eco_pass_claims')[0].n,20);
 f.record('person','quiz','2026-11-20');f.record('person','checkin','2026-11-20');assert.equal((await state(f)).pass.xp,2000);assert.equal(r.pass.history[0].completed,true);
 }finally{f.close()}
});
test('the grace period freezes activity at month end and permits old reservations to finish after the deadline',async()=>{
 const f=fixture();try{f.earn();f.time(Date.parse('2026-12-01T03:00:00Z'));assert.equal((await f.core.handle(user,{operation:'passState',season:'2026-11'})).pass.status,'claiming');f.record('person','checkin','2026-12-01');assert.equal((await state(f)).pass.xp,100);await claim(f,1);
 f.time(Date.parse('2026-12-08T03:00:00Z'));assert.equal((await state(f)).pass.status,'ended');await assert.rejects(claim(f,2),{status:409});assert.equal((await claim(f,1)).wallet.balance,5);
 }finally{f.close()}
});
test('failed cosmetics remain reserved and retry gives one inventory gift; badges reach the existing badge inventory',async()=>{
 const f=fixture();try{const c=await f.config();c.rewards[0]={level:1,kind:'frame',assetId:'frame-one',title:'Moldura mensal'};c.rewards[1]={level:2,kind:'badge',assetId:'badge-one',title:'Concluiu o passe'};await f.core.adminHandle(admin,{operation:'passSave',config:c,expectedRevision:1});f.time(NOV+86400000);f.earn('person',2);
 const update=f.db.update;let failed=true;f.db.update=async changes=>{if(failed){failed=false;throw Error('temporary delivery outage')}return update(changes)};
 await assert.rejects(claim(f,1,2));assert.equal((await state(f)).pass.pending,1);f.time(Date.parse('2026-12-09T15:00:00Z'));await claim(f,1,2);assert(f.data['communityImageOwnership/person/frame-one']);assert.equal(Object.keys(f.data).filter(p=>p.startsWith('communityGifts/person/')).length,1);
 // Already reserved badge entitlement may be collected only before the deadline.
 f.time(NOV+86400000);await claim(f,2,2);assert.equal(f.data['communityBadgeOwnership/person/badge-one'],true);assert(f.data['communityBadgeGrants/person/pass-2026-11-2']);assert.equal((await state(f)).wallet.balance,0);
 }finally{f.close()}
});
test('limited vouchers are atomic and idempotent; later participants receive the disclosed coin fallback',async()=>{
 const f=fixture();try{const c=await f.config();c.rewards[0]={level:1,kind:'voucher',title:'Vale do passe',limit:1,fallbackCoins:25,expires:'2026-12-10'};await f.core.adminHandle(admin,{operation:'passSave',config:c,expectedRevision:1});f.earn();f.earn('friend');await Promise.all([claim(f,1,2),claim(f,1,2)]);const r=await claim(f,1,2,friend);assert.equal(r.reward.kind,'coins');assert.equal(r.wallet.balance,25);assert.equal(f.sql.exec('SELECT COUNT(*) AS n FROM eco_vouchers')[0].n,1);assert.equal(f.sql.exec('SELECT n FROM eco_pass_limits')[0].n,1);assert.equal((await state(f)).pass.rewards[0].remaining,0);assert.equal((await f.core.state(user)).vouchers.entries[0].source,'pass');
 }finally{f.close()}
});
test('configuration uses revision checks and protects progression, claimed rewards, voucher quotas and administrative-only assets',async()=>{
 const f=fixture();try{let c=await f.config();const initial=structuredClone(c);c.rewards[0].coins=7;await f.core.adminHandle(admin,{operation:'passSave',config:c,expectedRevision:1});await assert.rejects(f.core.adminHandle(admin,{operation:'passSave',config:c,expectedRevision:1}),{status:409});f.earn();await claim(f,1,2);c=await f.config();c.rewards[0].coins=8;await assert.rejects(f.core.adminHandle(admin,{operation:'passSave',config:c,expectedRevision:2}),{status:409});
 c=await f.config();c.xpPerLevel=50;await assert.rejects(f.core.adminHandle(admin,{operation:'passSave',config:c,expectedRevision:2}),{status:409});c=await f.config();c.published=false;await assert.rejects(f.core.adminHandle(admin,{operation:'passSave',config:c,expectedRevision:2}),{status:409});c=await f.config();c.enabled=false;await f.core.adminHandle(admin,{operation:'passSave',config:c,expectedRevision:2});f.time(NOV+86400000);f.record('person','quiz');assert.equal((await state(f)).pass.xp,100);await assert.rejects(claim(f,2,3),{status:409});
 f.data['communityProfileCatalog/admin-frame']={kind:'frame',enabled:true,accessRule:'admin'};c=await f.config();c.rewards[2]={level:3,kind:'frame',assetId:'admin-frame',title:'Admin'};await assert.rejects(f.core.adminHandle(admin,{operation:'passSave',config:c,expectedRevision:3}),{status:400});c=initial;c.rewards[2]={level:3,kind:'voucher',title:'Vale',limit:0,fallbackCoins:1,expires:'2026-12-10'};await assert.rejects(f.core.adminHandle(admin,{operation:'passSave',config:c,expectedRevision:3}),{status:400});
 }finally{f.close()}
});
test('profile teaser uses bounded local reads, no ranking synchronization, no Firebase and no writes; history and admin deliveries stay isolated',async()=>{
 const f=fixture();try{f.earn();await claim(f,1);f.queries.length=0;f.reads.length=0;const before=f.sql.exec('SELECT total_changes() AS n')[0].n;
 const r=await f.core.handle(user,{operation:'profileCheckinStatus',includePass:true});assert.equal(r.pass.level,1);assert(!r.pass.rewards);assert.equal(f.reads.length,0);assert.equal(f.sql.exec('SELECT total_changes() AS n')[0].n,before);assert(f.queries.length<12);assert(!f.queries.some(q=>/SELECT \* FROM eco_pass_progress/.test(q.query)));
 const other=await state(f,friend);assert.equal(other.pass.xp,0);assert.equal(other.pass.history.length,0);const list=await f.core.adminHandle(admin,{operation:'passDeliveries',season:'2026-11',offset:0});assert.equal(list.entries.length,1);assert.equal(list.entries[0].profile.username,'person');await assert.rejects(f.core.handle(user,{operation:'passDeliveries',season:'2026-11'}),{status:400});
 }finally{f.close()}
});
test('only server-confirmed quizzes and linked participation contribute; invalid, future and repeated days cannot farm XP',async()=>{
 const f=fixture();try{const questions=Array.from({length:3},(_,i)=>({id:'test-'+i,prompt:'Qual alternativa fictícia corresponde ao exemplo '+i+'?',category:'Teste',options:['A','B','C','D'],answer:0,explanation:'Resposta de teste',sourceUrl:'https://example.com/'+i,enabled:true}));await f.core.adminHandle(admin,{operation:'quizImport',questions});await f.core.adminHandle(admin,{operation:'quizSaveConfig',enabled:true,reward:5});let r=await f.core.handle(user,{operation:'quizStart'});
 for(let i=0;i<3;i++){r=await f.core.handle(user,{operation:'quizOpen',day:r.day,roundId:r.roundId,index:i});r=await f.core.handle(user,{operation:'quizAnswer',day:r.day,roundId:r.roundId,index:i,choice:i===0?1:0,includePass:true});}
 assert.equal(r.pass.xp,40);assert.equal(r.pass.today.find(x=>x.kind==='quiz').done,true);await f.core.handle(user,{operation:'quizAnswer',day:r.day,roundId:r.roundId,index:2,choice:0});assert.equal((await state(f)).pass.xp,40);
 f.data['communityInstagramLinks/person']={username:'person'};f.data['userAccounts/person/community']={session:'person'};f.report({participationDays:['2026-11-01','2026-11-01','2026-11-31','2026-11-02','garbage']});await f.core.handle(user,{operation:'passState',refreshInteractions:true});assert.equal((await state(f)).pass.xp,80);
 f.time(NOV+86400000);let next=await f.core.handle(user,{operation:'quizStart'});for(let i=0;i<3;i++)next=await f.core.handle(user,{operation:'quizSkip',day:next.day,roundId:next.roundId,index:i});assert.equal((await state(f)).pass.xp,80);
 }finally{f.close()}
});
