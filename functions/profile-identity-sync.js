'use strict';
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function syncVerifiedProfile(db,identity,verifySession){
 const uid=identity?.uid;if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw fail(401,'Entre na sua conta para sincronizar o perfil.');
 const [community,owner]=await Promise.all(['userAccounts/'+uid+'/community','communityOwnerInstagram'].map(path=>db.get(path)));
 let username='';
 if(owner?.uid===uid&&owner.username==='nakataff')username='nakataff';
 else if(community?.session){const status=await verifySession(community.session);if(status?.status==='verified')username=String(status.username||'').toLowerCase();}
 if(!/^[a-z0-9_.]{1,64}$/.test(username))return {ok:true,synced:false};
 const [profile,oldLink,roles,latestCommunity,latestOwner]=await Promise.all(['communityProfiles/'+uid,'communityInstagramLinks/'+uid,'communityAccountRoles/'+uid,'userAccounts/'+uid+'/community','communityOwnerInstagram'].map(path=>db.get(path)));
 if(owner?.uid===uid&&owner.username==='nakataff'){
  if(latestOwner?.uid!==uid||latestOwner.username!=='nakataff')return {ok:true,synced:false};
 }else if(latestCommunity?.session!==community?.session)return {ok:true,synced:false};
 if(!profile)return {ok:true,synced:false};
 const key=username.replace(/\./g,','),path='communityRankingProfiles/'+key;
 const entry=profile.public===true?{uid,username,avatarId:profile.avatarId||'default',administrator:roles?.administrator===true}:null;
 // Reserve the handle atomically so simultaneous requests cannot replace its owner.
 const claimed=await db.claimDirectory(path,uid,entry);
 if(!claimed)throw fail(409,'Este Instagram já está associado a outra conta.');
 const changes={['communityInstagramLinks/'+uid]:{username,key}};
 if(oldLink?.key&&oldLink.key!==key&&/^[a-z0-9_,]{1,64}$/.test(oldLink.key))await db.claimDirectory('communityRankingProfiles/'+oldLink.key,uid,null);
 await db.update(changes);
 return {ok:true,synced:true,username};
}
module.exports={syncVerifiedProfile};
