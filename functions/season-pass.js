'use strict';
// Progress is fed by trusted existing actions. This module never queries a ranking.
const fail=(status,message)=>Object.assign(Error(message),{status});
const DAY=86400000,XP={checkin:20,quiz:40,interaction:40},BITS={checkin:1,quiz:2,interaction:4};
const month=v=>typeof v==='string'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(v);
const date=v=>typeof v==='string'&&/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
const atEnd=d=>Date.parse(d+'T23:59:59.999-03:00');
const CHEST_LEVELS=[5,10,15,20];
const chest=level=>({level,kind:'chest',title:level===20?'Baú final':'Baú do passe',pool:level===20?[{coins:30,weight:50},{coins:40,weight:35},{coins:50,weight:15}]:[{coins:5,weight:60},{coins:10,weight:30},{coins:15,weight:10}]});
function template(id='2026-11'){
 if(!month(id))throw fail(400,'Escolha o mês do passe.');
 const [y,m]=id.split('-').map(Number),end=new Date(Date.UTC(y,m,0,12)).toISOString().slice(0,10);
 return {id,title:id==='2026-11'?'Passe da Central · Rumo ao Mundial':'Passe da Central · '+id,description:'Participe, avance e resgate suas recompensas do mês.',cover:'',start:id+'-01',end,claimUntil:new Date(Date.parse(end+'T12:00:00Z')+7*DAY).toISOString().slice(0,10),xpPerLevel:100,enabled:true,published:id==='2026-11',revision:1,rewards:Array.from({length:20},(_,i)=>CHEST_LEVELS.includes(i+1)?chest(i+1):({level:i+1,kind:'coins',coins:i===18?10:5,title:'CFF COINS'}))};
}
function init(sql){
 sql.exec(`CREATE TABLE IF NOT EXISTS eco_pass_seasons(id TEXT PRIMARY KEY,data TEXT NOT NULL,published INTEGER NOT NULL,revision INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS eco_pass_seasons_public ON eco_pass_seasons(published,id);
 CREATE TABLE IF NOT EXISTS eco_pass_progress(uid TEXT,season TEXT,xp INTEGER NOT NULL DEFAULT 0,updatedAt INTEGER NOT NULL,PRIMARY KEY(uid,season));
 CREATE INDEX IF NOT EXISTS eco_pass_progress_history ON eco_pass_progress(uid,season DESC);
 CREATE INDEX IF NOT EXISTS eco_pass_progress_season ON eco_pass_progress(season,uid);
 CREATE TABLE IF NOT EXISTS eco_pass_days(uid TEXT,season TEXT,day TEXT,flags INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(uid,season,day));
 CREATE TABLE IF NOT EXISTS eco_pass_claims(uid TEXT,season TEXT,level INTEGER,data TEXT NOT NULL,status TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(uid,season,level));
 CREATE INDEX IF NOT EXISTS eco_pass_claims_admin ON eco_pass_claims(season,at DESC,uid,level);
 CREATE INDEX IF NOT EXISTS eco_pass_claims_level ON eco_pass_claims(season,level);
 CREATE TABLE IF NOT EXISTS eco_pass_limits(season TEXT,level INTEGER,n INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(season,level));`);
 const c=template();sql.exec('INSERT OR IGNORE INTO eco_pass_seasons VALUES(?,?,?,?)',c.id,JSON.stringify(c),1,c.revision);
 // One bounded migration of the untouched November coin slots. Never replace manual rewards or earned progress.
 if(!Array.from(sql.exec('SELECT id FROM eco_settings WHERE id=?','pass-chests-november-v1')).length){
  const saved=JSON.parse(Array.from(sql.exec('SELECT data FROM eco_pass_seasons WHERE id=?',c.id))[0].data);
  const started=Array.from(sql.exec('SELECT 1 AS found FROM eco_pass_progress WHERE season=? LIMIT 1',c.id)).length;
  let changed=false;
  if(!started&&saved.rewards.length===20)for(const level of CHEST_LEVELS){const old=saved.rewards[level-1];if(old?.kind==='coins'&&old.coins===(level===20?50:5)&&old.title===(level===20?'Recompensa final':'CFF COINS')&&!Array.from(sql.exec('SELECT 1 AS found FROM eco_pass_claims WHERE season=? AND level=? LIMIT 1',c.id,level)).length){saved.rewards[level-1]=chest(level);changed=true;}}
  if(changed){saved.revision++;sql.exec('UPDATE eco_pass_seasons SET data=?,revision=? WHERE id=?',JSON.stringify(saved),saved.revision,c.id);}
  sql.exec('INSERT OR IGNORE INTO eco_settings VALUES(?,?)','pass-chests-november-v1','1');
 }
}
function create({sql,transaction,db,credit,eligible,grantVoucher,notify,dayKey,now,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296}){
 const rows=(q,...a)=>Array.from(sql.exec(q,...a));
 const configs=new Map();
 function config(id){if(!month(id))return null;if(!configs.has(id))configs.set(id,JSON.parse(rows('SELECT data FROM eco_pass_seasons WHERE id=?',id)[0]?.data||'null'));return configs.get(id);}
 function selected(id){if(id){if(!month(id))throw fail(400,'Passe inválido.');return config(id);}
  const today=dayKey(now()),current=config(today.slice(0,7));if(current?.published)return current;
  const next=rows('SELECT id FROM eco_pass_seasons WHERE published=1 AND id>? ORDER BY id LIMIT 1',today.slice(0,7))[0];if(next)return config(next.id);
  const previous=rows('SELECT id FROM eco_pass_seasons WHERE published=1 ORDER BY id DESC LIMIT 1')[0];return previous?config(previous.id):null;
 }
 const status=c=>!c.enabled?'paused':dayKey(now())<c.start?'upcoming':dayKey(now())<=c.end?'active':now()<=atEnd(c.claimUntil)?'claiming':'ended';
 function record(uid,kind,day=dayKey(now())){
  if(!BITS[kind]||!date(day)||day>dayKey(now()))return;
  const c=config(day.slice(0,7));if(!c?.published||!c.enabled||day<c.start||day>c.end)return;
  // A delayed validated Instagram interaction may recognize a past day until collection closes.
  if(now()>atEnd(c.claimUntil))return;
  const old=rows('SELECT flags FROM eco_pass_days WHERE uid=? AND season=? AND day=?',uid,c.id,day)[0]?.flags||0;
  if(old&BITS[kind])return;
  sql.exec('INSERT INTO eco_pass_days VALUES(?,?,?,?) ON CONFLICT(uid,season,day) DO UPDATE SET flags=excluded.flags',uid,c.id,day,old|BITS[kind]);
  const cap=c.rewards.length*c.xpPerLevel;
  sql.exec('INSERT INTO eco_pass_progress VALUES(?,?,?,?) ON CONFLICT(uid,season) DO UPDATE SET xp=MIN(?,xp+?),updatedAt=excluded.updatedAt',uid,c.id,Math.min(cap,XP[kind]),now(),cap,XP[kind]);
 }
 function summary(uid,id='',full=false){
  const c=selected(id);if(!c?.published)return {available:false};
  const xp=rows('SELECT xp FROM eco_pass_progress WHERE uid=? AND season=?',uid,c.id)[0]?.xp||0,level=Math.min(c.rewards.length,Math.floor(xp/c.xpPerLevel)),claims=rows('SELECT level,status'+(full?',data':'')+' FROM eco_pass_claims WHERE uid=? AND season=? ORDER BY level',uid,c.id),claimed=new Map(claims.map(r=>[r.level,r.status])),s=status(c),ready=c.rewards.filter(r=>r.level<=level&&!claimed.has(r.level)&&r.kind!=='none').length,pending=claims.filter(r=>r.status==='pending').length,flags=rows('SELECT flags FROM eco_pass_days WHERE uid=? AND season=? AND day=?',uid,c.id,dayKey(now()))[0]?.flags||0;
  const value={available:true,id:c.id,title:c.title,description:c.description,cover:c.cover,start:c.start,end:c.end,claimUntil:c.claimUntil,status:s,level,levels:c.rewards.length,xp,xpPerLevel:c.xpPerLevel,maxXp:c.rewards.length*c.xpPerLevel,completed:level===c.rewards.length,ready:['active','claiming'].includes(s)?ready:0,pending,next:c.rewards.find(r=>r.level>level)||null,today:Object.keys(XP).map(kind=>({kind,xp:XP[kind],done:!!(flags&BITS[kind])})),revision:c.revision};
  if(full){const outcomes=new Map(claims.filter(r=>r.data).map(r=>[r.level,JSON.parse(r.data).reward]));const limits=new Map(rows('SELECT level,n FROM eco_pass_limits WHERE season=?',c.id).map(r=>[r.level,r.n]));value.rewards=c.rewards.map(r=>({...r,...(outcomes.get(r.level)?.source==='chest'?{openedCoins:outcomes.get(r.level).coins}:{}),status:claimed.get(r.level)||(['active','claiming'].includes(s)&&r.level<=level?'ready':r.level<=level?'expired':'locked'),...(r.kind==='voucher'?{remaining:Math.max(0,r.limit-(limits.get(r.level)||0))}:{})}));value.history=rows('SELECT p.season,p.xp,s.data FROM eco_pass_progress p JOIN eco_pass_seasons s ON s.id=p.season WHERE p.uid=? AND s.published=1 ORDER BY p.season DESC LIMIT 12',uid).map(r=>{const v=JSON.parse(r.data);return{id:v.id,title:v.title,level:Math.min(v.rewards.length,Math.floor(r.xp/v.xpPerLevel)),levels:v.rewards.length,completed:r.xp>=v.rewards.length*v.xpPerLevel}});}
  return value;
 }
 const safeUrl=v=>{v=String(v||'').trim();if(!v)return '';if(v.length>1000)throw fail(400,'Link de imagem muito longo.');if(/^\/(?!\/)[a-zA-Z0-9_./% -]+$/.test(v)&&!v.includes('..'))return v;let u;try{u=new URL(v)}catch{}if(u?.protocol!=='https:'||u.username||u.password)throw fail(400,'Use uma imagem HTTPS ou um caminho local.');return u.href;};
 const validAsset=a=>a?.enabled&&['avatar','cover','frame','badge'].includes(a.kind)&&a.accessRule!=='admin';
 async function validate(input){
  if(!input||!month(input.id)||typeof input.title!=='string'||!input.title.trim()||input.title.length>80||typeof input.description!=='string'||input.description.length>240||typeof input.enabled!=='boolean'||typeof input.published!=='boolean'||!date(input.start)||!date(input.end)||!date(input.claimUntil)||input.start.slice(0,7)!==input.id||input.end.slice(0,7)!==input.id||input.end<input.start||input.claimUntil<input.end||atEnd(input.claimUntil)>atEnd(input.end)+14*DAY||!Number.isInteger(input.xpPerLevel)||input.xpPerLevel<50||input.xpPerLevel>500||!Array.isArray(input.rewards)||input.rewards.length<1||input.rewards.length>50)throw fail(400,'Confira o mês, datas, título, XP e os níveis do passe.');
  const days=Math.round((atEnd(input.end)-atEnd(input.start))/DAY)+1;if(input.rewards.length*input.xpPerLevel>days*100)throw fail(400,'A meta de XP precisa caber nos dias disponíveis do passe (até 100 XP por dia).');
  const out={id:input.id,title:input.title.trim(),description:input.description.trim(),cover:safeUrl(input.cover),start:input.start,end:input.end,claimUntil:input.claimUntil,xpPerLevel:input.xpPerLevel,enabled:input.enabled,published:input.published,rewards:[]};
  for(let i=0;i<input.rewards.length;i++){
   const r=input.rewards[i];if(!r||r.level!==i+1||!['none','coins','avatar','cover','frame','badge','voucher','chest'].includes(r.kind)||typeof r.title!=='string'||r.title.length>80)throw fail(400,'Confira o prêmio do nível '+(i+1)+'.');
   let item={level:i+1,kind:r.kind,title:r.title.trim()};
   if(r.kind==='coins'){if(!Number.isInteger(r.coins)||r.coins<1||r.coins>500)throw fail(400,'Use de 1 a 500 moedas por nível.');item.coins=r.coins;}
   if(['avatar','cover','frame','badge'].includes(r.kind)){
    if(typeof r.assetId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(r.assetId))throw fail(400,'Escolha um item do catálogo.');
    const asset=await db.get('communityProfileCatalog/'+r.assetId);if(!validAsset(asset)||asset.kind!==r.kind)throw fail(400,'O item do nível '+(i+1)+' está indisponível ou é exclusivo da administração.');item={...item,assetId:r.assetId,title:item.title||String(asset.title||'Recompensa').slice(0,80),imageUrl:typeof asset.imageUrl==='string'?safeUrl(asset.imageUrl):''};
   }
   if(r.kind==='chest'){
    if(!Array.isArray(r.pool)||r.pool.length!==3||r.pool.some(v=>!Number.isInteger(v.coins)||v.coins<1||v.coins>500||!Number.isInteger(v.weight)||v.weight<1||v.weight>100)||r.pool.reduce((n,v)=>n+v.weight,0)!==100)throw fail(400,'O baú precisa de três valores de 1 a 500 moedas e chances que somem 100%.');
    item.pool=r.pool.map(v=>({coins:v.coins,weight:v.weight}));
   }
   if(r.kind==='voucher'){
    if(!Number.isInteger(r.limit)||r.limit<1||r.limit>500||!Number.isInteger(r.fallbackCoins)||r.fallbackCoins<1||r.fallbackCoins>500||!date(r.expires)||r.expires<input.claimUntil)throw fail(400,'Defina de 1 a 500 vales, moedas após esgotar e validade igual ou posterior ao prazo de resgate.');
    item={...item,limit:r.limit,fallbackCoins:r.fallbackCoins,expires:r.expires};
   }
   out.rewards.push(item);
  }
  return out;
 }
 async function save(identity,b){
  const value=await validate(b.config),old=config(value.id);
  return transaction(()=>{
   const current=JSON.parse(rows('SELECT data FROM eco_pass_seasons WHERE id=?',value.id)[0]?.data||'null');
   if((current?.revision||0)!==b.expectedRevision)throw fail(409,'O passe foi alterado em outra janela. Atualize antes de salvar.');
   const hasProgress=rows('SELECT 1 AS found FROM eco_pass_progress WHERE season=? LIMIT 1',value.id)[0];
   if(current&&hasProgress&&(current.start!==value.start||current.end!==value.end||current.xpPerLevel!==value.xpPerLevel||current.rewards.length!==value.rewards.length))throw fail(409,'O passe já tem progresso. Preserve datas, quantidade de níveis e XP para não alterar conquistas.');
   if(current?.published&&hasProgress&&!value.published)throw fail(409,'Este passe já tem participantes. Use Pausar para preservar o histórico.');
   const claimed=new Set((current?.rewards||[]).filter(r=>rows('SELECT 1 AS found FROM eco_pass_claims WHERE season=? AND level=? LIMIT 1',value.id,r.level).length).map(r=>r.level));
   for(const level of claimed)if(JSON.stringify(current.rewards[level-1])!==JSON.stringify(value.rewards[level-1]))throw fail(409,'O nível '+level+' já tem resgates. Preserve a recompensa desse nível.');
   if(current&&hasProgress&&value.claimUntil<current.claimUntil)throw fail(409,'Não reduza o prazo de resgate de quem já está participando.');
   value.revision=(current?.revision||0)+1;sql.exec('INSERT OR REPLACE INTO eco_pass_seasons VALUES(?,?,?,?)',value.id,JSON.stringify(value),value.published?1:0,value.revision);configs.set(value.id,value);return {ok:true,config:value};
  });
 }
 async function deliver(uid,c,level){
  const row=rows('SELECT * FROM eco_pass_claims WHERE uid=? AND season=? AND level=?',uid,c.id,level)[0];if(!row)throw fail(404,'Resgate do passe não encontrado.');
  const data=JSON.parse(row.data),reward=data.reward,message=c.title+' · nível '+level;
  if(row.status!=='done'){
   if(['avatar','cover','frame','badge'].includes(reward.kind)){
    const item=await db.get('communityProfileCatalog/'+reward.assetId);if(!validAsset(item)||item.kind!==reward.kind)throw fail(409,'O item reservado precisa ser conferido pelo administrador. Seu resgate está salvo.');
    const giftId='pass-'+c.id+'-'+level;
    if(reward.kind==='badge')await db.update({['communityBadgeOwnership/'+uid+'/'+reward.assetId]:true,['communityBadgeGrants/'+uid+'/'+giftId]:{badgeId:reward.assetId,reason:message,week:'',grantedAt:row.at,status:'active'}});
    else{await db.transact('communityImageOwnership/'+uid+'/'+reward.assetId,old=>old||{source:'admin',grantedAt:row.at});await db.update({['communityGifts/'+uid+'/'+giftId]:{assetId:reward.assetId,kind:reward.kind,message,grantedAt:row.at}});}
   }
   transaction(()=>{const state=rows('SELECT status FROM eco_pass_claims WHERE uid=? AND season=? AND level=?',uid,c.id,level)[0];if(state.status==='done')return;
    if(reward.kind==='coins')credit(uid,reward.coins,'pass','pass:'+c.id+':'+level+':'+uid,message);
    if(reward.kind==='voucher')grantVoucher(uid,data.profile,c.id,level,atEnd(reward.expires),row.at);
    sql.exec('UPDATE eco_pass_claims SET status=? WHERE uid=? AND season=? AND level=?','done',uid,c.id,level);
    notify({id:'pass:'+c.id+':'+level+':'+uid,uid,title:'Recompensa do passe recebida!',body:message+' — '+(reward.kind==='coins'?reward.coins+' CFF COINS':reward.title||'Vale Codiguinho'),url:reward.kind==='coins'?'/conta.html?tab=points':reward.kind==='voucher'?'/conta.html?tab=points&shopSection=vouchers':'/conta.html?tab=inventory&section='+({badge:'badges',avatar:'avatars',cover:'covers',frame:'frames'}[reward.kind]),button:reward.kind==='coins'?'Ver saldo':'Ver recompensa',at:row.at});
   });
  }
  return {ok:true,reward,pass:summary(uid,c.id,true),wallet:rows('SELECT balance FROM eco_wallet WHERE uid=?',uid)[0]||{balance:0}};
 }
 async function claim(uid,b){
  if(!month(b.season)||!Number.isInteger(b.level)||b.level<1||b.level>50)throw fail(400,'Escolha um nível válido.');
  const c=config(b.season);if(!c)throw fail(404,'Passe não encontrado.');
  const old=rows('SELECT status FROM eco_pass_claims WHERE uid=? AND season=? AND level=?',uid,c.id,b.level)[0];if(old)return deliver(uid,c,b.level);
  if(!c.published||!['active','claiming'].includes(status(c)))throw fail(409,'Este passe não está no período de resgate.');
  if(b.expectedRevision!==c.revision)throw fail(409,'O passe mudou. Atualize e confira os prêmios antes de resgatar.');
  const p=await eligible(uid);
  transaction(()=>{
   if(rows('SELECT status FROM eco_pass_claims WHERE uid=? AND season=? AND level=?',uid,c.id,b.level).length)return;
   const latest=JSON.parse(rows('SELECT data FROM eco_pass_seasons WHERE id=?',c.id)[0].data);if(latest.revision!==c.revision||!latest.published||!['active','claiming'].includes(status(latest)))throw fail(409,'O passe mudou. Atualize antes de resgatar.');
   const xp=rows('SELECT xp FROM eco_pass_progress WHERE uid=? AND season=?',uid,c.id)[0]?.xp||0;
   let reward=c.rewards[b.level-1];if(!reward||reward.kind==='none'||xp<b.level*c.xpPerLevel)throw fail(403,'Esse nível ainda não foi liberado.');
   if(reward.kind==='chest'){
    const ticket=Math.floor(random()*100);if(!Number.isInteger(ticket)||ticket<0||ticket>=100)throw fail(500,'Não foi possível abrir o baú. Tente novamente.');
    let total=0;const selected=reward.pool.find(option=>{total+=option.weight;return ticket<total});if(!selected)throw fail(500,'Confira as chances deste baú.');
    reward={level:b.level,kind:'coins',coins:selected.coins,source:'chest',title:reward.title||'Baú do passe'};
   }
   if(reward.kind==='voucher'){const used=rows('SELECT n FROM eco_pass_limits WHERE season=? AND level=?',c.id,b.level)[0]?.n||0;if(used>=reward.limit)reward={level:b.level,kind:'coins',coins:reward.fallbackCoins,title:'Moedas após esgotar os vales'};else sql.exec('INSERT INTO eco_pass_limits VALUES(?,?,1) ON CONFLICT(season,level) DO UPDATE SET n=n+1',c.id,b.level);}
   sql.exec('INSERT INTO eco_pass_claims VALUES(?,?,?,?,?,?)',uid,c.id,b.level,JSON.stringify({reward,profile:{name:p.name,username:p.username}}),'pending',now());
  });
  return deliver(uid,c,b.level);
 }
 async function manage(identity,b){
  if(b.operation==='passSave')return save(identity,b);
  if(b.operation==='passConfig'){
   const id=b.season||dayKey(now()).slice(0,7);if(!month(id))throw fail(400,'Mês inválido.');
   const catalog=await db.get('communityProfileCatalog')||{};
   return {ok:true,config:config(id)||{...template(id),published:false,revision:0},seasons:rows('SELECT id,revision,published FROM eco_pass_seasons ORDER BY id DESC LIMIT 24'),catalog:Object.entries(catalog).filter(([,a])=>validAsset(a)).map(([id,a])=>({id,title:a.title,kind:a.kind}))};
  }
  if(b.operation==='passDeliveries'){
   if(!month(b.season)||!Number.isSafeInteger(b.offset??0)||(b.offset??0)<0||(b.offset??0)>100000)throw fail(400,'Página de entregas inválida.');
   const result=rows('SELECT uid,level,data,status,at FROM eco_pass_claims WHERE season=? ORDER BY at DESC,uid,level LIMIT 21 OFFSET ?',b.season,b.offset||0);
   return {ok:true,entries:result.slice(0,20).map(r=>({...r,...JSON.parse(r.data),data:undefined})),offset:b.offset||0,hasMore:result.length>20};
  }
  throw fail(400,'Operação do passe inválida.');
 }
 return {record,summary,claim,manage};
}
module.exports={init,create,template,chest,CHEST_LEVELS,XP,BITS};
