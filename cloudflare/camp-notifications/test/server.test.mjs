import test from 'node:test';
import webpush from 'web-push';
const payloads=[];const generate=webpush.generateRequestDetails;webpush.generateRequestDetails=(sub,payload,opts)=>{payloads.push(JSON.parse(payload));return generate(sub,payload,opts);};
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {generateKeyPairSync,sign,createECDH} from 'node:crypto';
const source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
// Actual SQLite, crypto, VAPID and Firebase JWT validation; only the host and network are mocked.
const runtime=new URL('../.test-runtime.mjs',import.meta.url);
writeFileSync(runtime,source.replace("import {DurableObject} from 'cloudflare:workers';","class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}"));
const {NotificationHub,default:worker}=await import(runtime.href);unlinkSync(runtime);
const pair=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...pair.publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'};
const token=(uid,extra={})=>{const now=Math.floor(Date.now()/1000),h=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url'),p=Buffer.from(JSON.stringify({aud:'central-free-fire',iss:'https://securetoken.google.com/central-free-fire',sub:uid,iat:now,exp:now+3600,auth_time:now,...extra})).toString('base64url');return h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),pair.privateKey).toString('base64url');};
const admin=token('admin',{email:'admin@centralfreefire.com.br',email_verified:true}),member=token('member'),other=token('other');
let official=null,pushes=[],unavailable=false;
globalThis.fetch=async(url,options)=>{url=String(url);if(url.includes('googleapis.com/service_accounts'))return Response.json({keys:[jwk]},{headers:{'cache-control':'max-age=3600'}});if(url.includes('firebaseio.com')){if(unavailable)return new Response('',{status:503});return Response.json(official);}if(url.startsWith('https://fcm.googleapis.com/')){assert.equal(options.redirect,'manual');assert.equal(options.headers['Content-Encoding'],'aes128gcm');assert(options.body.length>20);pushes.push({url,headers:options.headers,body:options.body});return new Response(null,{status:201});}throw Error('Unexpected network '+url);};
function context(){const db=new DatabaseSync(':memory:');let alarm=null;return {storage:{sql:{exec(query,...args){if(!args.length&&query.includes(';')){db.exec(query);return{toArray:()=>[]};}const statement=db.prepare(query);if(/^\s*(SELECT|PRAGMA)/i.test(query))return{toArray:()=>statement.all(...args)};statement.run(...args);return{toArray:()=>[]};}},transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}},async setAlarm(value){alarm=value},async deleteAlarm(){alarm=null},async getAlarm(){return alarm}}};}
const subscription=id=>{const ecdh=createECDH('prime256v1');ecdh.generateKeys();return{endpoint:'https://fcm.googleapis.com/fcm/send/'+id,keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:Buffer.alloc(16,7).toString('base64url')}};};
const ctx=context(),hub=new NotificationHub(ctx,{}),id='ffws-br-final';
async function api(action,data={},jwt=member){const response=await hub.fetch(new Request('https://notify.test/api',{method:'POST',headers:{Authorization:'Bearer '+jwt},body:JSON.stringify({action,...data})}));return{status:response.status,...await response.json()};}
const configure={tournamentId:id,name:'FFWS BR Final',enabled:true,teams:[{id:'fx',name:'Fluxo',logo:'https://centralfreefire.com.br/logos/fluxo.webp',aliases:['FLUXO W7M']},{id:'los',name:'LOS'}],officialStage:'final'};
const publish={tournamentId:id,day:2,drop:17,result:{teamId:'fx',team:'spoof',position:4,kills:7,points:14,dayPoints:40,logo:'https://evil.test/logo.png'}};
test('free notification API: authentication, isolation, device ownership, delivery and official transition',async()=>{
 assert.equal((await api('settings',{},'')).status,401);
 assert.equal((await api('settings',{},token('x',{aud:'another-project'}))).status,401);
 assert.equal((await api('settings',{},token('x',{exp:1}))).status,401);
 const fake=token('x').split('.');fake[1]=Buffer.from(JSON.stringify({sub:'admin',aud:'central-free-fire'})).toString('base64url');assert.equal((await api('settings',{},fake.join('.'))).status,401);
 assert.equal((await api('configure',configure)).status,403);
 assert.equal((await api('configure',configure,token('admin2',{email:'another-admin@example.test',email_verified:true}))).status,403);
 assert.equal((await api('configure',{...configure,enabled:false},admin)).status,200);
 assert.equal((await api('publish',publish,admin)).status,400);
 assert.equal((await api('configure',configure,admin)).status,200);
 const settings=await api('settings');assert(settings.publicKey);assert.equal(settings.privateKey,undefined);
 assert.equal((await api('preferences',{tournamentId:id,enabled:true,teams:['fx','constructor']})).status,200);
 assert.equal((await api('preferences',{tournamentId:id,enabled:true,teams:['los']},other)).status,200);
 assert.deepEqual((await api('settings',{},other)).preferences[id].teams,{los:true});
 const sub=subscription('member-device');assert.equal((await api('device',{subscription:sub})).status,200);
 assert.equal((await api('device',{subscription:{...sub,endpoint:'https://localhost/secret'}})).status,400);
 assert.equal((await api('publish',publish)).status,403);
 assert.equal((await api('publish',{...publish,result:{...publish.result,teamId:'constructor'}},admin)).status,400);
 assert.equal((await api('publish',{...publish,result:{...publish.result,position:null}},admin)).status,400);
 assert.equal((await api('publish',{...publish,result:{...publish.result,dayPoints:3}},admin)).status,400);
 unavailable=true;assert.equal((await api('publish',publish,admin)).status,400);unavailable=false;
 const results=await Promise.all([api('publish',publish,admin),api('publish',publish,admin)]);assert.equal(results.filter(r=>!r.duplicate).length,1);
 await hub.alarm();assert.equal(pushes.length,1);let inbox=await api('inbox');assert.equal(inbox.rows.length,1);assert.equal(inbox.rows[0].status,'partial');assert.equal(inbox.rows[0].team,'Fluxo');assert.equal(inbox.rows[0].dayPoints,40);assert.equal(inbox.rows[0].logo,'https://centralfreefire.com.br/Fluxo%202.webp');assert(payloads[0].title.endsWith('DIA 2 / QUEDA 17'));assert(payloads[0].body.includes('14 pts · 40 no dia'));assert.equal(payloads[0].icon,inbox.rows[0].logo);assert.equal(payloads[0].image,inbox.rows[0].logo);assert.equal((await api('inbox',{},other)).rows.length,0);
 await hub.alarm();assert.equal(pushes.length,1);
 official={manual:true,source:{teams:true,players:true},teams:{fx:{team:'FLUXO W7M',position:3,kills:8,points:16}},players:{p:{team:'FLUXO W7M',kills:8}}};
 hub.sql.exec('UPDATE pending SET check_at=0');await hub.alarm();assert.equal((await api('inbox')).rows[0].status,'partial');
 official.manual=false;official.players.p.kills=7;hub.sql.exec('UPDATE pending SET check_at=0');await hub.alarm();assert.equal((await api('inbox')).rows[0].status,'partial');
 official.players.p.kills=8;hub.sql.exec('UPDATE pending SET check_at=0');await hub.alarm();inbox=await api('inbox');assert.equal(inbox.rows.length,1);assert.equal(inbox.rows[0].status,'official');assert.equal(inbox.rows[0].points,16);assert.equal(inbox.rows[0].dayPoints,undefined);assert(!payloads.at(-1).body.includes('no dia'));assert.equal(inbox.rows[0].logo,'https://centralfreefire.com.br/Fluxo%202.webp');assert.equal(pushes.length,2);
 official.teams.fx.points=17;hub.sql.exec('UPDATE pending SET check_at=0');await hub.alarm();assert.equal((await api('inbox')).rows[0].points,17);assert.equal(pushes.length,2);
 assert.equal((await api('publish',publish,admin)).status,400);
 assert.equal((await api('test')).accepted,1);assert.equal((await api('test')).status,400);assert.equal((await api('inbox',{},other)).rows.length,0);
 await api('device',{subscription:sub},other);assert.equal(hub.rows('SELECT * FROM devices WHERE uid=?','member').length,0);assert.equal(hub.rows('SELECT * FROM devices WHERE uid=?','other').length,1);
 await api('removeDevice',{endpoint:sub.endpoint});assert.equal(hub.rows('SELECT * FROM devices WHERE uid=?','other').length,1);
 const badOrigin=await worker.fetch(new Request('https://notify.test/api',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}),{});assert.equal(badOrigin.status,403);
 console.log('No paid backend, no real recipients, encrypted push accepted by mock endpoint.');
});

