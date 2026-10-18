'use strict';
// This migration runs once per manifest version. Public reads only query one person's evidence.
module.exports=function({sql,rows,transaction,data,key,now,findTeam,records,snapshot,audit}){
 let ready=false;
 const family=role=>['coach','head_coach'].includes(role)?'coach':role;
 const rank=edition=>{const lbff=/^LBFF\s+(\d+)$/i.exec(edition||'');if(lbff)return Number(lbff[1]);const year=String(edition||'').match(/20\d{2}/)?.[0],split=String(edition||'').match(/S([12])$/)?.[1]||0;return year?1000+Number(year)*10+Number(split):Infinity;};
 const unique=list=>[...new Set(list.filter(Boolean))];
 function resolve(table,column,names){const values=unique(names.map(key));return values.length?rows(`SELECT DISTINCT ${column} AS id FROM ${table} WHERE alias IN (${values.map(()=>'?').join(',')})`,...values):[];}
 function addAliases(table,column,id,names){
  const accepted=[];
  for(const name of unique(names)){
   const alias=key(name);if(!alias)continue;
   if(rows(`SELECT ${column} FROM ${table} WHERE alias=? AND ${column}<>? LIMIT 1`,alias,id).length)continue;
   sql.exec(`INSERT OR IGNORE INTO ${table} VALUES(?,?)`,alias,id);accepted.push(name);
  }
  return accepted;
 }
 function ensure(){
  if(ready)return;
  sql.exec('CREATE TABLE IF NOT EXISTS career_roster_participations(person TEXT,competition TEXT,team TEXT,role TEXT,tenure TEXT,source TEXT,PRIMARY KEY(person,competition,team,role));');
  if(!data?.version){ready=true;return;}
  const marker='staff-history:'+data.version;
  if(rows('SELECT value FROM career_meta WHERE id=?',marker).length){ready=true;return;}
  transaction(()=>{
   if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
   const teamIds=new Map();let ambiguous=0,created=0,linked=0;
   for(const raw of data.teams){
    let team;try{team=findTeam(raw.id);}catch{}
    if(!team){const candidates=resolve('career_team_aliases','team',[raw.name,...raw.aliases]);if(candidates.length>1){ambiguous++;continue;}if(candidates.length===1)team=findTeam(candidates[0].id);}
    const id=team?.id||raw.id,accepted=addAliases('career_team_aliases','team',id,[id,raw.name,...raw.aliases]);
    const next=team?{...team,aliases:unique([...(team.aliases||[]),...accepted])}:{id,name:raw.name,logo:raw.logo||'escudo.webp',aliases:accepted,state:'historical'};
    if(!team||JSON.stringify(next)!==JSON.stringify(team)){
     if(team){next.revision=(team.revision||1)+1;sql.exec('INSERT INTO career_team_changes VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,now(),'lbff-staff-history',JSON.stringify(team),next.revision);}
     sql.exec('INSERT OR REPLACE INTO career_teams VALUES(?,?,?,?)',id,next.name,key(next.name),JSON.stringify(next));
    }
    teamIds.set(raw.id,id);
   }
   for(const raw of data.people){
    let row=rows('SELECT * FROM career_people WHERE id=?',raw.id)[0];
    if(!row){const candidates=resolve('career_aliases','person',[raw.name,...raw.aliases]).filter(p=>!(raw.excludeIds||[]).includes(p.id));if(candidates.length>1){ambiguous++;continue;}if(candidates.length===1)row=rows('SELECT * FROM career_people WHERE id=?',candidates[0].id)[0];}
    const id=row?.id||raw.id,before=row?snapshot(id):null;
    const accepted=addAliases('career_aliases','person',id,[id,raw.name,...raw.aliases]);
    let profile=row?JSON.parse(row.data):{id,name:raw.name,kind:'staff',photo:'silhueta.webp',availability:'unknown',defaultRole:raw.records.at(-1)?.role||'coach',aliases:[]};
    const oldAliases=profile.aliases||[];profile={...profile,aliases:unique([...oldAliases,...accepted])};
    let changed=!row||JSON.stringify(profile.aliases)!==JSON.stringify(oldAliases);
    if(!row){created++;sql.exec('INSERT INTO career_people VALUES(?,?,?,?,?,?,?)',id,profile.name,key(profile.name),profile.kind,JSON.stringify(profile),1,now());}
    else if(changed)sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(profile),id);
    const original=records(id),all=[...original],groups=[];
    for(const r of raw.records){const teamId=teamIds.get(r.teamId);if(!teamId)continue;const prior=groups.at(-1);if(prior?.teamId===teamId&&family(prior.role)===family(r.role))prior.records.push(r);else groups.push({teamId,role:r.role,records:[r]});}
    const used=new Set();let addedTenures=false;
    for(const group of groups){
     const ids=group.records.map(r=>r.competitionId),candidates=original.filter(t=>t.teamId===group.teamId&&(group.role==='other'?t.role!=='player':family(t.role)===family(group.role))),visible=candidates.filter(t=>!t.deleted);
     const explicit=visible.filter(t=>ids.some(id=>(t.competitionIds||[]).includes(id)));
     let target=explicit.length===1?explicit[0]:visible.length===1&&!used.has(visible[0].id)?visible[0]:null;
     // Archived passages and ambiguous repeat stints stay under administrator control.
     if(!target&&!candidates.length){
      const first=group.records[0],last=group.records.at(-1),team=findTeam(group.teamId),sorted=[...all].sort((a,b)=>a.order-b.order);
      const next=sorted.find(t=>rank(t.start?.edition)>rank(first.edition)&&(rank(t.start?.edition)!==Infinity||['active','loan','substitute'].includes(t.status)));
      const at=next?sorted.indexOf(next):sorted.length,previous=sorted[at-1],order=next?previous?(previous.order+next.order)/2:next.order-1:(previous?.order||0)+1;
      target={id:'staff-lbff-'+id+'-'+group.teamId+'-'+group.role+'-'+first.competitionId,teamId:team.id,teamName:team.name,role:group.role,status:'ended',order,
       start:{date:'',edition:first.edition,precision:'edition',certainty:'estimated'},end:{date:'',edition:last.edition,precision:'edition',certainty:'estimated'},
       source:'Comissão registrada nas competições do site',sourceUrl:'https://centralfreefire.com.br/'+first.source,
       notes:'Participações históricas registradas no site. As edições não comprovam datas de contratação ou saída nem vínculo atual.'};
      sql.exec('INSERT OR IGNORE INTO career_tenures VALUES(?,?,?,?,?)',target.id,id,team.id,order,JSON.stringify(target));all.push(target);changed=true;addedTenures=true;
     }
     if(target&&group.role!=='other')used.add(target.id);
     for(const r of group.records){sql.exec('INSERT INTO career_roster_participations VALUES(?,?,?,?,?,?) ON CONFLICT(person,competition,team,role) DO UPDATE SET tenure=excluded.tenure WHERE career_roster_participations.tenure=\'\' AND excluded.tenure<>\'\'',id,r.competitionId,group.teamId,target?.role||group.role,target?.id||'',r.source);linked++;}
    }
    // Insert between existing passages without changing their relative order.
    // The admin editor requires positive integer positions.
    if(addedTenures&&all.some(t=>!Number.isSafeInteger(t.order)||t.order<1)){
     all.sort((a,b)=>a.order-b.order).forEach((t,i)=>{if(t.order===i+1)return;t.order=i+1;sql.exec('UPDATE career_tenures SET ord=?,data=? WHERE id=? AND person=?',t.order,JSON.stringify(t),t.id,id);});
    }
    if(changed)audit(id,{uid:'lbff-staff-history'},'historicalRosterSync',before);
   }
   sql.exec('INSERT INTO career_meta VALUES(?,?)',marker,JSON.stringify({records:linked,created,ambiguous}));
   sql.exec("UPDATE career_meta SET value=value+1 WHERE id='version'");
  });ready=true;
 }
 function participations(id){return rows('SELECT competition AS id,team,role,tenure FROM career_roster_participations WHERE person=?',id);}
 return {ensure,participations};
};
