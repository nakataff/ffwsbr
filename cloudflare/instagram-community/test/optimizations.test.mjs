import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {cachedPublic,monthCoverage,periodVersion,savePeriodSnapshot,settleOnce,OPTIMIZATION_SCHEMA,MONTH_CATALOG_SCHEMA} from '../optimizations.js';

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
async function workerInternals(cacheBust='') {
  let source=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
  source=source.replace("from './optimizations.js'",`from '${new URL('../optimizations.js',import.meta.url).href}'`);
  source=source.replace("from './profile-insights.js'",`from '${new URL('../profile-insights.js',import.meta.url).href}'`).replace("from './story-reviews.js'",`from '${new URL('../story-reviews.js',import.meta.url).href}'`);
  // Rewards configuration is external; ledger/settlement tests isolate its unrelated bonus rules.
  source=source.replace('async function evaluateWeeklyBonuses(env, base) {','async function evaluateWeeklyBonuses(env, base) { return;');
  source+='\nexport {ensurePerformanceIndexes,getRanking,publicRankingResponse,getWeeklyHistory,getMonthlyHistory,getAchievementProfile,closedMonthKeys,monthlySummaries,computeWeeklySnapshot,getOrCreateWeeklySnapshot,getOrCreateMonthlySnapshot,weekKeys,shiftDayKey,dayKeyTimestamp,allPredictionVotes,predictionResultSignature,invalidatePredictionSettlement,settleAllAvailable,maybeSettleAllAvailable};';
  source+='\n//# sourceURL=worker-under-test.js\n// '+cacheBust;
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

test('month migration backfills old data once and safely resumes without duplicating it',async()=>{
 const db=database();
 const oldSchema=readFileSync(new URL('../schema.sql',import.meta.url),'utf8').split('-- Resumo persistente dos meses:')[0];
 db.sqlite.exec(oldSchema);
 seed(db,'2026-08-02','a','alice',2);seed(db,'2026-08-29','b','bob',3);seed(db,'2026-09-10','a','alice',4);
 await db.batch(MONTH_CATALOG_SCHEMA.map(sql=>db.prepare(sql)));
 assert.deepEqual({...await monthCoverage(db,'2026-08')},{firstDay:'2026-08-02',lastDay:'2026-08-29'});
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM ranking_month_catalog').get().n,2);
 // If bootstrap tried to backfill again, these updates would abort the batch.
 db.sqlite.exec("CREATE TRIGGER assert_no_backfill BEFORE UPDATE ON ranking_month_catalog BEGIN SELECT RAISE(ABORT,'backfill repeated'); END");
 await db.batch(MONTH_CATALOG_SCHEMA.map(sql=>db.prepare(sql)));
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM ranking_month_catalog').get().n,2);
 const retry=database();retry.sqlite.exec(oldSchema);seed(retry,'2026-08-02','a','alice',2);
 await assert.rejects(retry.batch([...MONTH_CATALOG_SCHEMA.slice(0,-1).map(sql=>retry.prepare(sql)),retry.prepare('INVALID SQL')]));
 await retry.batch(MONTH_CATALOG_SCHEMA.map(sql=>retry.prepare(sql)));
 assert.equal(retry.sqlite.prepare('SELECT COUNT(*) n FROM ranking_month_catalog').get().n,1);
});

test('month catalog tracks new months, boundary deletes, duplicate days and moved awards',async()=>{
 const db=fixture();seed(db,'2026-08-02','a','alice',2);seed(db,'2026-08-02','b','bob',4);
 seed(db,'2026-08-10','a','alice',2);seed(db,'2026-08-29','a','alice',2);
 const coverage=async()=>({...await monthCoverage(db,'2026-08')});
 assert.deepEqual(await coverage(),{firstDay:'2026-08-02',lastDay:'2026-08-29'});
 db.sqlite.prepare("DELETE FROM awards WHERE user_key='b'").run();
 assert.equal((await coverage()).firstDay,'2026-08-02');
 db.sqlite.prepare("DELETE FROM awards WHERE day_key='2026-08-02'").run();
 assert.equal((await coverage()).firstDay,'2026-08-10');
 db.sqlite.prepare("UPDATE awards SET day_key='2026-09-03',month_key='2026-09' WHERE day_key='2026-08-29'").run();
 assert.deepEqual(await coverage(),{firstDay:'2026-08-10',lastDay:'2026-08-10'});
 assert.equal((await monthCoverage(db,'2026-09')).firstDay,'2026-09-03');
 db.sqlite.prepare("UPDATE awards SET day_key='2026-08-20' WHERE month_key='2026-08'").run();
 assert.equal((await coverage()).firstDay,'2026-08-20');
 db.sqlite.prepare("DELETE FROM awards WHERE month_key='2026-08'").run();
 assert.equal(await monthCoverage(db,'2026-08'),null);
});

test('month discovery and coverage read only saved month rows, including a new month rollover',async()=>{
 const db=fixture();seed(db,'2026-08-02','a','alice',2);seed(db,'2026-09-10','a','alice',4);
 const current=w.weekKeys().weekStartKey.slice(0,7);seed(db,current+'-01','a','alice',1);
 db.queries.length=0;
 assert.deepEqual(await w.closedMonthKeys({DB:db},60),['2026-09','2026-08']);
 assert.equal((await monthCoverage(db,'2026-08')).firstDay,'2026-08-02');
 assert(db.queries.every(sql=>sql.includes('ranking_month_catalog')&&!/FROM awards/i.test(sql)));
 const plan=db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT day_key FROM awards WHERE month_key=? ORDER BY day_key DESC LIMIT 1').all('2026-08');
 assert(plan.some(row=>/COVERING INDEX idx_awards_month_day/.test(row.detail)));
 assert(plan.every(row=>!/SCAN awards|TEMP B-TREE/.test(row.detail)));
 const originalNow=Date.now,stamp=w.dayKeyTimestamp(current+'-01'),next=new Date(stamp+32*86400000);
 next.setUTCDate(5);
 try{Date.now=()=>next.getTime();assert((await w.closedMonthKeys({DB:db},60)).includes(current));}
 finally{Date.now=originalNow;}
});

test('monthly history and profile badges share saved summaries across users and cold instances',async()=>{
 const db=fixture();seed(db,'2026-08-02','a','alice',2);seed(db,'2026-09-10','b','bob',4);
 const env={DB:db},url=new URL('https://cff.test/api/ranking/months');
 const history=await (await w.getMonthlyHistory(req,env,url)).json();assert.equal(history.history.length,2);
 assert.equal(history.history[0].winner.username,'bob');
 const cold=database(db.sqlite);
 const same=await (await w.getMonthlyHistory(req,{DB:cold},new URL(url+'?limit=1'))).json();
 assert.equal(same.history.length,1);assert.deepEqual(same.history[0],history.history[0]);
 assert.equal(cold.queries.length,1);assert(cold.queries[0].includes('community_response_cache'));
 const profileDb=database(db.sqlite);
 const profile=await (await w.getAchievementProfile(req,{DB:profileDb},new URL('https://cff.test/api/achievements/profile?username=alice'))).json();
 assert.equal(profile.metrics.month_wins,1);assert.equal(profile.frozenMonths,2);
 assert(!profileDb.queries.some(sql=>/FROM (ranking_month_catalog|monthly_ranking_snapshots)/.test(sql)));
 const rankingDb=database(db.sqlite);
 const ranking=await (await w.getRanking(req,{DB:rankingDb},new URL('https://cff.test/api/ranking?period=month&month=2026-08'))).json();
 assert.equal(ranking.users.a.points,2);assert.equal(ranking.period.firstRecordedDay,'2026-08-02');
 assert.equal(rankingDb.queries.length,1);assert(rankingDb.queries[0].includes('monthly_ranking_snapshots'));
});

test('late monthly score corrections and deletions refresh saved history and badge counts',async()=>{
 const db=fixture();seed(db,'2026-08-02','a','alice',2);seed(db,'2026-08-10','b','bob',4);
 assert.equal((await w.monthlySummaries({DB:db}))[0].winner.userKey,'b');
 db.sqlite.prepare("UPDATE awards SET points=9 WHERE user_key='a'").run();
 assert.equal((await w.monthlySummaries({DB:database(db.sqlite)}))[0].winner.userKey,'a');
 db.sqlite.prepare("DELETE FROM awards WHERE month_key='2026-08'").run();
 assert.deepEqual(await w.monthlySummaries({DB:database(db.sqlite)}),[]);
});

test('a monthly correction racing the history write cannot save an obsolete summary',async()=>{
 const db=fixture();seed(db,'2026-08-02','a','alice',2);seed(db,'2026-08-10','b','bob',4);
 const prepare=db.prepare;let changed=false;
 db.prepare=sql=>{
   const statement=prepare(sql);
   return {...statement,bind(...values){
     const bound=statement.bind(...values);
     if(sql.includes('INSERT INTO community_response_cache')&&String(values[0]).startsWith('history:months:')){
       return {...bound,async run(){
         if(!changed){changed=true;db.sqlite.prepare("UPDATE awards SET points=9 WHERE user_key='a'").run();}
         return bound.run();
       }};
     }
     return bound;
   }};
 };
 await w.monthlySummaries({DB:db});
 assert(changed);
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM community_response_cache WHERE cache_key LIKE 'history:months:%'").get().n,0);
 assert.equal((await w.monthlySummaries({DB:db}))[0].winner.userKey,'a');
 assert.equal((await w.monthlySummaries({DB:database(db.sqlite)}))[0].winner.userKey,'a');
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
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'").get().n,11);
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
 assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'").get().n,11);
 const cold=await workerInternals('new isolate after successful migration');
 const other=database(db.sqlite);
 assert.equal(await cold.ensurePerformanceIndexes({DB:other}),true);
 assert.equal(other.queries.length,1);
 assert(other.queries[0].startsWith('SELECT version FROM community_period_versions'));
});
