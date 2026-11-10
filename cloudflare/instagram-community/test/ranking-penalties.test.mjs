import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {RANKING_PENALTY_SCHEMA,findRankingPenaltyUser,listRankingPenalties,applyRankingPenalty,reverseRankingPenalty} from '../ranking-penalties.js';

const now=Date.parse('2026-11-10T13:00:00Z');
const later=Date.parse('2026-11-17T13:00:00Z');
const nonce='b23fbbd1-7090-4c39-903a-4f9cd5d4fd10';
const adminUid='cff-admin-test';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 for(const statement of RANKING_PENALTY_SCHEMA)sqlite.exec(statement);
 const db={sqlite,
  prepare(q){const stmt=sqlite.prepare(q);return{bind(...params){return{
   first:async()=>stmt.get(...params)||null,
   all:async()=>({results:stmt.all(...params)}),
   run:async()=>({meta:{changes:Number(stmt.run(...params).changes)}})
  }}}},
  async batch(actions){
   sqlite.exec('BEGIN');
   try{
    const rows=[];
    for(const action of actions)rows.push(await action.run());
    sqlite.exec('COMMIT');return rows;
   }catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
 };
 sqlite.prepare('INSERT INTO users(user_key,instagram_id,username,points_all,story_mentions_all,comments_all,active_days_all,last_interaction_at) VALUES(?,?,?,?,?,?,?,?)')
  .run('ig_a','a','alice',50,1,1,2,now-300000);
 sqlite.prepare('INSERT INTO monthly_users(month_key,user_key,username,points,story_mentions,comments,active_days,last_interaction_at) VALUES(?,?,?,?,?,?,?,?)')
  .run('2026-11','ig_a','alice',50,1,1,2,now-300000);
 const seed=(id,day,points)=>sqlite.prepare('INSERT INTO awards(award_key,user_key,username,type,source_id,points,day_key,month_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
  .run(id,'ig_a','alice','comment',id,points,day,'2026-11',Date.parse(day+'T12:00:00Z'));
 seed('older','2026-11-03',30);seed('current','2026-11-10',20);
 sqlite.prepare('INSERT INTO active_days(user_key,day_key) VALUES(?,?)').run('ig_a','2026-11-03');
 sqlite.prepare('INSERT INTO active_days(user_key,day_key) VALUES(?,?)').run('ig_a','2026-11-10');
 return db;
}
const current=db=>({
 all:db.sqlite.prepare('SELECT points_all AS points FROM users WHERE user_key=?').get('ig_a').points,
 month:db.sqlite.prepare('SELECT points FROM monthly_users WHERE month_key=? AND user_key=?').get('2026-11','ig_a').points,
 week:db.sqlite.prepare("SELECT SUM(points) AS points FROM awards WHERE user_key='ig_a' AND day_key >= '2026-11-09' AND day_key <= '2026-11-10'").get().points,
 activeDays:db.sqlite.prepare('SELECT COUNT(*) AS n FROM active_days WHERE user_key=?').get('ig_a').n,
 awards:db.sqlite.prepare('SELECT COUNT(*) AS n FROM awards WHERE user_key=?').get('ig_a').n
});
test('busca exata por @ consulta índices e mostra semana, mês e total antes da punição',async()=>{
 const db=fixture(),found=await findRankingPenaltyUser(db,'@ALICE',now);
 assert.equal(found.username,'alice');assert.equal(found.userKey,'ig_a');
 assert.equal(found.weekPoints,20);assert.equal(found.monthPoints,50);
 assert.equal(found.totalPoints,50);assert.equal(found.maximum,20);
 await assert.rejects(findRankingPenaltyUser(db,'@desconhecido',now),{status:404});
 await assert.rejects(findRankingPenaltyUser(db,'@<script>',now),{status:400});
});
test('punição desconta semana, mês e geral sem alterar dias ativos, Stories e moedas',async()=>{
 const db=fixture(),before=current(db);
 const result=await applyRankingPenalty(db,{userKey:'ig_a',points:12,reason:'Story inválido confirmado',nonce,adminUid},now);
 assert.equal(result.alreadyApplied,false);
 assert.deepEqual(current(db),{all:38,month:38,week:8,activeDays:2,awards:3});
 assert.equal(db.sqlite.prepare('SELECT story_mentions_all FROM users WHERE user_key=?').get('ig_a').story_mentions_all,1);
 assert.equal(db.sqlite.prepare('SELECT type,points FROM awards WHERE award_key=?').get('penalty:'+nonce).type,'admin_penalty');
 const history=await listRankingPenalties(db,{userKey:'ig_a'});
 assert.equal(history.length,1);assert.equal(history[0].reason,'Story inválido confirmado');
 assert.equal(before.week,20);
});
test('repetição e reutilização do nonce não descontam duas vezes',async()=>{
 const db=fixture(),input={userKey:'ig_a',points:10,reason:'Pontos irregulares',nonce,adminUid};
 await applyRankingPenalty(db,input,now);
 const before=current(db);
 const result=await applyRankingPenalty(db,input,now);
 assert.equal(result.alreadyApplied,true);assert.deepEqual(current(db),before);
 await assert.rejects(applyRankingPenalty(db,{...input,points:11},now),{status:409});
 assert.deepEqual(current(db),before);
});
test('limite da semana e do mês impede saldo negativo e gravação parcial',async()=>{
 const db=fixture();
 await assert.rejects(applyRankingPenalty(db,{userKey:'ig_a',points:25,reason:'Teste de saldo insuficiente',nonce,adminUid},now),{status:409});
 assert.deepEqual(current(db),{all:50,month:50,week:20,activeDays:2,awards:2});
 assert.equal((await listRankingPenalties(db)).length,0);
 await assert.rejects(applyRankingPenalty(db,{userKey:'ig_a',points:5,reason:'curto',nonce,adminUid},now),{status:400});
 await assert.rejects(applyRankingPenalty(db,{userKey:'ig_a',points:5,reason:'Motivo completo',nonce,adminUid:''},now),{status:401});
});
test('reversão devolve os pontos ao período original e mantém trilha de auditoria',async()=>{
 const db=fixture();
 await applyRankingPenalty(db,{userKey:'ig_a',points:15,reason:'Penalidade justificada',nonce,adminUid},now);
 const restored=await reverseRankingPenalty(db,{id:nonce,reason:'Revisão administrativa aceita',adminUid},later);
 assert.equal(restored.alreadyReverted,false);
 assert.deepEqual(current(db),{all:50,month:50,week:20,activeDays:2,awards:4});
 const audit=await listRankingPenalties(db);
 assert.equal(audit[0].revertReason,'Revisão administrativa aceita');
 assert.equal(audit[0].revertedAt,later);
 assert.equal(db.sqlite.prepare('SELECT day_key FROM awards WHERE award_key=?').get('penalty-reversal:'+nonce).day_key,'2026-11-10');
 const second=await reverseRankingPenalty(db,{id:nonce,reason:'Revisão administrativa aceita',adminUid},later);
 assert.equal(second.alreadyReverted,true);assert.equal(current(db).awards,4);
});
test('falha na escrita do ledger desfaz o registro e todas as alterações atômicas',async()=>{
 const db=fixture();
 db.sqlite.exec("CREATE TRIGGER simulate_penalty_rollback BEFORE INSERT ON awards WHEN NEW.type='admin_penalty' BEGIN SELECT RAISE(ABORT,'simulated failure'); END;");
 await assert.rejects(applyRankingPenalty(db,{userKey:'ig_a',points:5,reason:'Punição em teste',nonce,adminUid},now),/simulated failure/);
 assert.equal((await listRankingPenalties(db)).length,0);
 assert.deepEqual(current(db),{all:50,month:50,week:20,activeDays:2,awards:2});
});
test('endpoints estão restritos ao admin real e a lista não é pública',()=>{
 const worker=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 assert(worker.includes("'/api/admin/ranking-penalties'"));
 for(const name of ['getAdminRankingPenalties','changeAdminRankingPenalty']){
  const p=worker.indexOf('async function '+name+'('),end=worker.indexOf('\nasync function ',p+1);
  assert(p>=0);
  assert(worker.slice(p,end<0?undefined:end).includes('verifyAdminFirebaseToken(request,env)'));
 }
 assert(worker.includes('invalidatePublicRankings(env.DB)'));
 assert.equal(worker.split("adminUid:String(env.CFF_ADMIN_UID||'')").length-1,2,'o admin verificado via RTDB também possui UID fixado');
 assert(!worker.includes('adminUid:admin.uid'),'a validação RTDB retorna email, não uid');
});
