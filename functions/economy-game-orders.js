'use strict';
const fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value||'');
const gameId=value=>typeof value==='string'&&/^[1-9][0-9]{5,19}$/.test(value);
function init(sql){sql.exec(`CREATE TABLE IF NOT EXISTS eco_game_orders(id TEXT PRIMARY KEY,uid TEXT NOT NULL,nonce TEXT UNIQUE NOT NULL,item TEXT NOT NULL,data TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','delivered','cancelled','rejected')),at INTEGER NOT NULL,updated_at INTEGER NOT NULL,byuid TEXT NOT NULL,note TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS eco_game_orders_uid ON eco_game_orders(uid,at DESC);
 CREATE INDEX IF NOT EXISTS eco_game_orders_status ON eco_game_orders(status,at DESC);`);}
function create({sql,transaction,credit,now,notify=()=>{}}){
 const rows=(q,...a)=>{const r=sql.exec(q,...a);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
 const view=r=>({id:r.id,uid:r.uid,itemId:r.item,...JSON.parse(r.data),status:r.status,at:r.at,updatedAt:r.updated_at,note:r.note});
 function notice(order){const messages={pending:['Pedido recebido!','Recebemos seu pedido de '+order.title+'. Aguarde o envio no Free Fire.'],delivered:['Seu presente foi enviado no Free Fire!','O envio de '+order.title+' foi confirmado. Confira sua conta no jogo.'],rejected:['Pedido recusado — moedas devolvidas',order.title+': '+order.note+'. As '+order.price+' CFF COINS foram devolvidas à sua carteira.'],cancelled:['Pedido cancelado — moedas devolvidas','Seu pedido de '+order.title+' foi cancelado. As '+order.price+' CFF COINS foram devolvidas à sua carteira.']},[title,body]=messages[order.status];notify({id:'game-order:'+order.id+':'+order.status,uid:order.uid,title,body:body+(order.status==='delivered'&&order.note?' '+order.note:''),url:'/conta.html?tab=points&shopSection=orders',button:'Ver meus pedidos',at:order.updatedAt});}
 function list(uid,body={}){
  const offset=Number(body.offset||0),status=uid?'all':body.status||'pending';if(!Number.isInteger(offset)||offset<0||offset>100000||!['all','pending','delivered','cancelled','rejected'].includes(status))throw fail(400,'Confira o filtro e a página de pedidos.');
  const where=uid?'uid=?':status==='all'?'1=1':'status=?',args=uid?[uid]:status==='all'?[]:[status],total=rows('SELECT COUNT(*) AS n FROM eco_game_orders WHERE '+where,...args)[0].n,selected=rows('SELECT * FROM eco_game_orders WHERE '+where+' ORDER BY at DESC,rowid DESC LIMIT ? OFFSET ?',...args,20,offset);
  const counts=uid?undefined:rows('SELECT status,COUNT(*) AS n FROM eco_game_orders GROUP BY status').reduce((o,r)=>({...o,[r.status]:r.n}),{pending:0,delivered:0,cancelled:0,rejected:0});
  return {ok:true,entries:selected.map(view),offset,limit:20,total,hasMore:offset+selected.length<total,...(counts?{counts}:{})};
 }
 function buy(uid,body,profile){
  if(!uuid(body.nonce)||!gameId(body.gameId))throw fail(400,'Informe um ID numérico do Free Fire com 6 a 20 dígitos e reabra a compra.');
  return transaction(()=>{
   const old=rows('SELECT * FROM eco_game_orders WHERE nonce=?',body.nonce)[0];if(old){if(old.uid!==uid||old.item!==body.itemId||JSON.parse(old.data).gameId!==body.gameId)throw fail(409,'Este pedido já foi registrado com outros dados. Confira seus pedidos.');return {ok:true,order:view(old),duplicate:true};}
   const stored=rows('SELECT data FROM eco_items WHERE id=?',String(body.itemId||''))[0],item=stored?JSON.parse(stored.data):null;
   if(!item?.enabled||item.kind!=='game')throw fail(409,'Este item do jogo não está disponível. Atualize a loja.');
   if(body.expectedPrice!==item.price||body.revision!==item.revision)throw fail(409,'O anúncio foi atualizado. Confira a imagem e o preço novamente. Suas moedas não foram gastas.');
   if(rows("SELECT COUNT(*) AS n FROM eco_game_orders WHERE uid=? AND status='pending'",uid)[0].n>=10)throw fail(400,'Você já tem dez pedidos pendentes. Aguarde uma entrega ou cancele um pedido.');
   const id=crypto.randomUUID(),data={title:item.title,description:item.description,imageUrl:item.imageUrl,price:item.price,gameId:body.gameId,recipientName:String(profile.name).slice(0,80),recipientUsername:String(profile.username).slice(0,24)};
   credit(uid,-item.price,'game_purchase','game-buy:'+id,'Pedido do jogo: '+item.title);
   sql.exec('INSERT INTO eco_game_orders VALUES(?,?,?,?,?,?,?,?,?,?)',id,uid,body.nonce,item.id,JSON.stringify(data),'pending',now(),now(),'','');
   const order=view(rows('SELECT * FROM eco_game_orders WHERE id=?',id)[0]);notice(order);return {ok:true,order};
  });
 }
 function transition(uid,body,adminUid=''){
  if(!uuid(body.orderId))throw fail(400,'Pedido inválido.');
  const desired=adminUid?body.status:'cancelled',note=String(body.note||'').trim();if(adminUid&&!['delivered','rejected'].includes(desired)||note.length>160||desired==='rejected'&&!note)throw fail(400,'Confira a baixa ou informe o motivo da recusa.');
  return transaction(()=>{
   const order=rows('SELECT * FROM eco_game_orders WHERE id=?'+(adminUid?'':' AND uid=?'),body.orderId,...(adminUid?[]:[uid]))[0];if(!order)throw fail(404,'Pedido não encontrado.');
   if(order.status===desired)return {ok:true,order:view(order),duplicate:true};
   if(order.status!=='pending')throw fail(409,'Este pedido já foi '+({delivered:'enviado',cancelled:'cancelado',rejected:'recusado'})[order.status]+'. Atualize a lista.');
   if(desired!=='delivered'){const data=JSON.parse(order.data);credit(order.uid,data.price,'game_refund','game-refund:'+order.id,(desired==='rejected'?'Estorno por recusa: ':'Estorno por cancelamento: ')+data.title,adminUid||uid);}
   sql.exec('UPDATE eco_game_orders SET status=?,updated_at=?,byuid=?,note=? WHERE id=? AND status=?',desired,now(),adminUid||uid,desired==='cancelled'?'Cancelado pelo comprador':note,order.id,'pending');
   const updated=view(rows('SELECT * FROM eco_game_orders WHERE id=?',order.id)[0]);notice(updated);return {ok:true,order:updated};
  });
 }
 return {list,buy,transition};
}
module.exports={init,create,gameId};
