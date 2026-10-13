'use strict';
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
 const roles=await db.get('communityAccountRoles/'+identity.uid);return {uid:identity.uid,moderator:authorized(identity,roles),roles:roles||{}};
}
async function sendMessage(db,identity,raw,now=Date.now(),random=crypto.randomUUID().replace(/-/g,'').slice(0,16)){
 const text=messageText(raw),actor=await context(db,identity);
 const [privateProfile,profile,restriction,defaults]=await Promise.all(['userAccounts/'+actor.uid+'/profile','communityProfiles/'+actor.uid,'globalChat/restrictions/'+actor.uid,'communityProfileDefaults'].map(path=>db.get(path)));
 if(!privateProfile?.name||!/^[a-z0-9_]{3,24}$/.test(privateProfile.username||'')||!['masculino','feminino'].includes(privateProfile.gender))throw fail(403,'Complete seu cadastro em Minha conta para participar.');
 if(profile?.public!==true)throw fail(403,'Deixe seu perfil público em Minha conta para participar.');
 if(blocked.test(normalize(profile.name))||/[卐卍]/.test(String(profile.name||'')))throw fail(400,'Revise seu nome no perfil antes de participar do chat.');
 if(identity.email!==ADMIN)checkRestriction(restriction,now);
 const textKey=normalize(text);
 await db.transact('globalChat/limits/'+actor.uid,previous=>{
  if(Number(previous?.lastAt)>now-5000)throw fail(429,'Aguarde 5 segundos entre mensagens.');
  if(previous?.textKey===textKey&&Number(previous.lastAt)>now-60000)throw fail(429,'Essa mensagem já foi enviada. Aguarde antes de repetir.');
  return {lastAt:now,textKey};
 });
 if(identity.email!==ADMIN)checkRestriction(await db.get('globalChat/restrictions/'+actor.uid),now);
 if(!/^[a-f0-9]{16}$/.test(random))throw fail(500,'Não foi possível preparar a mensagem.');
 const id=String(now)+'-'+random,avatarId=profile.avatarId==='default'?defaults?.avatarId||'default':profile.avatarId||'default';
 const entry={uid:actor.uid,name:String(profile.name||'Membro da Central').slice(0,80),avatarId,roleId:actor.roles.roleId||'member',text,at:now};
 const recent=await db.recentChat(),keys=Object.keys(recent||{}).sort(),changes={['globalChat/messages/'+id]:entry};
 for(const old of keys.slice(0,Math.max(0,keys.length-99)))changes['globalChat/messages/'+old]=null;
 await db.update(changes);return {ok:true,id,at:now};
}
async function moderation(db,identity,request,now=Date.now()){
 const actor=await context(db,identity);if(!actor.moderator)throw fail(403,'Somente o administrador e moderadores podem realizar esta ação.');
 const action=request?.operation;
 if(action==='delete'){
  const id=String(request.messageId||'');if(!/^\d{13}-[a-f0-9]{16}$/.test(id))throw fail(400,'Mensagem inválida.');
  await db.update({['globalChat/messages/'+id]:null});return {ok:true};
 }
 const target=request?.targetUid;if(!validUid(target)||target===actor.uid)throw fail(400,'Escolha outra conta.');
 if(!['mute','block','release'].includes(action))throw fail(400,'Ação inválida.');
 const targetRoles=await db.get('communityAccountRoles/'+target);
 if(action!=='release'&&identity.email!==ADMIN&&(targetRoles?.roleId==='moderator'||targetRoles?.administrator===true))throw fail(403,'Somente o administrador pode restringir esta conta.');
 const profile=await db.get('communityProfiles/'+target);if(!profile)throw fail(404,'Perfil não encontrado.');
 const path='globalChat/restrictions/'+target;
 if(action==='release')await db.update({[path]:null});
 else await db.transact(path,old=>({blocked:action==='block'||old?.blocked===true,mutedUntil:action==='mute'?Math.max(Number(old?.mutedUntil)||0,now+10*60*1000):Number(old?.mutedUntil)||0,name:String(profile.name||'Membro').slice(0,80),reason:String(request.reason||'').trim().slice(0,160),by:actor.uid,at:now}));
 return {ok:true};
}
module.exports={messageText,sendMessage,moderation,context,checkRestriction};
