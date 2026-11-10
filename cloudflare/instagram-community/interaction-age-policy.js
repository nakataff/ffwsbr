// Regras do ranking a partir de 10/11/2026. Datas sempre em America/Sao_Paulo.
// Eventos anteriores não são reprocessados; a política é aplicada só aos novos créditos.
export const INTERACTION_DAILY_CAP=25;
export const AGE_POLICY_VERSION='20261110-post-age-v1';
export function brDay(timestamp){
 if(!Number.isFinite(Number(timestamp))||Number(timestamp)<=0)return '';
 const fields=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Number(timestamp)));
 const part=type=>fields.find(x=>x.type===type)?.value||'';
 return part('year')+'-'+part('month')+'-'+part('day');
}
export function brWeek(day){
 if(!/^\d{4}-\d\d-\d\d$/.test(day||''))return '';
 const d=new Date(day+'T12:00:00Z');
 if(!Number.isFinite(d.getTime()))return '';
 d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
 return d.toISOString().slice(0,10);
}
export function interactionAgePoints(kind,publishedAt,eventAt){
 const published=Number(publishedAt),event=Number(eventAt);
 if(!Number.isFinite(published)||!Number.isFinite(event)||published<=0||event<=0||published>event+300000)return 0;
 const from=brDay(published),to=brDay(event);
 if(!from||!to||brWeek(from)!==brWeek(to)||from>to)return 0;
 if(from===to)return kind==='comment'?2:kind==='story'?5:0;
 if(kind==='comment')return 1;
 if(kind!=='story')return 0;
 const yesterday=new Date(to+'T12:00:00Z');
 yesterday.setUTCDate(yesterday.getUTCDate()-1);
 return from===yesterday.toISOString().slice(0,10)?2:1;
}
// SQL triggers are the final atomic guard, including concurrent webhooks and story approvals.
// Only comment/story base points count toward the 25-point daily interaction limit.
export const INTERACTION_POLICY_SCHEMA=[
 "CREATE INDEX IF NOT EXISTS idx_awards_daily_interaction ON awards(user_key,day_key,type)",
 "DROP TRIGGER IF EXISTS cff_interaction_daily_cap_v1",
 "CREATE TRIGGER cff_interaction_daily_cap_v1 BEFORE INSERT ON awards WHEN NEW.type IN ('comment','story') AND NEW.points>0 AND (SELECT COALESCE(SUM(points),0) FROM awards WHERE user_key=NEW.user_key AND day_key=NEW.day_key AND type IN ('comment','story')) + NEW.points > 25 BEGIN SELECT RAISE(ABORT,'interaction_daily_limit'); END"
];
