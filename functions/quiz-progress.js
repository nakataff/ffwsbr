'use strict';
const METRICS=['quiz_correct','quiz_perfect_days','quiz_quiz_correct','quiz_player_correct','quiz_career_correct','quiz_lineup_correct'];
function init(sql){sql.exec('CREATE TABLE IF NOT EXISTS eco_quiz_progress(uid TEXT PRIMARY KEY,data TEXT NOT NULL)');}
function read(sql,uid){const row=Array.from(sql.exec('SELECT data FROM eco_quiz_progress WHERE uid=?',uid))[0],data=row?JSON.parse(row.data):{};return {metrics:Object.fromEntries(METRICS.map(key=>[key,Number(data[key])||0])),since:Number(data.since)||0,updatedAt:Number(data.updatedAt)||0};}
// Called inside the same transaction as the round and its coins. The checkpoint
// lives in that round, so retries, status checks and double submits cannot count twice.
function track(sql,uid,round,now){
 const mark=round.goalTracking||{answered:round.answers.length,perfect:round.answers.length===3&&round.answers.every(a=>a.correct)},delta={};
 for(let i=mark.answered;i<round.answers.length;i++){
  const answer=round.answers[i];if(answer.correct!==true||answer.skipped||answer.timedOut)continue;
  delta.quiz_correct=(delta.quiz_correct||0)+1;
  const key='quiz_'+(round.questions[i].kind||'quiz')+'_correct';if(METRICS.includes(key))delta[key]=(delta[key]||0)+1;
 }
 const perfect=round.answers.length===3&&round.answers.every(a=>a.correct===true&&!a.skipped&&!a.timedOut);
 if(perfect&&!mark.perfect)delta.quiz_perfect_days=1;
 round.goalTracking={answered:round.answers.length,perfect};
 if(!Object.keys(delta).length)return;
 // One indexed read and one compact write, only when a counter actually changes.
 const old=read(sql,uid),data={...old.metrics,since:old.since||now,updatedAt:now};
 for(const [key,value]of Object.entries(delta))data[key]+=value;
 sql.exec('INSERT INTO eco_quiz_progress VALUES(?,?) ON CONFLICT(uid) DO UPDATE SET data=excluded.data',uid,JSON.stringify(data));
}
module.exports={METRICS,init,read,track};
