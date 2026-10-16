
'use strict';
const KEY='meu-quadro-v1',CLOUD_MARKER='meu-quadro-cloud-v1',SYNC_KEY='meu-quadro-sync-v2',DB_NAME='meu-quadro-completo',COLORS={none:['Padrão','#8a8a96'],blue:['Azul','#73a5db'],lilac:['Lilás','#ab84cc'],mint:['Verde','#76b98c'],yellow:['Amarelo','#d8b44d'],coral:['Laranja','#d89570'],red:['Vermelho','#ce8585']},NOTE_COLORS={yellow:'Amarelo',mint:'Verde',lilac:'Lilás',coral:'Laranja',blue:'Azul',pink:'Rosa',red:'Vermelho',teal:'Turquesa',gray:'Cinza',sand:'Areia'},BASE_COLUMNS=[{id:'todo',name:'A fazer',hidden:false},{id:'doing',name:'Em andamento',hidden:false},{id:'done',name:'Concluído',hidden:false},{id:'cancelled',name:'Cancelada',hidden:false}];
const SERVICES={design:{name:'Arte / Design',icon:'✦'},social:{name:'Post / Social',icon:'▱'},carousel:{name:'Carrossel',icon:'▤'},video:{name:'Vídeo',icon:'▷'},site:{name:'Site',icon:'◎'},copy:{name:'Texto / Legenda',icon:'✎'},data:{name:'Dados / Estatísticas',icon:'▥'},live:{name:'Cobertura / Live',icon:'◉'},other:{name:'Outro',icon:'◇'}};
const DEFAULT_SERVICES=window.CFF_TASKS_DEFAULT_SERVICES=Object.entries(SERVICES).map(([id,item])=>({id,...item,image:''}));
const serviceById=id=>state.services.find(service=>service.id===id);
const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;},uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),now=()=>new Date().toISOString(),copy=value=>structuredClone(value);
const today=()=>window.CFF_TASKS_PLAN.today();
function fresh(){return {version:5,templates:[],projects:[],projectCompanies:[],projectNetworks:[],projectFields:[],tasks:[],notes:[],usefulLinks:[],dailyPosts:[],services:copy(DEFAULT_SERVICES),theme:'dark',columns:copy(BASE_COLUMNS),platforms:[{id:'instagram',name:'Instagram'},{id:'x',name:'X'},{id:'facebook',name:'Facebook'},{id:'tiktok',name:'TikTok'},{id:'youtube',name:'YouTube'},{id:'site',name:'Site'}],tags:[],settings:{warningMinutes:60,view:'board',sort:'deadline'}};}
let projectsUI=null,planUI=null,contentUI=null,cloudRevision=0;
let state=fresh(),files=new Map(),db=null,storageBlocked=false,saveQueue=Promise.resolve(),dragId=null,draft=null,draftFiles=new Map(),previewUrls=[],toastTimer,booted=false,openNoteId=null,editNoteId=null,failedFileChanges=new Map();
let cloudUnsubscribe=null,cloudTimer=null,cloudPendingState=null,cloudSaveChain=Promise.resolve(),cloudReady=false,applyingRemote=false,syncBase=null,syncDirty=false,cloudBusy=false,cloudRetry=null;
const filters={text:'',deadline:'all',platform:'',tag:'',status:'',important:false};
function validDate(s){if(s==='')return true;if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return !Number.isNaN(+d)&&d.getFullYear()===Number(s.slice(0,4))&&d.getMonth()+1===Number(s.slice(5,7))&&d.getDate()===Number(s.slice(8,10));}
function text(v,max,empty=true){if(typeof v!=='string'||v.length>max||(!empty&&!v.trim()))throw Error('Texto inválido');return v;}
function iso(v){if(v===null||v===undefined)return null;if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw Error('Data inválida');return v;}
function cleanUrl(value){const s=String(value||'').trim();if(!s)return '';const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(s)?s:'https://'+s);if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw Error('Use um endereço http ou https.');return url.href;}
function cleanServiceIcon(value){const s=String(value||'');if(!s)return '';if(s.length>430000||!/^data:image\/(?:png|jpeg|webp|avif);base64,/i.test(s))throw Error('Ícone de serviço inválido');return s;}
function uniqueList(items,parse){if(!Array.isArray(items)||items.length>10000)throw Error('Lista inválida');const ids=new Set();return items.map((item,index)=>{const out=parse(item,index);text(out.id,150,false);if(ids.has(out.id))throw Error('ID duplicado');ids.add(out.id);return out;});}
function definition(item){return {id:text(item.id,150,false),name:text(item.name,40,false).trim()};}
function normalise(data){
 if(!data||![1,2,3,4,5].includes(data.version)||!Array.isArray(data.tasks))throw Error('Backup inválido');const base=fresh(),legacy=data.version===1;
 const columns=legacy?base.columns:uniqueList(data.columns,c=>({id:c.id,name:text(c.name,40,false).trim(),hidden:!!c.hidden}));if(!BASE_COLUMNS.every(c=>columns.some(x=>x.id===c.id)))throw Error('Colunas básicas ausentes');
 const services=data.services===undefined?copy(DEFAULT_SERVICES):uniqueList(data.services,item=>({id:item.id,name:text(item.name,40,false).trim(),icon:text(item.icon||'◇',10,false),image:cleanServiceIcon(item.image||'')}));const serviceIds=new Set(services.map(item=>item.id));
 const platforms=legacy?base.platforms:uniqueList(data.platforms,definition),tags=legacy?[]:uniqueList(data.tags,definition),statusIds=new Set(columns.map(c=>c.id)),platformIds=new Set(platforms.map(c=>c.id)),tagIds=new Set(tags.map(c=>c.id));
 function references(list,ids){if(!Array.isArray(list)||list.some(id=>!ids.has(id)))throw Error('Referência inválida');return [...new Set(list)];}
 const parseTask=t=>{
  const status=text(t.status,150,false);if(!statusIds.has(status))throw Error('Coluna inválida');const date=text(t.date,10),time=text(t.time,5);if(!validDate(date)||(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))||(time&&!date))throw Error('Prazo inválido');const prev=statusIds.has(t.previousStatus)&&!['done','cancelled'].includes(t.previousStatus)?t.previousStatus:'todo';
  return {...window.CFF_TASKS_PLAN.extra(t,data),id:t.id,boardOrder:Number.isInteger(t.boardOrder)&&t.boardOrder>=0&&t.boardOrder<10000?t.boardOrder:null,copies:window.CFF_TASKS_CONTENT.copies(t.copies),title:text(t.title,200,false).trim(),note:text(t.note,4000),date,time,status,previousStatus:prev,important:legacy?false:!!t.important,color:legacy?'none':Object.hasOwn(COLORS,t.color)?t.color:'none',service:legacy?'':serviceIds.has(String(t.service||''))?String(t.service):'',serviceIcon:legacy?'':cleanServiceIcon(t.serviceIcon||''),platforms:legacy?[]:references(t.platforms,platformIds),tags:legacy?[]:references(t.tags,tagIds),links:legacy?[]:uniqueList(t.links,l=>({id:l.id,url:cleanUrl(text(l.url,3000,false)),label:text(l.label,200),imageUrl:cleanUrl(text(l.imageUrl||'',3000))})),subtasks:legacy?[]:uniqueList(t.subtasks,s=>({id:s.id,text:text(s.text,300,false),done:!!s.done})),attachments:legacy?[]:uniqueList(t.attachments,a=>({id:a.id,name:text(a.name,255,false),type:text(a.type,200),remote:a.remote===true,size:Number.isFinite(a.size)&&a.size>=0?a.size:(()=>{throw Error('Anexo inválido')})()})),createdAt:legacy?now():iso(t.createdAt)||now(),updatedAt:legacy?now():iso(t.updatedAt)||now(),completedAt:legacy?null:iso(t.completedAt),cancelledAt:legacy?null:iso(t.cancelledAt),history:legacy?[]:uniqueList(t.history,h=>({id:h.id,at:iso(h.at)||now(),action:text(h.action,1000,false)}))};
 };
 const tasks=uniqueList(data.tasks,parseTask),templates=uniqueList(data.templates||[],t=>({id:t.id,name:text(t.name,80,false),task:parseTask({...t.task,platforms:(t.task.platforms||[]).filter(id=>platformIds.has(id)),tags:(t.task.tags||[]).filter(id=>tagIds.has(id)),status:statusIds.has(t.task.status)?t.task.status:'todo'})}));
 const notes=uniqueList(data.notes===undefined?[]:data.notes,(n,index)=>{if(!Object.hasOwn(NOTE_COLORS,n.color))throw Error('Cor inválida');return {id:n.id,title:n.title===undefined?'Lembrete '+(index+1):text(n.title,60,false),text:text(n.text,5000),color:n.color};});if(data.theme!==undefined&&!['light','dark'].includes(data.theme))throw Error('Tema inválido');const settings=legacy?base.settings:data.settings||{};
 const usefulLinks=uniqueList(data.usefulLinks||[],item=>{
  const links=uniqueList(item.links===undefined?[{id:item.id+':1',url:item.url,label:''}]:item.links,l=>{
   const url=cleanUrl(text(l.url,3000,false));if(!url)throw Error('Link vazio');
   return {id:l.id,url,label:text(l.label||'',200).trim()};
  });if(!links.length)throw Error('Adicione ao menos um link');
  return {id:item.id,label:text(item.label,80,false).trim(),url:links[0].url,links};
 });
 const dailyPosts=uniqueList(data.dailyPosts||[],post=>{
  const days=post.days;if(!Array.isArray(days)||!days.length||days.some(day=>!Number.isInteger(day)||day<0||day>6))throw Error('Dias do post diário inválidos');
  const time=text(post.time||'',5);if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Horário do post diário inválido');
  const completedDates=post.completedDates||{};if(typeof completedDates!=='object'||Array.isArray(completedDates))throw Error('Conclusões inválidas');
  for(const [date,done] of Object.entries(completedDates)){if(!date||!validDate(date)||typeof done!=='boolean')throw Error('Conclusão diária inválida');}
  return {id:post.id,title:text(post.title,140,false).trim(),days:[...new Set(days)].sort(),time,completedDates:copy(completedDates)};
 });
 return {version:5,...window.CFF_TASKS_PROJECTS.normalise(data),tasks,templates,notes,usefulLinks,dailyPosts,services,theme:data.theme||'dark',columns,platforms,tags,settings:{warningMinutes:[15,30,60,180,1440].includes(Number(settings.warningMinutes))?Number(settings.warningMinutes):60,...window.CFF_TASKS_PLAN.settings(settings),view:['agenda','day','calendar','archive'].includes(settings.view)?settings.view:'board',sort:['manual','deadline','important','newest','title'].includes(settings.sort)?settings.sort:'deadline'}};
}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function notice(message){$('storage-notice').textContent=message;$('storage-notice').classList.add('visible');$('save-status').textContent='Falha ao salvar · Exporte um backup antes de fechar.';}
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function openDatabase(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{req.result.createObjectStore('state');req.result.createObjectStore('files',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Banco ocupado'));});}
function transact(next,fileChanges=[],replaceFiles=false){
 if(storageBlocked)return Promise.reject(Error('Dados anteriores protegidos'));
 if(!db){if(fileChanges.some(x=>x.blob))return Promise.reject(Error('Este navegador não permite salvar anexos.'));try{localStorage.setItem(KEY,JSON.stringify(next));return Promise.resolve();}catch(e){return Promise.reject(e);}}
 return new Promise((resolve,reject)=>{const tx=db.transaction(['state','files'],'readwrite');tx.objectStore('state').put(next,'board');const store=tx.objectStore('files');if(replaceFiles)store.clear();fileChanges.forEach(f=>f.blob?store.put({id:f.id,blob:f.blob}):store.delete(f.id));tx.oncomplete=()=>{try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}resolve();};tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Salvamento interrompido'));});
}
function hasMeaningfulState(value){
 return Boolean(value?.projects?.length||value?.templates?.length||value?.tasks?.length||value?.notes?.length||value?.usefulLinks?.length||value?.dailyPosts?.length||JSON.stringify(value?.services||DEFAULT_SERVICES)!==JSON.stringify(DEFAULT_SERVICES)||value?.tags?.length||value?.columns?.some(c=>!BASE_COLUMNS.some(b=>b.id===c.id&&b.name===c.name&&!c.hidden))||value?.platforms?.some(p=>!fresh().platforms.some(b=>b.id===p.id&&b.name===p.name)));
}
function mergeById(remoteItems,localItems,preferLocal=false){
 const map=new Map((remoteItems||[]).map(item=>[item.id,copy(item)]));
 for(const item of localItems||[]){
  const current=map.get(item.id);
  if(!current){map.set(item.id,copy(item));continue;}
  if(preferLocal){map.set(item.id,copy(item));continue;}
  const localTime=Date.parse(item.updatedAt||item.createdAt||0)||0,currentTime=Date.parse(current.updatedAt||current.createdAt||0)||0;
  if(localTime>currentTime)map.set(item.id,copy(item));
 }
 return [...map.values()];
}
function mergeInitialStates(localState,remoteState){
 const projectKeys=window.CFF_TASKS_PROJECTS.keys;
 const recoveredProjects=window.CFF_TASKS_SYNC.merge(Object.fromEntries(projectKeys.map(key=>[key,[]])),localState,remoteState);
 const merged={
  ...copy(remoteState),
  ...Object.fromEntries(projectKeys.map(key=>[key,recoveredProjects[key]])),
  tasks:mergeById(remoteState.tasks,localState.tasks),templates:mergeById(remoteState.templates,localState.templates),
  notes:mergeById(remoteState.notes,localState.notes,true),
  usefulLinks:mergeById(remoteState.usefulLinks,localState.usefulLinks,true),
  dailyPosts:mergeById(remoteState.dailyPosts,localState.dailyPosts,true),
  services:mergeById(remoteState.services,localState.services,true),
  columns:mergeById(remoteState.columns,localState.columns,true),
  platforms:mergeById(remoteState.platforms,localState.platforms,true),
  tags:mergeById(remoteState.tags,localState.tags,true),
  theme:localState.theme||remoteState.theme,
  settings:{...remoteState.settings,...localState.settings}
 };
 return normalise(merged);
}
function cloudStatus(message){if(!$('storage-notice').classList.contains('visible'))$('save-status').textContent=message;}
function checkpoint(){
 try{localStorage.setItem(SYNC_KEY,JSON.stringify({base:syncBase,dirty:syncDirty,local:state}));}catch{cloudStatus('Cópia local limitada · mantenha a página aberta até sincronizar.');}
}
function repaintCloud(){
 projectsUI?.refresh();
 applyTheme();refreshFilters();renderBoard();
 // Keep typing uninterrupted. The focused note is refreshed when editing finishes.
 if(!document.activeElement?.closest('.sticky-body'))renderNotes();
 if(!document.activeElement?.closest('#useful-link-form'))renderUsefulLinks();
 renderDailyPosts();if($('columns-dialog').open)renderServices();
 if(draft&&$('editor').open&&document.activeElement!==$('task-service')){fillServiceSelect(draft.service);renderServiceIconPicker();}
}
function retryCloud(){
 clearTimeout(cloudRetry);
 cloudRetry=setTimeout(()=>{if(booted&&!storageBlocked){if(cloudReady)flushCloud().catch(()=>{});else initCloudSync(true);}},5000);
}
async function flushCloud(){
 clearTimeout(cloudTimer);cloudTimer=null;
 if(!syncDirty||!window.CFF_TASKS_CLOUD||cloudBusy||!cloudReady)return cloudSaveChain;
 const snapshot=copy(state),base=syncBase&&copy(syncBase);cloudBusy=true;
 cloudSaveChain=(async()=>{
  try{
   const payload=await window.CFF_TASKS_CLOUD.save(snapshot,base);
   const confirmed=normalise(window.CFF_TASKS_SYNC.decode(payload));cloudRevision=Number(payload.updatedAt)||cloudRevision;
   const next=normalise(window.CFF_TASKS_SYNC.merge(snapshot,state,confirmed));
   const changed=!window.CFF_TASKS_SYNC.same(next,state);
   if(changed)state=next;syncBase=confirmed;clearTimeout(cloudRetry);cloudRetry=null;syncDirty=!window.CFF_TASKS_SYNC.same(state,syncBase);checkpoint();
   await persistCloudStateLocally(state);
   try{localStorage.setItem(CLOUD_MARKER,'1');}catch{}
   if(changed)repaintCloud();planUI?.confirmed();
   cloudStatus(syncDirty?'Salvo neste aparelho · sincronizando…':'Sincronizado na nuvem · cópia local ativa.');
  }catch(error){
   syncDirty=true;checkpoint();console.error('[Tasks cloud save]',error);
   cloudStatus('Salvo neste aparelho · envio pendente. Tentando novamente…');retryCloud();
   throw error;
  }finally{cloudBusy=false;if(syncDirty&&!cloudRetry)scheduleCloud(state);}
 })();
 return cloudSaveChain;
}
function scheduleCloud(next,delay=450){
 if(applyingRemote||!window.CFF_TASKS_CLOUD)return;
 clearTimeout(cloudTimer);cloudStatus('Salvo neste aparelho · sincronizando com a nuvem…');
 cloudTimer=setTimeout(()=>{if(cloudReady)flushCloud().catch(()=>{});else initCloudSync(true);},delay);
}
async function persistCloudStateLocally(next){
 const operation=saveQueue.then(()=>transact(next));saveQueue=operation.catch(()=>{});await operation;
}
async function applyCloudPayload(payload,render=true){
 if(!payload)return false;
 const remote=normalise(window.CFF_TASKS_SYNC.decode(payload));cloudRevision=Number(payload.updatedAt)||cloudRevision;
 const next=syncDirty?normalise(window.CFF_TASKS_SYNC.merge(syncBase,state,remote)):remote;
 const changed=!window.CFF_TASKS_SYNC.same(state,next);
 if(changed)state=next;syncBase=copy(remote);syncDirty=!window.CFF_TASKS_SYNC.same(next,remote);checkpoint();
 await persistCloudStateLocally(next);
 if(render&&changed)repaintCloud();planUI?.confirmed();
 cloudReady=true;try{localStorage.setItem(CLOUD_MARKER,'1');}catch{}
 cloudStatus(syncDirty?'Salvo neste aparelho · sincronizando…':'Sincronizado da nuvem · cópia local ativa.');
 if(syncDirty&&!cloudBusy)scheduleCloud(state);
 return true;
}
let cloudInitializing=false;
async function initCloudSync(renderRemote=false){
 const cloud=window.CFF_TASKS_CLOUD;if(!cloud||cloudInitializing||storageBlocked)return false;
 cloudInitializing=true;
 try{
  const payload=await cloud.load();
  if(payload){
   const remote=normalise(window.CFF_TASKS_SYNC.decode(payload));cloudRevision=Number(payload.updatedAt)||cloudRevision;
   if(!syncBase&&hasMeaningfulState(state)){
    // One-time recovery of boards saved before durable sync checkpoints existed.
    state=mergeInitialStates(state,remote);syncBase=remote;syncDirty=!window.CFF_TASKS_SYNC.same(state,remote);checkpoint();
    await persistCloudStateLocally(state);if(renderRemote)repaintCloud();
   }else await applyCloudPayload(payload,renderRemote);
  }else{syncBase=syncBase||fresh();syncDirty=syncDirty||hasMeaningfulState(state);checkpoint();}
  cloudReady=true;clearTimeout(cloudRetry);cloudRetry=null;
  if(cloudUnsubscribe)cloudUnsubscribe();
  cloudUnsubscribe=cloud.subscribe(p=>{applyCloudPayload(p,true).catch(error=>{console.error('[Tasks cloud receive]',error);cloudStatus('Atualização pendente · tentando reconectar…');retryCloud();});},error=>{console.error('[Tasks cloud listen]',error);cloudReady=false;cloudStatus('Salvo neste aparelho · tentando reconectar à nuvem…');retryCloud();});
  if(syncDirty)await flushCloud();else cloudStatus('Sincronizado na nuvem · cópia local ativa.');
  return true;
 }catch(error){console.error('[Tasks cloud init]',error);cloudReady=false;cloudStatus('Salvo neste aparelho · nuvem indisponível. Tentando novamente…');retryCloud();return false;}
 finally{cloudInitializing=false;}
}
function save(changes=[]){
 syncDirty=true;checkpoint();const next=copy(state);planUI?.changed();$('save-status').textContent='Salvando…';
 const operation=saveQueue.then(()=>{const pending=new Map(failedFileChanges);changes.forEach(change=>pending.set(change.id,change));return transact(next,[...pending.values()]).then(()=>{failedFileChanges.clear();scheduleCloud(next);},error=>{failedFileChanges=pending;throw error;});});
 saveQueue=operation.catch(e=>{notice(storageBlocked?'Os dados anteriores estão protegidos. Importe um backup para substituir ou exporte o quadro atual.':'Não foi possível salvar suas alterações. Exporte um backup antes de fechar a página.');});
 operation.then(()=>{if(!window.CFF_TASKS_CLOUD&&!$('storage-notice').classList.contains('visible'))$('save-status').textContent='Salvo neste navegador · Backup completo inclui os anexos.';},()=>{});
 return operation;
}
function history(t,action){t.updatedAt=now();t.history.push({id:uid(),at:t.updatedAt,action});}
const columnName=id=>state.columns.find(c=>c.id===id)?.name||'Coluna';
const isActive=t=>!['done','cancelled'].includes(t.status);
function deadline(t){if(!t.date)return null;return new Date(window.CFF_TASKS_PLAN.instant(t.date,t.time||'23:59')+(t.time?0:59000));}
function remaining(t,at=Date.now()){
 if(t.status==='done')return {label:'Concluída',level:'done'};if(t.status==='cancelled')return {label:'Cancelada',level:'cancelled'};if(t.startDate&&t.startDate>today())return {label:'A partir de '+new Date(t.startDate+'T12:00:00').toLocaleDateString('pt-BR'),level:'future'};const due=deadline(t);if(!due)return {label:'Sem prazo',level:'none'};const ms=+due-at,abs=Math.abs(ms),minutes=Math.max(1,Math.ceil(abs/60000));let duration=minutes<60?minutes+' min':minutes<1440?Math.floor(minutes/60)+'h'+(minutes%60?' '+minutes%60+'min':''):Math.floor(minutes/1440)+'d'+(Math.floor(minutes%1440/60)?' '+Math.floor(minutes%1440/60)+'h':'');if(ms<0)return {label:'Atrasada há '+duration,level:'late'};return {label:'Faltam '+duration,level:ms<=15*60000?'urgent':ms<=state.settings.warningMinutes*60000?'soon':'normal'};
}
function dateLabel(t){if(!t.date)return 'Sem data';let label=t.date===today()?'Hoje':new Date(t.date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',...(t.date.slice(0,4)!==String(new Date().getFullYear())?{year:'numeric'}:{})});if(t.startDate&&t.startDate!==t.date)label=new Date(t.startDate+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' até '+label;return label+(t.time?' · '+t.time:' · fim do dia');}
function stamp(value){return value?new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';}
function applyTheme(){
 document.documentElement.dataset.theme=state.theme;
 const button=$('theme-toggle'),icon=button?.querySelector('.theme-icon'),label=button?.querySelector('.theme-label');
 const dark=state.theme==='dark';
 if(icon)icon.textContent=dark?'☀':'☾';
 if(label)label.textContent=dark?'Modo claro':'Modo noturno';
 if(button){button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Ativar modo claro':'Ativar modo noturno');button.title=button.getAttribute('aria-label');}
}
function columnTone(id){
 const base={todo:'blue',doing:'amber',done:'green',cancelled:'red'};if(base[id])return base[id];
 const custom=state.columns.filter(column=>!base[column.id]);return ['violet','teal','pink','orange'][Math.max(0,custom.findIndex(column=>column.id===id))%4];
}
function styleStatusSelect(select){
 select.classList.add('status-picker');select.dataset.statusTone=select.value?columnTone(select.value):'';
 Array.from(select.options).forEach(option=>{option.dataset.statusTone=option.value?columnTone(option.value):'';});
}
function fillSelect(select,items,placeholder,selected=''){select.replaceChildren();if(placeholder!==null){const o=el('option','',placeholder);o.value='';select.append(o);}items.forEach(item=>{const o=el('option','',item.name);o.value=item.id;select.append(o);});select.value=selected;if(select.selectedIndex===-1)select.selectedIndex=0;if(items===state.columns)styleStatusSelect(select);}
function fillServiceSelect(selected=''){
 const select=$('task-service');select.replaceChildren();const empty=el('option','','Sem serviço');empty.value='';select.append(empty);
 state.services.forEach(item=>{const option=el('option','',item.icon+'  '+item.name);option.value=item.id;select.append(option);});
 const custom=el('option','','＋ Serviço personalizado…');custom.value='__custom__';select.append(custom);select.value=serviceById(selected)?selected:'';
}
function renderServiceIconPicker(){
 if(!draft)return;const image=$('service-icon-image'),fallback=$('service-icon-fallback'),remove=$('remove-service-icon'),meta=serviceById($('task-service').value||draft.service||''),url=draft.serviceIcon||meta?.image;
 if(url){image.src=url;image.hidden=false;fallback.hidden=true;}else{image.removeAttribute('src');image.hidden=true;fallback.hidden=false;fallback.textContent=meta?.icon||'◇';}
 remove.hidden=!draft.serviceIcon;
}


function refreshFilters(){fillSelect($('filter-platform'),state.platforms,'Todas as plataformas',filters.platform);fillSelect($('filter-tag'),state.tags,'Todas as etiquetas',filters.tag);fillSelect($('filter-status'),state.columns,'Todas as colunas',filters.status);$('sort').value=state.settings.sort;}
function matches(t){const serviceName=serviceById(t.service)?.name||'';const textMatch=(t.title+' '+t.note+' '+serviceName+' '+(t.copies||[]).map(c=>c.label+' '+c.text).join(' ')+' '+(t.assignee||'')+' '+(t.approval?.person||'')+' '+(state.projects.find(p=>p.id===t.projectId)?.name||'')+' '+(state.projectCompanies.find(c=>c.id===t.companyId)?.name||'')+' '+t.links.map(l=>l.url+' '+l.label).join(' ')).toLocaleLowerCase('pt-BR').includes(filters.text);const level=remaining(t).level;return textMatch&&(!filters.platform||t.platforms.includes(filters.platform))&&(!filters.tag||t.tags.includes(filters.tag))&&(!filters.status||t.status===filters.status)&&(!filters.important||t.important)&&(filters.deadline==='all'||filters.deadline==='today'&&(window.CFF_TASKS_PLAN.inWindow(t)||t.publishDate===today())||filters.deadline==='late'&&level==='late'||filters.deadline==='soon'&&['soon','urgent'].includes(level));}
function sortTasks(list){return [...list].sort((a,b)=>{if(state.settings.sort==='manual')return (a.boardOrder??Infinity)-(b.boardOrder??Infinity)||0;const byDue=(deadline(a)?.getTime()||Infinity)-(deadline(b)?.getTime()||Infinity);if(state.settings.sort==='important')return Number(b.important)-Number(a.important)||(Number.isNaN(byDue)?0:byDue);if(state.settings.sort==='newest')return Date.parse(b.createdAt)-Date.parse(a.createdAt);if(state.settings.sort==='title')return a.title.localeCompare(b.title,'pt-BR');return (Number.isNaN(byDue)?0:byDue)||Number(b.important)-Number(a.important);});}
function clearDropMarks(){document.querySelectorAll('.drop-before,.drop-after,.column.over').forEach(e=>e.classList.remove('drop-before','drop-after','over'));}
function writeBoardOrder(items){items.forEach((t,index)=>{if(t.boardOrder!==index){t.boardOrder=index;t.updatedAt=now();}});}
function moveCard(id,status,anchorId=null,after=false){
 const t=state.tasks.find(t=>t.id===id);if(!t||!state.columns.some(c=>c.id===status)||anchorId===id)return false;
 const previous=t.status,items=sortTasks(state.tasks.filter(x=>x.status===status&&x.id!==id));
 const anchor=anchorId?items.findIndex(x=>x.id===anchorId):-1;if(anchorId&&anchor<0)return false;
 items.splice(anchor<0?items.length:anchor+(after?1:0),0,t);
 const before=sortTasks(state.tasks.filter(x=>x.status===status));
 if(previous===status&&before.every((x,i)=>x.id===items[i].id))return false;
 // Preserve the displayed order of every column when leaving an automatic sort.
 if(state.settings.sort!=='manual')for(const c of state.columns)writeBoardOrder(sortTasks(state.tasks.filter(x=>x.status===c.id)));
 if(previous!==status){if(!['done','cancelled'].includes(previous))t.previousStatus=previous;t.status=status;t.completedAt=status==='done'?now():null;t.cancelledAt=status==='cancelled'?now():null;history(t,`Coluna alterada: ${columnName(previous)} → ${columnName(status)}`);}
 else history(t,'Posição alterada em '+columnName(status));
 writeBoardOrder(items);state.settings.sort='manual';$('sort').value='manual';
 if(previous!==status)planUI?.complete(t,previous);
 save();renderBoard();toast('Posição salva · Ordem manual');return true;
}
function moveCardStep(id,direction){
 const t=state.tasks.find(t=>t.id===id);if(!t)return;
 const visible=sortTasks(state.tasks.filter(x=>x.status===t.status&&matches(x))),index=visible.findIndex(x=>x.id===id),anchor=visible[index+direction];
 if(!anchor)return;moveCard(id,t.status,anchor.id,direction>0);
 Array.from(document.querySelectorAll('.column .card')).find(c=>c.dataset.taskId===id)?.querySelector(direction<0?'.card-move-up':'.card-move-down')?.focus({preventScroll:true});
}
function decorateCardOrder(card,t,index,total){
 if(state.settings.view!=='board')return;
 const bar=el('div','card-reorder'),grip=el('span','card-drag-grip');grip.append(window.CFF_TASKS_CONTENT.icon('grip'));grip.title='Arraste para escolher a posição na coluna';bar.append(grip);
 for(const [direction,label] of [[-1,'cima'],[1,'baixo']]){const b=el('button','card-move '+(direction<0?'card-move-up':'card-move-down'));b.append(window.CFF_TASKS_CONTENT.icon(direction<0?'up':'down'));b.type='button';b.disabled=direction<0?index===0:index===total-1;b.title='Mover para '+label;b.setAttribute('aria-label','Mover '+t.title+' para '+label);b.onclick=()=>moveCardStep(t.id,direction);bar.append(b);}
 const head=card.querySelector('.card-head'),tools=el('div','card-utilities'),service=head.querySelector('.card-service'),toggle=head.querySelector('.card-disclosure');if(service)tools.append(service);if(toggle)bar.append(toggle);tools.append(bar);head.prepend(tools);
}
function columnDropTarget(col,e){
 const cards=Array.from(col.querySelectorAll('.card')).filter(c=>c.dataset.taskId!==dragId);
 const card=cards.find(c=>{const rect=c.getBoundingClientRect();return e.clientY<rect.top+rect.height/2;});
 return card?{card,after:false}:cards.length?{card:cards[cards.length-1],after:true}:null;
}
function setStatus(t,status){t=state.tasks.find(item=>item.id===t.id);if(!t||t.status===status)return;const previous=t.status;if(!['done','cancelled'].includes(previous))t.previousStatus=previous;t.status=status;t.boardOrder=null;t.completedAt=status==='done'?now():null;t.cancelledAt=status==='cancelled'?now():null;history(t,`Coluna alterada: ${columnName(previous)} → ${columnName(status)}`);planUI?.complete(t,previous);save();renderBoard();}
function pruneFiles(){const referenced=new Set(state.tasks.flatMap(t=>t.attachments.map(a=>a.id))),removed=[];for(const id of files.keys())if(!referenced.has(id)){files.delete(id);removed.push({id});}return removed;}
function makeCard(t){
 const card=el('article','card'+(t.status==='done'?' completed':'')+(t.status==='cancelled'?' cancelled':'')+(t.important?' important':''));card.dataset.taskId=t.id;card.dataset.color=t.color;card.draggable=true;
 const head=el('div','card-head'),top=el('div','card-top'),star=el('button','star',t.important?'★':'☆');star.title=t.important?'Remover importância':'Marcar como importante';star.setAttribute('aria-label',star.title+': '+t.title);star.setAttribute('aria-pressed',String(t.important));star.addEventListener('click',()=>{const current=state.tasks.find(item=>item.id===t.id);if(!current)return;current.important=!current.important;history(current,current.important?'Marcada como importante':'Importância removida');save();renderBoard();});
 const title=el('button','card-title',t.title);title.title='Editar tarefa';title.addEventListener('click',()=>openEditor(t.status,t));const complete=el('label','complete-label'),check=el('input','complete-input');check.type='checkbox';check.checked=t.status==='done';check.setAttribute('aria-label',(check.checked?'Reabrir: ':'Concluir: ')+t.title);complete.title=check.checked?'Reabrir tarefa':'Concluir tarefa';const circle=el('span','complete-circle','✓');circle.setAttribute('aria-hidden','true');complete.append(check,circle);check.addEventListener('change',()=>{const done=check.checked;setStatus(t,done?'done':state.columns.some(c=>c.id===t.previousStatus)?t.previousStatus:'todo');toast(done?'Tarefa concluída!':'Tarefa reaberta');});
 if((t.service&&serviceById(t.service))||t.serviceIcon){const meta=serviceById(t.service)||{name:'Serviço',icon:'◇'},service=el('div','card-service');service.dataset.service=t.service||'custom';const icon=el('span','card-service-icon'),name=el('span','card-service-name',meta.name);if(t.serviceIcon||meta.image){const img=el('img','card-service-image');img.src=t.serviceIcon||meta.image;img.alt='';icon.append(img);}else icon.textContent=meta.icon;service.append(icon,name);head.append(service);}
 top.append(star,title,complete);head.append(top);card.append(head);
 const body=el('div','card-body');
 if(t.note)body.append(el('p','card-text',t.note));const chips=el('div','chips');if(t.important)chips.append(el('span','chip important-tag','★ Importante'));t.platforms.forEach(id=>{const p=state.platforms.find(x=>x.id===id);if(p)chips.append(el('span','chip',p.name));});t.tags.forEach(id=>{const p=state.tags.find(x=>x.id===id);if(p)chips.append(el('span','chip tag',p.name));});if(state.settings.view==='agenda')chips.append(el('span','chip',columnName(t.status)));if(chips.children.length)body.append(chips);
 const due=el('div','deadline'),date=el('span','due-badge',dateLabel(t)),r=remaining(t),countdown=el('span','remaining '+r.level,r.label);countdown.dataset.countdown=t.id;due.append(date,countdown);body.append(due);
 if(t.subtasks.length){const finished=t.subtasks.filter(s=>s.done).length,mini=el('div','mini-subtasks',`${finished}/${t.subtasks.length} etapas concluídas`),track=el('div','mini-track'),bar=el('span');bar.style.width=finished/t.subtasks.length*100+'%';track.append(bar);mini.append(track);body.append(mini);}
 t.links.slice(0,2).forEach(link=>{const a=el('a','card-link');a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';if(link.imageUrl){const img=el('img');img.src=link.imageUrl;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove());a.append(img);}a.append(el('span','', '↗ '+(link.label||new URL(link.url).hostname)));body.append(a);});
 const extras=[];if(t.links.length>2)extras.push('+'+(t.links.length-2)+' links');if(t.attachments.length)extras.push(t.attachments.length+' anexo'+(t.attachments.length===1?'':'s'));if(extras.length)body.append(el('p','card-meta',extras.join(' · ')));if(t.completedAt||t.cancelledAt)body.append(el('p','card-meta',(t.completedAt?'Concluída em ':'Cancelada em ')+stamp(t.completedAt||t.cancelledAt)));
 const bottom=el('div','card-actions'),select=el('select','status-select');select.setAttribute('aria-label','Coluna de '+t.title);fillSelect(select,state.columns,null,t.status);select.addEventListener('change',()=>setStatus(t,select.value));const edit=el('button','icon-btn','Editar');edit.addEventListener('click',()=>openEditor(t.status,t));const duplicate=el('button','icon-btn','Duplicar');duplicate.addEventListener('click',()=>duplicateTask(t));const del=el('button','icon-btn delete','Excluir');del.addEventListener('click',()=>{if(!confirm(`Excluir “${t.title}” e seu histórico?`))return;state.tasks=state.tasks.filter(x=>x.id!==t.id);save(pruneFiles());renderBoard();toast('Tarefa excluída');});bottom.append(select,edit,duplicate,del);body.append(bottom);card.append(body);
 card.addEventListener('dragstart',e=>{if(e.target.closest('button,input,label,a,select,textarea')){e.preventDefault();return;}dragId=t.id;e.dataTransfer.setData('text/plain',t.id);e.dataTransfer.effectAllowed='move';card.classList.add('dragging');});card.addEventListener('dragend',()=>{dragId=null;card.classList.remove('dragging');clearDropMarks();});planUI?.decorate(card,t);contentUI?.decorate(card,t);return card;
}
function duplicateTask(original){original=state.tasks.find(item=>item.id===original.id)||original;const t=copy(original),at=now();t.id=uid();t.seriesId=t.id;t.focusDate='';t.publishedUrl='';if(t.approval)t.approval={...t.approval,sentAt:'',note:'',state:t.approval.state==='none'?'none':'pending'};t.title=(original.title+' (cópia)').slice(0,200);t.status='todo';t.boardOrder=null;t.previousStatus='todo';t.createdAt=at;t.updatedAt=at;t.completedAt=null;t.cancelledAt=null;t.subtasks=t.subtasks.map(s=>({...s,id:uid(),done:false}));t.links=t.links.map(l=>({...l,id:uid()}));t.copies=(t.copies||[]).map(c=>({...c,id:uid()}));t.history=[{id:uid(),at,action:'Criada como cópia de “'+original.title+'”'}];state.tasks.push(t);save();renderBoard();openEditor('todo',t);toast('Cópia criada em '+columnName('todo'));}
function updateSummary(){const done=state.tasks.filter(t=>t.status==='done').length,total=state.tasks.filter(t=>t.status!=='cancelled').length,cancelled=state.tasks.length-total;$('progress-text').textContent=total?`${done} de ${total} tarefas concluídas${cancelled?' · '+cancelled+' canceladas':''}`:'Seu quadro está pronto. Adicione uma tarefa.';$('progress-bar').style.width=(total?done/total*100:0)+'%';const hidden=state.columns.filter(c=>c.hidden);$('hidden-info').textContent=hidden.length?hidden.length+' coluna'+(hidden.length===1?' oculta':'s ocultas')+' · veja em Colunas e ajustes':'';}
function updateAlerts(){const near=state.tasks.filter(t=>{const r=remaining(t);return ['urgent','soon'].includes(r.level);});$('deadline-alert').classList.toggle('visible',near.length>0);$('deadline-alert-text').textContent=near.length===1?'Uma tarefa está perto do prazo.':`${near.length} tarefas estão perto do prazo.`;}
function renderBoard(){
 projectsUI?.refreshTasks?.();
 const board=$('board'),agenda=$('agenda');board.replaceChildren();agenda.replaceChildren();const visible=state.columns.filter(c=>!c.hidden),ids=new Set(visible.map(c=>c.id)),shown=state.tasks.filter(t=>ids.has(t.status)&&matches(t));board.hidden=state.settings.view!=='board';agenda.hidden=state.settings.view!=='agenda';document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.settings.view)));
 $('visible-count').textContent=shown.length+' tarefa'+(shown.length===1?'':'s')+' visível'+(shown.length===1?'':'s');updateSummary();updateAlerts();planUI?.render();if(!['board','agenda'].includes(state.settings.view))return;
 if(!visible.length){const empty=el('div','all-hidden','Todas as colunas estão ocultas.'),b=el('button','quiet','Mostrar colunas');b.addEventListener('click',openColumns);empty.append(el('br'),b);(state.settings.view==='board'?board:agenda).append(empty);board.style.setProperty('--cols','1');return;}
 board.style.setProperty('--cols',String(Math.max(visible.length,1)));
 if(state.settings.view==='board'){visible.forEach(c=>{const col=el('section','column');col.dataset.status=c.id;col.setAttribute('aria-label',c.name);const head=el('header','column-head'),dot=el('span','dot');dot.style.setProperty('--dot',{blue:'#79a9ea',amber:'#d2ac55',green:'#76bd94',red:'#d28990',violet:'#ac91e4',teal:'#67b4b0',pink:'#da93bb',orange:'#d6a071'}[columnTone(c.id)]);const items=sortTasks(shown.filter(t=>t.status===c.id)),count=el('span','count',items.length),hide=el('button','column-hide','◌');hide.title='Ocultar coluna';hide.setAttribute('aria-label','Ocultar '+c.name);hide.addEventListener('click',()=>{c.hidden=true;save();renderBoard();toast('Coluna oculta. Mostre novamente em Colunas e ajustes.');});head.append(dot,el('span','',c.name),count,hide);contentUI?.decorateColumn(head,c);const list=el('div','cards');if(!items.length)list.append(el('p','empty','Nenhuma tarefa por aqui.'));items.forEach((t,index)=>{const card=makeCard(t);decorateCardOrder(card,t,index,items.length);list.append(card);});const add=el('button','add-column','+ Adicionar tarefa');add.addEventListener('click',()=>openEditor(c.id));col.append(head,list,add);col.addEventListener('dragover',e=>{if(!dragId)return;e.preventDefault();e.dataTransfer.dropEffect='move';clearDropMarks();col.classList.add('over');const target=columnDropTarget(col,e);target?.card.classList.add(target.after?'drop-after':'drop-before');});col.addEventListener('dragleave',e=>{if(!col.contains(e.relatedTarget))clearDropMarks();});col.addEventListener('drop',e=>{if(!dragId)return;e.preventDefault();const id=dragId,target=columnDropTarget(col,e);dragId=null;clearDropMarks();moveCard(id,c.id,target?.card.dataset.taskId||null,target?.after||false);});board.append(col);});}
 else{const groups=new Map();sortTasks(shown).forEach(t=>{const key=t.date||'9999';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);});if(!shown.length)agenda.append(el('p','all-hidden','Nenhuma tarefa para os filtros escolhidos.'));[...groups.keys()].sort().forEach(key=>{const section=el('section','agenda-group'),label=key==='9999'?'Sem data definida':new Date(key+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});section.append(el('h3','agenda-head',(key===today()?'Hoje · ':'')+label));const grid=el('div','agenda-grid');sortTasks(groups.get(key)).forEach(t=>grid.append(makeCard(t)));section.append(grid);agenda.append(section);});}
}
function tick(){planUI?.tick();updateDailyStatuses();document.querySelectorAll('[data-countdown]').forEach(e=>{const t=state.tasks.find(t=>t.id===e.dataset.countdown);if(!t)return;const r=remaining(t);e.textContent=r.label;e.className='remaining '+r.level;});updateAlerts();if(['soon','late'].includes(filters.deadline)&&!$('editor').open&&!dragId)renderBoard();}
function autoNoteHeight(input){input.style.height='auto';input.style.height=Math.min(Math.max(input.scrollHeight,38),Math.max(150,innerHeight*.6))+'px';}
function renderNotes(){
 const list=$('sticky-list');list.replaceChildren();if(!state.notes.length)list.append(el('p','sticky-empty','Clique no + para colar seu primeiro lembrete.'));
 state.notes.forEach((n,index)=>{
  const shell=el('div','sticky-shell'),card=el('article','sticky'+(n.id===openNoteId?' expanded':''));shell.dataset.noteId=n.id;card.dataset.color=n.color;
  const head=el('div','sticky-top'),title=el('button','sticky-title',(n.id===openNoteId?'▾ ':'▸ ')+(n.title||'Lembrete '+(index+1)));title.title=n.title||'Abrir lembrete';title.setAttribute('aria-expanded',String(n.id===openNoteId));title.setAttribute('aria-controls','note-body-'+n.id);title.addEventListener('click',()=>{openNoteId=openNoteId===n.id?null:n.id;editNoteId=null;renderNotes();});
  const edit=el('button','sticky-edit','✎');edit.title='Editar título e cor';edit.setAttribute('aria-label','Editar título e cor de '+(n.title||'lembrete'));edit.addEventListener('click',()=>{openNoteId=n.id;editNoteId=editNoteId===n.id?null:n.id;renderNotes();});
  const del=el('button','sticky-delete','×');del.title='Excluir lembrete';del.setAttribute('aria-label','Excluir '+(n.title||'lembrete'));del.addEventListener('click',()=>{if((n.text.trim()||n.title&&!/^Lembrete|^Novo lembrete/.test(n.title))&&!confirm('Excluir este lembrete?'))return;state.notes=state.notes.filter(x=>x.id!==n.id);if(openNoteId===n.id)openNoteId=null;if(editNoteId===n.id)editNoteId=null;save();renderNotes();});head.append(title,edit,del);card.append(head);
  if(openNoteId===n.id){
   const body=el('div','sticky-body');body.id='note-body-'+n.id;
   if(editNoteId===n.id){const settings=el('div','sticky-settings'),label=el('label','sticky-setting-label','Título'),name=el('input');name.type='text';name.value=n.title||'Lembrete '+(index+1);name.maxLength=60;name.setAttribute('aria-label','Título do lembrete');name.addEventListener('input',()=>{n.title=name.value.trim()||'Lembrete';const current=state.notes.find(x=>x.id===n.id);if(current)current.title=n.title;title.textContent='▾ '+n.title;save();});label.append(name);settings.append(label);const colors=el('div','sticky-colors');Object.entries(NOTE_COLORS).forEach(([color,colorName])=>{const b=el('button','swatch');b.dataset.color=color;b.title=colorName;b.setAttribute('aria-label','Cor '+colorName);b.setAttribute('aria-pressed',String(color===n.color));b.addEventListener('click',()=>{n.color=color;const current=state.notes.find(x=>x.id===n.id);if(current)current.color=color;card.dataset.color=color;colors.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));save();});colors.append(b);});settings.append(colors);body.append(settings);}
   const input=el('textarea');input.value=n.text;input.maxLength=5000;input.placeholder='Escreva seu lembrete…';input.setAttribute('aria-label','Texto de '+(n.title||'lembrete'));input.addEventListener('input',()=>{n.text=input.value;const current=state.notes.find(x=>x.id===n.id);if(current)current.text=n.text;autoNoteHeight(input);save();});body.append(input);card.append(body);requestAnimationFrame(()=>autoNoteHeight(input));
  }
  shell.append(card);list.append(shell);
 });
}
let editingUsefulId=null;
function setToolPanel(name){
 ['reminders','links','daily'].forEach(kind=>{
  const panel=$({reminders:'reminder-drawer',links:'links-drawer',daily:'daily-drawer'}[kind]);panel.hidden=kind!==name;
  $('toggle-'+kind).setAttribute('aria-expanded',String(kind===name));
 });
}
function usefulIcon(kind){
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');
 const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d',kind==='copy'?'M9 9h12v12H9V9ZM15 5V3H3v12h2':'M4 20h4L20 8l-4-4L4 16v4ZM14 6l4 4');icon.append(path);return icon;
}
async function copyUsefulLink(url){
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
  else{const input=el('textarea');input.value=url;input.style.cssText='position:fixed;opacity:0';document.body.append(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw Error('Cópia indisponível');}
  toast('Link copiado');
 }catch{toast('Não foi possível copiar. Abra o link para copiar o endereço.');}
}
function usefulEntries(item){return item.links||[{id:item.id+':1',url:item.url,label:''}];}
function addUsefulUrlField(entry={}){
 const fields=$('useful-link-fields'),row=el('div','useful-url-field');row.dataset.linkId=entry.id||uid();
 const urlLabel=el('label','field','Link'),url=el('input','useful-url-input');url.type='text';url.inputMode='url';url.maxLength=3000;url.placeholder='https://…';url.required=true;url.value=entry.url||'';
 // Keep the first field's identifier for shortcuts and existing integrations.
 if(!fields.children.length)url.id='useful-link-url';urlLabel.append(url);
 const toggleLabel=el('label','useful-hyperlink-toggle'),toggle=el('input');toggle.type='checkbox';toggle.checked=!!entry.label;toggleLabel.append(toggle,el('span','','Usar texto personalizado (hyperlink)'));
 const captionLabel=el('label','field','Texto do link'),caption=el('input','useful-url-caption');caption.maxLength=200;caption.placeholder='Abrir referência';caption.value=entry.label||'';caption.required=toggle.checked;captionLabel.hidden=!toggle.checked;caption.disabled=!toggle.checked;captionLabel.append(caption);
 toggle.addEventListener('change',()=>{captionLabel.hidden=!toggle.checked;caption.disabled=!toggle.checked;caption.required=toggle.checked;if(toggle.checked)caption.focus();});
 url.addEventListener('input',()=>url.setCustomValidity(''));
 const remove=el('button','small-btn useful-remove-url','Remover link');remove.type='button';remove.addEventListener('click',()=>{row.remove();updateUsefulUrlFields();});
 row.append(urlLabel,toggleLabel,captionLabel,remove);fields.append(row);updateUsefulUrlFields();return row;
}
function updateUsefulUrlFields(){
 const rows=Array.from($('useful-link-fields').children);rows.forEach((row,index)=>{row.querySelector('.useful-remove-url').disabled=rows.length===1;const input=row.querySelector('.useful-url-input');if(index===0)input.id='useful-link-url';else input.removeAttribute('id');});
}
function openUsefulEditor(link){
 editingUsefulId=link?.id||null;$('useful-link-label').value=link?.label||'';$('useful-link-fields').replaceChildren();
 (link?usefulEntries(link):[{}]).forEach(entry=>addUsefulUrlField(entry));
 $('useful-link-form').hidden=false;setToolPanel('links');$('useful-link-label').focus();
}
function renderUsefulLinks(){
 const list=$('useful-links-list');list.replaceChildren();
 if(!state.usefulLinks.length)list.append(el('p','sticky-empty','Guarde seus links de uso diário no +.'));
 state.usefulLinks.forEach(link=>{
  const card=el('article','useful-link'),heading=el('div','useful-link-heading'),label=el('strong','',link.label),edit=el('button','useful-icon');
  edit.title='Editar links';edit.setAttribute('aria-label','Editar '+link.label);edit.append(usefulIcon('edit'));edit.addEventListener('click',()=>openUsefulEditor(state.usefulLinks.find(item=>item.id===link.id)||link));
  const del=el('button','useful-icon delete','×');del.title='Excluir item';del.setAttribute('aria-label','Excluir '+link.label);del.addEventListener('click',()=>{if(!confirm('Excluir “'+link.label+'”?'))return;state.usefulLinks=state.usefulLinks.filter(x=>x.id!==link.id);if(editingUsefulId===link.id)$('useful-link-form').hidden=true;save();renderUsefulLinks();});
  heading.append(label,edit,del);card.append(heading);
  usefulEntries(link).forEach(entry=>{
   const row=el('div','useful-link-row'),a=el('a','',entry.label||entry.url);a.href=entry.url;a.target='_blank';a.rel='noopener noreferrer';a.title=entry.url;
   const button=el('button','useful-icon copy');button.title='Copiar link';button.setAttribute('aria-label','Copiar '+(entry.label||'link de '+link.label));button.append(usefulIcon('copy'));button.addEventListener('click',()=>copyUsefulLink(entry.url));row.append(a,button);card.append(row);
  });list.append(card);
 });
}
let editingDailyId=null;
function dailyDayChecks(container,selected,onChange){
 container.replaceChildren();CFF_TASKS_DAILY.days.forEach((name,day)=>{
  const label=el('label','daily-day'),input=el('input');input.type='checkbox';input.value=day;input.checked=selected.includes(day);input.setAttribute('aria-label',name);label.dataset.weekday=day;
  const caption=el('span','',name);label.append(caption,input);if(onChange)input.addEventListener('change',()=>onChange(day,input));container.append(label);
 });
}
function openDailyEditor(post){
 editingDailyId=post?.id||null;$('daily-post-title').value=post?.title||'';$('daily-post-time').value=post?.time||'';$('daily-form-error').textContent='';
 dailyDayChecks($('daily-form-days'),post?.days||[0,1,2,3,4,5,6]);$('daily-post-form').hidden=false;setToolPanel('daily');$('daily-post-title').focus();
}
function updateDailyStatuses(at=Date.now()){
 const statuses=state.dailyPosts.map(post=>({post,status:CFF_TASKS_DAILY.status(post,at)}));
 const pending=statuses.filter(x=>x.status.scheduled&&!x.status.done).length,badge=$('daily-pending-count');badge.textContent=pending;badge.hidden=!pending;
 $('toggle-daily').title=pending?'Posts diários · '+pending+' pendente'+(pending===1?'':'s')+' hoje':'Posts diários';
 document.querySelectorAll('[data-daily-post]').forEach(card=>{
  const item=statuses.find(x=>x.post.id===card.dataset.dailyPost);if(!item)return;const {post,status}=item;
  card.dataset.level=status.level;card.querySelector('.daily-status').textContent=status.label;
  const check=card.querySelector('[data-daily-complete]');check.checked=status.done;check.disabled=!status.scheduled;
  check.setAttribute('aria-label',(status.done?'Reabrir hoje: ':'Concluir hoje: ')+post.title);check.closest('label').title=status.scheduled?(status.done?'Reabrir o post de hoje':'Marcar o post de hoje como concluído'):'Disponível nos dias selecionados';
  card.querySelectorAll('.daily-day').forEach(label=>label.classList.toggle('is-today',+label.dataset.weekday===CFF_TASKS_DAILY.weekday(status.date)));
 });
}
function renderDailyPosts(){
 const list=$('daily-posts-list');list.replaceChildren();
 if(!state.dailyPosts.length)list.append(el('p','sticky-empty','Adicione seus posts recorrentes no +.'));
 state.dailyPosts.forEach(post=>{
  const card=el('article','daily-post');card.dataset.dailyPost=post.id;
  const head=el('div','daily-post-heading'),title=el('strong','daily-post-title',post.title);head.append(title);
  if(post.time)head.append(el('span','daily-time',post.time));
  const complete=el('label','complete-label daily-complete'),check=el('input','complete-input');check.type='checkbox';check.dataset.dailyComplete=post.id;
  const circle=el('span','complete-circle','✓');circle.setAttribute('aria-hidden','true');complete.append(check,circle);head.append(complete);
  check.addEventListener('change',()=>{
   const current=state.dailyPosts.find(x=>x.id===post.id);if(!current)return;
   const status=CFF_TASKS_DAILY.status(current);if(!status.scheduled){updateDailyStatuses();return;}
   current.completedDates[status.date]=check.checked;save();updateDailyStatuses();toast(check.checked?'Post de hoje concluído':'Post de hoje reaberto');
  });
  const week=el('div','daily-week');dailyDayChecks(week,post.days,(day,input)=>{
   const current=state.dailyPosts.find(x=>x.id===post.id);if(!current)return;
   const days=input.checked?[...new Set([...current.days,day])]:current.days.filter(x=>x!==day);
   if(!days.length){input.checked=true;toast('Selecione pelo menos um dia da semana');return;}
   current.days=days.sort();save();updateDailyStatuses();
  });
  const foot=el('div','daily-post-footer'),status=el('span','daily-status'),edit=el('button','useful-icon');edit.title='Editar post';edit.setAttribute('aria-label','Editar '+post.title);edit.append(usefulIcon('edit'));edit.addEventListener('click',()=>openDailyEditor(state.dailyPosts.find(x=>x.id===post.id)));
  const del=el('button','useful-icon delete','×');del.title='Excluir post diário';del.setAttribute('aria-label','Excluir '+post.title);del.addEventListener('click',()=>{if(!confirm('Excluir o post recorrente “'+post.title+'”?'))return;state.dailyPosts=state.dailyPosts.filter(x=>x.id!==post.id);if(editingDailyId===post.id)$('daily-post-form').hidden=true;save();renderDailyPosts();});
  foot.append(status,edit,del);card.append(head,week,foot);list.append(card);
 });updateDailyStatuses();
}
function wireDailyPosts(){
 $('new-daily-post').addEventListener('click',()=>openDailyEditor());$('cancel-daily-post').addEventListener('click',()=>$('daily-post-form').hidden=true);
 $('daily-form-days').addEventListener('change',()=>$('daily-form-error').textContent='');
 $('daily-post-form').addEventListener('submit',e=>{
  e.preventDefault();const title=$('daily-post-title').value.trim(),days=Array.from($('daily-form-days').querySelectorAll('input:checked'),x=>+x.value);
  if(!title){$('daily-post-title').focus();return;}if(!days.length){$('daily-form-error').textContent='Selecione pelo menos um dia da semana.';return;}
  const old=state.dailyPosts.find(x=>x.id===editingDailyId),post={id:editingDailyId||uid(),title,days,time:$('daily-post-time').value,completedDates:copy(old?.completedDates||{})};
  const index=state.dailyPosts.findIndex(x=>x.id===post.id);if(index<0)state.dailyPosts.push(post);else state.dailyPosts[index]=post;
  save();renderDailyPosts();$('daily-post-form').hidden=true;editingDailyId=null;toast('Post recorrente salvo');
 });
}
let serviceDraft=null,serviceForTask=false;
function setSettingsTab(name){
 const active=name==='services'?'services':'tasks';
 document.querySelectorAll('[data-settings-tab]').forEach(button=>{const selected=button.dataset.settingsTab===active;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
 $('settings-tasks-panel').hidden=active!=='tasks';$('settings-services-panel').hidden=active!=='services';
}
function updateSavedServicePreview(){
 const image=$('saved-service-preview'),glyph=$('saved-service-glyph');
 if(serviceDraft?.image){image.src=serviceDraft.image;image.hidden=false;glyph.hidden=true;}else{image.removeAttribute('src');image.hidden=true;glyph.hidden=false;glyph.textContent=serviceDraft?.icon||'◇';}
 $('remove-saved-service-image').hidden=!serviceDraft?.image;
}
function openServiceEditor(service,forTask=false){
 serviceDraft=service?copy(service):{id:'service-'+uid(),name:'',icon:'◇',image:''};serviceForTask=forTask;
 $('saved-service-form-title').textContent=service?'Editar serviço':'Novo serviço';$('saved-service-name').value=serviceDraft.name;$('saved-service-error').textContent='';$('saved-service-file').value='';$('save-saved-service').disabled=false;
 updateSavedServicePreview();$('saved-service-form').hidden=false;setSettingsTab('services');$('saved-service-name').focus();
}
function renderServices(){
 const list=$('saved-services-list');list.replaceChildren();if(!state.services.length)list.append(el('p','hint','Nenhum serviço salvo. Cadastre no botão acima.'));
 state.services.forEach(service=>{
  const row=el('article','saved-service-row'),icon=el('span','saved-service-icon');if(service.image){const image=el('img');image.src=service.image;image.alt='';icon.append(image);}else icon.textContent=service.icon;
  const name=el('strong','',service.name),edit=el('button','small-btn','Editar');edit.setAttribute('aria-label','Editar serviço '+service.name);edit.addEventListener('click',()=>openServiceEditor(serviceById(service.id)));
  const del=el('button','useful-icon delete','×');del.title='Excluir serviço';del.setAttribute('aria-label','Excluir serviço '+service.name);del.addEventListener('click',()=>{
   const current=serviceById(service.id);if(!current||!confirm('Excluir o serviço “'+current.name+'” das opções? As tarefas serão mantidas.'))return;
   state.tasks.filter(task=>task.service===service.id).forEach(task=>{if(!task.serviceIcon&&current.image)task.serviceIcon=current.image;task.service='';history(task,'Serviço removido: '+current.name);});
   state.services=state.services.filter(item=>item.id!==service.id);if(serviceDraft?.id===service.id){serviceDraft=null;$('saved-service-form').hidden=true;}
   if(draft?.service===service.id){if(!draft.serviceIcon&&current.image)draft.serviceIcon=current.image;draft.service='';}save();renderServices();renderBoard();if(draft){fillServiceSelect(draft.service);renderServiceIconPicker();}
  });row.append(icon,name,edit,del);list.append(row);
 });
}
function wireServices(){
 document.querySelectorAll('[data-settings-tab]').forEach(button=>{
  button.addEventListener('click',()=>setSettingsTab(button.dataset.settingsTab));
  button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const active=e.key==='Home'?'tasks':e.key==='End'?'services':button.dataset.settingsTab==='tasks'?'services':'tasks';setSettingsTab(active);$('settings-'+active+'-tab').focus();});
 });
 $('new-saved-service').addEventListener('click',()=>openServiceEditor());$('cancel-saved-service').addEventListener('click',()=>{serviceDraft=null;serviceForTask=false;$('saved-service-form').hidden=true;});
 $('columns-dialog').addEventListener('close',()=>{serviceDraft=null;serviceForTask=false;$('saved-service-form').hidden=true;});
 $('choose-saved-service-image').addEventListener('click',()=>$('saved-service-file').click());
 $('remove-saved-service-image').addEventListener('click',()=>{if(!serviceDraft)return;serviceDraft.image='';updateSavedServicePreview();});
 $('saved-service-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0],current=serviceDraft;if(!file||!current)return;
  if(!['image/png','image/jpeg','image/webp','image/avif'].includes(file.type)||file.size>300*1024){$('saved-service-error').textContent='Use PNG, JPG, WEBP ou AVIF de até 300 KB.';e.target.value='';return;}
  $('save-saved-service').disabled=true;
  try{const data=cleanServiceIcon(await readAsDataURL(file));if(serviceDraft!==current)return;current.image=data;$('saved-service-error').textContent='';updateSavedServicePreview();}catch(error){$('saved-service-error').textContent=error.message;}finally{$('save-saved-service').disabled=false;e.target.value='';}
 });
 $('saved-service-form').addEventListener('submit',e=>{
  e.preventDefault();if(!serviceDraft)return;const name=$('saved-service-name').value.trim();if(!name)return;
  if(state.services.some(item=>item.id!==serviceDraft.id&&item.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){$('saved-service-error').textContent='Já existe um serviço com esse nome.';return;}
  const service={...serviceDraft,name},index=state.services.findIndex(item=>item.id===service.id);if(index<0)state.services.push(service);else state.services[index]=service;
  const returnToTask=serviceForTask&&draft;serviceDraft=null;serviceForTask=false;$('saved-service-form').hidden=true;save();renderServices();renderBoard();
  if(draft){if(returnToTask)draft.service=service.id;fillServiceSelect(draft.service);renderServiceIconPicker();}
  if(returnToTask)$('columns-dialog').close();toast('Serviço salvo para reutilizar');
 });
}
function wireDeskTools(){
 ['reminders','links','daily'].forEach(kind=>$('toggle-'+kind).addEventListener('click',()=>{setToolPanel($('toggle-'+kind).getAttribute('aria-expanded')==='true'?null:kind);}));
 document.querySelectorAll('[data-close-tools]').forEach(button=>button.addEventListener('click',()=>setToolPanel(null)));
 $('new-useful-link').addEventListener('click',()=>openUsefulEditor());$('cancel-useful-link').addEventListener('click',()=>$('useful-link-form').hidden=true);
 $('add-useful-url').addEventListener('click',()=>{const row=addUsefulUrlField();row.querySelector('.useful-url-input').focus();});
 $('useful-link-form').addEventListener('submit',e=>{
  e.preventDefault();const links=[];
  for(const row of $('useful-link-fields').children){
   const input=row.querySelector('.useful-url-input'),caption=row.querySelector('.useful-url-caption');let url;
   try{url=cleanUrl(input.value);if(!url)throw Error('Adicione um endereço.');}catch(error){input.setCustomValidity(error.message);input.reportValidity();return;}
   links.push({id:row.dataset.linkId,url,label:caption.disabled?'':caption.value.trim()});
  }
  const label=$('useful-link-label').value.trim();if(!label||!links.length)return;
  const link={id:editingUsefulId||uid(),label,url:links[0].url,links},index=state.usefulLinks.findIndex(x=>x.id===link.id);if(index<0)state.usefulLinks.push(link);else state.usefulLinks[index]=link;
  save();renderUsefulLinks();$('useful-link-form').hidden=true;editingUsefulId=null;toast('Links salvos');
 });
 document.addEventListener('click',e=>{if(!e.target.closest('.desk-tools')&&!e.target.closest('.sticky-shell')&&!e.target.closest('.daily-post'))setToolPanel(null);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('editor').open&&!$('columns-dialog').open)setToolPanel(null);});
 $('sticky-list').addEventListener('focusout',()=>{setTimeout(()=>{if(!document.activeElement?.closest('.sticky-body'))renderNotes();},0);});
}
function optionChecks(target,defs,selected){const container=$(target);container.replaceChildren();defs.forEach(d=>{const label=el('label','option-chip'),input=el('input');input.type='checkbox';input.value=d.id;input.checked=selected.includes(d.id);input.addEventListener('change',()=>{const key=target==='task-platforms'?'platforms':'tags';draft[key]=Array.from(container.querySelectorAll('input:checked'),x=>x.value);});label.append(input,el('span','',d.name));container.append(label);});}
function renderColors(){const container=$('task-colors');container.replaceChildren();Object.entries(COLORS).forEach(([key,[name,value]])=>{const b=el('button','color-choice');b.type='button';b.style.setProperty('--swatch',value);b.title=name;b.dataset.color=key;b.setAttribute('aria-label','Cor '+name);b.setAttribute('aria-pressed',String(draft.color===key));b.addEventListener('click',()=>{draft.color=key;container.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});container.append(b);});}
function addDefinition(kind){const input=$(kind==='platforms'?'new-platform-name':'new-tag-name'),name=input.value.trim();if(!name){input.focus();return;}let item=state[kind].find(x=>x.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));if(!item){item={id:uid(),name};state[kind].push(item);save();refreshFilters();}if(!draft[kind].includes(item.id))draft[kind].push(item.id);optionChecks(kind==='platforms'?'task-platforms':'task-tags',state[kind],draft[kind]);input.value='';}
function renderLinks(){const list=$('task-links');list.replaceChildren();$('links-hint').hidden=draft.links.length>0;draft.links.forEach((link,index)=>{const box=el('div','link-row'),row=el('div','row'),url=el('input'),label=el('input'),image=el('input','link-image');url.value=link.url;url.placeholder='Endereço: site.com.br';url.maxLength=3000;url.setAttribute('aria-label','Endereço do link '+(index+1));label.value=link.label;label.placeholder='Nome: Imagem do site, briefing…';label.maxLength=200;label.setAttribute('aria-label','Nome do link '+(index+1));image.value=link.imageUrl;image.placeholder='URL da imagem de prévia (opcional)';image.maxLength=3000;image.setAttribute('aria-label','Imagem de prévia do link '+(index+1));url.addEventListener('input',()=>{link.url=url.value;url.setCustomValidity('');});label.addEventListener('input',()=>link.label=label.value);image.addEventListener('input',()=>{link.imageUrl=image.value;image.setCustomValidity('');});row.append(url,label);const remove=el('button','small-btn remove-link','Remover link');remove.type='button';remove.addEventListener('click',()=>{draft.links=draft.links.filter(x=>x.id!==link.id);renderLinks();});box.append(row,image,remove);list.append(box);});}
function renderSubtasks(){const list=$('task-subtasks');list.replaceChildren();$('subtasks-hint').hidden=draft.subtasks.length>0;draft.subtasks.forEach((s,index)=>{const row=el('div','subtask-row'),check=el('input'),input=el('input');check.type='checkbox';check.checked=s.done;check.setAttribute('aria-label','Concluir etapa '+(index+1));input.type='text';input.value=s.text;input.maxLength=300;input.placeholder='Ex.: Revisar legenda';input.setAttribute('aria-label','Texto da etapa '+(index+1));check.addEventListener('change',()=>s.done=check.checked);input.addEventListener('input',()=>s.text=input.value);const remove=el('button','remove-row','×');remove.type='button';remove.setAttribute('aria-label','Remover etapa '+(index+1));remove.addEventListener('click',()=>{draft.subtasks=draft.subtasks.filter(x=>x.id!==s.id);renderSubtasks();});row.append(check,input,remove);list.append(row);});}
function releasePreviews(){previewUrls.forEach(u=>URL.revokeObjectURL(u));previewUrls=[];}
function sizeLabel(size){return size<1024*1024?Math.max(1,Math.ceil(size/1024))+' KB':(size/1024/1024).toFixed(1)+' MB';}
function renderAttachments(){releasePreviews();const list=$('task-attachments');list.replaceChildren();$('attachments-hint').hidden=draft.attachments.length>0;draft.attachments.forEach(a=>{const box=el('article','attachment'),blob=draftFiles.get(a.id)||files.get(a.id);let url='';if(blob){url=URL.createObjectURL(blob);previewUrls.push(url);if(/^image\/(png|jpeg|webp|gif|avif|bmp)$/i.test(blob.type)){const img=el('img');img.src=url;img.alt=a.name;box.append(img);}}box.append(el('p','attachment-name',a.name),el('p','hint',sizeLabel(a.size)+(a.remote?' · Sincronizado':' · Envio pendente')));const actions=el('div','attachment-actions');if(url){const download=el('a','', 'Baixar');download.href=url;download.download=a.name;actions.append(download);}else if(a.remote){const download=el('button','small-btn','Baixar da nuvem');download.type='button';download.addEventListener('click',async()=>{download.disabled=true;try{const blob=await fetchTaskFile(a.id);const href=URL.createObjectURL(blob),link=el('a');link.href=href;link.download=a.name;link.click();setTimeout(()=>URL.revokeObjectURL(href),1500);if(draft?.attachments.some(x=>x.id===a.id))renderAttachments();}catch(error){toast(error.message);download.disabled=false;}});actions.append(download);}else actions.append(el('span','hint','Disponível no aparelho de origem')); const del=el('button','icon-btn delete','Remover');del.type='button';del.addEventListener('click',()=>{draft.attachments=draft.attachments.filter(x=>x.id!==a.id);draftFiles.delete(a.id);renderAttachments();});actions.append(del);box.append(actions);list.append(box);});}
function renderHistory(){const list=$('history-list');list.replaceChildren();if(!draft.history.length)list.append(el('li','', 'A tarefa ainda não tem histórico.'));[...draft.history].reverse().forEach(h=>{const item=el('li','',h.action),date=el('time','',stamp(h.at));date.dateTime=h.at;item.append(date);list.append(item);});$('task-history').open=false;}
function syncTaskDate(){const disabled=$('task-no-date').checked;$('task-date').disabled=disabled;$('task-time').disabled=disabled;}
function openEditor(status='todo',task=null){releasePreviews();draftFiles=new Map();const at=now();draft=task?copy(task):{id:uid(),title:'',note:'',date:today(),time:'',status,previousStatus:!['done','cancelled'].includes(status)?status:'todo',important:false,color:'none',service:'',serviceIcon:'',platforms:[],tags:[],links:[],subtasks:[],attachments:[],createdAt:at,updatedAt:at,completedAt:null,cancelledAt:null,history:[]};$('editor-title').textContent=task?'Editar tarefa':'Nova tarefa';$('task-title').value=draft.title;$('task-title').setCustomValidity('');$('task-note').value=draft.note;$('task-date').value=draft.date;$('task-time').value=draft.time;$('task-no-date').checked=!draft.date;syncTaskDate();$('task-important').checked=draft.important;fillSelect($('task-status'),state.columns,null,draft.status);fillServiceSelect(draft.service||'');renderServiceIconPicker();$('new-platform-name').value='';$('new-tag-name').value='';renderColors();optionChecks('task-platforms',state.platforms,draft.platforms);optionChecks('task-tags',state.tags,draft.tags);renderLinks();renderSubtasks();renderAttachments();renderHistory();planUI?.edit(draft);contentUI?.edit(draft);$('editor').showModal();$('editor').scrollTop=0;$('task-title').focus();}
function closeEditor(){if(draft&&!confirmIfChanged())return;$('editor').close();}
function discardEditor(){if(!$('editor').open)return;$('editor').close();toast('Alterações descartadas');}
function confirmIfChanged(){if(!draft)return true;const original=state.tasks.find(t=>t.id===draft.id);const fieldsChanged=$('task-title').value!==(original?.title||'')||$('task-note').value!==(original?.note||'')||($('task-no-date').checked?'':$('task-date').value)!==(original?original.date:today())||($('task-no-date').checked?'':$('task-time').value)!==(original?.time||'')||$('task-status').value!==(original?.status||draft.status)||$('task-service').value!==(original?.service||'')||$('task-important').checked!==(original?.important||false);const extraChanged=original?['links','subtasks','attachments','tags','platforms','color','serviceIcon','startDate','publishDate','publishTime','publishedUrl','projectId','companyId','assignee','approval','repeat','notify','copies'].some(k=>JSON.stringify(draft[k])!==JSON.stringify(original[k])):draft.links.length||draft.subtasks.length||draft.attachments.length||draft.tags.length||draft.platforms.length||draft.color!=='none'||!!draft.serviceIcon||!!draft.copies?.length;return !(fieldsChanged||extraChanged)||confirm('Descartar as alterações desta edição?');}
function renderColumns(){const list=$('columns-list');list.replaceChildren();state.columns.forEach((c,index)=>{const row=el('div','column-setting'),name=el('input');name.type='text';name.value=c.name;name.maxLength=40;name.setAttribute('aria-label','Nome da coluna '+c.name);name.addEventListener('change',()=>{const next=name.value.trim();if(!next){name.value=c.name;return;}c.name=next;save();refreshFilters();renderBoard();});const visibility=el('label'),check=el('input');check.type='checkbox';check.checked=!c.hidden;check.addEventListener('change',()=>{c.hidden=!check.checked;save();renderBoard();});visibility.append(check,el('span','', 'Mostrar'));const up=el('button','icon-btn move-col','↑'),down=el('button','icon-btn move-col','↓');up.disabled=index===0;down.disabled=index===state.columns.length-1;up.setAttribute('aria-label','Mover '+c.name+' para a esquerda');down.setAttribute('aria-label','Mover '+c.name+' para a direita');[up,down].forEach((b,i)=>b.addEventListener('click',()=>{const other=index+(i===0?-1:1);[state.columns[index],state.columns[other]]=[state.columns[other],state.columns[index]];save();renderColumns();refreshFilters();renderBoard();}));row.append(name,visibility,up,down);if(!BASE_COLUMNS.some(b=>b.id===c.id)){const del=el('button','icon-btn delete','Excluir');del.addEventListener('click',()=>{const count=state.tasks.filter(t=>t.status===c.id).length;if(!confirm(`Excluir a coluna “${c.name}”?${count?' As '+count+' tarefas serão movidas para '+columnName('todo')+'.':''}`))return;state.tasks.filter(t=>t.status===c.id).forEach(t=>{t.status='todo';history(t,'Coluna removida; movida para '+columnName('todo'));});state.tasks.forEach(t=>{if(t.previousStatus===c.id)t.previousStatus='todo';});state.columns=state.columns.filter(x=>x.id!==c.id);save();renderColumns();refreshFilters();renderBoard();});row.append(del);}else row.append(el('span','fixed-hint','Padrão'));list.append(row);});}
function openColumns(tab='tasks'){if(typeof tab!=='string')tab='tasks';renderColumns();renderServices();setSettingsTab(tab);$('warning-minutes').value=state.settings.warningMinutes;$('new-column-name').value='';if(!$('columns-dialog').open)$('columns-dialog').showModal();$('columns-dialog').scrollTop=0;}
function chooseFilter(value){filters.deadline=value;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===value)));renderBoard();}
function resetFilters(){Object.assign(filters,{text:'',deadline:'all',platform:'',tag:'',status:'',important:false});$('search').value='';$('filter-important').setAttribute('aria-pressed','false');$('filter-important').textContent='☆ Só importantes';refreshFilters();chooseFilter('all');}
function readAsDataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
async function exportBackup(){const button=$('export');button.disabled=true;button.textContent='Preparando backup…';try{const snapshot=copy(state),references=new Set(snapshot.tasks.flatMap(t=>t.attachments.map(a=>a.id))),stored=new Map(files),backupFiles=[];for(const id of references){const blob=stored.get(id);if(!blob){stored.set(id,await fetchTaskFile(id));}backupFiles.push({id,data:await readAsDataURL(stored.get(id))});}const content={...snapshot,files:backupFiles},blob=new Blob([JSON.stringify(content,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='meu-quadro-backup-'+today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Backup do quadro ativo exportado');}catch(e){alert('Não foi possível exportar o backup: '+e.message);}finally{button.disabled=false;button.textContent='Backup do quadro ativo';}}
function decodeBackupFile(file){const id=text(file.id,150,false),data=text(file.data,40*1024*1024,false),match=data.match(/^data:([^;,]*);base64,([A-Za-z0-9+/]*={0,2})$/);if(!match)throw Error('Anexo inválido');const binary=atob(match[2]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return {id,blob:new Blob([bytes],{type:match[1]})};}
async function importBackup(file){if(!file)return;const button=$('import');button.disabled=true;try{if(file.size>250*1024*1024)throw Error('O backup precisa ter até 250 MB.');const raw=JSON.parse(await file.text()),next=normalise(raw),nextFiles=new Map();if([2,3,4,5].includes(raw.version)){if(!Array.isArray(raw.files))throw Error('Lista de anexos ausente');for(const item of raw.files){const decoded=decodeBackupFile(item);if(nextFiles.has(decoded.id))throw Error('Anexo duplicado');nextFiles.set(decoded.id,decoded.blob);}}let totalBytes=0;for(const blob of nextFiles.values())totalBytes+=blob.size;if(totalBytes>150*1024*1024)throw Error('O total de anexos precisa ter até 150 MB.');next.tasks.forEach(t=>t.attachments.forEach(a=>{const blob=nextFiles.get(a.id);if(!blob||blob.size!==a.size||blob.type!==a.type)throw Error('Anexo ausente ou diferente do original');a.remote=false;}));if(!confirm(`Importar ${next.tasks.length} tarefas, ${next.notes.length} lembretes e ${nextFiles.size} anexos? Isso substitui todo o quadro atual. Exporte um backup antes se quiser guardar o atual.`))return;await saveQueue;const blocked=storageBlocked;storageBlocked=false;try{await transact(next,[...nextFiles].map(([id,blob])=>({id,blob})),true);}catch(e){storageBlocked=blocked;throw e;}state=next;syncDirty=true;checkpoint();files=nextFiles;failedFileChanges.clear();planUI?.changed();$('storage-notice').classList.remove('visible');scheduleCloud(state,0);$('save-status').textContent=window.CFF_TASKS_CLOUD?'Backup importado · sincronizando com a nuvem…':'Salvo neste navegador · Backup completo inclui os anexos.';applyTheme();refreshFilters();resetFilters();renderNotes();renderUsefulLinks();renderDailyPosts();projectsUI?.refresh();toast('Backup importado');}catch(e){alert('Não foi possível importar: '+e.message+'. Selecione um backup exportado por este quadro.');}finally{button.disabled=false;$('backup-file').value='';}}
async function fetchTaskFile(id){if(files.has(id))return files.get(id);if(db){try{const cached=await request(db.transaction('files','readonly').objectStore('files').get(id));if(cached?.blob){files.set(id,cached.blob);return cached.blob;}}catch{}}if(!window.CFF_TASKS_CLOUD)throw Error('Entre no painel para baixar este anexo.');const blob=await window.CFF_TASKS_CLOUD.downloadFile(id);files.set(id,blob);try{await transact(state,[{id,blob}]);}catch{toast('Anexo baixado. A cópia local não pôde ser salva neste navegador.');}return blob;}
function taskWorkspaceApi(){return {getState:()=>state,getDraft:()=>draft,getFiles:()=>files,uid,now,copy,toast,history,makeCard,sortTasks,matches,open:openEditor,save,render:renderBoard,normalise,
 create:task=>{const next=normalise({...copy(state),tasks:[...state.tasks,task]});state=next;save();renderBoard();},
 update:(task,patch,label='Tarefa atualizada')=>{const t=state.tasks.find(x=>x.id===task.id);if(!t)return;const candidate={...t,...patch};if(patch.date&&patch.date!==t.date)candidate.repeat={...t.repeat,anchorDay:Number(patch.date.slice(8))};const metadata=window.CFF_TASKS_PLAN.extra(candidate,state);Object.assign(t,patch,metadata);history(t,label);save();renderBoard();},
 replace:next=>{state=normalise(next);return save();},
 sync:async()=>{await saveQueue;await flushCloud();if(syncDirty||!cloudReady)throw Error('Aguardando sincronização. Sua cópia foi preservada.');},
 synced:()=>cloudReady&&!syncDirty,revision:()=>cloudRevision,
 file:fetchTaskFile,cacheFile:async(id,blob)=>{files.set(id,blob);await transact(state,[{id,blob}]);},
 refreshFiles:()=>{if(draft&&$('editor').open)renderAttachments();},
 copyCaption:value=>contentUI.copyText(value),completeTask:setStatus};}
function wire(){
 projectsUI=window.CFF_TASKS_PROJECTS.mount({getState:()=>state,save,toast,linkedTasks:id=>state.tasks.filter(t=>t.companyId===id),openTask:t=>openEditor(t.status,t),newTask:(projectId,companyId)=>planUI?.newTask({projectId,companyId})});
 planUI=window.CFF_TASKS_WORKSPACE.mount(taskWorkspaceApi());
 contentUI=window.CFF_TASKS_CONTENT.mount(taskWorkspaceApi());
 wireDeskTools();wireDailyPosts();wireServices();document.addEventListener('change',e=>{if(e.target.matches('.status-picker'))styleStatusSelect(e.target);});
 const filterToggle=$('toggle-filters');
 if(filterToggle)filterToggle.addEventListener('click',()=>{
  const open=!document.body.classList.contains('show-mobile-filters');
  document.body.classList.toggle('show-mobile-filters',open);
  filterToggle.setAttribute('aria-expanded',String(open));
  filterToggle.textContent=open?'☷ Ocultar filtros':'☷ Exibir filtros';
 });
 $('new-card').addEventListener('click',()=>openEditor());$('theme-toggle').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';applyTheme();save();});$('manage-columns').addEventListener('click',openColumns);$('close-columns').addEventListener('click',()=>$('columns-dialog').close());$('done-columns').addEventListener('click',()=>$('columns-dialog').close());$('warning-minutes').addEventListener('change',()=>{state.settings.warningMinutes=Number($('warning-minutes').value);save();renderBoard();});
 $('add-custom-column').addEventListener('click',()=>{const name=$('new-column-name').value.trim();if(!name){$('new-column-name').focus();return;}if(state.columns.some(c=>c.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'))){toast('Já existe uma coluna com esse nome');return;}state.columns.push({id:'col-'+uid(),name,hidden:false});$('new-column-name').value='';save();renderColumns();refreshFilters();renderBoard();});$('new-column-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('add-custom-column').click();}});
 $('new-sticky').addEventListener('click',()=>{const n={id:uid(),title:'Novo lembrete',text:'',color:'yellow'};state.notes.push(n);openNoteId=n.id;editNoteId=n.id;save();renderNotes();$('sticky-list').lastElementChild.querySelector('input').focus();});$('discard-dialog').addEventListener('click',discardEditor);$('cancel').addEventListener('click',closeEditor);$('editor').addEventListener('cancel',e=>{if(!confirmIfChanged())e.preventDefault();});$('editor').addEventListener('close',()=>{releasePreviews();draft=null;draftFiles.clear();});$('task-title').addEventListener('input',()=>$('task-title').setCustomValidity(''));
 $('task-service').addEventListener('change',()=>{if(!draft)return;if($('task-service').value==='__custom__'){fillServiceSelect(draft.service);openColumns('services');openServiceEditor(null,true);return;}draft.service=$('task-service').value;renderServiceIconPicker();});
 $('choose-service-icon').addEventListener('click',()=>$('service-icon-file').click());
 $('remove-service-icon').addEventListener('click',()=>{if(!draft)return;draft.serviceIcon='';$('service-icon-file').value='';renderServiceIconPicker();});
 $('service-icon-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file||!draft)return;const allowed=new Set(['image/png','image/jpeg','image/webp','image/avif']);if(!allowed.has(file.type)){alert('Use uma imagem PNG, JPG, WEBP ou AVIF.');e.target.value='';return;}if(file.size>300*1024){alert('O ícone precisa ter no máximo 300 KB.');e.target.value='';return;}try{draft.serviceIcon=cleanServiceIcon(await readAsDataURL(file));renderServiceIconPicker();}catch(error){alert('Não foi possível usar este ícone: '+error.message);draft.serviceIcon='';renderServiceIconPicker();}e.target.value='';});
 $('add-platform').addEventListener('click',()=>addDefinition('platforms'));$('add-tag').addEventListener('click',()=>addDefinition('tags'));['new-platform-name','new-tag-name'].forEach((id,i)=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addDefinition(i===0?'platforms':'tags');}}));
 $('add-link').addEventListener('click',()=>{draft.links.push({id:uid(),url:'',label:'',imageUrl:''});renderLinks();$('task-links').lastElementChild.querySelector('input').focus();});$('add-subtask').addEventListener('click',()=>{draft.subtasks.push({id:uid(),text:'',done:false});renderSubtasks();$('task-subtasks').lastElementChild.querySelector('input[type=text]').focus();});
 $('add-attachment').addEventListener('click',()=>{if(!db){toast('Este navegador não permite salvar anexos.');return;}$('attachment-files').click();});$('attachment-files').addEventListener('change',e=>{const selected=[...e.target.files],max=25*1024*1024;if(selected.some(f=>f.size>max)){alert('Cada anexo pode ter até 25 MB.');e.target.value='';return;}const total=[...files.values(),...draftFiles.values(),...selected].reduce((sum,f)=>sum+f.size,0);if(total>150*1024*1024){alert('O quadro pode guardar até 150 MB de anexos.');e.target.value='';return;}selected.forEach(f=>{const id=uid();const type=f.type||'application/octet-stream',blob=f.slice(0,f.size,type);draftFiles.set(id,blob);draft.attachments.push({id,name:f.name,type,size:f.size});});renderAttachments();e.target.value='';});
 $('task-no-date').addEventListener('change',syncTaskDate);
 $('task-form').addEventListener('submit',e=>{e.preventDefault();if(!draft)return;try{planUI?.readDraft();contentUI?.readDraft();}catch(error){toast(error.message);return;}const title=$('task-title').value.trim();if(!title){$('task-title').setCustomValidity('Digite o nome da tarefa.');$('task-title').reportValidity();return;}const links=[];for(let index=0;index<draft.links.length;index++){const link=draft.links[index];if(!link.url.trim()&&!link.label.trim()&&!link.imageUrl.trim())continue;try{if(!link.url.trim())throw Error('Preencha o endereço do link.');links.push({...link,url:cleanUrl(link.url),label:link.label.trim(),imageUrl:cleanUrl(link.imageUrl)});}catch(error){const input=$('task-links').children[index].querySelector('input');input.setCustomValidity(error.message);input.reportValidity();return;}}
  const old=state.tasks.find(t=>t.id===draft.id),status=$('task-status').value,at=now(),task={...copy(draft),title,note:$('task-note').value.trim(),date:$('task-no-date').checked?'':$('task-date').value||($('task-time').value?today():''),time:$('task-no-date').checked?'':$('task-time').value,status,service:$('task-service').value,serviceIcon:cleanServiceIcon(draft.serviceIcon||''),important:$('task-important').checked,links,subtasks:draft.subtasks.filter(s=>s.text.trim()).map(s=>({...s,text:s.text.trim()}))};if(!old){task.completedAt=status==='done'?at:null;task.cancelledAt=status==='cancelled'?at:null;history(task,'Tarefa criada em '+columnName(status));}else{task.history=copy(old.history);task.createdAt=old.createdAt;task.boardOrder=old.boardOrder;if(old.status!==status){task.boardOrder=null;task.previousStatus=!['done','cancelled'].includes(old.status)?old.status:old.previousStatus;task.completedAt=status==='done'?at:null;task.cancelledAt=status==='cancelled'?at:null;history(task,`Coluna alterada: ${columnName(old.status)} → ${columnName(status)}`);}const changes=[];const names={title:'título',note:'detalhes',date:'data',time:'horário',service:'serviço',serviceIcon:'ícone do serviço',important:'importância',color:'cor',platforms:'plataformas',tags:'etiquetas',links:'links',subtasks:'subtarefas',attachments:'anexos',startDate:'início da entrega',publishDate:'data de publicação',publishTime:'horário de publicação',projectId:'projeto',companyId:'empresa',assignee:'responsável',approval:'aprovação',repeat:'repetição',publishedUrl:'link publicado',notify:'lembretes',copies:'copies'};Object.entries(names).forEach(([key,name])=>{if(JSON.stringify(old[key])!==JSON.stringify(task[key]))changes.push(name);});if(changes.length)history(task,'Atualizada: '+changes.join(', '));}
  const changes=[];draftFiles.forEach((blob,id)=>{files.set(id,blob);changes.push({id,blob});});if(old)state.tasks[state.tasks.indexOf(old)]=task;else state.tasks.push(task);planUI?.complete(task,old?.status);changes.push(...pruneFiles());save(changes);renderBoard();$('editor').close();toast(old?'Tarefa atualizada':'Tarefa adicionada');
 });
 $('search').addEventListener('input',()=>{filters.text=$('search').value.trim().toLocaleLowerCase('pt-BR');renderBoard();});document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>chooseFilter(b.dataset.filter)));document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.settings.view=b.dataset.view;save();renderBoard();}));['platform','tag','status'].forEach(key=>$('filter-'+key).addEventListener('change',()=>{filters[key]=$('filter-'+key).value;renderBoard();}));$('filter-important').addEventListener('click',()=>{filters.important=!filters.important;$('filter-important').setAttribute('aria-pressed',String(filters.important));$('filter-important').textContent=filters.important?'★ Só importantes':'☆ Só importantes';renderBoard();});$('sort').addEventListener('change',()=>{state.settings.sort=$('sort').value;save();renderBoard();});$('reset-filters').addEventListener('click',resetFilters);
 $('show-urgent').addEventListener('click',()=>{resetFilters();state.columns.forEach(c=>{if(state.tasks.some(t=>t.status===c.id&&['urgent','soon'].includes(remaining(t).level)))c.hidden=false;});save();chooseFilter('soon');});$('export').addEventListener('click',exportBackup);$('import').addEventListener('click',()=>$('backup-file').click());$('backup-file').addEventListener('change',e=>importBackup(e.target.files[0]));
 document.addEventListener('click',e=>{if(openNoteId&&!e.target.closest('.reminders')&&!e.target.closest('.sticky-shell')){openNoteId=null;editNoteId=null;renderNotes();}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openNoteId&&!$('editor').open&&!$('columns-dialog').open){openNoteId=null;editNoteId=null;renderNotes();}});window.addEventListener('resize',()=>document.querySelectorAll('.sticky-body textarea').forEach(autoNoteHeight));setInterval(()=>{if(booted&&!dragId)tick();},15000);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushCloud().catch(()=>{});else if(booted){tick();initCloudSync(true);}});window.addEventListener('online',()=>{clearTimeout(cloudRetry);cloudRetry=null;initCloudSync(true);});$('sync-now').addEventListener('click',()=>{saveQueue.then(()=>initCloudSync(true));});window.addEventListener('pagehide',()=>{flushCloud().catch(()=>{});});
}
async function boot(){
 let raw=null;try{db=await openDatabase();raw=await request(db.transaction('state','readonly').objectStore('state').get('board'));}catch(e){db=null;}
 try{if(!raw){const local=localStorage.getItem(KEY);if(local)raw=JSON.parse(local);}if(raw)state=normalise(raw);}catch(e){storageBlocked=true;notice('Não foi possível carregar os dados anteriores. Eles não serão sobrescritos. Você pode exportar este quadro ou importar um backup.');}
 try{const saved=JSON.parse(localStorage.getItem(SYNC_KEY)||'null');if(saved){syncBase=saved.base?normalise(saved.base):null;syncDirty=!!saved.dirty;if(syncDirty&&saved.local)state=normalise(saved.local);}}catch{}
 if(!storageBlocked)await initCloudSync(false);
 if(db){try{const ids=[...new Set(state.tasks.flatMap(t=>t.attachments.map(a=>a.id)))],store=db.transaction('files','readonly').objectStore('files'),stored=await Promise.all(ids.map(id=>request(store.get(id))));stored.filter(Boolean).forEach(f=>files.set(f.id,f.blob));}catch{}}
 if(state.tasks.some(t=>t.attachments.some(a=>!a.remote&&!files.has(a.id))))cloudStatus('Alguns anexos precisam ser sincronizados pelo aparelho onde foram adicionados.');
 if(!storageBlocked&&window.CFF_TASKS_PROJECTS.seed(state))save();
 wire();applyTheme();refreshFilters();renderNotes();renderUsefulLinks();renderDailyPosts();renderBoard();booted=true;planUI?.boot();
 if(!db&&!storageBlocked)notice('Anexos locais indisponíveis neste navegador. Tarefas e lembretes continuam sincronizados pela nuvem.');
 if(window.CFF_TASKS_CLOUD&&cloudReady&&!$('storage-notice').classList.contains('visible'))cloudStatus('Sincronizado na nuvem · cópia local ativa.');
}
let cffTasksStarted=false;
function startAuthenticatedBoard(){if(cffTasksStarted||!window.CFF_TASKS_AUTHORIZED)return;cffTasksStarted=true;boot().catch(e=>notice('Não foi possível abrir o quadro: '+e.message));}
window.addEventListener('cff-tasks-authenticated',startAuthenticatedBoard);
startAuthenticatedBoard();



