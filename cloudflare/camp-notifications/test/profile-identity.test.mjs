import {test} from 'node:test';
import assert from 'node:assert/strict';
import {goalDatabase} from '../goal-database.js';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const key=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey))));
const secret=JSON.stringify({project_id:'central-free-fire',client_email:'test@example.test',private_key:'-----BEGIN PRIVATE KEY-----\n'+key+'\n-----END PRIVATE KEY-----'});
test('directory reservation retries concurrent changes with Firebase ETags',async()=>{
 const original=globalThis.fetch;let reads=0,writes=0;
 try{globalThis.fetch=async(url,init)=>{
  if(String(url).includes('oauth2.googleapis.com'))return Response.json({access_token:'mock-token',expires_in:3600});
  if(init.method==='PUT'){writes++;assert.equal(init.headers['If-Match'],'"version-'+reads+'"');return writes===1?new Response('',{status:412}):Response.json({uid:'person'});}
  reads++;assert.equal(init.headers['X-Firebase-ETag'],'true');return Response.json(null,{headers:{ETag:'"version-'+reads+'"'}});
 };assert.equal(await goalDatabase(secret).claimDirectory('communityRankingProfiles/fan','person',{uid:'person'}),true);assert.equal(reads,2);assert.equal(writes,2);
 }finally{globalThis.fetch=original;}
});
test('an existing handle owned by another UID cannot be reserved or deleted',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async(url,init)=>{assert.notEqual(init.method,'PUT');return Response.json({uid:'other'},{headers:{ETag:'"version"'}});};
 assert.equal(await goalDatabase(secret).claimDirectory('communityRankingProfiles/fan','person',{uid:'person'}),false);
 assert.equal(await goalDatabase(secret).claimDirectory('communityRankingProfiles/fan','person',null),false);
 }finally{globalThis.fetch=original;}
});
