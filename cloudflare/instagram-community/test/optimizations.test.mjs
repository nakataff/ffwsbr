import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {cachedPublic,periodVersion,savePeriodSnapshot,settleOnce,OPTIMIZATION_SCHEMA} from '../optimizations.js';

// Execute the production SQL against SQLite; this adapter only supplies D1's async API.
function database(sqlite=new DatabaseSync(':memory:')) {
  const queries=[];
  const db={sqlite,queries,prepare(sql){
    const wrap=params=>({bind(...values){return wrap(values)},
      async first(){queries.push(sql);return sqlite.prepare(sql).get(...params)||null},
      async all(){queries.push(sql);return {results:sqlite.prepare(sql).all(...params)}},
      async run(){queries.push(sql);const r=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(r.changes)}}}
    });return wrap([]);
  },async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}};
  return db;
}
function fixture() {
  const db=database();db.sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));return db;
}
async function workerInternals() {
  let source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
  source=source.replace("from './optimizations.js'",`from '${new URL('../optimizations.js',import.meta.url).href}'`);
  source=source.replace("from './profile-insights.js'",`from '${new URL('../profile-insights.js',import.meta.url).href}'`).replace("from './story-reviews.js'",`from '${new URL('../story-reviews.js',import.meta.url).href}'`);
  // Rewards configuration is external; ledger/settlement tests isolate its unrelated bonus rules.
  source=source.replace('async function evaluateWeeklyBonuses(env, base) {','async function evaluateWeeklyBonuses(env, base) { return;');
  source+='\nexport {getRanking,publicRankingResponse,getWeeklyHistory,computeWeeklySnapshot,getOrCreateWeeklySnapshot,getOrCreateMonthlySnapshot,weekKeys,shiftDayKey,dayKeyTimestamp,allPredictionVotes,predictionResultSignature,invalidatePredictionSettlement,settleAllAvailable,maybeSettleAllAvailable};';
  source+='\n//# sourceURL=worker-under-test.js';
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const w=await workerInternals();
function seed(db,day,key,name,points,type='comment',source='post') {
  const stamp=w.dayKeyTimestamp(day);
  db.sqlite.prepare('INSERT OR IGNORE INTO users(user_key,username) VALUES(?1,?2)').run(key,name);
  db.sqlite.prepare('INSERT INTO awards VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)').run(`${key}:${day}:${source}`,key,name,type,source,points,day,day.slice(0,7),stamp);
  db.sqlite.prepare('INSERT OR IGNORE INTO active_days VALUES(?1,?2)').run(key,day);
}
const req=new Request('https://cff.test/api/ranking',{headers:{Origin:'https://centralfreefire.com.br'}});

test('public ranking preserves scores/tiebreaks and shares cache across isolates',async()=>{
 const db=fixture(),day=w.weekKeys().weekStartKey;seed(db,day,'a','alice',5,'story');seed(db,day,'b','bob',5);seed(db,day,'c','carol',8);
 const env={DB:db},url=new URL('https://cff.test/api/ranking?period=week');
 const original=await (await w.getRanking(req,env,url)).json();
 const payload=await (await w.publicRankingResponse(req,env,url)).json();assert.deepEqual(payload,original);
 assert.deepEqual(Object.keys(payload.users),['c','a','b']);
 const before=db.queries.filter(s=>s.includes('WITH week_awards')).length;
 const another=database(db.sqlite);
 const same=await (await w.publicRankingResponse(req,{DB:another},new URL(url+'&_=123'))).json();assert.deepEqual(same,payload);
 assert.equal(another.queries.filter(s=>s.includes('WITH week_awards')).length,0);
 const historical=await (await w.publicRankingResponse(req,env,new URL(url+'&week='+day))).json();assert.equal(historical.period.historical,true);
 assert.equal(db.queries.filter(s=>s.includes('WITH week_awards')).length,before);
});

test('concurrent cache requests compute once; failed loads remain retryable',async()=>{
 const db=fixture();let calls=0;
 const load=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return {ok:true}};
 const out=await Promise.all(Array.from({length:10},()=>cachedPublic(db,'test',300000,load)));
 assert.equal(calls,1);assert(out.every(v=>v.ok));
 await assert.rejects(cachedPublic(db,'failed',300000,async()=>{throw new Error('offline')}));
 assert.deepEqual(await cachedPublic(db,'failed',300000,async()=>({recovered:true})),{recovered:true});
 db.sqlite.prepare('UPDATE community_response_cache SET expires_at=0 WHERE cache_key=?1').run('test');
 await cachedPublic(database(db.sqlite),'test',300000,load);assert.equal(calls,2);
});

