'use strict';
const CUTOFF=Date.parse('2026-10-13T23:44:00Z'),RATE=20,RETRO_RATE=5,RETRO_CAP=500,WEEK_CAP=10;
const PARTICIPATION_START='2026-10-01',PARTICIPATION_DAILY=40,PARTICIPATION_DAYS=25,PARTICIPATION_CAP=PARTICIPATION_DAILY*PARTICIPATION_DAYS;
const WEEK_BONUS=[5,3,2],MONTH_BONUS=[10,7,5];
const day=at=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));return ['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');};
const week=value=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);};
const safePoints=value=>Number.isSafeInteger(value)&&value>=0?value:0;
function init(sql){sql.exec(`CREATE TABLE IF NOT EXISTS eco_interaction_identities(user_key TEXT PRIMARY KEY,uid TEXT UNIQUE,username TEXT,retro_source INTEGER,retro_credit INTEGER);
 CREATE TABLE IF NOT EXISTS eco_interaction_claims(user_key TEXT,kind TEXT,period TEXT,points INTEGER,position INTEGER,PRIMARY KEY(user_key,kind,period));
 CREATE TABLE IF NOT EXISTS eco_interaction_periods(type TEXT,period TEXT,data TEXT,PRIMARY KEY(type,period));
 CREATE TABLE IF NOT EXISTS eco_interaction_sync(uid TEXT PRIMARY KEY,at INTEGER,data TEXT);`);}
