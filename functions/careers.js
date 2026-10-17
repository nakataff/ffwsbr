'use strict';
const DEFAULT_SEED=require('./career-seed.json');
const DEFAULT_REGISTRATION=require('./career-registrations.json');
const createDirectory=require('./career-directory');
const createMarket=require('./career-market');
const ROLES={player:'Jogador',head_coach:'Head coach',coach:'Coach',assistant_coach:'Assistant coach',analyst:'Analista',manager:'Manager',other:'Outro'};
const STATUS={unverified:'A revisar',active:'Ativo',ended:'Encerrado',loan:'Empréstimo',substitute:'Substituto'};
const fail=(status,message)=>Object.assign(Error(message),{status});
const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const text=(v,max=100)=>String(v??'').trim().slice(0,max);
const day=now=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');};
function boundary(value={}){
 if(value.date!=null&&String(value.date).trim().length>10)throw fail(400,'Confira a data informada.');
 let date=text(value.date,10);if(/^\d{2}\/\d{2}\/\d{4}$/.test(date))date=date.split('/').reverse().join('-');else if(/^\d{2}\/\d{4}$/.test(date))date=date.slice(3)+'-'+date.slice(0,2);
 const edition=text(value.edition,100),certainty=['confirmed','estimated','unknown'].includes(value.certainty)?value.certainty:'unknown';let precision='unknown';
 if(date){if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date)precision='day';else if(/^\d{4}-(0[1-9]|1[0-2])$/.test(date))precision='month';else if(/^(19|20)\d{2}$/.test(date))precision='year';else throw fail(400,'Use uma data válida: DD/MM/AAAA, MM/AAAA ou AAAA.');if(date<'1990'||date>'2099-12-31')throw fail(400,'Confira o ano da data.');}
 else if(edition)precision='edition';
 return {date,edition,precision,certainty:precision==='unknown'?'unknown':certainty==='unknown'?'estimated':certainty};
}
const bounds=(b,end=false)=>!b?.date?'':b.precision==='year'?b.date+(end?'-12-31':'-01-01'):b.precision==='month'?end?new Date(Date.UTC(Number(b.date.slice(0,4)),Number(b.date.slice(5,7)),0)).toISOString().slice(0,10):b.date+'-01':b.date;
function init(sql){sql.exec(`CREATE TABLE IF NOT EXISTS career_people(id TEXT PRIMARY KEY,name TEXT,norm TEXT,kind TEXT,data TEXT,revision INTEGER,updated_at INTEGER);
 CREATE INDEX IF NOT EXISTS career_people_norm ON career_people(norm,id);
 CREATE TABLE IF NOT EXISTS career_aliases(alias TEXT,person TEXT,PRIMARY KEY(alias,person));
 CREATE TABLE IF NOT EXISTS career_teams(id TEXT PRIMARY KEY,name TEXT,norm TEXT,data TEXT);
 CREATE TABLE IF NOT EXISTS career_team_aliases(alias TEXT,team TEXT,PRIMARY KEY(alias,team));
 CREATE TABLE IF NOT EXISTS career_tenures(id TEXT PRIMARY KEY,person TEXT,team TEXT,ord INTEGER,data TEXT);
 CREATE INDEX IF NOT EXISTS career_tenures_person ON career_tenures(person,ord,id);
 CREATE INDEX IF NOT EXISTS career_tenures_team ON career_tenures(team,person);
 CREATE TABLE IF NOT EXISTS career_changes(id TEXT PRIMARY KEY,person TEXT,at INTEGER,actor TEXT,kind TEXT,before_data TEXT,after_revision INTEGER);
 CREATE INDEX IF NOT EXISTS career_changes_person ON career_changes(person,at DESC);
 CREATE TABLE IF NOT EXISTS career_requests(nonce TEXT PRIMARY KEY,actor TEXT,body TEXT,response TEXT);
 CREATE TABLE IF NOT EXISTS career_team_logos(id TEXT PRIMARY KEY,data TEXT);
 CREATE TABLE IF NOT EXISTS career_team_changes(id TEXT PRIMARY KEY,team TEXT,at INTEGER,actor TEXT,before_data TEXT,after_revision INTEGER);
 CREATE INDEX IF NOT EXISTS career_team_changes_team ON career_team_changes(team,at DESC);
 CREATE TABLE IF NOT EXISTS career_meta(id TEXT PRIMARY KEY,value INTEGER);`);}
