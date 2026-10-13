import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
const runtime=new URL('../.economy-test-runtime.mjs',import.meta.url);
writeFileSync(runtime,readFileSync(new URL('../worker.js',import.meta.url),'utf8').replace("import {DurableObject} from 'cloudflare:workers';","class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}"));
const {NotificationHub,default:worker}=await import(runtime.href);unlinkSync(runtime);
test('economy gateway verifies signed identities, private wallets, real account ages and gift deliveries',async t=>{
 const pair=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...pair.publicKey.export({format:'jwk'}),kid:'economy-test',alg:'RS256',use:'sig'};
 const jwt=(uid,email='member@example.test')=>{const now=Math.floor(Date.now()/1000),h=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url'),p=Buffer.from(JSON.stringify({aud:'central-free-fire',iss:'https://securetoken.google.com/central-free-fire',sub:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'},email,email_verified:true})).toString('base64url');return h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),pair.privateKey).toString('base64url');};
 const data={'userAccounts/alice/profile':{name:'Alice',username:'alice',gender:'feminino',createdAt:Date.now()},'userAccounts/bob/profile':{name:'Bob',username:'bob',gender:'masculino',createdAt:Date.now()},'ranking/alice':{points:300}},versions={};
 const before=globalThis.fetch;t.after(()=>globalThis.fetch=before);
 globalThis.fetch=async(input,options={})=>{const url=new URL(input);
  if(url.pathname.includes('service_accounts'))return Response.json({keys:[jwk]});
  if(url.hostname==='oauth2.googleapis.com')return Response.json({access_token:'test-oauth',expires_in:3600});
  assert.equal(options.headers.Authorization,'Bearer test-oauth');
  if(url.hostname==='identitytoolkit.googleapis.com'){const uid=JSON.parse(options.body).localId[0];return Response.json({users:[{localId:uid,createdAt:String(Date.now()-2*86400000)}]});}
  assert.equal(url.hostname,'central-free-fire-default-rtdb.firebaseio.com');const path=url.pathname.slice(1,-5).split('/').map(decodeURIComponent).join('/'),etag='"'+(versions[path]||0)+'"';
  if(options.method==='PUT'){if(options.headers['If-Match']!==etag)return new Response(null,{status:412});data[path]=JSON.parse(options.body);versions[path]=(versions[path]||0)+1;return Response.json(data[path]);}
  if(options.method==='PATCH'){Object.assign(data,JSON.parse(options.body));return Response.json({});}
  return Response.json(data[path]??null,{headers:{ETag:etag}});
 };
 const sqlite=new DatabaseSync(':memory:'),ctx={storage:{sql:{exec(q,...args){if(!args.length&&q.includes(';')){sqlite.exec(q);return {toArray:()=>[]};}const s=sqlite.prepare(q),rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){sqlite.exec('BEGIN');try{const r=fn();sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
 const secret=JSON.stringify({project_id:'central-free-fire',client_email:'test@central-free-fire.iam.gserviceaccount.com',private_key:pair.privateKey.export({type:'pkcs8',format:'pem'})}),hub=new NotificationHub(ctx,{CFF_GOAL_SERVICE_ACCOUNT:secret});
 const alice=jwt('alice'),bob=jwt('bob'),admin=jwt('admin','admin@centralfreefire.com.br');
 const api=async(token,body)=>{const r=await hub.fetch(new Request('https://notify.test/api',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}));return {status:r.status,...await r.json()};};
 assert.equal((await api('',{action:'economy',operation:'state'})).status,401);
 assert.equal((await api(alice,{action:'economyAdmin',operation:'adjust',targetUid:'alice',delta:1000,reason:'Forged',nonce:crypto.randomUUID()})).status,403);
 await api(alice,{action:'economy',operation:'checkin',targetUid:'bob',points:1000});
 assert.equal((await api(alice,{action:'economy',operation:'state'})).wallet.balance,1);
 assert.equal((await api(bob,{action:'economy',operation:'state',targetUid:'alice'})).wallet.balance,0);
 const code=(await api(alice,{action:'economy',operation:'state'})).inviteCode;
 assert.equal((await api(bob,{action:'economy',operation:'attachReferral',code})).attached,false);
 assert.equal((await api(admin,{action:'economyAdmin',operation:'addStock',code:'MOCKCODE1234',title:'Prêmio de teste',bucket:'roulette'})).status,200);
 assert.equal((await api(admin,{action:'economyAdmin',operation:'saveChances',chances:['p1','p3','p10','p50','code'].map(id=>({id,chance:id==='code'?100:0}))})).status,200);
 const results=await Promise.all([api(alice,{action:'economy',operation:'spin'}),api(alice,{action:'economy',operation:'spin'})]);
 assert(results.every(r=>r.status===200&&r.result.id==='code'));
 const giftPaths=Object.keys(data).filter(p=>p.startsWith('communityCodeGifts/alice/'));assert.equal(giftPaths.length,1);assert.equal(data[giftPaths[0]].code,'MOCKCODE1234');assert.equal(data[giftPaths[0]].openedAt,0);
 const bobState=await api(bob,{action:'economy',operation:'state'});assert(!JSON.stringify(bobState).includes('MOCKCODE1234'));assert(!JSON.stringify(bobState).includes('stockHash'));assert.equal(bobState.chances.find(p=>p.id==='code').chance,0);assert.deepEqual(data['ranking/alice'],{points:300});
 const health=await worker.fetch(new Request('https://notify.test/health'),{NOTIFICATIONS:{},CFF_GOAL_SERVICE_ACCOUNT:'configured'});assert.equal((await health.json()).economy,true);
});
