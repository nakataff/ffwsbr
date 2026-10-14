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
 let rankingChecked=false,rankingCheckinCalls=0;
 const before=globalThis.fetch;t.after(()=>globalThis.fetch=before);
 globalThis.fetch=async(input,options={})=>{const url=new URL(input);
  if(url.pathname.includes('service_accounts'))return Response.json({keys:[jwk]});
  if(url.hostname==='oauth2.googleapis.com')return Response.json({access_token:'test-oauth',expires_in:3600});
  if(url.hostname==='cff-instagram-community.nakataffb4.workers.dev'){
   const dayKey=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   if(url.pathname==='/api/checkin/status'){assert.equal(url.searchParams.get('session'),'a'.repeat(48));return Response.json({ok:true,status:'verified',username:'alice_ig',checkedInToday:rankingChecked,dayKey});}
   assert.equal(url.pathname,'/api/checkin');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{session:'a'.repeat(48)});rankingChecked=true;rankingCheckinCalls++;return Response.json({ok:true,awarded:true,username:'alice_ig',dayKey});
  }
  assert.equal(options.headers.Authorization,'Bearer test-oauth');
  if(url.hostname==='identitytoolkit.googleapis.com'){const uid=JSON.parse(options.body).localId[0];return Response.json({users:[{localId:uid,createdAt:String(Date.now()-2*86400000)}]});}
  assert.equal(url.hostname,'central-free-fire-default-rtdb.firebaseio.com');const path=url.pathname.slice(1,-5).split('/').map(decodeURIComponent).join('/'),etag='"'+(versions[path]||0)+'"';
  if(options.method==='PUT'){if(options.headers['If-Match']!==etag)return new Response(null,{status:412});data[path]=JSON.parse(options.body);versions[path]=(versions[path]||0)+1;return Response.json(data[path]);}
  if(options.method==='PATCH'){Object.assign(data,JSON.parse(options.body));return Response.json({});}
  return Response.json(data[path]??null,{headers:{ETag:etag}});
 };
 const sqlite=new DatabaseSync(':memory:'),ctx={storage:{sql:{exec(q,...args){if(!args.length&&q.includes(';')){sqlite.exec(q);return {toArray:()=>[]};}const s=sqlite.prepare(q),rows=s.columns().length?s.all(...args):(s.run(...args),[]);return {toArray:()=>rows};}},transactionSync(fn){sqlite.exec('BEGIN');try{const r=fn();sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}}};
 const rankingSql=new DatabaseSync(':memory:');rankingSql.exec(`CREATE TABLE users(user_key TEXT PRIMARY KEY,username TEXT,points_all INTEGER,last_interaction_at INTEGER);CREATE TABLE awards(user_key TEXT,username TEXT,type TEXT,points INTEGER,day_key TEXT,month_key TEXT,created_at INTEGER);CREATE TABLE active_days(user_key TEXT,day_key TEXT);CREATE TABLE checkin_sessions(session_id TEXT,user_key TEXT,username TEXT,verified_at INTEGER);CREATE TABLE weekly_ranking_snapshots(week_key TEXT,payload TEXT);CREATE TABLE monthly_ranking_snapshots(month_key TEXT,payload TEXT);`);
 const rankingDb={prepare(q){assert(q.startsWith('SELECT')||q.startsWith('WITH'));return{bind(...values){return{first:async()=>rankingSql.prepare(q).get(...values)||null,all:async()=>({results:rankingSql.prepare(q).all(...values)})};},all:async()=>({results:rankingSql.prepare(q).all()})};}};
 const secret=JSON.stringify({project_id:'central-free-fire',client_email:'test@central-free-fire.iam.gserviceaccount.com',private_key:pair.privateKey.export({type:'pkcs8',format:'pem'})}),hub=new NotificationHub(ctx,{CFF_GOAL_SERVICE_ACCOUNT:secret,COMMUNITY_DB:rankingDb});
 const alice=jwt('alice'),bob=jwt('bob'),admin=jwt('admin','admin@centralfreefire.com.br');
 const api=async(token,body)=>{const r=await hub.fetch(new Request('https://notify.test/api',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify(body)}));return {status:r.status,...await r.json()};};
 assert.equal((await api('',{action:'economy',operation:'state'})).status,401);
 assert.equal((await api(alice,{action:'economyAdmin',operation:'adjust',targetUid:'alice',delta:1000,reason:'Forged',nonce:crypto.randomUUID()})).status,403);
 await api(alice,{action:'economy',operation:'checkin',targetUid:'bob',points:1000});
 assert.equal((await api(alice,{action:'economy',operation:'state'})).wallet.balance,1);
 assert.equal((await api(bob,{action:'economy',operation:'state',targetUid:'alice'})).wallet.balance,0);
 const code=(await api(alice,{action:'economy',operation:'state'})).inviteCode;
 assert.equal((await api(bob,{action:'economy',operation:'attachReferral',code})).attached,false);
 const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=';
 assert.equal((await api(admin,{action:'economyAdmin',operation:'addStock',code:'MOCKCODE1234',title:'Prêmio de teste',bucket:'roulette',imageUrl:photo})).status,200);
 assert.equal((await api(admin,{action:'economyAdmin',operation:'saveChances',chances:['p1','p3','p10','p25','p50','code'].map(id=>({id,chance:id==='code'?100:0}))})).status,200);
 const results=await Promise.all([api(alice,{action:'economy',operation:'spin'}),api(alice,{action:'economy',operation:'spin'})]);
 assert(results.every(r=>r.status===200&&r.result.id==='code'));
 const mediaId=results[0].result.imageUrl.split('/').pop(),bindings={NOTIFICATIONS:{idFromName:()=> 'test',get:()=>({fetch:request=>hub.fetch(request)})}};
 const media=await worker.fetch(new Request('https://notify.test/economy-media/'+mediaId),bindings);assert.equal(media.status,200);assert.equal(media.headers.get('Content-Type'),'image/png');assert.equal(media.headers.get('Cache-Control'),'public, max-age=31536000, immutable');assert.deepEqual(new Uint8Array(await media.arrayBuffer()),Uint8Array.from(atob(photo.split(',')[1]),c=>c.charCodeAt(0)));
 const missing=await worker.fetch(new Request('https://notify.test/economy-media/'+'b'.repeat(64)),bindings);assert.equal(missing.status,404);
 const giftPaths=Object.keys(data).filter(p=>p.startsWith('communityCodeGifts/alice/'));assert.equal(giftPaths.length,1);assert.equal(data[giftPaths[0]].code,'MOCKCODE1234');assert.equal(data[giftPaths[0]].openedAt,0);
 const bobState=await api(bob,{action:'economy',operation:'state'});assert(!JSON.stringify(bobState).includes('MOCKCODE1234'));assert(!JSON.stringify(bobState).includes('stockHash'));assert.equal(bobState.chances.find(p=>p.id==='code').chance,0);assert.deepEqual(data['ranking/alice'],{points:300});
 const session='a'.repeat(48),cutoff=Date.parse('2026-10-13T23:44:00Z');data['communityInstagramLinks/alice']={username:'alice_ig'};data['userAccounts/alice/community']={session};rankingSql.prepare('INSERT INTO users VALUES(?,?,?,?)').run('ig-alice','alice_ig',940,Date.now());rankingSql.prepare('INSERT INTO checkin_sessions VALUES(?,?,?,?)').run(session,'ig-alice','alice_ig',1);const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());rankingSql.prepare('INSERT INTO awards VALUES(?,?,?,?,?,?,?)').run('ig-alice','alice_ig','comment',40,today,today.slice(0,7),Date.now());
 const expectedBalance=183+(today>='2026-10-01'?40:0);
 const awarded=await api(alice,{action:'economy',operation:'syncInteractions',targetUid:'bob',points:999999});assert.equal(awarded.interactions.retroCredit,180);const interactionState=await api(alice,{action:'economy',operation:'state'});assert.equal(interactionState.wallet.balance,expectedBalance);assert.equal(interactionState.interactions.weekCredited,2);assert.equal((await api(bob,{action:'economy',operation:'state'})).wallet.balance,0);assert.equal(rankingSql.prepare('SELECT points_all FROM users').get().points_all,940);const rankingHealth=await worker.fetch(new Request('https://notify.test/economy-interactions/health'),bindings);assert.equal(rankingHealth.status,200);assert.equal((await rankingHealth.json()).interactionRanking,true);
 assert.equal((await api(alice,{action:'economyAdmin',operation:'coinRanking'})).status,403);const coins=await api(admin,{action:'economyAdmin',operation:'coinRanking'});assert.equal(coins.currency,'CFF COINS');assert.equal(coins.entries[0].uid,'alice');assert.equal(coins.entries[0].name,'Alice');assert.equal(coins.entries[0].balance,expectedBalance);assert.equal(coins.total,1);
 // A new request window keeps this independent scenario below the gateway's rate limit.
 sqlite.exec('DELETE FROM limits');
 assert.equal((await api(admin,{action:'economyAdmin',operation:'saveItem',item:{id:'game-test',kind:'game',title:'Item no jogo',description:'Entrega pelo ID',imageUrl:results[0].result.imageUrl,price:50,enabled:true}})).status,200);
 const gameItem=(await api(alice,{action:'economy',operation:'state'})).shop.find(p=>p.id==='game-test'),gameBody={action:'economy',operation:'buyGameItem',itemId:gameItem.id,expectedPrice:gameItem.price,revision:gameItem.revision,gameId:'12345678901234567890',nonce:crypto.randomUUID()};
 const gameOrder=await api(alice,gameBody);assert.equal(gameOrder.status,200);assert.equal(gameOrder.order.status,'pending');assert.equal((await api(alice,gameBody)).order.id,gameOrder.order.id);assert.equal((await api(alice,{action:'economy',operation:'state'})).wallet.balance,expectedBalance-50);
 assert.equal((await api(bob,{action:'economy',operation:'gameOrders'})).total,0);assert.equal((await api(bob,{action:'economy',operation:'cancelGameOrder',orderId:gameOrder.order.id})).status,404);assert.equal((await api(alice,{action:'economyAdmin',operation:'finishGameOrder',orderId:gameOrder.order.id,status:'delivered'})).status,403);
 assert.equal((await api(alice,{action:'economy',operation:'cancelGameOrder',orderId:gameOrder.order.id})).order.status,'cancelled');assert.equal((await api(alice,{action:'economy',operation:'state'})).wallet.balance,expectedBalance);
 const nextOrder=await api(alice,{...gameBody,nonce:crypto.randomUUID()});assert.equal((await api(admin,{action:'economyAdmin',operation:'gameOrders'})).counts.pending,1);assert.equal((await api(admin,{action:'economyAdmin',operation:'finishGameOrder',orderId:nextOrder.order.id,status:'delivered',note:'Enviado no jogo'})).order.status,'delivered');assert.equal((await api(alice,{action:'economy',operation:'cancelGameOrder',orderId:nextOrder.order.id})).status,409);
 assert.equal((await api(alice,{action:'economyAdmin',operation:'syncCoinRanking'})).status,403);const sync=await api(admin,{action:'economyAdmin',operation:'syncCoinRanking'});assert.equal(sync.status,200);assert.equal(sync.complete,true);assert(sync.checked>0&&sync.checked<=5);assert.equal(sync.failed,0);
 sqlite.exec('DELETE FROM limits');
 const profileCheckin=await api(alice,{action:'economy',operation:'profileCheckin',session:'forged',username:'bob',points:9999});assert.equal(profileCheckin.rankingStatus,'done');assert.equal(profileCheckin.coinsAwarded,false);assert.equal(profileCheckin.ranking,true);assert.equal(rankingCheckinCalls,1);
 assert.equal((await api(alice,{action:'economy',operation:'profileCheckin'})).rankingStatus,'done');assert.equal(rankingCheckinCalls,1);assert.equal((await api(alice,{action:'economy',operation:'profileCheckinStatus'})).ranking,true);
 const health=await worker.fetch(new Request('https://notify.test/health'),{NOTIFICATIONS:{},CFF_GOAL_SERVICE_ACCOUNT:'configured'});assert.equal((await health.json()).economy,true);
});

