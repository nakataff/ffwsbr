'use strict';
// Question content is imported by the authenticated administrator, never bundled here.
const fail=(status,message)=>Object.assign(new Error(message),{status});
const DAILY=3;
function init(sql){
 sql.exec(`CREATE TABLE IF NOT EXISTS eco_quiz_settings(id INTEGER PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS eco_quiz_questions(id TEXT PRIMARY KEY,data TEXT NOT NULL,enabled INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS eco_quiz_pool(slot INTEGER PRIMARY KEY,question_id TEXT NOT NULL UNIQUE);
 CREATE TABLE IF NOT EXISTS eco_quiz_cursor(uid TEXT PRIMARY KEY,version INTEGER NOT NULL,next_slot INTEGER NOT NULL,stride INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS eco_quiz_rounds(uid TEXT,day TEXT,data TEXT NOT NULL,PRIMARY KEY(uid,day));`);
 sql.exec('INSERT OR IGNORE INTO eco_quiz_settings VALUES(1,?)',JSON.stringify({enabled:false,reward:5,count:0,version:0}));
}
function validateQuestion(input){
 const text=(v,max)=>typeof v==='string'&&v.trim().length<=max?v.trim():'';
 const id=text(input?.id,80),prompt=text(input?.prompt,300),category=text(input?.category,60),explanation=text(input?.explanation,600),sourceUrl=text(input?.sourceUrl,1000);
 const options=Array.isArray(input?.options)?input.options.map(x=>text(x,120)):[];
 let source;try{source=new URL(sourceUrl);}catch{}
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||prompt.length<12||!category||options.length!==4||options.some(x=>!x)||new Set(options.map(x=>x.normalize('NFKC').toLocaleLowerCase('pt-BR'))).size!==4||!Number.isInteger(input.answer)||input.answer<0||input.answer>3||!explanation||source?.protocol!=='https:'||source.username||source.password)throw fail(400,'Confira pergunta, quatro alternativas diferentes, resposta, explicação e fonte HTTPS.');
 return {id,prompt,category,options,answer:input.answer,explanation,sourceUrl:source.href,enabled:input.enabled!==false};
}
const gcd=(a,b)=>b?gcd(b,a%b):a;
function create({sql,transaction,credit,wallet,eligible,dayKey,now,random}){
 const rows=(q,...args)=>Array.from(sql.exec(q,...args));
 const config=()=>JSON.parse(rows('SELECT data FROM eco_quiz_settings WHERE id=1')[0].data);
 const saveConfig=c=>sql.exec('UPDATE eco_quiz_settings SET data=? WHERE id=1',JSON.stringify(c));
 const round=(uid,day)=>{const r=rows('SELECT data FROM eco_quiz_rounds WHERE uid=? AND day=?',uid,day)[0];return r?JSON.parse(r.data):null;};
 const saveRound=(uid,day,r)=>sql.exec('INSERT INTO eco_quiz_rounds VALUES(?,?,?) ON CONFLICT(uid,day) DO UPDATE SET data=excluded.data',uid,day,JSON.stringify(r));
 const shuffle=values=>{const out=values.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
 function present(uid,c,r,day){
  return {ok:true,day,resetAt:Date.parse(day+'T00:00:00-03:00')+86400000,enabled:c.enabled&&!!(r||c.count>=DAILY),limit:DAILY,reward:r?.reward??c.reward,roundId:r?.id||'',earned:r?r.answers.reduce((n,a)=>n+a.coins,0):0,answered:r?.answers.length||0,complete:r?.answers.length===DAILY,
   questions:r?r.questions.map((q,index)=>{const a=r.answers[index];return {index,prompt:q.prompt,category:q.category,options:q.options,...(a?{selected:a.selected,correct:a.correct,correctAnswer:q.answer,explanation:q.explanation,sourceUrl:q.sourceUrl,coins:a.coins}:{})};}):[],wallet:wallet(uid)};
 }
 function status(uid){const day=dayKey(now()),c=config();return present(uid,c,round(uid,day),day);}
 async function start(uid){
  await eligible(uid);
  return transaction(()=>{
   const day=dayKey(now()),c=config(),old=round(uid,day);
   if(old)return present(uid,c,old,day);
   if(!c.enabled||c.count<DAILY)throw fail(409,'O quiz está sendo preparado. Volte em breve!');
   let cursor=rows('SELECT version,next_slot,stride FROM eco_quiz_cursor WHERE uid=?',uid)[0];
   if(!cursor||cursor.version!==c.version){let stride=Math.max(1,Math.floor(random()*c.count));while(gcd(stride,c.count)!==1)stride=(stride+1)%c.count||1;cursor={version:c.version,next_slot:Math.floor(random()*c.count),stride};}
   const questions=[];
   for(let i=0;i<DAILY;i++){
    const value=rows('SELECT q.data FROM eco_quiz_pool p JOIN eco_quiz_questions q ON q.id=p.question_id WHERE p.slot=?',cursor.next_slot)[0];
    if(!value)throw fail(503,'Não foi possível preparar as perguntas agora.');
    const q=JSON.parse(value.data),order=shuffle([0,1,2,3]);
    questions.push({...q,options:order.map(index=>q.options[index]),answer:order.indexOf(q.answer)});
    cursor.next_slot=(cursor.next_slot+cursor.stride)%c.count;
   }
   const r={id:crypto.randomUUID(),reward:c.reward,questions,answers:[]};
   saveRound(uid,day,r);
   sql.exec('DELETE FROM eco_quiz_rounds WHERE uid=? AND day<?',uid,day);
   sql.exec('INSERT INTO eco_quiz_cursor VALUES(?,?,?,?) ON CONFLICT(uid) DO UPDATE SET version=excluded.version,next_slot=excluded.next_slot,stride=excluded.stride',uid,c.version,cursor.next_slot,cursor.stride);
   return present(uid,c,r,day);
  });
 }
 function answer(uid,b){
  if(!Number.isInteger(b.index)||b.index<0||b.index>=DAILY||!Number.isInteger(b.choice)||b.choice<0||b.choice>3)throw fail(400,'Escolha uma alternativa válida.');
  return transaction(()=>{
   const day=dayKey(now()),c=config(),r=round(uid,day);
   if(b.day!==day||!r||b.roundId!==r.id)throw fail(409,'Este quiz não é mais o de hoje. Atualize para continuar.');
   const old=r.answers[b.index];
   if(old){if(old.selected!==b.choice)throw fail(409,'Sua primeira resposta já foi registrada.');return present(uid,c,r,day);}
   if(!c.enabled)throw fail(409,'O quiz está pausado. Tente novamente mais tarde.');
   if(b.index!==r.answers.length)throw fail(409,'Responda à pergunta atual primeiro.');
   const correct=r.questions[b.index].answer===b.choice,coins=correct?r.reward:0;
   if(coins)credit(uid,coins,'quiz','quiz:'+uid+':'+day+':'+b.index,'Quiz diário: pergunta '+(b.index+1));
   r.answers.push({selected:b.choice,correct,coins});saveRound(uid,day,r);
   return present(uid,c,r,day);
  });
 }
 function rebuild(c){
  const ids=shuffle(rows('SELECT id FROM eco_quiz_questions WHERE enabled=1 ORDER BY id').map(q=>q.id));
  sql.exec('DELETE FROM eco_quiz_pool');ids.forEach((id,slot)=>sql.exec('INSERT INTO eco_quiz_pool VALUES(?,?)',slot,id));
  saveConfig({...c,count:ids.length,version:c.version+1});
 }
 function admin(b){
  if(b.operation==='quizConfig')return {ok:true,config:config(),total:rows('SELECT COUNT(*) AS n FROM eco_quiz_questions')[0].n};
  if(b.operation==='quizSaveConfig'){
   if(typeof b.enabled!=='boolean'||!Number.isInteger(b.reward)||b.reward<1||b.reward>50)throw fail(400,'Escolha de 1 a 50 moedas por acerto.');
   return transaction(()=>{const c=config();if(b.enabled&&c.count<DAILY)throw fail(400,'Cadastre pelo menos três perguntas antes de ativar.');saveConfig({...c,enabled:b.enabled,reward:b.reward});return {ok:true,config:config()};});
  }
  if(b.operation==='quizImport'){
   if(!Array.isArray(b.questions)||!b.questions.length||b.questions.length>50)throw fail(400,'Envie de 1 a 50 perguntas por lote.');
   const questions=b.questions.map(validateQuestion);
   if(new Set(questions.map(q=>q.id)).size!==questions.length)throw fail(400,'Há identificadores repetidos neste lote.');
   return transaction(()=>{let membershipChanged=false;for(const q of questions){const old=rows('SELECT data,enabled FROM eco_quiz_questions WHERE id=?',q.id)[0],data=JSON.stringify(q),enabled=q.enabled?1:0;if(!old&&enabled||old&&old.enabled!==enabled)membershipChanged=true;if(old?.data!==data)sql.exec('INSERT INTO eco_quiz_questions VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,enabled=excluded.enabled',q.id,data,enabled);}if(membershipChanged)rebuild(config());return {ok:true,imported:questions.length,config:config()};});
  }
  if(b.operation==='quizList'){
   const offset=Number.isInteger(b.offset)&&b.offset>=0&&b.offset<=100000?b.offset:0;
   const entries=rows('SELECT data FROM eco_quiz_questions ORDER BY id LIMIT 21 OFFSET ?',offset).map(r=>JSON.parse(r.data));
   return {ok:true,entries:entries.slice(0,20),hasMore:entries.length>20,offset,limit:20};
  }
  throw fail(400,'Ação do quiz inválida.');
 }
 return {status,start,answer,admin};
}
module.exports={init,create,validateQuestion};
