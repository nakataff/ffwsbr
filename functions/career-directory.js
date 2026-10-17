'use strict';
// Small indexed directory pages. Full career records stay on the server.
module.exports=function directory({rows,sql,pagination,key,text,fail,day,now,findTeam,revision,roles}){
 const live=(t='t',p='p')=>`COALESCE(json_extract(${t}.data,'$.deleted'),0)=0 AND json_extract(${t}.data,'$.status') IN ('active','loan','substitute') AND COALESCE(json_extract(${p}.data,'$.availability'),'unknown') NOT IN ('free_agent','retired') AND (COALESCE(json_extract(${t}.data,'$.start.date'),'')='' OR json_extract(${t}.data,'$.start.date')<=substr('${day(now())}',1,length(json_extract(${t}.data,'$.start.date')))) AND (COALESCE(json_extract(${t}.data,'$.end.date'),'')='' OR json_extract(${t}.data,'$.end.date')>=substr('${day(now())}',1,length(json_extract(${t}.data,'$.end.date'))))`;
 const visible="COALESCE(json_extract(t.data,'$.deleted'),0)=0";
 const exists=condition=>`EXISTS(SELECT 1 FROM career_tenures t WHERE t.person=p.id AND ${condition})`;
 const checks=()=>({imported:exists(visible+" AND json_extract(t.data,'$.status')='unverified'"),missing:exists(visible+" AND ((COALESCE(json_extract(t.data,'$.start.date'),'')='' AND COALESCE(json_extract(t.data,'$.start.edition'),'')='') OR (json_extract(t.data,'$.status')='ended' AND COALESCE(json_extract(t.data,'$.end.date'),'')='' AND COALESCE(json_extract(t.data,'$.end.edition'),'')=''))"),conflict:`(SELECT COUNT(DISTINCT t.team) FROM career_tenures t WHERE t.person=p.id AND ${live()})>1`});
 function source(id){const last=rows('SELECT kind,at FROM career_changes WHERE person=? ORDER BY at DESC,rowid DESC LIMIT 1',id)[0];return {origin:last?last.kind==='registrationSync'?'registration':last.kind==='historicalRosterSync'?'imported':'manual':'imported',lastChangedAt:last?.at||0};}
 function personSummary(p){const data=JSON.parse(p.data),current=rows(`SELECT DISTINCT tm.id,tm.name,json_extract(t.data,'$.role') AS role FROM career_tenures t JOIN career_teams tm ON tm.id=t.team JOIN career_people p ON p.id=t.person WHERE t.person=? AND ${live()} ORDER BY tm.norm LIMIT 4`,p.id);return {id:p.id,name:p.name,kind:p.kind,revision:p.revision,availability:data.availability||'unknown',currentTeamHint:data.currentTeamHint||'',current,...source(p.id)};}
 function search(b){const {limit,offset}=pagination(b),q=key(text(b.query,100)),where=["(?='' OR p.norm LIKE ? OR EXISTS(SELECT 1 FROM career_aliases a WHERE a.person=p.id AND a.alias LIKE ?))"],args=[q,'%'+q+'%','%'+q+'%'];
  if(['player','staff'].includes(b.kind)){where.push(b.kind==='staff'?"(p.kind=? OR "+exists(visible+" AND json_extract(t.data,'$.role')<>'player'")+")":'p.kind=?');args.push(b.kind);}
  if(b.teamId||b.teamName){const t=findTeam(b.teamId||b.teamName);where.push(exists(visible+' AND t.team=?'+(b.teamScope==='all'?'':' AND '+live())));args.push(t?.id||'__missing__');}
  if(roles[b.role]){where.push(exists(visible+" AND json_extract(t.data,'$.role')=?"));args.push(b.role);}
  if(['free_agent','retired'].includes(b.availability)){where.push("json_extract(p.data,'$.availability')=?");args.push(b.availability);}
  else if(b.availability==='active')where.push(exists(live()));
  else if(['loan','substitute'].includes(b.availability)){where.push(exists(live()+" AND json_extract(t.data,'$.status')=?"));args.push(b.availability);}
  else if(b.availability==='unknown')where.push("COALESCE(json_extract(p.data,'$.availability'),'unknown') NOT IN ('free_agent','retired') AND NOT "+exists(live()));
  if(checks()[b.review])where.push(checks()[b.review]);
  const filter=where.join(' AND '),total=rows('SELECT COUNT(*) AS n FROM career_people p WHERE '+filter,...args)[0].n;
  const entries=rows('SELECT p.* FROM career_people p WHERE '+filter+' ORDER BY p.norm,p.id LIMIT ? OFFSET ?',...args,limit,offset).map(p=>{const entry=personSummary(p);if(b.review)entry.issues=Object.entries(checks()).filter(([,check])=>rows('SELECT 1 FROM career_people p WHERE p.id=? AND '+check,p.id).length).map(([id])=>id);return entry;});
  return {ok:true,entries,total,limit,offset,hasMore:offset+limit<total};
 }
 // Public bounded name/alias search backed by current saved career passages.
 function publicSearch(b){
  const q=key(text(b.query,80).trim());
  if(q.length<2)return {ok:true,entries:[],total:0,version:revision()};
  const limit=12,pattern='%'+q+'%',entries=rows(`SELECT p.* FROM career_people p
   WHERE p.norm LIKE ? OR EXISTS(SELECT 1 FROM career_aliases a WHERE a.person=p.id AND a.alias LIKE ?)
   ORDER BY CASE WHEN p.norm=? THEN 0 WHEN p.norm LIKE ? THEN 1 ELSE 2 END,p.norm,p.id LIMIT ?`,
   pattern,pattern,q,q+'%',limit).map(p=>{
    const data=JSON.parse(p.data),current=personSummary(p).current;
    const status=['free_agent','retired'].includes(data.availability)?data.availability:
      current.length?'active':'unknown';
    return {id:p.id,name:p.name,kind:p.kind==='staff'?'staff':'player',
      team:current.map(x=>x.name).join(' · '),
      role:current[0]?.role||data.defaultRole||'',
      status,photo:typeof data.photo==='string'&&data.photo.length<500?data.photo:'silhueta.webp',
      managed:p.revision>1};
   });
  return {ok:true,entries,total:entries.length,version:revision()};
 }
 const conflicts=id=>rows('SELECT DISTINCT b.alias,tm.id,tm.name FROM career_team_aliases a JOIN career_team_aliases b ON a.alias=b.alias AND a.team<>b.team JOIN career_teams tm ON tm.id=b.team WHERE a.team=? ORDER BY tm.norm LIMIT 5',id);
 const duplicate="EXISTS(SELECT 1 FROM career_team_aliases a JOIN career_team_aliases b ON a.alias=b.alias AND a.team<>b.team WHERE a.team=tm.id)";
 function teamSummary(row){const t=JSON.parse(row.data),counts=rows(`SELECT COUNT(DISTINCT CASE WHEN ${live()} AND json_extract(t.data,'$.role')='player' THEN t.person END) AS players,COUNT(DISTINCT CASE WHEN ${live()} AND json_extract(t.data,'$.role')<>'player' THEN t.person END) AS staff,COUNT(DISTINCT CASE WHEN ${live()} THEN t.person END) AS members,COUNT(*) AS tenures,SUM(CASE WHEN json_extract(t.data,'$.status')='unverified' THEN 1 ELSE 0 END) AS unverified FROM career_tenures t JOIN career_people p ON p.id=t.person WHERE t.team=? AND ${visible}`,t.id)[0];return {...t,revision:t.revision||1,state:t.state||'unknown',pageName:t.pageName||t.name,...counts};}
 function teams(b){const {limit,offset}=pagination(b),q=key(text(b.query,100)),where=["(?='' OR tm.norm LIKE ? OR EXISTS(SELECT 1 FROM career_team_aliases a WHERE a.team=tm.id AND a.alias LIKE ?))"],args=[q,'%'+q+'%','%'+q+'%'];
  if(['active','paused','historical','unknown'].includes(b.state)){where.push("COALESCE(json_extract(tm.data,'$.state'),'unknown')=?");args.push(b.state);}
  if(b.roster==='with'||b.roster==='empty')where.push((b.roster==='empty'?'NOT ':'')+`EXISTS(SELECT 1 FROM career_tenures t JOIN career_people p ON p.id=t.person WHERE t.team=tm.id AND ${live()})`);
  if(b.duplicates===true)where.push(duplicate);
  const filter=where.join(' AND '),total=rows('SELECT COUNT(*) AS n FROM career_teams tm WHERE '+filter,...args)[0].n;
  return {ok:true,entries:rows('SELECT tm.* FROM career_teams tm WHERE '+filter+' ORDER BY tm.norm,tm.id LIMIT ? OFFSET ?',...args,limit,offset).map(row=>({...teamSummary(row),...(b.duplicates===true?{conflicts:conflicts(row.id)}:{})})),total,limit,offset,hasMore:offset+limit<total};
 }
 function resolve(b){const name=text(b.name,100),team=findTeam(name),normalized=key(name),stem=key(name.replace(/\b(esports?|gaming|team)\b/ig,''));return {ok:true,team:team?{...team,revision:team.revision||1}:null,similar:team?[]:rows('SELECT id,name FROM career_teams WHERE norm LIKE ? OR ? LIKE \'%\'||norm||\'%\' ORDER BY norm LIMIT 5','%'+(stem||normalized)+'%',normalized)};}
 function teamDetail(b){const row=rows('SELECT * FROM career_teams WHERE id=?',findTeam(b.teamId||b.teamName)?.id||'')[0];if(!row)throw fail(404,'Equipe não encontrada.');const team={...teamSummary(row),conflicts:conflicts(row.id)},{limit,offset}=pagination(b),scope=['current','past','moves'].includes(b.scope)?b.scope:'current';
  const where=['t.team=?',visible],args=[team.id];if(b.kind==='player'){where.push("json_extract(t.data,'$.role')='player'");}else if(b.kind==='staff'){where.push("json_extract(t.data,'$.role')<>'player'");}
  if(roles[b.role]){where.push("json_extract(t.data,'$.role')=?");args.push(b.role);}
  const joins=' FROM career_tenures t JOIN career_people p ON p.id=t.person ',filter=where.join(' AND ');
  let entries,total;
  if(scope==='moves'){
   const fields="t.id AS tenureId,t.person AS personId,p.name,p.revision,json_extract(t.data,'$.role') AS role,t.ord,t.data";
   const events=`SELECT ${fields},'in' AS direction,json_extract(t.data,'$.start.date') AS date,json_extract(t.data,'$.start.edition') AS edition,json_extract(t.data,'$.start.certainty') AS certainty${joins}WHERE ${filter} AND (COALESCE(json_extract(t.data,'$.start.date'),'')<>'' OR COALESCE(json_extract(t.data,'$.start.edition'),'')<>'') UNION ALL SELECT ${fields},'out' AS direction,json_extract(t.data,'$.end.date') AS date,json_extract(t.data,'$.end.edition') AS edition,json_extract(t.data,'$.end.certainty') AS certainty${joins}WHERE ${filter} AND (COALESCE(json_extract(t.data,'$.end.date'),'')<>'' OR COALESCE(json_extract(t.data,'$.end.edition'),'')<>'')`;
   total=rows('SELECT COUNT(*) AS n FROM ('+events+')',...args,...args)[0].n;entries=rows('SELECT * FROM ('+events+") ORDER BY COALESCE(date,'') DESC,edition DESC,ord DESC,tenureId,direction LIMIT ? OFFSET ?",...args,...args,limit,offset).map(({data,ord,...r})=>({...r,boundary:{date:r.date||'',edition:r.edition||'',certainty:r.certainty}}));
  }else{
   where.push(scope==='current'?live():`NOT EXISTS(SELECT 1 FROM career_tenures x WHERE x.person=p.id AND x.team=t.team AND ${live('x')})`);
   const match=where.join(' AND ');total=rows('SELECT COUNT(*) AS n'+joins+'WHERE '+match,...args)[0].n;
   entries=rows('SELECT t.id,t.person,p.name,p.kind,p.revision,t.data'+joins+'WHERE '+match+' ORDER BY CASE WHEN json_extract(t.data,\'$.role\')=\'player\' THEN 0 ELSE 1 END,p.norm,t.ord DESC LIMIT ? OFFSET ?',...args,limit,offset).map(r=>{const t=JSON.parse(r.data),next=rows(`SELECT tm.name,tm.id FROM career_tenures n JOIN career_teams tm ON tm.id=n.team WHERE n.person=? AND n.ord>? AND COALESCE(json_extract(n.data,'$.deleted'),0)=0 ORDER BY n.ord,n.id LIMIT 1`,r.person,t.order)[0];return {...t,teamName:team.name,personId:r.person,name:r.name,kind:r.kind,revision:r.revision,nextTeam:next||null};});
  }
  return {ok:true,team,entries,total,offset,limit,scope,hasMore:offset+limit<total,version:revision()};
 }
 function reviewSummary(){return Object.fromEntries(Object.entries(checks()).map(([id,check])=>[id,rows('SELECT COUNT(*) AS n FROM career_people p WHERE '+check)[0].n]).concat([['duplicates',rows('SELECT COUNT(*) AS n FROM career_teams tm WHERE '+duplicate)[0].n]]));}
 function saveTeamProfile(identity,b){
  const old=b.teamId?findTeam(b.teamId):null;if(b.teamId&&!old)throw fail(404,'Equipe não encontrada.');if(old&&(old.revision||1)!==b.revision)throw fail(409,'Esta equipe mudou. Recarregue antes de salvar.');
  const name=text(b.name,100);if(name.length<2||!key(name))throw fail(400,'Informe o nome da equipe.');
  if(!['active','paused','historical','unknown'].includes(b.state))throw fail(400,'Confira a situação da organização.');
  const id=old?.id||key(name);if(!old&&(findTeam(name)||rows('SELECT id FROM career_teams WHERE id=?',id).length))throw fail(409,'Esta equipe já existe. Abra o cadastro encontrado.');
  const aliasesList=[...new Set([old?.name,old?.pageName,name,...(Array.isArray(b.aliases)?b.aliases:[])].filter(Boolean).map(n=>text(n,100)))];if(aliasesList.length>40)throw fail(400,'Use até 40 nomes alternativos.');
  const priorKeys=new Set([old?.id,old?.name,...old?.aliases||[]].filter(Boolean).map(key));
  for(const alias of [name,...aliasesList]){if(priorKeys.has(key(alias)))continue;if(rows('SELECT team FROM career_team_aliases WHERE alias=? AND team<>? LIMIT 1',key(alias),id).length)throw fail(409,'O nome “'+alias+'” já pertence a outra equipe. Confira os nomes alternativos.');}
  let logo=text(b.logo,95000)||'escudo.webp';if(!validLogo(logo))throw fail(400,'Use uma imagem PNG/WebP, um caminho do site ou um link HTTPS válido para o escudo.');
  if(logo.startsWith('data:')){const imageId=crypto.randomUUID();sql.exec('INSERT INTO career_team_logos VALUES(?,?)',imageId,logo);logo='https://cff-camp-notifications.nakataffb4.workers.dev/careers/logo/'+imageId;}
  const next={...(old||{}),id,name,short:text(b.short,12),state:b.state,logo,aliases:aliasesList,pageName:old?.pageName||old?.name||name,metadataManaged:true,revision:(old?(old.revision||1):0)+1,updatedAt:now()};
  sql.exec('INSERT OR REPLACE INTO career_teams VALUES(?,?,?,?)',id,name,key(name),JSON.stringify(next));sql.exec('DELETE FROM career_team_aliases WHERE team=?',id);for(const alias of new Set([id,...aliasesList].map(key).filter(Boolean)))sql.exec('INSERT INTO career_team_aliases VALUES(?,?)',alias,id);
  sql.exec('INSERT INTO career_team_changes VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,now(),identity.uid,old?JSON.stringify(old):'null',next.revision);sql.exec("UPDATE career_meta SET value=value+1 WHERE id='version'");
  return {ok:true,team:next};
 }
 function validLogo(value){if(value.length>94000)return false;if(/^data:image\/(webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return true;if(/^https:\/\//i.test(value)){try{const u=new URL(value);return !!u.hostname&&!u.username&&!u.password;}catch{return false;}}return /^\/?[A-Za-z0-9_ %().\/-]+\.(webp|png|jpe?g)(?:\?[A-Za-z0-9_=&%.-]+)?$/i.test(value)&&!value.startsWith('//')&&!value.split('/').includes('..');}
 function teamHistory(b){const id=findTeam(b.teamId)?.id;if(!id)throw fail(404,'Equipe não encontrada.');return {ok:true,entries:rows('SELECT id,at,after_revision AS revision FROM career_team_changes WHERE team=? ORDER BY at DESC,rowid DESC LIMIT 20',id)};}
 return {search,publicSearch,teams,resolve,teamDetail,reviewSummary,saveTeamProfile,teamHistory,source};
};
