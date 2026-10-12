import {cachedPublic} from './optimizations.js';
export const PROFILE_INSIGHTS_VERSION='20261012-community-profile-v1';
export const PROFILE_INSIGHTS_SCHEMA=[
 'CREATE TABLE IF NOT EXISTS community_prediction_outcomes (prediction_id TEXT PRIMARY KEY,payload TEXT NOT NULL,closes_at INTEGER NOT NULL)',
 'CREATE INDEX IF NOT EXISTS idx_users_username_profile ON users (lower(username),last_interaction_at DESC)',
];
const DAY=86400000;
export function brtDay(now=Date.now()){return new Date(now-3*3600000).toISOString().slice(0,10);}
export function shiftDay(day,n){return new Date(Date.parse(day+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);}
export function monday(day){const n=new Date(day+'T12:00:00Z').getUTCDay();return shiftDay(day,-((n+6)%7));}
export function cleanHandle(value){const s=String(value||'').trim().replace(/^@/,'').toLowerCase();return /^[a-z0-9_.]{1,64}$/.test(s)?s:'';}
export function streaks(days,today){const sorted=[...new Set(days)].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=today).sort();let longest=0,run=0,previous='';for(const day of sorted){run=previous&&shiftDay(previous,1)===day?run+1:1;longest=Math.max(longest,run);previous=day;}return{longest,current:previous===today||previous===shiftDay(today,-1)?run:0};}
export async function captureOutcomes(db,predictions,now=Date.now()){
 const valid=predictions.filter(p=>p?.id&&p.status==='settled'&&p.result&&Number(p.closesAt||p.settledAt)>0&&Number(p.closesAt||p.settledAt)<=now);
 if(!valid.length)return;
 await db.batch(valid.map(p=>{const payload=JSON.stringify({id:p.id,kind:p.kind||'team',metric:p.metric||'custom',closesAt:Number(p.closesAt||p.settledAt),accepted:p.result.teams||p.result.options||(p.result.option?[p.result.option]:[])});return db.prepare(`INSERT INTO community_prediction_outcomes(prediction_id,payload,closes_at) VALUES(?1,?2,?3) ON CONFLICT(prediction_id) DO UPDATE SET payload=excluded.payload,closes_at=excluded.closes_at WHERE payload<>excluded.payload`).bind(p.id,payload,Number(p.closesAt||p.settledAt));}));
}
export function predictionSummary(votes,outcomes,awardWins,parseVote){
 const known=new Map(outcomes.map(o=>[o.id,o]));const groups={team:{label:'Times',submitted:0,settled:0,correct:0},player:{label:'Jogadores',submitted:0,settled:0,correct:0},other:{label:'Outros',submitted:0,settled:0,correct:0}};let unknown=0;const resolved=[];
 for(const v of votes){const id=String(v.award_key||'').slice('prediction-vote:'.length,-(String(v.user_key).length+1)),o=known.get(id);if(!o){unknown++;resolved.push({date:Number(v.created_at||0),id,correct:null});continue;}const group=o.kind==='player'||o.metric==='mvp'?'player':o.kind==='team'?'team':'other';groups[group].submitted++;const parsed=parseVote(id,v.source_id);if(!parsed){unknown++;resolved.push({date:o.closesAt,id,correct:null});continue;}const correct=o.accepted.includes(parsed.option);groups[group].settled++;groups[group].correct+=Number(correct);resolved.push({date:o.closesAt,id,correct});}
 resolved.sort((a,b)=>a.date-b.date||a.id.localeCompare(b.id));let longest=0,run=0;for(const r of resolved){run=r.correct?run+1:0;longest=Math.max(longest,run);}const settled=resolved.filter(r=>r.correct!==null).length,correct=resolved.filter(r=>r.correct===true).length;
 return{submitted:votes.length,settled,correct,accuracy:settled?Math.round(correct/settled*100):null,currentStreak:run,longestStreak:longest,awardedWins:awardWins,unresolved:unknown,groups};
}
// One shared aggregation for all profiles, including positions beyond the public Top 500.
async function recordIndex(db,today){const current=monday(today),since=shiftDay(current,-104*7);return cachedPublic(db,'profile-records:v1:'+current,300000,async()=>{
 const rows=await db.prepare(`WITH totals AS (
 SELECT a.user_key,COALESCE(MAX(u.username),MAX(a.username)) username,
 date(a.day_key,'-'||((CAST(strftime('%w',a.day_key) AS INTEGER)+6)%7)||' days') week,
 SUM(a.points) points,SUM(a.type='story') stories,SUM(a.type='comment') comments
 FROM awards a LEFT JOIN users u ON u.user_key=a.user_key WHERE a.day_key>=?1 AND a.day_key<?2 GROUP BY a.user_key,week
 ), days AS (SELECT user_key,date(day_key,'-'||((CAST(strftime('%w',day_key) AS INTEGER)+6)%7)||' days') week,COUNT(*) active FROM active_days WHERE day_key>=?1 AND day_key<?2 GROUP BY user_key,week), ranked AS (
 SELECT t.*,ROW_NUMBER() OVER(PARTITION BY t.week ORDER BY t.points DESC,COALESCE(d.active,0) DESC,t.stories DESC,t.comments DESC,t.username ASC,t.user_key ASC) position FROM totals t LEFT JOIN days d ON d.user_key=t.user_key AND d.week=t.week
 ) SELECT user_key,MIN(position) bestPosition,MAX(points) bestPoints,COUNT(*) weeks FROM ranked GROUP BY user_key`).bind(since,current).all();
 return Object.fromEntries((rows.results||[]).map(r=>[r.user_key,{bestPosition:Number(r.bestPosition),bestPoints:Number(r.bestPoints),weeks:Number(r.weeks),since,until:shiftDay(current,-1)}]));
 });}