test('start and Booyah: separate opt-in, deduplication, live link and official confirmation',async()=>{
 const c=context(),h=new NotificationHub(c,{}),camp='test-event-types',fan=token('fan');official=null;pushes=[];payloads.length=0;
 async function call(action,data={},jwt=member){const r=await h.fetch(new Request('https://notify.test/api',{method:'POST',headers:{Authorization:'Bearer '+jwt},body:JSON.stringify({action,...data})}));return {status:r.status,...await r.json()};}
 const cfg={...configure,tournamentId:camp,streamUrl:'https://www.youtube.com/watch?v=live'};
 assert.equal((await call('configure',{...cfg,streamUrl:'javascript:alert(1)'},admin)).status,400);
 assert.equal((await call('configure',cfg,admin)).status,200);
 await call('preferences',{tournamentId:camp,enabled:true,teams:['fx']});
 assert.deepEqual((await call('settings')).preferences[camp].types,{elimination:true,booyah:true,start:true});
 await call('preferences',{tournamentId:camp,enabled:true,teams:['fx'],types:{elimination:true,booyah:false,start:false}});
 await call('preferences',{tournamentId:camp,enabled:true,teams:[],types:{start:true}},other);
 await call('preferences',{tournamentId:camp,enabled:true,teams:['fx'],types:{booyah:true}},fan);
 assert.equal((await call('settings')).preferences[camp].types.booyah,false);
 for(const [jwt,name]of [[member,'member'],[other,'other'],[fan,'fan']])await call('device',{subscription:subscription(name)},jwt);
 const start={tournamentId:camp,day:1,drop:1,kind:'start',map:'Nexterra'};
 assert.equal((await call('publish',start)).status,403);
 assert.equal((await call('publish',{...start,map:''},admin)).status,400);
 assert.equal((await call('publish',start,admin)).duplicate,false);
 assert.equal((await call('publish',start,admin)).duplicate,true);
 await h.alarm();assert.equal(pushes.length,1);
 assert.equal((await call('inbox')).rows.length,0);assert.equal((await call('inbox',{},fan)).rows.length,0);
 let rows=(await call('inbox',{},other)).rows;assert.equal(rows[0].kind,'start');assert.equal(rows[0].map,'Nexterra');assert.equal(rows[0].streamUrl,cfg.streamUrl);
 assert.equal(payloads[0].url,cfg.streamUrl);assert.equal(payloads[0].body,'Queda 1 começou! Mapa: Nexterra.');
 // A queued message must honor a later opt-out.
 await call('publish',{...start,drop:2},admin);await call('preferences',{tournamentId:camp,enabled:true,types:{start:false}},other);await h.alarm();assert.equal(pushes.length,1);
 const win={tournamentId:camp,day:1,drop:1,kind:'booyah',result:{teamId:'los',position:1,kills:12,points:24,dayPoints:24}};
 assert.equal((await call('publish',{...win,result:{...win.result,position:2}},admin)).status,400);
 assert.equal((await call('publish',win,admin)).duplicate,false);
 assert.equal((await call('publish',win,admin)).duplicate,true);
 await h.alarm();assert.equal(pushes.length,2);assert(payloads.at(-1).body.includes('BOOYAH: LOS! 12 abates ·'));
 rows=(await call('inbox',{},fan)).rows;assert.equal(rows.length,1);assert.equal(rows[0].kind,'booyah');assert.equal(rows[0].status,'partial');assert.equal((await call('inbox')).rows.length,0);
 official={source:{teams:true,players:true},teams:{los:{team:'LOS',position:1,kills:13,points:25}},players:{p:{team:'LOS',kills:13}}};
 h.sql.exec('UPDATE pending SET check_at=0');await h.alarm();rows=(await call('inbox',{},fan)).rows;assert.equal(rows.length,1);assert.equal(rows[0].status,'official');assert.equal(rows[0].kind,'booyah');assert.equal(rows[0].kills,13);assert.equal(pushes.length,3);
 assert.equal((await call('publish',{...start,drop:1},admin)).status,400);
 assert.equal((await call('publish',{...start,kind:'invalid'},admin)).status,400);
});

