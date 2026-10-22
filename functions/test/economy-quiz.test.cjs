const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const E=require('../economy'),Q=require('../economy-quiz');
const progress=require('../quiz-progress');
const user={uid:'quiz-user',provider:'google.com'},admin={uid:'admin',email:'admin@centralfreefire.com.br'};
const bank=Array.from({length:12},(_,i)=>({id:'fixture-'+i,prompt:'Qual alternativa fictícia corresponde ao exemplo '+i+'?',category:'Teste fictício',options:['Certa '+i,'Errada A '+i,'Errada B '+i,'Errada C '+i],answer:0,explanation:'Explicação fictícia '+i,sourceUrl:'https://example.com/fonte/'+i,enabled:true}));
function setup({imageLoader=async()=>'data:image/webp;base64,AAAA'}={}){
 const sqlite=new DatabaseSync(':memory:'),queries=[],gets=[];
 const sql={exec(query,...args){queries.push({query,args});let result=[];for(const q of query.split(';').map(x=>x.trim()).filter(Boolean)){const s=sqlite.prepare(q);result=s.columns().length?s.all(...args):(s.run(...args),[]);}return result;}};
 E.initEconomy(sql);let time=Date.parse('2026-10-19T15:00:00-03:00'),ticket=.31;
 const transaction=f=>{sqlite.exec('BEGIN');try{const r=f();sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}};
 const db={get:async path=>{gets.push(path);return {name:'Pessoa',username:'pessoa',gender:'masculino'};}};
 const core=E.createEconomy({sql,transaction,db,now:()=>time,random:()=>ticket,quizImageLoader:imageLoader});
 const install=async()=>{await core.adminHandle(admin,{operation:'quizImport',questions:bank});await core.adminHandle(admin,{operation:'quizSaveConfig',enabled:true,reward:5});};
 const privateRound=uid=>JSON.parse(sql.exec('SELECT data FROM eco_quiz_rounds WHERE uid=? AND day=?',uid||user.uid,E.dayKey(time))[0].data);
 const open=(s,index)=>core.handle(user,{operation:'quizOpen',day:s.day,roundId:s.roundId,index});
 const answer=async(s,index,choice)=>{await open(s,index);return core.handle(user,{operation:'quizAnswer',day:s.day,roundId:s.roundId,index,choice});};
 return {core,sql,queries,gets,install,privateRound,answer,open,setTime:v=>time=v,setTicket:v=>ticket=v,close:()=>sqlite.close()};
}
test('quiz defaults paused; administration and import are inaccessible to players',async()=>{
 const s=setup();try{
  const empty=await s.core.handle(user,{operation:'quizStatus'});assert.equal(empty.enabled,false);assert.deepEqual(empty.questions,[]);assert.equal(empty.reward,5);
  await assert.rejects(s.core.handle(user,{operation:'quizStart'}),{status:409});
  for(const operation of ['quizImport','quizList','quizConfig','quizSaveConfig'])await assert.rejects(s.core.adminHandle(user,{operation,questions:bank,reward:50,enabled:true}),{status:403});
  await assert.rejects(s.core.handle(user,{operation:'quizList'}),{status:400});
  await assert.rejects(s.core.handle({uid:'bad',provider:'anonymous'},{operation:'quizStatus'}),{status:403});
 }finally{s.close();}
});
test('start freezes three questions, shuffles options, leaks no key and reuses the daily round',async()=>{
 const s=setup();try{await s.install();s.queries.length=0;s.gets.length=0;
  const first=await s.core.handle(user,{operation:'quizStart'}),second=await s.core.handle(user,{operation:'quizStart'});
  assert.equal(first.questions.length,3);assert.deepEqual(first,second);assert.equal(new Set(s.privateRound().questions.map(q=>q.prompt)).size,3);
  for(const q of first.questions){assert(!q.locked||!('prompt' in q));assert(!('answer' in q));assert(!('sourceUrl' in q));}
  assert.equal(s.sql.exec('SELECT COUNT(*) AS n FROM eco_quiz_rounds')[0].n,1);
  assert(s.queries.filter(x=>x.query.includes('JOIN eco_quiz_questions')).every(x=>x.query.includes('WHERE p.slot=?')));
  assert.equal(s.queries.filter(x=>x.query.includes('JOIN eco_quiz_questions')).length,3);
  s.queries.length=0;s.gets.length=0;await s.core.handle(user,{operation:'quizStatus'});
  assert.equal(s.gets.length,0);assert.equal(s.queries.length,4);assert(!s.queries.some(x=>x.query.includes('eco_quiz_questions')));
 }finally{s.close();}
});
test('wrong answers are final, rewards credit once and retrying never pays twice',async()=>{
 const s=setup();try{await s.install();let state=await s.core.handle(user,{operation:'quizStart'}),r=s.privateRound();s.gets.length=0;
  const wrong=(r.questions[0].answer+1)%4;state=await s.answer(state,0,wrong);assert.equal(state.earned,0);assert.equal(state.questions[0].correct,false);assert.equal(state.questions[0].correctAnswer,r.questions[0].answer);assert(!('correctAnswer' in state.questions[1]));
  await assert.rejects(s.answer(state,0,r.questions[0].answer),{status:409});
  const choice=r.questions[1].answer;await Promise.all([s.answer(state,1,choice),s.answer(state,1,choice)]);
  state=await s.core.handle(user,{operation:'quizStatus'});assert.equal(state.earned,5);assert.equal(state.wallet.balance,5);
  state=await s.answer(state,2,r.questions[2].answer);assert.equal(state.complete,true);assert.equal(state.earned,10);assert.equal(state.wallet.balance,10);
  assert.equal(s.sql.exec("SELECT COUNT(*) AS n FROM eco_ledger WHERE kind='quiz'")[0].n,2);assert.equal(s.gets.length,0);
  await assert.rejects(s.answer(state,3,0),{status:400});
 }finally{s.close();}
});
test('users cannot select questions, forge dates, skip slots or change the server reward',async()=>{
 const s=setup();try{await s.install();const state=await s.core.handle(user,{operation:'quizStart',reward:500,questions:bank,targetUid:'victim'});
  await assert.rejects(s.answer(state,2,0),{status:409});
  await assert.rejects(s.core.handle(user,{operation:'quizAnswer',day:'2026-10-18',roundId:state.roundId,index:0,choice:0}),{status:409});
  await assert.rejects(s.core.handle({...user,uid:'other'},{operation:'quizAnswer',day:state.day,roundId:state.roundId,index:0,choice:0}),{status:409});
  assert.equal(state.reward,5);assert.equal(s.sql.exec('SELECT COUNT(*) AS n FROM eco_wallet')[0].n,0);
 }finally{s.close();}
});
test('Brasilia midnight unlocks a new set and the private cursor traverses the bank without early repetition',async()=>{
 const s=setup();try{await s.install();let first=await s.core.handle(user,{operation:'quizStart'});const seen=new Set(s.privateRound().questions.map(q=>q.prompt));
  s.setTime(Date.parse('2026-10-20T02:59:59Z'));assert.equal((await s.core.handle(user,{operation:'quizStart'})).roundId,first.roundId);
  for(let day=20;day<=22;day++){
   s.setTime(Date.parse(`2026-10-${day}T03:00:00Z`));const next=await s.core.handle(user,{operation:'quizStart'});
   assert.notEqual(next.roundId,first.roundId);for(const q of s.privateRound().questions){assert(!seen.has(q.prompt));seen.add(q.prompt);}
   assert.equal(next.resetAt,Date.parse(`2026-10-${day+1}T03:00:00Z`));
  }
  assert.equal(seen.size,12);await assert.rejects(s.answer(first,0,0),{status:409});
 }finally{s.close();}
});
test('imports validate before writing and do not change a challenge already in progress',async()=>{
 const s=setup();try{await s.install();const state=await s.core.handle(user,{operation:'quizStart'}),r=s.privateRound(),q=r.questions[0];
  await s.core.adminHandle(admin,{operation:'quizImport',questions:[{...q,prompt:'Uma pergunta substituída para desafios futuros?',answer:(q.answer+1)%4}]});
  await s.core.adminHandle(admin,{operation:'quizSaveConfig',enabled:true,reward:20});
  const same=await s.core.handle(user,{operation:'quizStart'});assert.deepEqual(same,state);
  const paid=await s.answer(state,0,q.answer);assert.equal(paid.earned,5);
  await assert.rejects(s.core.adminHandle(admin,{operation:'quizImport',questions:[{...bank[0],id:'new-fixture'},{...bank[1],options:['Duplicado','duplicado','B','C']}]}),{status:400});
  assert.equal(s.sql.exec('SELECT id FROM eco_quiz_questions WHERE id=?','new-fixture').length,0);
  const list=await s.core.adminHandle(admin,{operation:'quizList'});assert.equal(list.entries.length,12);assert('answer' in list.entries[0]);
 }finally{s.close();}
});
test('failed wallet credit rolls the answer back and a later retry safely completes it',async()=>{
 const s=setup();try{await s.install();const state=await s.core.handle(user,{operation:'quizStart'}),r=s.privateRound(),exec=s.sql.exec;let fail=true;
  s.sql.exec=(query,...args)=>{if(fail&&query.startsWith('INSERT INTO eco_ledger')){fail=false;throw Error('write interrupted');}return exec(query,...args);};
  await assert.rejects(s.answer(state,0,r.questions[0].answer),/write interrupted/);assert.equal(s.privateRound().answers.length,0);
  const result=await s.answer(state,0,r.questions[0].answer);assert.equal(result.earned,5);assert.equal(result.wallet.balance,5);
 }finally{s.close();}
});
test('a pause blocks new answers and imports remain bounded and paginated',async()=>{
 const s=setup();try{await s.install();const state=await s.core.handle(user,{operation:'quizStart'});await s.core.adminHandle(admin,{operation:'quizSaveConfig',enabled:false,reward:5});await assert.rejects(s.answer(state,0,0),{status:409});
  await assert.rejects(s.core.adminHandle(admin,{operation:'quizImport',questions:Array(51).fill(bank[0])}),{status:400});
  assert.throws(()=>Q.validateQuestion({...bank[0],sourceUrl:'javascript:alert(1)'}),{status:400});
  await assert.rejects(s.core.adminHandle(admin,{operation:'quizSaveConfig',enabled:true,reward:51}),{status:400});
 }finally{s.close();}
});

