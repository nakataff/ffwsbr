const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite');
const C=require('../careers'),manifest=require('../career-staff-history.json');
const admin={uid:'admin',admin:true},now=()=>Date.parse('2026-10-17T16:00:00Z');
function fixture(){
 const db=new DatabaseSync(':memory:'),trace=[];
 const sql={exec(q,...args){let result=[];for(const query of q.split(';').filter(s=>s.trim())){trace.push({query,args});const s=db.prepare(query);result=s.columns().length?s.all(...args):(s.run(...args),[]);}return result;}};
 const transaction=fn=>{db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
 return {db,trace,core:(staffHistory=manifest)=>C.create({sql,transaction,staffHistory,now})};
}
const get=(core,id)=>core.publicRead('person',{id}).person;
const edit=(core,operation,b)=>core.admin(admin,{operation,nonce:crypto.randomUUID(),...b});
test('LBFF staff identities, aliases and competitions unify without merging unrelated players or claiming current contracts',()=>{
 const x=fixture();try{
  const core=x.core();core.ensure();
  assert.equal(manifest.rawRecords,290);assert.equal(manifest.people.length,106);
  assert.equal(x.db.prepare('SELECT COUNT(*) n FROM career_roster_participations').get().n,290);
  const souto=core.publicRead('person',{name:'Matheus Souto'}).person;
  assert.equal(souto.id,'staff-history-souto');assert.equal(souto.kind,'staff');assert.equal(souto.current.length,0);
  assert.equal(core.publicRead('person',{name:'Souto'}).person.id,souto.id);
  assert.equal(souto.tenures.length,1);
  assert.deepEqual(souto.tenures[0].competitions.map(c=>c.id),['lbff1','lbff3','lbff4','lbff5','lbff7','lbff8']);
  assert.equal(core.publicRead('person',{name:'CapGui63'}).person.id,core.publicRead('person',{name:'Capgui'}).person.id);
  assert.equal(core.publicRead('person',{name:'BUTTER'}).person.id,core.publicRead('person',{name:'Butter'}).person.id);
  assert.equal(core.publicRead('person',{name:'Stark'}).person.id,'stark');assert.equal(core.publicRead('person',{name:'Trap'}).person.id,'trap');
  for(const id of ['staff-history-stark-coach','staff-history-trap-coach']){
   const p=get(core,id);assert.equal(p.kind,'staff');assert(p.tenures.length>1);assert(p.tenures.every(t=>t.role!=='player'&&t.status==='ended'&&!t.start.date&&!t.end.date));
  }
  const luuuking=get(core,'luuuking');assert(luuuking.current.some(t=>t.teamId==='fluxow7m'&&t.role==='head_coach'));
  const magic=luuuking.tenures.filter(t=>t.teamId==='magicsquad');assert.equal(magic.length,1);assert.deepEqual(magic[0].competitions.map(c=>c.id),['ffws2022bangkok','ffws2023','lbff7','lbff8','lbff9']);
  const vazily=get(core,'vazily');assert(vazily.tenures.some(t=>t.role==='player'));assert(vazily.tenures.some(t=>['coach','head_coach'].includes(t.role)&&t.teamId==='intz'&&t.competitions.some(c=>c.id==='lbff5')));
  const k9=get(core,'staff-history-k9'),keyd=k9.tenures.filter(t=>t.teamId==='vivokeyd');assert.equal(keyd.length,2);assert.deepEqual(keyd.map(t=>t.competitions.map(c=>c.id)),[['lbff1','lbff3'],['lbff9']]);
  assert.deepEqual(k9.tenures.filter(t=>t.competitions.some(c=>c.family==='LBFF')).map(t=>t.teamId),['vivokeyd','fluxow7m','vivokeyd']);
  assert(x.db.prepare('SELECT data FROM career_tenures').all().every(r=>{const t=JSON.parse(r.data);return Number.isSafeInteger(t.order)&&t.order>=1;}));
  assert(!JSON.stringify(souto).includes('before_data'));assert(!JSON.stringify(souto).includes('rawRecords'));
 }finally{x.db.close();}
});
test('manual identity, dates, active team, photo, notes and explicit competition choices survive import',async()=>{
 const x=fixture();try{
  const prior=x.core(null);prior.ensure();
  let made=await edit(prior,'createPeople',{people:[{name:'Matheus Souto',role:'coach'}],mode:'ended',teamId:'teamliquid',start:{date:'2020-01-01',certainty:'confirmed'},end:{date:'2022-11-01',certainty:'confirmed'},source:'Minha apuração'});
  let p=made.people[0];p=(await edit(prior,'saveTenure',{personId:p.id,revision:p.revision,tenure:{...p.tenures[0],notes:'Nota manual preservada',competitionIds:[]}})).person;
  p=(await edit(prior,'saveTenure',{personId:p.id,revision:p.revision,tenure:{teamId:'loudsnickers',role:'coach',status:'active',start:{date:'2026-01-01'},end:{}}})).person;
  p=(await edit(prior,'savePerson',{personId:p.id,revision:p.revision,name:'Souto personalizado',kind:'staff',availability:'active',photo:'souto-retrato.webp',aliases:['Matheus Souto']})).person;
  const before=p.tenures.find(t=>t.teamId==='teamliquid'),core=x.core(),after=get(core,p.id);
  assert.equal(after.name,p.name);assert.equal(after.photo,p.photo);assert.equal(after.availability,p.availability);assert.deepEqual(after.current.map(t=>t.id),p.current.map(t=>t.id));
  assert.equal(core.publicRead('person',{name:'Souto'}).person.id,p.id);
  const t=after.tenures.find(t=>t.teamId==='teamliquid');assert.equal(after.tenures.length,2);assert.deepEqual(t.start,before.start);assert.deepEqual(t.end,before.end);assert.equal(t.notes,before.notes);assert.deepEqual(t.competitions,[]);
  const choices=await core.admin(admin,{operation:'competitionOptions',personId:p.id,tenureId:t.id,teamId:t.teamId,role:t.role});assert.equal(choices.selected.length,0);assert.equal(choices.detected.length,6);
  const reset=await edit(core,'saveTenure',{personId:p.id,revision:after.revision,tenure:{...t,competitionIds:null}});assert.equal(reset.person.tenures.find(v=>v.id===t.id).competitions.length,6);
  const again=get(x.core(),p.id);assert.equal(again.revision,reset.person.revision);
 }finally{x.db.close();}
});
test('archived history is not recreated, ambiguous identities are not guessed and restart performs no import writes',async()=>{
 const x=fixture();try{
  const old=x.core(null);old.ensure();const made=await edit(old,'createPeople',{people:[{name:'Souto',role:'coach'}],mode:'ended',teamId:'teamliquid',end:{edition:'LBFF 8'}});
  let p=made.people[0];p=(await edit(old,'archiveTenure',{personId:p.id,revision:p.revision,tenureId:p.tenures[0].id})).person;
  const core=x.core();assert.equal(get(core,p.id).tenures.length,0);
  const count=x.db.prepare('SELECT COUNT(*) n FROM career_roster_participations').get().n;
  x.trace.length=0;x.core().ensure();
  assert.equal(x.db.prepare('SELECT COUNT(*) n FROM career_roster_participations').get().n,count);
  assert.equal(x.trace.filter(t=>/^\s*(INSERT|UPDATE|DELETE)/i.test(t.query)).length,0);
  assert(x.trace.filter(t=>/^\s*SELECT/i.test(t.query)).length<12,'Restart must check only indexed migration markers');
  x.trace.length=0;get(core,'staff-history-k9');
  const evidence=x.trace.filter(t=>t.query.includes('FROM career_roster_participations'));assert.equal(evidence.length,1);assert.match(evidence[0].query,/WHERE person=\?/);assert.deepEqual(evidence[0].args,['staff-history-k9']);
 }finally{x.db.close();}
});
test('duplicate manual aliases are left for review without creating a third profile',async()=>{
 const x=fixture();try{
  const old=x.core(null);old.ensure();
  const first=(await edit(old,'createPeople',{people:[{name:'Treinador A',role:'coach'}]})).people[0];
  const second=(await edit(old,'createPeople',{people:[{name:'Treinador B',role:'coach'}]})).people[0];
  for(const p of [first,second])await edit(old,'savePerson',{personId:p.id,revision:p.revision,name:p.name,kind:'staff',aliases:['Souto']});
  const core=x.core();core.ensure();assert.equal(x.db.prepare('SELECT id FROM career_people WHERE id=?').get('staff-history-souto'),undefined);
  assert.equal(x.db.prepare('SELECT COUNT(*) n FROM career_aliases WHERE alias=?').get('souto').n,2);
  const marker=x.db.prepare('SELECT value FROM career_meta WHERE id=?').get('staff-history:'+manifest.version);assert.equal(JSON.parse(marker.value).ambiguous,1);
 }finally{x.db.close();}
});

test('former players with historical coaching records appear in the staff directory without a false current contract',async()=>{const x=fixture();try{const core=x.core();for(const query of ['Avenger','Wanheda','VAZILY']){const list=await core.admin(admin,{operation:'search',kind:'staff',query});assert(list.entries.some(p=>p.id===query.toLowerCase()),query);const p=get(core,query.toLowerCase());assert(!p.current.some(t=>t.role==='coach'));}}finally{x.db.close();}});

test('2024 annual, 2025 splits and EWC staff link to their professional roles while Joker/player and unknown roles stay separate',()=>{
 const x=fixture();try{
  const c=x.core(),joker=get(c,'joker-coach'),player=get(c,'joker');
  const ids=joker.tenures.filter(t=>t.teamId==='teamsolid').flatMap(t=>t.competitions.map(c=>c.id));
  assert(ids.includes('ffwsbr2025s1'));assert(ids.includes('ffwsbr2025s2'));assert(ids.includes('ffwsbr2024'));
  assert(joker.tenures.some(t=>t.teamId==='loudsnickers'&&t.competitions.some(c=>c.id==='ewc2026')));assert(player.tenures.every(t=>t.role==='player'));
  const viana=manifest.people.find(p=>p.name==='VIANA'),profile=get(c,viana.id);assert(profile.tenures.some(t=>t.teamId==='loudsnickers'&&t.role==='analyst'&&t.competitions.some(c=>c.id==='ewc2026')));
  const unknown=manifest.people.find(p=>p.name==='SANTIAGO');assert(unknown.records.some(r=>r.role==='other'&&r.competitionId==='ffwsbr2024'));
  const before=JSON.stringify(joker.current);x.trace.length=0;get(c,'joker-coach');assert.equal(JSON.stringify(get(c,'joker-coach').current),before);assert(x.trace.filter(t=>t.query.includes('FROM career_roster_participations')).every(t=>t.query.includes('WHERE person=?')));
 }finally{x.db.close();}
});

test('upgrading the prior LBFF import preserves manually closed contracts and explicit edition choices without recurring import writes',async()=>{
 const x=fixture();try{
  const old={...manifest,version:'previous-lbff-test',people:manifest.people.map(p=>({...p,records:p.records.filter(r=>r.competitionId.startsWith('lbff')).map(r=>({...r,role:r.role==='head_coach'?'coach':r.role}))})).filter(p=>p.records.length)};
  const prior=x.core(old);let p=get(prior,'joker-coach');const t=p.current[0];
  p=(await edit(prior,'saveTenure',{personId:p.id,revision:p.revision,tenure:{...t,status:'ended',end:{date:'2026-10-15'},competitionIds:[]}})).person;
  p=(await edit(prior,'savePerson',{personId:p.id,revision:p.revision,name:p.name,kind:'staff',availability:'free_agent',aliases:p.aliases})).person;
  const upgraded=get(x.core(),'joker-coach');assert.equal(upgraded.current.length,0);assert.equal(upgraded.availability,'free_agent');const kept=upgraded.tenures.find(r=>r.id===t.id);assert.equal(kept.end.date,'2026-10-15');assert.deepEqual(kept.competitions,[]);assert(upgraded.tenures.some(t=>t.competitions.some(c=>c.id==='ffwsbr2025s1')));
  x.trace.length=0;x.core().ensure();assert(!x.trace.some(t=>/^\s*(INSERT|UPDATE|DELETE)/i.test(t.query)));
 }finally{x.db.close();}
});

test('pilot world rosters link the reviewed coach identities and the registered players without reopening any contract',()=>{
 const x=fixture();try{
  const core=x.core(),frois=get(core,'frois'),stark=get(core,'staff-history-stark-coach'),athlete=get(core,'stark');
  for(const id of ['ffws2021singapore','ffws2022sentosa','ffws2023'])assert(frois.tenures.some(t=>t.teamId==='loudsnickers'&&t.competitions.some(c=>c.id===id)),id);
  assert(stark.tenures.some(t=>t.teamId==='vivokeyd'&&t.competitions.some(c=>c.id==='ffws2022sentosa')));assert(!athlete.tenures.some(t=>t.competitions.some(c=>c.id==='ffws2022sentosa')));
  const chef=get(core,'staff-history-chefexl');assert(chef.tenures.some(t=>t.teamId==='corinthians'&&t.competitions.some(c=>c.id==='ffws2019')));assert(!chef.current.length);
  const nobru=get(core,'nobru');assert(nobru.tenures.some(t=>t.teamId==='corinthians'&&t.role==='player'&&t.competitions.some(c=>c.id==='ffws2019')));
  assert(!frois.tenures.some(t=>t.competitions.some(c=>c.id==='ffws2019')),'No coach was invented for LOUD 2019');
 }finally{x.db.close();}
});

test('remaining world staff records attach to reviewed identities and keep both Joker roles separate',()=>{
 const x=fixture();try{const core=x.core(),lu=get(core,'luuuking'),coach=get(core,'joker-coach'),athlete=get(core,'joker');
 for(const id of ['ffws2022bangkok','ffws2023','ffwsglobalfinals2024','ffwsglobalfinals2025'])assert(lu.tenures.some(t=>['coach','head_coach'].includes(t.role)&&t.competitions.some(c=>c.id===id)),id);
 assert(coach.tenures.some(t=>t.teamId==='teamsolid'&&t.role==='coach'&&t.competitions.some(c=>c.id==='ffwsglobalfinals2025')));assert(!athlete.tenures.some(t=>t.teamId==='teamsolid'&&t.role==='coach'));
 assert(get(core,'staff-history-trap-coach').tenures.some(t=>t.role==='coach'&&t.competitions.some(c=>c.id==='ffwsglobalfinals2024')));
 }finally{x.db.close();}
});
