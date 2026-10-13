// Only call with an Instagram handle verified by the account's trusted session.
export async function syncProfileDirectory({uid,username,profile,roles={},oldLink={},read,write}){
 username=String(username||'').toLowerCase();
 if(!/^[a-z0-9_.]{1,64}$/.test(username))throw Error('Confirme o Instagram pelo código antes de publicar.');
 if(!profile)return false;
 const key=username.replace(/\./g,','),current=await read('communityRankingProfiles/'+key);
 if(current?.uid&&current.uid!==uid)throw Error('Este Instagram já está associado a outra conta. Confira o vínculo antes de continuar.');
 const changes={['communityRankingProfiles/'+key]:profile.public===false?null:{uid,username,avatarId:profile.avatarId||'default',administrator:roles.administrator===true}};
 if(oldLink.key&&oldLink.key!==key&&/^[a-z0-9_,]{1,64}$/.test(oldLink.key)){
  const previous=await read('communityRankingProfiles/'+oldLink.key);
  if(previous?.uid===uid)changes['communityRankingProfiles/'+oldLink.key]=null;
 }
 // Directory rules validate against the already stored Instagram link.
 await write({['communityInstagramLinks/'+uid]:{username,key}});
 await write(changes);return true;
}
