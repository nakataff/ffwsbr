'use strict';
const {findRecipient}=require('./code-gifts');
const ADMIN='admin@centralfreefire.com.br';
const validUid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const fail=(status,message)=>Object.assign(Error(message),{status});
const read=(sql,q,...a)=>{const r=sql.exec(q,...a);return r.toArray?r.toArray():Array.from(r);};
function init(sql){sql.exec(`CREATE TABLE IF NOT EXISTS eco_account_restrictions(uid TEXT PRIMARY KEY,shop INTEGER NOT NULL,rewards INTEGER NOT NULL,active INTEGER NOT NULL,name TEXT NOT NULL,username TEXT NOT NULL,reason TEXT NOT NULL,revision INTEGER NOT NULL,at INTEGER NOT NULL,byuid TEXT NOT NULL,synced INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS eco_account_restrictions_active ON eco_account_restrictions(active,at DESC,uid);
 CREATE TABLE IF NOT EXISTS eco_account_restriction_audit(nonce TEXT PRIMARY KEY,uid TEXT NOT NULL,request TEXT NOT NULL,data TEXT NOT NULL,at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS eco_account_restriction_history ON eco_account_restriction_audit(uid,at DESC);`);}
function create({sql,transaction,db,notify=()=>{},now=()=>Date.now()}){
 const rows=(q,...a)=>read(sql,q,...a);
 const raw=uid=>rows('SELECT * FROM eco_account_restrictions WHERE uid=?',uid)[0];
 const state=uid=>{const r=raw(uid);return{shop:!!r?.shop,rewards:!!r?.rewards,revision:r?.revision||0,updatedAt:r?.at||0};};
 function assertAllowed(uid,scope){if(!validUid(uid))throw fail(400,'Conta inválida.');if(state(uid)[scope])throw fail(403,scope==='shop'?'Sua conta está bloqueada para novas compras na loja. Entre em contato com @nakataff.':'Esta conta está suspensa das premiações. Entre em contato com @nakataff.');}
 function admin(identity){if(!validUid(identity?.uid)||identity.email!==ADMIN)throw fail(403,'Somente o administrador pode gerenciar bloqueios.');}
 async function detail(uid){if(!validUid(uid))throw fail(400,'Conta inválida.');const p=await db.get('userAccounts/'+uid+'/profile');if(!p?.name||!p.username)throw fail(404,'Conta cadastrada não encontrada.');const r=raw(uid);return{ok:true,recipient:{uid,name:p.name,username:p.username},restriction:{...state(uid),reason:r?.reason||'',synced:r?.synced!==0},history:rows('SELECT data,at FROM eco_account_restriction_audit WHERE uid=? ORDER BY at DESC,rowid DESC LIMIT 10',uid).map(r=>({...JSON.parse(r.data),at:r.at}))};}
 const mirror=(uid,s)=>db.update({['communityRewardRestrictions/'+uid]:{shop:!!s.shop,rewards:!!s.rewards,revision:s.revision,updatedAt:s.at||now()}});
 async function finish(identity,entry){const current=raw(entry.uid),data=JSON.parse(entry.data);if(current?.revision!==data.revision)throw fail(409,'Existe uma alteração mais recente nesta conta. Recarregue antes de continuar.');
  if(!current.synced){try{await mirror(entry.uid,current);}catch{throw fail(503,'A alteração está registrada, mas falta concluir a sincronização dos prêmios de perfil. Tente salvar novamente para concluir.');}transaction(()=>{if(raw(entry.uid)?.revision!==data.revision)throw fail(409,'O bloqueio mudou. Recarregue.');sql.exec('UPDATE eco_account_restrictions SET synced=1 WHERE uid=?',entry.uid);notify({id:'restriction:'+entry.nonce,uid:entry.uid,title:current.active?'Acesso a recompensas atualizado':'Acesso a recompensas liberado',body:current.active?'Sua conta tem restrição em '+[current.shop?'compras na loja':'',current.rewards?'premiações':''].filter(Boolean).join(' e ')+'. Para esclarecimentos, entre em contato com @nakataff.':'Os bloqueios da loja e das premiações foram removidos da sua conta.',url:'/conta.html?tab=points',button:'Ver minha conta',at:entry.at});});}
  return await detail(entry.uid);
 }
 async function manage(identity,b){admin(identity);
  if(b.operation==='restrictionFind'){const r=await findRecipient(db,identity,b.query);return detail(r.recipient.uid);}
  if(b.operation==='restrictionGet')return detail(b.targetUid);
  if(b.operation==='restrictionList'){const offset=b.offset??0;if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw fail(400,'Página inválida.');const all=rows('SELECT uid,shop,rewards,name,username,reason,revision,at,synced FROM eco_account_restrictions WHERE active=1 ORDER BY at DESC,uid LIMIT 21 OFFSET ?',offset);return{ok:true,entries:all.slice(0,20).map(r=>({...r,shop:!!r.shop,rewards:!!r.rewards,synced:!!r.synced})),offset,hasMore:all.length>20};}
  if(b.operation!=='restrictionSet')throw fail(400,'Operação de bloqueio inválida.');
  if(!validUid(b.targetUid)||b.targetUid===identity.uid||typeof b.shop!=='boolean'||typeof b.rewards!=='boolean'||typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>240||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!(/^[a-f0-9-]{36}$/).test(b.nonce||'')||b.confirmed!==true)throw fail(400,b.targetUid===identity.uid?'Você não pode bloquear a própria conta administrativa.':'Confira a pessoa, os bloqueios, o motivo e a confirmação.');
  const request=JSON.stringify({uid:b.targetUid,username:b.expectedUsername,shop:b.shop,rewards:b.rewards,reason:b.reason.trim(),expectedRevision:b.expectedRevision}),old=rows('SELECT * FROM eco_account_restriction_audit WHERE nonce=?',b.nonce)[0];
  if(old){if(old.request!==request)throw fail(409,'Este pedido mudou. Recarregue o controle.');return{...await finish(identity,old),duplicate:true};}
  const p=await db.get('userAccounts/'+b.targetUid+'/profile');if(!p?.name||p.username!==b.expectedUsername)throw fail(409,'A pessoa mudou de @. Pesquise e confirme novamente.');
  const before=raw(b.targetUid);if((before?.revision||0)!==b.expectedRevision)throw fail(409,'O bloqueio mudou em outra janela. Recarregue.');
  // The mirror becomes at least as restrictive before the SQL commit. This
  // closes direct Firebase cosmetic-code claims without per-visitor reads.
  await mirror(b.targetUid,{shop:!!before?.shop||b.shop,rewards:!!before?.rewards||b.rewards,revision:b.expectedRevision+1});
  const entry=transaction(()=>{if((raw(b.targetUid)?.revision||0)!==b.expectedRevision)throw fail(409,'O bloqueio mudou. Recarregue.');const revision=b.expectedRevision+1,at=now(),data={shop:b.shop,rewards:b.rewards,reason:b.reason.trim(),revision,byuid:identity.uid,name:p.name,username:p.username};
   sql.exec('INSERT OR REPLACE INTO eco_account_restrictions VALUES(?,?,?,?,?,?,?,?,?,?,?)',b.targetUid,+b.shop,+b.rewards,+(b.shop||b.rewards),String(p.name).slice(0,80),p.username,data.reason,revision,at,identity.uid,0);
   sql.exec('INSERT INTO eco_account_restriction_audit VALUES(?,?,?,?,?)',b.nonce,b.targetUid,request,JSON.stringify(data),at);return rows('SELECT * FROM eco_account_restriction_audit WHERE nonce=?',b.nonce)[0];});
  return finish(identity,entry);
 }
 return{state,assertAllowed,manage};
}
module.exports={init,create};
