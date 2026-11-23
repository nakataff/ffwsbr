'use strict';
// Only talks to the local demo database. Never uses production credentials.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {createMockUserToken}=require('@firebase/util');
const project='demo-cff-admin-security';
const token=(uid,email='admin@centralfreefire.com.br',verified=false)=>createMockUserToken({sub:uid,user_id:uid,email,email_verified:verified},project);
async function request(path,auth,body,method=body===undefined?'GET':'PUT'){
 const url=new URL('http://127.0.0.1:19000/'+path+'.json');url.searchParams.set('ns',project);
 if(auth&&auth!=='owner')url.searchParams.set('auth',auth);
 return fetch(url,{method,headers:{'Content-Type':'application/json',...(auth==='owner'?{Authorization:'Bearer owner'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(8000)});
}
async function expect(status,path,auth,body,method){const response=await request(path,auth,body,method);assert.equal(response.status,status,path);await response.arrayBuffer();}
(async()=>{
 const env=await initializeTestEnvironment({projectId:project,database:{host:'127.0.0.1',port:19000,rules:fs.readFileSync('database.rules.json','utf8')}});
 try{
  await expect(200,'','owner',{serverSecurity:{adminUid:'real-admin'},adminTasks:{sample:{title:'Private'}},userAccounts:{alice:{private:{sample:true}}},campNotifications:{inboxes:{alice:{sample:{title:'private'}}}}});
  const admin=token('real-admin'),fake=token('impostor','admin@centralfreefire.com.br',true),alice=token('alice','alice@example.test');
  await expect(200,'adminTasks',admin);
  for(const auth of [fake,alice,null]){await expect(401,'adminTasks',auth);await expect(401,'adminTasks/injected',auth,{});}
  const card={id:'test',kicker:'Publicidade',title:'Teste de card',action:'Abrir',href:'https://example.test/',color:'#abcdef',tint:'#102030',image:'',enabled:true};
  const promotions={revision:1,interval:6,updatedAt:Date.now(),cards:[card]};
  await expect(200,'homePromotions',null);
  for(const auth of [fake,alice,null])await expect(401,'homePromotions',auth,promotions);
  await expect(200,'homePromotions',admin,promotions);
  await expect(401,'homePromotions',admin,promotions);
  await expect(401,'homePromotions',admin,{...promotions,revision:2,cards:[{...card,href:'javascript:alert(1)'}]});
  await expect(401,'homePromotions',admin,{...promotions,revision:2,cards:Array.from({length:9},()=>card)});
  await expect(200,'homePromotions',admin,{...promotions,revision:2,cards:[{...card,enabled:false}]});
  const camp={revision:'01234567-0123-0123-0123-0123456789ab',updatedAt:1,json:'{"kills":{"ag.al":3}}'};
  await expect(200,'adminCampDraft/current',admin,camp);
  await expect(200,'adminCampDraft/current',admin);
  await expect(401,'adminCampDraft/current',admin,{...camp,json:{bad:true}});
  for(const auth of [fake,alice,null]){await expect(401,'adminCampDraft/current',auth);await expect(401,'adminCampDraft/current',auth,camp);}
  await expect(200,'userAccounts/alice',alice);
  for(const auth of [fake,null]){await expect(401,'userAccounts/alice',auth);await expect(401,'campNotifications/inboxes/alice',auth);}
  const accessToken='private-test-token-for-entry';
  const endsAt=Date.now()+60000;
  await expect(200,'communityGiveaways','owner',{
   current:{id:'public-draw',active:true,endsAt},
   private:{1234567:{id:'1234567',active:true,endsAt,entryToken:accessToken,fields:{name:true}}}
  });
  const publicEntries='communityGiveaways/entries/public-draw';
  const privateEntries='communityGiveaways/privateEntries/1234567';
  const publicEntry=username=>({username,createdAt:Date.now()});
  const privateEntry={name:'Inscrito',accessToken,createdAt:Date.now()};
  await expect(200,publicEntries+'/first',null,publicEntry('jogador'));
  await expect(200,publicEntries+'/legacy',null,publicEntry('Jogador'));
  await expect(200,privateEntries+'/first',null,privateEntry);
  for(const auth of [fake,alice,null]){
   await expect(401,publicEntries+'/first',auth,null);
   await expect(401,privateEntries+'/first',auth,null);
  }
  await expect(401,publicEntries+'/first',admin,publicEntry('outro'));
  await expect(401,publicEntries,admin,null);
  await expect(200,publicEntries,admin,{first:null,legacy:null},'PATCH');
  await expect(200,privateEntries+'/first',admin,null);
  await expect(200,publicEntries+'/first',null,publicEntry('jogador'));
  await expect(200,privateEntries+'/first',null,{...privateEntry,createdAt:Date.now()});
  for(const auth of [admin,fake,alice,null]){await expect(401,'serverSecurity',auth);await expect(401,'serverSecurity/adminUid',auth,'impostor');}
  await expect(200,'serverSecurity/adminUid','owner',null);
  await expect(401,'adminTasks',admin);
  console.log('Pinned UID, preserved owner access, impostor denial and private policy: PASS');
 }finally{await env.cleanup()}
})().catch(error=>{console.error(error);process.exitCode=1});