test('closed weeks snapshot once; late writes/corrections/deletions invalidate them',async()=>{
 const db=fixture(),week=w.shiftDayKey(w.weekKeys().weekStartKey,-7);seed(db,week,'a','alice',2);seed(db,week,'b','bob',4);
 const snap=await w.getOrCreateWeeklySnapshot({DB:db},week);assert.equal(snap.winner.userKey,'b');assert.equal(snap.participants,2);
 const queries=db.queries.filter(s=>s.includes('WITH week_awards')).length;
 await w.getOrCreateWeeklySnapshot({DB:db},week);assert.equal(db.queries.filter(s=>s.includes('WITH week_awards')).length,queries);
 const url=new URL('https://cff.test/api/ranking/history?limit=24');
 const history=await (await w.getWeeklyHistory(req,{DB:db},url)).json();assert.equal(history.history[0].winner.userKey,'b');
 seed(db,w.shiftDayKey(week,1),'a','alice',10,'story','late');
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM weekly_ranking_snapshots').get().n,0);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM community_response_cache WHERE cache_key LIKE 'history:%'").get().n,0);
 assert.equal((await w.getOrCreateWeeklySnapshot({DB:db},week)).winner.userKey,'a');
 db.sqlite.prepare("UPDATE awards SET points=0 WHERE source_id='late'").run();
 assert.equal((await w.getOrCreateWeeklySnapshot({DB:db},week)).winner.userKey,'b');
 db.sqlite.prepare("DELETE FROM awards WHERE user_key='b'").run();
 assert.equal((await w.getOrCreateWeeklySnapshot({DB:db},week)).participants,1);
});

test('a late active day changes tie-breaks and invalidates the saved week',async()=>{
 const db=fixture(),week=w.shiftDayKey(w.weekKeys().weekStartKey,-14);seed(db,week,'a','alice',4);seed(db,week,'b','bob',4);
 assert.equal((await w.getOrCreateWeeklySnapshot({DB:db},week)).winner.userKey,'a');
 db.sqlite.prepare('INSERT INTO active_days VALUES(?1,?2)').run('b',w.shiftDayKey(week,1));
 assert.equal((await w.getOrCreateWeeklySnapshot({DB:db},week)).winner.userKey,'b');
});

test('source revision prevents a concurrent old rebuild from being published',async()=>{
 const db=fixture(),week=w.shiftDayKey(w.weekKeys().weekStartKey,-7);seed(db,week,'a','alice',2);
 const version=await periodVersion(db,'week:'+week),old=await w.computeWeeklySnapshot({DB:db},week);
 seed(db,w.shiftDayKey(week,1),'b','bob',10);
 assert.equal(await savePeriodSnapshot(db,'weekly_ranking_snapshots','week_key',week,'week:'+week,version,old),false);
 assert.equal((await w.getOrCreateWeeklySnapshot({DB:db},week)).winner.userKey,'b');
});

test('monthly snapshots survive reads and are invalidated by backdated monthly awards',async()=>{
 const db=fixture();seed(db,'2026-08-01','a','alice',2);
 const first=await w.getOrCreateMonthlySnapshot({DB:db},'2026-08');assert.equal(first.users.a.points,2);
 seed(db,'2026-08-02','a','alice',9,'story','late');
 const second=await w.getOrCreateMonthlySnapshot({DB:db},'2026-08');assert.equal(second.users.a.points,11);
});

test('persistent settlement skips replay across instances and only reruns changed results',async()=>{
 const db=fixture();let calls=0;
 await settleOnce(db,'auto:p','result1',async()=>{calls++});
 await settleOnce(database(db.sqlite),'auto:p','result1',async()=>{calls++});assert.equal(calls,1);
 await settleOnce(db,'auto:p','result2',async()=>{calls++});assert.equal(calls,2);
 const a={id:'p',result:{teams:['A','B'],points:15},correctPoints:5};
 assert.notEqual(w.predictionResultSignature(a),w.predictionResultSignature({...a,result:{teams:['C'],points:15}}));
 assert.equal(w.predictionResultSignature(a),w.predictionResultSignature({...a,result:{teams:['B','A'],points:15,closestError:3}}));
});