const mixed=[{...bank[0],id:'mixed-quiz',kind:'quiz'},{...bank[1],id:'mixed-career',kind:'career',clues:['Equipe fictícia A','Equipe fictícia B','Equipe fictícia C']},{...bank[2],id:'mixed-lineup',kind:'lineup',options:['Jogador A','Jogador B','Jogador C','Jogador D','Jogador E','Jogador F','Jogador G','Jogador H'],answers:[0,1,2,3],pickCount:4}];
async function installMixed(s,questions=mixed){await s.core.adminHandle(admin,{operation:'quizImport',questions});await s.core.adminHandle(admin,{operation:'quizSaveConfig',enabled:true,reward:5});}
test('mixed formats are distinct, future content stays sealed, and perfect completion pays one five-coin bonus',async()=>{
 const s=setup();try{await installMixed(s);let state=await s.core.handle(user,{operation:'quizStart'});const r=s.privateRound();assert.equal(new Set(r.questions.map(q=>q.kind)).size,3);
 for(const q of state.questions.slice(1)){assert.equal(q.locked,true);for(const key of ['prompt','options','clues','answer','answers','imagePath','sourceUrl'])assert(!(key in q),key);}
 for(let index=0;index<3;index++){state=await s.open(state,index);const q=r.questions[index],body={operation:'quizAnswer',day:state.day,roundId:state.roundId,index,...(q.kind==='lineup'?{choices:q.answers}:{choice:q.answer})};state=await s.core.handle(user,body);if(index===2){const retry=await s.core.handle(user,body);assert.equal(retry.wallet.balance,20);}}
 assert.equal(state.earned,20);assert.equal(state.bonusEarned,5);assert.equal(state.wallet.balance,20);assert.equal(s.sql.exec("SELECT COUNT(*) n FROM eco_ledger WHERE kind='quiz_bonus'")[0].n,1);
 assert.equal(state.achievements.metrics.quiz_correct,3);assert.equal(state.achievements.metrics.quiz_perfect_days,1);assert.equal(state.achievements.metrics.quiz_quiz_correct,1);assert.equal(state.achievements.metrics.quiz_career_correct,1);assert.equal(state.achievements.metrics.quiz_lineup_correct,1);
 }finally{s.close();}
});
test('server deadlines survive reload, forged clocks and repeated opens; expired answers cannot earn coins',async()=>{
 const s=setup();try{await s.install();let state=await s.core.handle(user,{operation:'quizStart'}),deadline=state.questions[0].expiresAt;assert.equal(deadline-state.serverNow,25000);
 s.setTime(deadline-1000);assert.equal((await s.open(state,0)).questions[0].expiresAt,deadline);assert.equal((await s.core.handle(user,{operation:'quizStatus'})).questions[0].expiresAt,deadline);
 s.setTime(deadline);state=await s.core.handle(user,{operation:'quizAnswer',day:state.day,roundId:state.roundId,index:0,choice:s.privateRound().questions[0].answer,expiresAt:deadline+999999,serverNow:0});assert(state.questions[0].timedOut);assert.equal(state.wallet.balance,0);
 state=await s.core.handle(user,{operation:'quizStatus'});assert.equal(state.answered,1);assert(state.questions[1].locked);assert(!('prompt' in state.questions[1]));
 s.setTime(deadline+100000);state=await s.open(state,1);assert.equal(state.questions[1].expiresAt-state.serverNow,25000);assert.equal(state.earned,0);
 }finally{s.close();}
});
test('lineup has strict four-player selection and proportional coins, while partial completion never earns the bonus',async()=>{
 const s=setup();try{await installMixed(s);let state=await s.core.handle(user,{operation:'quizStart'});const r=s.privateRound();for(let i=0;i<3;i++){state=await s.open(state,i);const q=r.questions[i];if(q.kind==='lineup'){
 const request=choices=>s.core.handle(user,{operation:'quizAnswer',day:state.day,roundId:state.roundId,index:i,choices});await assert.rejects(request([0,0,0,0]),{status:400});await assert.rejects(request(q.answers.slice(0,3)),{status:400});
 const wrong=q.options.map((_,j)=>j).find(j=>!q.answers.includes(j));state=await request([...q.answers.slice(0,3),wrong]);assert.equal(state.questions[i].hits,3);assert.equal(state.questions[i].coins,3);
 }else state=await s.answer(state,i,q.answer);}
 assert.equal(state.earned,13);assert.equal(state.bonusEarned,0);
 assert.equal(state.achievements.metrics.quiz_correct,2);assert.equal(state.achievements.metrics.quiz_perfect_days,0);assert.equal(state.achievements.metrics.quiz_lineup_correct,0);
 }finally{s.close();}
});
test('a failed bonus credit rolls back the final answer and safe retries pay the full amount once',async()=>{
 const s=setup();try{await s.install();let state=await s.core.handle(user,{operation:'quizStart'}),r=s.privateRound();for(let i=0;i<2;i++)state=await s.answer(state,i,r.questions[i].answer);await s.open(state,2);
 const exec=s.sql.exec;let broken=true;s.sql.exec=(query,...args)=>{if(broken&&query.startsWith('INSERT INTO eco_ledger')&&args.includes('quiz_bonus'))throw Error('bonus unavailable');return exec(query,...args);};
 await assert.rejects(s.answer(state,2,r.questions[2].answer),/bonus unavailable/);assert.equal(s.privateRound().answers.length,2);assert.equal(s.sql.exec('SELECT balance FROM eco_wallet WHERE uid=?',user.uid)[0].balance,10);
 assert.equal(progress.read(s.sql,user.uid).metrics.quiz_correct,2);assert.equal(progress.read(s.sql,user.uid).metrics.quiz_perfect_days,0);
 broken=false;state=await s.answer(state,2,r.questions[2].answer);assert.equal(state.earned,20);assert.equal(state.wallet.balance,20);
 }finally{s.close();}
});

