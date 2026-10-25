const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),fs=require('node:fs');
const C=require('../careers'),seed=require('../career-seed.json'),roster=require('../career-staff-s2.json');
const admin={uid:'admin',admin:true},now=()=>Date.parse('2026-10-17T16:30:00Z');
function fixture(){
 const db=new DatabaseSync(':memory:'),trace=[];
 const sql={exec(q,...args){let out=[];for(const query of q.split(';').filter(x=>x.trim())){trace.push({query,args});const s=db.prepare(query);out=s.columns().length?s.all(...args):(s.run(...args),[]);}return out;}};
 const transaction=fn=>{db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
 const legacy=structuredClone(seed);legacy.people=legacy.people.filter(p=>p.id!=='joker-coach');legacy.teams=legacy.teams.filter(t=>t.id!=='lyon');
 const p=legacy.people.find(p=>p.id==='joker');Object.assign(p,{kind:'staff',availability:'unknown',currentTeamHint:'LYON',tenures:[{id:'seed-joker-1',teamId:'teamsolid',teamName:'TEAM SOLID',role:'coach',status:'unverified',order:1,start:{date:'',edition:'',precision:'unknown',certainty:'unknown'},end:{date:'',edition:'',precision:'unknown',certainty:'unknown'},source:'Planilha de passagens',notes:'Registro original'}]});
 const oldRoster=structuredClone(roster);oldRoster.version='wb-2026-s2-staff-v1';oldRoster.people[0]={id:'joker',name:'JOKER',team:'LOUD SNICKERS',role:'head_coach'};
 return {db,trace,old:()=>C.create({sql,transaction,seed:legacy,registration:null,staffRoster:oldRoster,staffHistory:null,repairIdentities:false,now}),fixed:()=>C.create({sql,transaction,seed,registration:null,staffRoster:roster,staffHistory:null,repairIdentities:true,now})};
}
const person=(c,id)=>c.publicRead('person',{id}).person;
const edit=(c,operation,body)=>c.admin(admin,{operation,nonce:crypto.randomUUID(),...body});
test('legacy mixed identity splits once, keeps all staff passage IDs/dates and isolates player statistics',async()=>{
 const x=fixture();try{
  const old=x.old();let p=person(old,'joker');assert(p.current.some(t=>t.teamId==='loudsnickers'));
  const loud=p.tenures.find(t=>t.teamId==='loudsnickers');
  p=(await edit(old,'saveTenure',{personId:p.id,revision:p.revision,tenure:{...loud,start:{date:'2026-02-01',certainty:'confirmed'},notes:'Fonte manual do coach'}})).person;
  const before=p.tenures.filter(t=>t.role!=='player');
  const core=x.fixed(),player=person(core,'joker'),coach=person(core,'joker-coach');
  assert.equal(player.kind,'player');assert.equal(player.country,'cl');assert.deepEqual(player.current.map(t=>t.teamId),['lyon']);assert(player.tenures.every(t=>t.role==='player'));
  assert.equal(coach.kind,'staff');assert.deepEqual(coach.current.map(t=>t.teamId),['loudsnickers']);assert(coach.tenures.every(t=>t.role!=='player'));
  for(const t of before){const moved=coach.tenures.find(v=>v.id===t.id);assert.deepEqual(moved.start,t.start);assert.deepEqual(moved.end,t.end);assert.equal(moved.notes,t.notes);}
  assert.equal(core.publicRead('person',{name:'Joker'}).person.id,'joker');assert.equal(core.publicRead('person',{name:'JOKER Coach'}).person.id,'joker-coach');
  const search=core.publicRead('search',{query:'joker'}).entries;assert(search.some(p=>p.id==='joker'&&p.kind==='player'&&p.team==='LYON'));assert(search.some(p=>p.id==='joker-coach'&&p.kind==='staff'&&p.team==='LOUD SNICKERS'));
  const history=await core.admin(admin,{operation:'history',personId:'joker'});assert.equal(history.entries[0].kind,'identitySplit');assert.equal(history.entries[0].canUndo,0);
  await assert.rejects(edit(core,'undo',{personId:player.id,revision:player.revision,changeId:history.entries[0].id}),{status:400});
  const stats=JSON.parse(fs.readFileSync(require.resolve('../../player-data/basic/ewc-2026.json'),'utf8')).players.joker;
  assert.equal(stats.allTime.kills,88);assert.equal(stats.allTime.matches,29);assert(stats.teamHistory.every(t=>t.team==='LYON'&&t.cargo==='Jogador'));
  assert(!JSON.stringify(JSON.parse(fs.readFileSync(require.resolve('../../player-data/staff/joker-coach.json'),'utf8')).players['joker-coach']).includes('"kills"'));
  x.trace.length=0;x.fixed().ensure();assert.equal(x.trace.filter(t=>/^\s*(INSERT|UPDATE|DELETE)/i.test(t.query)).length,0);
 }finally{x.db.close();}
});
test('fresh installations keep two distinct Joker profiles and do not recreate the collision',()=>{
 const x=fixture();try{const core=x.fixed(),player=person(core,'joker'),coach=person(core,'joker-coach');assert.equal(player.kind,'player');assert(player.current.some(t=>t.teamId==='lyon'));assert.equal(coach.kind,'staff');assert(coach.current.some(t=>t.teamId==='loudsnickers'));assert(!player.tenures.some(t=>t.role!=='player'));assert(!coach.aliases.some(a=>C.key(a)==='joker'));}finally{x.db.close();}
});
test('manual coach departures survive the identity split and later roster sync',async()=>{
 const x=fixture();try{
  const old=x.old();let p=person(old,'joker'),loud=p.current.find(t=>t.teamId==='loudsnickers');
  await edit(old,'releasePerson',{personId:p.id,revision:p.revision,tenureIds:[loud.id],departure:{date:'2026-10-16',certainty:'confirmed'},reason:'Saída manual'});
  const core=x.fixed(),coach=person(core,'joker-coach');assert.equal(coach.availability,'free_agent');assert.equal(coach.current.length,0);assert.equal(coach.freeAgentReason,'Saída manual');assert.equal(coach.tenures.find(t=>t.id===loud.id).end.date,'2026-10-16');assert.equal(person(core,'joker').current[0].teamId,'lyon');assert.equal(person(x.fixed(),'joker-coach').current.length,0);
 }finally{x.db.close();}
});
test('native and grouped staff market links move to the coach while player publications stay with the player',async()=>{
 const x=fixture();try{
  const old=x.old();const p=person(old,'joker'),t=p.current[0];
  const row=(id,personId,role,extra={})=>({id,personId,name:'Joker',role,fromName:'TEAM SOLID',toName:'LOUD SNICKERS',publication:'published',status:'fechado',members:[],...extra});
  for(const r of [row('staff','joker','coach'),row('player','joker','player'),row('group','','other',{members:[{personId:'joker',name:'Joker',tenureId:t.id,role:'head_coach'}]})])x.db.prepare('INSERT INTO career_market VALUES(?,?,?,?,?,?,?)').run(r.id,r.personId,'published','fechado',now(),JSON.stringify(r),1);
  x.db.prepare('INSERT INTO career_market_exits VALUES(?,?)').run(t.id,'group');
  x.fixed().ensure();const load=id=>JSON.parse(x.db.prepare('SELECT data FROM career_market WHERE id=?').get(id).data);
  assert.equal(load('staff').personId,'joker-coach');assert.equal(load('player').personId,'joker');assert.equal(load('group').members[0].personId,'joker-coach');assert.equal(x.db.prepare('SELECT entry FROM career_market_exits WHERE tenure=?').get(t.id).entry,'group');
 }finally{x.db.close();}
});
