'use strict';
const N=require('../js/admin-tarefas-notifications.js');
const locatorCore=require('./task-locator.js');
const MAX_FILE=25*1024*1024,MAX_TOTAL=150*1024*1024,CHUNK=512*1024;
const fail=(status,message)=>Object.assign(Error(message),{status});
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,150}$/.test(id);
const clean=(v,n)=>{if(typeof v!=='string'||v.length>n)throw fail(400,'Texto inválido.');return v;};
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',value))].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function body(request,max){if(Number(request.headers.get('Content-Length')||0)>max)throw fail(413,'Arquivo ou pedido acima do limite.');const reader=request.body?.getReader(),chunks=[];let length=0;if(reader)for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw fail(413,'Arquivo ou pedido acima do limite.');}chunks.push(value);}const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return bytes;}
function create({sql,transaction,setAlarm,deleteAlarm,push,now=Date.now}){
 let locator;
 const rows=(q,...args)=>sql.exec(q,...args).toArray();
 sql.exec(`CREATE TABLE IF NOT EXISTS task_files(id TEXT PRIMARY KEY,name TEXT,mime TEXT,bytes INTEGER,hash TEXT,at INTEGER);
 CREATE TABLE IF NOT EXISTS task_file_chunks(id TEXT,n INTEGER,data BLOB,PRIMARY KEY(id,n));
 CREATE TABLE IF NOT EXISTS task_archives(month TEXT,id TEXT,title TEXT,status TEXT,closed_at TEXT,revision TEXT,data TEXT,at INTEGER,PRIMARY KEY(month,id));
 CREATE INDEX IF NOT EXISTS task_archive_month ON task_archives(month,id);
 CREATE TABLE IF NOT EXISTS task_queue(id TEXT PRIMARY KEY,task_id TEXT,title TEXT,kind TEXT,due INTEGER,attempts INTEGER DEFAULT 0);
 CREATE INDEX IF NOT EXISTS task_queue_due ON task_queue(due);
 CREATE TABLE IF NOT EXISTS task_event_details(id TEXT PRIMARY KEY,data TEXT);
 CREATE TABLE IF NOT EXISTS task_sent(id TEXT PRIMARY KEY,data TEXT,at INTEGER);
 CREATE TABLE IF NOT EXISTS task_config(id TEXT PRIMARY KEY,data TEXT);
 CREATE TABLE IF NOT EXISTS task_limits(uid TEXT PRIMARY KEY,at INTEGER,count INTEGER);`);
 const config=()=>JSON.parse(rows("SELECT data FROM task_config WHERE id='schedule'")[0]?.data||'{}');
 function ensureSummary(){
  const owner=config(),d=owner.digest;if(!owner.enabled||!d?.enabled||rows("SELECT id FROM task_queue WHERE kind='summary' LIMIT 1").length)return;
  let day=N.dayAt(now()),due=N.instant(day,d.time);if(due<now()){day=N.addDays(day,1);due=N.instant(day,d.time);}
  for(let i=0;i<3;i++){const id='daily-summary:summary:'+day;if(!rows('SELECT id FROM task_sent WHERE id=?',id).length){sql.exec('INSERT OR IGNORE INTO task_queue VALUES(?,?,?,?,?,0)',id,'daily-summary','Resumo diário','summary',due);return;}day=N.addDays(day,1);due=N.instant(day,d.time);}
 }
 async function schedule(){ensureSummary();const next=rows('SELECT due FROM task_queue ORDER BY due LIMIT 1')[0];if(next)await setAlarm(Math.max(now()+1000,next.due));else await deleteAlarm();}
 function requireAdmin(user){if(user?.email!=='admin@centralfreefire.com.br'||!validId(user.uid))throw fail(403,'Acesso exclusivo do administrador.');}
 async function file(request,id){
  if(!validId(id))throw fail(400,'Anexo inválido.');
  if(request.method==='GET'){
   const meta=rows('SELECT * FROM task_files WHERE id=?',id)[0];if(!meta)throw fail(404,'Anexo não encontrado.');
   const data=new Uint8Array(meta.bytes);let at=0;for(const chunk of rows('SELECT data FROM task_file_chunks WHERE id=? ORDER BY n',id)){const value=new Uint8Array(chunk.data);data.set(value,at);at+=value.length;}if(at!==meta.bytes)throw fail(503,'Anexo incompleto. Tente novamente.');
   return new Response(data,{headers:{'Content-Type':meta.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(meta.name),'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
  }
  if(request.method!=='POST')throw fail(405,'Operação inválida.');
  let name;try{name=decodeURIComponent(request.headers.get('X-File-Name')||'');}catch{throw fail(400,'Nome de arquivo inválido.');}
  clean(name,255);if(!name.trim()||/[\x00-\x1f\x7f]/.test(name))throw fail(400,'Nome de arquivo inválido.');
  const mime=clean(request.headers.get('X-File-Type')||'application/octet-stream',200);if(!/^[\w.+-]+\/[\w.+-]+$/.test(mime))throw fail(400,'Tipo de arquivo inválido.');
  const bytes=await body(request,MAX_FILE),hash=await digest(bytes);
  transaction(()=>{const old=rows('SELECT * FROM task_files WHERE id=?',id)[0];if(old){if(old.hash!==hash||old.name!==name||old.mime!==mime)throw fail(409,'Este anexo já foi salvo com outro conteúdo.');return;}
   const total=Number(rows('SELECT COALESCE(SUM(bytes),0) AS total FROM task_files')[0].total);if(total+bytes.length>MAX_TOTAL)throw fail(413,'O armazenamento de anexos chegou a 150 MB. O arquivo local foi preservado.');
   sql.exec('INSERT INTO task_files VALUES(?,?,?,?,?,?)',id,name,mime,bytes.length,hash,now());
   for(let at=0,n=0;at<bytes.length;at+=CHUNK,n++)sql.exec('INSERT INTO task_file_chunks VALUES(?,?,?)',id,n,bytes.slice(at,at+CHUNK).buffer);
  });return json({ok:true,id,size:bytes.length,hash});
 }
 async function handle(request,user){
  requireAdmin(user);const at=now(),rate=rows('SELECT * FROM task_limits WHERE uid=?',user.uid)[0],active=rate&&at-rate.at<60000;if(active&&rate.count>=240)throw fail(429,'Aguarde um minuto antes de continuar.');sql.exec('INSERT OR REPLACE INTO task_limits VALUES(?,?,?)',user.uid,active?rate.at:at,active?rate.count+1:1);
  const url=new URL(request.url),match=url.pathname.match(/^\/tasks\/files\/([A-Za-z0-9_-]{1,150})$/);if(match)return file(request,match[1]);
  if(url.pathname!=='/tasks/api'||request.method!=='POST')throw fail(404,'Operação não encontrada.');
  let b;try{b=JSON.parse(new TextDecoder().decode(await body(request,2*1024*1024)));}catch(e){if(e.status)throw e;throw fail(400,'Pedido inválido.');}
  const op=b.operation;
  if(['locatorList','locatorGet','locatorSave','locatorDelete','locatorFavorite'].includes(op)){locator??=locatorCore.create({sql,transaction,now});return json(locator.handle(op,b));}
  if(op==='fileStatus'){const ids=b.ids;if(!Array.isArray(ids)||ids.length>100||ids.some(id=>!validId(id)))throw fail(400,'Lista de anexos inválida.');return json({ok:true,files:Object.fromEntries(ids.map(id=>[id,rows('SELECT bytes,hash FROM task_files WHERE id=?',id)[0]||null]))});}
  if(op==='archive'){
   if(!Array.isArray(b.items)||!b.items.length||b.items.length>25)throw fail(400,'Arquive até 25 tarefas de cada vez.');
   const prepared=[];
   for(const item of b.items){const t=item?.task;if(!validId(t?.id)||!['done','cancelled'].includes(t?.status)||!t.title||typeof t.updatedAt!=='string'||!Number.isFinite(Date.parse(t.updatedAt)))throw fail(400,'Somente tarefas concluídas ou canceladas podem ser arquivadas.');clean(t.title,200);
    const closed=t.completedAt||t.cancelledAt||t.updatedAt;if(typeof closed!=='string'||!Number.isFinite(Date.parse(closed)))throw fail(400,'Data de conclusão inválida.');const month=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date(closed));
    if(!/^\d{4}-\d{2}$/.test(month))throw fail(400,'Data de conclusão inválida.');
    for(const a of t.attachments||[])if(!validId(a.id)||!rows('SELECT id FROM task_files WHERE id=?',a.id)[0])throw fail(409,'Sincronize os anexos desta tarefa antes de arquivar.');
    const data=JSON.stringify(item);if(new TextEncoder().encode(data).length>1000000)throw fail(413,'Esta tarefa é grande demais para arquivar. Exporte seu backup.');prepared.push({t,closed,month,data,revision:await digest(new TextEncoder().encode(data))});
   }
   transaction(()=>{for(const p of prepared){const old=rows('SELECT data,revision FROM task_archives WHERE month=? AND id=?',p.month,p.t.id)[0];if(old&&Date.parse(JSON.parse(old.data).task.updatedAt)>Date.parse(p.t.updatedAt))throw fail(409,'Já existe uma versão mais recente no arquivo.');sql.exec('INSERT OR REPLACE INTO task_archives VALUES(?,?,?,?,?,?,?,?)',p.month,p.t.id,p.t.title,p.t.status,p.closed,p.revision,p.data,at);}});
   return json({ok:true,items:prepared.map(p=>({id:p.t.id,month:p.month,revision:p.revision}))});
  }
  if(op==='archiveMonths')return json({ok:true,months:rows('SELECT month,COUNT(*) AS count FROM task_archives GROUP BY month ORDER BY month DESC')});
  if(['archiveList','archiveGet','archiveRemove','archiveExport'].includes(op)){
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month||''))throw fail(400,'Escolha um mês válido.');
   if(op==='archiveList'||op==='archiveExport'){const cursor=String(b.cursor||'');if(cursor&&!validId(cursor))throw fail(400,'Página inválida.');const list=rows(op==='archiveExport'?'SELECT id,data,revision FROM task_archives WHERE month=? AND id>? ORDER BY id LIMIT 10':'SELECT id,title,status,closed_at,revision FROM task_archives WHERE month=? AND id>? ORDER BY id LIMIT 25',b.month,cursor);return json({ok:true,items:op==='archiveExport'?list.map(r=>({...r,data:JSON.parse(r.data)})):list,next:list.length===(op==='archiveExport'?10:25)?list.at(-1).id:''});}
   if(!validId(b.id))throw fail(400,'Tarefa inválida.');const row=rows('SELECT data,revision FROM task_archives WHERE month=? AND id=?',b.month,b.id)[0];if(!row)throw fail(404,'Tarefa não encontrada no arquivo.');
   if(op==='archiveGet')return json({ok:true,item:JSON.parse(row.data),revision:row.revision});
   if(row.revision!==b.revision)throw fail(409,'O arquivo mudou. Atualize antes de restaurar.');sql.exec('DELETE FROM task_archives WHERE month=? AND id=? AND revision=?',b.month,b.id,b.revision);return json({ok:true});
  }
  if(op==='schedule'){
   if(!Number.isSafeInteger(b.revision)||b.revision<0||!Array.isArray(b.events)||b.events.length>2000||typeof b.enabled!=='boolean')throw fail(400,'Configuração de lembretes inválida.');
   if(b.revision<(config().revision||0))return json({ok:true,stale:true});
   const events=b.enabled?b.events:[];for(const e of events){if(!validId(e.taskId)||typeof e.id!=='string'||!e.id.startsWith(e.taskId+':')||e.id.length>240||!['start','reminder','due','publication','overdue','approval'].includes(e.kind)||!Number.isSafeInteger(e.at)||e.at<at-86400000||e.at>at+370*86400000)throw fail(400,'Lembrete inválido.');clean(e.title,200);if(e.body!==undefined)clean(e.body,500);}
   let summaryConfig;try{summaryConfig=N.validateDigest(b.digest);}catch(error){throw fail(400,error.message);}if(!b.enabled)summaryConfig={...summaryConfig,enabled:false,tasks:[]};
   transaction(()=>{const previous=new Map(rows('SELECT id,attempts FROM task_queue').map(r=>[r.id,r.attempts]));sql.exec('DELETE FROM task_queue');sql.exec('DELETE FROM task_event_details');for(const e of events){if(rows('SELECT id FROM task_sent WHERE id=?',e.id)[0])continue;sql.exec('INSERT OR REPLACE INTO task_queue VALUES(?,?,?,?,?,?)',e.id,e.taskId,e.title,e.kind,e.at,previous.get(e.id)||0);if(e.body)sql.exec('INSERT OR REPLACE INTO task_event_details VALUES(?,?)',e.id,JSON.stringify({body:e.body}));}sql.exec("INSERT OR REPLACE INTO task_config VALUES('schedule',?)",JSON.stringify({revision:b.revision,uid:user.uid,enabled:b.enabled,digest:summaryConfig}));});await schedule();return json({ok:true,pending:rows('SELECT COUNT(*) AS n FROM task_queue')[0].n});
  }
  if(op==='notifications'){return json({ok:true,items:rows('SELECT id,data,at FROM task_sent ORDER BY at DESC LIMIT 50').map(r=>({id:r.id,...JSON.parse(r.data),at:r.at})).filter(r=>!r.skipped),pending:rows('SELECT COUNT(*) AS n FROM task_queue')[0].n});}
  if(op==='testNotification'){const old=Number(rows("SELECT data FROM task_config WHERE id='test'")[0]?.data||0);if(at-old<60000)throw fail(429,'Aguarde um minuto entre testes.');sql.exec("INSERT OR REPLACE INTO task_config VALUES('test',?)",String(at));return json({ok:true,...await push(user.uid,{title:'Lembretes de tarefas ativados',body:'Os avisos deste quadro chegarão neste aparelho.',taskId:'',tag:'cff-tasks-test'})});}
  throw fail(400,'Operação inválida.');
 }
 function removeEvent(id){sql.exec('DELETE FROM task_queue WHERE id=?',id);sql.exec('DELETE FROM task_event_details WHERE id=?',id);}
 async function alarm(){const at=now(),owner=config();for(const e of rows('SELECT * FROM task_queue WHERE due<=? ORDER BY due LIMIT 5',at)){
   if(!owner.enabled){removeEvent(e.id);continue;}
   const labels={start:'Prazo de entrega aberto',reminder:'Seu prazo está chegando',due:'Lembrete de entrega',publication:'Hora de publicar',overdue:'Entrega atrasada',approval:'Aprovação pendente'};
   const details=JSON.parse(rows('SELECT data FROM task_event_details WHERE id=?',e.id)[0]?.data||'{}');
   let message={title:labels[e.kind],body:details.body||e.title,taskId:e.task_id,tag:'task-'+e.id};
   if(e.kind==='summary'){
    const day=e.id.slice(-10),summary=owner.digest?.enabled&&day===N.dayAt(at)?N.summary(owner.digest.tasks,day):null;
    if(!summary){transaction(()=>{sql.exec('INSERT OR IGNORE INTO task_sent VALUES(?,?,?)',e.id,JSON.stringify({skipped:true}),at);removeEvent(e.id);});continue;}
    message={...summary,tag:'task-'+e.id,view:'day'};
   }
   try{const result=await push(owner.uid,message);if(!result.accepted&&result.devices&&e.attempts<2){sql.exec('UPDATE task_queue SET attempts=attempts+1,due=? WHERE id=?',at+300000,e.id);continue;}
    transaction(()=>{sql.exec('INSERT OR IGNORE INTO task_sent VALUES(?,?,?)',e.id,JSON.stringify({...message,delivered:result.accepted>0}),at);removeEvent(e.id);});
   }catch{if(e.attempts<2)sql.exec('UPDATE task_queue SET attempts=attempts+1,due=? WHERE id=?',at+300000,e.id);else{sql.exec('INSERT OR IGNORE INTO task_sent VALUES(?,?,?)',e.id,JSON.stringify({...message,delivered:false}),at);removeEvent(e.id);}}
  }
  // One-off receipts survive preference changes and reconnects, including after a year.
  sql.exec("DELETE FROM task_sent WHERE at<? AND id NOT LIKE '%:overdue:%' AND id NOT LIKE '%:approval:%'",at-370*86400000);await schedule();
 }
 return {handle,alarm,schedule};
}
module.exports={create,MAX_FILE,MAX_TOTAL};
