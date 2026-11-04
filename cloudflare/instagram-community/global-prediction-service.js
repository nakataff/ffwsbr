/* Palpites FFWS Global Finals 2026 — sem novos bancos/tabelas.
 * Votos, participações e acertos compartilham o ledger existente de interações.
 */
import {globalRounds,globalPredictionChoices,GLOBAL_PREDICTION_VERSION} from './global-predictions.js';
const BASE='https://centralfreefire.com.br/ffws-global-2026/';
const files=['dates.json','groups.json','teams.json','players.json','stages.json','palpites-resultados.json'];
const validString=s=>String(s||'').trim();
export function createGlobalPredictionService({fetchJson,json,getCheckinSession,predictionVoteFor,predictionBonus,
 encodeVoteSource,parseVoteSource,awardInteraction,allPredictionVotes,settleOnce}){
 let cache={at:0,pending:null,data:null},sweep={at:0,signature:'',pending:null};
 async function source(){
  if(cache.data&&Date.now()-cache.at<75_000)return cache.data;
  if(cache.pending)return cache.pending;
  cache.pending=Promise.all(files.map(file=>fetchJson(BASE+file))).then(items=>{
   if(items.slice(0,4).some(x=>!x))throw Error('Dados oficiais do Mundial indisponíveis.');
   cache={at:Date.now(),pending:null,data:{calendar:items[0],groups:items[1],teams:items[2],players:items[3],
    stages:items[4]||{},manual:items[5]||{}}};
   return cache.data;
  }).catch(error=>{cache.pending=null;throw error});
  return cache.pending;
 }
 async function rounds(){
  const v=await source();
  return globalRounds(v.calendar,v.groups,v.teams,v.players,{...v.stages,rounds:v.manual.rounds||{}});
 }
 function forRound(list,key){
  return list.find(r=>r.key===key)||list.find(r=>r.ready&&r.closesAt>Date.now())
   ||[...list].reverse().find(r=>r.ready)||list[0]||null;
 }
 function summary(round){
  return {key:round.key,stage:round.stage,date:round.date,time:round.time,closesAt:round.closesAt,
   label:round.label,groups:round.groups,ready:round.ready,status:round.status};
 }
 async function payload(env,session,key){
  const all=await rounds(),selected=forRound(all,key);
  if(!selected)return {ok:true,version:GLOBAL_PREDICTION_VERSION,linked:false,round:null,rounds:[]};
  const user=session?await getCheckinSession(env,session):null;
  const linked=!!user?.verified_at&&!!user?.user_key;
  const votes={},bonuses={};
  if(linked){
   for(const p of globalPredictionChoices(selected)){
    const v=await predictionVoteFor(env,p.id,user.user_key);
    if(v){votes[p.metric]=v.option;const bonus=await predictionBonus(env,p.id,user.user_key);bonuses[p.metric]={correct:bonus.won,points:bonus.points};}
   }
  }
  const round={...summary(selected),teams:selected.teams,players:selected.players,
   result:selected.status==='settled'?selected.result:null};
  return {ok:true,version:GLOBAL_PREDICTION_VERSION,linked,username:linked?user.username:'',round,
   rounds:all.map(summary),votes,bonuses};
 }
 async function list(request,env,url,ctx){
  try{
   const key=validString(url.searchParams.get('round'));
   const all=await rounds();
   if(ctx?.waitUntil)ctx.waitUntil(maybeSettle(env,all).catch(error=>console.error('Global prediction settlement',error)));
   return json(await payload(env,validString(url.searchParams.get('session')),key),200,request);
  }catch(error){console.error('Global prediction list',error);return json({ok:false,error:'Não foi possível carregar os palpites do Mundial.'},503,request);}
 }
 async function vote(request,env,ctx,readJson){
  const body=await readJson(request);
  const key=validString(body?.roundKey),selected={best:validString(body?.best),worst:validString(body?.worst),mvp:validString(body?.mvp)};
  const list=await rounds(),round=list.find(r=>r.key===key);
  if(!round||!round.ready)return json({ok:false,error:'Esta rodada ainda não tem participantes confirmados.'},409,request);
  if(Date.now()>=round.closesAt)return json({ok:false,error:'Os palpites foram encerrados no início da rodada.'},409,request);
  if(selected.best===selected.worst)return json({ok:false,error:'Escolha equipes diferentes para melhor e pior.'},400,request);
  const predictions=globalPredictionChoices(round);
  for(const p of predictions)if(!p.options.some(x=>x.id===selected[p.metric]))
   return json({ok:false,error:'Seleção inválida: só participantes desta rodada são permitidos.'},400,request);
  const user=await getCheckinSession(env,validString(body?.session));
  if(!user?.verified_at||!user?.user_key)return json({ok:false,error:'Vincule seu Instagram para participar dos palpites.'},403,request);
  if(Date.now()>=round.closesAt)return json({ok:false,error:'A rodada já começou. Não é possível alterar seus palpites.'},409,request);
  let earned=0,changes=0;
  for(const p of predictions){
   if(Date.now()>=round.closesAt)return json({ok:false,error:'A rodada começou durante o salvamento. Confira as escolhas gravadas.'},409,request);
   const previous=await predictionVoteFor(env,p.id,user.user_key),choice=selected[p.metric];
   if(!previous){
    const inserted=await awardInteraction(env,{awardKey:'prediction-vote:'+p.id+':'+user.user_key,
     userKey:user.user_key,identity:user.instagram_id||'',username:user.username||'usuario',
     type:'prediction_vote',sourceId:encodeVoteSource(p.id,choice,null),points:1,timestamp:Date.now()});
    if(inserted){earned++;changes++;}
   }else if(previous.option!==choice){
    const updated=await env.DB.prepare("UPDATE awards SET source_id=?1,username=?2,created_at=?3 WHERE award_key=?4 AND user_key=?5 AND type='prediction_vote'")
      .bind(encodeVoteSource(p.id,choice,null),user.username||'usuario',Date.now(),
        'prediction-vote:'+p.id+':'+user.user_key,user.user_key).run();
    if(updated.meta?.changes)changes++;
   }
  }
  const response=await payload(env,validString(body?.session),key);
  return json({...response,saved:true,changes,participationAwarded:earned},200,request);
 }
 async function settle(env,round){
  const ps=globalPredictionChoices(round);if(ps.length!==3||!round.result?.complete)return;
  const accepted=new Map(ps.map(p=>[p.metric,new Set(round.result[p.metric])]));
  const rows={};
  for(const p of ps)rows[p.metric]=await allPredictionVotes(env,p.id);
  const owners=new Map(),timestamp=round.closesAt;
  for(const p of ps){
   const group=rows[p.metric]||[];
   for(let i=0;i<group.length;i+=25){
    await Promise.all(group.slice(i,i+25).filter(v=>{
     const vote=parseVoteSource(p.id,v.source_id);return vote&&accepted.get(p.metric).has(vote.option);
    }).map(v=>awardInteraction(env,{awardKey:'prediction-correct:'+p.id+':'+v.user_key,
      userKey:v.user_key,identity:'',username:v.username||'usuario',type:'prediction_correct',
      sourceId:p.id,points:5,timestamp})));
   }
   for(const v of group){
    const vote=parseVoteSource(p.id,v.source_id);
    if(vote&&accepted.get(p.metric).has(vote.option)){
     const person=owners.get(v.user_key)||{username:v.username||'usuario',metrics:new Set()};
     person.metrics.add(p.metric);owners.set(v.user_key,person);
    }
   }
  }
  const combo=[...owners].filter(([,v])=>v.metrics.size===3);
  for(let i=0;i<combo.length;i+=25){
   await Promise.all(combo.slice(i,i+25).map(([userKey,v])=>awardInteraction(env,{
    awardKey:'prediction-combo:gf26-'+round.key+':'+userKey,userKey,identity:'',
    username:v.username,type:'prediction_combo',sourceId:'gf26-'+round.key,points:3,timestamp
   })));
  }
 }
 async function maybeSettle(env,all){
  const settled=all.filter(r=>r.ready&&r.status==='settled'&&r.result?.complete);
  if(!settled.length)return;
  const signature=JSON.stringify(settled.map(r=>[r.key,r.result]));
  if(sweep.signature===signature&&Date.now()-sweep.at<15*60_000)return sweep.pending||Promise.resolve();
  if(sweep.pending)return sweep.pending;
  sweep.signature=signature;
  sweep.pending=(async()=>{
   for(const round of settled)await settleOnce(env.DB,'global:'+round.key,JSON.stringify(round.result),()=>settle(env,round));
   sweep.at=Date.now();
  })().catch(e=>{sweep.signature='';sweep.at=0;throw e}).finally(()=>{sweep.pending=null});
  return sweep.pending;
 }
 return {list,vote};
}
