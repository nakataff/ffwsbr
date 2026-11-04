import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {globalRounds,globalPredictionChoices,globalStart} from '../global-predictions.js';
import {createGlobalPredictionService} from '../global-prediction-service.js';
const read=name=>JSON.parse(readFileSync(new URL('../../../ffws-global-2026/'+name,import.meta.url),'utf8'));
const calendar=read('dates.json'),groups=read('groups.json'),teams=read('teams.json'),roster=read('players.json');
const build=(results={},now=Date.parse('2026-11-04T15:00:00Z'))=>globalRounds(calendar,groups,teams,roster,results,now);
test('12 equipes distintas em cada confronto, MVP só do elenco e sem adivinhar participantes futuros',()=>{
 const rounds=build();assert.equal(rounds.length,18);
 const a=rounds[0],b=rounds[1];
 assert.equal(a.key,'classificatoria-1');
 assert.equal(a.teams.length,12);
 assert.equal(a.ready,true);
 assert.equal(a.players.length,60);
 assert.equal(a.closesAt,Date.parse('2026-11-06T07:00:00Z'));
 assert.equal(b.closesAt,Date.parse('2026-11-06T12:00:00Z'));
 assert.equal(b.teams.length,12);
 assert.equal(new Set([...a.teams.map(t=>t.id),...b.teams.map(t=>t.id)]).size,24);
 assert.equal(a.groups.join(','),'A,B');
 assert.equal(b.groups.join(','),'C,D');
 assert(a.teams.some(t=>t.id==='loud'));
 assert(!b.teams.some(t=>t.id==='loud'));
 assert.equal(rounds.find(r=>r.key==='segundaFase-1').ready,false);
 assert.equal(rounds.find(r=>r.key==='final-1').teams.length,0);
 assert.equal(globalPredictionChoices(a).length,3);
 assert(globalPredictionChoices(a).every(p=>p.options.every(x=>p.metric==='mvp'?a.players.some(v=>v.id===x.id):a.teams.some(v=>v.id===x.id))));
});
test('início é exatamente o horário em Brasília e resultado só aparece após apuração completa',()=>{
 const when=globalStart('2026-11-06','04:00');
 assert.equal(when,Date.parse('2026-11-06T07:00:00Z'));
 assert.equal(build({},when-1)[0].status,'open');
 assert.equal(build({},when)[0].status,'closed');
 const round=build()[0],a=round.teams[0].id,b=round.teams[1].id,player=round.players[0].id;
 let after=build({rounds:{'classificatoria-1':{verified:true,best:[a],worst:[b],mvp:[player]}}},when)[0];
 assert.equal(after.status,'settled');
 assert.deepEqual(after.result.best,[a]);
 const invalid=build({rounds:{'classificatoria-1':{verified:true,best:[a],worst:[b],mvp:['player-unknown']}}},when)[0];
 assert.equal(invalid.status,'closed');
});
test('voto é validado no servidor, não aceita opções de outro confronto, dá participação uma vez e permite troca antes da rodada',async()=>{
 const originalNow=Date.now,lock=Date.parse('2026-11-06T07:00:00Z'),current={time:lock-3600_000};
 Date.now=()=>current.time;
 const saved=new Map(),points=[],currentSession={verified_at:1,user_key:'verified-person',username:'palpiteiro',instagram_id:'ig123'};
 const response=data=>({ok:true,status:200,data});
 const service=createGlobalPredictionService({
  fetchJson:async url=>{const match=url.split('/').pop().split('?')[0];return read(match);},
  json:(data,status)=>({status,data}),getCheckinSession:async(_env,session)=>session==='valid'?currentSession:null,
  predictionVoteFor:async(_env,id,key)=>saved.get(id+':'+key)||null,
  predictionBonus:async()=>({won:false,points:0}),encodeVoteSource:(id,option)=>id+'|'+option+'|',
  parseVoteSource:(id,str)=>str.startsWith(id+'|')?{option:str.split('|')[1]}:null,
  allPredictionVotes:async()=>[],settleOnce:async(_db,_k,_s,fn)=>fn(),
  awardInteraction:async(_env,event)=>{
   if(saved.has(event.awardKey.replace(/^prediction-vote:/,'').replace(/:verified-person$/,'')+':verified-person'))return false;
   const id=event.awardKey.split(':')[1];saved.set(id+':'+event.userKey,{option:event.sourceId.split('|')[1]});points.push(event);return true;
  }
 });
 const env={DB:{prepare:sql=>({bind:(source,username,at,key,user)=>({run:async()=>{
  const id=key.split(':')[1];saved.set(id+':'+user,{option:source.split('|')[1]});
  return {meta:{changes:1}};
 }})})}};
 try{
  const a=build()[0],roundKey=a.key,options=a.teams,player=a.players[0].id;
  const make=(best,worst,mvp,session='valid')=>({roundKey,session,best,worst,mvp});
  async function vote(body){
   return service.vote(new Request('https://example.test/api',{method:'POST',body:JSON.stringify(body)}),env,null,r=>r.json());
  }
  assert.equal((await vote(make(options[0].id,options[0].id,player))).status,400);
  assert.equal((await vote(make(options[0].id,options[1].id,'invalid-id'))).status,400);
  assert.equal((await vote(make(options[0].id,build()[1].teams[0].id,player))).status,400);
  assert.equal((await vote(make(options[0].id,options[1].id,player,'bad'))).status,403);
  const first=await vote(make(options[0].id,options[1].id,player));
  assert.equal(first.status,200);
  assert.equal(first.data.participationAwarded,3);
  assert.equal(points.length,3);
  const second=await vote(make(options[2].id,options[1].id,player));
  assert.equal(second.data.participationAwarded,0);
  assert.equal(saved.get('gf26-classificatoria-1-best:verified-person').option,options[2].id);
  assert.equal(points.length,3);
  current.time=lock;
  const late=await vote(make(options[0].id,options[1].id,player));
  assert.equal(late.status,409);
  assert.equal(points.length,3);
 }finally{Date.now=originalNow;}
});
