'use strict';
const C=require('./camp-notifications-core.js');
function normalize(input,roster){
 const day=C.integer(input.day,1,365),drop=C.integer(input.drop,1,999);
 const participants=[...new Set((Array.isArray(input.participants)?input.participants:[]).map(id=>C.text(id,80)))];
 if(!participants.length||participants.length>100||participants.some(id=>!Object.hasOwn(roster,id)))throw Error('Confira os times que jogam esta queda.');
 if(!Array.isArray(input.rows)||!input.rows.length||input.rows.length>participants.length)throw Error('Preencha ao menos um resultado real da queda.');
 const rows=input.rows.map(raw=>{const r=C.result(raw);if(!participants.includes(r.teamId)||r.position>participants.length||r.points<r.kills)throw Error('Confira posição, abates e pontos da queda.');return {...r,team:roster[r.teamId].name};}).sort((a,b)=>a.position-b.position);
 if(new Set(rows.map(r=>r.teamId)).size!==rows.length||new Set(rows.map(r=>r.position)).size!==rows.length)throw Error('Há time ou posição repetida na queda.');
 const headstart={};for(const [id,points] of Object.entries(input.headstart||{})){if(!Object.hasOwn(roster,id))throw Error('Time do bônus não cadastrado.');headstart[id]=C.integer(points,-10000,1000000);}
 return {day,drop,map:C.text(input.map,60),participants,rows,headstart,status:'partial',complete:rows.length===participants.length};
}
function promote(snapshot,official){
 const byId=new Map(official.map(r=>[r.teamId,r]));
 if(!snapshot.participants.every(id=>byId.has(id)))return snapshot;
 return {...snapshot,rows:snapshot.participants.map(id=>byId.get(id)).sort((a,b)=>a.position-b.position),status:'official',complete:true};
}
function totals(snapshots,roster,day){
 const rows=Object.entries(roster).map(([teamId,t])=>({teamId,team:t.name,points:0,kills:0,booyahs:0,matches:0,headstart:0,lastPoints:0})),map=new Map(rows.map(r=>[r.teamId,r])),bonus=new Map();
 let partial=false;
 for(const s of snapshots){if(day!==undefined&&s.day!==day)continue;partial ||= s.status!=='official';bonus.set(s.day,s.headstart||{});
  for(const r of s.rows){const t=map.get(r.teamId);if(!t)continue;t.points+=r.points;t.kills+=r.kills;t.booyahs+=Number(r.position===1);t.matches++;t.lastPoints=r.points;}
 }
 for(const values of bonus.values())for(const [id,points] of Object.entries(values)){const r=map.get(id);if(r){r.headstart+=points;r.points+=points;}}
 rows.sort((a,b)=>b.points-a.points||b.booyahs-a.booyahs||b.kills-a.kills||b.lastPoints-a.lastPoints||a.team.localeCompare(b.team));
 return {status:partial?'partial':'official',rows:rows.map((r,i)=>({...r,rank:i+1}))};
}
// Read-only union: importing official tables never creates inbox messages or push jobs.
function mergeOfficialMatches(saved,live,roster,stage){
 const merged=new Map(saved.map(s=>[s.day+':'+s.drop,s]));
 for(const [dayKey,drops] of Object.entries(live?.drops||{}))for(const [dropKey,value] of Object.entries(drops||{})){
  if(!value)continue;
  try{
   const day=C.integer(dayKey,1,365),drop=C.integer(dropKey,1,999);
   if(value.day!==undefined&&Number(value.day)!==day||value.drop!==undefined&&Number(value.drop)!==drop)continue;
   const rows=C.officialRows(value,roster),rawTeams=Object.values(value.teams||{});
   if(!rows.length||rows.length!==rawTeams.length)continue;
   const prior=merged.get(day+':'+drop),headstart={...(prior?.headstart||{})};
   const snapshot=normalize({day,drop,map:value.map||prior?.map||'',participants:rows.map(r=>r.teamId),rows,headstart},roster);
   const next=promote(snapshot,rows),changed=!prior||JSON.stringify(prior.rows)!==JSON.stringify(next.rows)||prior.status!=='official'||prior.map!==next.map;
   merged.set(day+':'+drop,{...next,source:'admin-dados',revision:changed?(prior?.revision||0)+1:prior.revision,at:Number(value.updatedAt)||prior?.at||0});
  }catch{/* Incomplete/invalid T1 + P1 must not replace a published table. */}
 }
 // The official second-phase bonus is applied once, at the first available day.
 if(stage==='segundaFase'&&merged.size){const firstDay=Math.min(...[...merged.values()].map(s=>s.day));const bonus={};for(const [name,value]of Object.entries(live?.bonus||{})){const id=Object.keys(roster).find(id=>[roster[id].name,...(roster[id].aliases||[])].some(alias=>C.key(alias)===C.key(name)));if(id&&Number.isInteger(Number(value)))bonus[id]=Number(value);}if(Object.keys(bonus).length)for(const [key,s]of merged)if(s.day===firstDay)merged.set(key,{...s,headstart:bonus});}
 return [...merged.values()].sort((a,b)=>a.day-b.day||a.drop-b.drop);
}
module.exports={normalize,promote,totals,mergeOfficialMatches};
