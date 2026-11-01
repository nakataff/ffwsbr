'use strict';
// Private for three minutes, then public. The original payment is never refunded
// by this policy and published codes remain assigned, outside the shop stock.
const WINDOW=180000,MAX_MONTH=2;
const fail=(status,message)=>Object.assign(Error(message),{status});
const rewardKey=v=>{const text=String(v||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();return text.replace(/[^\p{L}\p{N}]/gu,'')||text.trim();};
const read=(sql,q,...a)=>{const r=sql.exec(q,...a);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
function init(sql){sql.exec(`CREATE TABLE IF NOT EXISTS eco_code_reservations(receipt TEXT PRIMARY KEY,uid TEXT NOT NULL,gift TEXT NOT NULL UNIQUE,deadline INTEGER NOT NULL,status TEXT NOT NULL,openedAt INTEGER NOT NULL DEFAULT 0,word TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS eco_code_reservations_due ON eco_code_reservations(status,deadline);
 CREATE INDEX IF NOT EXISTS eco_code_reservations_uid ON eco_code_reservations(uid,status);
 CREATE TABLE IF NOT EXISTS eco_public_codes(receipt TEXT PRIMARY KEY,data TEXT NOT NULL,at INTEGER NOT NULL,chatSent INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,retryAt INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS eco_public_codes_latest ON eco_public_codes(at DESC);
 CREATE INDEX IF NOT EXISTS eco_public_codes_chat ON eco_public_codes(chatSent,retryAt);`);}
function nextDeadline(sql){const held=read(sql,"SELECT deadline FROM eco_code_reservations WHERE status='held' ORDER BY deadline LIMIT 1")[0]?.deadline||0,chat=read(sql,'SELECT retryAt FROM eco_public_codes WHERE chatSent=0 ORDER BY retryAt LIMIT 1')[0]?.retryAt||0;const times=[held,chat].filter(Boolean);return times.length?Math.min(...times):0;}
const publicFeed=sql=>({ok:true,entries:read(sql,'SELECT data FROM eco_public_codes ORDER BY at DESC LIMIT 20').map(r=>JSON.parse(r.data))});
function create({sql,transaction,notify,now,dayKey}){
 const rows=(q,...a)=>read(sql,q,...a);
 const info=receipt=>rows('SELECT * FROM eco_code_reservations WHERE receipt=?',receipt)[0];
 const byGift=(uid,gift)=>rows('SELECT * FROM eco_code_reservations WHERE gift=? AND uid=?',gift,uid)[0];
 function releaseDue(){return transaction(()=>{
  const due=rows("SELECT * FROM eco_code_reservations WHERE status='held' AND deadline<=? ORDER BY deadline LIMIT 100",now());
  for(const hold of due){
   const r=rows('SELECT * FROM eco_receipts WHERE id=?',hold.receipt)[0],data=r&&JSON.parse(r.data),s=r&&rows('SELECT * FROM eco_stock WHERE hash=? AND receipt=?',data.stockHash,r.id)[0];
   const canPublish=r&&['pending','done'].includes(r.status)&&s;
   if(canPublish){
    const publication={id:r.id,title:s.title,code:s.code,imageUrl:s.image||'/edition/gift.webp',expiresAt:s.expires||0,at:now()};
    sql.exec('INSERT OR IGNORE INTO eco_public_codes(receipt,data,at,retryAt) VALUES(?,?,?,?)',r.id,JSON.stringify(publication),publication.at,now());
    data.publicAt=publication.at;sql.exec('UPDATE eco_receipts SET data=? WHERE id=?',JSON.stringify(data),r.id);
    notify({id:'code-public:'+r.id,uid:r.uid,title:'Seu codiguinho foi divulgado',body:data.result.label+' passou do prazo exclusivo de 3 minutos e agora está público. Não há estorno das moedas ou do vale.',url:'/interacoes.html#codiguinhos-publicos',button:'Ver códigos públicos',at:now()});
   }
   sql.exec('UPDATE eco_code_reservations SET status=? WHERE receipt=? AND status=?',canPublish?'released':'cancelled',hold.receipt,'held');
  }
  return due.length;
 });}
 function limits(uid){
  const month=dayKey(now()).slice(0,7),start=Date.parse(month+'-01T00:00:00-03:00'),[y,m]=month.split('-').map(Number),end=Date.parse(new Date(Date.UTC(y,m,1)).toISOString().slice(0,10)+'T00:00:00-03:00');
  const condition="uid=? AND kind IN ('redeem','voucher') AND status NOT IN ('returned','returning') AND json_extract(data,'$.stockHash') IS NOT NULL";
  const used=rows('SELECT COUNT(*) AS n FROM eco_receipts WHERE '+condition+' AND at>=? AND at<?',uid,start,end)[0].n;
  const claimedKeys=[...new Set(rows('SELECT data FROM eco_receipts WHERE '+condition,uid).map(r=>rewardKey(JSON.parse(r.data).result?.label)).filter(Boolean))];
  return {month,used,limit:MAX_MONTH,remaining:Math.max(0,MAX_MONTH-used),exclusiveSeconds:WINDOW/1000,claimedKeys,active:rows("SELECT h.gift,h.deadline,h.openedAt,r.data FROM eco_code_reservations h JOIN eco_receipts r ON r.id=h.receipt WHERE h.uid=? AND h.status='held' AND r.status IN ('pending','done') ORDER BY h.deadline LIMIT 2",uid).map(r=>({giftId:r.gift,reservationUntil:r.deadline,opened:!!r.openedAt,title:JSON.parse(r.data).result.label}))};
 }
 function check(uid,title){const p=limits(uid);if(p.remaining===0)throw fail(403,'Limite de 2 codiguinhos por mês atingido. Moedas e vales contam juntos, no horário de Brasília.');if(p.claimedKeys.includes(rewardKey(title)))throw fail(403,'Você já resgatou este prêmio. Escolha um codiguinho diferente; códigos do mesmo prêmio não podem ser repetidos na conta.');}
 function reserve(receipt,uid,gift){const words=['FLUXO','LOUD','BOOYAH','CENTRAL','TROPA','CAPA'];sql.exec("INSERT INTO eco_code_reservations(receipt,uid,gift,deadline,status,word) VALUES(?,?,?,?,'held',?)",receipt,uid,gift,now()+WINDOW,words[crypto.getRandomValues(new Uint32Array(1))[0]%words.length]);}
 function open(uid,gift,confirmWord){
  releaseDue();
  return transaction(()=>{const hold=byGift(uid,gift);if(!hold)return null;
   const receipt=rows('SELECT * FROM eco_receipts WHERE id=? AND uid=?',hold.receipt,uid)[0];
   if(!receipt||['returned','returning'].includes(receipt.status))throw fail(410,'Este presente foi devolvido pela administração.');
   if(receipt.status!=='done')throw fail(409,'A entrega ainda precisa ser concluída. Confira a loja.');
   const data=JSON.parse(receipt.data),stock=rows('SELECT * FROM eco_stock WHERE hash=? AND receipt=?',data.stockHash,hold.receipt)[0];
   if(!stock)throw fail(409,'Este presente não está mais disponível.');
   if(hold.status==='held'&&!hold.openedAt){if(confirmWord===undefined)return {confirmation:{word:hold.word,reservationUntil:hold.deadline}};if(typeof confirmWord!=='string'||confirmWord.trim().toUpperCase()!==hold.word)throw fail(400,'Digite a palavra exibida para confirmar que leu o prazo de 3 minutos.');}
   const openedAt=hold.openedAt||now();if(!hold.openedAt)sql.exec('UPDATE eco_code_reservations SET openedAt=? WHERE receipt=?',openedAt,hold.receipt);
   return {hold:{...hold,openedAt},receipt,data,stock};
  });
 }
 return {info,byGift,releaseDue,limits,check,reserve,open};
}
module.exports={init,create,nextDeadline,publicFeed,rewardKey,WINDOW,MAX_MONTH};