function create({sql,transaction,seed=DEFAULT_SEED,registration=seed===DEFAULT_SEED?DEFAULT_REGISTRATION:null,now=()=>Date.now()}){
 const rows=(q,...args)=>{const r=sql.exec(q,...args);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
 function aliases(id,values,table='career_aliases',column='person'){sql.exec('DELETE FROM '+table+' WHERE '+column+'=?',id);for(const alias of new Set(values.map(key).filter(Boolean)))sql.exec('INSERT OR IGNORE INTO '+table+' VALUES(?,?)',alias,id);}
 let ready=false;
 function ensure(){if(ready)return;init(sql);market.ensure();if(rows("SELECT value FROM career_meta WHERE id='seed'").length){syncRegistration();ready=true;return;}transaction(()=>{if(rows("SELECT value FROM career_meta WHERE id='seed'").length)return;for(const t of seed.teams){sql.exec('INSERT OR IGNORE INTO career_teams VALUES(?,?,?,?)',t.id,t.name,key(t.name),JSON.stringify(t));aliases(t.id,[t.id,t.name,...t.aliases||[]],'career_team_aliases','team');}for(const p of seed.people){const {tenures,...data}=p;sql.exec('INSERT OR IGNORE INTO career_people VALUES(?,?,?,?,?,?,?)',p.id,p.name,key(p.name),p.kind,JSON.stringify(data),1,now());aliases(p.id,[p.id,p.name,...p.aliases||[]]);for(const t of tenures)sql.exec('INSERT OR IGNORE INTO career_tenures VALUES(?,?,?,?,?)',t.id,p.id,t.teamId,t.order,JSON.stringify(t));}sql.exec("INSERT INTO career_meta VALUES('seed',1)");sql.exec("INSERT OR IGNORE INTO career_meta VALUES('version',1)");});syncRegistration();ready=true;}
 const revision=()=>rows("SELECT value FROM career_meta WHERE id='version'")[0]?.value||1;
 const records=id=>rows('SELECT data FROM career_tenures WHERE person=? ORDER BY ord,id',id).map(r=>JSON.parse(r.data));
 const active=t=>!t.deleted&&['active','loan','substitute'].includes(t.status)&&(!bounds(t.start)||bounds(t.start)<=day(now()))&&(!bounds(t.end,true)||bounds(t.end,true)>=day(now()));
 const ongoing=t=>!t.deleted&&['active','loan','substitute'].includes(t.status)&&(!bounds(t.end,true)||bounds(t.end,true)>=day(now()));
 function departureInfo(b){const end=boundary(b.departure);if(!end.date&&!end.edition)throw fail(400,'Informe a data ou edição da saída.');if(end.date&&bounds(end)>day(now()))throw fail(400,'A saída para F/A não pode ficar no futuro.');const sourceUrl=text(b.sourceUrl,1500);if(sourceUrl){let u;try{u=new URL(sourceUrl);}catch{throw fail(400,'Use um link HTTPS para a fonte.');}if(u.protocol!=='https:'||u.username||u.password)throw fail(400,'Use um link HTTPS para a fonte.');}return {end,reason:text(b.reason,500),source:text(b.source,250),sourceUrl};}
 function release(id,tenureIds,info,teamId){
  if(!Array.isArray(tenureIds)||tenureIds.length>200||new Set(tenureIds).size!==tenureIds.length)throw fail(400,'Confira as passagens selecionadas.');
  const all=records(id),chosen=tenureIds.map(tid=>all.find(t=>t.id===tid));
  if(chosen.some(t=>!t||t.deleted||t.status==='ended'||(teamId&&t.teamId!==teamId)))throw fail(409,'Uma passagem selecionada não pertence à equipe ou já foi encerrada. Atualize a lista.');
  if(teamId&&!chosen.length)throw fail(400,'Selecione ao menos uma passagem por pessoa.');
  if(all.some(t=>ongoing(t)&&!tenureIds.includes(t.id)))throw fail(409,'Há outro vínculo aberto neste cadastro. Encerre ou confira todos os vínculos antes de deixar a pessoa F/A.');
  for(const t of chosen){if(bounds(t.start)&&bounds(info.end,true)&&bounds(t.start)>bounds(info.end,true))throw fail(400,'A saída não pode ser anterior à entrada de '+t.teamName+'.');t.end=info.end;t.status='ended';t.departure={reason:info.reason,source:info.source,sourceUrl:info.sourceUrl};sql.exec('UPDATE career_tenures SET data=? WHERE id=? AND person=?',JSON.stringify(t),t.id,id);}
  const p=JSON.parse(rows('SELECT data FROM career_people WHERE id=?',id)[0].data);p.availability='free_agent';p.affiliationSource='manual';p.affiliationEdition=registration?.edition||'';p.freeAgentSince=info.end;p.freeAgentReason=info.reason;sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(p),id);
 }
 function departureCandidates(b){
  const t=findTeam(b.teamId||b.teamName);if(!t)throw fail(404,'Escolha uma equipe cadastrada.');const {limit,offset}=pagination(b),include=b.includeUnverified===true;
  const where="p.id IN(SELECT t.person FROM career_tenures t WHERE t.team=? AND COALESCE(json_extract(t.data,'$.deleted'),0)=0 AND ((json_extract(t.data,'$.status') IN ('active','loan','substitute') AND (COALESCE(json_extract(t.data,'$.end.date'),'')='' OR json_extract(t.data,'$.end.date')>=substr(?,1,length(json_extract(t.data,'$.end.date'))))) OR (?=1 AND json_extract(t.data,'$.status')='unverified'))) AND COALESCE(json_extract(p.data,'$.availability'),'unknown') NOT IN ('free_agent','retired')";
  const args=[t.id,day(now()),include?1:0],total=rows('SELECT COUNT(*) AS n FROM career_people p WHERE '+where,...args)[0].n;
  const entries=rows('SELECT id,name,kind,revision FROM career_people p WHERE '+where+' ORDER BY norm,id LIMIT ? OFFSET ?',...args,limit,offset).map(p=>{const all=records(p.id);return {personId:p.id,name:p.name,kind:p.kind,revision:p.revision,tenures:all.filter(x=>x.teamId===t.id&&!x.deleted&&(ongoing(x)||include&&x.status==='unverified')).map(({id,teamName,role,status,start,end})=>({id,teamName,role,status,start,end})),otherTeams:[...new Set(all.filter(x=>ongoing(x)&&x.teamId!==t.id).map(x=>x.teamName))]};});
  return {ok:true,team:t,entries,total,limit,offset,hasMore:offset+limit<total};
 }
 function syncRegistration(){
  if(!registration?.complete||!registration.edition||!registration.version)return;
  const marker='wb-registration:'+registration.version;if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
  transaction(()=>{
   const ids=new Set([...Object.keys(registration.previous||{}),...Object.keys(registration.entries||{})]);
   for(const id of ids){
    const before=snapshot(id);if(!before||before.person.kind!=='player')continue;
    const p=JSON.parse(before.person.data),override=['active','free_agent','retired'].includes(p.availability)&&(p.affiliationSource==='manual'?(p.affiliationEdition||registration.legacyOverrideEdition)===registration.edition:!p.affiliationSource&&before.person.revision>1&&(p.affiliationEdition||registration.legacyOverrideEdition)===registration.edition);
    if(override)continue;
    const current=registration.entries?.[id],previous=registration.previous?.[id],registered=!!current&&!current.left,all=records(id).filter(t=>!t.deleted),last=all.at(-1),unknown={date:'',edition:'',precision:'unknown',certainty:'unknown'};
    const endFor=t=>boundary({edition:(current?.left&&current.teamId===t.teamId?registration.edition:previous?.teamId===t.teamId?previous.edition:t.registrationEdition||t.end?.edition)||'',certainty:'estimated'});
    for(const t of all){if(ongoing(t)&&(!registered||t.teamId!==current.teamId)){t.status='ended';if(!t.end?.date)t.end=endFor(t);sql.exec('UPDATE career_tenures SET data=? WHERE id=?',JSON.stringify(t),t.id);}}
    if(registered){
     const team=saveTeam(current.teamName);let t=last&&last.teamId===team.id&&last.role==='player'&&last.status!=='ended'?{...last}:null;
     if(!t)t={id:'registration-'+crypto.randomUUID(),teamId:team.id,teamName:team.name,role:'player',order:Math.max(0,...all.map(t=>t.order))+1,source:'Inscrição '+registration.edition,sourceUrl:'',notes:'',start:{...unknown,edition:registration.edition,precision:'edition',certainty:'estimated'}};
     if(!t.start?.date&&!t.start?.edition)t.start={...unknown,edition:previous?.teamId===team.id?previous.edition:registration.edition,precision:'edition',certainty:'estimated'};
     t.status=current.status==='substitute'?'substitute':'active';t.end=unknown;t.registrationEdition=registration.edition;
     sql.exec('INSERT OR REPLACE INTO career_tenures VALUES(?,?,?,?,?)',t.id,id,t.teamId,t.order,JSON.stringify(t));p.availability='active';delete p.freeAgentSince;delete p.freeAgentReason;
    }else{
     if(last&&last.status!=='ended'){last.status='ended';if(!last.end?.date)last.end=endFor(last);sql.exec('UPDATE career_tenures SET data=? WHERE id=?',JSON.stringify(last),last.id);}
     p.availability='free_agent';p.freeAgentSince={...unknown,edition:registration.edition,precision:'edition',certainty:'estimated'};
    }
    p.affiliationSource='registration';p.affiliationEdition=registration.edition;sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(p),id);audit(id,{uid:'wb-registration-sync'},'registrationSync',before);
   }
   sql.exec('INSERT INTO career_meta VALUES(?,1)',marker);
  });
 }
 function person(id){const row=rows('SELECT * FROM career_people WHERE id=?',id)[0];if(!row)throw fail(404,'Pessoa não encontrada.');const p=JSON.parse(row.data),teams=new Map(rows('SELECT tm.id,tm.data FROM career_teams tm WHERE tm.id IN (SELECT team FROM career_tenures WHERE person=?)',id).map(t=>[t.id,JSON.parse(t.data)])),tenures=records(id).filter(t=>!t.deleted).map(t=>{const tm=teams.get(t.teamId);return {...t,teamName:tm?.name||t.teamName,teamPageName:tm?.pageName||tm?.name||t.teamName,logo:tm?.logo||'escudo.webp',logoManaged:!!tm?.metadataManaged};});return {...p,revision:row.revision,updatedAt:row.updated_at,tenures,current:['free_agent','retired'].includes(p.availability)?[]:tenures.filter(active),managed:row.revision>1,...directory.source(id),version:revision()};}

 function findPerson(query){const id=text(query.id,100),name=text(query.name,100);if(id&&rows('SELECT id FROM career_people WHERE id=?',id).length)return person(id);const candidates=rows('SELECT DISTINCT person AS id FROM career_aliases WHERE alias=? LIMIT 3',key(name||id));if(candidates.length>1)throw fail(409,'Nome ambíguo. Abra pelo identificador da pessoa.');if(!candidates.length)throw fail(404,'Pessoa não encontrada.');return person(candidates[0].id);}
 function findTeam(name){const exact=rows('SELECT * FROM career_teams WHERE id=?',text(name,100))[0];if(exact)return JSON.parse(exact.data);const matches=rows('SELECT t.data FROM career_teams t JOIN career_team_aliases a ON a.team=t.id WHERE a.alias=? LIMIT 2',key(name));if(matches.length>1)throw fail(409,'Nome de equipe ambíguo. Escolha a equipe pelo cadastro ou identificador.');if(!matches.length)return null;return JSON.parse(matches[0].data);}
 const pagination=b=>({limit:Math.min(20,Math.max(1,Number.isSafeInteger(Number(b.limit))?Number(b.limit):20)),offset:Math.min(10000,Math.max(0,Number.isSafeInteger(Number(b.offset))?Number(b.offset):0))});
 function team(query){if(query.identities){let names;try{names=JSON.parse(query.identities);}catch{throw fail(400,'Equipes inválidas.');}if(!Array.isArray(names)||names.length>20||names.some(n=>typeof n!=='string'||n.length>100))throw fail(400,'Consulte até 20 equipes por vez.');const teams=[...new Map(names.map(name=>{try{return findTeam(name);}catch(error){if(error.status===409)return null;throw error;}}).filter(t=>t?.metadataManaged).map(t=>[t.id,t])).values()];return {ok:true,teams,version:revision()};}const t=findTeam(query.id||query.name);if(!t)throw fail(404,'Equipe não encontrada.');if(query.metadata==='1')return {ok:true,team:t,version:revision()};const {limit,offset}=pagination(query),scope=query.scope==='current'?'current':'all',all=rows('SELECT t.person,t.data,p.name,p.data AS profile,p.revision FROM career_tenures t JOIN career_people p ON p.id=t.person WHERE t.team=? ORDER BY p.norm,t.ord',t.id).map(r=>{const tenure=JSON.parse(r.data),p=JSON.parse(r.profile);return {personId:r.person,name:r.name,photo:p.photo,managed:r.revision>1,...tenure,teamName:t.name,teamPageName:t.pageName||t.name,logo:t.logo,isCurrent:!['free_agent','retired'].includes(p.availability)&&active(tenure)};}).filter(t=>!t.deleted&&(scope!=='current'||t.isCurrent));return {ok:true,team:t,entries:all.slice(offset,offset+limit),total:all.length,offset,limit,hasMore:offset+limit<all.length,version:revision()};}
 function snapshot(id){const p=rows('SELECT * FROM career_people WHERE id=?',id)[0];return p?{person:p,tenures:rows('SELECT * FROM career_tenures WHERE person=?',id)}:null;}
 function restore(s,id){sql.exec('DELETE FROM career_tenures WHERE person=?',id);if(!s){sql.exec('DELETE FROM career_aliases WHERE person=?',id);sql.exec('DELETE FROM career_people WHERE id=?',id);return;}const p=s.person;sql.exec('INSERT OR REPLACE INTO career_people VALUES(?,?,?,?,?,?,?)',id,p.name,p.norm,p.kind,p.data,p.revision,p.updated_at);aliases(id,[id,p.name,...JSON.parse(p.data).aliases||[]]);for(const t of s.tenures)sql.exec('INSERT INTO career_tenures VALUES(?,?,?,?,?)',t.id,t.person,t.team,t.ord,t.data);}
 function audit(id,identity,kind,before){sql.exec('UPDATE career_people SET revision=revision+1,updated_at=? WHERE id=?',now(),id);const rev=rows('SELECT revision FROM career_people WHERE id=?',id)[0]?.revision||0;sql.exec('INSERT INTO career_changes VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),id,now(),identity.uid,kind,JSON.stringify(before),rev);sql.exec("UPDATE career_meta SET value=value+1 WHERE id='version'");}
 function saveTeam(name){const old=findTeam(name);if(old)return old;name=text(name,100);const id=key(name);if(!id||name.length<2)throw fail(400,'Informe a equipe.');const t={id,name,logo:'escudo.webp',aliases:[name]};sql.exec('INSERT INTO career_teams VALUES(?,?,?,?)',id,name,key(name),JSON.stringify(t));aliases(id,[id,name],'career_team_aliases','team');return t;}
 function cleanTenure(b,id,old){const name=b.teamId||b.teamName;if(!findTeam(name)&&b.confirmNewTeam!==true)throw fail(409,'Equipe nova. Confirme o cadastro da equipe antes de salvar a passagem.');const t=saveTeam(name),start=boundary(b.start),end=boundary(b.end);if(!ROLES[b.role]||!STATUS[b.status])throw fail(400,'Confira cargo e situação.');if(bounds(start)&&bounds(end,true)&&bounds(start)>bounds(end,true))throw fail(400,'A saída não pode ser anterior à entrada.');if(['active','loan','substitute'].includes(b.status)&&end.date&&bounds(end,true)<day(now()))throw fail(400,'Uma passagem encerrada no passado deve ter situação Encerrado.');const sourceUrl=text(b.sourceUrl,1500);if(sourceUrl){let u;try{u=new URL(sourceUrl);}catch{throw fail(400,'Use um link HTTPS para a fonte.');}if(u.protocol!=='https:'||u.username||u.password)throw fail(400,'Use um link HTTPS para a fonte.');}return {...(old?.departure?{departure:old.departure}:{}),id:id||crypto.randomUUID(),teamId:t.id,teamName:t.name,role:b.role,status:b.status,start,end,source:text(b.source,250),sourceUrl,notes:text(b.notes,1000),order:Number.isSafeInteger(Number(b.order))?Math.min(10000,Math.max(1,Number(b.order))):old?.order||records(b.personId).length+1};}
 function applyMarketCareer(e,b,identity){
  const before=snapshot(e.personId);if(!before)throw fail(404,'Pessoa não encontrada.');if(before.person.revision!==b.personRevision)throw fail(409,'A carreira mudou. Reabra a movimentação antes de aplicar.');
  if(!e.date||e.date>day(now()))throw fail(400,'Informe uma data efetiva até hoje para atualizar a carreira.');
  const all=records(e.personId),open=all.filter(ongoing),from=b.fromTenureId?all.find(t=>t.id===b.fromTenureId):null,origin=findTeam(e.fromId||e.fromName),destination=findTeam(e.toId||e.toName),fa=v=>['','semclube','semequipe','semequipefa','semclubefa','fa','freeagent'].includes(key(v));
  if(from&&(!ongoing(from)||!origin||from.teamId!==origin.id))throw fail(409,'A passagem de origem mudou. Confira o vínculo escolhido.');
  if(open.length&&(open.length!==1||!from||open[0].id!==from.id))throw fail(409,'Escolha a passagem atual de origem e confira os outros vínculos abertos.');
  if(!open.length&&from)throw fail(409,'Esta passagem já foi encerrada.');
  const end={date:e.date,certainty:'confirmed'},id=e.personId;let tenureId='';
  if(e.status==='contrato-renovado'){
   if(!from||!destination||destination.id!==from.teamId)throw fail(400,'Uma renovação precisa da mesma equipe atual na origem e no destino.');tenureId=from.id;
  }else if(fa(e.toName)){
   if(!from)throw fail(400,'Escolha a passagem que será encerrada.');release(id,[from.id],departureInfo({departure:end,source:e.source,sourceUrl:e.sourceUrl,reason:e.notes}));
  }else{
   if(!destination)throw fail(400,'Cadastre a equipe de destino na aba Times antes de aplicar a carreira.');if(from?.teamId===destination.id)throw fail(400,'Para a mesma equipe, use Contrato renovado.');
   if(from){if(bounds(from.start)>e.date)throw fail(400,'A saída não pode ser anterior à entrada.');from.end=boundary(end);from.status='ended';sql.exec('UPDATE career_tenures SET data=? WHERE id=? AND person=?',JSON.stringify(from),from.id,id);}
   if(all.filter(t=>!t.deleted).length>=200)throw fail(400,'Limite de passagens atingido.');const t=cleanTenure({personId:id,teamId:destination.id,role:e.role,status:'active',start:end,end:{},source:e.source,sourceUrl:e.sourceUrl,notes:e.notes},null);tenureId=t.id;sql.exec('INSERT INTO career_tenures VALUES(?,?,?,?,?)',t.id,id,t.teamId,t.order,JSON.stringify(t));
   const p=JSON.parse(before.person.data);p.availability='active';p.affiliationSource='manual';p.affiliationEdition=registration?.edition||'';delete p.freeAgentSince;delete p.freeAgentReason;sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(p),id);
  }
  audit(id,identity,'marketTransfer',before);return {tenureId,revision:before.person.revision+1};
 }
 const market=createMarket({sql,rows,transaction,text,fail,key,now,day,roles:ROLES,findTeam,person:id=>{const row=rows('SELECT name,data FROM career_people WHERE id=?',id)[0];if(!row)throw fail(404,'Pessoa não encontrada.');const p=JSON.parse(row.data);return {name:row.name,photo:p.photo};},applyCareer:applyMarketCareer,seed:seed===DEFAULT_SEED?require('./market-seed.json'):[]});
 const directory=createDirectory({rows,sql,pagination,key,text,fail,day,now,findTeam,revision,roles:ROLES});
 async function admin(identity,b){if(!identity?.admin)throw fail(403,'Somente administrador.');ensure();const op=b.operation;
  if(op==='marketList')return market.list(b);
  if(op==='marketHistory')return market.history(b.entryId);
  if(op==='search')return directory.search(b);
  if(op==='teams')return directory.teams(b);
  if(op==='teamDetail')return directory.teamDetail(b);
  if(op==='resolveTeam')return directory.resolve(b);
  if(op==='reviewSummary')return {ok:true,...directory.reviewSummary()};
  if(op==='teamHistory')return directory.teamHistory(b);
  if(op==='person')return {ok:true,person:person(text(b.personId,100)),roles:ROLES,statuses:STATUS};
  if(op==='departureCandidates')return departureCandidates(b);
  if(op==='history')return {ok:true,entries:rows('SELECT id,at,actor,kind,after_revision AS revision,CASE WHEN LENGTH(before_data)=4 THEN 0 ELSE 1 END AS canUndo FROM career_changes WHERE person=? ORDER BY at DESC,rowid DESC LIMIT 20',text(b.personId,100))};
  if(op==='summary')return {ok:true,people:rows('SELECT COUNT(*) AS n FROM career_people')[0].n,teams:rows('SELECT COUNT(*) AS n FROM career_teams')[0].n,tenures:rows("SELECT COUNT(*) AS n FROM career_tenures WHERE COALESCE(json_extract(data,'$.deleted'),0)=0")[0].n,version:revision()};
  if(!['savePerson','saveTenure','archiveTenure','transfer','undo','releasePerson','bulkDeparture','saveTeam','marketSave'].includes(op))throw fail(400,'Operação desconhecida.');
  if(!/^[a-f0-9-]{36}$/i.test(b.nonce||''))throw fail(400,'Reabra o formulário para preparar a alteração.');
  return transaction(()=>{
   const body=JSON.stringify(b),prior=rows('SELECT * FROM career_requests WHERE nonce=?',b.nonce)[0];if(prior){if(prior.actor!==identity.uid||prior.body!==body)throw fail(409,'Este pedido já foi usado em outra alteração.');return JSON.parse(prior.response);}
   if(op==='marketSave'){const result=market.save(identity,b);sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;}
   if(op==='saveTeam'){const result=directory.saveTeamProfile(identity,b);sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;}
   if(op==='bulkDeparture'){
    const t=findTeam(b.teamId);if(!t)throw fail(404,'Equipe não encontrada.');const members=b.members;
    if(!Array.isArray(members)||!members.length||members.length>100||members.some(p=>!p||typeof p.personId!=='string'||!Number.isSafeInteger(p.revision))||new Set(members.map(p=>p.personId)).size!==members.length)throw fail(400,'Selecione de 1 a 100 pessoas, sem repetições.');
    const info=departureInfo(b),affected=[];
    for(const member of members){const id=text(member.personId,100),before=snapshot(id);if(!before)throw fail(404,'Pessoa não encontrada.');if(before.person.revision!==member.revision)throw fail(409,'O cadastro de '+before.person.name+' mudou. Recarregue a lista; nenhuma saída foi aplicada.');release(id,member.tenureIds,info,t.id);audit(id,identity,'bulkDeparture',before);affected.push({id,name:before.person.name,revision:before.person.revision+1});}
    const result={ok:true,team:{id:t.id,name:t.name},affected,departure:info.end};sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;
   }
   const id=text(b.personId,100)||'person-'+crypto.randomUUID(),before=snapshot(id);if(before&&before.person.revision!==b.revision)throw fail(409,'Este cadastro foi alterado em outra janela. Atualize antes de salvar.');if(!before&&op!=='savePerson')throw fail(404,'Pessoa não encontrada.');
   if(op==='savePerson'){
    const name=text(b.name,100),kind=['player','staff'].includes(b.kind)?b.kind:'player',availability=['unknown','active','free_agent','retired'].includes(b.availability)?b.availability:'unknown',values=Array.isArray(b.aliases)?b.aliases.slice(0,30).map(a=>text(a,100)).filter(Boolean):[];if(name.length<2||!key(name))throw fail(400,'Informe o nome.');if(!before&&rows('SELECT person FROM career_aliases WHERE alias=? LIMIT 1',key(name)).length)throw fail(409,'Este nome já está no catálogo. Pesquise antes de criar outro cadastro.');
    if(before&&['free_agent','retired'].includes(availability)&&records(id).some(ongoing))throw fail(400,'Encerre a passagem ativa antes de marcar Sem equipe ou Aposentado.');
    const old=before?JSON.parse(before.person.data):{},data={...old,id,name,kind,availability,aliases:[...new Set([name,...values])],photo:old.photo||'silhueta.webp',currentTeamHint:old.currentTeamHint||''};sql.exec('INSERT OR REPLACE INTO career_people VALUES(?,?,?,?,?,?,?)',id,name,key(name),kind,JSON.stringify(data),before?.person.revision||0,now());if(before&&availability!==old.availability){data.affiliationSource='manual';data.affiliationEdition=registration?.edition||'';if(availability!=='free_agent'){delete data.freeAgentSince;delete data.freeAgentReason;}sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(data),id);}aliases(id,[id,name,...data.aliases]);
   }else if(op==='saveTenure'||op==='transfer'){
    if(records(id).filter(t=>!t.deleted).length>=200&&!b.tenure?.id)throw fail(400,'Limite de 200 passagens por pessoa.');const raw=b.tenure||{},old=raw.id?rows('SELECT data,person FROM career_tenures WHERE id=?',text(raw.id,150))[0]:null;if(raw.id&&(!old||old.person!==id))throw fail(404,'Passagem não encontrada nesta pessoa.');const t=cleanTenure({...raw,personId:id,confirmNewTeam:b.confirmNewTeam===true},old?raw.id:null,old?JSON.parse(old.data):null);
    if(op==='transfer'){const source=rows('SELECT * FROM career_tenures WHERE id=? AND person=?',text(b.fromTenureId,150),id)[0];if(!source)throw fail(404,'Escolha a passagem anterior.');const previous=JSON.parse(source.data);if(previous.deleted||previous.status==='ended')throw fail(409,'A passagem anterior já está encerrada.');const end=boundary(b.departure);if(!end.date&&!end.edition)throw fail(400,'Informe a saída ou a edição da passagem anterior.');if(bounds(previous.start)&&bounds(end,true)&&bounds(previous.start)>bounds(end,true))throw fail(400,'Confira a data de saída.');if(bounds(t.start)&&bounds(end)&&bounds(t.start)<bounds(end))throw fail(400,'A nova entrada não pode ser anterior à saída informada.');previous.end=end;previous.status='ended';sql.exec('UPDATE career_tenures SET data=? WHERE id=?',JSON.stringify(previous),source.id);}
    sql.exec('INSERT OR REPLACE INTO career_tenures VALUES(?,?,?,?,?)',t.id,id,t.teamId,t.order,JSON.stringify(t));if(['active','loan','substitute'].includes(t.status)){const profile=JSON.parse(rows('SELECT data FROM career_people WHERE id=?',id)[0].data);profile.availability='active';profile.affiliationSource='manual';profile.affiliationEdition=registration?.edition||'';delete profile.freeAgentSince;delete profile.freeAgentReason;sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(profile),id);}
   }else if(op==='releasePerson'){release(id,b.tenureIds,departureInfo(b));
   }else if(op==='archiveTenure'){const row=rows('SELECT data FROM career_tenures WHERE id=? AND person=?',text(b.tenureId,150),id)[0];if(!row)throw fail(404,'Passagem não encontrada.');const t=JSON.parse(row.data);t.deleted=true;sql.exec('UPDATE career_tenures SET data=? WHERE id=?',JSON.stringify(t),t.id);
   }else if(op==='undo'){const change=rows('SELECT * FROM career_changes WHERE id=? AND person=?',text(b.changeId,100),id)[0];if(!change||change.after_revision!==before.person.revision)throw fail(409,'Só é possível desfazer a última alteração deste cadastro.');const original=JSON.parse(change.before_data);if(!original)throw fail(400,'Para preservar o histórico, um cadastro novo não é removido por esta ação.');restore(original,id);sql.exec('UPDATE career_people SET revision=? WHERE id=?',before.person.revision,id);}
   audit(id,identity,op,before);const result={ok:true,person:person(id)};
   if(b.publishMarket===true&&['transfer','saveTenure'].includes(op)){
    const t=result.person.tenures.find(t=>t.id===b.tenure?.id)||result.person.tenures.find(t=>!before.tenures.some(old=>old.id===t.id));
    if(!t||!['active','loan','substitute'].includes(t.status))throw fail(400,'Publique uma passagem ativa ou use a aba Mercado para preparar um rascunho.');
    const previous=op==='transfer'?before.tenures.map(r=>JSON.parse(r.data)).find(t=>t.id===b.fromTenureId):null;
    result.market=market.save(identity,{entry:{id:'career-'+t.id,personId:id,role:t.role,status:'fechado',publication:'published',name:result.person.name,fromId:previous?.teamId||'',fromName:previous?.teamName||'',toId:t.teamId,toName:t.teamName,date:t.start.precision==='day'?t.start.date:'',source:t.source,sourceUrl:t.sourceUrl,notes:t.notes,careerTenureId:t.id,careerRevision:result.person.revision}},{fromCareer:true}).entry;
   }
sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;
  });
 }
 function publicRead(kind,query){ensure();if(kind==='market'){const result=market.list(query,true);return {...result,version:result.version+'-'+revision()};}if(kind!=='person')return team(query);const p=findPerson(query),entries=p.current.length?team({id:p.current[0].teamId,scope:'current',limit:20}).entries:[];p.teammates=entries.filter(t=>t.personId!==p.id).filter((t,i,a)=>a.findIndex(x=>x.personId===t.personId)===i).map(t=>({id:t.personId,name:t.name,photo:t.photo,role:t.role,teamId:t.teamId,teamName:t.teamName}));return {ok:true,person:p};}
 return {admin,publicRead,ensure,logo(id){ensure();if(!/^[a-f0-9-]{36}$/.test(id||''))return null;const value=rows('SELECT data FROM career_team_logos WHERE id=?',id)[0]?.data;if(!value)return null;const [header,base64]=value.split(',');return {type:header.includes('webp')?'image/webp':'image/png',base64};}};
}
module.exports={create,init,key,boundary,bounds,day,ROLES,STATUS};
