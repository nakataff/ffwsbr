const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),E=require('../economy');
const admin={uid:'admin',email:'admin@centralfreefire.com.br'},user={uid:'person',provider:'google.com'},now=Date.parse('2026-10-19T12:00:00-03:00');
const nonce='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture(){
 const sqlite=new DatabaseSync(':memory:'),queries=[],firebase=[],data={'userAccounts/person/profile':{name:'Campeão',username:'campeaocff',gender:'masculino',avatarId:'avatar-1'},'communityRankingProfiles/heroinsta':{uid:'person'}};
 const sql={exec(q,...args){queries.push({q,args});let result=[];for(const part of q.split(';').filter(s=>s.trim())){const s=sqlite.prepare(part);result=s.columns().length?s.all(...args):(s.run(...args),[]);}return result;}};E.initEconomy(sql);
 const db={get:async p=>{firebase.push({path:p});return structuredClone(data[p]??null);},transact:async(p,fn)=>data[p]=fn(data[p]??null),query:async(path,params)=>{firebase.push({path,params});let rows=Object.entries(data[path]||{}).sort(([a],[b])=>a.localeCompare(b));if(params.startAt)rows=rows.filter(([id])=>id>=params.startAt);return Object.fromEntries(rows.slice(0,params.limitToFirst));}};
 const ranking={calls:[],async podium(type,key){this.calls.push(key);return {type,key,top3:[{userKey:'instagram-key',position:1,points:123}]};},async identity(){return {username:'heroinsta'};}};
 const transaction=fn=>{sqlite.exec('BEGIN');try{const r=fn();sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}};
 const core=E.createEconomy({sql,transaction,db,ranking,now:()=>now});
 return {core,sql,db,data,queries,firebase,ranking,close:()=>sqlite.close()};
}
test('stock bridge is admin-only, incrementally paginated and retries never duplicate its index',async()=>{
 const f=fixture();try{
  for(let i=0;i<52;i++)await f.core.adminHandle(admin,{operation:'addStock',code:'STOCKCODE'+String(i).padStart(3,'0'),title:'Presente '+i,bucket:'shop',catalogSync:true});
  await f.core.adminHandle(admin,{operation:'addStock',code:'STOCKCODE000',title:'Presente 0',bucket:'shop',catalogSync:true});
  const first=await f.core.adminHandle(admin,{operation:'stockBridge'});assert.equal(first.entries.length,50);assert.equal(first.hasMore,true);assert.equal(first.entries[0].code,'STOCKCODE000');
  const second=await f.core.adminHandle(admin,{operation:'stockBridge',cursor:first.nextCursor});assert.equal(second.entries.length,2);assert.equal(second.hasMore,false);
  const empty=await f.core.adminHandle(admin,{operation:'stockBridge',cursor:second.nextCursor});assert.deepEqual(empty.entries,[]);assert.equal(f.sql.exec('SELECT COUNT(*) AS n FROM eco_stock_bridge')[0].n,52);
  await assert.rejects(f.core.adminHandle(user,{operation:'stockBridge'}),{status:403});await assert.rejects(f.core.handle(user,{operation:'stockBridge'}),{status:403});
 }finally{f.close();}
});
test('weekly leaders use closed periods frozen once instead of rebuilding the historical ranking on every view',async()=>{
 const f=fixture();try{
  const r=await f.core.adminHandle(admin,{operation:'weeklyWinners'});assert.equal(r.entries.length,4);assert.equal(r.entries[0].week,'2026-10-12');assert.equal(r.entries[0].winner.recipient.uid,'person');assert.equal(r.entries[0].winner.points,123);assert.equal(f.ranking.calls.length,4);
  await f.core.adminHandle(admin,{operation:'weeklyWinners'});assert.equal(f.ranking.calls.length,4);assert.equal(f.sql.exec('SELECT COUNT(*) AS n FROM eco_interaction_periods')[0].n,4);
  await assert.rejects(f.core.adminHandle(admin,{operation:'weeklyWinners',before:'2026-10-19'}),{status:400});await assert.rejects(f.core.adminHandle(user,{operation:'weeklyWinners'}),{status:403});
 }finally{f.close();}
});
test('weekly voucher binds the real winner to one award per week including concurrent and lost-response retries',async()=>{
 const f=fixture();try{
  const b={operation:'grantWeeklyVoucher',week:'2026-10-12',targetUid:'person',expectedUsername:'campeaocff',expiresAt:now+86400000,message:'Campeão da semana',nonce};
  const [a,c]=await Promise.all([f.core.adminHandle(admin,b),f.core.adminHandle(admin,{...b,nonce:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'})]);assert.equal(a.voucher.id,c.voucher.id);assert.equal(f.sql.exec('SELECT COUNT(*) AS n FROM eco_vouchers')[0].n,1);assert.equal(f.sql.exec('SELECT COUNT(*) AS n FROM eco_weekly_voucher_awards')[0].n,1);
  const retry=await f.core.adminHandle(admin,b);assert.equal(retry.duplicate,true);
  const page=await f.core.adminHandle(admin,{operation:'weeklyWinners'});assert.equal(page.entries[0].award.id,a.voucher.id);assert.equal(page.entries[0].award.sentAt,now);
  await assert.rejects(f.core.adminHandle(admin,{...b,targetUid:'other'}),{status:409});await assert.rejects(f.core.adminHandle(admin,{...b,expiresAt:now+2*86400000}),{status:409});
  await assert.rejects(f.core.adminHandle(admin,{...b,week:'2026-10-19'}),{status:400});
 }finally{f.close();}
});
test('a nonlinked weekly winner is visible but cannot receive a voucher through an arbitrary recipient',async()=>{
 const f=fixture();try{delete f.data['communityRankingProfiles/heroinsta'];const r=await f.core.adminHandle(admin,{operation:'weeklyWinners'});assert.equal(r.entries[0].winner.recipient,null);await assert.rejects(f.core.adminHandle(admin,{operation:'grantWeeklyVoucher',week:'2026-10-12',targetUid:'person',expectedUsername:'campeaocff',expiresAt:now+86400000,message:'Prêmio',nonce}),{status:409});assert.equal(f.sql.exec('SELECT COUNT(*) AS n FROM eco_vouchers')[0].n,0);}finally{f.close();}
});
test('inventory is bounded to one recipient, strips private codes and never opens gifts or changes ownership',async()=>{
 const f=fixture();try{
  const gifts=Object.fromEntries(Array.from({length:45},(_,i)=>['gift-'+String(i).padStart(3,'0'),{title:'Prêmio '+i,code:'NEVER-EXPOSE-THIS',sentAt:now+i,openedAt:i===0?now:0,archivedAt:i===1?now:0}]));f.data['communityCodeGifts/person']=gifts;
  const before=f.sql.exec('SELECT total_changes() AS n')[0].n;
  const a=await f.core.adminHandle(admin,{operation:'memberInventory',targetUid:'person',category:'codes'});assert.equal(a.entries.length,20);assert.equal(a.hasMore,true);assert.equal(a.entries[0].openedAt,now);assert(!JSON.stringify(a).includes('NEVER-EXPOSE-THIS'));assert(!JSON.stringify(a).includes('"code":'));
  const b=await f.core.adminHandle(admin,{operation:'memberInventory',targetUid:'person',category:'codes',cursor:a.nextCursor});assert.equal(b.entries.length,20);assert.equal(new Set([...a.entries,...b.entries].map(x=>x.id)).size,40);
  const c=await f.core.adminHandle(admin,{operation:'memberInventory',targetUid:'person',category:'codes',cursor:b.nextCursor});assert.equal(c.entries.length,5);assert.equal(c.hasMore,false);
  assert(f.firebase.filter(x=>x.params).every(x=>x.path==='communityCodeGifts/person'&&x.params.orderBy==='$key'&&x.params.limitToFirst<=22));assert.equal(f.sql.exec('SELECT total_changes() AS n')[0].n,before);assert.equal(gifts['gift-002'].openedAt,0);
  await assert.rejects(f.core.adminHandle(user,{operation:'memberInventory',targetUid:'person'}),{status:403});await assert.rejects(f.core.adminHandle(admin,{operation:'memberInventory',targetUid:'person',expectedUsername:'another'}),{status:409});
 }finally{f.close();}
});
test('inventory separates owned images, emblems, badges and valid vouchers from present delivery state',async()=>{
 const f=fixture();try{
  f.data['communityImageOwnership/person']={'avatar-1':{grantedAt:now,source:'gift'}};f.data['communityBadgeGrants/person']={grant1:{badgeId:'badge-test',grantedAt:now}};f.data['communityEmblemAssignments/person']={emblemId:'verified',grantedAt:now};f.data['communityEmblemCatalog/verified']={title:'Verificado'};
  const images=await f.core.adminHandle(admin,{operation:'memberInventory',targetUid:'person',category:'images'});assert.equal(images.entries[0].assetId,'avatar-1');assert.equal(images.equipped.avatarId,'avatar-1');
  const badges=await f.core.adminHandle(admin,{operation:'memberInventory',targetUid:'person',category:'badges'});assert.equal(badges.entries[0].assetId,'badge-test');
  const emblems=await f.core.adminHandle(admin,{operation:'memberInventory',targetUid:'person',category:'emblems'});assert.equal(emblems.entries[0].title,'Verificado');
  await f.core.adminHandle(admin,{operation:'grantVoucher',targetUid:'person',expectedUsername:'campeaocff',expiresAt:now+86400000,message:'Vale de teste',nonce});
  const vouchers=await f.core.adminHandle(admin,{operation:'memberInventory',targetUid:'person',category:'vouchers'});assert.equal(vouchers.vouchers.availableCount,1);assert.equal(vouchers.vouchers.entries[0].status,'available');
 }finally{f.close();}
});
