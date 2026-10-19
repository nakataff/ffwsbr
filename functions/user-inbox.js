'use strict';
// Broadcasts are shared rows. There is no per-user fan-out, timer or account scan.
const ADMIN='admin@centralfreefire.com.br',PAGE=20,shared=new WeakMap();
const fail=(status,message)=>Object.assign(Error(message),{status});
const validUid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
function init(sql){sql.exec(`
 CREATE TABLE IF NOT EXISTS user_inbox_messages(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,audience TEXT NOT NULL,category TEXT NOT NULL,dispatch TEXT NOT NULL DEFAULT '',at INTEGER NOT NULL,expires INTEGER NOT NULL DEFAULT 0,revoked INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS user_inbox_audience ON user_inbox_messages(audience,seq DESC);
 CREATE INDEX IF NOT EXISTS user_inbox_category ON user_inbox_messages(audience,category,seq DESC);
 CREATE INDEX IF NOT EXISTS user_inbox_dispatch ON user_inbox_messages(dispatch);
 CREATE TABLE IF NOT EXISTS user_inbox_heads(audience TEXT PRIMARY KEY,seq INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS user_inbox_state(uid TEXT PRIMARY KEY,opened INTEGER NOT NULL DEFAULT 0,readThrough INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS user_inbox_marks(uid TEXT NOT NULL,seq INTEGER NOT NULL,isRead INTEGER NOT NULL DEFAULT 0,archived INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(uid,seq));
 CREATE INDEX IF NOT EXISTS user_inbox_archived ON user_inbox_marks(uid,archived,seq DESC);
 CREATE TABLE IF NOT EXISTS user_inbox_grants(nonce TEXT PRIMARY KEY,request TEXT NOT NULL,data TEXT NOT NULL,done INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS user_inbox_dispatches(seq INTEGER PRIMARY KEY AUTOINCREMENT,nonce TEXT UNIQUE NOT NULL,request TEXT NOT NULL,data TEXT NOT NULL,at INTEGER NOT NULL,byuid TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
 `);}
