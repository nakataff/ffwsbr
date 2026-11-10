import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {brDay,brWeek,interactionAgePoints,INTERACTION_DAILY_CAP,INTERACTION_POLICY_SCHEMA} from '../interaction-age-policy.js';
const stamp=s=>Date.parse(s);
test('datas de Brasília e mudança de semana',()=>{
 assert.equal(brDay(stamp('2026-11-10T02:50:00Z')),'2026-11-09');
 assert.equal(brWeek('2026-11-09'),'2026-11-09');
 assert.equal(brWeek('2026-11-15'),'2026-11-09');
 assert.equal(brWeek('2026-11-16'),'2026-11-16');
});
test('Stories hoje 5, ontem 2, mais antigos da semana 1 e anterior 0',()=>{
 const mention=stamp('2026-11-13T16:00:00-03:00');
 assert.equal(interactionAgePoints('story',stamp('2026-11-13T10:00:00-03:00'),mention),5);
 assert.equal(interactionAgePoints('story',stamp('2026-11-12T10:00:00-03:00'),mention),2);
 assert.equal(interactionAgePoints('story',stamp('2026-11-09T10:00:00-03:00'),mention),1);
 assert.equal(interactionAgePoints('story',stamp('2026-11-08T23:55:00-03:00'),mention),0);
 assert.equal(interactionAgePoints('story',mention+10*60000,mention),0);
 assert.equal(interactionAgePoints('story',0,mention),0);
});
test('comentários: 2 hoje, 1 nesta semana e 0 na semana anterior',()=>{
 const comment=stamp('2026-11-10T12:00:00-03:00');
 assert.equal(interactionAgePoints('comment',stamp('2026-11-10T09:00:00-03:00'),comment),2);
 assert.equal(interactionAgePoints('comment',stamp('2026-11-09T21:00:00-03:00'),comment),1);
 assert.equal(interactionAgePoints('comment',stamp('2026-11-08T20:00:00-03:00'),comment),0);
 assert.equal(interactionAgePoints('comment',0,comment),0);
});
test('limite diário de 25 pontos é atômico e não inclui bônus',()=>{
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE awards(award_key TEXT PRIMARY KEY,user_key TEXT,username TEXT,type TEXT,source_id TEXT,points INTEGER,day_key TEXT,month_key TEXT,created_at INTEGER)');
 for(const stmt of INTERACTION_POLICY_SCHEMA)sql.exec(stmt);
 const add=(key,type,points,day='2026-11-10')=>sql.prepare('INSERT INTO awards VALUES(?,?,?,?,?,?,?,?,?)')
  .run(key,'ig_alice','alice',type,'post',points,day,day.slice(0,7),1);
 add('story1','story',5);add('story2','story',5);add('bonus','bonus_flash',20);
 for(let i=0;i<7;i++)add('comment'+i,'comment',2);
 add('comment8','comment',1);
 assert.throws(()=>add('comment9','comment',1),/interaction_daily_limit/);
 assert.throws(()=>add('story3','story',1),/interaction_daily_limit/);
 add('tomorrow','comment',2,'2026-11-11');
 assert.equal(sql.prepare("SELECT SUM(points) AS total FROM awards WHERE user_key='ig_alice' AND day_key='2026-11-10' AND type IN ('comment','story')").get().total,25);
});