test('achievement counters survive the daily cleanup and cannot be reset, forged or credited twice',async()=>{
 const s=setup();try{await s.install();let state;for(const day of [19,21]){
  s.setTime(Date.parse(`2026-10-${day}T15:00:00-03:00`));state=await s.core.handle(user,{operation:'quizStart',achievements:{quiz_correct:99999}});const r=s.privateRound();
  for(let i=0;i<3;i++)state=await s.answer(state,i,r.questions[i].answer);
  const saved=progress.read(s.sql,user.uid);await s.answer(state,2,r.questions[2].answer);await s.core.handle(user,{operation:'quizStatus'});assert.deepEqual(progress.read(s.sql,user.uid),saved);
 }
 assert.equal(state.achievements.metrics.quiz_correct,6);assert.equal(state.achievements.metrics.quiz_perfect_days,2);assert.equal(s.sql.exec('SELECT COUNT(*) n FROM eco_quiz_rounds WHERE uid=?',user.uid)[0].n,1);
 assert.equal(progress.read(s.sql,'another-user').metrics.quiz_correct,0);assert(s.queries.filter(x=>x.query.startsWith('SELECT data FROM eco_quiz_progress')).every(x=>x.query.includes('WHERE uid=?')));
 }finally{s.close();}
});

test('pre-feature answers do not backfill achievements and skipped, expired or wrong answers never increase them',async()=>{
 const s=setup();try{await s.install();let state=await s.core.handle(user,{operation:'quizStart'}),r=s.privateRound();delete r.goalTracking;r.answers=[{selected:r.questions[0].answer,correct:true,coins:5}];s.sql.exec('UPDATE eco_quiz_rounds SET data=? WHERE uid=? AND day=?',JSON.stringify(r),user.uid,state.day);
 state=await s.core.handle(user,{operation:'quizSkip',day:state.day,roundId:state.roundId,index:1});state=await s.open(state,2);s.setTime(state.questions[2].expiresAt);state=await s.core.handle(user,{operation:'quizStatus'});assert(state.complete);assert.equal(state.achievements.metrics.quiz_correct,0);assert.equal(state.achievements.metrics.quiz_perfect_days,0);
 }finally{s.close();}
});

