'use strict';
const crypto = require('crypto');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0,80);
function text(value, max=120) { return String(value || '').trim().slice(0,max); }
function integer(value, min, max) { if(value===null || value==='' || value===undefined || !Number.isInteger(Number(value)) || Number(value)<min || Number(value)>max) throw Error('Confira posição, abates e pontos.'); return Number(value); }
function result(input) { return {teamId:text(input.teamId,80),team:text(input.team,100),position:integer(input.position,1,100),kills:integer(input.kills,0,999),points:integer(input.points,0,9999)}; }
function eventId(tournament, day, drop, team, status) { return hash([tournament,day,drop,team,status].join(':')); }
function interested(preference,event) {
 if(preference?.enabled!==true)return false;
 const kind=event.kind||'elimination';
 if(kind==='start')return preference.types?.start===true;
 if(kind==='booyah')return preference.types?.booyah===true;
 if(kind==='elimination'&&preference.types?.elimination===false)return false;
 return preference.all===true || preference.teams?.[event.teamId]===true;
}
function officialRows(value, roster) {
  if(!value || value.manual || value.testMode || !value.source?.teams || !value.source?.players || !Object.keys(value.players||{}).length) return [];
  const teams=Object.values(value.teams||{}), players=Object.values(value.players||{});
  if(!teams.length) return [];
  // The importer validates T1/P1; also reject mismatched kill totals here.
  if(teams.some(t=>!players.some(p=>key(p.team)===key(t.team)) || players.filter(p=>key(p.team)===key(t.team)).reduce((n,p)=>n+Number(p.kills||0),0)!==Number(t.kills))) return [];
  return teams.flatMap(t=>{const id=Object.keys(roster||{}).find(id=>[roster[id].name,...(roster[id].aliases||[])].some(n=>key(n)===key(t.team)));if(!id)return [];try{return [result({teamId:id,team:roster[id].name,position:t.position,kills:t.kills,points:t.points})];}catch{return [];}});
}
function subscription(input) {
  const url=new URL(String(input?.endpoint||''));
  const allowed=url.hostname==='fcm.googleapis.com' || url.hostname==='updates.push.services.mozilla.com' || url.hostname==='push.services.mozilla.com' || url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.notify.windows.com');
  if(url.protocol!=='https:' || url.port || url.username || url.password || !allowed || url.href.length>2000 || !/^[A-Za-z0-9_-]{80,100}$/.test(input.keys?.p256dh||'') || !/^[A-Za-z0-9_-]{20,30}$/.test(input.keys?.auth||'')) throw Error('Inscrição do navegador inválida.');
  return {endpoint:url.href,keys:{p256dh:input.keys.p256dh,auth:input.keys.auth}};
}
module.exports={hash,key,text,integer,result,eventId,interested,officialRows,subscription};
