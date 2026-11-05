'use strict';
const ADMIN_EMAIL='admin@centralfreefire.com.br';
const policies=new WeakMap();
function isPinnedAdmin(user,uid){return typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid)&&user?.uid===uid&&user?.email===ADMIN_EMAIL;}
async function requirePinnedAdmin(user,db){
 let policy=policies.get(db);
 if(!policy||policy.until<=Date.now()){
  policy={until:Date.now()+300000,value:db.ref('serverSecurity/adminUid').get().then(s=>s.val())};policies.set(db,policy);
  policy.value.catch(()=>policies.delete(db));
 }
 const uid=await policy.value;
 if(!isPinnedAdmin(user,uid))throw Object.assign(Error('Usuário não autorizado.'),{statusCode:403,status:403});
 return user;
}
module.exports={ADMIN_EMAIL,isPinnedAdmin,requirePinnedAdmin};
