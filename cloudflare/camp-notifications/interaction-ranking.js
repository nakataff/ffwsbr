// Read-only access to the existing interaction ranking database.
const clean=value=>String(value||'').replace(/^@+/,'').trim().toLowerCase();
const day=at=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));return ['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');};
const monday=value=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const shift=(value,n)=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const compareText=(a,b)=>a<b?-1:a>b?1:0;
export function createInteractionRanking(db){
 if(!db)return null;
 const all=async(q,...values)=>(await db.prepare(q).bind(...values).all()).results||[];
 return {
  async probe(){await Promise.all(['users','awards','active_days','checkin_sessions','weekly_ranking_snapshots','monthly_ranking_snapshots'].map(table=>db.prepare('SELECT * FROM '+table+' LIMIT 0').all()));return true;},
  async profile({username,session,owner},cutoff,now){
   let key;
   if(owner&&clean(username)==='nakataff'){key=(await db.prepare('SELECT user_key FROM users WHERE lower(username)=?1 ORDER BY last_interaction_at DESC LIMIT 1').bind('nakataff').first())?.user_key;}
   else{if(!/^[a-f0-9]{48}$/i.test(session||''))return null;const row=await db.prepare('SELECT user_key,username,verified_at FROM checkin_sessions WHERE session_id=?1').bind(session).first();if(!row?.verified_at||!row.user_key||clean(row.username)!==clean(username))return null;key=row.user_key;}
   if(!key)return null;
   const user=await db.prepare('SELECT u.user_key,u.username,u.points_all,(SELECT COALESCE(SUM(points),0) FROM awards WHERE user_key=u.user_key AND created_at>?2 AND created_at<=?3) AS newPoints FROM users u WHERE u.user_key=?1').bind(key,cutoff,now).first();if(!user)return null;
   const today=day(now),firstDay=day(cutoff),firstWeek=monday(firstDay);
   const [weeks,months]=await Promise.all([
    all("SELECT date(day_key,'-'||((CAST(strftime('%w',day_key) AS INTEGER)+6)%7)||' days') AS week,COALESCE(SUM(CASE WHEN created_at>?2 AND created_at<=?3 THEN points ELSE 0 END),0) AS points FROM awards WHERE user_key=?1 AND day_key>=?4 AND day_key<=?5 GROUP BY week ORDER BY week",key,cutoff,now,firstWeek,today),
    all('SELECT DISTINCT month_key AS month FROM awards WHERE user_key=?1 AND month_key>=?2 AND month_key<=?3 ORDER BY month_key',key,firstDay.slice(0,7),today.slice(0,7))
   ]);
   return {userKey:String(key),username:clean(user.username),retroPoints:Math.max(0,Number(user.points_all||0)-Number(user.newPoints||0)),weeks:weeks.map(r=>({week:r.week,points:Math.max(0,Number(r.points||0))})),months:months.map(r=>r.month)};
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
