'use strict';
const fail=(status,message)=>Object.assign(Error(message),{status});
const uidOK=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const shift=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
function init(sql){sql.exec('CREATE TABLE IF NOT EXISTS eco_stock_bridge(seq INTEGER PRIMARY KEY AUTOINCREMENT,hash TEXT UNIQUE NOT NULL)');}
function create({sql,transaction,db,ranking,vouchers,eligible,dayKey,weekKey,now}){
 const rows=(q,...args)=>Array.from(sql.exec(q,...args));
 const rememberStock=hash=>sql.exec('INSERT OR IGNORE INTO eco_stock_bridge(hash) VALUES(?)',hash);
 function stockBridge(b){
  const cursor=b.cursor??0;if(!Number.isSafeInteger(cursor)||cursor<0)throw fail(400,'Página de estoque inválida.');
  const data=rows('SELECT b.seq,s.hash,s.code,s.title,s.expires,s.bucket,s.image FROM eco_stock_bridge b JOIN eco_stock s ON s.hash=b.hash WHERE b.seq>? ORDER BY b.seq LIMIT 51',cursor),entries=data.slice(0,50);
  return {ok:true,entries,nextCursor:entries.at(-1)?.seq??cursor,hasMore:data.length>50};
 }
 function closedWeek(value){
  const current=weekKey(dayKey(now()));
  if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value||weekKey(value)!==value||value>=current)throw fail(400,'Escolha uma semana já encerrada.');return value;
 }
 async function podium(week){
  const stored=rows('SELECT data FROM eco_interaction_periods WHERE type=? AND period=?','week',week)[0];
  if(stored)return JSON.parse(stored.data);
  if(!ranking)throw fail(503,'O ranking de interações está indisponível.');
  const p=await ranking.podium('week',week,now());
  if(p.type!=='week'||p.key!==week||!Array.isArray(p.top3)||p.top3.length>3||p.top3.some((r,i)=>typeof r.userKey!=='string'||r.position!==i+1))throw fail(503,'Não foi possível conferir o resultado da semana.');
  return transaction(()=>{sql.exec('INSERT OR IGNORE INTO eco_interaction_periods VALUES(?,?,?)','week',week,JSON.stringify(p));return JSON.parse(rows('SELECT data FROM eco_interaction_periods WHERE type=? AND period=?','week',week)[0].data);});
 }
 async function winner(week){
  const p=await podium(week),top=p.top3.find(x=>x.position===1);if(!top)return null;
  const linked=rows('SELECT uid,username FROM eco_interaction_identities WHERE user_key=?',top.userKey)[0];
  const identity=!linked&&ranking?.identity?await ranking.identity(top.userKey):null,instagram=String(identity?.username||linked?.username||top.username||'').toLowerCase();
  let uid=linked?.uid;
  if(!uid&&instagram){if(instagram==='nakataff')uid=(await db.get('communityOwnerInstagram'))?.uid;else uid=(await db.get('communityRankingProfiles/'+instagram.replace(/\./g,',')))?.uid;}
  let recipient=null;
  if(uidOK(uid)){const profile=await db.get('userAccounts/'+uid+'/profile');if(profile?.name&&/^[a-z0-9_]{3,24}$/.test(profile.username||''))recipient={uid,name:String(profile.name).slice(0,80),username:profile.username};}
  return {instagram,points:top.points,recipient};
 }
 async function weeklyWinners(b){
  const before=b.before?closedWeek(b.before):weekKey(dayKey(now())),entries=[];
  for(let i=1;i<=4;i++){const week=shift(before,-7*i),w=await winner(week);entries.push({week,end:shift(week,6),winner:w,award:vouchers.weeklyAward(week)});}
  return {ok:true,entries,nextBefore:entries.at(-1).week};
 }
 async function grantWeekly(identity,b){
  const week=closedWeek(b.week),w=await winner(week);
  if(!w?.recipient)throw fail(409,'O vencedor ainda não tem uma conta identificada na Central.');
  if(w.recipient.uid!==b.targetUid||w.recipient.username!==b.expectedUsername)throw fail(409,'Confira novamente o vencedor e a conta antes de enviar.');
  return vouchers.grantWeekly(identity,b,week);
 }
 async function inventory(b){
  if(!uidOK(b.targetUid))throw fail(400,'Selecione uma pessoa.');
  const categories={codes:'communityCodeGifts',gifts:'communityGifts',images:'communityImageOwnership',badges:'communityBadgeGrants'};
  const category=b.category||'codes',cursor=b.cursor||'';
  if(typeof cursor!=='string'||cursor.length>160||/[.#$\[\]\/\u0000-\u001f]/.test(cursor))throw fail(400,'Página do inventário inválida.');
  const p=await db.get('userAccounts/'+b.targetUid+'/profile');if(!p?.name||!/^[a-z0-9_]{3,24}$/.test(p.username||''))throw fail(404,'Perfil não encontrado.');if(b.expectedUsername&&b.expectedUsername!==p.username)throw fail(409,'A pessoa mudou de @. Pesquise novamente.');
  const recipient={uid:b.targetUid,name:p.name,username:p.username};
  if(category==='vouchers')return {ok:true,recipient,category,vouchers:vouchers.state(b.targetUid)};
  if(category==='emblems'){const assignment=await db.get('communityEmblemAssignments/'+b.targetUid);return {ok:true,recipient,category,entries:assignment?.emblemId?[{id:assignment.emblemId,assetId:assignment.emblemId,grantedAt:assignment.grantedAt,kind:'emblem',title:(await db.get('communityEmblemCatalog/'+assignment.emblemId))?.title||'Emblema'}]:[],hasMore:false,nextCursor:''};}
  if(!categories[category])throw fail(400,'Categoria do inventário inválida.');
  const data=await db.query(categories[category]+'/'+b.targetUid,{orderBy:'$key',limitToFirst:cursor?22:21,...(cursor?{startAt:cursor}:{})});
  const all=Object.entries(data||{}).filter(([id])=>!cursor||id>cursor).sort(([a],[b])=>a<b?-1:a>b?1:0),selected=all.slice(0,20);
  const entries=selected.map(([id,g])=>({id,kind:category==='codes'?'code':g.kind||category,assetId:String(g.assetId||g.badgeId||(category==='images'?id:'')),title:String(g.title||''),sentAt:Number(g.sentAt||g.grantedAt||0),openedAt:Number(g.openedAt||0),archivedAt:Number(g.archivedAt||0),returnedAt:Number(g.returnedAt||0),message:String(g.message||g.reason||'').slice(0,160)}));
  const pending=category==='codes'?rows('SELECT id,at,kind,json_extract(data,\'$.result.label\') AS title,status FROM eco_receipts WHERE uid=? AND status=? ORDER BY at DESC LIMIT 10',b.targetUid,'pending'):[];
  return {ok:true,recipient,category,entries,hasMore:all.length>20,nextCursor:selected.at(-1)?.[0]||'',pending,equipped:category==='images'?{avatarId:p.avatarId||'default',coverId:p.coverId||'',frameId:p.frameId||''}:undefined};
 }
 return {rememberStock,stockBridge,weeklyWinners,grantWeekly,inventory};
}
module.exports={init,create};
