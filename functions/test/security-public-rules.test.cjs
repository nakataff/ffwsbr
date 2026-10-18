'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const rules=JSON.parse(fs.readFileSync('database.rules.json','utf8')).rules;
const example=JSON.parse(fs.readFileSync('firebase-database-rules-admin.example.json','utf8')).rules;
const admin={uid:'admin-uid',token:{email:'admin@centralfreefire.com.br'}};
const alice={uid:'alice',token:{email:'alice@example.com'}};
const bob={uid:'bob',token:{email:'bob@example.com'}};

function snapshot(value){
 return {val:()=>value,exists:()=>value!==null&&value!==undefined,child:k=>snapshot(value?.[k])};
}
function check(expr,{auth=null,uid='alice',data=null,root={}}={}){
 if(typeof expr==='boolean')return expr;
 return Boolean(Function('auth','$uid','data','root','return '+expr)(auth,uid,snapshot(data),snapshot(root)));
}

test('legacy voting stays readable, but no one can write arbitrary public votes',()=>{
 for(const set of [rules,example]){
  for(const group of ['mercadoUserVotes','dayUserVotes']){
   const parent=set[group],node=(parent.$item||parent.$match).$client;
   assert.equal(parent['.read'],true,group+' public results');
   assert.equal(node['.write'],false,group+' writes must require a dedicated secure API');
   assert.equal(check(node['.write']),false);
   assert.equal(check(node['.write'],{auth:alice}),false);
  }
 }
});

test('public team profiles are readable; hidden profiles require owner or administrator',()=>{
 const exp=rules.communityProfiles.$uid['.read'];
 for(const user of [null,alice,bob,admin])assert.equal(check(exp,{auth:user,data:{public:true}}),true);
 for(const user of [null,bob])assert.equal(check(exp,{auth:user,data:{public:false}}),false);
 assert.equal(check(exp,{auth:alice,data:{public:false}}),true);
 assert.equal(check(exp,{auth:admin,data:{public:false}}),true);
 assert.equal(check(exp,{auth:null,data:{name:'Legacy'}}),false);
});

test('linked badges, images, roles and Instagram records follow profile visibility',()=>{
 const linked=['communityBadgeGrants','communityBadgeOwnership','communityImageOwnership','communityAccountRoles','communityInstagramLinks'];
 for(const name of linked){
  const exp=rules[name].$uid['.read'];
  for(const uid of ['alice','bob']){
   const root={communityProfiles:{[uid]:{public:true}}};
   assert.equal(check(exp,{uid,root}),true,name+' public profile');
  }
  const hidden={communityProfiles:{alice:{public:false}}};
  assert.equal(check(exp,{root:hidden}),false,name+' anonymous');
  assert.equal(check(exp,{auth:bob,root:hidden}),false,name+' other member');
  assert.equal(check(exp,{auth:alice,root:hidden}),true,name+' owner');
  assert.equal(check(exp,{auth:admin,root:hidden}),true,name+' admin');
 }
});
