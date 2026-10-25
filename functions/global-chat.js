'use strict';
const {findRecipient}=require('./code-gifts');
const ADMIN='admin@centralfreefire.com.br';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const validUid=uid=>typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[@4]/g,'a').replace(/3/g,'e').replace(/[1!]/g,'i').replace(/0/g,'o').replace(/[$5]/g,'s').replace(/7/g,'t').replace(/[_\-.]+/g,' ').replace(/\s+/g,' ').trim();
const blocked=/\b(fdp|vtnc|vsf|filh[oa]\s*da\s*puta|(?:vai\s*)?tomar\s*no\s*cu|porra|caralho|buceta|merda|arrombad[oa]|retardad[oa]|mongoloide|viado|viadinho|bicha|nazi|nazista|nazismo|neonazi|hitler|sieg\s*heil|heil\s*hitler|white\s*power|supremacia\s*branca)\b/i;
function messageText(value){
 if(typeof value!=='string')throw fail(400,'Escreva uma mensagem.');
 const text=value.normalize('NFC').replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g,'').trim();
 if(!text||text.length>500)throw fail(400,'Use de 1 a 500 caracteres.');
 const normalized=normalize(text);
 if(blocked.test(normalized)||/[卐卍]/.test(text)||/\b1488\b/.test(text))throw fail(400,'Revise a mensagem: ela contém linguagem não permitida.');
 if(/(.)\1{19,}/u.test(normalized)||text.split('\n').length>5||(text.match(/https?:\/\/|www\./gi)||[]).length>2)throw fail(400,'Evite repetições, excesso de linhas ou links.');
 return text;
}
function authorized(identity,roles){return identity.email===ADMIN||roles?.roleId==='moderator';}
function checkRestriction(restriction,now){if(restriction?.blocked===true)throw fail(403,'Seu acesso ao envio de mensagens foi bloqueado.');if(Number(restriction?.mutedUntil)>now)throw fail(403,'Você está silenciado até '+new Date(restriction.mutedUntil).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})+'.');}
async function context(db,identity){
 if(!validUid(identity?.uid))throw fail(401,'Entre com Google para participar.');
 const roles=await db.get('communityAccountRoles/'+identity.uid),aliases={administrador:'administrator',administrator:'administrator',moderador:'moderator',moderator:'moderator',influenciador:'influencer',apoiador:'supporter',membro:'member'};
 const roleId=roles?.roleId||(roles?.administrator===true?'administrator':aliases[String(roles?.title||'').trim().toLowerCase()]||'member');
 return {uid:identity.uid,administrator:identity.email===ADMIN,moderator:authorized(identity,roles),roles:{...(roles||{}),roleId,...(identity.email===ADMIN?{roleId:'administrator',administrator:true}:{})}};
}
async function sendMessage(db,identity,raw,now=Date.now(),random=crypto.randomUUID().replace(/-/g,'').slice(0,16)){
 const request=typeof raw==='string'?{text:raw}:raw||{},text=messageText(request.text),actor=await context(db,identity);
 const config=settings(await db.get('globalChat/settings'));
 const [privateProfile,profile,restriction,defaults]=await Promise.all(['userAccounts/'+actor.uid+'/profile','communityProfiles/'+actor.uid,'globalChat/restrictions/'+actor.uid,'communityProfileDefaults'].map(path=>db.get(path)));
 if(!privateProfile?.name||!/^[a-z0-9_]{3,24}$/.test(privateProfile.username||'')||!['masculino','feminino'].includes(privateProfile.gender))throw fail(403,'Complete seu cadastro em Minha conta para participar.');
 if(profile?.public!==true)throw fail(403,'Deixe seu perfil público em Minha conta para participar.');
 if(blocked.test(normalize(profile.name))||/[卐卍]/.test(String(profile.name||'')))throw fail(400,'Revise seu nome no perfil antes de participar do chat.');
 if(identity.email!==ADMIN)checkRestriction(restriction,now);
 const textKey=normalize(text);
 await db.transact('globalChat/limits/'+actor.uid,previous=>{
  const seconds=actor.moderator?5:config.slowSeconds;
  if(Number(previous?.lastAt)>now-seconds*1000)throw fail(429,'Aguarde '+seconds+' segundos entre mensagens.');
  if(previous?.textKey===textKey&&Number(previous.lastAt)>now-60000)throw fail(429,'Essa mensagem já foi enviada. Aguarde antes de repetir.');
  return {lastAt:now,textKey};
 });
 if(!/^[a-f0-9]{16}$/.test(random))throw fail(500,'Não foi possível preparar a mensagem.');
 const id=String(now)+'-'+random,avatarId=profile.avatarId==='default'?defaults?.avatarId||'default':profile.avatarId||'default';
 const author=await publicIdentity(db,actor,profile);
 const entry={uid:actor.uid,name:String(profile.name||'Membro da Central').slice(0,80),avatarId,roleId:actor.roles.roleId||'member',text,at:now,username:String(profile.username||privateProfile.username||''),badgeIds:author.badgeIds,nameColor:author.nameColor};
 if(request.replyTo){const original=await db.get('globalChat/messages/'+messageId(request.replyTo));if(!original)throw fail(409,'A mensagem respondida já saiu do histórico.');entry.reply={id:request.replyTo,uid:original.uid,name:String(original.name||'Membro').slice(0,80),text:String(original.text||'').slice(0,140)};}
 const handles=[...new Set([...text.matchAll(/(?:^|\s)@([a-z0-9_]{3,24})\b/gi)].map(m=>m[1].toLowerCase()))];
 if(handles.length>5)throw fail(400,'Marque até 5 pessoas por mensagem.');
 const mentions=await Promise.all(handles.map(async username=>{const uid=await db.get('communityUsernames/'+username);return validUid(uid)?{uid,username}:null;}));
 if(mentions.some(Boolean))entry.mentions=mentions.filter(Boolean);
 const recent=await db.recentChat(),keys=Object.keys(recent||{}).sort(),changes={['globalChat/identities/'+actor.uid]:author,['globalChat/messages/'+id]:entry,['globalChat/latest']:{id,at:now}};
 for(const old of keys.slice(0,Math.max(0,keys.length-99)))changes['globalChat/messages/'+old]=null;
 if(identity.email!==ADMIN)checkRestriction(await db.get('globalChat/restrictions/'+actor.uid),now);
 await db.update(changes);return {ok:true,id,at:now,cooldownSeconds:actor.moderator?5:config.slowSeconds};
}
const MESSAGE_ID=/^\d{13}-[a-f0-9]{16}$/;
function messageId(value){if(typeof value!=='string'||!MESSAGE_ID.test(value))throw fail(400,'Mensagem inválida.');return value;}
const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const hex=value=>typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value);
function luminance(color){const values=color.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;}
function nameColor(value){if(!value)return '';if(!hex(value)||luminance(value)<.18)throw fail(400,'Escolha uma cor de nome clara para manter a leitura.');return value;}
function settings(raw={}){return {accent:hex(raw?.accent)?raw.accent:'#6bd4ff',background:hex(raw?.background)?raw.background:'#0c1422',bubble:hex(raw?.bubble)?raw.bubble:'#142035',slowSeconds:[5,10,15,30,60,120].includes(raw?.slowSeconds)?raw.slowSeconds:5};}
async function selectedBadges(db,uid,ids,strict=false){
 if(!Array.isArray(ids)||ids.length>2||ids.some(id=>!safeId(id))) {if(strict)throw fail(400,'Escolha até duas insígnias.');return [];}
 const unique=[...new Set(ids)];
 const allowed=await Promise.all(unique.map(async id=>{const [owned,item]=await Promise.all([db.get('communityBadgeOwnership/'+uid+'/'+id),db.get('communityProfileCatalog/'+id)]);return owned===true&&item?.enabled===true&&item.kind==='badge'?id:null;}));
 if(strict&&allowed.some(id=>!id))throw fail(403,'Você só pode usar insígnias ativas que já conquistou.');return allowed.filter(Boolean);
}
async function publicIdentity(db,actor,profile){
 const [preference,style]=await Promise.all([db.get('globalChat/preferences/'+actor.uid),db.get('globalChat/styles/'+actor.uid)]);
 const badges=await selectedBadges(db,actor.uid,preference?.badgeIds||[]);
 let color='';try{color=nameColor(style?.nameColor||(style?.allowNameColor||actor.roles.administrator?preference?.nameColor:''));}catch{}
 return {name:String(profile?.name||'Membro').slice(0,80),username:String(profile?.username||''),avatarId:String(profile?.avatarId||'default'),roleId:actor.administrator?'administrator':actor.roles.roleId||'member',realAdministrator:actor.administrator===true,badgeIds:badges,nameColor:color};
}
async function chatStatus(db,identity){
 const actor=await context(db,identity),profile=await db.get('communityProfiles/'+actor.uid),author=await publicIdentity(db,actor,profile);
 if(profile?.public===true)await db.update({['globalChat/identities/'+actor.uid]:author});
 const [preference,style,owned]=await Promise.all([db.get('globalChat/preferences/'+actor.uid),db.get('globalChat/styles/'+actor.uid),db.get('communityBadgeOwnership/'+actor.uid)]);
 return {ok:true,moderator:actor.moderator,administrator:identity.email===ADMIN,identity:author,preference:preference||{},allowNameColor:identity.email===ADMIN||style?.allowNameColor===true,ownedBadges:Object.keys(owned||{}).filter(id=>owned[id]===true&&safeId(id))};
}
async function preferences(db,identity,request){
 const actor=await context(db,identity),badges=await selectedBadges(db,actor.uid,request.badgeIds,true),style=await db.get('globalChat/styles/'+actor.uid);
 const color=nameColor(request.nameColor||'');if(color&&identity.email!==ADMIN&&!style?.allowNameColor)throw fail(403,'A personalização da cor ainda não foi liberada para esta conta.');
 await db.update({['globalChat/preferences/'+actor.uid]:{badgeIds:badges,nameColor:color}});return chatStatus(db,identity);
}
function auditRecord(actor,operation,request,now){return {by:actor.uid,operation,at:now,targetUid:request.targetUid||'',messageId:request.messageId||'',name:String(request.name||'').slice(0,80),reason:String(request.reason||'').trim().slice(0,160),minutes:operation==='mute'?Number(request.minutes||10):0};}
async function audit(db,actor,operation,request,now){const id=now+'-'+crypto.randomUUID().replace(/-/g,'').slice(0,16);await db.update({['globalChat/audit/'+id]:auditRecord(actor,operation,request,now)});}
async function moderation(db,identity,request,now=Date.now()){
 const actor=await context(db,identity);if(!actor.moderator)throw fail(403,'Somente o administrador e moderadores podem realizar esta ação.');
 const action=request?.operation;
 if(action==='unpin'){await db.update({'globalChat/pinned':null});await audit(db,actor,action,request,now);return {ok:true};}
 if(action==='pinText'){
  const text=messageText(request.text);await db.update({'globalChat/pinned':{text,name:'Aviso da moderação',by:actor.uid,at:now}});await audit(db,actor,action,request,now);return {ok:true};
 }
 if(action==='delete'||action==='pin'){
  const id=messageId(request.messageId),message=await db.get('globalChat/messages/'+id);
  if(action==='pin'){if(!message)throw fail(404,'Mensagem não encontrada.');await db.update({'globalChat/pinned':{messageId:id,text:message.text,name:message.name,by:actor.uid,at:now}});}
  else{const [recent,pinned]=await Promise.all([db.recentChat(),db.get('globalChat/pinned')]);const changes={['globalChat/messages/'+id]:null};if(pinned?.messageId===id)changes['globalChat/pinned']=null;
   for(const [key,row]of Object.entries(recent||{}))if(row?.reply?.id===id)changes['globalChat/messages/'+key+'/reply/text']='Mensagem removida pela moderação.';
   await db.update(changes);
  }
  await audit(db,actor,action,{...request,name:message?.name||''},now);return {ok:true};
 }
 if(action==='dismissReport'){
  const id=String(request.reportId||'');if(!/^[0-9]{13}-[a-f0-9]{16}_[A-Za-z0-9_-]{1,128}$/.test(id))throw fail(400,'Denúncia inválida.');
  const old=await db.get('globalChat/reports/'+id);if(!old)throw fail(404,'Denúncia não encontrada.');await db.transact('globalChat/reports/'+id,current=>{if(!current)throw fail(404,'Denúncia não encontrada.');return {...current,status:'reviewed',reviewedBy:actor.uid,reviewedAt:now};});await audit(db,actor,action,request,now);return {ok:true};
 }
 const target=request?.targetUid;if(!validUid(target)||target===actor.uid)throw fail(400,'Escolha outra conta.');
 if(!['mute','block','release'].includes(action))throw fail(400,'Ação inválida.');
 const targetRoles=await db.get('communityAccountRoles/'+target),targetIdentity=await db.get('globalChat/identities/'+target);
 if(action!=='release'&&(targetIdentity?.roleId==='administrator'||identity.email!==ADMIN&&(targetRoles?.roleId==='moderator'||targetRoles?.administrator===true)))throw fail(403,'Esta conta não pode ser restringida por você.');
 const profile=await db.get('communityProfiles/'+target);if(!profile)throw fail(404,'Perfil não encontrado.');
 const path='globalChat/restrictions/'+target,minutes=Number(request.minutes||10);
 if(action==='mute'&&![1,5,10,30,60,1440].includes(minutes))throw fail(400,'Escolha um tempo de silêncio válido.');
 if(action==='release')await db.update({[path]:null});
 else await db.transact(path,old=>({blocked:action==='block'||old?.blocked===true,mutedUntil:action==='mute'?Math.max(Number(old?.mutedUntil)||0,now+minutes*60000):Number(old?.mutedUntil)||0,name:String(profile.name||'Membro').slice(0,80),reason:String(request.reason||'').trim().slice(0,160),by:actor.uid,at:now}));
 await audit(db,actor,action,{...request,name:profile.name},now);return {ok:true};
}
async function report(db,identity,request,now=Date.now()){
 const actor=await context(db,identity),id=messageId(request.messageId),message=await db.get('globalChat/messages/'+id);
 if(!message)throw fail(404,'Essa mensagem não está mais disponível.');if(message.uid===actor.uid)throw fail(400,'Escolha uma mensagem de outra pessoa.');
 const reason=String(request.reason||'').trim();if(!reason||reason.length>160)throw fail(400,'Informe um motivo com até 160 caracteres.');
 const reportId=id+'_'+actor.uid;if(await db.get('globalChat/reports/'+reportId))return {ok:true,alreadyReported:true};
 await db.transact('globalChat/reportLimits/'+actor.uid,old=>{if(Number(old?.at)>now-30000)throw fail(429,'Aguarde 30 segundos antes de outra denúncia.');return {at:now};});
 await db.transact('globalChat/reports/'+reportId,old=>old||{messageId:id,targetUid:message.uid,name:message.name,text:message.text,reason,by:actor.uid,at:now,status:'pending'});return {ok:true};
}
async function moderationData(db,identity,request={}){
 const actor=await context(db,identity);if(!actor.moderator)throw fail(403,'Acesso restrito à moderação.');
 const type=request.view||'reports';if(!['reports','audit','restrictions'].includes(type))throw fail(400,'Seção inválida.');
 const params=type==='reports'&&!request.all?{orderBy:'status',equalTo:'pending',limitToLast:50}:{orderBy:type==='restrictions'?'at':'$key',limitToLast:50};
 const rows=await db.query('globalChat/'+type,params);return {ok:true,rows:rows||{},limit:50};
}
async function adminChat(db,identity,request,now=Date.now()){
 const actor=await context(db,identity);if(identity.email!==ADMIN)throw fail(403,'Somente o administrador pode configurar o chat.');
 const operation=request.operation;
 if(operation==='settings'){
  for(const key of ['accent','background','bubble'])if(!hex(request[key]))throw fail(400,'Escolha cores válidas.');
  if(luminance(request.background)>.16||luminance(request.bubble)>.16||luminance(request.accent)<.18)throw fail(400,'Use fundos escuros e uma cor principal clara para manter a leitura.');
  if(![5,10,15,30,60,120].includes(Number(request.slowSeconds)))throw fail(400,'Escolha um intervalo válido.');
  const value=settings({...request,slowSeconds:Number(request.slowSeconds)});await db.update({'globalChat/settings':value});await audit(db,actor,operation,{},now);return {ok:true,settings:value};
 }
 if(operation==='findPerson'){const found=await findRecipient(db,identity,request.query);const uid=found.recipient.uid;return {...found,roles:await db.get('communityAccountRoles/'+uid)||{},style:await db.get('globalChat/styles/'+uid)||{}};}
 if(operation==='moderators'){
  const roles=await db.query('communityAccountRoles',{orderBy:'roleId',equalTo:'moderator',limitToFirst:100}),rows={};
  await Promise.all(Object.keys(roles||{}).map(async uid=>{const p=await db.get('communityProfiles/'+uid);rows[uid]={name:p?.name||'Pessoa cadastrada',username:p?.username||''};}));return {ok:true,rows};
 }
 if(!['moderator','style'].includes(operation)||!validUid(request.targetUid))throw fail(400,'Operação inválida.');
 const target=request.targetUid,profile=await db.get('userAccounts/'+target+'/profile');if(!profile||profile.username!==request.expectedUsername)throw fail(409,'Pesquise e confirme a pessoa novamente.');
 if(target===identity.uid&&operation==='moderator')throw fail(400,'Sua conta já é administradora.');
 if(operation==='style')await db.update({['globalChat/styles/'+target]:{nameColor:nameColor(request.nameColor||''),allowNameColor:request.allowNameColor===true}});
 else {
  const previous=await db.get('communityAccountRoles/'+target)||{},saved=await db.get('globalChat/moderators/'+target);
  if(request.enabled!==true&&request.enabled!==false)throw fail(400,'Escolha adicionar ou remover o moderador.');
  if(request.enabled){await db.update({['globalChat/moderators/'+target]:{previousRole:saved?.previousRole||previous.roleId||'member',name:profile.name,username:profile.username,at:now},['communityAccountRoles/'+target]:{...previous,roleId:'moderator',title:'Moderador',administrator:false,updatedAt:now}});}
  else if(previous.roleId==='moderator'){const roleId=saved?.previousRole&&saved.previousRole!=='moderator'?saved.previousRole:'member';await db.update({['globalChat/moderators/'+target]:null,['communityAccountRoles/'+target]:{...previous,roleId,administrator:roleId==='administrator',title:'',updatedAt:now}});}
 }
 const roles=await db.get('communityAccountRoles/'+target)||{},publicProfile=await db.get('communityProfiles/'+target);
 if(publicProfile?.public===true){const previousIdentity=await db.get('globalChat/identities/'+target);await db.update({['globalChat/identities/'+target]:await publicIdentity(db,{uid:target,administrator:target===identity.uid||previousIdentity?.realAdministrator===true,roles},publicProfile)});}
 await audit(db,actor,operation,{targetUid:target,name:profile.name},now);return {ok:true};
}
module.exports={messageText,sendMessage,moderation,context,checkRestriction,settings,chatStatus,preferences,report,moderationData,adminChat};