test('a failed round save rolls back coins and achievement counters together',async()=>{
 const s=setup();try{await s.install();let state=await s.core.handle(user,{operation:'quizStart'}),choice=s.privateRound().questions[0].answer;const exec=s.sql.exec;let broken=true;
 s.sql.exec=(query,...args)=>{if(broken&&query.startsWith('INSERT INTO eco_quiz_rounds'))throw Error('round unavailable');return exec(query,...args);};
 await assert.rejects(s.answer(state,0,choice),/round unavailable/);assert.equal(progress.read(s.sql,user.uid).metrics.quiz_correct,0);assert.equal(s.privateRound().answers.length,0);assert.equal(s.sql.exec('SELECT COUNT(*) n FROM eco_ledger')[0].n,0);
 broken=false;state=await s.answer(state,0,choice);assert.equal(state.achievements.metrics.quiz_correct,1);assert.equal(state.wallet.balance,5);
 }finally{s.close();}
});
test('photo names and URLs are never sent to players, images are loaded before starting the timer',async()=>{
 const s=setup();try{await installMixed(s,[0,1,2].map(i=>({...bank[i],kind:'player',imagePath:'player-photos/s2/synthetic.webp'})));const state=await s.core.handle(user,{operation:'quizStart'});assert(state.questions[0].imageData.startsWith('data:image/webp;'));const serialized=JSON.stringify(state);assert(!serialized.includes('synthetic.webp'));assert(!serialized.includes('imagePath'));assert(!serialized.includes('sourceUrl'));assert.equal(state.questions[0].expiresAt-state.serverNow,20000);
 }finally{s.close();}
});
test('legacy completed rounds receive the requested perfect bonus once, keeping prior answers and rewards',async()=>{
 const s=setup();try{await s.install();let state=await s.core.handle(user,{operation:'quizStart'});const r=s.privateRound();r.schema=undefined;r.bonusPaid=undefined;r.answers=r.questions.map(q=>({selected:q.answer,correct:true,coins:5}));s.sql.exec('UPDATE eco_quiz_rounds SET data=? WHERE uid=? AND day=?',JSON.stringify(r),user.uid,state.day);
 state=await s.core.handle(user,{operation:'quizStatus'});assert.equal(state.earned,20);assert.equal(state.bonusEarned,5);await s.core.handle(user,{operation:'quizStatus'});assert.equal(s.sql.exec("SELECT COUNT(*) n FROM eco_ledger WHERE kind='quiz_bonus'")[0].n,1);
 }finally{s.close();}
});

