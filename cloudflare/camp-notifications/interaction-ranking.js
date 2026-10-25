// Read-only access to the existing interaction ranking database.
const clean=value=>String(value||'').replace(/^@+/,'').trim().toLowerCase();
const day=at=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));return ['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');};
const monday=value=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const shift=(value,n)=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const shiftMonth=value=>{const d=new Date(value+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,10);};
const compareText=(a,b)=>a<b?-1:a>b?1:0;
export function createInteractionRanking(db){
 if(!db)return null;
 const all=async(q,...values)=>(await db.prepare(q).bind(...values).all()).results||[];
 return {
  // Admin-only, on-demand audit. Never reads the ranking of every participant.
  async adminReport({username,period='week',date,from,to,offset=0},now=Date.now()){
   const nick=clean(username);
   if(!/^[a-z0-9._]{2,30}$/.test(nick))throw Object.assign(Error('Informe um @Instagram válido.'),{status:400});
   const user=await db.prepare('SELECT user_key,username,points_all FROM users WHERE username=?1 COLLATE NOCASE LIMIT 1').bind(nick).first();
   if(!user)return {ok:true,found:false,username:nick};
   const today=day(now),selected=String(date||today);
   if(!/^20\d{2}-(0[1-9]|1[0-2])-[0-3]\d$/.test(selected)||Number.isNaN(Date.parse(selected+'T12:00:00Z'))||selected>today)throw Object.assign(Error('Selecione uma data válida, até hoje.'),{status:400});
   let start,end;
   if(period==='day'){start=end=selected;}
   else if(period==='week'){start=monday(selected);end=shift(start,6);}
   else if(period==='month'){start=selected.slice(0,7)+'-01';end=shift(shiftMonth(start),-1);}
   else if(period==='custom'){
    start=String(from||'');end=String(to||'');
    if(!/^20\d{2}-\d{2}-\d{2}$/.test(start)||!/^20\d{2}-\d{2}-\d{2}$/.test(end)||Number.isNaN(Date.parse(start+'T12:00:00Z'))||Number.isNaN(Date.parse(end+'T12:00:00Z'))||start>end||end>today||(Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000>90)throw Object.assign(Error('Escolha um período de até 91 dias, sem datas futuras.'),{status:400});
   }else throw Object.assign(Error('Período inválido.'),{status:400});
   if(end>today)end=today;
   const page=Number(offset);
   if(!Number.isInteger(page)||page<0||page>2000||page%20)throw Object.assign(Error('Página inválida.'),{status:400});
   // Indexed by (user_key,day_key,type). Aggregate only the selected user and date range.
   const groups=await all('SELECT day_key AS day,type,COUNT(*) AS count,SUM(points) AS points FROM awards WHERE user_key=?1 AND day_key>=?2 AND day_key<=?3 GROUP BY day_key,type ORDER BY day_key DESC,type',user.user_key,start,end);
   const details=await all('SELECT type,points,day_key AS day,created_at AS createdAt,source_id AS sourceId FROM awards WHERE user_key=?1 AND day_key>=?2 AND day_key<=?3 ORDER BY day_key DESC,created_at DESC LIMIT 21 OFFSET ?4',user.user_key,start,end,page);
   const totals=new Map(),days=new Map();let points=0,events=0;
   for(const row of groups){const p=Number(row.points)||0,n=Number(row.count)||0;points+=p;events+=n;const t=totals.get(row.type)||{type:row.type,count:0,points:0};t.count+=n;t.points+=p;totals.set(row.type,t);const d=days.get(row.day)||{day:row.day,points:0,events:0,comments:0,stories:0,checkins:0};d.points+=p;d.events+=n;if(row.type==='comment')d.comments+=n;if(row.type==='story')d.stories+=n;if(row.type==='checkin')d.checkins+=n;days.set(row.day,d);}
   return {ok:true,found:true,username:clean(user.username),pointsAll:Number(user.points_all)||0,period,start,end,points,events,types:[...totals.values()].sort((a,b)=>b.points-a.points),days:[...days.values()],entries:details.slice(0,20).map(r=>({type:String(r.type),points:Number(r.points)||0,day:r.day,createdAt:Number(r.createdAt)||0,sourceId:r.sourceId?String(r.sourceId).slice(0,100):''})),offset:page,hasMore:details.length>20};
  },
  async identity(userKey){const row=await db.prepare('SELECT username FROM users WHERE user_key=?1').bind(userKey).first();return row?{username:clean(row.username)}:null;},
  async probe(){await Promise.all(['users','awards','active_days','checkin_sessions','weekly_ranking_snapshots','monthly_ranking_snapshots'].map(table=>db.prepare('SELECT * FROM '+table+' LIMIT 0').all()));return true;},
  async profile({username,session,owner},cutoff,now){
   let key;
   if(owner&&clean(username)==='nakataff'){key=(await db.prepare('SELECT user_key FROM users WHERE lower(username)=?1 ORDER BY last_interaction_at DESC LIMIT 1').bind('nakataff').first())?.user_key;}
   else{if(!/^[a-f0-9]{48}$/i.test(session||''))return null;const row=await db.prepare('SELECT user_key,username,verified_at FROM checkin_sessions WHERE session_id=?1').bind(session).first();if(!row?.verified_at||!row.user_key||clean(row.username)!==clean(username))return null;key=row.user_key;}
   if(!key)return null;
   const user=await db.prepare('SELECT u.user_key,u.username,u.points_all,(SELECT COALESCE(SUM(points),0) FROM awards WHERE user_key=u.user_key AND created_at>?2 AND created_at<=?3) AS newPoints FROM users u WHERE u.user_key=?1').bind(key,cutoff,now).first();if(!user)return null;
   const today=day(now),firstDay=day(cutoff),firstWeek=monday(firstDay);
   const [weeks,months,participationDays]=await Promise.all([
    all("SELECT date(day_key,'-'||((CAST(strftime('%w',day_key) AS INTEGER)+6)%7)||' days') AS week,COALESCE(SUM(CASE WHEN created_at>?2 AND created_at<=?3 THEN points ELSE 0 END),0) AS points FROM awards WHERE user_key=?1 AND day_key>=?4 AND day_key<=?5 GROUP BY week ORDER BY week",key,cutoff,now,firstWeek,today),
    all('SELECT DISTINCT month_key AS month FROM awards WHERE user_key=?1 AND month_key>=?2 AND month_key<=?3 ORDER BY month_key',key,firstDay.slice(0,7),today.slice(0,7)),
    all("SELECT DISTINCT day_key AS day FROM awards WHERE user_key=?1 AND day_key>=?2 AND day_key<=?3 AND created_at<=?4 AND points>0 AND type IN ('comment','story') ORDER BY day_key",key,'2026-10-01',today,now)
   ]);
   return {userKey:String(key),username:clean(user.username),retroPoints:Math.max(0,Number(user.points_all||0)-Number(user.newPoints||0)),weeks:weeks.map(r=>({week:r.week,points:Math.max(0,Number(r.points||0))})),months:months.map(r=>r.month),participationDays:participationDays.map(r=>r.day)};
  },
  async podium(type,key,now){
   const today=day(now);let start,end,table,column;
   if(type==='week'&&/^\d{4}-\d{2}-\d{2}$/.test(key)&&monday(key)===key&&key<monday(today)){start=key;end=shift(key,6);table='weekly_ranking_snapshots';column='week_key';}
   else if(type==='month'&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(key)&&key<today.slice(0,7)){start=key+'-01';const d=new Date(start+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(d.getUTCDate()-1);end=d.toISOString().slice(0,10);table='monthly_ranking_snapshots';column='month_key';}
   else throw Error('O período do ranking ainda não terminou.');
   const stored=await db.prepare('SELECT payload FROM '+table+' WHERE '+column+'=?1').bind(key).first();let ranked;
   if(stored?.payload){const snapshot=JSON.parse(stored.payload);ranked=Object.entries(snapshot.users||{}).map(([userKey,r])=>({...r,userKey})).sort((a,b)=>Number(b.points||0)-Number(a.points||0)||Number(b.activeDays||0)-Number(a.activeDays||0)||Number(b.storyMentions||0)-Number(a.storyMentions||0)||Number(b.comments||0)-Number(a.comments||0)||compareText(String(a.username),String(b.username)));}
   else ranked=await all(`WITH scores AS (SELECT user_key,MAX(username) AS username,SUM(points) AS points,SUM(CASE WHEN type='story' THEN 1 ELSE 0 END) AS storyMentions,SUM(CASE WHEN type='comment' THEN 1 ELSE 0 END) AS comments FROM awards WHERE day_key BETWEEN ?1 AND ?2 GROUP BY user_key),days AS (SELECT user_key,COUNT(*) AS activeDays FROM active_days WHERE day_key BETWEEN ?1 AND ?2 GROUP BY user_key) SELECT s.user_key AS userKey,COALESCE(u.username,s.username) AS username,s.points,s.storyMentions,s.comments,COALESCE(d.activeDays,0) AS activeDays FROM scores s LEFT JOIN users u ON u.user_key=s.user_key LEFT JOIN days d ON d.user_key=s.user_key ORDER BY points DESC,activeDays DESC,storyMentions DESC,comments DESC,username ASC LIMIT 3`,start,end);
   return {type,key,top3:ranked.slice(0,3).map((r,index)=>({userKey:String(r.userKey),position:index+1,points:Number(r.points||0)}))};
  }
 };
}
