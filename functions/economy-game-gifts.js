'use strict';
const fail=(status,message)=>Object.assign(Error(message),{status});
const active=['sending','unknown','confirmed'];
function init(sql){sql.exec(`CREATE TABLE IF NOT EXISTS eco_game_gifts(order_id TEXT PRIMARY KEY,attempt_id TEXT UNIQUE NOT NULL,state TEXT NOT NULL CHECK(state IN ('prepared','sending','unknown','confirmed','not_sent')),command TEXT NOT NULL,receipt TEXT NOT NULL,at INTEGER NOT NULL,updated_at INTEGER NOT NULL,byuid TEXT NOT NULL);`);}
// No live provider is enabled. A future authorized integration must add its own
// verified receipt and reconciliation implementation; browser success is never proof.
function create({sql,transaction,now,provider,environment}){
 const rows=(q,...a)=>{const r=sql.exec(q,...a);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
 const enabled=()=>{if(environment!=='test'||provider?.mode!=='simulation')throw fail(503,'Envio real bloqueado: integração autorizada com a Garena ainda não configurada.');};
 const find=id=>rows('SELECT * FROM eco_game_gifts WHERE order_id=?',id)[0];
 const view=r=>r?{attemptId:r.attempt_id,state:r.state,quote:JSON.parse(r.command),receipt:r.receipt?JSON.parse(r.receipt):null,updatedAt:r.updated_at}:null;
 const assertPending=id=>{const r=rows('SELECT * FROM eco_game_orders WHERE id=?',id)[0];if(!r)throw fail(404,'Pedido não encontrado.');if(r.status!=='pending')throw fail(409,'Este pedido já foi encerrado.');return {id:r.id,itemId:r.item,...JSON.parse(r.data)};};
 const sender=()=>environment==='test'&&provider?.mode==='simulation'?{ok:true,...provider.sender(),mode:'simulation'}:{ok:true,mode:'blocked',connected:false,message:'Integração real indisponível. Nenhuma credencial será solicitada.'};
 async function connect(){enabled();await provider.connect();return sender();}
 async function prepare(orderId,byuid){enabled();const order=assertPending(orderId),old=find(orderId);if(old&&active.includes(old.state))return {ok:true,delivery:view(old)};
  const quote=await provider.quote(order),attemptId=crypto.randomUUID();
  if(!quote||!Number.isSafeInteger(quote.diamonds)||quote.diamonds<=0||quote.gameId!==order.gameId||quote.orderId!==order.id||quote.revision!==order.revision||typeof quote.revision!=='string'||!quote.revision||typeof quote.sku!=='string'||!quote.sku||typeof quote.senderId!=='string'||!quote.senderId||!Number.isSafeInteger(quote.expiresAt)||quote.expiresAt<=now())throw fail(502,'Cotação inválida. Nenhum envio foi iniciado.');
  return transaction(()=>{assertPending(orderId);const current=find(orderId);if(current&&active.includes(current.state))return {ok:true,delivery:view(current)};
   const command={orderId:order.id,gameId:order.gameId,revision:order.revision,sku:quote.sku,diamonds:quote.diamonds,senderId:quote.senderId,expiresAt:quote.expiresAt,requestId:attemptId,mode:'simulation'};
   sql.exec('INSERT OR REPLACE INTO eco_game_gifts VALUES(?,?,?,?,?,?,?,?)',orderId,attemptId,'prepared',JSON.stringify(command),'',now(),now(),byuid);return {ok:true,delivery:view(find(orderId))};});
 }
 function locked(orderId){const r=find(orderId);return !!r&&active.includes(r.state);}
 function confirmed(orderId){return environment==='test'&&provider?.mode==='simulation'&&find(orderId)?.state==='confirmed';}
 async function record(orderId,result){return transaction(()=>{const r=find(orderId);if(!r||!['sending','unknown'].includes(r.state))return {ok:true,delivery:view(r)};const command=JSON.parse(r.command);
  // Receipt comes from server-side adapter lookup, never from the browser.
  const bound=result?.requestId===command.requestId&&result.orderId===orderId&&result.gameId===command.gameId&&result.sku===command.sku&&result.senderId===command.senderId&&result.diamonds===command.diamonds&&result.mode==='simulation';
  const state=bound&&result.status==='delivered'&&typeof result.receiptId==='string'&&result.receiptId.length>0&&result.receiptId.length<=128&&Number.isSafeInteger(result.deliveredAt)&&result.deliveredAt>=r.at&&result.deliveredAt<=now()?'confirmed':bound&&result.status==='not_sent'?'not_sent':'unknown';
  const receipt=state==='confirmed'?{receiptId:String(result.receiptId).slice(0,128),deliveredAt:result.deliveredAt,requestId:command.requestId,gameId:command.gameId,sku:command.sku,senderId:command.senderId,diamonds:command.diamonds,mode:'simulation'}:null;
  sql.exec('UPDATE eco_game_gifts SET state=?,receipt=?,updated_at=? WHERE order_id=?',state,receipt?JSON.stringify(receipt):'',now(),orderId);return {ok:true,delivery:view(find(orderId))};});}
 async function send(body,byuid){enabled();let command;
  const prior=transaction(()=>{assertPending(body.orderId);const r=find(body.orderId);if(!r||r.attempt_id!==body.attemptId)throw fail(409,'Reabra a confirmação deste pedido.');if(r.state!=='prepared')return {ok:true,delivery:view(r)};
   command=JSON.parse(r.command);if(body.confirmed!==true||body.confirmGameId!==command.gameId||body.expectedDiamonds!==command.diamonds)throw fail(400,'Confirme o ID e o custo em diamantes da cotação.');if(command.expiresAt<=now())throw fail(409,'Cotação expirada. Prepare novamente.');
   sql.exec("UPDATE eco_game_gifts SET state='sending',updated_at=?,byuid=? WHERE order_id=? AND state='prepared'",now(),byuid,body.orderId);return null;});
  if(prior)return prior;
  try{await provider.send(command);}catch{/* Timeout may have spent diamonds. Only lookup can resolve it. */}
  return reconcile(body.orderId);
 }
 async function reconcile(orderId){enabled();const r=find(orderId);if(!r)throw fail(404,'Nenhuma tentativa de envio neste pedido.');if(!['sending','unknown'].includes(r.state))return {ok:true,delivery:view(r)};let result;try{result=await provider.lookup(JSON.parse(r.command));}catch{result=null;}return record(orderId,result);}
 return {sender,connect,prepare,send,reconcile,locked,confirmed,view:orderId=>view(find(orderId))};
}
module.exports={init,create};
