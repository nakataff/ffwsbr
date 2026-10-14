import test from 'node:test';import assert from 'node:assert/strict';
import {createGiftSync} from '../js/admin-code-gift-sync.mjs';
const hash=async code=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code))).toString('hex');
test('reconciles old deliveries by hash, deduplicates and rechecks only when needed',async()=>{
 let rows=[{code:'ABCDEF123456'},{code:'ABCDEF123456'}],account='admin',clock=100000,calls=0,records;const states=[];
 const sync=createGiftSync({source:{inventory:()=>rows,reconcile:async value=>records=value},owner:()=>account,now:()=>clock,onState:s=>states.push(s),request:async(action,body)=>{calls++;assert.equal(action,'codeGiftStatus');assert.equal(body.hashes.length,1);assert(!JSON.stringify(body).includes('ABCDEF123456'));return {ok:true,gifts:[{hash:await hash('ABCDEF123456'),uid:'person',username:'pessoa',giftId:'codegift-test',sentAt:1000,pending:false}]};}});
 await sync.sync();assert.equal(records[0].code,'ABCDEF123456');assert.equal(records[0].sentAt,1000);assert.equal(states.at(-1).ready,true);await sync.sync();assert.equal(calls,1);clock+=60001;await sync.sync();assert.equal(calls,2);rows=null;await sync.sync();assert.equal(states.at(-1).locked,true);
});
test('ledger failures keep delivery availability disabled, with a recoverable error',async()=>{
 const states=[];let saved=false;const s=createGiftSync({source:{inventory:()=>[{code:'ABCDEF123456'}],reconcile:async()=>saved=true},owner:()=> 'admin',onState:v=>states.push(v),request:async()=>{throw Error('offline');}});await s.sync();assert.equal(states.at(-1).ready,false);assert.equal(states.at(-1).error,'offline');assert.equal(saved,false);
});
test('account change during lookup cannot write another account’s private control',async()=>{
 let owner='admin',resolve,calls=0;const s=createGiftSync({source:{inventory:()=>[{code:'ABCDEF123456'}],reconcile:async()=>calls++},owner:()=>owner,request:()=>new Promise(r=>resolve=r)});const job=s.sync();while(!resolve)await new Promise(r=>setTimeout(r,0));owner='';resolve({ok:true,gifts:[]});await job;assert.equal(calls,0);
});
test('large inventories are split into bounded requests',async()=>{
 const sizes=[];const s=createGiftSync({source:{inventory:()=>Array.from({length:43},(_,i)=>({code:'ABCDEF'+i})),reconcile:async()=>{}},owner:()=> 'admin',request:async(_,body)=>{sizes.push(body.hashes.length);return {ok:true,gifts:[]};}});await s.sync();assert.deepEqual(sizes,[20,20,3]);
});