function create({sql,transaction,db,now=()=>Date.now()}){
 const rows=(q,...a)=>{const r=sql.exec(q,...a);return r.toArray?r.toArray():Array.from(r);};
 if(!shared.has(sql))shared.set(sql,new Map());const cache=shared.get(sql);
 function identity(user){if(!validUid(user?.uid))throw fail(401,'Entre com sua conta para abrir a caixa de entrada.');return user.uid;}
 function admin(user){identity(user);if(user.email!==ADMIN)throw fail(403,'Somente o administrador pode enviar comunicados.');}
 function summary(uid){
  const r=rows(`SELECT COALESCE((SELECT seq FROM user_inbox_heads WHERE audience=?),0) AS personal,COALESCE((SELECT seq FROM user_inbox_heads WHERE audience='*'),0) AS global,COALESCE((SELECT opened FROM user_inbox_state WHERE uid=?),0) AS opened`,uid,uid)[0];
  const latest=Math.max(r.personal,r.global);return {hasNew:latest>r.opened,latest};
 }
 function add({id,uid,category='reward',title,body='',url='',button='',expiresAt=0,at=now(),dispatch='',priority='normal'}){
  if(!validUid(uid)&&uid!=='*'||typeof id!=='string'||!id||id.length>240)throw fail(400,'Aviso inválido.');
  const data={title:String(title).slice(0,100),body:String(body).slice(0,1600),url:safeUrl(url),button:String(button).slice(0,40),priority:priority==='important'?'important':'normal'};
  sql.exec('INSERT OR IGNORE INTO user_inbox_messages(id,audience,category,dispatch,at,expires,data) VALUES(?,?,?,?,?,?,?)',id,uid,category,dispatch,at,expiresAt,JSON.stringify(data));
  const row=rows('SELECT seq FROM user_inbox_messages WHERE id=?',id)[0];
  sql.exec('INSERT INTO user_inbox_heads(audience,seq) VALUES(?,?) ON CONFLICT(audience) DO UPDATE SET seq=MAX(seq,excluded.seq)',uid,row.seq);
  if(uid==='*')cache.clear();return row.seq;
 }
 function reward(input){return add({...input,category:'reward'});}
 function cursor(value){if(value==null||value==='')return Number.MAX_SAFE_INTEGER;if(!Number.isSafeInteger(value)||value<1)throw fail(400,'Página inválida.');return value;}
 function base(audience,before,category){
  const key=before+':'+category,cached=audience==='*'&&cache.get(key);if(cached&&now()-cached.at<60000)return cached.rows;
  const result=category==='all'?rows('SELECT * FROM user_inbox_messages WHERE audience=? AND seq<? ORDER BY seq DESC LIMIT 21',audience,before):rows('SELECT * FROM user_inbox_messages WHERE audience=? AND category=? AND seq<? ORDER BY seq DESC LIMIT 21',audience,category,before);
  if(audience==='*'){if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,{at:now(),rows:result});}return result;
 }
 function publicRow(r,state={}){return {id:r.seq,category:r.category,scope:r.audience==='*'?'all':'personal',sentAt:r.at,expiresAt:r.expires,read:r.seq<=state.readThrough||!!r.isRead,archived:!!r.archived,...JSON.parse(r.data)};}
 function visible(r){return !r.revoked&&(!r.expires||r.expires>now());}
 function list(uid,b){
  const before=cursor(b.before),category=b.category||'all',archived=b.archived===true;if(!['all','reward','notice'].includes(category)||b.archived!=null&&typeof b.archived!=='boolean')throw fail(400,'Filtro inválido.');
  return transaction(()=>{
   const snapshot=summary(uid).latest,state=rows('SELECT * FROM user_inbox_state WHERE uid=?',uid)[0]||{readThrough:0};let candidates;
   if(archived){candidates=rows(`SELECT m.*,k.isRead,k.archived FROM user_inbox_marks k JOIN user_inbox_messages m ON m.seq=k.seq WHERE k.uid=? AND k.archived=1 AND k.seq<? ORDER BY k.seq DESC LIMIT 21`,uid,before).filter(r=>r.audience==='*'||r.audience===uid);}
   else candidates=[...base(uid,before,category),...base('*',before,category)].sort((a,b)=>b.seq-a.seq);
   const taken=candidates.slice(0,PAGE),marks=new Map();
   for(const r of taken){const m=archived?r:rows('SELECT isRead,archived FROM user_inbox_marks WHERE uid=? AND seq=?',uid,r.seq)[0];if(m)marks.set(r.seq,m);}
   const entries=taken.filter(r=>visible(r)&&(category==='all'||r.category===category)&&!!marks.get(r.seq)?.archived===archived).map(r=>publicRow({...r,...marks.get(r.seq)},state));
   if(before===Number.MAX_SAFE_INTEGER)sql.exec('INSERT INTO user_inbox_state(uid,opened) VALUES(?,?) ON CONFLICT(uid) DO UPDATE SET opened=MAX(opened,excluded.opened)',uid,snapshot);
   return {ok:true,entries,hasMore:candidates.length>PAGE,nextCursor:candidates.length>PAGE?taken.at(-1).seq:null,snapshot,summary:summary(uid)};
  });
 }
 function accessible(uid,id){if(!Number.isSafeInteger(id)||id<1)throw fail(400,'Mensagem inválida.');const row=rows('SELECT * FROM user_inbox_messages WHERE seq=?',id)[0];if(!row||row.audience!=='*'&&row.audience!==uid||!visible(row))throw fail(404,'Mensagem indisponível.');return row;}
 function mark(uid,b){return transaction(()=>{
  if(b.operation==='inboxReadAll'){
   if(!Number.isSafeInteger(b.through)||b.through<0||b.through>summary(uid).latest)throw fail(400,'Atualize a caixa antes de marcar as mensagens.');
   sql.exec('INSERT INTO user_inbox_state(uid,opened,readThrough) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET opened=MAX(opened,excluded.opened),readThrough=MAX(readThrough,excluded.readThrough)',uid,b.through,b.through);
  }else{
   accessible(uid,b.id);if(b.operation==='inboxArchive'&&typeof b.archived!=='boolean')throw fail(400,'Organização inválida.');
   if(b.operation==='inboxRead')sql.exec('INSERT INTO user_inbox_marks(uid,seq,isRead) VALUES(?,?,1) ON CONFLICT(uid,seq) DO UPDATE SET isRead=1',uid,b.id);
   else sql.exec('INSERT INTO user_inbox_marks(uid,seq,isRead,archived) VALUES(?,?,1,?) ON CONFLICT(uid,seq) DO UPDATE SET isRead=1,archived=excluded.archived',uid,b.id,b.archived?1:0);
  }
  return {ok:true,summary:summary(uid)};
 });}
 async function grantProfile(user,b){
  admin(user);const uid=b.targetUid,message=String(b.message||'').trim(),week=String(b.week||'');
  if(!validUid(uid)||!uuid(b.nonce)||typeof b.assetId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(b.assetId)||message.length>160||week&&!/^\d{4}-\d{2}-\d{2}$/.test(week)||typeof b.gift!=='boolean')throw fail(400,'Confira a pessoa, o item e a mensagem.');
  const request=JSON.stringify({uid,assetId:b.assetId,message,week,gift:b.gift,expectedUsername:b.expectedUsername||''});
  let saved=rows('SELECT * FROM user_inbox_grants WHERE nonce=?',b.nonce)[0];
  if(saved&&saved.request!==request)throw fail(409,'Este envio já foi usado com outros dados.');if(saved?.done)return {ok:true,duplicate:true};
  if(!saved){
   const [p,item]=await Promise.all([db.get('userAccounts/'+uid+'/profile'),db.get('communityProfileCatalog/'+b.assetId)]);
   if(!p?.name||!p.username||b.expectedUsername&&p.username!==b.expectedUsername)throw fail(409,'Pesquise e confirme o destinatário novamente.');
   if(!item?.enabled||!['badge','avatar','cover','frame'].includes(item.kind)||item.accessRule==='admin')throw fail(400,'Escolha uma recompensa ativa.');
   const grantedAt=now(),changes={},giftId='gift-'+b.nonce,grantId='grant-'+b.nonce;
   if(item.kind==='badge'){changes['communityBadgeGrants/'+uid+'/'+grantId]={badgeId:b.assetId,reason:message,week,grantedAt,status:'active'};changes['communityBadgeOwnership/'+uid+'/'+b.assetId]=true;}
   else changes['communityImageOwnership/'+uid+'/'+b.assetId]={source:'admin',grantedAt};
   if(b.gift)changes['communityGifts/'+uid+'/'+giftId]={assetId:b.assetId,kind:item.kind,message,grantedAt};
   const notice={id:'grant:'+b.nonce,uid,title:'Você recebeu '+({badge:'uma insígnia',avatar:'um avatar',cover:'uma capa',frame:'uma moldura'}[item.kind])+'!',body:item.title+(message?' — '+message:''),url:'/conta.html?tab=inventory&section='+(b.gift?'gifts':{badge:'badges',avatar:'avatars',cover:'covers',frame:'frames'}[item.kind]),button:'Ver no inventário',at:grantedAt};
   sql.exec('INSERT OR IGNORE INTO user_inbox_grants(nonce,request,data) VALUES(?,?,?)',b.nonce,request,JSON.stringify({changes,notice}));saved=rows('SELECT * FROM user_inbox_grants WHERE nonce=?',b.nonce)[0];if(saved.request!==request)throw fail(409,'Este envio mudou.');
  }
  const data=JSON.parse(saved.data);await db.update(data.changes);
  transaction(()=>{reward(data.notice);sql.exec('UPDATE user_inbox_grants SET done=1 WHERE nonce=?',b.nonce);});return {ok:true};
 }
 async function notifyProfile(user,b){
  admin(user);const uid=b.targetUid;if(!validUid(uid)||typeof b.ref!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(b.ref)||!['gift','badge','image'].includes(b.kind))throw fail(400,'Recompensa inválida.');
  const path={gift:'communityGifts/',badge:'communityBadgeGrants/',image:'communityImageOwnership/'}[b.kind],saved=await db.get(path+uid+'/'+b.ref);
  if(!saved||b.kind==='badge'&&saved.status!=='active')throw fail(404,'A recompensa ainda não foi entregue.');
  const assetId=b.kind==='image'?b.ref:saved.assetId||saved.badgeId,item=await db.get('communityProfileCatalog/'+assetId);if(!item)throw fail(404,'Item não encontrado.');
  transaction(()=>reward({id:'profile:'+uid+':'+b.kind+':'+b.ref+':'+(saved.grantedAt||0),uid,title:'Você recebeu '+({badge:'uma insígnia',avatar:'um avatar',cover:'uma capa',frame:'uma moldura'}[item.kind]||'um presente')+'!',body:item.title+(saved.message||saved.reason?' — '+(saved.message||saved.reason):''),url:'/conta.html?tab=inventory&section='+({badge:'badges',avatar:'avatars',cover:'covers',frame:'frames'}[item.kind]||'gifts'),button:'Ver no inventário',at:saved.grantedAt||now()}));
  return {ok:true};
 }
 async function handle(user,b){const uid=identity(user);if(user.provider&&user.provider!=='google.com'&&user.email!==ADMIN)throw fail(403,'Entre com Google.');
  if(b.operation==='inboxList')return list(uid,b);
  if(['inboxRead','inboxArchive','inboxReadAll'].includes(b.operation))return mark(uid,b);
  if(b.operation==='inboxSummary')return {ok:true,summary:summary(uid)};
  throw fail(400,'Operação de mensagem inválida.');
 }
 function form(b,allowExpired=false){
  const title=String(b.title||'').trim(),body=String(b.body||'').trim(),button=String(b.button||'').trim(),url=safeUrl(b.url),priority=b.priority||'normal',expiresAt=b.expiresAt||0;
  if(!title||title.length>100||!body||body.length>1600||button.length>40||!['normal','important'].includes(priority)||!Number.isSafeInteger(expiresAt)||expiresAt&&expiresAt<=now()&&!allowExpired||!!url!==!!button)throw fail(400,'Confira título, mensagem, botão e validade futura.');
  return {title,body,url,button,priority,expiresAt};
 }
 async function manage(user,b){admin(user);
  if(b.operation==='inboxGrantReward')return grantProfile(user,b);
  if(b.operation==='inboxNotifyReward')return notifyProfile(user,b);
  if(b.operation==='inboxHistory'){
   const result=rows('SELECT * FROM user_inbox_dispatches WHERE seq<? ORDER BY seq DESC LIMIT 21',cursor(b.before));return {ok:true,entries:result.slice(0,PAGE).map(r=>({id:r.nonce,seq:r.seq,sentAt:r.at,revoked:!!r.revoked,...JSON.parse(r.data)})),nextCursor:result.length>PAGE?result[PAGE-1].seq:null};
  }
  if(b.operation==='inboxSend'){
   if(!uuid(b.nonce)||!['all','selected'].includes(b.audience))throw fail(400,'Confira os destinatários.');
   const original=rows('SELECT * FROM user_inbox_dispatches WHERE nonce=?',b.nonce)[0];
   const fields=form(b,!!original),names=b.audience==='all'?[]:[...new Set((Array.isArray(b.usernames)?b.usernames:[]).map(v=>String(v).trim().replace(/^@/,'').toLowerCase()))].sort();
   if(b.audience==='selected'&&(!names.length||names.length>20||names.some(n=>!/^[a-z0-9_]{3,24}$/.test(n))))throw fail(400,'Informe de 1 a 20 @ de usuários do site.');
   const request=JSON.stringify({...fields,audience:b.audience,names}),previous=rows('SELECT * FROM user_inbox_dispatches WHERE nonce=?',b.nonce)[0];
   const duplicate=r=>{if(r.request!==request)throw fail(409,'Este envio já foi usado com outros dados. Prepare uma nova mensagem.');return {ok:true,id:r.nonce,duplicate:true};};if(previous)return duplicate(previous);
   const recipients=[];for(const username of names){const uid=await db.get('communityUsernames/'+username);if(!validUid(uid))throw fail(404,'@'+username+' não foi encontrado. Ninguém recebeu esta mensagem.');const p=await db.get('userAccounts/'+uid+'/profile');if(p?.username!==username)throw fail(409,'@'+username+' mudou. Confira o destinatário.');recipients.push({uid,username,name:String(p.name||username).slice(0,80)});}
   return transaction(()=>{
    const old=rows('SELECT * FROM user_inbox_dispatches WHERE nonce=?',b.nonce)[0];if(old)return duplicate(old);
    if(fields.expiresAt&&fields.expiresAt<=now())throw fail(400,'A validade terminou.');
    const data={...fields,audience:b.audience,recipients};sql.exec('INSERT INTO user_inbox_dispatches(nonce,request,data,at,byuid) VALUES(?,?,?,?,?)',b.nonce,request,JSON.stringify(data),now(),user.uid);
    for(const uid of b.audience==='all'?['*']:recipients.map(r=>r.uid))add({...fields,id:'notice:'+b.nonce+':'+uid,uid,category:'notice',dispatch:b.nonce});
    return {ok:true,id:b.nonce,recipients:b.audience==='all'?'all':recipients.length};
   });
  }
  if(['inboxEdit','inboxRevoke'].includes(b.operation)){
   if(!uuid(b.id))throw fail(400,'Comunicado inválido.');const row=rows('SELECT * FROM user_inbox_dispatches WHERE nonce=?',b.id)[0];if(!row)throw fail(404,'Comunicado não encontrado.');
   return transaction(()=>{
    if(b.operation==='inboxRevoke'){sql.exec('UPDATE user_inbox_dispatches SET revoked=1 WHERE nonce=?',b.id);sql.exec('UPDATE user_inbox_messages SET revoked=1 WHERE dispatch=?',b.id);}
    else{if(row.revoked)throw fail(409,'Este comunicado foi retirado. Crie outro envio.');const fields=form(b),data={...JSON.parse(row.data),...fields};sql.exec('UPDATE user_inbox_dispatches SET data=? WHERE nonce=?',JSON.stringify(data),b.id);const {expiresAt,...content}=fields;sql.exec('UPDATE user_inbox_messages SET data=?,expires=? WHERE dispatch=?',JSON.stringify(content),expiresAt,b.id);}
    cache.clear();return {ok:true};
   });
  }
  throw fail(400,'Operação administrativa inválida.');
 }
 return {handle,manage,summary,reward};
}
function safeUrl(value){const raw=String(value||'').trim();if(!raw)return '';if(raw.length>1000||/[\u0000-\u0020\\]/.test(raw))throw fail(400,'Link inválido.');let u;try{u=new URL(raw,'https://centralfreefire.com.br');}catch{throw fail(400,'Link inválido.');}if(u.protocol!=='https:'||u.username||u.password)throw fail(400,'Use um link HTTPS válido.');return u.origin==='https://centralfreefire.com.br'?u.pathname+u.search+u.hash:u.href;}
module.exports={init,create,safeUrl};
