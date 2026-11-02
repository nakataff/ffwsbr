'use strict';
// Private, read-only administrative audit of stock codes acquired via CFF COINS or voucher.
// Never expose this report on the public economy or /community/codes endpoints.
const fail=(status,message)=>Object.assign(new Error(message),{status});
const rows=(sql,q,...args)=>{const r=sql.exec(q,...args);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
const validDay=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value+'T12:00:00Z'))
  && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const dayStart=value=>Date.parse(value+'T00:00:00-03:00');

function create({sql}){
 function list(b={}){
  const offset=b.offset??0,source=b.source||'all',query=String(b.query||'').trim(),from=b.from||'',to=b.to||'';
  if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw fail(400,'Página inválida.');
  if(!['all','coins','voucher'].includes(source))throw fail(400,'Forma de pagamento inválida.');
  if(query.length>70)throw fail(400,'Pesquisa muito longa.');
  if(from&&!validDay(from)||to&&!validDay(to)||from&&to&&from>to)throw fail(400,'Confira o intervalo de datas.');
  const filters=["r.kind IN ('redeem','voucher')","json_extract(r.data,'$.stockHash') IS NOT NULL"];
  const args=[];
  if(source!=='all'){filters.push('r.kind=?');args.push(source==='coins'?'redeem':'voucher');}
  if(from){filters.push('r.at>=?');args.push(dayStart(from));}
  if(to){filters.push('r.at<?');args.push(dayStart(to)+86400000);}
  if(query){
   filters.push("(instr(lower(COALESCE(p.username,'')),lower(?))>0 OR instr(lower(COALESCE(p.name,'')),lower(?))>0 OR instr(lower(COALESCE(v.username,'')),lower(?))>0 OR instr(lower(COALESCE(r.uid,'')),lower(?))>0 OR instr(lower(COALESCE(s.title,'')),lower(?))>0 OR instr(lower(COALESCE(s.code,'')),lower(?))>0)");
   args.push(...Array(6).fill(query));
  }
  const joins=" FROM eco_receipts r LEFT JOIN eco_wallet_profiles p ON p.uid=r.uid LEFT JOIN eco_stock s ON s.hash=json_extract(r.data,'$.stockHash') LEFT JOIN eco_code_reservations h ON h.receipt=r.id LEFT JOIN eco_vouchers v ON v.receipt=r.id LEFT JOIN eco_code_returns ret ON ret.receipt=r.id";
  const where=' WHERE '+filters.join(' AND ');
  const agg=rows(sql,"SELECT COUNT(*) AS total,SUM(CASE WHEN r.kind='redeem' THEN 1 ELSE 0 END) AS coins,SUM(CASE WHEN r.kind='voucher' THEN 1 ELSE 0 END) AS vouchers"+joins+where,...args)[0]||{};
  const entries=rows(sql,"SELECT r.id AS receiptId,r.uid,r.at AS acquiredAt,r.kind AS payment,r.status,COALESCE(p.username,v.username,'') AS username,COALESCE(p.name,v.name,'') AS name,COALESCE(s.title,json_extract(r.data,'$.result.label'),'Codiguinho') AS title,COALESCE(s.code,'') AS code,COALESCE(s.hash,json_extract(r.data,'$.stockHash')) AS stockHash,COALESCE(h.openedAt,0) AS openedAt,COALESCE(json_extract(r.data,'$.publicAt'),0) AS publicAt,COALESCE(ret.completed,0) AS returnedAt,COALESCE(v.byuid,'') AS voucherOrigin"+joins+where+" ORDER BY r.at DESC,r.rowid DESC LIMIT 30 OFFSET ?",...args,offset);
  return {ok:true,entries,offset,limit:30,total:Number(agg.total)||0,coins:Number(agg.coins)||0,vouchers:Number(agg.vouchers)||0,hasMore:offset+entries.length<(Number(agg.total)||0)};
 }
 return {list};
}
module.exports={create};