test('generated private bank installs once and preserves administrator pauses across source updates',async()=>{
 const built=require('../daily-challenges-seed'),original={...built},s=setup();try{
  built.version='synthetic-seed-v1';built.questions=mixed.map((q,i)=>({...q,id:'built-synthetic-'+i}));let result=await s.core.adminHandle(admin,{operation:'quizConfig'});assert.equal(result.config.count,3);
  s.queries.length=0;await s.core.handle(user,{operation:'quizStatus'});assert(!s.queries.some(q=>q.query.includes('FROM eco_quiz_questions')));
  await s.core.adminHandle(admin,{operation:'quizImport',questions:[{...built.questions[0],enabled:false}]});built.version='synthetic-seed-v2';result=await s.core.adminHandle(admin,{operation:'quizConfig'});assert.equal(result.config.count,2);
  const list=await s.core.adminHandle(admin,{operation:'quizList'});assert.equal(list.entries.find(q=>q.id==='built-synthetic-0').enabled,false);
 }finally{Object.assign(built,original);s.close();}
});


test('a photo fetch failure preserves the draw and starts no timer until a successful retry finishes loading',async()=>{
 let broken=true;const s=setup({imageLoader:async()=>{s.setTime(Date.parse('2026-10-19T16:00:00-03:00'));if(broken)throw Error('photo unavailable');return 'data:image/webp;base64,AAAA';}});try{
 await installMixed(s,[0,1,2].map(i=>({...bank[i],kind:'player',imagePath:'player-photos/s2/synthetic.webp'})));
 await assert.rejects(s.core.handle(user,{operation:'quizStart'}),/photo unavailable/);const r=s.privateRound();assert.equal(Object.keys(r.started).length,0);broken=false;
 const state=await s.core.handle(user,{operation:'quizStart'});assert.equal(state.roundId,r.id);assert(state.questions[0].locked);const opened=await s.open(state,0);assert.equal(opened.questions[0].expiresAt,Date.parse('2026-10-19T16:00:20-03:00'));
 }finally{s.close();}
});

