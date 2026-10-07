import {DurableObject} from 'cloudflare:workers';
import webpush from 'web-push';
import C from '../../functions/camp-notifications-core.js';
import {verifyToken} from './auth.js';
const ORIGINS=new Set(['https://centralfreefire.com.br','https://www.centralfreefire.com.br']);
const LIVE='https://central-free-fire-default-rtdb.firebaseio.com/ffwsLive/2026-s2';
const DAY=86400000;
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default {
 async fetch(request,env) {
  const origin=request.headers.get('Origin'),url=new URL(request.url);
  if(origin&&!ORIGINS.has(origin))return json({error:'Origem não permitida.'},403);
  const headers={'Access-Control-Allow-Origin':origin||'https://centralfreefire.com.br','Vary':'Origin','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  let response;
  if(url.pathname==='/health'&&request.method==='GET')response=json({ok:!!env.NOTIFICATIONS,service:'cff-camp-notifications',version:1});
  else if(url.pathname!=='/api'||request.method!=='POST')response=json({error:'Use POST /api.'},405);
  else if(!env.NOTIFICATIONS)response=json({error:'Serviço de avisos ainda em configuração.'},503);
  else response=await env.NOTIFICATIONS.get(env.NOTIFICATIONS.idFromName('cff-v1')).fetch(request);
  return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...headers}});
 }
};
export class NotificationHub extends DurableObject {
 constructor(ctx,env) {
  super(ctx,env);this.ctx=ctx;this.sql=ctx.storage.sql;
  this.sql.exec(`CREATE TABLE IF NOT EXISTS catalog(id TEXT PRIMARY KEY,data TEXT NOT NULL);
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
 }
 rows(query,...args){return this.sql.exec(query,...args).toArray();}
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
  const eventId=C.eventId(id,day,drop,row.teamId,status),inboxId=C.eventId(id,day,drop,row.teamId,'result'),existing=this.rows('SELECT data FROM events WHERE id=?',eventId)[0];
  const event={...row,tournamentId:id,tournamentName:t.name,day,drop,status,inboxId,at:Date.now()};
  if(existing){const old=JSON.parse(existing.data);if(status==='official'&&['points','kills','position'].some(k=>old[k]!==event[k])){this.sql.exec('UPDATE events SET data=?,at=? WHERE id=?',JSON.stringify(event),event.at,eventId);const recipients=this.rows('SELECT uid FROM inbox WHERE id=?',inboxId);for(const {uid}of recipients)this.inbox(uid,event);}return false;}
  this.sql.exec('INSERT INTO events VALUES(?,?,?,?,?,?,?,?)',eventId,id,day,drop,row.teamId,status,JSON.stringify(event),event.at);
  for(const p of this.rows('SELECT uid,data FROM preferences WHERE tournament=?',id))if(C.interested(JSON.parse(p.data),event))this.sql.exec('INSERT OR IGNORE INTO jobs VALUES(?,?)',eventId,p.uid);
  return true;
 }
 async schedule(){const jobs=this.rows('SELECT event FROM jobs LIMIT 1').length,pending=this.rows('SELECT check_at FROM pending ORDER BY check_at LIMIT 1')[0];if(jobs||pending)await this.ctx.storage.setAlarm(jobs?Date.now()+1000:Math.max(Date.now()+1000,pending.check_at));else await this.ctx.storage.deleteAlarm();}
 async push(uid,event){
  const devices=this.rows('SELECT id,data FROM devices WHERE uid=?',uid),vapid=this.vapid();
  const payload=JSON.stringify({title:event.status==='test'?'Teste Central FF':event.tournamentName,body:event.status==='test'?'Os avisos deste aparelho estão funcionando.':`${event.status==='official'?'Pontuação oficial':'Pontuação parcial'} · ${event.team} · ${event.position}º · ${event.kills} abates · ${event.points} pontos · D${event.day} Q${event.drop}`,tag:event.inboxId,url:'/conta.html?tab=notifications'});
  let accepted=0;
  for(const d of devices)try{const subscription=C.subscription(JSON.parse(d.data)),details=webpush.generateRequestDetails(subscription,payload,{vapidDetails:{subject:'https://centralfreefire.com.br',...vapid},TTL:300});const response=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'manual',signal:AbortSignal.timeout(8000)});await response.body?.cancel();if(response.ok)accepted++;else if([404,410].includes(response.status))this.sql.exec('DELETE FROM devices WHERE id=? AND uid=?',d.id,uid);}catch{}
  return {devices:devices.length,accepted};
 }
 async fetch(request){
  try{
   const token=String(request.headers.get('Authorization')||'').match(/^Bearer (.+)$/)?.[1],user=await verifyToken(token),uid=user.uid;
   if(Number(request.headers.get('Content-Length')||0)>40000)throw Error('Pedido muito grande.');
   const reader=request.body?.getReader(),chunks=[];let length=0;
   if(reader)for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>40000){await reader.cancel();throw Error('Pedido muito grande.');}chunks.push(value);}
   const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}const b=JSON.parse(new TextDecoder().decode(bytes)),action=b.action;
   const admin=()=>{if(!user.admin)throw Object.assign(Error('Somente administrador.'),{status:403});};
   const rate=this.rows('SELECT * FROM limits WHERE uid=?',uid)[0],now=Date.now(),active=rate&&now-rate.request_at<60000;
   if(active&&rate.requests>=30)throw Object.assign(Error('Aguarde um minuto antes de tentar novamente.'),{status:429});
   this.sql.exec('INSERT OR REPLACE INTO limits VALUES(?,?,?,?)',uid,rate?.test_at||0,active?rate.request_at:now,active?rate.requests+1:1);
   if(action==='settings')return json({publicKey:this.vapid().publicKey,catalog:Object.fromEntries(Object.entries(this.catalog()).filter(([,t])=>t.enabled||user.admin)),preferences:Object.fromEntries(this.rows('SELECT tournament,data FROM preferences WHERE uid=?',uid).map(p=>[p.tournament,JSON.parse(p.data)]))});
   if(action==='inbox')return json({rows:this.rows('SELECT data FROM inbox WHERE uid=? ORDER BY at DESC LIMIT 50',uid).map(r=>JSON.parse(r.data))});
   if(action==='preferences'){
    const id=C.text(b.tournamentId,100),t=this.config(id);if(!t?.enabled)throw Error('Este torneio não está habilitado para avisos.');
    const teams={};for(const team of(Array.isArray(b.teams)?b.teams:[]).slice(0,100))if(Object.hasOwn(t.teams,team))teams[team]=true;
    const data={enabled:b.enabled===true,all:b.all===true,teams};this.sql.exec('INSERT OR REPLACE INTO preferences VALUES(?,?,?)',uid,id,JSON.stringify(data));return json({ok:true});
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
    for(const r of(Array.isArray(b.teams)?b.teams:[]).slice(0,100)){const teamId=C.key(r.id);if(teamId&&r.name)teams[teamId]={name:C.text(r.name,100),aliases:[...new Set([r.name,r.id,...(Array.isArray(r.aliases)?r.aliases:[])].map(v=>C.text(v,100)))].slice(0,10)};}
    if(!b.name||!Object.keys(teams).length)throw Error('Defina nome e times do torneio.');
    const old=this.config(id),officialStage=['final','segundaFase'].includes(b.officialStage)?b.officialStage:'';if(old?.officialStage&&officialStage!==old.officialStage)throw Error('Crie outro torneio para trocar a etapa oficial.');
    if(!old&&this.rows('SELECT id FROM catalog').length>=100)throw Error('Limite de 100 torneios.');this.sql.exec('INSERT OR REPLACE INTO catalog VALUES(?,?)',id,JSON.stringify({name:C.text(b.name),enabled:b.enabled===true,teams,officialStage,updatedAt:now}));return json({ok:true,tournamentId:id});
   }
   if(action==='publish'){
    admin();const id=C.text(b.tournamentId,100),t=this.config(id);if(!t?.enabled)throw Error('Marque este torneio para permitir avisos.');const day=C.integer(b.day,1,365),drop=C.integer(b.drop,1,999),row=C.result(b.result);if(!Object.hasOwn(t.teams,row.teamId))throw Error('Time não cadastrado neste torneio.');row.team=t.teams[row.teamId].name;if(row.points<row.kills)throw Error('Os pontos não podem ser menores que os abates.');
    if(t.officialStage){const official=await this.official(t.officialStage,day,drop);if(C.officialRows(official,t.teams).some(r=>r.teamId===row.teamId))throw Error('Esta queda já tem T1 + P1 oficial.');}
    let sent;this.ctx.storage.transactionSync(()=>{sent=this.enqueue(id,t,day,drop,row,'partial');if(t.officialStage)this.sql.exec('INSERT OR IGNORE INTO pending VALUES(?,?,?,?,?,?)',`${id}:${day}:${drop}`,id,day,drop,now+60000,now+7*DAY);});await this.schedule();return json({ok:true,duplicate:!sent});
   }
   return json({error:'Ação inválida.'},400);
  }catch(error){return json({error:error.status?error.message:'Não foi possível concluir. '+(error.message||'Confira os dados.')},error.status||400);}
 }
 async official(stage,day,drop){const response=await fetch(`${LIVE}/${stage}/drops/${day}/${drop}.json`,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Não foi possível conferir T1 + P1. Tente novamente.');return response.json();}
 async alarm(){
  try{
   const now=Date.now();this.sql.exec('DELETE FROM pending WHERE expires<?',now);
   for(const pending of this.rows('SELECT * FROM pending WHERE check_at<=? ORDER BY check_at LIMIT 3',now)){
    const t=this.config(pending.tournament);if(!t?.enabled||!t.officialStage){this.sql.exec('DELETE FROM pending WHERE id=?',pending.id);continue;}
    try{const rows=C.officialRows(await this.official(t.officialStage,pending.day,pending.dropno),t.teams),published=this.rows("SELECT team FROM events WHERE tournament=? AND day=? AND dropno=? AND status='partial'",pending.tournament,pending.day,pending.dropno);
     this.ctx.storage.transactionSync(()=>{for(const row of rows)if(published.some(p=>p.team===row.teamId))this.enqueue(pending.tournament,t,pending.day,pending.dropno,row,'official');});
    }catch{/* A failed read never promotes partial scores. */}
    this.sql.exec('UPDATE pending SET check_at=? WHERE id=?',Date.now()+(pending.expires-now>6*DAY?60000:300000),pending.id);
   }
   for(const job of this.rows('SELECT event,uid FROM jobs LIMIT 3')){
    const record=this.rows('SELECT data FROM events WHERE id=?',job.event)[0],event=record&&JSON.parse(record.data),t=event&&this.config(event.tournamentId),preference=event&&this.rows('SELECT data FROM preferences WHERE uid=? AND tournament=?',job.uid,event.tournamentId)[0];
    const officialId=event&&C.eventId(event.tournamentId,event.day,event.drop,event.teamId,'official');
    const allowed=event&&t?.enabled&&preference&&C.interested(JSON.parse(preference.data),event)&&!(event.status==='partial'&&this.rows('SELECT id FROM events WHERE id=?',officialId).length);
    // Claim before outbound push: retries of an alarm cannot duplicate a notification.
    this.ctx.storage.transactionSync(()=>{this.sql.exec('DELETE FROM jobs WHERE event=? AND uid=?',job.event,job.uid);if(allowed)this.inbox(job.uid,event);});
    if(allowed)await this.push(job.uid,event);
   }
  }finally{await this.schedule();}
 }
}