function create({sql,transaction,db,ranking,credit,now}){
 const rows=(q,...args)=>{const r=sql.exec(q,...args);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
 function summary(uid){const cached=rows('SELECT data FROM eco_interaction_sync WHERE uid=?',uid)[0],data=cached?JSON.parse(cached.data):{status:ranking?'not_checked':'unavailable'};const person=rows('SELECT * FROM eco_interaction_identities WHERE uid=?',uid)[0],current=week(day(now()));const participation=person?rows('SELECT points,position FROM eco_interaction_claims WHERE user_key=? AND kind=? AND period=?',person.user_key,'monthly_participation',day(now()).slice(0,7))[0]:null;return {...data,participation:{daily:PARTICIPATION_DAILY,targetDays:PARTICIPATION_DAYS,cap:PARTICIPATION_CAP,days:participation?.position||0,credited:participation?.points||0,start:PARTICIPATION_START},rate:RATE,retroRate:RETRO_RATE,retroCap:RETRO_CAP,weeklyCap:WEEK_CAP,weeklyPodium:WEEK_BONUS,monthlyPodium:MONTH_BONUS,cutoff:CUTOFF,retroCredit:person?.retro_credit||0,retroSource:person?.retro_source||0,week:current,weekCredited:person?rows('SELECT points FROM eco_interaction_claims WHERE user_key=? AND kind=? AND period=?',person.user_key,'conversion',current)[0]?.points||0:0,topBonuses:person?rows("SELECT COALESCE(SUM(points),0) AS points FROM eco_interaction_claims WHERE user_key=? AND kind IN ('week_top3','month_top3')",person.user_key)[0].points:0};}
 const remember=(uid,data)=>sql.exec('INSERT OR REPLACE INTO eco_interaction_sync VALUES(?,?,?)',uid,now(),JSON.stringify({...data,day:day(now()),month:day(now()).slice(0,7)}));
 function upgradeRetroactive(uid){
  const person=rows('SELECT * FROM eco_interaction_identities WHERE uid=?',uid)[0];
  if(!person||Math.min(RETRO_CAP,Math.floor(safePoints(person.retro_source)/RETRO_RATE))<=person.retro_credit)return;
  transaction(()=>{
   const current=rows('SELECT * FROM eco_interaction_identities WHERE uid=?',uid)[0],total=Math.min(RETRO_CAP,Math.floor(safePoints(current.retro_source)/RETRO_RATE)),extra=total-current.retro_credit;
   if(extra<=0)return;
   credit(uid,extra,'interaction_retro_upgrade','interaction-retro-v2:'+current.user_key,'Complemento do bônus de interações anteriores');
   sql.exec('UPDATE eco_interaction_identities SET retro_credit=? WHERE uid=?',total,uid);
  });
 }
 async function sync(uid,force=false,knownProfile=null){
  upgradeRetroactive(uid);
  if(!ranking)return summary(uid);
  const today=day(now()),current=week(today),cached=rows('SELECT at,data FROM eco_interaction_sync WHERE uid=?',uid)[0];
  if(cached){const data=JSON.parse(cached.data),ttl=data.pendingPeriods?0:data.status==='ready'?900000:60000;if(data.week===current&&data.month===today.slice(0,7)&&(today<PARTICIPATION_START||data.day===today)&&now()-cached.at<(data.pendingPeriods||force&&data.status!=='ready'?0:force?60000:ttl))return summary(uid);}
  const profile=knownProfile||await db.get('userAccounts/'+uid+'/profile');if(!profile?.name||!/^[a-z0-9_]{3,24}$/.test(profile.username||'')||!['masculino','feminino'].includes(profile.gender)){remember(uid,{status:'registration_needed',week:current});return summary(uid);}
  const [link,community,owner]=await Promise.all(['communityInstagramLinks/'+uid,'userAccounts/'+uid+'/community','communityOwnerInstagram'].map(p=>db.get(p)));
  const isOwner=owner?.uid===uid&&owner.username==='nakataff',username=isOwner?'nakataff':String(link?.username||'').toLowerCase();
  if(!username||!isOwner&&!community?.session){remember(uid,{status:'instagram_needed',week:current});return summary(uid);}
  const report=await ranking.profile({username,session:community?.session,owner:isOwner},CUTOFF,now());if(!report){remember(uid,{status:'instagram_needed',week:current});return summary(uid);}
  if(typeof report.userKey!=='string'||!report.userKey||report.userKey.length>256||!Array.isArray(report.weeks)||!Array.isArray(report.months))throw Error('Não foi possível conferir o ranking de interações.');
  const conflict=rows('SELECT uid,user_key FROM eco_interaction_identities WHERE uid=? OR user_key=?',uid,report.userKey).find(r=>r.uid!==uid||r.user_key!==report.userKey);if(conflict){remember(uid,{status:'already_linked',week:current});return summary(uid);}
  const periods=[];for(const r of report.weeks)if(/^\d{4}-\d{2}-\d{2}$/.test(r.week)&&week(r.week)===r.week&&r.week>=week(day(CUTOFF))&&r.week<current)periods.push(['week',r.week]);for(const month of report.months)if(/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)&&month>=day(CUTOFF).slice(0,7)&&month<today.slice(0,7))periods.push(['month',month]);
  const due=periods.filter(([type,key])=>!rows('SELECT points FROM eco_interaction_claims WHERE user_key=? AND kind=? AND period=?',report.userKey,type+'_top3',key).length),pendingPeriods=Math.max(0,due.length-12);
  const podiums=[];for(const [type,key]of due.slice(0,12)){let data=rows('SELECT data FROM eco_interaction_periods WHERE type=? AND period=?',type,key)[0];if(data)podiums.push(JSON.parse(data.data));else{const value=await ranking.podium(type,key,now());if(value.type!==type||value.key!==key||!Array.isArray(value.top3)||value.top3.length>3||value.top3.some((r,i)=>typeof r.userKey!=='string'||r.position!==i+1))throw Error('Não foi possível conferir os vencedores do ranking.');podiums.push(value);}}
  transaction(()=>{
   const existing=rows('SELECT uid,user_key FROM eco_interaction_identities WHERE uid=? OR user_key=?',uid,report.userKey);if(existing.some(r=>r.uid!==uid||r.user_key!==report.userKey))throw Error('Este Instagram já recebeu os bônus em outra conta.');
   if(!existing.length){const source=safePoints(report.retroPoints),points=Math.min(RETRO_CAP,Math.floor(source/RETRO_RATE));sql.exec('INSERT INTO eco_interaction_identities VALUES(?,?,?,?,?)',report.userKey,uid,username,source,points);if(points)credit(uid,points,'interaction_retro','interaction-retro:'+report.userKey,'Bônus de interações anteriores');}
   else sql.exec('UPDATE eco_interaction_identities SET username=? WHERE uid=?',username,uid);
   for(const r of report.weeks){if(!/^\d{4}-\d{2}-\d{2}$/.test(r.week)||week(r.week)!==r.week||r.week<week(day(CUTOFF))||r.week>current)continue;const eligible=Math.min(WEEK_CAP,Math.floor(safePoints(r.points)/RATE)),paid=rows('SELECT points FROM eco_interaction_claims WHERE user_key=? AND kind=? AND period=?',report.userKey,'conversion',r.week)[0]?.points||0;if(eligible>paid){credit(uid,eligible-paid,'interaction_week','interaction-week:'+report.userKey+':'+r.week+':'+eligible,'Interações da semana de '+r.week);sql.exec('INSERT OR REPLACE INTO eco_interaction_claims VALUES(?,?,?,?,?)',report.userKey,'conversion',r.week,eligible,0);}}
   const participationMonths=new Map();
   for(const date of new Set(Array.isArray(report.participationDays)?report.participationDays:[])){
    if(typeof date!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date<PARTICIPATION_START||date>today)continue;
    const month=date.slice(0,7);participationMonths.set(month,(participationMonths.get(month)||0)+1);
   }
   for(const [month,days] of participationMonths){
    const eligible=Math.min(PARTICIPATION_CAP,days*PARTICIPATION_DAILY),paid=rows('SELECT points FROM eco_interaction_claims WHERE user_key=? AND kind=? AND period=?',report.userKey,'monthly_participation',month)[0]?.points||0;
    if(eligible>paid){credit(uid,eligible-paid,'interaction_participation','interaction-participation:'+report.userKey+':'+month+':'+eligible,'Participação mensal: '+month);sql.exec('INSERT OR REPLACE INTO eco_interaction_claims VALUES(?,?,?,?,?)',report.userKey,'monthly_participation',month,eligible,Math.min(PARTICIPATION_DAYS,days));}
   }
   for(const podium of podiums){sql.exec('INSERT OR IGNORE INTO eco_interaction_periods VALUES(?,?,?)',podium.type,podium.key,JSON.stringify(podium));const frozen=JSON.parse(rows('SELECT data FROM eco_interaction_periods WHERE type=? AND period=?',podium.type,podium.key)[0].data),kind=frozen.type+'_top3';if(rows('SELECT points FROM eco_interaction_claims WHERE user_key=? AND kind=? AND period=?',report.userKey,kind,frozen.key).length)continue;const position=frozen.top3.find(r=>r.userKey===report.userKey)?.position||0,points=(frozen.type==='week'?WEEK_BONUS:MONTH_BONUS)[position-1]||0;if(points)credit(uid,points,'interaction_'+kind,'interaction-'+kind+':'+report.userKey+':'+frozen.key,position+'º lugar '+(frozen.type==='week'?'da semana de ':'do mês de ')+frozen.key);sql.exec('INSERT INTO eco_interaction_claims VALUES(?,?,?,?,?)',report.userKey,kind,frozen.key,points,position);}
   remember(uid,{status:'ready',username,week:current,pendingPeriods,weekPoints:safePoints(report.weeks.find(r=>r.week===current)?.points||0),updatedAt:now()});
  });return summary(uid);
 }
 return {sync,summary};
}
module.exports={init,create,CUTOFF,RATE,RETRO_RATE,RETRO_CAP,WEEK_CAP,WEEK_BONUS,MONTH_BONUS,PARTICIPATION_START,PARTICIPATION_DAILY,PARTICIPATION_DAYS,PARTICIPATION_CAP};