test('bundled portraits open existing rounds without network requests and keep photo paths private',async()=>{
 const seed=require('../daily-challenges-seed'),original=seed.photos,nativeFetch=global.fetch;let fetches=0;
 seed.photos={'player-photos/s2/synthetic.webp':'data:image/webp;base64,AAAA'};
 global.fetch=async()=>{fetches++;throw Error('site temporarily unavailable');};
 const s=setup({imageLoader:Q.loadImage});try{
  await installMixed(s,[0,1,2].map(i=>({...bank[i],kind:'player',imagePath:'/player-photos/s2/synthetic.webp'})));
  const state=await s.core.handle(user,{operation:'quizStart'});assert.equal(state.questions[0].imageData,seed.photos['player-photos/s2/synthetic.webp']);assert.equal(fetches,0);assert.equal(state.questions[0].expiresAt-state.serverNow,20000);assert.equal(Q.localPhotoCount(),1);
  assert(!JSON.stringify(state).includes('imagePath'));assert(!JSON.stringify(state).includes('synthetic.webp'));
  assert.equal(await Q.loadImage('/player-photos/s2/synthetic.webp'),state.questions[0].imageData);assert.equal(fetches,0);
 }finally{s.close();global.fetch=nativeFetch;seed.photos=original;}
});
test('manually registered photos remain bounded and external failures start no timer',async()=>{
 const nativeFetch=global.fetch;let calls=0;global.fetch=async()=>{calls++;return new Response('not found',{status:404});};
 const s=setup({imageLoader:Q.loadImage});try{
  await installMixed(s,[0,1,2].map(i=>({...bank[i],kind:'player',imagePath:'fixtures/unavailable-photo.webp'})));
  await assert.rejects(s.core.handle(user,{operation:'quizStart'}),{status:503});assert.equal(Object.keys(s.privateRound().started).length,0);assert.equal(calls,1);
  assert.equal(Q.validateQuestion({...bank[0],kind:'player',imagePath:'/player-photos/s2/synthetic.webp'}).imagePath,'player-photos/s2/synthetic.webp');
 }finally{s.close();global.fetch=nativeFetch;}
});

