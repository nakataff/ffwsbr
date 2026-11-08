'use strict';
// Server-side, bounded event queue for community shop alerts. Public messages never contain private codes.
const DAY=86400000;
const DEFAULTS=Object.freeze({restock:false,last:true,expiring:true,promotion:true,soldout:false,free:false});
const fail=(status,message)=>Object.assign(Error(message),{status});
function init(sql){
 sql.exec(`CREATE TABLE IF NOT EXISTS eco_shop_notice_config(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS eco_shop_notice_state(title TEXT PRIMARY KEY,quantity INTEGER NOT NULL,price INTEGER NOT NULL,discount INTEGER NOT NULL,expires INTEGER NOT NULL,expirySent INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS eco_shop_notice_queue(id TEXT PRIMARY KEY,at INTEGER NOT NULL,data TEXT NOT NULL,sent INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,retryAt INTEGER NOT NULL DEFAULT 0);
 CREATE INDEX IF NOT EXISTS eco_shop_notice_due ON eco_shop_notice_queue(sent,retryAt);`);
}
function create({sql,transaction,now=()=>Date.now()}){
 const rows=(q,...a)=>{const r=sql.exec(q,...a);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
 const settings=()=>({...DEFAULTS,...JSON.parse(rows('SELECT data FROM eco_shop_notice_config WHERE id=?','settings')[0]?.data||'{}')});
 const base=()=>JSON.parse(rows('SELECT data FROM eco_items WHERE id=?','code-default')[0].data).price;
 const stock=()=>rows(`SELECT s.title,COUNT(*) AS quantity,MIN(NULLIF(s.expires,0)) AS expires,p.price AS discount,cp.price AS normal
  FROM eco_stock s LEFT JOIN eco_code_promotions p ON p.title=s.title
  LEFT JOIN eco_code_prices cp ON cp.title=s.title
  WHERE s.receipt IS NULL AND (s.expires=0 OR s.expires>?) AND s.bucket IN ('shop','both','roulette')
  GROUP BY s.title,p.price,cp.price ORDER BY s.title LIMIT 150`,now()).map(row=>{
   const original=row.normal||base(),sale=row.discount&&row.discount<original?row.discount:0;
   return {title:row.title,quantity:row.quantity,expires:row.expires||0,price:sale||original,normalPrice:original,discount:sale};
  });
 function push(type,text,detail={}){
  const at=now(),id=crypto.randomUUID();
  sql.exec('INSERT INTO eco_shop_notice_queue(id,at,data,sent,attempts,retryAt) VALUES(?,?,?,0,0,?)',id,at,JSON.stringify({type,text:String(text).slice(0,460),...detail}),at);
 }
 function scan(){
  return transaction(()=>{
   const config=settings(),current=stock(),prior=rows('SELECT * FROM eco_shop_notice_state'),map=new Map(prior.map(x=>[x.title,x]));
   for(const item of current){
    const previous=map.get(item.title),expirySent=previous?.expires===item.expires?previous.expirySent:0;
    if(previous){
     if(previous.quantity>1&&item.quantity===1&&config.last)push('last','🔥 ÚLTIMA UNIDADE! '+item.title+' · 1 disponível · '+item.price.toLocaleString('pt-BR')+' CFF Coins.',{title:item.title});
     if(previous.quantity===0&&item.quantity>0&&config.restock)push('restock','🎁 VOLTOU À LOJINHA! '+item.title+' · '+item.quantity+' disponível(is) · '+item.price.toLocaleString('pt-BR')+' CFF Coins.',{title:item.title});
     if(item.discount>0&&item.discount!==previous.discount&&config.promotion)push('promotion','🏷️ PROMOÇÃO NA LOJINHA! '+item.title+' · '+item.normalPrice.toLocaleString('pt-BR')+' → '+item.price.toLocaleString('pt-BR')+' CFF Coins · '+item.quantity+' disponível(is).',{title:item.title});
    }
    let sent=expirySent;
    if(config.expiring&&item.expires>now()&&item.expires<=now()+DAY&&expirySent!==item.expires){
     const date=new Date(item.expires).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
     push('expiring','⏰ VALIDADE PRÓXIMA! '+item.title+' · '+item.quantity+' disponível(is) · vence '+date+' (Brasília).',{title:item.title});sent=item.expires;
    }
    sql.exec('INSERT INTO eco_shop_notice_state(title,quantity,price,discount,expires,expirySent) VALUES(?,?,?,?,?,?) ON CONFLICT(title) DO UPDATE SET quantity=excluded.quantity,price=excluded.price,discount=excluded.discount,expires=excluded.expires,expirySent=excluded.expirySent',item.title,item.quantity,item.price,item.discount,item.expires,sent||0);
    map.delete(item.title);
   }
   for(const old of map.values()){
    if(old.quantity>0&&config.soldout)push('soldout','📦 ESGOTOU! '+old.title+' acabou na lojinha. Fique de olho nas próximas reposições.',{title:old.title});
    sql.exec('UPDATE eco_shop_notice_state SET quantity=0,expires=0,expirySent=0 WHERE title=?',old.title);
   }
   return {ok:true,queued:rows('SELECT COUNT(*) AS n FROM eco_shop_notice_queue WHERE sent=0')[0].n};
  });
 }
 function saveConfig(next){
  if(!next||typeof next!=='object'||Object.keys(next).some(k=>!Object.hasOwn(DEFAULTS,k)||typeof next[k]!=='boolean'))throw fail(400,'Configuração inválida.');
  const config={...settings(),...next};
  sql.exec('INSERT INTO eco_shop_notice_config(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data','settings',JSON.stringify(config));
  scan();return {ok:true,settings:config};
 }
 function announce(titles){
  if(!Array.isArray(titles)||!titles.length||titles.length>8||titles.some(t=>typeof t!=='string'||!t.trim()||t.length>100))throw fail(400,'Escolha de 1 a 8 itens da loja.');
  const current=stock(),picked=[...new Set(titles)].map(title=>current.find(item=>item.title===title));
  if(picked.some(x=>!x))throw fail(409,'Algum item está esgotado. Atualize o estoque antes de anunciar.');
  if(rows("SELECT id FROM eco_shop_notice_queue WHERE at>? AND json_extract(data,'$.type')='manual' LIMIT 1",now()-120000).length)throw fail(429,'Espere dois minutos antes de publicar outro anúncio.');
  const lines=picked.map(x=>'• '+x.title+' — '+x.quantity+' disponível(is) · '+x.price.toLocaleString('pt-BR')+' CFF Coins');
  const text='🎁 NOVIDADES NA LOJINHA CFF!\n'+lines.join('\n')+'\nConfira as recompensas na loja.';
  if(text.length>460)throw fail(400,'Selecione menos itens para manter a mensagem legível.');
  push('manual',text,{titles:picked.map(x=>x.title)});
  return {ok:true,items:picked.map(({title,quantity,price})=>({title,quantity,price}))};
 }
 function nextDue(){
  const q=rows('SELECT MIN(retryAt) AS at FROM eco_shop_notice_queue WHERE sent=0 AND attempts<5')[0]?.at||0;
  const exp=settings().expiring?rows('SELECT MIN(expires-?) AS at FROM eco_shop_notice_state WHERE quantity>0 AND expires>? AND expires>expirySent AND expires-?>?',DAY,now(),DAY,now())[0]?.at||0:0;
  // Recheck at the actual expiration too, to notice sold-out and future restocks.
  const finish=rows('SELECT MIN(expires+1000) AS at FROM eco_shop_notice_state WHERE quantity>0 AND expires>?',now())[0]?.at||0;
  const times=[q,exp,finish].filter(Number.isFinite).filter(v=>v>0);return times.length?Math.min(...times):0;
 }
 function pending(){return rows('SELECT * FROM eco_shop_notice_queue WHERE sent=0 AND attempts<5 AND retryAt<=? ORDER BY at LIMIT 3',now()).map(x=>({...x,data:JSON.parse(x.data)}));}
 function delivered(id){sql.exec('UPDATE eco_shop_notice_queue SET sent=1 WHERE id=?',id);}
 function retry(id,attempts){sql.exec('UPDATE eco_shop_notice_queue SET attempts=?,retryAt=? WHERE id=?',attempts,now()+Math.min(3600000,60000*2**attempts),id);}
 return {settings,stock,scan,saveConfig,announce,nextDue,pending,delivered,retry};
}
module.exports={init,create,DEFAULTS};
