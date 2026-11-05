import test from 'node:test';import assert from 'node:assert/strict';
import {bootstrapAdminIdentity,ADMIN_EMAIL} from '../scripts/bootstrap-admin-identity.mjs';
function fixture(pinned=null,extra={}){const writes=[];return{writes,accountByEmail:async email=>{assert.equal(email,ADMIN_EMAIL);return{uid:'real-admin',email,disabled:false,...extra}},get:async path=>{assert.equal(path,'serverSecurity/adminUid');return pinned},update:async change=>{writes.push(change);pinned=change['serverSecurity/adminUid']}}}
test('deployment pins only the pre-existing Auth account and repeated deploys never rewrite it',async()=>{const db=fixture();assert.equal(await bootstrapAdminIdentity(db),'real-admin');assert.equal(await bootstrapAdminIdentity(db),'real-admin');assert.deepEqual(db.writes,[{'serverSecurity/adminUid':'real-admin'}])});
test('recreated, disabled or malformed admin accounts stop deployment instead of rotating permissions',async()=>{for(const db of [fixture('older-admin'),fixture(null,{disabled:true}),fixture(null,{email:'other@example.test'}),fixture(null,{uid:'../admin'})]){await assert.rejects(bootstrapAdminIdentity(db));assert.equal(db.writes.length,0)}});


import {assertPinnedRules} from '../scripts/verify-admin-security.mjs';
import {readFileSync} from 'node:fs';
test('every published administrative rule requires the pinned UID and the policy stays private',()=>{
 const rules=JSON.parse(readFileSync(new URL('../database.rules.json',import.meta.url),'utf8'));
 assert(assertPinnedRules(rules)>90);
 const copy=structuredClone(rules);copy.rules.adminTasks['.write']="auth != null && auth.token.email == 'admin@centralfreefire.com.br'";
 assert.throws(()=>assertPinnedRules(copy),/Email-only/);
 copy.rules.serverSecurity['.read']=true;assert.throws(()=>assertPinnedRules(copy),/not locked/);
});
