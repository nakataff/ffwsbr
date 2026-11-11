const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const Careers=require('../careers');
const identity={uid:'admin-test',admin:true};
const date='2026-10-13';
const seed={
 teams:[{id:'loud',name:'LOUD',aliases:['LOUD SNICKERS']},{id:'fluxo',name:'FLUXO W7M',aliases:['Fluxo']}],
 people:[
  {id:'p0',name:'Alpha',aliases:['Alpha'],kind:'player',availability:'active',photo:'silhueta.webp',
   tenures:[{id:'t0',teamId:'loud',teamName:'LOUD',status:'active',role:'player',order:1,start:{date:'2026-01-01',certainty:'confirmed'},end:{}}]},
  {id:'p1',name:'Bravo',aliases:['Bravo'],kind:'staff',availability:'free_agent',photo:'silhueta.webp',tenures:[]},
  {id:'p2',name:'Charlie',aliases:['Charlie'],kind:'player',availability:'active',photo:'silhueta.webp',
   tenures:[{id:'t2',teamId:'loud',teamName:'LOUD',status:'active',role:'player',order:1,start:{date:'2026-01-01',certainty:'confirmed'},end:{}}]}
 ]
};
const nonce=()=>crypto.randomUUID();
function setup(){
 const sqlite=new DatabaseSync(':memory:');
 const sql={exec(query,...args){let result=[];for(const q of query.split(';').filter(Boolean)){const st=sqlite.prepare(q);result=st.columns().length?st.all(...args):(st.run(...args),[]);}return result;}};
 const transaction=callback=>{sqlite.exec('BEGIN');try{const result=callback();sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}};
 const core=Careers.create({sql,transaction,seed,now:()=>Date.parse('2026-10-15T12:00:00Z')});
 core.ensure();return {core,sqlite,sql,transaction};
}
const person=(core,id)=>core.publicRead('person',{id}).person;
const body=(core,people,overrides={})=>({
 operation:'bulkArrivals',nonce:nonce(),teamId:'fluxo',date,
 members:people.map(([id,role])=>({personId:id,revision:person(core,id).revision,role})),
 source:'Anúncio oficial',sourceUrl:'https://example.com/anuncio',notes:'Chegadas para o Mundial',publishMarket:true,
 ...overrides
});
test('chegadas em massa atualizam simultaneamente time de origem, destino, carreira e Mercado',async()=>{
 const {core,sqlite}=setup(),input=body(core,[['p0','player'],['p1','analyst']]);
 const first=await core.admin(identity,input);
 assert.equal(first.affected.length,2);
 assert.equal(first.market.length,1,'um lote de chegadas publica apenas um card');
 assert(first.market.every(p=>p.publication==='published'));
 assert.deepEqual(person(core,'p0').current.map(t=>t.teamId),['fluxo']);
 assert.deepEqual(person(core,'p1').current.map(t=>t.teamId),['fluxo']);
 assert.equal(person(core,'p1').current[0].role,'analyst');
 assert.equal(person(core,'p0').tenures.find(t=>t.id==='t0').status,'ended');
 assert.equal(core.publicRead('team',{name:'LOUD',scope:'current'}).total,1);
 assert.equal(core.publicRead('team',{name:'FLUXO W7M',scope:'current'}).total,2);
 const market=core.publicRead('market',{limit:50});
 assert.equal(market.total,1);
 assert.equal(market.entries[0].jogador,'Alpha, Bravo');
 assert.equal(market.entries[0].timeDestino,'FLUXO W7M');
 assert.equal(market.entries[0].foto,'silhueta.webp,silhueta.webp');
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM career_market_exits').get().n,0,'chegadas nao sao mapeadas como saidas');
 const marketAdmin=(await core.admin(identity,{operation:'marketList',limit:20})).entries[0];
 assert.equal(marketAdmin.groupType,'bulk-arrival');
 assert.equal(marketAdmin.members.length,2);
 assert.equal(marketAdmin.members[0].name,'Alpha');
 assert.equal(marketAdmin.members[1].name,'Bravo');
 const replay=await core.admin(identity,input);
 assert.deepEqual(replay,first);
 assert.equal(core.publicRead('team',{name:'FLUXO W7M',scope:'current'}).total,2);
 assert.equal(core.publicRead('market',{limit:50}).total,1,'replay nao recria cards separados');
 assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM career_changes WHERE kind='marketTransfer'").get().n,2);
 sqlite.close();
});
test('cadastros desatualizados ou destinos repetidos abortam o lote inteiro',async()=>{
 const {core,sqlite}=setup(),stale=body(core,[['p0','player'],['p1','analyst']]);
 stale.members[1].revision+=1;
 await assert.rejects(core.admin(identity,stale),{status:409});
 assert.deepEqual(person(core,'p0').current.map(t=>t.teamId),['loud']);
 assert.equal(person(core,'p1').current.length,0);
 assert.equal(core.publicRead('team',{name:'FLUXO W7M',scope:'current'}).total,0);
 const duplicate=body(core,[['p0','player'],['p0','player']]);
 await assert.rejects(core.admin(identity,duplicate),{status:400});
 await assert.rejects(core.admin(identity,body(core,[['p0','player']],{date:'2099-01-01'})),{status:400});
 await assert.rejects(core.admin(identity,body(core,[['p0','invalidrole']])),{status:400});
 sqlite.close();
});
test('publicação opcional cria rascunhos sem esconder os novos integrantes no perfil público',async()=>{
 const {core,sqlite}=setup();
 const result=await core.admin(identity,body(core,[['p1','coach']],{publishMarket:false}));
 assert.equal(result.market.length,1);
 assert.equal(result.market[0].publication,'draft');
 assert.equal(core.publicRead('team',{name:'fluxo',scope:'current'}).total,1);
 assert.equal(core.publicRead('market',{limit:50}).entries.some(e=>e.jogador==='Bravo'),false);
 const adminRows=await core.admin(identity,{operation:'marketList',publication:'draft',limit:20});
 assert(adminRows.entries.some(e=>e.name==='Bravo'));
 sqlite.close();
});
test('mesmo destino atual não duplica a passagem; fonte inválida também reverte tudo',async()=>{
 const {core,sqlite}=setup();
 const same=body(core,[['p0','player']],{teamId:'loud'});
 await assert.rejects(core.admin(identity,same),{status:409});
 assert.equal(person(core,'p0').tenures.length,1);
 const invalid=body(core,[['p0','player'],['p1','analyst']],{sourceUrl:'http://insecure.example'});
 await assert.rejects(core.admin(identity,invalid),{status:400});
 assert.equal(core.publicRead('team',{name:'fluxo',scope:'current'}).total,0);
 sqlite.close();
});


