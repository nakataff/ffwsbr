// Ranking de interações: punições auditáveis em awards; nunca altera CFF Coins.
export const RANKING_PENALTY_SCHEMA=[
 "CREATE TABLE IF NOT EXISTS ranking_point_penalties (id TEXT PRIMARY KEY,user_key TEXT NOT NULL,username TEXT NOT NULL,points INTEGER NOT NULL CHECK(points BETWEEN 1 AND 500),reason TEXT NOT NULL CHECK(length(reason) BETWEEN 8 AND 300),day_key TEXT NOT NULL,month_key TEXT NOT NULL,created_at INTEGER NOT NULL,admin_uid TEXT NOT NULL,reverted_at INTEGER NOT NULL DEFAULT 0,reverted_by TEXT NOT NULL DEFAULT '',revert_reason TEXT NOT NULL DEFAULT '')",
 "CREATE INDEX IF NOT EXISTS idx_ranking_penalties_created ON ranking_point_penalties(created_at DESC)",
 "CREATE INDEX IF NOT EXISTS idx_ranking_penalties_user_created ON ranking_point_penalties(user_key,created_at DESC)"
];
const bad=(message,status=400)=>Object.assign(new Error(message),{status});
const cleanUser=value=>String(value||'').trim().replace(/^@/,'').toLowerCase();
const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const brDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
function mondayOf(day){
 const date=new Date(day+'T12:00:00Z');
 date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
 return date.toISOString().slice(0,10);
}
async function userSummary(db,user,now){
 const day=brDay(now),month=day.slice(0,7),week=mondayOf(day);
 const [inWeek,inMonth]=await Promise.all([
  db.prepare('SELECT COALESCE(SUM(points),0) AS total FROM awards WHERE user_key=?1 AND day_key>=?2 AND day_key<=?3').bind(user.user_key,week,day).first(),
  db.prepare('SELECT points FROM monthly_users WHERE month_key=?1 AND user_key=?2').bind(month,user.user_key).first()
 ]);
 const weekly=Number(inWeek?.total)||0,monthly=Number(inMonth?.points)||0,all=Number(user.points_all)||0;
 return {userKey:user.user_key,username:user.username,weekPoints:weekly,monthPoints:monthly,totalPoints:all,
  maximum:Math.max(0,Math.min(500,weekly,monthly,all)),week,month};
}
export async function findRankingPenaltyUser(db,username,now=Date.now()){
 const handle=cleanUser(username);
 if(!/^[a-z0-9._]{2,30}$/.test(handle))throw bad('Informe um @Instagram válido (nome exato).');
 const found=await db.prepare('SELECT user_key,username,points_all FROM users WHERE username=?1 COLLATE NOCASE LIMIT 2').bind(handle).all();
 const users=found.results||[];
 if(!users.length)throw bad('Usuário não encontrado no ranking.',404);
 if(users.length!==1)throw bad('Há mais de uma conta com este @. Não é seguro escolher automaticamente.',409);
 return userSummary(db,users[0],now);
}
export async function listRankingPenalties(db,{userKey='',limit=30}={}){
 const n=Math.max(1,Math.min(50,Math.trunc(Number(limit)||30)));
 const fields='SELECT id,user_key AS userKey,username,points,reason,day_key AS day,created_at AS createdAt,admin_uid AS adminUid,reverted_at AS revertedAt,reverted_by AS revertedBy,revert_reason AS revertReason FROM ranking_point_penalties';
 const result=userKey
  ?await db.prepare(fields+' WHERE user_key=?1 ORDER BY created_at DESC LIMIT ?2').bind(userKey,n).all()
  :await db.prepare(fields+' ORDER BY created_at DESC LIMIT ?1').bind(n).all();
 return result.results||[];
}
export async function applyRankingPenalty(db,{userKey,points,reason,nonce,adminUid},now=Date.now()){
 if(!validId(nonce))throw bad('Solicitação inválida. Atualize a página e tente novamente.');
 const amount=Number(points),explanation=String(reason||'').trim();
 if(!Number.isInteger(amount)||amount<1||amount>500)throw bad('Escolha um desconto entre 1 e 500 pontos.');
 if(explanation.length<8||explanation.length>300)throw bad('Informe um motivo de 8 a 300 caracteres.');
 if(typeof userKey!=='string'||!/^[A-Za-z0-9:_-]{2,160}$/.test(userKey))throw bad('Identificador de participante inválido.');
 if(!adminUid||typeof adminUid!=='string')throw bad('Sessão administrativa inválida.',401);
 const original=await db.prepare('SELECT id,user_key,points,reason,reverted_at FROM ranking_point_penalties WHERE id=?1').bind(nonce).first();
 if(original){
  if(original.user_key!==userKey||Number(original.points)!==amount||original.reason!==explanation)throw bad('Solicitação já utilizada com outros dados.',409);
  return {id:nonce,alreadyApplied:true,reverted:!!original.reverted_at};
 }
 const user=await db.prepare('SELECT user_key,username,points_all FROM users WHERE user_key=?1').bind(userKey).first();
 if(!user)throw bad('Participante não encontrado no ranking.',404);
 const today=brDay(now),month=today.slice(0,7),week=mondayOf(today);
 // INSERT condicionado evita punir acima do disponível mesmo com cliques concorrentes.
 // D1 batch é transacional: falhas não deixam o ledger pela metade.
 const statements=[
  db.prepare('INSERT INTO ranking_point_penalties(id,user_key,username,points,reason,day_key,month_key,created_at,admin_uid) SELECT ?1,u.user_key,u.username,?2,?3,?4,?5,?6,?7 FROM users u JOIN monthly_users m ON m.user_key=u.user_key AND m.month_key=?5 WHERE u.user_key=?8 AND u.points_all>=?2 AND m.points>=?2 AND (SELECT COALESCE(SUM(points),0) FROM awards WHERE user_key=u.user_key AND day_key>=?9 AND day_key<=?4)>=?2')
   .bind(nonce,amount,explanation,today,month,now,adminUid,userKey,week),
  db.prepare("INSERT INTO awards(award_key,user_key,username,type,source_id,points,day_key,month_key,created_at) SELECT 'penalty:'||id,user_key,username,'admin_penalty',id,-points,day_key,month_key,created_at FROM ranking_point_penalties WHERE id=?1").bind(nonce),
  db.prepare('UPDATE users SET points_all=points_all-(SELECT points FROM ranking_point_penalties WHERE id=?1) WHERE user_key=?2 AND EXISTS(SELECT 1 FROM ranking_point_penalties WHERE id=?1)').bind(nonce,userKey),
  db.prepare('UPDATE monthly_users SET points=points-(SELECT points FROM ranking_point_penalties WHERE id=?1) WHERE user_key=?2 AND month_key=?3 AND EXISTS(SELECT 1 FROM ranking_point_penalties WHERE id=?1)').bind(nonce,userKey,month)
 ];
 let result;
 try{result=await db.batch(statements)}catch(error){
  const saved=await db.prepare('SELECT user_key,points,reason,reverted_at FROM ranking_point_penalties WHERE id=?1').bind(nonce).first();
  if(saved&&saved.user_key===userKey&&Number(saved.points)===amount&&saved.reason===explanation)return {id:nonce,alreadyApplied:true,reverted:!!saved.reverted_at};
  throw error;
 }
 if(!result[0]?.meta?.changes)throw bad('O participante não possui pontos suficientes na semana, no mês ou no total. Atualize a busca.',409);
 return {id:nonce,alreadyApplied:false,reverted:false,username:user.username,points:amount};
}
export async function reverseRankingPenalty(db,{id,reason,adminUid},now=Date.now()){
 if(!validId(id))throw bad('Punição inválida.');
 const explanation=String(reason||'').trim();
 if(explanation.length<8||explanation.length>300)throw bad('Informe um motivo de reversão de 8 a 300 caracteres.');
 if(!adminUid||typeof adminUid!=='string')throw bad('Sessão administrativa inválida.',401);
 const previous=await db.prepare('SELECT id,user_key,username,points,reverted_at FROM ranking_point_penalties WHERE id=?1').bind(id).first();
 if(!previous)throw bad('Punição não encontrada.',404);
 if(previous.reverted_at)return {id,alreadyReverted:true};
 // Reverter na mesma data original corrige também a semana e o mês históricos.
 const rows=await db.batch([
  db.prepare('UPDATE ranking_point_penalties SET reverted_at=?1,reverted_by=?2,revert_reason=?3 WHERE id=?4 AND reverted_at=0').bind(now,adminUid,explanation,id),
  db.prepare("INSERT INTO awards(award_key,user_key,username,type,source_id,points,day_key,month_key,created_at) SELECT 'penalty-reversal:'||id,user_key,username,'admin_penalty_reversal',id,points,day_key,month_key,created_at FROM ranking_point_penalties WHERE id=?1 AND reverted_at=?2").bind(id,now),
  db.prepare('UPDATE users SET points_all=points_all+(SELECT points FROM ranking_point_penalties WHERE id=?1) WHERE user_key=?2 AND EXISTS(SELECT 1 FROM ranking_point_penalties WHERE id=?1 AND reverted_at=?3)').bind(id,previous.user_key,now),
  db.prepare('UPDATE monthly_users SET points=points+(SELECT points FROM ranking_point_penalties WHERE id=?1) WHERE user_key=?2 AND month_key=(SELECT month_key FROM ranking_point_penalties WHERE id=?1) AND EXISTS(SELECT 1 FROM ranking_point_penalties WHERE id=?1 AND reverted_at=?3)').bind(id,previous.user_key,now)
 ]);
 return {id,alreadyReverted:!rows[0]?.meta?.changes,username:previous.username,points:Number(previous.points)};
}
