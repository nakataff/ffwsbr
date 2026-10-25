
const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const Core=require('../careers'),seed=require('../career-seed.json'),staffRoster=require('../career-staff-s2.json');
const admin={uid:'admin',admin:true};
function fixture(roster=staffRoster){
 const db=new DatabaseSync(':memory:');
 const sql={exec(query,...args){let result=[];for(const q of query.split(';').filter(s=>s.trim())){const stmt=db.prepare(q);result=stmt.columns().length?stmt.all(...args):(stmt.run(...args),[]);}return result;}};
 const transaction=fn=>{db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const core=(staff=roster)=>Core.create({sql,transaction,seed,staffRoster:staff,registration:null,now:()=>Date.parse('2026-10-17T14:00:00Z')});
 return {db,core};
}
const get=(core,id)=>core.publicRead('person',{id}).person;
test('LUUUKING is retired only as player and belongs to Fluxo as head coach',()=>{
 const x=fixture(),core=x.core(),p=get(core,'luuuking');
 assert.equal(p.kind,'player');
 assert.equal(p.playerRetired,true);
 assert.equal(p.availability,'active');
 assert(p.tenures.some(t=>t.teamName==='TEAM LIQUID'&&t.role==='player'));
 assert(p.current.some(t=>t.teamName==='FLUXO W7M'&&t.role==='head_coach'));
 assert(p.tenures.some(t=>t.teamName==='MAGIC SQUAD'&&t.role==='head_coach'));
 assert(!p.current.some(t=>t.role==='player'));
 assert.equal(core.publicRead('team',{name:'FLUXO W7M',scope:'current'}).entries.some(t=>t.personId==='luuuking'),true);
 const renan=get(core,'renan-staff');assert(renan.current.some(t=>t.teamName==='FLUXO W7M'&&t.role==='analyst'));
});
test('all 25 documented staff have live roles for 14 teams; unknown/TBD omitted',async()=>{
 const x=fixture(),core=x.core();
 assert.equal(staffRoster.people.length,25);
 assert.equal(new Set(staffRoster.people.map(x=>x.team)).size,14);
 for(const row of staffRoster.people){
  const list=await core.admin(admin,{operation:'search',query:row.name,limit:20});
  const matches=list.entries.filter(p=>p.current.some(t=>t.name===row.team&&t.role===row.role));
  assert.equal(matches.length,1,row.name+' / '+row.team+' / '+row.role);
  const p=get(core,matches[0].id),t=p.current.find(t=>t.teamName===row.team&&t.role===row.role);
  assert(t);
  assert(t.source?.includes('liquipedia.net'));
  assert(!t.start.date,'Hiring dates must not be invented');
 }
 assert.equal((await core.admin(admin,{operation:'search',query:'TBD'})).entries.length,0);
 const list=core.publicRead('team',{name:'CPT VOX',scope:'current'});
 assert(list.entries.some(t=>t.name==='DARK'&&t.role==='head_coach'));
});
test('manual departure of the SX TET analyst is preserved, with no duplicate SANTOS',async()=>{
 const x=fixture(),core=x.core(null);
 const creation=await core.admin(admin,{operation:'createPeople',nonce:crypto.randomUUID(),mode:'ended',
  people:[{name:'SANTOS',role:'analyst'}],teamId:'sxtet',end:{date:'2026-10-12'},source:'Saída registrada'});
 assert.equal(creation.people.length,1);
 const before=await core.admin(admin,{operation:'search',query:'santos'});
 assert.equal(before.entries.length,1);
 assert.equal(before.entries[0].availability,'free_agent');
 const newer=x.core(staffRoster);
 const after=await newer.admin(admin,{operation:'search',query:'santos'});
 assert.equal(after.entries.length,1);
 assert.equal(after.entries[0].id,before.entries[0].id);
 assert.equal(after.entries[0].availability,'free_agent');
 assert(!after.entries[0].current.length);
});
test('former-player retirement is editable without altering coaching or resetting it on restart',async()=>{
 const x=fixture(),core=x.core();let p=get(core,'luuuking');
 p=(await core.admin(admin,{operation:'savePerson',nonce:crypto.randomUUID(),personId:'luuuking',
  revision:p.revision,name:p.name,kind:p.kind,availability:p.availability,aliases:p.aliases,playerRetired:false})).person;
 assert.equal(p.playerRetired,false);
 assert.equal(p.current[0].role,'head_coach');
 assert.equal(get(x.core(),'luuuking').playerRetired,false);
});
