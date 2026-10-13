const {test}=require('node:test'),assert=require('node:assert/strict');
const modulePromise=import('../../js/profile-directory-sync.mjs');
test('verified account repairs missing Instagram directory and exposes saved avatar',async()=>{
 const {syncProfileDirectory}=await modulePromise;let changes;
 assert.equal(await syncProfileDirectory({uid:'person',username:'Fan.Name',profile:{avatarId:'asset-1',coverId:'asset-2',public:true},read:async()=>null,write:async x=>{changes={...changes,...x};}}),true);
 assert.deepEqual(changes['communityInstagramLinks/person'],{username:'fan.name',key:'fan,name'});
 assert.deepEqual(changes['communityRankingProfiles/fan,name'],{uid:'person',username:'fan.name',avatarId:'asset-1',administrator:false});
});
test('does not overwrite another account and does not publish private profiles',async()=>{
 const {syncProfileDirectory}=await modulePromise;let writes=0,changes;
 await assert.rejects(syncProfileDirectory({uid:'person',username:'fan',profile:{public:true},read:async()=>({uid:'other'}),write:async()=>{writes++;}}));assert.equal(writes,0);
 await syncProfileDirectory({uid:'person',username:'fan',profile:{public:false},read:async()=>({uid:'person'}),write:async x=>{changes={...changes,...x};}});assert.equal(changes['communityRankingProfiles/fan'],null);
});
test('handle changes remove only directory entries owned by this account',async()=>{
 const {syncProfileDirectory}=await modulePromise;
 for(const owner of ['person','other']){let changes;await syncProfileDirectory({uid:'person',username:'new',profile:{public:true},oldLink:{key:'old'},read:async path=>path.endsWith('/old')?{uid:owner}:null,write:async x=>{changes={...changes,...x};}});assert.equal(Object.hasOwn(changes,'communityRankingProfiles/old'),owner==='person');}
});
test('unverified handles and absent saved profiles do not create public entries',async()=>{
 const {syncProfileDirectory}=await modulePromise;const write=async()=>assert.fail('unexpected write');
 await assert.rejects(syncProfileDirectory({uid:'person',username:'',profile:{},write}));
 assert.equal(await syncProfileDirectory({uid:'person',username:'fan',profile:null,write}),false);
});
