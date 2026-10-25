'use strict';
const {findRecipient}=require('./code-gifts');
const ADMIN='admin@centralfreefire.com.br',validId=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(v),validUid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v),fail=(status,text)=>Object.assign(Error(text),{status});
const VERIFIED=Object.freeze({title:'Verificado',description:'Pessoa reconhecida pela Central Free Fire por sua relevância na comunidade.',enabled:true,assetId:'',updatedAt:0});
function catalog(raw){const result={verified:{...VERIFIED}};for(const [id,item]of Object.entries(raw||{})){if(!validId(id)||!item)continue;result[id]={title:String(item.title||id).slice(0,50),description:String(item.description||'').slice(0,180),enabled:item.enabled===true,assetId:/^img-[a-f0-9-]{36}$/.test(item.assetId||'')?item.assetId:'',updatedAt:Number(item.updatedAt)||0};}return result;}
async function adminHandle(db,identity,request,now=Date.now()){
 if(!validUid(identity?.uid)||identity.email!==ADMIN)throw fail(403,'Somente o administrador pode gerenciar emblemas.');
 const operation=request?.operation;
 if(operation==='catalog')return {ok:true,catalog:catalog(await db.get('communityEmblemCatalog'))};
 if(operation==='findPerson'){
  const found=await findRecipient(db,identity,request.query),uid=found.recipient.uid;
  return {...found,assignment:await db.get('communityEmblemAssignments/'+uid),history:await db.query('communityEmblemHistory/'+uid,{orderBy:'$key',limitToLast:20})||{}};
 }
 if(operation==='saveCatalog'){
  const id=request.id;if(!validId(id))throw fail(400,'Use um identificador com letras minúsculas, números ou hífen.');
  const title=String(request.title||'').trim(),description=String(request.description||'').trim();
  if(!title||title.length>50||description.length>180||typeof request.enabled!=='boolean')throw fail(400,'Confira o nome, a descrição e a situação do emblema.');
  const old=await db.get('communityEmblemCatalog/'+id);if(!old&&id!=='verified'&&Object.keys(await db.get('communityEmblemCatalog')||{}).length>=50)throw fail(409,'O catálogo já possui 50 emblemas.');
  let assetId=request.removeImage?'':old?.assetId||'',image=request.image||'';
  if(image&&(!/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(image)||image.length>140000))throw fail(400,'Envie uma imagem WebP otimizada de até 100 KB.');
  if(image)assetId='img-'+crypto.randomUUID();
  const item={title,description,enabled:request.enabled,assetId,updatedAt:now};
  const changes={['communityEmblemCatalog/'+id]:item};if(image)changes['communityProfileImages/'+assetId]=image;
  await db.update(changes);return {ok:true,id,item};
 }
 if(operation!=='assign'||!validUid(request.targetUid))throw fail(400,'Operação inválida.');
 const uid=request.targetUid,profile=await db.get('userAccounts/'+uid+'/profile');
 if(!profile?.username||profile.username!==request.expectedUsername)throw fail(409,'Pesquise e confirme a pessoa novamente.');
 const id=request.emblemId||'';if(id&&!validId(id))throw fail(400,'Emblema inválido.');
 if(id){const item=catalog(id==='verified'?{verified:await db.get('communityEmblemCatalog/verified')||VERIFIED}:{[id]:await db.get('communityEmblemCatalog/'+id)})[id];if(!item?.enabled)throw fail(400,'Escolha um emblema ativo.');}
 const current=await db.get('communityEmblemAssignments/'+uid);
 if((current?.emblemId||'')===id)return {ok:true,unchanged:true,assignment:current};
 const assignment=id?{emblemId:id,grantedAt:now}:null,key=now+'-'+crypto.randomUUID();
 await db.update({['communityEmblemAssignments/'+uid]:assignment,['communityEmblemHistory/'+uid+'/'+key]:{from:current?.emblemId||'',to:id,at:now,by:identity.uid}});
 return {ok:true,assignment};
}
module.exports={adminHandle,catalog,VERIFIED};
