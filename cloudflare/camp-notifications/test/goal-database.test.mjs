import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {goalDatabase} from '../goal-database.js';
test('reward database authenticates with a signed service JWT, caches OAuth and keeps credentials out of database URLs',async t=>{
 await assert.rejects(goalDatabase('').get('communityBadgeGoals'),/configuração/);
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const secret=JSON.stringify({project_id:'central-free-fire',client_email:'rewards@central-free-fire.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})});
 const before=globalThis.fetch,calls=[];t.after(()=>globalThis.fetch=before);
 globalThis.fetch=async(url,options)=>{calls.push({url,options});if(url==='https://oauth2.googleapis.com/token'){
  const jwt=options.body.get('assertion'),parts=jwt.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());
  assert.equal(claims.iss,'rewards@central-free-fire.iam.gserviceaccount.com');assert.equal(claims.aud,'https://oauth2.googleapis.com/token');assert(claims.scope.includes('firebase.database'));assert(verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),publicKey,Buffer.from(parts[2],'base64url')));
  return Response.json({access_token:'test-only-token',expires_in:3600});
 }assert(url.startsWith('https://central-free-fire-default-rtdb.firebaseio.com/'));assert(!url.includes('token'));assert.equal(options.headers.Authorization,'Bearer test-only-token');return Response.json({});};
 const db=goalDatabase(secret);await db.get('communityBadgeGoals');await db.update({'communityImageOwnership/alice/asset-1':{source:'goal',grantedAt:123}});
 assert.equal(calls.filter(c=>c.url==='https://oauth2.googleapis.com/token').length,1);assert.equal(calls.at(-1).options.method,'PATCH');assert.equal(JSON.parse(calls.at(-1).options.body)['communityImageOwnership/alice/asset-1'].source,'goal');
});