test('Mercado exibe foto atual do cadastro, não a blusa antiga salva no card',async()=>{
 const {core,sqlite}=setup();
 const before=person(core,'p0');
 const update=await core.admin(identity,{operation:'savePerson',nonce:nonce(),personId:'p0',revision:before.revision,
  name:before.name,kind:'player',availability:'active',photo:'player-photos/new-shirt.webp'});
 assert.equal(update.person.photo,'player-photos/new-shirt.webp');
 const publication=await core.admin(identity,{operation:'marketSave',nonce:nonce(),entry:{
  personId:'p0',name:'Alpha',role:'player',photo:'player-photos/old-shirt.webp',
  status:'fechado',publication:'published',date:'2026-10-13',
  fromId:'loud',toId:'fluxo'
 }});
 assert.equal(publication.entry.photo,'player-photos/old-shirt.webp');
 const listed=core.publicRead('market',{limit:100}).entries.find(e=>e.personId==='p0');
 assert.equal(listed.personKind,'player');
 assert.equal(listed.foto,'player-photos/new-shirt.webp');
 sqlite.close();
});


test('lotes antigos de chegadas separadas são reunidos pelo nonce real sem repetir a carreira',async()=>{
 const {core,sqlite,sql,transaction}=setup(),input=body(core,[['p0','player'],['p1','analyst']]);
 const created=await core.admin(identity,input);
 assert.equal(created.market.length,1);
 const grouped=JSON.parse(sqlite.prepare('SELECT data FROM career_market WHERE id=?').get(created.market[0].id).data);
 assert.equal(grouped.members.length,2);
 sqlite.prepare('DELETE FROM career_market WHERE id=?').run(grouped.id);
 const oldCards=[];
 for(const [i,member] of grouped.members.entries()){
  const card={...grouped,id:'career-'+member.arrivalTenureId,personId:member.personId,
   name:member.name,photo:member.photo,fromId:member.fromId,fromName:member.fromName,
   role:member.role,roleLabel:'',groupType:'',members:[],careerTenureId:member.arrivalTenureId,
   careerRevision:created.affected[i].revision};
  sqlite.prepare('INSERT INTO career_market(id,person,publication,status,sort_at,data,revision) VALUES(?,?,?,?,?,?,?)')
   .run(card.id,card.personId,card.publication,card.status,card.updatedAt,JSON.stringify(card),1);
  oldCards.push({id:card.id,name:card.name,publication:card.publication});
 }
 sqlite.prepare('UPDATE career_requests SET response=? WHERE nonce=?')
  .run(JSON.stringify({...created,market:oldCards}),input.nonce);
 sqlite.prepare("DELETE FROM career_meta WHERE id='group-previous-bulk-arrivals-20261111-v1'").run();
 const before=sqlite.prepare("SELECT COUNT(*) AS n FROM career_changes WHERE kind='marketTransfer'").get().n;
 const fresh=Careers.create({sql,transaction,seed,now:()=>Date.parse('2026-10-15T12:00:00Z')});
 const publicRows=fresh.publicRead('market',{limit:50});
 assert.equal(publicRows.total,1,'old rows no longer appear separately');
 assert.equal(publicRows.entries[0].jogador,'Alpha, Bravo');
 assert.equal(publicRows.entries[0].timeOrigem,'Várias origens');
 assert.equal(publicRows.entries[0].foto,'silhueta.webp,silhueta.webp');
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM career_market WHERE publication='deleted'").get().n,2);
 assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM career_changes WHERE kind='marketTransfer'").get().n,before);
 const replay=await fresh.admin(identity,input);
 assert.equal(replay.market.length,1);
 assert.equal(replay.market[0].id,publicRows.entries[0].id);
 assert.equal(fresh.publicRead('team',{name:'FLUXO W7M',scope:'current'}).total,2);
 sqlite.close();
});
test('reagrupamento ignora com segurança card antigo que foi editado manualmente',async()=>{
 const {core,sqlite,sql,transaction}=setup(),input=body(core,[['p0','player'],['p1','analyst']]);
 const created=await core.admin(identity,input);
 const group=JSON.parse(sqlite.prepare('SELECT data FROM career_market WHERE id=?').get(created.market[0].id).data);
 sqlite.prepare('DELETE FROM career_market WHERE id=?').run(group.id);
 const cards=[];
 for(const [i,member] of group.members.entries()){
  const card={...group,id:'career-'+member.arrivalTenureId,personId:member.personId,
   name:member.name,photo:member.photo,fromId:member.fromId,fromName:member.fromName,
   role:member.role,roleLabel:'',groupType:'',members:[],careerTenureId:member.arrivalTenureId};
  const revision=i===0?2:1;
  sqlite.prepare('INSERT INTO career_market VALUES(?,?,?,?,?,?,?)')
   .run(card.id,card.personId,card.publication,card.status,card.updatedAt,JSON.stringify(card),revision);
  cards.push({id:card.id});
 }
 sqlite.prepare('UPDATE career_requests SET response=? WHERE nonce=?')
  .run(JSON.stringify({...created,market:cards}),input.nonce);
 sqlite.prepare("DELETE FROM career_meta WHERE id='group-previous-bulk-arrivals-20261111-v1'").run();
 const fresh=Careers.create({sql,transaction,seed,now:()=>Date.parse('2026-10-15T12:00:00Z')});
 const feed=fresh.publicRead('market',{limit:50});
 assert.equal(feed.total,2,'não alterar manualmente cards já editados');
 assert(feed.entries.every(e=>!e.jogador.includes(', ')));
 sqlite.close();
});
