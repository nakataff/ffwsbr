'use strict';
const options=require('./admin-profile-options.json');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const fields=['name','motto','avatarId','coverId','avatarRingColor','theme','mainTeam','favoritePlayer','teamIdsJson'];
function target(identity,uid){
 if(identity.email!=='admin@centralfreefire.com.br'||identity.email_verified!==true)throw fail(403,'Somente o administrador pode editar perfis.');
 if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw fail(400,'Conta inválida.');return uid;
}
function visible(p){return Object.fromEntries([...fields,'featuredBadgesJson','public'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));}
async function readProfile(db,identity,uid){target(identity,uid);const p=(await db.ref('userAccounts/'+uid+'/profile').get()).val();if(!p)throw fail(404,'Perfil não encontrado.');return {profile:visible(p)};}
async function editProfile(db,identity,uid,raw){
 target(identity,uid);if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!fields.includes(k)))throw fail(400,'Campos de edição inválidos.');
 const p=(await db.ref('userAccounts/'+uid+'/profile').get()).val();if(!p)throw fail(404,'Perfil não encontrado.');
 const next={...p,...raw};for(const field of fields)if(typeof next[field]!=='string')next[field]=field==='teamIdsJson'?'[]':field==='avatarId'?'default':field==='theme'?'cyan':field==='avatarRingColor'?'#64D8FF':'';
 next.name=next.name.trim();next.motto=next.motto.trim();
 if(!next.name||next.name.length>80||next.motto.length>80)throw fail(400,'Nome e lema devem ter até 80 caracteres.');
 if(!/^#[0-9a-f]{6}$/i.test(next.avatarRingColor)||!['cyan','gold','pink','green','violet'].includes(next.theme))throw fail(400,'Cor ou tema inválido.');
 let teams;try{teams=JSON.parse(next.teamIdsJson);}catch{throw fail(400,'Times inválidos.');}
 if(!Array.isArray(teams)||teams.length>3||new Set(teams).size!==teams.length||teams.some(t=>!options.teams.includes(t)))throw fail(400,'Escolha até 3 times válidos.');
 if(next.mainTeam&&!teams.includes(next.mainTeam))throw fail(400,'O time principal deve estar nos favoritos.');
 if(next.favoritePlayer&&!options.players.includes(next.favoritePlayer))throw fail(400,'Jogador inválido.');
 const changes={};for(const [field,kind]of [['avatarId','avatar'],['coverId','cover']]){
  const id=next[field];if(id===p[field])continue;if(field==='avatarId'&&(id==='default'||options.teams.includes(id)||options.players.includes(id)))continue;
  if(field==='coverId'&&['','none'].includes(id))continue;
  if(!/^asset-\d{1,3}$/.test(id))throw fail(400,'Imagem inválida.');
  const item=(await db.ref('communityProfileCatalog/'+id).get()).val();if(!item?.enabled||item.kind!==kind)throw fail(400,'Escolha uma imagem ativa do catálogo.');
  if(item.accessRule==='admin'&&(await db.ref('communityAccountRoles/'+uid+'/administrator').get()).val()!==true)throw fail(400,'Esta imagem é exclusiva de perfis administradores.');
  if((item.accessRule||'all')!=='all'||item.unlockBadge){const owned=await db.ref('communityImageOwnership/'+uid+'/'+id).get();if(!owned.exists())changes['communityImageOwnership/'+uid+'/'+id]={source:'admin',grantedAt:Date.now()};}
 }
 next.teamIdsJson=JSON.stringify(teams);next.avatarRingColor=next.avatarRingColor.toUpperCase();
 for(const field of fields)changes['userAccounts/'+uid+'/profile/'+field]=next[field];
 changes['communityProfiles/'+uid]={...visible(next),featuredBadgesJson:next.featuredBadgesJson||'[]',public:next.public!==false};
 changes['communityMembers/'+uid+'/name']=next.name;
 const link=await db.ref('communityInstagramLinks/'+uid).get();
 const username=link.val()?.username,handle=typeof username==='string'?username.toLowerCase().replace(/\./g,','):'';
 if(handle&&/^[a-z0-9_,]{1,64}$/.test(handle)){const directory=await db.ref('communityRankingProfiles/'+handle).get();if(directory.val()?.uid===uid)changes['communityRankingProfiles/'+handle]=next.public===false?null:{...directory.val(),avatarId:next.avatarId};}
 changes['communityProfileAdminEdits/'+uid]={at:Date.now(),by:identity.uid,fields:Object.keys(raw)};
 await db.ref().update(changes);return {ok:true,profile:visible(next)};
}
module.exports={readProfile,editProfile};
