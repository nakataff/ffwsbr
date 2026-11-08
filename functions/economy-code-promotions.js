'use strict';
const fail=(status,message)=>Object.assign(Error(message),{status});
function init(sql){sql.exec(`CREATE TABLE IF NOT EXISTS eco_code_promotions(title TEXT PRIMARY KEY,price INTEGER NOT NULL,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS eco_code_prices(title TEXT PRIMARY KEY,price INTEGER NOT NULL CHECK(price>=1 AND price<=100000),updated INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS eco_stock_choice ON eco_stock(title,receipt,expires);`);}
function effectivePrice(base,sale){return Number.isSafeInteger(sale)&&sale>0&&sale<base?sale:base;}
function create({sql,transaction,now}){
 const rows=(q,...args)=>{const r=sql.exec(q,...args);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
 const basePrice=title=>rows('SELECT price FROM eco_code_prices WHERE title=?',title)[0]?.price||JSON.parse(rows('SELECT data FROM eco_items WHERE id=?','code-default')[0].data).price;
 const available=title=>!!rows('SELECT hash FROM eco_stock WHERE title=? AND receipt IS NULL AND (expires=0 OR expires>?) LIMIT 1',title,now()).length;
 function saveBase(b){
  const title=String(b.title||'').trim(),price=b.normalPrice;
  if(!title||title.length>100||!Number.isSafeInteger(price)||price<1||price>100000)throw fail(400,'Informe um preço normal válido entre 1 e 100.000 CFF Coins.');
  return transaction(()=>{
   if(!available(title))throw fail(409,'Este prêmio não tem códigos disponíveis.');
   sql.exec('INSERT INTO eco_code_prices(title,price,updated) VALUES(?,?,?) ON CONFLICT(title) DO UPDATE SET price=excluded.price,updated=excluded.updated',title,price,now());
   // When the base price falls below an old promotion, discard the invalid discount.
   const sale=rows('SELECT price FROM eco_code_promotions WHERE title=?',title)[0]?.price||0;
   if(sale>=price)sql.exec('DELETE FROM eco_code_promotions WHERE title=?',title);
   return {ok:true,title,originalPrice:price,price:effectivePrice(price,sale),promotion:sale>0&&sale<price};
  });
 }
 function save(b){
  const title=String(b.title||'').trim(),price=b.salePrice;
  if(!title||title.length>100||!Number.isSafeInteger(price)||price<0||price>100000)throw fail(400,'Informe o prêmio e um preço promocional inteiro; deixe vazio para remover.');
  return transaction(()=>{
   const base=basePrice(title);
   if(price&&price>=base)throw fail(400,'A promoção deve custar menos que '+base+' CFF Coins.');
   if(price&&!available(title))throw fail(409,'Este prêmio não tem códigos disponíveis.');
   if(price)sql.exec('INSERT INTO eco_code_promotions(title,price,updated) VALUES(?,?,?) ON CONFLICT(title) DO UPDATE SET price=excluded.price,updated=excluded.updated',title,price,now());
   else sql.exec('DELETE FROM eco_code_promotions WHERE title=?',title);
   return {ok:true,title,originalPrice:base,price:effectivePrice(base,price),promotion:!!price};
  });
 }
 return {save,saveBase,basePrice};
}
module.exports={init,create,effectivePrice};
