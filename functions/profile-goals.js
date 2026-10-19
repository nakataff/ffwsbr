'use strict';
const METRICS=new Set(['total_points','week_wins','month_wins','prediction_wins','prediction_votes','prediction_combo','active_days','comments','stories','checkins']);
const KINDS=new Set(['badge','frame','avatar','cover']);
async function claimProfileGoals(db,identity,loadMetrics,now=Date.now(),notify=()=>{}){
 const uid=identity?.uid;if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Object.assign(Error('Entre novamente na sua conta.'),{status:401});
 const [link,goals,catalog,owned,badges,grants]=await Promise.all(['communityInstagramLinks/'+uid,'communityBadgeGoals','communityProfileCatalog','communityImageOwnership/'+uid,'communityBadgeOwnership/'+uid,'communityBadgeGrants/'+uid].map(path=>db.get(path)));
 const username=String(link?.username||'').toLowerCase();if(!/^[a-z0-9_.]{1,64}$/.test(username))return {ok:true,unlocked:[]};
 const achieved=await loadMetrics(username);if(achieved?.ok&&achieved.found===false)return {ok:true,unlocked:[]};if(!achieved?.ok||String(achieved.username||'').toLowerCase()!==username||!achieved.metrics)throw Object.assign(Error('Não foi possível confirmar os objetivos agora.'),{status:503});
 const changes={},unlocked=[],seen=new Set();
 for(const [goalId,goal]of Object.entries(goals||{})){
  const assetId=String(goal?.assetId||goal?.badgeId||''),item=catalog?.[assetId],target=Number(goal?.target),value=Number(achieved.metrics[goal?.metric]);
  if(!/^goal-[a-z0-9-]{1,60}$/.test(goalId)||!goal?.enabled||!item?.enabled||!KINDS.has(item.kind)||item.accessRule==='admin'||!METRICS.has(goal.metric)||!Number.isFinite(target)||target<1||!Number.isFinite(value)||value<target||seen.has(assetId))continue;
  seen.add(assetId);
  if(item.kind==='badge'){
   if(badges?.[assetId]||Object.values(grants||{}).some(g=>g?.badgeId===assetId&&g.status==='active'))continue;
   const grantId='grant-'+goalId;
   changes['communityBadgeOwnership/'+uid+'/'+assetId]=true;
   changes['communityBadgeGrants/'+uid+'/'+grantId]={badgeId:assetId,reason:String(goal.label||'Objetivo alcançado').slice(0,160),week:'',grantedAt:now,status:'active'};
  }else{
   if(owned?.[assetId])continue;
   changes['communityImageOwnership/'+uid+'/'+assetId]={source:'goal',grantedAt:now};
  }
  unlocked.push({assetId,kind:item.kind,title:item.title});
 }
 if(unlocked.length)await db.update(changes);
 for(const item of unlocked)notify({id:'goal:'+uid+':'+item.assetId,uid,title:'Nova conquista desbloqueada!',body:item.title,url:'/conta.html?tab=inventory',button:'Ver conquista',at:now});
 return {ok:true,unlocked};
}
module.exports={claimProfileGoals};