test('settlement failures unlock retries; concurrent execution has one owner',async()=>{
 const db=fixture();let release,calls=0;
 const running=settleOnce(db,'manual:p','s',async()=>{calls++;await new Promise(r=>release=r)});
 while(!release)await new Promise(r=>setTimeout(r,1));
 await assert.rejects(settleOnce(database(db.sqlite),'manual:p','s',async()=>{calls++}),/in progress/);
 release();await running;assert.equal(calls,1);
 await assert.rejects(settleOnce(db,'auto:q','s',async()=>{throw new Error('D1 unavailable')}));
 await settleOnce(db,'auto:q','s',async()=>{calls++});assert.equal(calls,2);
});

test('late vote invalidation clears exactly its settlements and combo',async()=>{
 const db=fixture();for(const key of ['manual:a_%','auto:a_%','combo:a_%|b','combo:b|a_%','auto:other'])await settleOnce(db,key,'s',async()=>{});
 await w.invalidatePredictionSettlement({DB:db},'a_%');
 assert.deepEqual(db.sqlite.prepare('SELECT job_key FROM prediction_settlements').all().map(x=>x.job_key),['auto:other']);
});

test('voter pagination includes more than the old cap without duplicates',async()=>{
 const db=fixture(),day=w.weekKeys().weekStartKey;
 const insert=db.sqlite.prepare('INSERT INTO awards VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)');
 for(let i=0;i<2501;i++)insert.run(`prediction-vote:p:u${String(i).padStart(5,'0')}`,`u${i}`,`user${i}`,'prediction_vote','p|a|10',1,day,day.slice(0,7),Date.now());
 const rows=await w.allPredictionVotes({DB:db},'p');assert.equal(rows.length,2501);assert.equal(new Set(rows.map(x=>x.user_key)).size,2501);
});

test('the actual settlement credits winners once, including across worker instances',async()=>{
 const db=fixture(),day=w.shiftDayKey(w.weekKeys().weekStartKey,-7);
 for(const [key,choice] of [['a','correct'],['b','wrong']]){
   db.sqlite.prepare('INSERT INTO users(user_key,username,points_all) VALUES(?1,?2,1)').run(key,key);
   db.sqlite.prepare('INSERT INTO awards VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)')
     .run(`prediction-vote:prize:${key}`,key,key,'prediction_vote',`prize|${choice}`,1,day,day.slice(0,7),Date.now());
 }
 const prediction={id:'prize',category:'custom',status:'settled',correctOption:'correct',correctPoints:7,closesAt:w.dayKeyTimestamp(day)};
 await w.settleAllAvailable({DB:db},prediction,{pairs:[]});
 await w.settleAllAvailable({DB:database(db.sqlite)},prediction,{pairs:[]});
 assert.equal(db.sqlite.prepare("SELECT points_all FROM users WHERE user_key='a'").get().points_all,8);
 assert.equal(db.sqlite.prepare("SELECT points_all FROM users WHERE user_key='b'").get().points_all,1);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM awards WHERE type='prediction_correct'").get().n,1);
});

test('schema bootstrap is repeatable',()=>{
 const db=fixture();for(const sql of OPTIMIZATION_SCHEMA)db.sqlite.exec(sql);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'").get().n,8);
});


test('cache storage failure preserves an otherwise successful public payload',async()=>{
 const broken={prepare(){throw new Error('Cache unavailable')}};
 assert.deepEqual(await cachedPublic(broken,'safe',300000,async()=>({users:{a:{points:7}}})),{users:{a:{points:7}}});
});

test('production fetch bootstraps optimization schema before serving rankings',async()=>{
 const db=database();
 db.sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8').split('-- Cache compartilhado,')[0]);
 const day=w.weekKeys().weekStartKey;seed(db,day,'a','alice',3);
 const response=await w.default.fetch(new Request('https://cff.test/api/ranking?period=week'),{DB:db},{});
 assert.equal(response.status,200);assert.equal((await response.json()).users.a.points,3);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'").get().n,8);
});
