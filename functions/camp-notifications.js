'use strict';
const {onRequest}=require('firebase-functions/v2/https');
const {onValueCreated,onValueWritten}=require('firebase-functions/v2/database');
const {getDatabase}=require('firebase-admin/database');
const {getAuth}=require('firebase-admin/auth');
const webpush=require('web-push');
const C=require('./camp-notifications-core');
const REGION='southamerica-east1',ADMIN='admin@centralfreefire.com.br',ROOT='campNotifications';
const opts={region:REGION,maxInstances:3,memory:'256MiB'};
async function keys(db){const ref=db.ref(ROOT+'/private/vapid');const snap=await ref.get();if(snap.exists())return snap.val();const generated=webpush.generateVAPIDKeys();const claimed=await ref.transaction(old=>old||generated);return claimed.snapshot.val();}
async function deviceSend(db,uid,event){
 const devices=(await db.ref(ROOT+'/private/devices/'+uid).get()).val()||{},vapid=await keys(db);
 const payload=JSON.stringify({title:event.status==='test'?'Teste Central FF':event.tournamentName,body:event.status==='test'?'Os avisos deste aparelho estão funcionando.':`${event.status==='official'?'Pontuação oficial':'Pontuação parcial'} · ${event.team} · ${event.position}º · ${event.kills} abates · ${event.points} pontos · D${event.day} Q${event.drop}`,tag:event.inboxId,url:'/conta.html?tab=notifications'});
 const out=await Promise.all(Object.entries(devices).map(async([id,d])=>{try{await webpush.sendNotification(d.subscription,payload,{vapidDetails:{subject:'https://centralfreefire.com.br',...vapid},TTL:300,timeout:8000});return true;}catch(e){if([404,410].includes(e.statusCode))await db.ref(ROOT+'/private/devices/'+uid+'/'+id).remove();return false;}}));
 return {devices:out.length,accepted:out.filter(Boolean).length};
}
async function inbox(db,uid,event){
 await db.ref(ROOT+'/inboxes/'+uid+'/'+event.inboxId).transaction(old=>old?.status==='official'&&(event.status==='partial'||(event.status==='official'&&old.at>event.at))?undefined:event);
 const old=await db.ref(ROOT+'/inboxes/'+uid).orderByChild('at').limitToLast(51).get();const list=Object.entries(old.val()||{}).sort((a,b)=>a[1].at-b[1].at);if(list.length>50)await db.ref(ROOT+'/inboxes/'+uid+'/'+list[0][0]).remove();
}
async function enqueue(db,tournamentId,tournament,day,drop,row,status){
 const id=C.eventId(tournamentId,day,drop,row.teamId,status),inboxId=C.eventId(tournamentId,day,drop,row.teamId,'result');
 const event={...row,tournamentId,tournamentName:tournament.name,day,drop,status,inboxId,at:Date.now()};
 const claim=await db.ref(ROOT+'/private/events/'+id).transaction(old=>old?undefined:event);
 return claim.committed;
}
exports.campNotificationApi=onRequest({...opts,cors:['https://centralfreefire.com.br','https://www.centralfreefire.com.br'],timeoutSeconds:60},async(req,res)=>{
 res.set('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Use POST.'});
 try{
  if(Number(req.get('content-length')||0)>40000)throw Error('Pedido muito grande.');
  const match=String(req.get('authorization')||'').match(/^Bearer (.+)$/);if(!match)return res.status(401).json({error:'Entre com Google.'});
  const user=await getAuth().verifyIdToken(match[1]),db=getDatabase(),b=req.body||{},action=b.action,uid=user.uid;
  const admin=()=>{if(user.email!==ADMIN)throw Object.assign(Error('Somente administrador.'),{status:403});};
  if(action==='settings'){const [v,p]=await Promise.all([keys(db),db.ref(ROOT+'/private/preferences/'+uid).get()]);return res.json({publicKey:v.publicKey,preferences:p.val()||{}});}
  if(action==='preferences'){
   const id=C.text(b.tournamentId,100),t=(await db.ref(ROOT+'/catalog/'+id).get()).val();if(!t?.enabled)throw Error('Este torneio não está habilitado para avisos.');
   const teams={};for(const value of (Array.isArray(b.teams)?b.teams:[]).slice(0,100))if(t.teams?.[value])teams[value]=true;
   const preference={enabled:b.enabled===true,all:b.all===true,teams};
   await db.ref().update({[ROOT+'/private/preferences/'+uid+'/'+id]:preference,[ROOT+'/private/subscribers/'+id+'/'+uid]:preference.enabled?preference:null});return res.json({ok:true});
  }
  if(action==='device'){
   const s=C.subscription(b.subscription),id=C.hash(s.endpoint),ref=db.ref(ROOT+'/private/devices/'+uid),devices=(await ref.get()).val()||{};
   if(Object.keys(devices).length>=5&&!devices[id])throw Error('Limite de 5 aparelhos. Desative um antes de adicionar outro.');
   // Ownership prevents a shared browser from receiving the previous account's alerts.
   const ownerRef=db.ref(ROOT+'/private/deviceOwners/'+id),owner=(await ownerRef.get()).val();if(owner&&owner!==uid)await db.ref(ROOT+'/private/devices/'+owner+'/'+id).remove();
   await ref.child(id).set({subscription:s,at:Date.now()});await ownerRef.set(uid);return res.json({ok:true});
  }
  if(action==='removeDevice'){const id=C.hash(String(b.endpoint||''));await db.ref(ROOT+'/private/devices/'+uid+'/'+id).remove();return res.json({ok:true});}
  if(action==='test'){
   const claim=await db.ref(ROOT+'/private/testLimits/'+uid).transaction(old=>Date.now()-Number(old||0)<60000?undefined:Date.now());if(!claim.committed)throw Error('Aguarde um minuto antes de testar novamente.');
   const event={status:'test',at:Date.now(),inboxId:'test',team:'',tournamentName:'Teste Central FF'};await inbox(db,uid,event);const delivery=await deviceSend(db,uid,event);return res.json({ok:true,...delivery});
  }
  if(action==='configure'){
   admin();const id=C.text(b.tournamentId,100);if(!/^[a-z0-9-]{5,100}$/.test(id))throw Error('Identificador inválido.');
   const teams={};for(const row of (Array.isArray(b.teams)?b.teams:[]).slice(0,100)){const teamId=C.key(row.id);if(teamId&&row.name)teams[teamId]={name:C.text(row.name,100),aliases:[...new Set([row.name,row.id,...(Array.isArray(row.aliases)?row.aliases:[])].map(x=>C.text(x,100)))].slice(0,10)};}
   if(!b.name||!Object.keys(teams).length)throw Error('Defina nome e times do torneio.');
   const old=(await db.ref(ROOT+'/catalog/'+id).get()).val();
   // Only the known FFWS source can be marked official automatically.
   const officialStage=['final','segundaFase'].includes(b.officialStage)?b.officialStage:'';
   const value={name:C.text(b.name),enabled:b.enabled===true,teams,officialStage,updatedAt:Date.now()};
   if(old?.officialStage&&officialStage!==old.officialStage)throw Error('Crie outro torneio para trocar a etapa oficial.');
   await db.ref(ROOT+'/catalog/'+id).set(value);return res.json({ok:true,tournamentId:id});
  }
  if(action==='publish'){
   admin();const id=C.text(b.tournamentId,100),t=(await db.ref(ROOT+'/catalog/'+id).get()).val();if(!t?.enabled)throw Error('Marque este torneio para permitir avisos.');
   const day=C.integer(b.day,1,365),drop=C.integer(b.drop,1,999),row=C.result(b.result);if(!t.teams?.[row.teamId])throw Error('Time não cadastrado neste torneio.');row.team=t.teams[row.teamId].name;
   if(row.points<row.kills)throw Error('Os pontos não podem ser menores que os abates.');
   if(t.officialStage){const value=(await db.ref(`ffwsLive/2026-s2/${t.officialStage}/drops/${day}/${drop}`).get()).val();if(C.officialRows(value,t.teams).some(r=>r.teamId===row.teamId))throw Error('Esta queda já tem T1 + P1 oficial.');}
   const sent=await enqueue(db,id,t,day,drop,row,'partial');return res.json({ok:true,duplicate:!sent});
  }
  return res.status(400).json({error:'Ação inválida.'});
 }catch(e){return res.status(e.status||400).json({error:e.status===403?e.message:(e.code?.startsWith('auth/')?'Sessão expirada. Entre novamente.':e.message||'Não foi possível concluir.')});}
});
exports.campNotificationDeliver=onValueCreated({...opts,region:'us-central1',ref:'/campNotifications/private/events/{eventId}',instance:'central-free-fire-default-rtdb',retry:true,timeoutSeconds:540},async event=>{
 const db=getDatabase(),value=event.data.val(),t=(await db.ref(ROOT+'/catalog/'+value.tournamentId).get()).val();if(!t?.enabled)return;
 const subscribers=(await db.ref(ROOT+'/private/subscribers/'+value.tournamentId).get()).val()||{};
 // Batches avoid unbounded outbound requests and memory growth.
 const entries=Object.entries(subscribers).filter(([,p])=>C.interested(p,value));
 for(let n=0;n<entries.length;n+=10)await Promise.all(entries.slice(n,n+10).map(async([uid])=>{
  const mark=db.ref(ROOT+'/private/deliveries/'+event.params.eventId+'/'+uid),existing=(await mark.get()).val();if(existing?.done)return;
  // Inbox writes are idempotent and can be retried after a function interruption.
  await inbox(db,uid,value);const ref=db.ref(ROOT+'/inboxes/'+uid+'/'+value.inboxId);
  const latest=(await ref.get()).val();if(latest?.status!==value.status)return;
  const claim=await mark.transaction(old=>old?.pushClaimed?undefined:{...(old||{}),pushClaimed:true,at:Date.now()});
  if(claim.committed){const result=await deviceSend(db,uid,latest);await mark.update({...result,done:true});}
 }));
});
exports.campNotificationOfficial=onValueWritten({...opts,region:'us-central1',ref:'/ffwsLive/2026-s2/{stage}/drops/{day}/{drop}',instance:'central-free-fire-default-rtdb',retry:true},async event=>{
 if(!['final','segundaFase'].includes(event.params.stage)||!event.data.after.exists())return;
 const db=getDatabase(),value=event.data.after.val(),catalog=(await db.ref(ROOT+'/catalog').get()).val()||{};
 for(const [id,t] of Object.entries(catalog)){if(!t.enabled||t.officialStage!==event.params.stage)continue;for(const row of C.officialRows(value,t.teams)){
  // Official confirmation updates only results explicitly published by the admin.
  const partialId=C.eventId(id,event.params.day,event.params.drop,row.teamId,'partial');if(!(await db.ref(ROOT+'/private/events/'+partialId).get()).exists())continue;
  const created=await enqueue(db,id,t,Number(event.params.day),Number(event.params.drop),row,'official');
  if(!created){const subscribers=(await db.ref(ROOT+'/private/subscribers/'+id).get()).val()||{};const inboxId=C.eventId(id,event.params.day,event.params.drop,row.teamId,'result');for(const [uid,p]of Object.entries(subscribers))if(C.interested(p,row))await db.ref(ROOT+'/inboxes/'+uid+'/'+inboxId).transaction(old=>old?{...old,...row,status:'official',at:Date.now()}:undefined);}
 }}
});
