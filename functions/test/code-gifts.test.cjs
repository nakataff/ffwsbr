const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('../code-gifts');
const admin={uid:'admin',email:'admin@centralfreefire.com.br'},now=1791910000000,id='11111111-1111-4111-8111-111111111111';
function database(){const data={'userAccounts/person/profile':{name:'Pessoa',username:'pessoa',gender:'masculino',avatarId:'default'},'userAccounts/other/profile':{name:'Outra',username:'outra',gender:'feminino'},'communityUsernames/pessoa':'person'};let writes=0;return{data,get writes(){return writes;},get:async path=>structuredClone(data[path]??null),transact:async(path,updater)=>{const next=updater(structuredClone(data[path]??null));data[path]=next;writes++;return structuredClone(next);}};}
const raw={targetUid:'person',expectedUsername:'pessoa',code:'ABCDEF123456',title:'Pacote de diamantes',message:'Obrigado!',expiresAt:0,requestId:id};
test('username lookup confirms a precise recipient without disclosing private profile fields',async()=>{const db=database();for(const name of ['pessoa','@pessoa']){const result=await C.findRecipient(db,admin,name);assert.equal(result.recipient.uid,'person');assert.equal(result.recipient.gender,undefined);assert.equal(result.recipient.username,'pessoa');}});
test('ambiguous usernames require the account link instead of choosing silently',async()=>{const db=database();db.data['communityRankingProfiles/pessoa']={uid:'other'};await assert.rejects(C.findRecipient(db,admin,'@pessoa'),{status:409});});
test('an explicit UID profile link keeps its exact recipient even when a username matches',async()=>{const db=database();db.data['communityUsernames/person']='other';const found=await C.findRecipient(db,admin,'https://centralfreefire.com.br/conta.html?u=person');assert.equal(found.recipient.uid,'person');});
test('only the actual admin can search accounts and send gifts',async()=>{const db=database();for(const identity of [{uid:'person',email:'pessoa@example.test',administrator:true},{uid:'mod',email:'mod@example.test',roleId:'moderator'},{}]){await assert.rejects(C.findRecipient(db,identity,'pessoa'),{status:403});await assert.rejects(C.sendCodeGift(db,identity,raw,now),{status:403});}assert.equal(db.writes,0);});
test('sending puts a private gift in the confirmed account and retries preserve one delivery',async()=>{const db=database();const first=await C.sendCodeGift(db,admin,raw,now);const retry=await C.sendCodeGift(db,admin,{...raw,requestId:'22222222-2222-4222-8222-222222222222'},now+1000);assert.equal(first.giftId,retry.giftId);assert.equal(first.gift.code,'ABCDEF123456');assert.equal(first.gift.openedAt,0);assert.equal(Object.keys(db.data).filter(path=>path.startsWith('communityCodeGifts/')).length,1);assert.equal(Object.keys(db.data).some(path=>path.startsWith('communityProfiles/')),false);});
test('a code assigned to one person cannot be sent to another account',async()=>{const db=database();await C.sendCodeGift(db,admin,raw,now);await assert.rejects(C.sendCodeGift(db,admin,{...raw,targetUid:'other',expectedUsername:'outra'},now),{status:409});assert.equal(Object.keys(db.data).some(path=>path.startsWith('communityCodeGifts/other/')),false);});
test('stale recipient confirmation, expired codes and invalid inputs never reserve a code',async()=>{for(const change of [{expectedUsername:'old'},{code:'invalid code'},{title:''},{title:'x'.repeat(101)},{expiresAt:now-1},{targetUid:'../person'},{requestId:'bad'}]){const db=database();await assert.rejects(C.sendCodeGift(db,admin,{...raw,...change},now));assert.equal(db.writes,0);}});
test('only the recipient can record opening; retries keep the first opening date',async()=>{const db=database();const sent=await C.sendCodeGift(db,admin,raw,now);await assert.rejects(C.openCodeGift(db,{uid:'other'},sent.giftId,now+1000),{status:404});await assert.rejects(C.openCodeGift(db,admin,sent.giftId,now+1000),{status:404});const first=await C.openCodeGift(db,{uid:'person'},sent.giftId,now+1000);const retry=await C.openCodeGift(db,{uid:'person'},sent.giftId,now+2000);assert.equal(first.gift.openedAt,now+1000);assert.equal(retry.gift.openedAt,now+1000);assert.equal(retry.gift.usedAt,undefined);});
test('a failed inventory write can be resumed after the code reservation',async()=>{const db=database(),transact=db.transact;let fail=true;db.transact=async(path,updater)=>{if(fail&&path.startsWith('communityCodeGifts/')){fail=false;throw Error('offline');}return transact(path,updater);};await assert.rejects(C.sendCodeGift(db,admin,raw,now));const recovered=await C.sendCodeGift(db,admin,{...raw,requestId:'22222222-2222-4222-8222-222222222222'},now+1000);assert.equal(recovered.giftId,'codegift-'+id);assert.equal(recovered.gift.sentAt,now);});
test('admin status lookup recovers older gifts with the original delivery and opening dates without writing or returning codes',async()=>{
 const db=database(),sent=await C.sendCodeGift(db,admin,raw,now);await C.openCodeGift(db,{uid:'person'},sent.giftId,now+1234);const writes=db.writes,hash=Object.keys(db.data).find(k=>k.startsWith('communityCodeGiftAssignments/')).split('/')[1];
 const status=await C.giftStatus(db,admin,[hash,hash,'f'.repeat(64)]);assert.equal(status.gifts.length,1);assert.equal(status.gifts[0].sentAt,now);assert.equal(status.gifts[0].openedAt,now+1234);assert.equal(status.gifts[0].pending,false);assert.equal(status.gifts[0].username,'pessoa');assert(!JSON.stringify(status).includes(raw.code));assert.equal(db.writes,writes);
 await assert.rejects(C.giftStatus(db,{uid:'person',email:'person@example.test'},[hash]),{status:403});
});
test('a reserved gift whose inventory write failed is pending, never reported as delivered',async()=>{
 const db=database();db.data['communityCodeGiftAssignments/'+'a'.repeat(64)]={uid:'person',giftId:'codegift-'+id,sentAt:now,recipientUsername:'pessoa'};const response=await C.giftStatus(db,admin,['a'.repeat(64)]);assert.equal(response.gifts[0].pending,true);assert.equal(response.gifts[0].openedAt,0);
});
test('status lookup accepts bounded hashes only and ignores unassigned economy stock',async()=>{
 const db=database();for(const hashes of ['bad',['bad'],Array(21).fill('a'.repeat(64))])await assert.rejects(C.giftStatus(db,admin,hashes),{status:400});
 db.data['communityCodeGiftAssignments/'+'b'.repeat(64)]={uid:'economy-stock',giftId:'stock-'+'b'.repeat(64)};assert.equal((await C.giftStatus(db,admin,['b'.repeat(64)])).gifts.length,0);assert.equal(db.writes,0);
});
test('the recipient can archive an opened code and restore it without changing delivery, stock, wallet or code',async()=>{
 const db=database(),sent=await C.sendCodeGift(db,admin,raw,now);await C.openCodeGift(db,{uid:'person'},sent.giftId,now+10);
 const otherPaths=Object.fromEntries(Object.entries(db.data).filter(([p])=>p!=='communityCodeGifts/person/'+sent.giftId));
 const request={giftId:sent.giftId,kind:'code',archived:true};
 const archived=await C.archiveGift(db,{uid:'person'},request,now+20);assert.equal(archived.archivedAt,now+20);assert.equal(archived.code,undefined);
 assert.equal((await C.archiveGift(db,{uid:'person'},request,now+30)).archivedAt,now+20);
 assert.equal((await C.openCodeGift(db,{uid:'person'},sent.giftId,now+40)).gift.code,raw.code);
 const restored=await C.archiveGift(db,{uid:'person'},{...request,archived:false},now+50);assert.equal(restored.archivedAt,0);
 const gift=db.data['communityCodeGifts/person/'+sent.giftId];assert.equal(gift.code,raw.code);assert.equal(gift.openedAt,now+10);assert.equal(gift.sentAt,now);assert.equal(gift.usedAt,undefined);
 assert.deepEqual(Object.fromEntries(Object.entries(db.data).filter(([p])=>p!=='communityCodeGifts/person/'+sent.giftId)),otherPaths);
});
test('archiving requires the owner, an existing gift, a safe identifier and an explicit boolean',async()=>{
 const db=database(),sent=await C.sendCodeGift(db,admin,raw,now),request={giftId:sent.giftId,kind:'code',archived:true},writes=db.writes;
 await assert.rejects(C.archiveGift(db,{uid:'person'},request,now),{status:409});
 for(const identity of [admin,{uid:'other'}])await assert.rejects(C.archiveGift(db,identity,request,now),{status:404});
 await assert.rejects(C.archiveGift(db,{},request,now),{status:401});
 for(const change of [{giftId:'../person'},{kind:'wallet'},{archived:'true'},{giftId:'bad'}, {archived:undefined}])await assert.rejects(C.archiveGift(db,{uid:'person'},{...request,...change},now),{status:400});
 assert.equal(db.writes,writes);
});
test('cosmetic gifts can be archived while their unlock and badges are preserved; returned codes cannot be reopened',async()=>{
 const db=database();db.data['communityGifts/person/cosmetic-1']={assetId:'avatar-1',kind:'avatar',grantedAt:now};db.data['communityImageOwnership/person/avatar-1']={grantedAt:now};
 await C.archiveGift(db,{uid:'person'},{giftId:'cosmetic-1',kind:'profile',archived:true},now+10);
 assert.deepEqual(db.data['communityImageOwnership/person/avatar-1'],{grantedAt:now});assert.equal(db.data['communityGifts/person/cosmetic-1'].assetId,'avatar-1');
 const giftId='codegift-'+id;db.data['communityCodeGifts/person/'+giftId]={title:'Devolvido',returnedAt:now};await C.archiveGift(db,{uid:'person'},{giftId,kind:'code',archived:true},now+10);await C.archiveGift(db,{uid:'person'},{giftId,kind:'code',archived:false},now+20);await assert.rejects(C.openCodeGift(db,{uid:'person'},giftId,now+30),{status:410});
});
