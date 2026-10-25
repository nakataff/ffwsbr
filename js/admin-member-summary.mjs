const dateFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
function dayKey(stamp){const parts=Object.fromEntries(dateFormat.formatToParts(new Date(stamp)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
export function memberSummary(directory={},links={},now=Date.now()){
 const today=dayKey(now),first=new Date(Date.parse(today+'T12:00:00Z')-6*86400000).toISOString().slice(0,10);
 const result={total:0,today:0,week:0,instagram:0};
 for(const [uid,member]of Object.entries(directory||{})){
  if(!member||typeof member!=='object'||Array.isArray(member))continue;
  result.total++;
  const stamp=Number(member.joinedAt);
  if(Number.isFinite(stamp)&&stamp>0&&stamp<=now){const day=dayKey(stamp);if(day===today)result.today++;if(day>=first&&day<=today)result.week++;}
  if(/^[a-z0-9_.]{1,64}$/i.test(String(links?.[uid]?.username||'')))result.instagram++;
 }
 return result;
}
export function watchMemberSummary({subscribe,render,clock=Date.now,schedule=setInterval,cancel=clearInterval}){
 let directory={},links={},membersState='loading',linksState='loading',active=true;
 const paint=()=>{if(active)render({counts:memberSummary(directory,links,clock()),membersState,linksState});};
 paint();
 const stopMembers=subscribe('communityMembers',value=>{if(!active)return;directory=value||{};membersState='ready';paint();},()=>{membersState='error';paint();});
 const stopLinks=subscribe('communityInstagramLinks',value=>{if(!active)return;links=value||{};linksState='ready';paint();},()=>{linksState='error';paint();});
 const timer=schedule(paint,60000);
 return()=>{active=false;stopMembers();stopLinks();cancel(timer);directory={};links={};};
}