test('admin can restart only the chosen non-official drop and preserve subscriptions',async()=>{
 const h=new NotificationHub(context(),{}),camp='test-restart';official=null;unavailable=false;
 async function call(action,data={},jwt=admin){const r=await h.fetch(new Request('https://notify.test/api',{method:'POST',headers:{Authorization:'Bearer '+jwt},body:JSON.stringify({action,...data})}));return {status:r.status,...await r.json()};}
 await call('configure',{...configure,tournamentId:camp});await call('preferences',{tournamentId:camp,enabled:true,all:true},member);
 const a={tournamentId:camp,day:1,drop:1},b={...a,drop:2},start={...a,kind:'start',map:'Bermuda'};
 await call('publish',start);await call('publish',{...start,drop:2});await call('publish',{...a,kind:'booyah',result:{teamId:'fx',position:1,kills:4,points:16,dayPoints:16}});
 assert.equal((await call('publish',start)).status,400);
 assert.equal((await call('resetDrop',a,member)).status,403);
 unavailable=true;assert.equal((await call('resetDrop',a)).status,400);unavailable=false;
 assert.equal(h.rows('SELECT id FROM events WHERE dropno=1').length,2);
 assert.equal((await call('resetDrop',a)).removed,2);
 assert.equal(h.rows('SELECT id FROM events WHERE dropno=1').length,0);assert.equal(h.rows('SELECT id FROM events WHERE dropno=2').length,1);
 assert.equal(h.rows('SELECT event FROM jobs').length,1);assert.equal(h.rows('SELECT id FROM pending WHERE dropno=1').length,0);
 assert.equal((await call('settings',{},member)).preferences[camp].enabled,true);
 assert.equal((await call('publish',start)).duplicate,false);assert.equal((await call('publish',start)).duplicate,true);
 official={source:{teams:true,players:true},teams:{fx:{team:'FLUXO W7M',position:1,kills:4,points:16}},players:{p:{team:'FLUXO W7M',kills:4}}};
 assert.equal((await call('resetDrop',a)).status,400);assert.equal(h.rows('SELECT id FROM events WHERE dropno=1').length,1);
 official=null;h.sql.exec("UPDATE events SET status='official' WHERE dropno=1");assert.equal((await call('resetDrop',a)).status,400);
 await call('publish',{...start,day:2});assert.equal((await call('resetDay',a,member)).status,403);const batch=await call('resetDay',a);assert.equal(batch.removed,1);assert.deepEqual(batch.skipped,[1]);assert.equal(h.rows('SELECT id FROM events WHERE day=2').length,1);assert.equal(h.rows("SELECT id FROM events WHERE day=1 AND status='official'").length,1);assert.equal((await call('publish',{...start,drop:2})).duplicate,false);
});
test('profile editor gateway requires the real Firebase administrator identity',async()=>{const h=new NotificationHub(context(),{});async function call(jwt,uid){const r=await h.fetch(new Request('https://notify.test/api',{method:'POST',headers:{Authorization:'Bearer '+jwt},body:JSON.stringify({action:'adminReadProfile',uid})}));return r.status;}assert.equal(await call(member,'person'),403);assert.equal(await call(token('admin-password',{email:'admin@centralfreefire.com.br',email_verified:false}),'../person'),400);assert.equal(await call(admin,'../person'),400);});
