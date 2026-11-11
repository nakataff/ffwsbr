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
 core.ensure();return {core,sqlite};
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
 assert.equal(first.market.length,2);
 assert(first.market.every(p=>p.publication==='published'));
 assert.deepEqual(person(core,'p0').current.map(t=>t.teamId),['fluxo']);
 assert.deepEqual(person(core,'p1').current.map(t=>t.teamId),['fluxo']);
 assert.equal(person(core,'p1').current[0].role,'analyst');
 assert.equal(person(core,'p0').tenures.find(t=>t.id==='t0').status,'ended');
 assert.equal(core.publicRead('team',{name:'LOUD',scope:'current'}).total,1);
 assert.equal(core.publicRead('team',{name:'FLUXO W7M',scope:'current'}).total,2);
 const market=core.publicRead('market',{limit:50});
 assert(market.entries.some(e=>e.jogador==='Alpha'&&e.timeDestino==='FLUXO W7M'));
 assert(market.entries.some(e=>e.jogador==='Bravo'&&e.timeDestino==='FLUXO W7M'));
 const replay=await core.admin(identity,input);
 assert.deepEqual(replay,first);
 assert.equal(core.publicRead('team',{name:'FLUXO W7M',scope:'current'}).total,2);
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
