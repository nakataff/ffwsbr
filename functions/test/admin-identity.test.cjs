const {test}=require('node:test'),assert=require('node:assert/strict');
const {isPinnedAdmin,requirePinnedAdmin}=require('../admin-identity');
const admin={uid:'real-admin',email:'admin@centralfreefire.com.br',email_verified:false};
test('administrator identity requires pinned UID and expected email',()=>{assert(isPinnedAdmin(admin,'real-admin'));for(const [user,pin] of [[admin,''],[{...admin,uid:'someone-else'},'real-admin'],[{...admin,email:'member@example.test'},'real-admin']])assert.equal(isPinnedAdmin(user,pin),false)});
test('legacy Firebase functions cache a private policy read and reject email-only impersonation',async()=>{let reads=0;const db={ref:path=>{assert.equal(path,'serverSecurity/adminUid');return{get:async()=>{reads++;return{val:()=> 'real-admin'}}}}};assert.equal(await requirePinnedAdmin(admin,db),admin);await assert.rejects(requirePinnedAdmin({...admin,uid:'impostor'},db),e=>e.statusCode===403);assert.equal(reads,1)});
test('missing or unreadable policy fails closed',async()=>{for(const db of [{ref:()=>({get:async()=>({val:()=>null})})},{ref:()=>({get:async()=>{throw Error('unavailable')}})}])await assert.rejects(requirePinnedAdmin(admin,db))});
