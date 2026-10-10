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
module.exports={normalize,promote,totals};
