'use strict';
const fail=(status,message)=>Object.assign(Error(message),{status});
function init(sql){sql.exec(`CREATE TABLE IF NOT EXISTS eco_code_promotions(title TEXT PRIMARY KEY,price INTEGER NOT NULL,updated INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS eco_stock_choice ON eco_stock(title,receipt,expires);`);}
function effectivePrice(base,sale){return Number.isSafeInteger(sale)&&sale>0&&sale<base?sale:base;}
function create({sql,transaction,now}){
 const rows=(q,...args)=>{const r=sql.exec(q,...args);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
 function save(b){
  const title=String(b.title||'').trim(),price=b.salePrice;
  if(!title||title.length>100||!Number.isSafeInteger(price)||price<0||price>100000)throw fail(400,'Informe o prêmio e um preço promocional inteiro; deixe vazio para remover a promoção.');
  return transaction(()=>{const base=JSON.parse(rows('SELECT data FROM eco_items WHERE id=?','code-default')[0].data).price;
   if(price&&price>=base)throw fail(400,'A promoção deve custar menos que o preço normal de '+base+' CFF COINS.');
   if(price&&!rows('SELECT hash FROM eco_stock WHERE title=? AND receipt IS NULL AND (expires=0 OR expires>?) LIMIT 1',title,now()).length)throw fail(409,'Este prêmio não tem códigos disponíveis. Atualize o estoque.');
   if(price)sql.exec('INSERT INTO eco_code_promotions(title,price,updated) VALUES(?,?,?) ON CONFLICT(title) DO UPDATE SET price=excluded.price,updated=excluded.updated',title,price,now());else sql.exec('DELETE FROM eco_code_promotions WHERE title=?',title);
   return {ok:true,title,originalPrice:base,price:effectivePrice(base,price),promotion:!!price};
  });
 }
 return {save};
}
module.exports={init,create,effectivePrice};