export async function peerScores(db,names,period='week',now=Date.now()){
 const handles=[...new Set(names.map(cleanHandle).filter(Boolean))].sort();if(!handles.length||handles.length>100)throw Error('Informe de 1 a 100 perfis válidos.');
 if(!['week','month','all'].includes(period))throw Error('Período inválido.');const today=brtDay(now),start=period==='week'?monday(today):period==='month'?today.slice(0,7)+'-01':'0000-01-01';

 return cachedPublic(db,'profile-peers:v1:'+period+':'+today+':'+handles.join(','),300000,async()=>{
 const rows=await db.prepare(`WITH candidates AS (SELECT user_key,username,ROW_NUMBER() OVER(PARTITION BY lower(username) ORDER BY last_interaction_at DESC,user_key ASC) n FROM users WHERE lower(username) IN (SELECT value FROM json_each(?3))), chosen AS (SELECT * FROM candidates WHERE n=1), scores AS (
 SELECT a.user_key,SUM(a.points) points,SUM(a.type='comment') comments,SUM(a.type='story') stories,SUM(a.type='prediction_vote') predictions,SUM(a.type IN ('prediction_correct','prediction_nearest')) wins FROM awards a JOIN chosen u ON u.user_key=a.user_key WHERE a.day_key BETWEEN ?1 AND ?2 GROUP BY a.user_key
 ), days AS (SELECT d.user_key,COUNT(*) activeDays FROM active_days d JOIN chosen u ON u.user_key=d.user_key WHERE d.day_key BETWEEN ?1 AND ?2 GROUP BY d.user_key)
 SELECT u.username,COALESCE(s.points,0) points,COALESCE(s.comments,0) comments,COALESCE(s.stories,0) stories,COALESCE(s.predictions,0) predictions,COALESCE(s.wins,0) wins,COALESCE(d.activeDays,0) activeDays FROM chosen u LEFT JOIN scores s ON s.user_key=u.user_key LEFT JOIN days d ON d.user_key=u.user_key`).bind(start,today,JSON.stringify(handles)).all();
 const found=new Map((rows.results||[]).map(r=>[r.username.toLowerCase(),r]));return{period,start,end:today,updatedAt:now,users:handles.map(username=>({username,found:found.has(username),points:0,comments:0,stories:0,predictions:0,wins:0,activeDays:0,...found.get(username)}))};
 });
}
export async function profileInsights(db,username,parseVote,now=Date.now()){
 const handle=cleanHandle(username);if(!handle)throw Error('Perfil inválido.');const today=brtDay(now);
 return cachedPublic(db,'profile-insights:v1:'+today+':'+handle,300000,async()=>{
 const user=await db.prepare('SELECT user_key,username,points_all FROM users WHERE lower(username)=?1 ORDER BY last_interaction_at DESC,user_key ASC LIMIT 1').bind(handle).first();
 if(!user)return{ok:true,found:false,username:handle,today,points:0,activity:{days:[],current:0,longest:0},predictions:predictionSummary([],[],0,parseVote),records:null};
 const [days,votes,outcomes,wins,records,week]=await Promise.all([
 db.prepare('SELECT day_key FROM active_days WHERE user_key=?1 AND day_key<=?2 ORDER BY day_key').bind(user.user_key,today).all(),
 db.prepare("SELECT award_key,user_key,source_id,created_at FROM awards WHERE user_key=?1 AND type='prediction_vote' ORDER BY created_at,award_key").bind(user.user_key).all(),
 db.prepare('SELECT payload FROM community_prediction_outcomes WHERE closes_at<=?1').bind(now).all(),
 db.prepare("SELECT COUNT(*) total FROM awards WHERE user_key=?1 AND type IN ('prediction_correct','prediction_nearest')").bind(user.user_key).first(),recordIndex(db,today),peerScores(db,[handle],'week',now)
 ]);
 const allDays=(days.results||[]).map(r=>r.day_key),activity=streaks(allDays,today),since=shiftDay(today,-364);
 return{ok:true,found:true,username:user.username,today,points:Number(user.points_all||0),week:week.users[0],activity:{...activity,since,totalDays:allDays.length,days:allDays.filter(d=>d>=since)},predictions:predictionSummary(votes.results||[],(outcomes.results||[]).map(r=>JSON.parse(r.payload)),Number(wins?.total||0),parseVote),records:records[user.user_key]||null,updatedAt:now};
 });
}
