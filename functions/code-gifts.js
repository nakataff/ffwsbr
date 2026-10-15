'use strict';
const ADMIN='admin@centralfreefire.com.br';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const validUid=uid=>typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);
function requireAdmin(identity){if(!validUid(identity?.uid)||identity.email!==ADMIN)throw fail(403,'Somente o administrador pode enviar codiguinhos.');}
async function recipient(db,uid){
 if(!validUid(uid))throw fail(400,'Conta inválida.');
 const [profile,link,slug]=await Promise.all(['userAccounts/'+uid+'/profile','communityInstagramLinks/'+uid,'communityProfileSlugByUid/'+uid].map(path=>db.get(path)));
 if(!profile?.name||!/^[a-z0-9_]{3,24}$/.test(profile.username||'')||!['masculino','feminino'].includes(profile.gender))throw fail(404,'Esta conta ainda não concluiu o cadastro.');
 return {uid,name:String(profile.name).slice(0,80),username:profile.username,avatarId:profile.avatarId||'default',instagram:link?.username||'',path:/^user\d{6,10}$/.test(slug||'')?'/perfil/'+slug:'/conta.html?u='+encodeURIComponent(uid)};
}
async function findRecipient(db,identity,query){
 requireAdmin(identity);let value=String(query||'').trim();if(!value||value.length>400)throw fail(400,'Informe o nome de usuário, Instagram ou link do perfil.');
 if(/^https?:\/\//i.test(value)||value.startsWith('/')){let url;try{url=new URL(value,'https://centralfreefire.com.br');}catch{throw fail(400,'Link inválido.');}if(!['centralfreefire.com.br','www.centralfreefire.com.br'].includes(url.hostname))throw fail(400,'Use um link de perfil da Central.');if(url.searchParams.get('u'))return {ok:true,recipient:await recipient(db,url.searchParams.get('u'))};value=url.searchParams.get('slug')||(url.searchParams.get('ig')?'@'+url.searchParams.get('ig'):'')||decodeURIComponent(url.pathname.replace(/^\/perfil\//,'').replace(/\/$/,''));}
 let uid;if(/^user\d{6,10}$/.test(value))uid=await db.get('communityProfileSlugs/'+value);
 else{const name=value.replace(/^@/,'').toLowerCase();let central=null,instagram=null;if(/^[a-z0-9_.]{1,64}$/.test(name)){[central,instagram]=await Promise.all([/^[a-z0-9_]{3,24}$/.test(name)?db.get('communityUsernames/'+name):null,db.get('communityRankingProfiles/'+name.replace(/\./g,','))]);}if(central&&instagram?.uid&&central!==instagram.uid)throw fail(409,'Este nome corresponde a duas contas. Use o link com o código user... para escolher a pessoa.');uid=central||instagram?.uid||(validUid(value)&&!value.startsWith('@')?value:'');}
 if(!validUid(uid))throw fail(404,'Conta não encontrada. Confira o nome de usuário.');return {ok:true,recipient:await recipient(db,uid)};
}
async function sendCodeGift(db,identity,raw,now=Date.now()){
 requireAdmin(identity);const target=await recipient(db,raw?.targetUid);
 if(raw.expectedUsername!==target.username)throw fail(409,'O destinatário mudou. Pesquise e confirme a conta novamente.');
 const code=String(raw.code||'').trim().toUpperCase();if(!/^[A-Z0-9-]{5,64}$/.test(code))throw fail(400,'Informe um codiguinho válido, com 5 a 64 letras ou números.');
 const title=String(raw.title||'').trim();if(!title||title.length>100)throw fail(400,'Informe qual é o codiguinho, com até 100 caracteres.');
 const message=String(raw.message||'').trim();if(message.length>160)throw fail(400,'Use uma mensagem de até 160 caracteres.');
 const expiresAt=Number(raw.expiresAt)||0;if(expiresAt&&(!Number.isFinite(expiresAt)||expiresAt<=now))throw fail(400,'Este codiguinho já expirou.');
 const requestId=String(raw.requestId||'');if(!/^[a-f0-9-]{36}$/.test(requestId))throw fail(400,'Reabra o formulário para preparar o envio.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code)),hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const assignment=await db.transact('communityCodeGiftAssignments/'+hash,old=>{
  if(old){if(old.uid!==target.uid)throw fail(409,'Este codiguinho já foi destinado a outra conta.');return old;}
  return {uid:target.uid,giftId:'codegift-'+requestId,title,message,expiresAt,sentAt:now,senderUid:identity.uid,recipientUsername:target.username,recipientName:target.name};
 });
 const path='communityCodeGifts/'+assignment.uid+'/'+assignment.giftId;
 const gift=await db.transact(path,old=>old||{kind:'code',title:assignment.title,code,message:assignment.message,expiresAt:assignment.expiresAt,sentAt:assignment.sentAt,senderUid:assignment.senderUid,recipientUsername:assignment.recipientUsername,recipientName:assignment.recipientName,openedAt:0});
 return {ok:true,giftId:assignment.giftId,recipient:target,gift};
}
// Admin-only reconciliation by hashes; neither codes nor the assignment index are exposed.
async function giftStatus(db,identity,hashes){
 requireAdmin(identity);
 if(!Array.isArray(hashes)||hashes.length>20||hashes.some(hash=>typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)))throw fail(400,'Informe até 20 identificadores válidos.');
 const unique=[...new Set(hashes)],gifts=[];
 for(let i=0;i<unique.length;i+=12){
  const entries=await Promise.all(unique.slice(i,i+12).map(async hash=>{
   const assigned=await db.get('communityCodeGiftAssignments/'+hash);
   if(assigned?.uid==='economy-stock'&&assigned.returnedGiftId)return {hash,returned:true,giftId:assigned.returnedGiftId,sentAt:assigned.returnedAt,bucket:assigned.bucket};
   if(!assigned||!validUid(assigned.uid)||!/^codegift-[a-f0-9-]{36}$/.test(assigned.giftId||''))return null;
   const gift=await db.get('communityCodeGifts/'+assigned.uid+'/'+assigned.giftId);
   return {hash,uid:assigned.uid,giftId:assigned.giftId,username:String(assigned.recipientUsername||''),name:String(assigned.recipientName||''),sentAt:Number(gift?.sentAt||assigned.sentAt||0),openedAt:Number(gift?.openedAt||0),pending:!gift};
  }));
  gifts.push(...entries.filter(Boolean));
 }
 return {ok:true,gifts};
}
async function openCodeGift(db,identity,giftId,now=Date.now()){
 if(!validUid(identity?.uid))throw fail(401,'Entre na sua conta para abrir o presente.');
 if(!/^codegift-[a-f0-9-]{36}$/.test(giftId||''))throw fail(400,'Presente inválido.');
 const path='communityCodeGifts/'+identity.uid+'/'+giftId;
 const gift=await db.transact(path,old=>{if(!old)throw fail(404,'Presente não encontrado no seu inventário.');if(old.returnedAt)throw fail(410,'Este codiguinho foi devolvido ao estoque pelo administrador.');return old.openedAt?old:{...old,openedAt:now};});
 return {ok:true,gift};
}
// Personal organization only: no stock, receipt, grant or wallet changes.
async function archiveGift(db,identity,raw,now=Date.now()){
 if(!validUid(identity?.uid))throw fail(401,'Entre na sua conta para organizar os presentes.');
 const kind=raw?.kind,id=raw?.giftId;
 if(!['code','profile'].includes(kind)||typeof raw.archived!=='boolean'||typeof id!=='string'||!(/^[A-Za-z0-9_-]{1,128}$/).test(id)||kind==='code'&&!/^codegift-[a-f0-9-]{36}$/.test(id))throw fail(400,'Presente inválido.');
 const path=(kind==='code'?'communityCodeGifts/':'communityGifts/')+identity.uid+'/'+id;
 const gift=await db.transact(path,old=>{
  if(!old)throw fail(404,'Presente não encontrado no seu inventário.');
  if(raw.archived&&kind==='code'&&!old.openedAt&&!old.returnedAt)throw fail(409,'Abra o presente antes de arquivar.');
  return {...old,archivedAt:raw.archived?(old.archivedAt||now):0};
 });
 return {ok:true,giftId:id,kind,archivedAt:gift.archivedAt};
}
module.exports={findRecipient,sendCodeGift,openCodeGift,giftStatus,archiveGift};
