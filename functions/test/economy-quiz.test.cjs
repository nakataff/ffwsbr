const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const E=require('../economy'),Q=require('../economy-quiz');
const user={uid:'quiz-user',provider:'google.com'},admin={uid:'admin',email:'admin@centralfreefire.com.br'};
const bank=Array.from({length:12},(_,i)=>({id:'fixture-'+i,prompt:'Qual alternativa fictícia corresponde ao exemplo '+i+'?',category:'Teste fictício',options:['Certa '+i,'Errada A '+i,'Errada B '+i,'Errada C '+i],answer:0,explanation:'Explicação fictícia '+i,sourceUrl:'https://example.com/fonte/'+i,enabled:true}));
function setup(){
 const sqlite=new DatabaseSync(':memory:'),queries=[],gets=[];
 const sql={exec(query,...args){queries.push({query,args});let result=[];for(const q of query.split(';').map(x=>x.trim()).filter(Boolean)){const s=sqlite.prepare(q);result=s.columns().length?s.all(...args):(s.run(...args),[]);}return result;}};
 E.initEconomy(sql);let time=Date.parse('2026-10-19T15:00:00-03:00'),ticket=.31;
 const transaction=f=>{sqlite.exec('BEGIN');try{const r=f();sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}};
 const db={get:async path=>{gets.push(path);return {name:'Pessoa',username:'pessoa',gender:'masculino'};}};
 const core=E.createEconomy({sql,transaction,db,now:()=>time,random:()=>ticket});
 const install=async()=>{await core.adminHandle(admin,{operation:'quizImport',questions:bank});await core.adminHandle(admin,{operation:'quizSaveConfig',enabled:true,reward:5});};
 const privateRound=uid=>JSON.parse(sql.exec('SELECT data FROM eco_quiz_rounds WHERE uid=? AND day=?',uid||user.uid,E.dayKey(time))[0].data);
 const answer=(s,index,choice)=>core.handle(user,{operation:'quizAnswer',day:s.day,roundId:s.roundId,index,choice});
 return {core,sql,queries,gets,install,privateRound,answer,setTime:v=>time=v,setTicket:v=>ticket=v,close:()=>sqlite.close()};
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
  assert.equal(first.questions.length,3);assert.deepEqual(first,second);assert.equal(new Set(first.questions.map(q=>q.prompt)).size,3);
  for(const q of first.questions){assert.deepEqual(Object.keys(q).sort(),['index','prompt','category','options'].sort());assert(!('answer' in q));assert(!('sourceUrl' in q));}
  assert.equal(s.sql.exec('SELECT COUNT(*) AS n FROM eco_quiz_rounds')[0].n,1);
  assert(s.queries.filter(x=>x.query.includes('JOIN eco_quiz_questions')).every(x=>x.query.includes('WHERE p.slot=?')));
  assert.equal(s.queries.filter(x=>x.query.includes('JOIN eco_quiz_questions')).length,3);
  s.queries.length=0;s.gets.length=0;await s.core.handle(user,{operation:'quizStatus'});
  assert.equal(s.gets.length,0);assert.equal(s.queries.length,3);assert(!s.queries.some(x=>x.query.includes('eco_quiz_questions')));
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
 const s=setup();try{await s.install();let first=await s.core.handle(user,{operation:'quizStart'});const seen=new Set(first.questions.map(q=>q.prompt));
  s.setTime(Date.parse('2026-10-20T02:59:59Z'));assert.equal((await s.core.handle(user,{operation:'quizStart'})).roundId,first.roundId);
  for(let day=20;day<=22;day++){
   s.setTime(Date.parse(`2026-10-${day}T03:00:00Z`));const next=await s.core.handle(user,{operation:'quizStart'});
   assert.notEqual(next.roundId,first.roundId);for(const q of next.questions){assert(!seen.has(q.prompt));seen.add(q.prompt);}
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
