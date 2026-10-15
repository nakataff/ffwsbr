'use strict';
const media=require('./economy-media');
const fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
function init(sql){
 sql.exec(`CREATE TABLE IF NOT EXISTS eco_vouchers(id TEXT PRIMARY KEY,nonce TEXT UNIQUE NOT NULL,uid TEXT NOT NULL,username TEXT NOT NULL,name TEXT NOT NULL,expires INTEGER NOT NULL,at INTEGER NOT NULL,byuid TEXT NOT NULL,message TEXT NOT NULL,receipt TEXT,revokedAt INTEGER NOT NULL DEFAULT 0,revokedBy TEXT NOT NULL DEFAULT '',reason TEXT NOT NULL DEFAULT '');
 CREATE INDEX IF NOT EXISTS eco_vouchers_uid ON eco_vouchers(uid,expires);
 CREATE INDEX IF NOT EXISTS eco_vouchers_at ON eco_vouchers(at DESC);`);
}
function create({sql,transaction,db,eligible,now}){
 const rows=(q,...args)=>{const r=sql.exec(q,...args);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
 const config=()=>JSON.parse(rows('SELECT data FROM eco_settings WHERE id=?','voucher-config')[0]?.data||'{"imageUrl":"/edition/gift.webp"}');
 const status=r=>r.receipt?(r.deliveryStatus==='pending'?'reserved':'used'):r.revokedAt?'revoked':r.expires<=now()?'expired':'available';
 const publicRow=r=>({id:r.id,username:r.username,name:r.name,expiresAt:r.expires,sentAt:r.at,message:r.message,status:status(r),usedAt:r.usedAt||0,revokedAt:r.revokedAt||0,reason:r.reason||'',...(r.prize?{prize:r.prize}:{})});
 const joined=`SELECT v.*,r.status AS deliveryStatus,r.at AS usedAt,json_extract(r.data,'$.result.label') AS prize FROM eco_vouchers v LEFT JOIN eco_receipts r ON r.id=v.receipt`;
 function state(uid){return {config:config(),availableCount:rows('SELECT COUNT(*) AS n FROM eco_vouchers WHERE uid=? AND receipt IS NULL AND revokedAt=0 AND expires>?',uid,now())[0].n,next:rows(joined+' WHERE v.uid=? AND v.receipt IS NULL AND v.revokedAt=0 AND v.expires>? ORDER BY v.expires,v.at,v.id LIMIT 1',uid,now()).map(publicRow)[0]||null,entries:rows(joined+' WHERE v.uid=? ORDER BY v.at DESC,v.rowid DESC LIMIT 20',uid).map(publicRow)};}
 function consume(uid,id,receipt){
  if(!uuid(id))throw fail(400,'Escolha novamente um Vale Codiguinho na loja.');
  const row=rows('SELECT * FROM eco_vouchers WHERE id=? AND uid=?',id,uid)[0];
  if(!row||row.receipt||row.revokedAt||row.expires<=now())throw fail(409,'Este vale já foi usado, cancelado ou expirou. Atualize a loja.');
  sql.exec('UPDATE eco_vouchers SET receipt=? WHERE id=? AND uid=? AND receipt IS NULL AND revokedAt=0',receipt,id,uid);
 }
 async function recipient(value){const username=String(value||'').trim().replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_]{3,24}$/.test(username))throw fail(400,'Informe o @ de usuário da Central Free Fire.');const uid=await db.get('communityUsernames/'+username);if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw fail(404,'Usuário não encontrado. Use o @ cadastrado no site.');const p=await eligible(uid);if(p.username!==username)throw fail(409,'O @ mudou. Pesquise a pessoa novamente.');return {uid,name:p.name,username:p.username};}
 async function admin(identity,b){
  if(b.operation==='voucherConfig')return {ok:true,config:config()};
  if(b.operation==='saveVoucherConfig'){const imageUrl=await media.imageUrl(sql,b.imageUrl);if(!imageUrl)throw fail(400,'Escolha uma imagem para o Vale Codiguinho.');sql.exec('INSERT OR REPLACE INTO eco_settings VALUES(?,?)','voucher-config',JSON.stringify({imageUrl}));return {ok:true,config:config()};}
  if(b.operation==='findVoucherRecipient')return {ok:true,recipient:await recipient(b.username)};
  if(b.operation==='grantVoucher'){
   if(!uuid(b.nonce)||(typeof b.targetUid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(b.targetUid))||!Number.isSafeInteger(b.expiresAt)||typeof b.message!=='string'||b.message.length>160)throw fail(400,'Confira o destinatário, a validade e a mensagem do vale.');
   const previous=()=>rows(joined+' WHERE v.nonce=?',b.nonce)[0];
   const matches=r=>{if(r.uid!==b.targetUid||r.username!==b.expectedUsername||r.expires!==b.expiresAt||r.message!==b.message.trim())throw fail(409,'Este envio já foi registrado com outros dados. Confira o histórico.');return {ok:true,voucher:publicRow(r),duplicate:true};};
   if(previous())return matches(previous());
   const p=await eligible(b.targetUid);if(p.username!==b.expectedUsername)throw fail(409,'O destinatário mudou. Pesquise e confira o @ novamente.');
   if(b.expiresAt<=now())throw fail(400,'A validade do vale deve estar no futuro.');
   return transaction(()=>{const old=previous();if(old)return matches(old);if(b.expiresAt<=now())throw fail(400,'A validade do vale deve estar no futuro.');const id=crypto.randomUUID();sql.exec('INSERT INTO eco_vouchers(id,nonce,uid,username,name,expires,at,byuid,message) VALUES(?,?,?,?,?,?,?,?,?)',id,b.nonce,b.targetUid,p.username,p.name,b.expiresAt,now(),identity.uid,b.message.trim());return {ok:true,voucher:publicRow(rows('SELECT * FROM eco_vouchers WHERE id=?',id)[0])};});
  }
  if(b.operation==='listVouchers'){
   const offset=b.offset??0,filter=b.status||'all';if(!Number.isSafeInteger(offset)||offset<0||!['all','available','used','reserved','expired','revoked'].includes(filter))throw fail(400,'Confira o filtro de vales.');
   const condition={all:'1=1',available:'v.receipt IS NULL AND v.revokedAt=0 AND v.expires>?',expired:'v.receipt IS NULL AND v.revokedAt=0 AND v.expires<=?',revoked:'v.receipt IS NULL AND v.revokedAt>0',used:"v.receipt IS NOT NULL AND r.status='done'",reserved:"v.receipt IS NOT NULL AND r.status='pending'"}[filter],args=['available','expired'].includes(filter)?[now()]:[],total=rows('SELECT COUNT(*) AS n FROM eco_vouchers v LEFT JOIN eco_receipts r ON r.id=v.receipt WHERE '+condition,...args)[0].n;
   return {ok:true,entries:rows(joined+' WHERE '+condition+' ORDER BY v.at DESC,v.rowid DESC LIMIT 20 OFFSET ?',...args,offset).map(publicRow),offset,limit:20,total,hasMore:offset+20<total,status:filter};
  }
  if(b.operation==='revokeVoucher'){
   if(!uuid(b.id)||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>160)throw fail(400,'Informe o motivo do cancelamento.');
   return transaction(()=>{const row=rows('SELECT * FROM eco_vouchers WHERE id=?',b.id)[0];if(!row)throw fail(404,'Vale não encontrado.');if(row.receipt)throw fail(409,'Este vale já foi trocado. O codiguinho está reservado para a pessoa.');if(!row.revokedAt)sql.exec('UPDATE eco_vouchers SET revokedAt=?,revokedBy=?,reason=? WHERE id=?',now(),identity.uid,b.reason.trim(),b.id);return {ok:true};});
  }
  throw fail(400,'Operação de vale inválida.');
 }
 return {state,consume,admin};
}
module.exports={init,create};
