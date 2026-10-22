'use strict';
const QUIZ=require('./quiz-progress');
const METRICS=new Set([...QUIZ.METRICS,'total_points','week_wins','month_wins','prediction_wins','prediction_votes','prediction_combo','active_days','comments','stories','checkins']);
const KINDS=new Set(['badge','frame','avatar','cover']);
async function claimProfileGoals(db,identity,loadMetrics,now=Date.now(),notify=()=>{},loadQuizMetrics=()=>({}),{quizOnly=false}={}){
 const uid=identity?.uid;if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Object.assign(Error('Entre novamente na sua conta.'),{status:401});
 const [goals,catalog]=await Promise.all(['communityBadgeGoals','communityProfileCatalog'].map(path=>db.get(path)));
 const quiz=await loadQuizMetrics(),quizMetrics=Object.fromEntries(QUIZ.METRICS.map(key=>[key,Math.max(0,Math.floor(Number(quiz?.[key])||0))])),metrics={...quizMetrics};
 const enabled=Object.entries(goals||{}).filter(([,g])=>g?.enabled&&catalog?.[g.assetId||g.badgeId]?.enabled);
 const legacyNeeded=!quizOnly&&enabled.some(([,g])=>!QUIZ.METRICS.includes(g.metric));
 if(legacyNeeded){
  const link=await db.get('communityInstagramLinks/'+uid),username=String(link?.username||'').toLowerCase();
  if(/^[a-z0-9_.]{1,64}$/.test(username)){
   const achieved=await loadMetrics(username);
   if(!(achieved?.ok&&achieved.found===false)){
    if(!achieved?.ok||String(achieved.username||'').toLowerCase()!==username||!achieved.metrics)throw Object.assign(Error('Não foi possível confirmar os objetivos agora.'),{status:503});
    // Quiz counters come exclusively from the authenticated server-side UID.
    for(const key of METRICS)if(!QUIZ.METRICS.includes(key))metrics[key]=achieved.metrics[key];
   }
  }
 }
 const candidates=enabled.filter(([,g])=>(!quizOnly||QUIZ.METRICS.includes(g.metric))&&Number(metrics[g.metric])>=Number(g.target));
 if(!candidates.length)return {ok:true,unlocked:[],metrics:quizMetrics};
 const [owned,badges,grants]=await Promise.all(['communityImageOwnership/'+uid,'communityBadgeOwnership/'+uid,'communityBadgeGrants/'+uid].map(path=>db.get(path)));
 const changes={},unlocked=[],seen=new Set();
 for(const [goalId,goal]of candidates){
  const assetId=String(goal?.assetId||goal?.badgeId||''),item=catalog?.[assetId],target=Number(goal?.target),value=Number(metrics[goal?.metric]);
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
 for(const item of unlocked)notify({id:'goal:'+uid+':'+item.assetId,uid,title:'Nova conquista desbloqueada!',body:item.title,url:'/conta.html?tab=inventory&section='+({badge:'badges',frame:'frames',avatar:'avatars',cover:'covers'}[item.kind]),button:'Ver conquista',at:now});
 return {ok:true,unlocked,metrics:quizMetrics};
}
module.exports={claimProfileGoals};
