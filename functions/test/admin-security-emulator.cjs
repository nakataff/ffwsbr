'use strict';
// Only talks to the local demo database. Never uses production credentials.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {createMockUserToken}=require('@firebase/util');
const project='demo-cff-admin-security';
const token=(uid,email='admin@centralfreefire.com.br',verified=false)=>createMockUserToken({sub:uid,user_id:uid,email,email_verified:verified},project);
async function request(path,auth,body){
 const url=new URL('http://127.0.0.1:19000/'+path+'.json');url.searchParams.set('ns',project);
 if(auth&&auth!=='owner')url.searchParams.set('auth',auth);
 return fetch(url,{method:body===undefined?'GET':'PUT',headers:{'Content-Type':'application/json',...(auth==='owner'?{Authorization:'Bearer owner'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(8000)});
}
async function expect(status,path,auth,body){const response=await request(path,auth,body);assert.equal(response.status,status,path);await response.arrayBuffer();}
(async()=>{
 const env=await initializeTestEnvironment({projectId:project,database:{host:'127.0.0.1',port:19000,rules:fs.readFileSync('database.rules.json','utf8')}});
 try{
  await expect(200,'','owner',{serverSecurity:{adminUid:'real-admin'},adminTasks:{sample:{title:'Private'}},userAccounts:{alice:{private:{sample:true}}},campNotifications:{inboxes:{alice:{sample:{title:'private'}}}}});
  const admin=token('real-admin'),fake=token('impostor','admin@centralfreefire.com.br',true),alice=token('alice','alice@example.test');
  await expect(200,'adminTasks',admin);
  for(const auth of [fake,alice,null]){await expect(401,'adminTasks',auth);await expect(401,'adminTasks/injected',auth,{});}
  await expect(200,'userAccounts/alice',alice);
  for(const auth of [fake,null]){await expect(401,'userAccounts/alice',auth);await expect(401,'campNotifications/inboxes/alice',auth);}
  for(const auth of [admin,fake,alice,null]){await expect(401,'serverSecurity',auth);await expect(401,'serverSecurity/adminUid',auth,'impostor');}
  await expect(200,'serverSecurity/adminUid','owner',null);
  await expect(401,'adminTasks',admin);
  console.log('Pinned UID, preserved owner access, impostor denial and private policy: PASS');
 }finally{await env.cleanup()}
})().catch(error=>{console.error(error);process.exitCode=1});
