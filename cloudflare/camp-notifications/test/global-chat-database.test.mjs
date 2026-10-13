import {test} from 'node:test';
import assert from 'node:assert/strict';
import {goalDatabase} from '../goal-database.js';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const key=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey))));
const secret=JSON.stringify({project_id:'central-free-fire',client_email:'test@example.test',private_key:'-----BEGIN PRIVATE KEY-----\n'+key+'\n-----END PRIVATE KEY-----'});
test('chat transaction rechecks the cooldown after a competing Firebase write',async()=>{
 const original=globalThis.fetch;let reads=0,writes=0;
 try{globalThis.fetch=async(url,init)=>{
  if(String(url).includes('oauth2.googleapis.com'))return Response.json({access_token:'mock-token',expires_in:3600});
  if(init.method==='PUT'){writes++;assert.equal(init.headers['If-Match'],'"v1"');return new Response('',{status:412});}
  reads++;return Response.json(reads===1?null:{lastAt:10000},{headers:{ETag:'"v'+reads+'"'}});
 };await assert.rejects(goalDatabase(secret).transact('globalChat/limits/person',old=>{if(old?.lastAt===10000)throw Error('cooldown');return {lastAt:10000};}),/cooldown/);assert.equal(reads,2);assert.equal(writes,1);
 }finally{globalThis.fetch=original;}
});
test('chat history reads use a bounded, ordered Firebase query',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async url=>{const parsed=new URL(url);assert.equal(parsed.searchParams.get('orderBy'),'"$key"');assert.equal(parsed.searchParams.get('limitToLast'),'110');return Response.json({});};await goalDatabase(secret).recentChat();
 }finally{globalThis.fetch=original;}
});
