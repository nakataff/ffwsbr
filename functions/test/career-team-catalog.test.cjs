'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),C=require('../careers'),createCatalog=require('../career-team-catalog'),catalog=require('../career-team-catalog.json');
function setup(teams=[]) {
 const db=new DatabaseSync(':memory:'),queries=[];
 const sql={exec(q,...args){queries.push({q,args});let result=[];for(const query of q.split(';').filter(q=>q.trim())){const stmt=db.prepare(query);result=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);}return result;}};
 const rows=(q,...args)=>sql.exec(q,...args),transaction=fn=>{db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const core=C.create({sql,transaction,seed:{teams,people:[]},teamCatalog:catalog});return {db,queries,sql,rows,transaction,core,close:()=>db.close()};
}
const admin={uid:'admin',admin:true};
test('LAFF teams appear in administrative movement suggestions with their existing crest and canonical ID',async()=>{
 const f=setup();try{
  f.core.publicRead('market',{});assert(!f.queries.some(x=>x.args.some(a=>String(a).startsWith('team-catalog:'))));
  await assert.rejects(f.core.admin({uid:'visitor'},{operation:'teams',query:'kabum fds'}),{status:403});assert.equal(f.rows('SELECT COUNT(*) AS n FROM career_teams')[0].n,0);
  const result=await f.core.admin(admin,{operation:'teams',query:'kabum fds'});assert.equal(result.entries.length,1);assert.equal(result.entries[0].name,'KABUM! FDS');assert.equal(result.entries[0].id,'kabumfds');assert(result.entries[0].logo.includes('kabum-fds.webp'));
  const saved=await f.core.admin(admin,{operation:'marketSave',nonce:crypto.randomUUID(),entry:{name:'Pessoa de teste',fromName:'KABUM! FDS',toName:'',status:'fechado',publication:'draft',role:'player'}});assert.equal(saved.entry.fromId,'kabumfds');
  assert.equal(f.rows('SELECT COUNT(*) AS n FROM career_people')[0].n,0);assert.equal(f.rows('SELECT COUNT(*) AS n FROM career_tenures')[0].n,0);assert.equal(f.rows('SELECT COUNT(*) AS n FROM career_teams')[0].n,24);
 }finally{f.close();}
});
test('manual identities, custom logos and merged aliases are preserved without merging KABUM with KABUM FDS',async()=>{
 const old={id:'kabum',name:'KABUM',logo:'old.webp',aliases:['KABUM']},managed={id:'managed',name:'Nome editado',logo:'custom.webp',aliases:['Nome editado','SIX EIGHT'],revision:8,metadataManaged:true};
 const f=setup([old,managed]);try{
  await f.core.admin(admin,{operation:'teams',query:'kabum'});assert.equal(f.rows('SELECT COUNT(*) AS n FROM career_teams WHERE id IN (?,?)','kabum','kabumfds')[0].n,2);
  assert.deepEqual(JSON.parse(f.rows('SELECT data FROM career_teams WHERE id=?','managed')[0].data),managed);assert.equal(f.rows('SELECT id FROM career_teams WHERE id=?','sixeight').length,0);assert.equal(f.rows('SELECT team FROM career_team_aliases WHERE alias=?','sixeight')[0].team,'managed');
 }finally{f.close();}
});
test('catalogue sync is one-time and cold instances check just one indexed marker',()=>{
 const f=setup();try{
  f.core.ensure();let sync=createCatalog({...f,key:C.key,catalog});sync.ensure();assert.equal(f.rows('SELECT COUNT(*) AS n FROM career_teams')[0].n,24);
  f.queries.length=0;sync.ensure();assert.equal(f.queries.length,0);
  sync=createCatalog({...f,key:C.key,catalog});sync.ensure();assert.equal(f.queries.length,1);assert.equal(f.queries[0].q,'SELECT value FROM career_meta WHERE id=?');assert.equal(f.rows('SELECT COUNT(*) AS n FROM career_teams')[0].n,24);
 }finally{f.close();}
});
