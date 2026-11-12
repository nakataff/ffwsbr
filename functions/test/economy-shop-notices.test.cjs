const {test}=require('node:test'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const core=require('../economy-shop-notices');
const chat=require('../global-chat');
const start=Date.parse('2026-11-08T12:00:00-03:00');
function fixture(){
 const db=new DatabaseSync(':memory:'),sql={exec(source,...args){let out=[];for(const q of source.split(';').map(s=>s.trim()).filter(Boolean)){const statement=db.prepare(q);out=statement.columns().length?statement.all(...args):(statement.run(...args),[]);}return out;}};
 sql.exec("CREATE TABLE eco_stock(hash TEXT,code TEXT,title TEXT,expires INTEGER,bucket TEXT,receipt TEXT,image TEXT)");
 sql.exec("CREATE TABLE eco_items(id TEXT,data TEXT)");
 sql.exec("CREATE TABLE eco_code_prices(title TEXT,price INTEGER,updated INTEGER)");
 sql.exec("CREATE TABLE eco_code_promotions(title TEXT,price INTEGER,updated INTEGER)");
 sql.exec('INSERT INTO eco_items VALUES(?,?)','code-default',JSON.stringify({price:1000}));
 core.init(sql);let now=start;
 const transaction=fn=>{db.exec('BEGIN');try{const value=fn();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}};
 const service=()=>core.create({sql,transaction,now:()=>now});
 return {sql,service,clock:value=>now=value,close:()=>db.close()};
}
test('last item, discount and expiry alerts are stored once and do not disclose codes',()=>{
 const f=fixture();try{
  f.sql.exec('INSERT INTO eco_stock VALUES(?,?,?,?,?,?,?)','a','PRIVATEAAA','Skin Dragão',start+2*86400000,'shop',null,'');
  f.sql.exec('INSERT INTO eco_stock VALUES(?,?,?,?,?,?,?)','b','PRIVATEBBB','Skin Dragão',start+2*86400000,'shop',null,'');
  f.service().scan();assert.equal(f.sql.exec('SELECT COUNT(*) AS n FROM eco_shop_notice_queue')[0].n,0);
  f.sql.exec('UPDATE eco_stock SET receipt=? WHERE hash=?','paid','a');
  f.service().scan();f.service().scan();
  const only=f.sql.exec('SELECT data FROM eco_shop_notice_queue')[0].data;
  assert.match(only,/ÚLTIMA UNIDADE/);assert.doesNotMatch(only,/PRIVATE/);
  f.sql.exec('INSERT INTO eco_code_prices VALUES(?,?,?)','Skin Dragão',750,start);
  f.sql.exec('INSERT INTO eco_code_promotions VALUES(?,?,?)','Skin Dragão',500,start);
  f.service().scan();assert.equal(f.service().stock()[0].price,500);
  f.sql.exec('UPDATE eco_stock SET expires=? WHERE hash=?',start+2*3600000,'b');
  f.service().scan();f.service().scan();
  const data=f.sql.exec('SELECT data FROM eco_shop_notice_queue').map(r=>JSON.parse(r.data));
  assert.deepEqual(data.map(r=>r.type),['last','promotion','expiring']);
  assert(!data.some(r=>JSON.stringify(r).includes('PRIVATE')));
 }finally{f.close()}
});
test('admin notice configuration disables automation and manual announcements group stock without duplicates',()=>{
 const f=fixture();try{
  f.sql.exec('INSERT INTO eco_stock VALUES(?,?,?,?,?,?,?)','a','PRIVATEAAA','Skin Dragão',0,'shop',null,'');
  const service=f.service();service.scan();
  service.saveConfig({last:false,expiring:false,promotion:false,restock:false,soldout:false,free:false});
  assert.equal(service.nextDue(),0);
  const result=service.announce(['Skin Dragão','Skin Dragão']);assert.equal(result.items.length,1);
  assert.throws(()=>service.announce(['Skin Dragão']),{status:429});
  const event=service.pending()[0];assert.equal(event.data.type,'manual');assert.match(event.data.text,/1 disponível/);
  service.delivered(event.id);assert.equal(service.pending().length,0);
  assert.equal(service.nextDue(),0);
 }finally{f.close()}
});
test('shop chat writer preserves stable IDs and cannot publish invalid client text as code',async()=>{
 const data={};const db={recentChat:async()=>Object.fromEntries(Object.entries(data).filter(([k,v])=>k.startsWith('globalChat/messages/')&&v).map(([k,v])=>[k.split('/').at(-1),v])),update:async updates=>Object.assign(data,updates),transact:async(key,fn)=>data[key]=fn(data[key])};
 const at=start,id='00000000-1111-4111-8111-111111111111',notice={id,at,data:{type:'manual',text:'🎁 3 skins disponíveis. Sem códigos privados.'}};
 await chat.publishShopNotice(db,notice);await chat.publishShopNotice(db,notice);
 assert.equal(Object.keys(data).filter(k=>k.startsWith('globalChat/messages/')).length,1);
 assert.equal(Object.values(data).find(v=>v?.kind==='shop-notice').uid,'central-system');
 await assert.rejects(chat.publishShopNotice(db,{...notice,data:{type:'unknown',text:'unsafe'}}),{status:400});
});

test('the last prize removed from the shop sends a distinct notice with optional reason, without sold-out duplication',()=>{
 const f=fixture();try{
  const service=f.service();
  f.sql.exec('INSERT INTO eco_stock VALUES(?,?,?,?,?,?,?)','a','PRIVATEAAA','Skin Dragão',0,'shop',null,'');
  service.scan();service.saveConfig({removed:true,soldout:true});
  f.sql.exec('UPDATE eco_stock SET bucket=? WHERE hash=?','hidden','a');
  service.scan({removed:{title:'Skin Dragão',reason:'Revisão de disponibilidade'}});
  service.scan();
  const data=f.sql.exec('SELECT data FROM eco_shop_notice_queue').map(row=>JSON.parse(row.data));
  assert.equal(data.length,1);
  assert.equal(data[0].type,'removed');
  assert.match(data[0].text,/Motivo: Revisão de disponibilidade/);
  assert.doesNotMatch(data[0].text,/PRIVATEAAA/);
  f.sql.exec('UPDATE eco_stock SET bucket=? WHERE hash=?','shop','a');service.scan();
  f.sql.exec('UPDATE eco_stock SET bucket=? WHERE hash=?','hidden','a');service.scan({removed:{title:'Skin Dragão'}});
  const after=f.sql.exec('SELECT data FROM eco_shop_notice_queue').map(row=>JSON.parse(row.data));
  assert.equal(after.filter(x=>x.type==='removed').length,2);
  assert.match(after.at(-1).text,/não está mais disponível/);
  assert.doesNotMatch(after.at(-1).text,/Motivo:/);
 }finally{f.close();}
});
test('removing only one of two copies does not incorrectly announce a full shop withdrawal',()=>{
 const f=fixture();try{
  f.sql.exec('INSERT INTO eco_stock VALUES(?,?,?,?,?,?,?)','a','PRIVATEAAA','Skin Dragão',0,'shop',null,'');
  f.sql.exec('INSERT INTO eco_stock VALUES(?,?,?,?,?,?,?)','b','PRIVATEBBB','Skin Dragão',0,'shop',null,'');
  const service=f.service();service.scan();service.saveConfig({removed:true});
  f.sql.exec('UPDATE eco_stock SET bucket=? WHERE hash=?','hidden','a');
  service.scan({removed:{title:'Skin Dragão',reason:'Teste'}});
  const data=f.sql.exec('SELECT data FROM eco_shop_notice_queue').map(row=>JSON.parse(row.data));
  assert.deepEqual(data.map(item=>item.type),['last']);
 }finally{f.close()}
});
