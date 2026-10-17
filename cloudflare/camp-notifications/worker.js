import adminTasks from '../../functions/admin-tasks-service.js';
import careerCore from '../../functions/careers.js';
import {createInteractionRanking} from './interaction-ranking.js';
import economyMedia from '../../functions/economy-media.js';
import economyCore from '../../functions/economy.js';
import codeGifts from '../../functions/code-gifts.js';
import globalChat from '../../functions/global-chat.js';
import profileEmblems from '../../functions/profile-emblems.js';
import profileIdentity from '../../functions/profile-identity-sync.js';
import profileGoals from '../../functions/profile-goals.js';
import {goalDatabase} from './goal-database.js';
import {DurableObject} from 'cloudflare:workers';
import webpush from 'web-push';
import C from '../../functions/camp-notifications-core.js';
import R from '../../functions/camp-results-core.js';
import {notificationContent,streamUrl,teamLogo} from '../../js/camp-notification-content.js';
import adminEditor from '../../functions/admin-profile-editor.js';
import {verifyToken} from './auth.js';
const ORIGINS=new Set(['https://centralfreefire.com.br','https://www.centralfreefire.com.br']);
const LIVE='https://central-free-fire-default-rtdb.firebaseio.com/ffwsLive/2026-s2';
const DAY=861800000;
function logoUrl(value){try{const u=new URL(String(value||''));return u.protocol==='https:'&&['centralfreefire.com.br','www.centralfreefire.com.br'].includes(u.hostname)&&!u.port&&!u.username&&!u.password&&u.href.length<=2048?u.href:'';}catch{return '';}}
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default {
 async fetch(request,env) {
  const origin=request.headers.get('Origin'),url=new URL(request.url);
  if(origin&&!ORIGINS.has(origin))return json({error:'Origem não permitida.'},403);
  const headers={'Access-Control-Allow-Origin':origin||'https://centralfreefire.com.br','Vary':'Origin','Access-Control-Allow-Headers':'Authorization,Content-Type,If-None-Match,X-File-Name,X-File-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Cache-Control':'no-store'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  let response;
  if(url.pathname==='/health'&&request.method==='GET')response=json({ok:!!env.NOTIFICATIONS,service:'cff-camp-notifications',version:31,adminTaskReminderOptions:true,adminTasks:true,profileEmblems:true,chatCustomization:true,chatLiveRoles:true,careerDirectory:true,careerMarket:true,giftArchive:true,codeReturns:true,directCodeGift:true,codeVouchers:true,careers:true,careerDepartures:true,registrationRosters:true,monthlyParticipation:{daily:40,days:25,cap:1000},profileCheckin:true,coinRankingSync:true,gameOrders:true,retroactiveRate:5,retroactiveCap:500,currency:'CFF COINS',coinRanking:true,interactionRanking:!!env.COMMUNITY_DB,economy:!!env.CFF_GOAL_SERVICE_ACCOUNT,codeGifts:!!env.CFF_GOAL_SERVICE_ACCOUNT,globalChat:!!env.CFF_GOAL_SERVICE_ACCOUNT,profileIdentitySync:!!env.CFF_GOAL_SERVICE_ACCOUNT,profileGoalRewards:!!env.CFF_GOAL_SERVICE_ACCOUNT});
  else if(request.method==='GET'&&(/^\/economy-media\/[a-f0-9]{64}$/.test(url.pathname)||url.pathname==='/economy-interactions/health'||(/^\/careers\/(person|team|market)$/.test(url.pathname)||/^\/careers\/logo\/[a-f0-9-]{36}$/.test(url.pathname)))&&env.NOTIFICATIONS)response=await env.NOTIFICATIONS.get(env.NOTIFICATIONS.idFromName('cff-v1')).fetch(request);
  else if(/^\/tasks\/(api|files\/[A-Za-z0-9_-]{1,150})$/.test(url.pathname)&&['GET','POST'].includes(request.method)&&env.NOTIFICATIONS)response=await env.NOTIFICATIONS.get(env.NOTIFICATIONS.idFromName('cff-tasks-v1')).fetch(request);
  else if(url.pathname!=='/api'||request.method!=='POST')response=json({error:'Use POST /api.'},405);
  else if(!env.NOTIFICATIONS)response=json({error:'Serviço de avisos ainda em configuração.'},503);
  else response=await env.NOTIFICATIONS.get(env.NOTIFICATIONS.idFromName('cff-v1')).fetch(request);
  const combined=new Headers(response.headers);for(const [key,value]of Object.entries(headers))combined.set(key,value);combined.set('Cache-Control',response.headers.get('Cache-Control')||'no-store');
  return new Response(response.body,{status:response.status,headers:combined});
 }
};
export class NotificationHub extends DurableObject {
 constructor(ctx,env) {
  super(ctx,env);this.ctx=ctx;this.env=env;this.goalSecret=env.CFF_GOAL_SERVICE_ACCOUNT;this.interactionRanking=createInteractionRanking(env.COMMUNITY_DB);this.sql=ctx.storage.sql;this.officialTableCache=new Map();
  this.sql.exec(`CREATE TABLE IF NOT EXISTS catalog(id TEXT PRIMARY KEY,data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS snapshots(tournament TEXT,day INTEGER,dropno INTEGER,data TEXT,at INTEGER,PRIMARY KEY(tournament,day,dropno));
   CREATE TABLE IF NOT EXISTS preferences(uid TEXT,tournament TEXT,data TEXT,PRIMARY KEY(uid,tournament));
   CREATE INDEX IF NOT EXISTS pref_tournament ON preferences(tournament);
   CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,uid TEXT,data TEXT);
   CREATE INDEX IF NOT EXISTS devices_uid ON devices(uid);
   CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,tournament TEXT,day INTEGER,dropno INTEGER,team TEXT,status TEXT,data TEXT,at INTEGER);
   CREATE INDEX IF NOT EXISTS events_drop ON events(tournament,day,dropno);
   CREATE INDEX IF NOT EXISTS events_at ON events(at);
   CREATE TABLE IF NOT EXISTS inbox(uid TEXT,id TEXT,data TEXT,at INTEGER,PRIMARY KEY(uid,id));
   CREATE INDEX IF NOT EXISTS inbox_latest ON inbox(uid,at DESC);
   CREATE INDEX IF NOT EXISTS inbox_event ON inbox(id);
   CREATE TABLE IF NOT EXISTS jobs(event TEXT,uid TEXT,PRIMARY KEY(event,uid));
   CREATE TABLE IF NOT EXISTS pending(id TEXT PRIMARY KEY,tournament TEXT,day INTEGER,dropno INTEGER,check_at INTEGER,expires INTEGER);
   CREATE INDEX IF NOT EXISTS pending_check ON pending(check_at);
   CREATE TABLE IF NOT EXISTS limits(uid TEXT PRIMARY KEY,test_at INTEGER,request_at INTEGER,requests INTEGER);
   CREATE TABLE IF NOT EXISTS meta(id TEXT PRIMARY KEY,data TEXT);`);
  economyCore.initEconomy(this.sql);
 }
 rows(query,...args){return this.sql.exec(query,...args).toArray();}
 tasks(){if(!this.tasksService){this.sql.exec("INSERT OR REPLACE INTO meta VALUES('tasks-instance','1')");this.tasksService=adminTasks.create({sql:this.sql,transaction:fn=>this.ctx.storage.transactionSync(fn),setAlarm:at=>this.ctx.storage.setAlarm(at),deleteAlarm:()=>this.ctx.storage.deleteAlarm(),push:async(uid,message)=>{const response=await this.env.NOTIFICATIONS.get(this.env.NOTIFICATIONS.idFromName('cff-v1')).fetch(new Request('https://tasks-internal/private-task-push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid,message})}));if(!response.ok)throw Error('Não foi possível enviar o lembrete.');return response.json();}});}return this.tasksService;}
 careers(){if(!this.careerStore)this.careerStore=careerCore.create({sql:this.sql,transaction:fn=>this.ctx.storage.transactionSync(fn)});return this.careerStore;}
 config(id){const row=this.rows('SELECT data FROM catalog WHERE id=?',id)[0];return row?JSON.parse(row.data):null;}
 catalog(){return Object.fromEntries(this.rows('SELECT id,data FROM catalog').map(r=>[r.id,JSON.parse(r.data)]));}
 vapid(){let row=this.rows("SELECT data FROM meta WHERE id='vapid'")[0];if(!row){const value=webpush.generateVAPIDKeys();this.sql.exec("INSERT INTO meta VALUES('vapid',?)",JSON.stringify(value));return value;}return JSON.parse(row.data);}
 inbox(uid,event){
  const old=this.rows('SELECT data FROM inbox WHERE uid=? AND id=?',uid,event.inboxId)[0];
  const prior=old&&JSON.parse(old.data);if(prior?.status==='official'&&(event.status==='partial'||prior.at>event.at))return;
  this.sql.exec('INSERT OR REPLACE INTO inbox VALUES(?,?,?,?)',uid,event.inboxId,JSON.stringify(event),event.at);
  this.sql.exec('DELETE FROM inbox WHERE uid=? AND id NOT IN (SELECT id FROM inbox WHERE uid=? ORDER BY at DESC LIMIT 50)',uid,uid);
 }
 enqueue(id,t,day,drop,row,status){
  const kind=row.kind||'elimination',eventKey=kind==='start'?'__start':kind==='booyah'?'__booyah':kind==='summary'?'__summary-'+row.revision:row.teamId;
  const eventId=C.eventId(id,day,drop,eventKey,status),inboxId=C.eventId(id,day,drop,kind==='summary'?'__summary':eventKey,'result'),existing=this.rows('SELECT data FROM events WHERE id=?',eventId)[0];
  const event={...row,kind,streamUrl:streamUrl(t.streamUrl),logo:logoUrl(teamLogo(row.team,row.teamId,row.logo||t.teams[row.teamId]?.logo)),tournamentId:id,tournamentName:t.name,day,drop,status,inboxId,at:Date.now()};
  if(existing){const old=JSON.parse(existing.data);if(status==='official'&&['points','kills','position'].some(k=>old[k]!==event[k])){this.sql.exec('UPDATE events SET data=?,at=? WHERE id=?',JSON.stringify(event),event.at,eventId);const recipients=this.rows('SELECT uid FROM inbox WHERE id=?',inboxId);for(const {uid}of recipients)this.inbox(uid,event);}return false;}
  this.sql.exec('INSERT INTO events VALUES(?,?,?,?,?,?,?,?)',eventId,id,day,drop,row.teamId,status,JSON.stringify(event),event.at);
  for(const p of this.rows('SELECT uid,data FROM preferences WHERE tournament=?',id))if(C.interested(JSON.parse(p.data),event))this.sql.exec('INSERT OR IGNORE INTO jobs VALUES(?,?)',eventId,p.uid);
  return true;
 }
 async clearTestDrop(id,t,day,drop){
    if(t.officialStage&&C.officialRows(await this.official(t.officialStage,day,drop),t.teams).length)throw Error('Esta queda já tem T1 + P1 oficial e não pode ser reiniciada.');
    if(this.rows("SELECT data FROM snapshots WHERE tournament=? AND day=? AND dropno=? AND json_extract(data,'$.status')='official'",id,day,drop).length)throw Error('Esta queda já tem resultado oficial e não pode ser reiniciada.');
    const removed=this.ctx.storage.transactionSync(()=>{
     if(this.rows("SELECT id FROM events WHERE tournament=? AND day=? AND dropno=? AND status='official' LIMIT 1",id,day,drop).length)throw Error('Esta queda já tem resultado oficial e não pode ser reiniciada.');
     const events=this.rows('SELECT id,data FROM events WHERE tournament=? AND day=? AND dropno=?',id,day,drop);
     for(const event of events){this.sql.exec('DELETE FROM jobs WHERE event=?',event.id);this.sql.exec('DELETE FROM inbox WHERE id=?',JSON.parse(event.data).inboxId);}
     this.sql.exec('DELETE FROM events WHERE tournament=? AND day=? AND dropno=?',id,day,drop);
     this.sql.exec('DELETE FROM pending WHERE tournament=? AND day=? AND dropno=?',id,day,drop);this.sql.exec('DELETE FROM snapshots WHERE tournament=? AND day=? AND dropno=?',id,day,drop);return events.length;
    });return removed;
 }
 async schedule(){const jobs=this.rows('SELECT event FROM jobs LIMIT 1').length,pending=this.rows('SELECT check_at FROM pending ORDER BY check_at LIMIT 1')[0];if(jobs||pending)await this.ctx.storage.setAlarm(jobs?Date.now()+1000:Math.max(Date.now()+1000,pending.check_at));else await this.ctx.storage.deleteAlarm();}
 async push(uid,event){
  const devices=this.rows('SELECT id,data FROM devices WHERE uid=?',uid),vapid=this.vapid();
  const {title,body}=notificationContent(event),prefix=event.status==='test'||event.kind==='start'?'':event.status==='official'?'Oficial · ':'Parcial · ';
  const payload=event.kind==='task'?JSON.stringify({title:String(event.title).slice(0,120),body:String(event.body).slice(0,300),tag:event.inboxId,url:'/admin-tarefas.html'+(event.taskId?'?task='+encodeURIComponent(event.taskId):event.view==='day'?'?view=day':''),icon:'/central%20free%20fire.webp'}):JSON.stringify({title,body:prefix+body,icon:logoUrl(event.logo),image:logoUrl(event.logo),tag:event.inboxId,url:event.day&&event.drop&&event.kind!=='start'?'/conta.html?tab=notifications&tournament='+encodeURIComponent(event.tournamentId)+'&day='+event.day+'&drop='+event.drop:streamUrl(event.streamUrl)||'/conta.html?tab=notifications',streamUrl:streamUrl(event.streamUrl)});
  let accepted=0;
  for(const d of devices)try{const subscription=C.subscription(JSON.parse(d.data)),details=webpush.generateRequestDetails(subscription,payload,{vapidDetails:{subject:'https://centralfreefire.com.br',...vapid},TTL:300});const response=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'manual',signal:AbortSignal.timeout(8000)});await response.body?.cancel();if(response.ok)accepted++;else if([404,410].includes(response.status))this.sql.exec('DELETE FROM devices WHERE id=? AND uid=?',d.id,uid);}catch{}
  return {devices:devices.length,accepted};
 }
 async fetch(request){
  if(request.method==='GET'&&new URL(request.url).pathname==='/economy-interactions/health'){try{if(!this.interactionRanking)throw Error('missing');await this.interactionRanking.probe();return json({ok:true,interactionRanking:true});}catch{return json({ok:false,error:'Ranking de interações indisponível.'},503);}}

  try{
   const taskPath=new URL(request.url).pathname;
   // The public gateway never forwards this private route. Only the task scheduler
   // can reach it through the Durable Object binding; no bearer token is exposed.
   if(taskPath==='/private-task-push'&&request.method==='POST'){const bytes=await request.arrayBuffer();if(bytes.byteLength>5000)throw Error('Pedido inválido.');const {uid,message}=JSON.parse(new TextDecoder().decode(bytes));if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid||'')||!message||message.taskId&&!/^[A-Za-z0-9_-]{1,150}$/.test(message.taskId))throw Error('Lembrete inválido.');return json(await this.push(uid,{...message,kind:'task',inboxId:message.tag}));}
   if(taskPath.startsWith('/tasks/')){const token=String(request.headers.get('Authorization')||'').match(/^Bearer (.+)$/)?.[1],user=await verifyToken(token);if(user.email!=='admin@centralfreefire.com.br')return json({error:'Acesso exclusivo do administrador.'},403);return await this.tasks().handle(request,user);}
   const careerLogoId=request.method==='GET'&&new URL(request.url).pathname.match(/^\/careers\/logo\/([a-f0-9-]{36})$/)?.[1];if(careerLogoId){const logo=this.careers().logo(careerLogoId);if(!logo)return json({error:'Escudo não encontrado.'},404);return new Response(Uint8Array.from(atob(logo.base64),c=>c.charCodeAt(0)),{headers:{'Content-Type':logo.type,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});}
   const careerRoute=request.method==='GET'&&new URL(request.url).pathname.match(/^\/careers\/(person|team|market)$/)?.[1];
   if(careerRoute){const url=new URL(request.url),result=this.careers().publicRead(careerRoute,Object.fromEntries(url.searchParams)),entity=result.person,variant=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url.search)))].slice(0,8).map(v=>v.toString(16).padStart(2,'0')).join(''),stamp=variant+'-'+careerCore.key(entity?.id||result.team?.id||'identities')+'-'+(entity?.revision||result.version)+'-'+(entity?.version||result.version)+'-'+careerCore.key(careerCore.day(Date.now())),etag='"career-'+stamp+'"',headers={'Cache-Control':'public, max-age=60, must-revalidate','ETag':etag,'X-Content-Type-Options':'nosniff'};if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers});return Response.json(result,{headers});}
   const mediaId=request.method==='GET'&&new URL(request.url).pathname.match(/^\/economy-media\/([a-f0-9]{64})$/)?.[1];if(mediaId){const media=economyMedia.read(this.sql,mediaId);if(!media)return json({error:'Imagem não encontrada.'},404);return new Response(Uint8Array.from(atob(media.base64),c=>c.charCodeAt(0)),{headers:{'Content-Type':media.type,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});}
   const token=String(request.headers.get('Authorization')||'').match(/^Bearer (.+)$/)?.[1],user=await verifyToken(token),uid=user.uid;
   if(Number(request.headers.get('Content-Length')||0)>180000)throw Error('Pedido muito grande.');
   const reader=request.body?.getReader(),chunks=[];let length=0;
   if(reader)for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>180000){await reader.cancel();throw Error('Pedido muito grande.');}chunks.push(value);}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const b=JSON.parse(new TextDecoder().decode(bytes)),action=b.action;
   const admin=()=>{if(!user.admin)throw Object.assign(Error('Somente administrador.'),{status:403});};
   const rate=this.rows('SELECT * FROM limits WHERE uid=?',uid)[0],now=Date.now(),active=rate&&now-rate.request_at<60000;
   if(active&&rate.requests>=30)throw Object.assign(Error('Aguarde um minuto antes de tentar novamente.'),{status:429});
   this.sql.exec('INSERT OR REPLACE INTO limits VALUES(?,?,?,?)',uid,rate?.test_at||0,active?rate.request_at:now,active?rate.requests+1:1);
   if(action==='careerAdmin'){admin();return json(await this.careers().admin(user,b));}
   if(action==='economy'||action==='economyAdmin'){
    const economy=economyCore.createEconomy({sql:this.sql,transaction:fn=>this.ctx.storage.transactionSync(fn),db:goalDatabase(this.goalSecret),ranking:this.interactionRanking,communityCheckin:async session=>{const r=await fetch('https://cff-instagram-community.nakataffb4.workers.dev/api/checkin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session}),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Não foi possível registrar o check-in agora.');return r.json();},verifySession:async session=>{const r=await fetch('https://cff-instagram-community.nakataffb4.workers.dev/api/checkin/status?session='+encodeURIComponent(session),{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Não foi possível confirmar o Instagram agora.');return r.json();}});
    return json(await (action==='economyAdmin'?economy.adminHandle(user,b):economy.handle(user,b)));
   }
   if(action==='findGiftRecipient')return json(await codeGifts.findRecipient(goalDatabase(this.goalSecret),user,b.query));
   if(action==='codeGiftStatus')return json(await codeGifts.giftStatus(goalDatabase(this.goalSecret),user,b.hashes));
   if(action==='sendCodeGift')return json(await codeGifts.sendCodeGift(goalDatabase(this.goalSecret),user,b));
   if(action==='archiveGift')return json(await codeGifts.archiveGift(goalDatabase(this.goalSecret),user,b));
   if(action==='openCodeGift')return json(await codeGifts.openCodeGift(goalDatabase(this.goalSecret),user,b.giftId));
   if(action==='emblemAdmin')return json(await profileEmblems.adminHandle(goalDatabase(this.goalSecret),user,b));
   if(action==='chatSend')return json(await globalChat.sendMessage(goalDatabase(this.goalSecret),user,b));
   if(action==='chatModerate')return json(await globalChat.moderation(goalDatabase(this.goalSecret),user,b));
   if(action==='chatStatus')return json(await globalChat.chatStatus(goalDatabase(this.goalSecret),user));
   if(action==='chatPreferences')return json(await globalChat.preferences(goalDatabase(this.goalSecret),user,b));
   if(action==='chatReport')return json(await globalChat.report(goalDatabase(this.goalSecret),user,b));
   if(action==='chatModerationData')return json(await globalChat.moderationData(goalDatabase(this.goalSecret),user,b));
   if(action==='chatAdmin')return json(await globalChat.adminChat(goalDatabase(this.goalSecret),user,b));
   if(action==='syncProfileIdentity')return json(await profileIdentity.syncVerifiedProfile(goalDatabase(this.goalSecret),user,async session=>{
    const r=await fetch('https://cff-instagram-community.nakataffb4.workers.dev/api/checkin/status?session='+encodeURIComponent(session),{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw Error('Não foi possível confirmar o Instagram agora.');return r.json();
   }));
   if(action==='claimProfileGoals'){return json(await profileGoals.claimProfileGoals(goalDatabase(this.goalSecret),user,async username=>{const r=await fetch('https://cff-instagram-community.nakataffb4.workers.dev/api/achievements/profile?username='+encodeURIComponent(username),{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Não foi possível conferir os pontos agora.');return r.json();}));}
   if(action==='adminReadProfile'||action==='adminEditProfile'){
    admin();const database={ref:(path='')=>({get:async()=>{const r=await fetch('https://central-free-fire-default-rtdb.firebaseio.com/'+path.split('/').map(encodeURIComponent).join('/')+'.json?auth='+encodeURIComponent(token),{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Não foi possível ler o perfil.');const value=await r.json();return {val:()=>value,exists:()=>value!==null};},update:async changes=>{const r=await fetch('https://central-free-fire-default-rtdb.firebaseio.com/.json?auth='+encodeURIComponent(token),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(changes),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Não foi possível salvar o perfil.');}})};
    return json(action==='adminReadProfile'?await adminEditor.readProfile(database,user,b.uid):await adminEditor.editProfile(database,user,b.uid,b.profile));
   }
   if(action==='settings')return json({publicKey:this.vapid().publicKey,catalog:Object.fromEntries(Object.entries(this.catalog()).filter(([,t])=>t.enabled||user.admin)),preferences:Object.fromEntries(this.rows('SELECT tournament,data FROM preferences WHERE uid=?',uid).map(p=>[p.tournament,JSON.parse(p.data)]))});
   if(action==='inbox')return json({rows:this.rows('SELECT data FROM inbox WHERE uid=? ORDER BY at DESC LIMIT 50',uid).map(r=>JSON.parse(r.data))});
   if(action==='preferences'){
    const id=C.text(b.tournamentId,100),t=this.config(id);if(!t?.enabled)throw Error('Este torneio não está habilitado para avisos.');
    const teams={};for(const team of(Array.isArray(b.teams)?b.teams:[]).slice(0,100))if(Object.hasOwn(t.teams,team))teams[team]=true;
    const previous=this.rows('SELECT data FROM preferences WHERE uid=? AND tournament=?',uid,id)[0],prior=previous?JSON.parse(previous.data):{};
    const types=b.types?{elimination:b.types.elimination===true,booyah:b.types.booyah===true,start:b.types.start===true}:prior.types||{elimination:true,booyah:true,start:true};
    const data={enabled:b.enabled===true,all:b.all===true,teams,types};this.sql.exec('INSERT OR REPLACE INTO preferences VALUES(?,?,?)',uid,id,JSON.stringify(data));return json({ok:true});
   }
   if(action==='device'){
    const subscription=C.subscription(b.subscription),id=C.hash(subscription.endpoint),owned=this.rows('SELECT id FROM devices WHERE uid=?',uid);if(owned.length>=5&&!owned.some(d=>d.id===id))throw Error('Limite de 5 aparelhos.');
    this.sql.exec('INSERT OR REPLACE INTO devices VALUES(?,?,?)',id,uid,JSON.stringify(subscription));return json({ok:true});
   }
   if(action==='removeDevice'){this.sql.exec('DELETE FROM devices WHERE id=? AND uid=?',C.hash(String(b.endpoint||'')),uid);return json({ok:true});}
   if(action==='test'){
    if(now-(rate?.test_at||0)<60000)throw Error('Aguarde um minuto antes de testar novamente.');this.sql.exec('UPDATE limits SET test_at=? WHERE uid=?',now,uid);
    const event={status:'test',at:now,inboxId:'test',tournamentName:'Teste Central FF'};this.inbox(uid,event);return json({ok:true,...await this.push(uid,event)});
   }
   if(action==='configure'){
    admin();const id=C.text(b.tournamentId,100);if(!/^[a-z0-9-]{5,100}$/.test(id))throw Error('Identificador inválido.');const teams={};
    for(const r of(Array.isArray(b.teams)?b.teams:[]).slice(0,100)){const teamId=C.key(r.id);if(teamId&&r.name)teams[teamId]={name:C.text(r.name,100),logo:logoUrl(r.logo),aliases:[...new Set([r.name,r.id,...(Array.isArray(r.aliases)?r.aliases:[])].map(v=>C.text(v,100)))].slice(0,10)};}
    if(!b.name||!Object.keys(teams).length)throw Error('Defina nome e times do torneio.');
    if(b.streamUrl&&!streamUrl(b.streamUrl))throw Error('Use um link HTTPS de YouTube, Twitch, Facebook, Kick ou Central Free Fire.');
    const old=this.config(id),officialStage=['final','segundaFase'].includes(b.officialStage)?b.officialStage:'';if(old?.officialStage&&officialStage!==old.officialStage)throw Error('Crie outro torneio para trocar a etapa oficial.');
    if(!old&&this.rows('SELECT id FROM catalog').length>=100)throw Error('Limite de 100 torneios.');this.sql.exec('INSERT OR REPLACE INTO catalog VALUES(?,?)',id,JSON.stringify({name:C.text(b.name),enabled:b.enabled===true,teams,officialStage,streamUrl:b.streamUrl===undefined?streamUrl(old?.streamUrl):streamUrl(b.streamUrl),updatedAt:now}));return json({ok:true,tournamentId:id});
   }
   if(action==='resetDrop'||action==='resetDay'){
    admin();const id=C.text(b.tournamentId,100),t=this.config(id);if(!t)throw Error('Torneio não encontrado.');const day=C.integer(b.day,1,365);
    if(action==='resetDrop'){const removed=await this.clearTestDrop(id,t,day,C.integer(b.drop,1,999));await this.schedule();return json({ok:true,removed});}
    let removed=0;const skipped=[];
    for(const row of this.rows('SELECT dropno FROM events WHERE tournament=? AND day=? UNION SELECT dropno FROM snapshots WHERE tournament=? AND day=?',id,day,id,day)){
     try{removed+=await this.clearTestDrop(id,t,day,row.dropno);}catch(e){if(/oficial/.test(e.message))skipped.push(row.dropno);else throw e;}
    }await this.schedule();return json({ok:true,removed,skipped});
   }
   if(action==='results'){
    const id=C.text(b.tournamentId,100),t=this.config(id);if(!t?.enabled)throw Error('Este torneio não está habilitado para avisos.');
    const saved=this.rows('SELECT data FROM snapshots WHERE tournament=? ORDER BY day,dropno LIMIT 2000',id).map(r=>JSON.parse(r.data));
    const officialData=t.officialStage?await this.officialTables(t.officialStage):null;
    const all=R.mergeOfficialMatches(saved,officialData?.data,t.teams,t.officialStage);
    const tournamentState=R.tournamentState(all,t.teams,t.officialStage,officialData?.data);
    const selected=b.day!==undefined||b.drop!==undefined?all.find(s=>s.day===C.integer(b.day,1,365)&&s.drop===C.integer(b.drop,1,999)):all.at(-1);
    if(!selected)return json({selected:null,matches:all.slice(-100).map(s=>({day:s.day,drop:s.drop,map:s.map,status:s.status})),overall:null,tournamentState,officialSyncUnavailable:officialData?.unavailable===true});
    const until=all.filter(s=>s.day<selected.day||s.day===selected.day&&s.drop<=selected.drop);
    return json({selected,matches:all.slice(-100).map(s=>({day:s.day,drop:s.drop,map:s.map,status:s.status})),overall:R.totals(until,t.teams),dayTotals:R.totals(until,t.teams,selected.day),teams:t.teams,streamUrl:streamUrl(t.streamUrl),tournamentState,officialSyncUnavailable:officialData?.unavailable===true});
   }
   if(action==='publishResults'){
    admin();const id=C.text(b.tournamentId,100),t=this.config(id);if(!t?.enabled)throw Error('Marque este torneio para permitir avisos.');
    const day=C.integer(b.day,1,365),drop=C.integer(b.drop,1,999);
    if(!Array.isArray(b.matches)||!b.matches.length||b.matches.length>100)throw Error('Envie de 1 a 100 quedas por vez.');
    let matches=b.matches.map(m=>R.normalize(m,t.teams));
    if(new Set(matches.map(m=>m.day+':'+m.drop)).size!==matches.length||matches.some(m=>m.day>day||m.day===day&&m.drop>drop)||!matches.some(m=>m.day===day&&m.drop===drop))throw Error('Confira os dias e quedas enviados.');
    if(t.officialStage){
     const days=new Map();for(const d of [...new Set(matches.map(m=>m.day))]){const r=await fetch(`${LIVE}/${t.officialStage}/drops/${d}.json`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Não foi possível conferir T1 + P1. Tente novamente.');days.set(d,await r.json());}
     matches=matches.map(m=>R.promote(m,C.officialRows(days.get(m.day)?.[m.drop],t.teams)));
    }
    let changed=0,current,notified=false;
    this.ctx.storage.transactionSync(()=>{
     for(let m of matches){const found=this.rows('SELECT data FROM snapshots WHERE tournament=? AND day=? AND dropno=?',id,m.day,m.drop)[0],prior=found&&JSON.parse(found.data);
      if(prior?.status==='official'&&m.status!=='official')m=prior;
      const comparable=v=>JSON.stringify([v.map,v.participants,v.rows,v.headstart,v.status,v.complete]);
      if(!prior||comparable(prior)!==comparable(m)){m={...m,revision:(prior?.revision||0)+1,at:now};this.sql.exec('INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?)',id,m.day,m.drop,JSON.stringify(m),now);changed++;}else m=prior;
      if(m.day===day&&m.drop===drop)current=m;
     }
     if(t.officialStage&&current.status!=='official')this.sql.exec('INSERT OR IGNORE INTO pending VALUES(?,?,?,?,?,?)',`${id}:${day}:${drop}`,id,day,drop,now+60000,now+7*DAY);
     if(b.notify===true)notified=this.enqueue(id,t,day,drop,{teamId:'__summary',kind:'summary',results:current.rows,revision:current.revision,map:current.map},current.status);
    });await this.schedule();return json({ok:true,changed,revision:current.revision,status:current.status,notified,summaryAlreadySent:b.notify===true&&!notified,url:'/conta.html?tab=notifications&tournament='+encodeURIComponent(id)+'&day='+day+'&drop='+drop});
   }
   if(action==='publish'){
    admin();const id=C.text(b.tournamentId,100),t=this.config(id);if(!t?.enabled)throw Error('Marque este torneio para permitir avisos.');const day=C.integer(b.day,1,365),drop=C.integer(b.drop,1,999),kind=b.kind||'elimination';
    if(!['elimination','booyah','start'].includes(kind))throw Error('Tipo de aviso inválido.');
    if(kind==='start'){
     const map=C.text(b.map,60);if(!map)throw Error('Selecione o mapa antes de avisar o início da queda.');
     if(this.rows("SELECT id FROM events WHERE tournament=? AND day=? AND dropno=? AND (status='official' OR json_extract(data,'$.kind')='booyah') LIMIT 1",id,day,drop).length)throw Error('Esta queda já terminou.');
     if(t.officialStage&&C.officialRows(await this.official(t.officialStage,day,drop),t.teams).length)throw Error('Esta queda já tem T1 + P1 oficial.');
     const sent=this.ctx.storage.transactionSync(()=>this.enqueue(id,t,day,drop,{teamId:'__start',kind,map},'live'));await this.schedule();return json({ok:true,duplicate:!sent});
    }
    const row={...C.result(b.result),kind};if(kind==='booyah'&&row.position!==1)throw Error('Booyah exige a primeira colocação.');if(!Object.hasOwn(t.teams,row.teamId))throw Error('Time não cadastrado neste torneio.');row.team=t.teams[row.teamId].name;row.logo=logoUrl(b.result?.logo||t.teams[row.teamId].logo);if(b.result?.dayPoints!==undefined){row.dayPoints=C.integer(b.result.dayPoints,0,1000000);if(row.dayPoints<row.points)throw Error('O total do dia não pode ser menor que os pontos da queda.');}if(row.points<row.kills)throw Error('Os pontos não podem ser menores que os abates.');
    if(t.officialStage){const official=await this.official(t.officialStage,day,drop);if(C.officialRows(official,t.teams).some(r=>r.teamId===row.teamId))throw Error('Esta queda já tem T1 + P1 oficial.');}
    let sent;this.ctx.storage.transactionSync(()=>{sent=this.enqueue(id,t,day,drop,row,'partial');if(t.officialStage)this.sql.exec('INSERT OR IGNORE INTO pending VALUES(?,?,?,?,?,?)',`${id}:${day}:${drop}`,id,day,drop,now+60000,now+7*DAY);});await this.schedule();return json({ok:true,duplicate:!sent});
   }
   return json({error:'Ação inválida.'},400);
  }catch(error){return json({error:error.status?error.message:'Não foi possível concluir. '+(error.message||'Confira os dados.')},error.status||400);}
 }
 async officialTables(stage){
  const now=Date.now(),cached=this.officialTableCache.get(stage);if(cached&&now-cached.at<60000)return cached;
  try{const r=await fetch(`${LIVE}/${stage}.json`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Official data unavailable');const data=await r.json();const value={at:now,data,unavailable:false};this.officialTableCache.set(stage,value);return value;}catch{const value={at:now,data:cached?.data||null,unavailable:true};this.officialTableCache.set(stage,value);return value;}
 }
 async official(stage,day,drop){const response=await fetch(`${LIVE}/${stage}/drops/${day}/${drop}.json`,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Não foi possível conferir T1 + P1. Tente novamente.');return response.json();}
 async alarm(){
  if(this.rows("SELECT data FROM meta WHERE id='tasks-instance'").length){await this.tasks().alarm();return;}
  try{
   const now=Date.now();this.sql.exec('DELETE FROM pending WHERE expires<?',now);
   for(const pending of this.rows('SELECT * FROM pending WHERE check_at<=? ORDER BY check_at LIMIT 3',now)){
    const t=this.config(pending.tournament);if(!t?.enabled||!t.officialStage){this.sql.exec('DELETE FROM pending WHERE id=?',pending.id);continue;}
    try{const rows=C.officialRows(await this.official(t.officialStage,pending.day,pending.dropno),t.teams),published=this.rows("SELECT team,data FROM events WHERE tournament=? AND day=? AND dropno=? AND status='partial'",pending.tournament,pending.day,pending.dropno);
     const found=this.rows('SELECT data FROM snapshots WHERE tournament=? AND day=? AND dropno=?',pending.tournament,pending.day,pending.dropno)[0];
     if(found){const prior=JSON.parse(found.data),next=R.promote(prior,rows);if(next.status==='official'&&JSON.stringify(next.rows)!==JSON.stringify(prior.rows)||next.status==='official'&&prior.status!=='official'){next.revision=(prior.revision||0)+1;next.at=now;this.sql.exec('UPDATE snapshots SET data=?,at=? WHERE tournament=? AND day=? AND dropno=?',JSON.stringify(next),now,pending.tournament,pending.day,pending.dropno);}}
     this.ctx.storage.transactionSync(()=>{for(const p of published){const prior=JSON.parse(p.data),row=rows.find(r=>r.teamId===p.team);if(!row)continue;
      if(prior.kind==='booyah'){const winner=rows.find(r=>r.position===1);if(winner)this.enqueue(pending.tournament,t,pending.day,pending.dropno,{...winner,kind:'booyah'},'official');}
      else this.enqueue(pending.tournament,t,pending.day,pending.dropno,row,'official');
     }});
    }catch{/* A failed read never promotes partial scores. */}
    this.sql.exec('UPDATE pending SET check_at=? WHERE id=?',Date.now()+(pending.expires-now>6*DAY?60000:300000),pending.id);
   }
   for(const job of this.rows('SELECT event,uid FROM jobs LIMIT 3')){
    const record=this.rows('SELECT data FROM events WHERE id=?',job.event)[0],event=record&&JSON.parse(record.data),t=event&&this.config(event.tournamentId),preference=event&&this.rows('SELECT data FROM preferences WHERE uid=? AND tournament=?',job.uid,event.tournamentId)[0];
    const officialId=event&&C.eventId(event.tournamentId,event.day,event.drop,event.kind==='booyah'?'__booyah':event.teamId,'official');
    const allowed=event&&t?.enabled&&preference&&C.interested(JSON.parse(preference.data),event)&&!(event.status==='partial'&&this.rows('SELECT id FROM events WHERE id=?',officialId).length);
    // Claim before outbound push: retries of an alarm cannot duplicate a notification.
    this.ctx.storage.transactionSync(()=>{this.sql.exec('DELETE FROM jobs WHERE event=? AND uid=?',job.event,job.uid);if(allowed)this.inbox(job.uid,event);});
    if(allowed)await this.push(job.uid,event);
   }
  }finally{await this.schedule();}
 }
}

