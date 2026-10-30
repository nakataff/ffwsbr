'use strict';
// The deployed seed is generated privately by CI; the repository contains a blank placeholder.
const seed=require('./daily-challenges-seed');
const progress=require('./quiz-progress');
const fail=(status,message)=>Object.assign(new Error(message),{status}),DAILY=3,BONUS=5;
const LIMITS={quiz:25,player:20,career:30,lineup:45};
const imagePath=v=>typeof v==='string'&&v.length<=300&&!v.includes('..')&&/^[a-zA-Z0-9_ /.-]+\.(webp|png|jpe?g)$/i.test(v)?v.replace(/^\/+/, ''):'';
function init(sql){
 progress.init(sql);
 sql.exec(`CREATE TABLE IF NOT EXISTS eco_quiz_settings(id INTEGER PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS eco_quiz_questions(id TEXT PRIMARY KEY,data TEXT NOT NULL,enabled INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS eco_quiz_pool(slot INTEGER PRIMARY KEY,question_id TEXT NOT NULL UNIQUE);
 CREATE TABLE IF NOT EXISTS eco_quiz_cursor(uid TEXT PRIMARY KEY,version INTEGER NOT NULL,next_slot INTEGER NOT NULL,stride INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS eco_quiz_kind_pool(kind TEXT,slot INTEGER,question_id TEXT NOT NULL UNIQUE,PRIMARY KEY(kind,slot));
 CREATE TABLE IF NOT EXISTS eco_quiz_kind_cursor(uid TEXT,kind TEXT,version INTEGER,next_slot INTEGER,stride INTEGER,PRIMARY KEY(uid,kind));
 CREATE TABLE IF NOT EXISTS eco_quiz_rounds(uid TEXT,day TEXT,data TEXT NOT NULL,PRIMARY KEY(uid,day));`);
 sql.exec('INSERT OR IGNORE INTO eco_quiz_settings VALUES(1,?)',JSON.stringify({enabled:false,reward:5,count:0,version:0}));
}
function validateQuestion(input){
 const text=(v,max)=>typeof v==='string'&&v.trim().length<=max?v.trim():'';
 const id=text(input?.id,80),prompt=text(input?.prompt,300),category=text(input?.category,60),explanation=text(input?.explanation,600),sourceUrl=text(input?.sourceUrl,1000),kind=input?.kind||'quiz';
 const options=Array.isArray(input?.options)?input.options.map(x=>text(x,120)):[],lineup=kind==='lineup';let source;try{source=new URL(sourceUrl);}catch{}
 if(!Object.hasOwn(LIMITS,kind)||!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||prompt.length<12||!category||options.length!==(lineup?8:4)||options.some(x=>!x)||new Set(options.map(x=>x.normalize('NFKC').toLocaleLowerCase('pt-BR'))).size!==options.length||!explanation||source?.protocol!=='https:'||source.username||source.password)throw fail(400,'Confira formato, pergunta, alternativas diferentes, explicação e fonte HTTPS.');
 const q={id,kind,prompt,category,options,explanation,sourceUrl:source.href,enabled:input.enabled!==false};
 if(lineup){if(input.pickCount!==4||!Array.isArray(input.answers)||input.answers.length!==4||new Set(input.answers).size!==4||input.answers.some(v=>!Number.isInteger(v)||v<0||v>=8))throw fail(400,'Escolha quatro respostas diferentes entre oito jogadores.');q.answers=input.answers.slice().sort((a,b)=>a-b);q.pickCount=4;}
 else{if(!Number.isInteger(input.answer)||input.answer<0||input.answer>3)throw fail(400,'Escolha a resposta correta.');q.answer=input.answer;}
 if(kind==='career'){if(!Array.isArray(input.clues)||input.clues.length<2||input.clues.length>6||input.clues.some(v=>!text(v,100)))throw fail(400,'Informe de duas a seis pistas de carreira.');q.clues=input.clues.map(v=>text(v,100));}
 if(kind==='player'){q.imagePath=imagePath(input.imagePath);if(!q.imagePath)throw fail(400,'Informe uma foto local válida do jogador.');}
 return q;
}
const gcd=(a,b)=>b?gcd(b,a%b):a;
const photoCache=new Map();
async function loadImage(path){
 path=imagePath(path);if(!path)throw fail(400,'Foto inválida.');
 const bundled=seed.photos?.[path];if(typeof bundled==='string'&&/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(bundled))return bundled;
 const existing=photoCache.get(path);if(existing&&existing.until>Date.now())return existing.promise;
 if(photoCache.size>=16)photoCache.delete(photoCache.keys().next().value);
 const entry={until:Date.now()+3600000};entry.promise=(async()=>{
  const url='https://centralfreefire.com.br/'+path.split('/').map(encodeURIComponent).join('/'),r=await fetch(url,{signal:AbortSignal.timeout(10000),redirect:'error'});
  const type=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();if(!r.ok||!['image/webp','image/png','image/jpeg'].includes(type))throw fail(503,'Não foi possível carregar a foto. Tente novamente; o tempo ainda não começou.');
  const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>512*1024)throw fail(503,'Foto indisponível para o desafio. Tente novamente mais tarde.');let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return 'data:'+type+';base64,'+btoa(binary);
 })().catch(error=>{photoCache.delete(path);throw error.status?error:fail(503,'Não foi possível carregar a foto. Tente novamente; o tempo ainda não começou.');});photoCache.set(path,entry);return entry.promise;
}
function create({sql,transaction,credit,wallet,eligible,dayKey,now,random,imageLoader=loadImage,onComplete=()=>{}}){
 const rows=(q,...args)=>Array.from(sql.exec(q,...args)),config=()=>JSON.parse(rows('SELECT data FROM eco_quiz_settings WHERE id=1')[0].data);
 const saveConfig=c=>sql.exec('UPDATE eco_quiz_settings SET data=? WHERE id=1',JSON.stringify(c));
 const round=(uid,day)=>{const row=rows('SELECT data FROM eco_quiz_rounds WHERE uid=? AND day=?',uid,day)[0];if(!row)return null;const r=JSON.parse(row.data);if(!r.goalTracking)r.goalTracking={answered:r.answers.length,perfect:r.answers.length===DAILY&&r.answers.every(a=>a.correct)};return r;};
 const saveRound=(uid,day,r)=>{if(r.answers.length===DAILY&&r.answers.every(a=>!a.skipped&&!a.timedOut&&a.selected!==null&&a.selected!==undefined))onComplete(uid,day);progress.track(sql,uid,r,now());sql.exec('INSERT INTO eco_quiz_rounds VALUES(?,?,?) ON CONFLICT(uid,day) DO UPDATE SET data=excluded.data',uid,day,JSON.stringify(r));};
 const shuffle=values=>{const out=values.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
 function rebuild(c){
  const entries=shuffle(rows('SELECT id,data FROM eco_quiz_questions WHERE enabled=1 ORDER BY id')),counts={};sql.exec('DELETE FROM eco_quiz_pool');sql.exec('DELETE FROM eco_quiz_kind_pool');
  entries.forEach((e,slot)=>{const kind=JSON.parse(e.data).kind||'quiz',n=counts[kind]||0;counts[kind]=n+1;sql.exec('INSERT INTO eco_quiz_pool VALUES(?,?)',slot,e.id);sql.exec('INSERT INTO eco_quiz_kind_pool VALUES(?,?,?)',kind,n,e.id);});saveConfig({...c,kindCounts:counts,count:entries.length,version:c.version+1});
 }
 function prepare(){let c=config();if((seed.version&&c.seedVersion!==seed.version)||!c.kindCounts&&c.count){transaction(()=>{
  if(seed.version&&c.seedVersion!==seed.version){const bank=seed.questions.map(validateQuestion),enabled=new Map(rows("SELECT id,enabled FROM eco_quiz_questions WHERE id LIKE 'built-%'").map(q=>[q.id,q.enabled]));sql.exec("UPDATE eco_quiz_questions SET enabled=0,data=json_set(data,'$.enabled',json('false')) WHERE id LIKE 'built-%'");for(const q of bank){q.enabled=enabled.get(q.id)!==0;sql.exec('INSERT INTO eco_quiz_questions VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,enabled=excluded.enabled',q.id,JSON.stringify(q),q.enabled?1:0);}c.seedVersion=seed.version;}
  rebuild(c);
 });c=config();}return c;}
 function bonus(uid,day,r){if(r.answers.length===DAILY&&r.answers.every(a=>a.correct)&&!r.bonusPaid){credit(uid,BONUS,'quiz_bonus','quiz-bonus:'+uid+':'+day,'Bônus: todos os desafios corretos');r.bonusPaid=BONUS;}}
 function upgrade(uid,day,r){if(r&&!r.schema){r.schema=2;r.bonusPaid=0;r.started={};r.questions=r.questions.map(q=>({...q,kind:q.kind||'quiz',timeLimit:LIMITS[q.kind||'quiz']}));bonus(uid,day,r);saveRound(uid,day,r);}return r;}
 function expire(uid,day,r){const i=r?.answers.length;if(i<DAILY&&r.started?.[i]&&now()>=r.started[i].expiresAt){r.answers.push({selected:null,correct:false,coins:0,timedOut:true});saveRound(uid,day,r);}return r;}
 function present(uid,c,r,day){
  return {ok:true,schema:2,achievements:progress.read(sql,uid),day,serverNow:now(),resetAt:Date.parse(day+'T00:00:00-03:00')+86400000,enabled:c.enabled&&!!(r||c.count>=DAILY),limit:DAILY,reward:r?.reward??c.reward,bonus:BONUS,bonusEarned:r?.bonusPaid||0,roundId:r?.id||'',earned:r?r.answers.reduce((n,a)=>n+a.coins,0)+(r.bonusPaid||0):0,answered:r?.answers.length||0,complete:r?.answers.length===DAILY,
   questions:r?r.questions.map((q,index)=>{const a=r.answers[index],active=r.started?.[index],base={index,kind:q.kind||'quiz',timeLimit:q.timeLimit||LIMITS[q.kind||'quiz']};if(a?.skipped)return {...base,locked:false,answered:true,skipped:true,selected:null,correct:false,coins:0};if(!a&&!active)return {...base,locked:true};return {...base,locked:false,prompt:q.prompt,category:q.category,options:q.options,...(q.clues?{clues:q.clues}:{}),...(q.pickCount?{pickCount:q.pickCount}:{}),...(q.imageData?{imageData:q.imageData}:{}),...(active?{expiresAt:active.expiresAt}:{}),...(a?{answered:true,selected:a.selected,correct:a.correct,correctAnswer:q.kind==='lineup'?q.answers:q.answer,explanation:q.explanation,sourceUrl:q.sourceUrl,coins:a.coins,timedOut:!!a.timedOut,hits:a.hits}: {})};}):[],wallet:wallet(uid)};
 }
 function status(uid){const c=prepare();return transaction(()=>{const day=dayKey(now()),r=expire(uid,day,upgrade(uid,day,round(uid,day)));return present(uid,c,r,day);});}
 function getRound(uid,b){const day=dayKey(now()),r=upgrade(uid,day,round(uid,day));if(b.day!==day||!r||b.roundId!==r.id)throw fail(409,'Os desafios de hoje mudaram. Atualize para continuar.');return{day,r};}
 async function open(uid,b){
  const c=prepare();if(!c.enabled)throw fail(409,'Os desafios estão pausados.');
  if(!Number.isInteger(b.index)||b.index<0||b.index>=DAILY)throw fail(400,'Desafio inválido.');
  const first=transaction(()=>{const {day,r}=getRound(uid,b);expire(uid,day,r);if(b.index>r.answers.length)throw fail(409,'Conclua o desafio atual primeiro.');return r;});
  let imageData=first.questions[b.index].imageData;if(b.index===first.answers.length&&!first.started?.[b.index]&&first.questions[b.index].kind==='player')imageData=await imageLoader(first.questions[b.index].imagePath);
  return transaction(()=>{const current=config();if(!current.enabled)throw fail(409,'Os desafios estão pausados.');const {day,r}=getRound(uid,b);expire(uid,day,r);if(b.index===r.answers.length&&!r.started?.[b.index]){const q=r.questions[b.index];if(imageData)q.imageData=imageData;r.started[b.index]={expiresAt:now()+q.timeLimit*1000};saveRound(uid,day,r);}return present(uid,current,r,day);});
 }
 async function start(uid){
  await eligible(uid);const c=prepare();let fresh=false;
  const data=transaction(()=>{const day=dayKey(now()),old=upgrade(uid,day,round(uid,day));if(old)return present(uid,c,expire(uid,day,old),day);if(!c.enabled||c.count<DAILY)throw fail(409,'Os desafios estão sendo preparados. Volte em breve!');
   const kinds=shuffle(Object.keys(c.kindCounts||{quiz:c.count}).filter(kind=>(c.kindCounts?.[kind]||0)>0)),chosen=[],used={};while(chosen.length<DAILY){for(const kind of kinds)if(chosen.length<DAILY&&(used[kind]||0)<c.kindCounts[kind]){chosen.push(kind);used[kind]=(used[kind]||0)+1;}}
   const questions=[];for(const kind of chosen){const count=c.kindCounts[kind];let cursor=rows('SELECT version,next_slot,stride FROM eco_quiz_kind_cursor WHERE uid=? AND kind=?',uid,kind)[0];if(!cursor||cursor.version!==c.version){let stride=Math.max(1,Math.floor(random()*count));while(gcd(stride,count)!==1)stride=(stride+1)%count||1;cursor={version:c.version,next_slot:Math.floor(random()*count),stride};}
    const value=rows('SELECT q.data FROM eco_quiz_kind_pool p JOIN eco_quiz_questions q ON q.id=p.question_id WHERE p.slot=? AND p.kind=?',cursor.next_slot,kind)[0];if(!value)throw fail(503,'Não foi possível preparar o desafio.');const q=JSON.parse(value.data),order=shuffle(q.options.map((_,i)=>i));questions.push({...q,options:order.map(i=>q.options[i]),...(kind==='lineup'?{answers:order.map((v,i)=>q.answers.includes(v)?i:-1).filter(i=>i>=0)}:{answer:order.indexOf(q.answer)}),timeLimit:LIMITS[kind]});cursor.next_slot=(cursor.next_slot+cursor.stride)%count;sql.exec('INSERT INTO eco_quiz_kind_cursor VALUES(?,?,?,?,?) ON CONFLICT(uid,kind) DO UPDATE SET version=excluded.version,next_slot=excluded.next_slot,stride=excluded.stride',uid,kind,c.version,cursor.next_slot,cursor.stride);
   }
   const r={schema:2,id:crypto.randomUUID(),reward:c.reward,bonusPaid:0,questions,answers:[],started:{},goalTracking:{answered:0,perfect:false}};saveRound(uid,day,r);sql.exec('DELETE FROM eco_quiz_rounds WHERE uid=? AND day<?',uid,day);fresh=true;return present(uid,c,r,day);
  });return fresh?open(uid,{day:data.day,roundId:data.roundId,index:0}):data;
 }
 function answer(uid,b){
  if(!Number.isInteger(b.index)||b.index<0||b.index>=DAILY)throw fail(400,'Desafio inválido.');
  return transaction(()=>{const c=config(),{day,r}=getRound(uid,b),q=r.questions[b.index],old=r.answers[b.index];
   const selected=q.kind==='lineup'?(Array.isArray(b.choices)?b.choices.slice().sort((a,b)=>a-b):null):b.choice;
   if(old){if(old.skipped||old.timedOut||b.choice===null||JSON.stringify(old.selected)===JSON.stringify(selected))return present(uid,c,r,day);throw fail(409,'Sua primeira resposta já foi registrada.');}
   if(!c.enabled)throw fail(409,'Os desafios estão pausados.');if(b.index!==r.answers.length||!r.started?.[b.index])throw fail(409,'Inicie o desafio atual primeiro.');
   if(now()>=r.started[b.index].expiresAt){expire(uid,day,r);return present(uid,c,r,day);}
   if(q.kind==='lineup'){if(!selected||selected.length!==q.pickCount||new Set(selected).size!==selected.length||selected.some(i=>!Number.isInteger(i)||i<0||i>=q.options.length))throw fail(400,'Escolha quatro jogadores diferentes.');}
   else if(!Number.isInteger(selected)||selected<0||selected>=4)throw fail(400,'Escolha uma alternativa válida.');
   const hits=q.kind==='lineup'?selected.filter(i=>q.answers.includes(i)).length:undefined,correct=q.kind==='lineup'?hits===q.pickCount:q.answer===selected,coins=q.kind==='lineup'?Math.floor(r.reward*hits/q.pickCount):correct?r.reward:0;
   if(coins)credit(uid,coins,'quiz','quiz:'+uid+':'+day+':'+b.index,'Desafio diário '+(b.index+1));r.answers.push({selected,correct,coins,...(hits!==undefined?{hits}:{})});bonus(uid,day,r);saveRound(uid,day,r);return present(uid,c,r,day);
  });
 }
 function skip(uid,b){
  if(!Number.isInteger(b.index)||b.index<0||b.index>=DAILY)throw fail(400,'Desafio inválido.');
  return transaction(()=>{const c=config(),{day,r}=getRound(uid,b);
   // Repeated requests refer to the original slot, never to the next challenge.
   if(r.answers[b.index])return present(uid,c,r,day);
   if(!c.enabled)throw fail(409,'Os desafios estão pausados.');
   if(b.index!==r.answers.length)throw fail(409,'Pule apenas o desafio atual.');
   r.answers.push({selected:null,correct:false,coins:0,skipped:true});saveRound(uid,day,r);return present(uid,c,r,day);
  });
 }
 function admin(b){
  const c=prepare();if(b.operation==='quizConfig')return {ok:true,config:{...c,bonus:BONUS,timeLimits:LIMITS},total:rows('SELECT COUNT(*) AS n FROM eco_quiz_questions')[0].n};
  if(b.operation==='quizSaveConfig'){if(typeof b.enabled!=='boolean'||!Number.isInteger(b.reward)||b.reward<1||b.reward>50)throw fail(400,'Escolha de 1 a 50 moedas por acerto.');return transaction(()=>{if(b.enabled&&c.count<DAILY)throw fail(400,'Cadastre pelo menos três desafios antes de ativar.');saveConfig({...c,enabled:b.enabled,reward:b.reward});return {ok:true,config:config()};});}
  if(b.operation==='quizImport'){if(!Array.isArray(b.questions)||!b.questions.length||b.questions.length>50)throw fail(400,'Envie de 1 a 50 desafios por lote.');const questions=b.questions.map(validateQuestion);if(new Set(questions.map(q=>q.id)).size!==questions.length)throw fail(400,'Há identificadores repetidos neste lote.');return transaction(()=>{let changed=false;for(const q of questions){const old=rows('SELECT data,enabled FROM eco_quiz_questions WHERE id=?',q.id)[0],data=JSON.stringify(q),enabled=q.enabled?1:0;if(!old&&enabled||old&&(old.enabled!==enabled||(JSON.parse(old.data).kind||'quiz')!==q.kind))changed=true;if(old?.data!==data)sql.exec('INSERT INTO eco_quiz_questions VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,enabled=excluded.enabled',q.id,data,enabled);}if(changed)rebuild(config());return {ok:true,imported:questions.length,config:config()};});}
  if(b.operation==='quizList'){const offset=Number.isInteger(b.offset)&&b.offset>=0&&b.offset<=100000?b.offset:0,entries=rows('SELECT data FROM eco_quiz_questions ORDER BY id LIMIT 21 OFFSET ?',offset).map(r=>JSON.parse(r.data));return {ok:true,entries:entries.slice(0,20),hasMore:entries.length>20,offset,limit:20};}
  throw fail(400,'Ação do quiz inválida.');
 }
 return {status,start,open,answer,skip,admin};
}
module.exports={init,create,validateQuestion,LIMITS,loadImage,localPhotoCount:()=>Object.keys(seed.photos||{}).length};