test('skip recovers a broken first photo, preserves the draw and pays only the remaining correct answers',async()=>{
 let broken=true;const s=setup({imageLoader:async()=>{if(broken)throw Error('photo unavailable');return 'data:image/webp;base64,AAAA';}});try{
  await installMixed(s,[0,1,2].map(i=>({...bank[i],kind:'player',imagePath:'fixtures/missing.webp'})));
  await assert.rejects(s.core.handle(user,{operation:'quizStart'}),/photo unavailable/);
  let state=await s.core.handle(user,{operation:'quizStatus'});const drawn=s.privateRound(),ids=drawn.questions.map(q=>q.id),skip={operation:'quizSkip',day:state.day,roundId:state.roundId,index:0};s.gets.length=0;
  state=await s.core.handle(user,skip);assert.equal(state.answered,1);assert(state.questions[0].skipped);assert.equal(state.earned,0);assert(state.questions[1].locked);assert(!('correctAnswer' in state.questions[0]));assert(!('options' in state.questions[0]));assert.equal(Object.keys(s.privateRound().started).length,0);
  assert.deepEqual(await s.core.handle(user,skip),state);assert.deepEqual(s.privateRound().questions.map(q=>q.id),ids);assert.deepEqual(s.gets,[]);
  broken=false;for(let index=1;index<3;index++)state=await s.answer(state,index,s.privateRound().questions[index].answer);
  assert(state.complete);assert.equal(state.earned,10);assert.equal(state.bonusEarned,0);assert.equal(state.wallet.balance,10);assert.equal((await s.core.handle(user,skip)).earned,10);
  assert.equal((await s.core.handle(user,{operation:'quizAnswer',day:state.day,roundId:state.roundId,index:0,choice:drawn.questions[0].answer})).earned,10);
 }finally{s.close();}
});
test('skip is current-slot-only, private, bounded to the daily three and never removes an existing reward',async()=>{
 const s=setup();try{await s.install();let state=await s.core.handle(user,{operation:'quizStart'});const request=(index,extra={})=>s.core.handle(user,{operation:'quizSkip',day:state.day,roundId:state.roundId,index,...extra});
  for(const index of [-1,3,1.5,'0'])await assert.rejects(request(index),{status:400});await assert.rejects(request(1),{status:409});await assert.rejects(request(0,{day:'2026-10-18'}),{status:409});await assert.rejects(request(0,{roundId:'other-round'}),{status:409});await assert.rejects(s.core.handle({...user,uid:'stranger'},{operation:'quizSkip',day:state.day,roundId:state.roundId,index:0}),{status:409});
  state=await s.answer(state,0,s.privateRound().questions[0].answer);state=await request(0);assert.equal(state.wallet.balance,5);assert(state.questions[0].correct);assert(!state.questions[0].skipped);
  for(const index of [1,2])state=await request(index);assert(state.complete);assert.equal(state.earned,5);assert.equal(state.bonusEarned,0);assert.equal((await s.core.handle(user,{operation:'quizStart'})).roundId,state.roundId);assert.equal(s.sql.exec("SELECT COUNT(*) n FROM eco_ledger WHERE kind='quiz_bonus'")[0].n,0);
 }finally{s.close();}
});
test('skip wins safely against an in-flight photo load and cannot reopen or reveal the skipped slot',async()=>{
 let release;const s=setup({imageLoader:()=>new Promise(r=>release=r)});try{await installMixed(s,[0,1,2].map(i=>({...bank[i],kind:'player',imagePath:'fixtures/delayed.webp'})));const pending=s.core.handle(user,{operation:'quizStart'});while(!release)await new Promise(r=>setTimeout(r,0));let state=await s.core.handle(user,{operation:'quizStatus'});state=await s.core.handle(user,{operation:'quizSkip',day:state.day,roundId:state.roundId,index:0});release('data:image/webp;base64,AAAA');const late=await pending;assert.deepEqual(late,state);assert(late.questions[0].skipped);assert(!('imageData' in late.questions[0]));assert.equal(Object.keys(s.privateRound().started).length,0);
 }finally{s.close();}
});
