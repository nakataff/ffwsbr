'use strict';
const TeamIdentity=require('../js/team-identity-history.js');
const DEFAULT_SEED=require('./career-seed.json');
const DEFAULT_REGISTRATION=require('./career-registrations.json');
const STAFF_S2=require('./career-staff-s2.json');
const STAFF_HISTORY=require('./career-staff-history.json');
const createStaffHistory=require('./career-staff-history');
const createJokerIdentity=require('./career-joker-identity');
const createDirectory=require('./career-directory');
const createTournamentAssets=require('./career-tournament-assets');
const createCommunitySupporters=require('./community-supporters');
const createMarket=require('./career-market');
const createCompetitions=require('./career-competitions');
const COMPETITIONS_SEED=require('./career-competitions-seed.json');
const ROLES={player:'Jogador',head_coach:'Head coach',coach:'Coach',assistant_coach:'Assistant coach',analyst:'Analista',manager:'Manager',other:'Comissão / cargo não informado'};
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
 CREATE INDEX IF NOT EXISTS career_aliases_person ON career_aliases(person,alias);
 CREATE TABLE IF NOT EXISTS career_teams(id TEXT PRIMARY KEY,name TEXT,norm TEXT,data TEXT);
 CREATE TABLE IF NOT EXISTS career_team_aliases(alias TEXT,team TEXT,PRIMARY KEY(alias,team));
 CREATE INDEX IF NOT EXISTS career_team_aliases_team ON career_team_aliases(team,alias);
 CREATE TABLE IF NOT EXISTS career_tenures(id TEXT PRIMARY KEY,person TEXT,team TEXT,ord INTEGER,data TEXT);
 CREATE INDEX IF NOT EXISTS career_tenures_person ON career_tenures(person,ord,id);
 CREATE INDEX IF NOT EXISTS career_tenures_team ON career_tenures(team,person);
 CREATE TABLE IF NOT EXISTS career_changes(id TEXT PRIMARY KEY,person TEXT,at INTEGER,actor TEXT,kind TEXT,before_data TEXT,after_revision INTEGER);
 CREATE INDEX IF NOT EXISTS career_changes_person ON career_changes(person,at DESC);
 CREATE TABLE IF NOT EXISTS career_requests(nonce TEXT PRIMARY KEY,actor TEXT,body TEXT,response TEXT);
 CREATE TABLE IF NOT EXISTS career_team_logos(id TEXT PRIMARY KEY,data TEXT);
 CREATE TABLE IF NOT EXISTS career_team_changes(id TEXT PRIMARY KEY,team TEXT,at INTEGER,actor TEXT,before_data TEXT,after_revision INTEGER);
 CREATE INDEX IF NOT EXISTS career_team_changes_team ON career_team_changes(team,at DESC);
 CREATE TABLE IF NOT EXISTS community_supporters(id TEXT PRIMARY KEY,data TEXT);
 CREATE TABLE IF NOT EXISTS career_tournament_assets(id TEXT PRIMARY KEY,data TEXT);
 CREATE TABLE IF NOT EXISTS career_meta(id TEXT PRIMARY KEY,value INTEGER);`);}
function create({sql,transaction,seed=DEFAULT_SEED,registration=seed===DEFAULT_SEED?DEFAULT_REGISTRATION:null,staffRoster=seed===DEFAULT_SEED?STAFF_S2:null,staffHistory=seed===DEFAULT_SEED?STAFF_HISTORY:null,repairIdentities=seed===DEFAULT_SEED,now=()=>Date.now(),competitionsSeed=seed===DEFAULT_SEED?COMPETITIONS_SEED:{...COMPETITIONS_SEED,people:{}}}){
 const rows=(q,...args)=>{const r=sql.exec(q,...args);return typeof r.toArray==='function'?r.toArray():Array.from(r);};
 function aliases(id,values,table='career_aliases',column='person'){sql.exec('DELETE FROM '+table+' WHERE '+column+'=?',id);for(const alias of new Set(values.map(key).filter(Boolean)))sql.exec('INSERT OR IGNORE INTO '+table+' VALUES(?,?)',alias,id);}
 let ready=false;
 // Repair only the placeholder portrait in the already-persisted profile.
 // Do not override photos manually supplied by an administrator.
 function syncLuuukingPortrait(){
  const marker='profile-asset:luuuking-20261018-v1';
  if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
  transaction(()=>{
   if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
   const p=rows('SELECT data FROM career_people WHERE id=?','luuuking')[0];
   if(p){
    const data=JSON.parse(p.data);
    if(!data.photo||data.photo==='silhueta.webp'){
     data.photo='/luuuking.webp';
     sql.exec('UPDATE career_people SET data=?,revision=revision+1,updated_at=? WHERE id=?',JSON.stringify(data),now(),'luuuking');
     sql.exec("UPDATE career_meta SET value=value+1 WHERE id='version'");
    }
   }
   sql.exec('INSERT INTO career_meta VALUES(?,?)',marker,'1');
  });
 }
 // Evidência confirmada de participação do treinador Frois na FFWS BR 2026 S1,
 // ausente no seed histórico inicial. Não modifica vínculos atuais nem escolhas manuais.
 function syncFroisVirtusS1(){
  const marker='reviewed-frois-virtus-2026-s1-v1';
  if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
  transaction(()=>{
   if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
   const personRow=rows('SELECT * FROM career_people WHERE id=?','frois')[0];
   const team=rows('SELECT data FROM career_teams WHERE id=?','virtuspro')[0];
   if(personRow&&team){
    const old=JSON.parse(personRow.data);
    const before=snapshot('frois');
    const ts=records('frois'),existing=ts.find(t=>!t.deleted&&t.teamId==='virtuspro'&&['coach','head_coach'].includes(t.role));
    let changed=false;
    if(!existing){
     const t={id:'reviewed-frois-virtus-2026-s1',teamId:'virtuspro',teamName:'VIRTUS PRO',role:'coach',status:'ended',
      order:Math.max(0,...ts.map(t=>t.order||0))+1,
      start:{date:'2026-01-28',precision:'day',certainty:'confirmed',edition:'FFWS BR 2026 S1'},
      end:{date:'2026-06-06',precision:'day',certainty:'confirmed',edition:'FFWS BR 2026 S1'},
      competitionIds:['ffwsbr2026s1'],
      source:'Anúncio oficial da Virtus.pro e escalação da FFWS BR 2026 S1',
      sourceUrl:'https://virtus.pro/news/virtus-pro-return-to-free-fire',
      notes:'Treinador registrado pela Virtus.pro na edição; passagem histórica encerrada, não é vínculo atual.'};
     sql.exec('INSERT OR IGNORE INTO career_tenures VALUES(?,?,?,?,?)',t.id,'frois',t.teamId,t.order,JSON.stringify(t));
     changed=true;
    }else if(!Array.isArray(existing.competitionIds)){
     existing.competitionIds=['ffwsbr2026s1'];
     sql.exec('UPDATE career_tenures SET data=? WHERE id=? AND person=?',JSON.stringify(existing),existing.id,'frois');
     changed=true;
    }
    if(!old.photo||old.photo==='silhueta.webp'){
     old.photo='/assets/coaches/frois.webp';
     sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(old),'frois');
     changed=true;
    }
    if(changed)audit('frois',{uid:'verified-tournament-roster'},'rosterEvidenceSync',before);
   }
   sql.exec('INSERT INTO career_meta VALUES(?,?)',marker,'1');
  });
 }
 function ensure(){if(ready)return;init(sql);market.ensure();competitions.ensure();if(rows("SELECT value FROM career_meta WHERE id='seed'").length){syncRegistration();identityRepairs.ensure();syncStaffRoster();historicalStaff.ensure();syncLuuukingPortrait();syncFroisVirtusS1();ready=true;return;}transaction(()=>{if(rows("SELECT value FROM career_meta WHERE id='seed'").length)return;for(const t of seed.teams){sql.exec('INSERT OR IGNORE INTO career_teams VALUES(?,?,?,?)',t.id,t.name,key(t.name),JSON.stringify(t));aliases(t.id,[t.id,t.name,...t.aliases||[]],'career_team_aliases','team');}for(const p of seed.people){const {tenures,...data}=p;sql.exec('INSERT OR IGNORE INTO career_people VALUES(?,?,?,?,?,?,?)',p.id,p.name,key(p.name),p.kind,JSON.stringify(data),1,now());aliases(p.id,[p.id,p.name,...p.aliases||[]]);for(const t of tenures)sql.exec('INSERT OR IGNORE INTO career_tenures VALUES(?,?,?,?,?)',t.id,p.id,t.teamId,t.order,JSON.stringify(t));}sql.exec("INSERT INTO career_meta VALUES('seed',1)");sql.exec("INSERT OR IGNORE INTO career_meta VALUES('version',1)");});syncRegistration();identityRepairs.ensure();syncStaffRoster();historicalStaff.ensure();syncLuuukingPortrait();syncFroisVirtusS1();ready=true;}
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
 function syncStaffRoster(){
  if(!staffRoster?.version||!Array.isArray(staffRoster.people))return;
  const marker='staff-roster:'+staffRoster.version;
  if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
  transaction(()=>{
   if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
   for(const raw of staffRoster.people){
    const team=findTeam(raw.team);if(!team||!ROLES[raw.role])continue;
    const wanted=key(raw.name);if(!wanted)continue;
    let personId=raw.id&&rows('SELECT id FROM career_people WHERE id=?',raw.id)[0]?.id||'';
    if(!personId){
     const matches=rows('SELECT DISTINCT p.id FROM career_aliases a JOIN career_people p ON p.id=a.person WHERE a.alias=? LIMIT 3',wanted);
     if(matches.length===1)personId=matches[0].id;
     else if(matches.length>1){
      const withTeam=matches.filter(m=>records(m.id).some(t=>t.teamId===team.id&&t.role===raw.role));
      if(withTeam.length===1)personId=withTeam[0].id;else continue;
     }
    }
    const created=!personId;
    if(created)personId='staff-s2-'+wanted;
    const row=rows('SELECT * FROM career_people WHERE id=?',personId)[0];
    // Never reintroduce a staff member as active after an administrator has manually
    // recorded a release, transfer, new role or F/A status.
    if(row&&rows("SELECT 1 FROM career_changes WHERE person=? AND kind NOT IN ('registrationSync','staffRosterSync','historicalRosterSync','identitySplit') LIMIT 1",personId).length)continue;
    const before=row?snapshot(personId):null;
    const old=row?JSON.parse(row.data):{};
    const hadPlayerRole=records(personId).some(t=>t.role==='player');
    const data={...old,id:personId,name:row?.name||raw.name,
      aliases:old.aliases||[raw.name],photo:old.photo||'silhueta.webp',
      kind:old.kind||'staff',defaultRole:raw.role,
      availability:'active',currentTeamHint:team.name,
      affiliationSource:'staffRoster',affiliationEdition:staffRoster.edition,
      ...(personId==='luuuking'?{playerRetired:true}:{})};
    if(created){
     sql.exec('INSERT INTO career_people VALUES(?,?,?,?,?,?,?)',personId,data.name,key(data.name),data.kind,JSON.stringify(data),1,now());
     aliases(personId,[personId,data.name,...data.aliases]);
    }else{
     delete data.freeAgentSince;delete data.freeAgentReason;
     sql.exec('UPDATE career_people SET data=?,updated_at=? WHERE id=?',JSON.stringify(data),now(),personId);
    }
    const all=records(personId),existing=all.filter(t=>!t.deleted&&t.teamId===team.id&&t.role===raw.role).at(-1);
    if(existing){
     // A documented S2 roster confirms the role, but not the exact joining date.
     if(existing.status==='unverified'||existing.status==='ended'&&!existing.end?.date){
      existing.status='active';existing.end={date:'',edition:'',precision:'unknown',certainty:'unknown'};
      if(!existing.start?.date&&!existing.start?.edition)existing.start={date:'',edition:staffRoster.edition,precision:'edition',certainty:'estimated'};
      existing.source=staffRoster.source;existing.notes=existing.notes||'Inscrição de comissão na WB 2026 S2. Data exata de contratação não confirmada.';
      sql.exec('UPDATE career_tenures SET data=? WHERE id=?',JSON.stringify(existing),existing.id);
     }
    }else{
     const id='staff-s2-tenure-'+personId+'-'+team.id+'-'+raw.role;
     const t={id,teamId:team.id,teamName:team.name,role:raw.role,status:'active',
      order:Math.max(0,...all.map(t=>t.order||0))+1,
      start:{date:'',edition:staffRoster.edition,precision:'edition',certainty:'estimated'},
      end:{date:'',edition:'',precision:'unknown',certainty:'unknown'},
      source:staffRoster.source,sourceUrl:staffRoster.source,
      notes:'Equipe técnica registrada na WB 2026 S2; data exata de entrada não confirmada.'};
     sql.exec('INSERT OR IGNORE INTO career_tenures VALUES(?,?,?,?,?)',id,personId,team.id,t.order,JSON.stringify(t));
    }
    // A former player may continue as coach without retiring from esports.
    if(hadPlayerRole&&personId==='luuuking')data.playerRetired=true;
    sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(data),personId);
    audit(personId,{uid:'staff-roster-s2'},'staffRosterSync',before);
   }
   sql.exec('INSERT INTO career_meta VALUES(?,1)',marker);
  });
 }
 function syncRegistration(){
  if(!registration?.complete||!registration.edition||!registration.version)return;
  const marker='wb-registration:'+registration.version;if(rows('SELECT value FROM career_meta WHERE id=?',marker).length)return;
  transaction(()=>{
   const ids=new Set([...Object.keys(registration.previous||{}),...Object.keys(registration.entries||{})]);
   for(const id of ids){
    const before=snapshot(id);if(!before||before.person.kind!=='player'||records(id).some(t=>t.role!=='player'&&['active','loan','substitute'].includes(t.status)))continue;
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
 function person(id){const row=rows('SELECT * FROM career_people WHERE id=?',id)[0];if(!row)throw fail(404,'Pessoa não encontrada.');const p=JSON.parse(row.data),teams=new Map(rows('SELECT tm.id,tm.data FROM career_teams tm WHERE tm.id IN (SELECT team FROM career_tenures WHERE person=?)',id).map(t=>[t.id,JSON.parse(t.data)])),tenures=competitions.decorate(p,records(id).filter(t=>!t.deleted)).map(t=>{const tm=teams.get(t.teamId),at=active(t)?day(now()):t.end?.date||t.competitions?.map(c=>c.period?.endDate||c.period?.startDate).filter(Boolean).sort().at(-1)||t.start?.date,identity=TeamIdentity.select(tm||{},at);return {...t,teamName:identity.name||t.teamName,teamPageName:tm?.pageName||tm?.name||t.teamName,logo:identity.logo||'escudo.webp',logoManaged:!!tm?.metadataManaged,identityHistory:tm?.identityHistory||[]};});return {...p,revision:row.revision,updatedAt:row.updated_at,tenures,current:['free_agent','retired'].includes(p.availability)?[]:tenures.filter(active),managed:row.revision>1,...directory.source(id),version:revision()};}

 function findPerson(query){const id=text(query.id,100),name=text(query.name,100);if(id&&rows('SELECT id FROM career_people WHERE id=?',id).length)return person(id);const candidates=rows('SELECT DISTINCT person AS id FROM career_aliases WHERE alias=? LIMIT 3',key(name||id));if(candidates.length>1)throw fail(409,'Nome ambíguo. Abra pelo identificador da pessoa.');if(!candidates.length)throw fail(404,'Pessoa não encontrada.');return person(candidates[0].id);}
 function findTeam(name){const exact=rows('SELECT * FROM career_teams WHERE id=?',text(name,100))[0];if(exact)return TeamIdentity.select(JSON.parse(exact.data),day(now()));const matches=rows('SELECT t.data FROM career_teams t JOIN career_team_aliases a ON a.team=t.id WHERE a.alias=? LIMIT 2',key(name));if(matches.length>1)throw fail(409,'Nome de equipe ambíguo. Escolha a equipe pelo cadastro ou identificador.');if(!matches.length)return null;return TeamIdentity.select(JSON.parse(matches[0].data),day(now()));}
 const pagination=b=>({limit:Math.min(20,Math.max(1,Number.isSafeInteger(Number(b.limit))?Number(b.limit):20)),offset:Math.min(10000,Math.max(0,Number.isSafeInteger(Number(b.offset))?Number(b.offset):0))});
 function team(query){if(query.identities){let names;try{names=JSON.parse(query.identities);}catch{throw fail(400,'Equipes inválidas.');}if(!Array.isArray(names)||names.length>20||names.some(n=>typeof n!=='string'||n.length>100))throw fail(400,'Consulte até 20 equipes por vez.');const teams=[...new Map(names.map(name=>{try{return findTeam(name);}catch(error){if(error.status===409)return null;throw error;}}).filter(t=>t?.metadataManaged).map(t=>[t.id,t])).values()];return {ok:true,teams,version:revision()};}const t=findTeam(query.id||query.name);if(!t)throw fail(404,'Equipe não encontrada.');if(query.metadata==='1')return {ok:true,team:t,version:revision()};const {limit,offset}=pagination(query),scope=query.scope==='current'?'current':'all',all=rows('SELECT t.person,t.data,p.name,p.data AS profile,p.revision FROM career_tenures t JOIN career_people p ON p.id=t.person WHERE t.team=? ORDER BY p.norm,t.ord',t.id).map(r=>{const tenure=JSON.parse(r.data),p=JSON.parse(r.profile);return {personId:r.person,name:r.name,photo:p.photo,managed:r.revision>1,...tenure,teamName:t.name,teamPageName:t.pageName||t.name,logo:t.logo,isCurrent:!['free_agent','retired'].includes(p.availability)&&active(tenure)};}).filter(t=>!t.deleted&&(scope!=='current'||t.isCurrent));return {ok:true,team:t,entries:all.slice(offset,offset+limit),total:all.length,offset,limit,hasMore:offset+limit<all.length,version:revision()};}
 function snapshot(id){const p=rows('SELECT * FROM career_people WHERE id=?',id)[0];return p?{person:p,tenures:rows('SELECT * FROM career_tenures WHERE person=?',id)}:null;}
 function restore(s,id){sql.exec('DELETE FROM career_tenures WHERE person=?',id);if(!s){sql.exec('DELETE FROM career_aliases WHERE person=?',id);sql.exec('DELETE FROM career_people WHERE id=?',id);return;}const p=s.person;sql.exec('INSERT OR REPLACE INTO career_people VALUES(?,?,?,?,?,?,?)',id,p.name,p.norm,p.kind,p.data,p.revision,p.updated_at);aliases(id,[id,p.name,...JSON.parse(p.data).aliases||[]]);for(const t of s.tenures)sql.exec('INSERT INTO career_tenures VALUES(?,?,?,?,?)',t.id,t.person,t.team,t.ord,t.data);}
 function audit(id,identity,kind,before){sql.exec('UPDATE career_people SET revision=revision+1,updated_at=? WHERE id=?',now(),id);const rev=rows('SELECT revision FROM career_people WHERE id=?',id)[0]?.revision||0;sql.exec('INSERT INTO career_changes VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),id,now(),identity.uid,kind,JSON.stringify(before),rev);sql.exec("UPDATE career_meta SET value=value+1 WHERE id='version'");}
 function saveTeam(name){const old=findTeam(name);if(old)return old;name=text(name,100);const id=key(name);if(!id||name.length<2)throw fail(400,'Informe a equipe.');const t={id,name,logo:'escudo.webp',aliases:[name]};sql.exec('INSERT INTO career_teams VALUES(?,?,?,?)',id,name,key(name),JSON.stringify(t));aliases(id,[id,name],'career_team_aliases','team');return t;}
 function cleanTenure(b,id,old){const name=b.teamId||b.teamName;if(!findTeam(name)&&b.confirmNewTeam!==true)throw fail(409,'Equipe nova. Confirme o cadastro da equipe antes de salvar a passagem.');const t=saveTeam(name),start=boundary(b.start),end=boundary(b.end);if(!ROLES[b.role]||!STATUS[b.status])throw fail(400,'Confira cargo e situação.');if(bounds(start)&&bounds(end,true)&&bounds(start)>bounds(end,true))throw fail(400,'A saída não pode ser anterior à entrada.');if(['active','loan','substitute'].includes(b.status)&&end.date&&bounds(end,true)<day(now()))throw fail(400,'Uma passagem encerrada no passado deve ter situação Encerrado.');const sourceUrl=text(b.sourceUrl,1500);if(sourceUrl){let u;try{u=new URL(sourceUrl);}catch{throw fail(400,'Use um link HTTPS para a fonte.');}if(u.protocol!=='https:'||u.username||u.password)throw fail(400,'Use um link HTTPS para a fonte.');}return {...competitions.clean(b,old,t.id),...(old?.departure?{departure:old.departure}:{}),id:id||crypto.randomUUID(),teamId:t.id,teamName:t.name,role:b.role,status:b.status,start,end,source:text(b.source,250),sourceUrl,notes:text(b.notes,1000),order:Number.isSafeInteger(Number(b.order))?Math.min(10000,Math.max(1,Number(b.order))):old?.order||records(b.personId).length+1};}
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
 const identityRepairs=createJokerIdentity({sql,rows,transaction,seed,enabled:repairIdentities,key,now,records,snapshot,audit,aliases,active});
 const historicalStaff=createStaffHistory({sql,rows,transaction,data:staffHistory,key,now,findTeam,records,snapshot,audit});
 const competitions=createCompetitions({sql,rows,key,text,fail,findTeam,records,data:competitionsSeed,participations:historicalStaff.participations,getPerson:id=>{const row=rows('SELECT data FROM career_people WHERE id=?',id)[0];return row?JSON.parse(row.data):null;}});
 const market=createMarket({sql,rows,transaction,text,fail,key,now,day,roles:ROLES,findTeam,person:id=>{const row=rows('SELECT name,data FROM career_people WHERE id=?',id)[0];if(!row)throw fail(404,'Pessoa não encontrada.');const p=JSON.parse(row.data);return {name:row.name,photo:p.photo};},applyCareer:applyMarketCareer,seed:seed===DEFAULT_SEED?require('./market-seed.json'):[]});
 function priorMarketExit(id,t){const linked=rows("SELECT m.data,m.revision FROM career_market_exits x JOIN career_market m ON m.id=x.entry WHERE x.tenure=? AND m.publication<>'deleted'",t.id)[0];if(linked)return {...JSON.parse(linked.data),revision:linked.revision};return rows("SELECT data,revision FROM career_market WHERE publication<>'deleted' AND person=? AND (json_extract(data,'$.careerExitTenureId')=? OR (json_extract(data,'$.fromId')=? AND json_extract(data,'$.date')=? AND json_extract(data,'$.date')<>'' AND status='fechado')) ORDER BY sort_at DESC LIMIT 1",id,t.id,t.teamId,t.end?.precision==='day'?t.end.date:'').map(r=>({...JSON.parse(r.data),revision:r.revision}))[0]||null;}
 function departurePreview(p,t){
  const all=records(p.id).filter(t=>!t.deleted),next=all.find(n=>n.order>t.order),latest=!all.some(n=>n.order>t.order),data=JSON.parse(p.data),existing=priorMarketExit(p.id,t),destination=next?findTeam(next.teamId):null;
  return {personId:p.id,name:p.name,revision:p.revision,tenureId:t.id,teamId:t.teamId,teamName:findTeam(t.teamId)?.name||t.teamName,role:t.role,end:t.end,toId:destination?.id||'',toName:destination?.name||(latest&&data.availability==='free_agent'?'Sem equipe / F/A':'Destino não informado'),alreadyExported:existing?{id:existing.id,publication:existing.publication,revision:existing.revision}:null};
 }
 function marketDepartureCandidates(b){
  const t=findTeam(b.teamId||b.teamName);if(!t)throw fail(404,'Escolha uma equipe cadastrada.');const {limit,offset}=pagination(b),latest=b.includeHistorical!==true;
  const where="t.team=? AND COALESCE(json_extract(t.data,'$.deleted'),0)=0 AND json_extract(t.data,'$.status')='ended'"+(latest?" AND json_extract(p.data,'$.availability')='free_agent' AND t.ord=(SELECT MAX(x.ord) FROM career_tenures x WHERE x.person=p.id AND COALESCE(json_extract(x.data,'$.deleted'),0)=0)":""),args=[t.id],total=rows('SELECT COUNT(*) AS n FROM career_tenures t JOIN career_people p ON p.id=t.person WHERE '+where,...args)[0].n;
  const entries=rows("SELECT p.id,p.name,p.data,p.revision,t.data AS tenure FROM career_tenures t JOIN career_people p ON p.id=t.person WHERE "+where+" ORDER BY COALESCE(json_extract(t.data,'$.end.date'),'') DESC,p.norm,t.ord DESC,t.id LIMIT ? OFFSET ?",...args,limit,offset).map(p=>departurePreview(p,JSON.parse(p.tenure)));
  return {ok:true,team:{id:t.id,name:t.name},entries,total,offset,limit,hasMore:offset+entries.length<total};
 }
 function exportMarketDepartures(identity,b){
  const team=findTeam(b.teamId);if(!team)throw fail(404,'Equipe não encontrada.');if(!['draft','published'].includes(b.publication||'published'))throw fail(400,'Escolha Rascunho ou Publicado.');const items=b.members;
  if(!Array.isArray(items)||!items.length||items.length>100||new Set(items.map(p=>p?.tenureId)).size!==items.length)throw fail(400,'Selecione de 1 a 100 saídas, sem repetições.');
  const prepared=items.map(item=>{if(!item||typeof item.personId!=='string'||typeof item.tenureId!=='string'||!Number.isSafeInteger(item.revision))throw fail(400,'Seleção inválida.');const p=rows('SELECT * FROM career_people WHERE id=?',item.personId)[0];if(!p)throw fail(404,'Pessoa não encontrada.');if(p.revision!==item.revision)throw fail(409,'A carreira de '+p.name+' mudou. Atualize a prévia; nenhuma saída foi exportada.');const t=records(p.id).find(t=>t.id===item.tenureId);if(!t||t.deleted||t.status!=='ended'||t.teamId!==team.id)throw fail(409,'Uma saída selecionada mudou ou não pertence à equipe. Atualize a prévia.');return {p,t,preview:departurePreview(p,t)};});
  const exported=[],skipped=[],replaced=[],groups=new Map(),selectedIds=new Set(items.map(m=>m.tenureId));
  // Only combine exits with the same destination and recorded period. Distinct events stay distinct.
  for(const item of prepared){const {t,preview}=item,k=b.grouped===false?t.id:JSON.stringify([preview.toId||preview.toName,t.end?.date||'',t.end?.edition||'',t.end?.precision||'']);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);}
  for(const group of groups.values()){
   const existing=[...new Set(group.map(x=>x.preview.alreadyExported?.id).filter(Boolean))].map(id=>market.get(id));
   const groupIds=new Set(group.map(x=>x.t.id));
   if(existing.length===1&&group.every(x=>x.preview.alreadyExported?.id===existing[0].id)&&(!existing[0].members?.length||existing[0].members.every(m=>groupIds.has(m.tenureId)))){skipped.push(...group.map(x=>existing[0].id));continue;}
   if(group.length===1&&existing.length){skipped.push(existing[0].id);continue;}
   for(const old of existing){const links=old.members?.length?old.members.map(m=>m.tenureId):[old.careerExitTenureId];if(links.some(id=>!selectedIds.has(id)||!groupIds.has(id)))throw fail(409,'Selecione todos os integrantes do card já agrupado antes de reagrupar.');for(const x of group.filter(x=>x.preview.alreadyExported?.id===old.id)){const item=items.find(m=>m.tenureId===x.t.id);if(item.marketRevision!==old.revision)throw fail(409,'Uma movimentação já publicada mudou. Atualize a prévia antes de agrupar.');}}
   for(const old of existing){market.remove(identity,{entryId:old.id,revision:old.revision});replaced.push(old.id);}
   const {p,t,preview}=group[0],multiple=group.length>1,period=[t.end?.precision==='day'?'':t.end?.date,t.end?.edition,group.some(x=>x.t.end?.certainty==='estimated')?'Informação estimada':''].filter(Boolean).join(' · '),notes=[...new Set(group.map(x=>x.t.departure?.reason||x.t.notes).filter(Boolean)),period?'Saída: '+period:''].filter(Boolean).join(' · '),sameRole=group.every(x=>x.t.role===t.role),source=[...new Set(group.map(x=>x.t.departure?.source||x.t.source||''))],sourceUrls=[...new Set(group.map(x=>x.t.departure?.sourceUrl||x.t.sourceUrl||''))];
   const r=market.save(identity,{entry:{id:multiple?'career-group-'+crypto.randomUUID():'career-exit-'+crypto.randomUUID(),personId:multiple?'':p.id,name:p.name,fromId:team.id,fromName:team.name,toId:preview.toId,toName:preview.toName,role:sameRole?t.role:'other',roleLabel:sameRole?'':'Jogadores e staff',date:t.end?.precision==='day'?t.end.date:'',status:'fechado',publication:b.publication==='draft'?'draft':'published',source:source.length===1?source[0]:'',sourceUrl:sourceUrls.length===1?sourceUrls[0]:'',notes,careerTenureId:multiple?'':t.id,careerExitTenureId:multiple?'':t.id,careerRevision:multiple?0:p.revision,members:group.map(x=>({personId:x.p.id,tenureId:x.t.id,name:x.p.name,photo:JSON.parse(x.p.data).photo||'',role:x.t.role}))}},{fromCareer:true});exported.push(r.entry.id);
  }
  return {ok:true,exported,skipped,replaced,memberCount:prepared.length-skipped.length,team:{id:team.id,name:team.name}};
 }

 function createPeople(identity,b){
  if(!Array.isArray(b.people)||!b.people.length||b.people.length>20)throw fail(400,'Cadastre de 1 a 20 pessoas por vez.');
  const mode=b.mode||'none';if(!['none','active','ended'].includes(mode))throw fail(400,'Confira a situação da passagem.');
  const team=mode==='none'?null:findTeam(b.teamId||b.teamName);if(mode!=='none'&&!team)throw fail(400,'Escolha uma equipe cadastrada.');
  const start=boundary(b.start),end=boundary(mode==='ended'?b.end:{});
  if(mode==='ended'&&end.date&&bounds(end)>day(now()))throw fail(400,'A saída para F/A não pode ficar no futuro.');
  if(mode==='active'&&start.date&&bounds(start)>day(now()))throw fail(400,'A entrada no elenco atual não pode ficar no futuro.');
  const names=new Set(),prepared=b.people.map(raw=>{
   const name=text(raw?.name,100),role=raw?.role;if(name.length<2||!key(name)||!Object.hasOwn(ROLES,role))throw fail(400,'Informe o nome e o cargo de cada pessoa.');
   if(names.has(key(name)))throw fail(409,'O nome “'+name+'” está repetido na lista.');names.add(key(name));
   const existing=rows('SELECT p.name FROM career_aliases a JOIN career_people p ON p.id=a.person WHERE a.alias=? LIMIT 1',key(name))[0];
   if(existing)throw fail(409,'“'+name+'” já está no catálogo como '+existing.name+'. Abra o cadastro existente para adicionar a passagem. Nenhuma pessoa foi criada.');
   const id='person-'+crypto.randomUUID(),t=team?cleanTenure({personId:id,teamId:team.id,role,status:mode==='ended'?'ended':'active',start,end,source:b.source,sourceUrl:b.sourceUrl,notes:b.reason,order:1}):null;
   return {id,name,role,t};
  });
  const people=[],departures=[];
  for(const {id,name,role,t} of prepared){
   const data={id,name,kind:role==='player'?'player':'staff',defaultRole:role,availability:'unknown',aliases:[name],photo:'silhueta.webp',currentTeamHint:''};
   sql.exec('INSERT INTO career_people VALUES(?,?,?,?,?,?,?)',id,name,key(name),data.kind,JSON.stringify(data),0,now());aliases(id,[id,name]);audit(id,identity,'savePerson',null);
   if(t){const before=snapshot(id);if(mode==='ended'){t.departure={reason:text(b.reason,500),source:t.source,sourceUrl:t.sourceUrl};data.availability='free_agent';data.freeAgentSince=end;data.freeAgentReason=t.departure.reason;}else data.availability='active';data.affiliationSource='manual';data.affiliationEdition=registration?.edition||'';
    sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(data),id);sql.exec('INSERT INTO career_tenures VALUES(?,?,?,?,?)',t.id,id,t.teamId,t.order,JSON.stringify(t));audit(id,identity,'saveTenure',before);
   }
   const p=person(id);people.push(p);if(t&&mode==='ended')departures.push(departurePreview(rows('SELECT * FROM career_people WHERE id=?',id)[0],t));
  }
  return {ok:true,people,departures,team:team?{id:team.id,name:team.name}:null};
 }
 const supporters=createCommunitySupporters({sql,rows,text,fail,now,day});
 const tournamentAssets=createTournamentAssets({sql,rows,key,text,fail,now});
 const directory=createDirectory({rows,sql,pagination,key,text,fail,day,now,findTeam,revision,roles:ROLES});
 async function admin(identity,b){if(!identity?.admin)throw fail(403,'Somente administrador.');ensure();const op=b.operation;
  if(op==='supporterList')return supporters.list();
  if(op==='tournamentAssets')return tournamentAssets.publicRead();
  if(op==='competitionOptions')return competitions.options(b);
  if(op==='marketDepartureCandidates')return marketDepartureCandidates(b);
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
  if(op==='history')return {ok:true,entries:rows("SELECT id,at,actor,kind,after_revision AS revision,CASE WHEN LENGTH(before_data)=4 OR kind IN ('identitySplit','identitySplitManual') THEN 0 ELSE 1 END AS canUndo FROM career_changes WHERE person=? ORDER BY at DESC,rowid DESC LIMIT 20",text(b.personId,100))};
  if(op==='summary')return {ok:true,people:rows('SELECT COUNT(*) AS n FROM career_people')[0].n,teams:rows('SELECT COUNT(*) AS n FROM career_teams')[0].n,tenures:rows("SELECT COUNT(*) AS n FROM career_tenures WHERE COALESCE(json_extract(data,'$.deleted'),0)=0")[0].n,version:revision()};
  if(!['supporterSave','saveTournamentAsset','competitionCreate','createPeople','savePerson','saveTenure','archiveTenure','transfer','undo','releasePerson','bulkDeparture','saveTeam','marketSave','marketDelete','marketExportDepartures'].includes(op))throw fail(400,'Operação desconhecida.');
  if(!/^[a-f0-9-]{36}$/i.test(b.nonce||''))throw fail(400,'Reabra o formulário para preparar a alteração.');
  return transaction(()=>{
   const body=JSON.stringify(b),prior=rows('SELECT * FROM career_requests WHERE nonce=?',b.nonce)[0];if(prior){if(prior.actor!==identity.uid||prior.body!==body)throw fail(409,'Este pedido já foi usado em outra alteração.');return JSON.parse(prior.response);}
   if(op==='supporterSave'){const result=supporters.save(identity,b);sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;}
   if(op==='saveTournamentAsset'){const result=tournamentAssets.save(identity,b);sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;}
   if(op==='competitionCreate'){const result=competitions.create(b);sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;}
   if(op==='createPeople'){const result=createPeople(identity,b);sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;}
   if(op==='marketExportDepartures'){const result=exportMarketDepartures(identity,b);sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;}
   if(op==='marketSave'||op==='marketDelete'){const result=op==='marketDelete'?market.remove(identity,b):market.save(identity,b);sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;}
   if(op==='saveTeam'){const result=directory.saveTeamProfile(identity,b);sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;}
   if(op==='bulkDeparture'){
    const t=findTeam(b.teamId);if(!t)throw fail(404,'Equipe não encontrada.');const members=b.members;
    if(!Array.isArray(members)||!members.length||members.length>100||members.some(p=>!p||typeof p.personId!=='string'||!Number.isSafeInteger(p.revision))||new Set(members.map(p=>p.personId)).size!==members.length)throw fail(400,'Selecione de 1 a 100 pessoas, sem repetições.');
    const info=departureInfo(b),affected=[];
    for(const member of members){const id=text(member.personId,100),before=snapshot(id);if(!before)throw fail(404,'Pessoa não encontrada.');if(before.person.revision!==member.revision)throw fail(409,'O cadastro de '+before.person.name+' mudou. Recarregue a lista; nenhuma saída foi aplicada.');release(id,member.tenureIds,info,t.id);audit(id,identity,'bulkDeparture',before);affected.push({id,name:before.person.name,revision:before.person.revision+1});}
    const result={ok:true,team:{id:t.id,name:t.name},affected,departure:info.end};if(b.publishMarket===true){const selections=members.flatMap(m=>m.tenureIds.map(tenureId=>({personId:m.personId,tenureId,revision:affected.find(p=>p.id===m.personId).revision})));result.market=exportMarketDepartures(identity,{teamId:t.id,publication:'published',members:selections,grouped:true});}sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;
   }
   const id=text(b.personId,100)||'person-'+crypto.randomUUID(),before=snapshot(id);if(before&&before.person.revision!==b.revision)throw fail(409,'Este cadastro foi alterado em outra janela. Atualize antes de salvar.');if(!before&&op!=='savePerson')throw fail(404,'Pessoa não encontrada.');
   if(op==='savePerson'){
    const name=text(b.name,100),kind=['player','staff'].includes(b.kind)?b.kind:'player',availability=['unknown','active','free_agent','retired'].includes(b.availability)?b.availability:'unknown',values=Array.isArray(b.aliases)?b.aliases.slice(0,30).map(a=>text(a,100)).filter(Boolean):[];if(name.length<2||!key(name))throw fail(400,'Informe o nome.');if(!before&&rows('SELECT person FROM career_aliases WHERE alias=? LIMIT 1',key(name)).length)throw fail(409,'Este nome já está no catálogo. Pesquise antes de criar outro cadastro.');
    if(before&&['free_agent','retired'].includes(availability)&&records(id).some(ongoing))throw fail(400,'Encerre a passagem ativa antes de marcar Sem equipe ou Aposentado.');
    const old=before?JSON.parse(before.person.data):{};
    let photo=old.photo||'silhueta.webp';
    if(Object.hasOwn(b,'photo')){
     const value=text(b.photo,1500).trim();
     if(value){
      const local=/^\/?[a-zA-Z0-9_ %()./-]+\.(?:webp|png|jpe?g)(?:\?[a-zA-Z0-9_=&%.-]+)?$/i.test(value)&&!value.startsWith('//')&&!value.split('/').includes('..');
      let secure=false;try{const u=new URL(value);secure=u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.length>0;}catch{}
      if(!local&&!secure)throw fail(400,'Informe uma foto HTTPS ou um arquivo de imagem do site.');
     }
     photo=value||'silhueta.webp';
    }
     const socialHosts={
      instagram:['instagram.com'],x:['x.com','twitter.com'],
      tiktok:['tiktok.com'],youtube:['youtube.com','youtu.be'],
      twitch:['twitch.tv'],liquipedia:['liquipedia.net']
    };
    let social=old.social&&typeof old.social==='object'&&!Array.isArray(old.social)?{...old.social}:{};
    if(Object.hasOwn(b,'social')){
      if(!b.social||typeof b.social!=='object'||Array.isArray(b.social))throw fail(400,'Confira os links das redes sociais.');
      const next={};
      for(const [network,hosts] of Object.entries(socialHosts)){
        const value=text(b.social[network],500).trim();
        if(!value)continue;
        let url;try{url=new URL(value);}catch{throw fail(400,'Use a URL completa HTTPS para '+network+'.');}
        if(url.protocol!=='https:'||url.username||url.password||!hosts.some(host=>url.hostname===host||url.hostname==='www.'+host||network==='youtube'&&url.hostname==='m.youtube.com'))throw fail(400,'Domínio não permitido para '+network+'.');
        next[network]=url.href;
      }
      social=next;
    }
   const data={...old,id,name,kind,availability,aliases:[...new Set([name,...values])],social,photo,playerRetired:Object.hasOwn(b,'playerRetired')?b.playerRetired===true:old.playerRetired===true,currentTeamHint:old.currentTeamHint||''};sql.exec('INSERT OR REPLACE INTO career_people VALUES(?,?,?,?,?,?,?)',id,name,key(name),kind,JSON.stringify(data),before?.person.revision||0,now());if(before&&availability!==old.availability){data.affiliationSource='manual';data.affiliationEdition=registration?.edition||'';if(availability!=='free_agent'){delete data.freeAgentSince;delete data.freeAgentReason;}sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(data),id);}aliases(id,[id,name,...data.aliases]);
   }else if(op==='saveTenure'||op==='transfer'){
    if(records(id).filter(t=>!t.deleted).length>=200&&!b.tenure?.id)throw fail(400,'Limite de 200 passagens por pessoa.');const raw=b.tenure||{},old=raw.id?rows('SELECT data,person FROM career_tenures WHERE id=?',text(raw.id,150))[0]:null;if(raw.id&&(!old||old.person!==id))throw fail(404,'Passagem não encontrada nesta pessoa.');const t=cleanTenure({...raw,personId:id,confirmNewTeam:b.confirmNewTeam===true},old?raw.id:null,old?JSON.parse(old.data):null);
    if(op==='transfer'){const source=rows('SELECT * FROM career_tenures WHERE id=? AND person=?',text(b.fromTenureId,150),id)[0];if(!source)throw fail(404,'Escolha a passagem anterior.');const previous=JSON.parse(source.data);if(previous.deleted||previous.status==='ended')throw fail(409,'A passagem anterior já está encerrada.');const end=boundary(b.departure);if(!end.date&&!end.edition)throw fail(400,'Informe a saída ou a edição da passagem anterior.');if(bounds(previous.start)&&bounds(end,true)&&bounds(previous.start)>bounds(end,true))throw fail(400,'Confira a data de saída.');if(bounds(t.start)&&bounds(end)&&bounds(t.start)<bounds(end))throw fail(400,'A nova entrada não pode ser anterior à saída informada.');previous.end=end;previous.status='ended';sql.exec('UPDATE career_tenures SET data=? WHERE id=?',JSON.stringify(previous),source.id);}
    if(b.leaveFreeAgent===true&&t.status!=='ended')throw fail(400,'Para deixar Sem equipe / F/A, marque a passagem como Encerrado.');
    sql.exec('INSERT OR REPLACE INTO career_tenures VALUES(?,?,?,?,?)',t.id,id,t.teamId,t.order,JSON.stringify(t));
    if(b.leaveFreeAgent===true){if(records(id).some(n=>ongoing(n)||!n.deleted&&n.order>t.order))throw fail(409,'Há outra passagem atual ou posterior. Confira os vínculos antes de deixar esta pessoa F/A.');if(t.end.date&&bounds(t.end)>day(now()))throw fail(400,'A saída para F/A não pode ficar no futuro.');const profile=JSON.parse(rows('SELECT data FROM career_people WHERE id=?',id)[0].data);profile.availability='free_agent';profile.affiliationSource='manual';profile.affiliationEdition=registration?.edition||'';profile.freeAgentSince=t.end;profile.freeAgentReason=t.notes;sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(profile),id);}
    if(['active','loan','substitute'].includes(t.status)){const profile=JSON.parse(rows('SELECT data FROM career_people WHERE id=?',id)[0].data);profile.availability='active';profile.affiliationSource='manual';profile.affiliationEdition=registration?.edition||'';delete profile.freeAgentSince;delete profile.freeAgentReason;sql.exec('UPDATE career_people SET data=? WHERE id=?',JSON.stringify(profile),id);}
   }else if(op==='releasePerson'){release(id,b.tenureIds,departureInfo(b));
   }else if(op==='archiveTenure'){const row=rows('SELECT data FROM career_tenures WHERE id=? AND person=?',text(b.tenureId,150),id)[0];if(!row)throw fail(404,'Passagem não encontrada.');const t=JSON.parse(row.data);t.deleted=true;sql.exec('UPDATE career_tenures SET data=? WHERE id=?',JSON.stringify(t),t.id);
   }else if(op==='undo'){const change=rows('SELECT * FROM career_changes WHERE id=? AND person=?',text(b.changeId,100),id)[0];if(!change||change.after_revision!==before.person.revision)throw fail(409,'Só é possível desfazer a última alteração deste cadastro.');if(['identitySplit','identitySplitManual'].includes(change.kind))throw fail(400,'A separação de identidades não pode ser desfeita. Edite o cadastro correto de cada pessoa.');const original=JSON.parse(change.before_data);if(!original)throw fail(400,'Para preservar o histórico, um cadastro novo não é removido por esta ação.');restore(original,id);sql.exec('UPDATE career_people SET revision=? WHERE id=?',before.person.revision,id);}
   audit(id,identity,op,before);const result={ok:true,person:person(id)};
   if(b.publishMarket===true&&['transfer','saveTenure'].includes(op)){
    const t=result.person.tenures.find(t=>t.id===b.tenure?.id)||result.person.tenures.find(t=>!before.tenures.some(old=>old.id===t.id));
    if(!t||!['active','loan','substitute','ended'].includes(t.status))throw fail(400,'Para publicar, escolha uma passagem ativa ou Encerrado para uma saída.');
    if(t.status==='ended'){const exported=exportMarketDepartures(identity,{teamId:t.teamId,members:[{personId:id,tenureId:t.id,revision:result.person.revision}],publication:'published'});result.market=market.get(exported.exported[0]||exported.skipped[0]);result.marketAlreadyPublished=!exported.exported.length;if(result.market.publication!=='published'){if(result.market.members?.length>1)result.marketNeedsReview=true;else{result.market=market.save(identity,{entry:{...result.market,publication:'published'},revision:result.market.revision}).entry;result.marketAlreadyPublished=false;}}}else{
    const previous=op==='transfer'?before.tenures.map(r=>JSON.parse(r.data)).find(t=>t.id===b.fromTenureId):null;
    result.market=market.save(identity,{entry:{id:'career-'+t.id,personId:id,role:t.role,status:'fechado',publication:'published',name:result.person.name,fromId:previous?.teamId||'',fromName:previous?.teamName||'',toId:t.teamId,toName:t.teamName,date:t.start.precision==='day'?t.start.date:'',source:t.source,sourceUrl:t.sourceUrl,notes:t.notes,careerTenureId:t.id,careerExitTenureId:previous?.id||'',careerRevision:result.person.revision}},{fromCareer:true}).entry;
    }
   }
sql.exec('INSERT INTO career_requests VALUES(?,?,?,?)',b.nonce,identity.uid,body,JSON.stringify(result));return result;
  });
 }
 function publicRead(kind,query){ensure();if(kind==='supporters')return supporters.publicRead();if(kind==='tournaments')return tournamentAssets.publicRead();if(kind==='search')return directory.publicSearch(query);if(kind==='market'){const result=market.list(query,true);return {...result,version:result.version+'-'+revision()};}if(kind!=='person')return team(query);const p=findPerson(query),entries=p.current.length?team({id:p.current[0].teamId,scope:'current',limit:20}).entries:[];p.teammates=entries.filter(t=>t.personId!==p.id).filter((t,i,a)=>a.findIndex(x=>x.personId===t.personId)===i).map(t=>({id:t.personId,name:t.name,photo:t.photo,role:t.role,teamId:t.teamId,teamName:t.teamName}));return {ok:true,person:p};}
 return {admin,publicRead,ensure,logo(id){ensure();if(!/^[a-f0-9-]{36}$/.test(id||''))return null;const value=rows('SELECT data FROM career_team_logos WHERE id=?',id)[0]?.data;if(!value)return null;const [header,base64]=value.split(',');return {type:header.includes('webp')?'image/webp':'image/png',base64};}};
}
module.exports={create,init,key,boundary,bounds,day,ROLES,STATUS};
