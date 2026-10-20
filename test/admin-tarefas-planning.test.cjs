const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=require('node:path').resolve(__dirname,'..'),read=p=>fs.readFileSync(root+'/'+p,'utf8');
function model(){const context=vm.createContext({window:{},URL,Date,console});for(const file of ['daily','notifications','content','plan','sync'])vm.runInContext(read('js/admin-tarefas-'+file+'.js'),context);return {P:context.window.CFF_TASKS_PLAN,S:context.window.CFF_TASKS_SYNC,N:context.window.CFF_TASKS_NOTIFICATIONS};}
const task=(extra={})=>({id:'task-1',title:'Post da Central',note:'Detalhes',date:'2026-10-23',time:'15:00',status:'todo',previousStatus:'todo',important:false,color:'none',service:'',serviceIcon:'',platforms:[],tags:[],links:[],subtasks:[{id:'step',text:'Revisar',done:true}],attachments:[],history:[],createdAt:'2026-10-16T12:00:00Z',updatedAt:'2026-10-16T12:00:00Z',completedAt:null,cancelledAt:null,...extra});
test('inclusive delivery intervals, Brasília instants, separate publication and validation',()=>{const {P}=model(),t=task({startDate:'2026-10-16',publishDate:'2026-10-25'});assert(P.inWindow(t,'2026-10-16'));assert(P.inWindow(t,'2026-10-23'));assert(!P.inWindow(t,'2026-10-24'));assert.equal(P.instant('2026-10-16','09:00'),Date.parse('2026-10-16T12:00Z'));assert.throws(()=>P.extra({...t,startDate:'2026-10-24'}),/início/);assert.throws(()=>P.extra({...t,publishDate:'',publishTime:'12:00'}),/publicação/);assert.throws(()=>P.extra({...t,publishedUrl:'javascript:alert(1)'}));const shift=P.shiftTask(t,'2026-10-20','2026-10-16');assert.equal(shift.startDate,'2026-10-20');assert.equal(shift.date,'2026-10-27');assert.equal(t.publishDate,'2026-10-25');const day=P.myDay([t],'2026-10-20');assert.equal(day.today.length,1);assert.equal(day.late.length,0);assert.equal(P.myDay([t],'2026-10-24').late.length,1);});
test('recurrence retains month-end anchor, resets work, skips past dates and uses deterministic IDs',()=>{const {P}=model(),t=task({status:'done',date:'2028-01-31',startDate:'2028-01-29',publishDate:'2028-02-01',focusDate:'2028-01-31',publishedUrl:'https://example.test',repeat:{frequency:'monthly',interval:1,anchorDay:31,until:''},approval:{state:'approved',person:'Cliente',sentAt:'2028-01-01',note:'ok'}});const a=P.nextRepeat(t,'2028-02-01');assert.equal(a.date,'2028-02-29');assert.equal(a.startDate,'2028-02-27');assert.equal(a.publishDate,'2028-03-01');assert.equal(a.focusDate,'');assert.equal(a.publishedUrl,'');assert.equal(a.subtasks[0].done,false);assert.equal(a.approval.state,'pending');assert.equal(a.id,P.nextRepeat(t,'2028-02-01').id);const b=P.nextRepeat({...a,status:'done'},'2028-03-01');assert.equal(b.date,'2028-03-31');assert.equal(P.nextRepeat({...t,repeat:{...t.repeat,until:'2028-02-28'}},'2028-02-01'),null);assert.equal(P.nextRepeat({...t,repeat:{frequency:'weekly',interval:1}},'2028-04-01').date,'2028-04-03');});
test('notification schedules respect task settings and statuses; completed tasks cancel future notices',()=>{const {P}=model(),at=Date.parse('2026-10-15T00:00Z'),state={settings:{notifications:{enabled:true,defaultTime:'09:00',leadMinutes:60}},tasks:[task({startDate:'2026-10-16',publishDate:'2026-10-24',publishTime:'10:00'})]};let events=P.events(state,at);assert.equal(events.length,4);assert.equal(events.find(e=>e.kind==='start').at,Date.parse('2026-10-16T12:00Z'));assert.equal(events.find(e=>e.kind==='reminder').at,Date.parse('2026-10-23T17:00Z'));state.tasks[0].status='done';assert.equal(P.events(state,at).length,0);state.tasks[0].status='todo';state.tasks[0].notify=false;assert.equal(P.events(state,at).length,0);state.tasks[0].notify=true;state.settings.notifications.enabled=false;assert.equal(P.events(state,at).length,0);});
test('sync preserves edits made on another device during archive and merges templates',()=>{const {S}=model(),base={version:3,tasks:[task()],templates:[],settings:{}},local=structuredClone(base),remote=structuredClone(base);local.tasks=[];remote.tasks[0].title='Editada no outro aparelho';remote.templates=[{id:'custom',name:'Meu modelo'}];const merged=S.merge(base,local,remote);assert.equal(merged.tasks.length,1);assert.equal(merged.tasks[0].title,'Editada no outro aparelho');assert.equal(merged.templates.length,1);assert.equal(S.merge(base,local,base).tasks.length,0);});
async function board(seed,options={}){const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));const dom=new JSDOM(read('admin-tarefas.html'),{url:'https://centralfreefire.com.br/admin-tarefas.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;w.structuredClone=structuredClone;w.CSS={escape:s=>s};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};w.confirm=()=>true;w.alert=message=>{throw Error(message);};let snapshot=null,revision=Date.now();const calls=[];w.CFF_TASKS_CLOUD={clientId:'test',load:async()=>snapshot,save:async local=>{snapshot={stateJson:JSON.stringify(local),updatedAt:++revision};return snapshot;},subscribe:()=>()=>{},uploadFile:async()=>({ok:true}),downloadFile:async()=>new w.Blob(['test'],{type:'image/png'}),taskRequest:async body=>{calls.push(body);if(options.request)return options.request(body);if(body.operation==='archiveMonths')return {months:[]};if(body.operation==='notifications')return {items:[],pending:0};return {ok:true};}};if(options.layout!==undefined)w.localStorage.setItem('cff-tasks-card-layout-v1',JSON.stringify(options.layout));if(seed)w.localStorage.setItem('meu-quadro-v1',JSON.stringify(seed));w.CFF_TASKS_AUTHORIZED=true;for(const f of ['projects-seed','project-history','project-reports','projects','sync','daily','notifications','content','plan','workspace','missions','']){vm.runInContext(read('js/admin-tarefas'+(f?'-'+f:'')+'.js'),dom.getInternalVMContext());if(f==='missions'&&!options.ffcpSeed)w.CFF_TASKS_MISSIONS.seed=()=>false;}for(let i=0;i<100&&!w.document.querySelector('#task-models');i++)await new Promise(r=>setTimeout(r,5));assert(w.document.querySelector('#task-models'),'board booted');return {dom,w,errors,calls,state:()=>w.eval('state'),read:expression=>w.eval(expression)};}
function input(w,id,value){const e=w.document.getElementById(id);e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));return e;}
test('post scheduling is optional and separate from delivery deadline and planned publication',async()=>{
 const b=await board(),{w}=b,$=id=>w.document.getElementById(id);
 try{
  $('new-card').click();input(w,'task-title','Post do dia 23');
  input(w,'task-date','2026-10-27');
  input(w,'plan-publish','2026-10-24');
  input(w,'plan-scheduled-date','2026-10-23');
  input(w,'plan-scheduled-time','14:30');
  $('task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal($('editor').open,false);
  let t=b.state().tasks.find(t=>t.title==='Post do dia 23');
  assert.equal(t.date,'2026-10-27');
  assert.equal(t.publishDate,'2026-10-24');
  assert.equal(t.scheduledDate,'2026-10-23');
  assert.equal(t.scheduledTime,'14:30');
  assert(w.document.querySelector('.column .planning-chip-scheduled')?.textContent.includes('23/10'));
  assert(w.document.querySelector('.column .planning-chip-scheduled')?.textContent.includes('14:30'));
  const restored=b.read('normalise(JSON.parse(JSON.stringify(state)))');
  assert.equal(restored.tasks.find(row=>row.id===t.id).scheduledDate,'2026-10-23');
  assert.equal(restored.tasks.find(row=>row.id===t.id).date,'2026-10-27');
  assert.throws(()=>b.read("CFF_TASKS_PLAN.extra({...state.tasks[0],scheduledDate:'',scheduledTime:'14:30'},state)"),/agendamento/);
  assert.throws(()=>b.read("CFF_TASKS_PLAN.extra({...state.tasks[0],scheduledDate:'2026-02-31'},state)"),/Data inválida/);
  w.document.querySelector('.column .card-title').click();
  assert.equal($('plan-scheduled-date').value,'2026-10-23');
  assert.equal($('plan-scheduled-time').value,'14:30');
  input(w,'plan-scheduled-date','');input(w,'plan-scheduled-time','');
  $('task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  t=b.state().tasks.find(t=>t.title==='Post do dia 23');
  assert.equal(t.scheduledDate,'');
  assert.equal(t.scheduledTime,'');
  assert.equal(t.date,'2026-10-27');
  assert.equal(t.publishDate,'2026-10-24');
  assert.equal(w.document.querySelector('.column .planning-chip-scheduled'),null);
  assert(t.history.some(h=>h.action.includes('data do agendamento')));
  // Scheduling a repeated post must be reconfirmed for the next occurrence.
  const next=b.read("CFF_TASKS_PLAN.nextRepeat({...state.tasks[0],status:'done',scheduledDate:'2026-10-23',scheduledTime:'14:30',repeat:{frequency:'weekly',interval:1,anchorDay:27,until:''}},'2026-10-28')");
  assert.equal(next.scheduledDate,'');
  assert.equal(next.scheduledTime,'');
  assert.equal(next.publishDate,'2026-10-31');
  assert.equal(b.errors.length,0,b.errors.map(e=>e.message).join('\n'));
 }finally{w.close();}
});
test('real board: migrate legacy tasks, edit interval/publication/project/approval, choose priorities, templates and lazy archive',async()=>{const b=await board({version:1,tasks:[{id:'legacy',title:'Antiga',note:'Preservar',date:'2026-10-23',time:'',status:'todo'}]});const {w}=b,$=id=>w.document.getElementById(id);try{assert.equal(b.state().version,5);assert.equal(b.state().tasks[0].note,'Preservar');assert.equal(b.calls.filter(c=>c.operation==='archiveMonths').length,0);$('new-card').click();input(w,'task-title','Entrega com intervalo');input(w,'task-date','2026-10-23');$('plan-range').checked=true;$('plan-range').dispatchEvent(new w.Event('change'));input(w,'plan-start','2026-10-16');input(w,'plan-publish','2026-10-25');input(w,'plan-publish-time','10:00');input(w,'plan-assignee','Matheus');$('plan-project').value=b.state().projects[0].id;$('plan-project').dispatchEvent(new w.Event('change'));$('plan-company').value=b.state().projectCompanies[0].id;$('plan-company').dispatchEvent(new w.Event('change'));$('plan-send-approval').click();$('task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert(!$('editor').open);const t=b.state().tasks.find(t=>t.title==='Entrega com intervalo');assert.equal(t.startDate,'2026-10-16');assert.equal(t.publishDate,'2026-10-25');assert.equal(t.assignee,'Matheus');assert.equal(t.approval.state,'pending');assert(t.approval.sentAt);assert(t.companyId);const focus=[...w.document.querySelectorAll('.card')].find(c=>c.textContent.includes(t.title)).querySelector('.planning-chips button');focus.click();assert.equal(b.state().tasks.find(x=>x.id===t.id).focusDate,w.CFF_TASKS_PLAN.today());w.document.querySelector('[data-view=day]').click();assert(!$('planning-view').hidden);assert($('board').hidden);assert($('planning-view').textContent.includes('Minhas prioridades'));w.document.querySelector('[data-view=calendar]').click();assert.equal(w.document.querySelectorAll('.calendar-cell').length,42);assert(w.document.querySelectorAll('.calendar-event').length>0);$('task-models').click();const models=w.document.querySelector('.planning-dialog');assert.equal(models.querySelectorAll('.template-row').length,4);models.querySelector('.template-row button').click();assert($('editor').open);assert(b.read('draft.subtasks.length')>0);$('cancel').click();w.document.querySelector('[data-view=archive]').click();await new Promise(r=>setTimeout(r,20));assert.equal(b.calls.filter(c=>c.operation==='archiveMonths').length,1);b.read('renderBoard()');assert.equal(b.calls.filter(c=>c.operation==='archiveMonths').length,1);assert.equal(b.errors.length,0,b.errors.map(e=>e.message).join('\n'));}finally{b.dom.window.close();}});
test('invalid range keeps editor open and existing task unchanged; recurrence created once on completion',async()=>{const b=await board(),{w}=b,$=id=>w.document.getElementById(id);try{$('new-card').click();input(w,'task-title','Repetida');input(w,'task-date','2026-10-23');$('plan-range').checked=true;input(w,'plan-start','2026-10-24');$('task-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert($('editor').open);assert.equal(b.state().tasks.length,0);input(w,'plan-start','2026-10-16');$('plan-repeat').value='weekly';$('task-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(b.state().tasks.length,1);b.read("setStatus(state.tasks[0],'done')");assert.equal(b.state().tasks.length,2);const id=b.state().tasks[1].id;b.read("setStatus(state.tasks[0],'todo');setStatus(state.tasks[0],'done')");assert.equal(b.state().tasks.length,2);assert.equal(b.state().tasks[1].id,id);assert.equal(b.errors.length,0,b.errors.map(e=>e.message).join('\n'));}finally{w.close();}});
test('editor models, notifications preferences and company tasks remain linked through saves',async()=>{const b=await board(),{w}=b,$=id=>w.document.getElementById(id);try{$('new-card').click();input(w,'task-title','Modelo personalizado');input(w,'task-note','Não perder briefing');$('plan-save-template').click();let d=w.document.querySelector('.planning-dialog');assert(d);d.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(b.state().templates.length,1);assert.equal(b.state().templates[0].task.note,'Não perder briefing');$('cancel').click();$('task-models').click();d=w.document.querySelector('.planning-dialog');const custom=[...d.querySelectorAll('.template-row')].find(e=>e.textContent.includes('Modelo personalizado'));assert(custom);custom.querySelector('button').click();$('task-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(b.state().tasks.length,1);$('task-notifications').click();d=w.document.querySelector('.planning-dialog');const form=d.querySelector('form');form.elements.enabled.checked=true;form.querySelector('[name=leadTimes][value="60"]').checked=false;form.querySelector('[name=leadTimes][value="1440"]').checked=true;form.elements.time.value='08:30';form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,30));assert.equal(b.state().settings.notifications.leadMinutes,1440);assert.equal(b.state().settings.notifications.defaultTime,'08:30');assert(b.calls.some(c=>c.operation==='schedule'&&c.enabled===true));d.close();w.document.querySelector('[data-workspace-view=projects]').click();assert(w.document.querySelector('.project-linked-tasks'));w.document.querySelector('.project-linked-tasks button').click();assert($('editor').open);assert(b.read('draft.companyId'));assert(b.read('draft.projectId'));input(w,'task-title','Entrega da empresa');$('task-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert(w.document.querySelector('.project-linked-tasks').textContent.includes('Entrega da empresa'));assert.equal(b.errors.length,0,b.errors.map(e=>e.message).join('\n'));}finally{w.close();}});
test('archive failure preserves active task; restore confirms cloud before deleting the archive',async()=>{let archived=null,failArchive=true,removals=0;const b=await board({version:1,tasks:[{id:'old',title:'Pronta',note:'Histórico intacto',date:'2026-09-01',time:'',status:'done'}]},{request:async body=>{if(body.operation==='archiveMonths')return {months:archived?[{month:'2026-10',count:1}]:[]};if(body.operation==='archiveList')return {items:archived?[{id:'old',title:'Pronta',status:'done',closed_at:'2026-10-01',revision:'revision-1'}]:[],next:''};if(body.operation==='archive'){if(failArchive)throw Error('Falha simulada');archived=body.items[0];return {ok:true};}if(body.operation==='archiveGet')return {item:archived,revision:'revision-1'};if(body.operation==='archiveRemove'){assert(b.state().tasks.some(t=>t.id==='old'),'restored active before removal');assert(b.read('!syncDirty'),'cloud confirmed before removal');removals++;archived=null;return {ok:true};}return {ok:true};}}),{w}=b;try{b.read("state.tasks[0].completedAt='2026-10-01T12:00Z';state.tasks[0].copies=[{id:'archive-copy',label:'Insta',text:'Legenda guardada'}]");w.document.querySelector('[data-view=archive]').click();await new Promise(r=>setTimeout(r,10));[...w.document.querySelectorAll('#planning-view button')].find(x=>x.textContent==='Arquivar encerradas').click();const d=w.document.querySelector('.planning-dialog');d.querySelector('input').value='2026-10-16';d.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,20));assert.equal(b.state().tasks.length,1);assert(d.textContent.includes('Falha simulada'));failArchive=false;d.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,40));assert.equal(b.state().tasks.length,0);assert(archived);assert.equal(archived.task.note,'Histórico intacto');assert.equal(archived.task.copies[0].text,'Legenda guardada');[...w.document.querySelectorAll('.archive-row button')].find(x=>x.textContent==='Ver').click();await new Promise(r=>setTimeout(r,10));const detail=w.document.querySelector('.planning-dialog');assert.equal(detail.querySelector('.archive-copies textarea').value,'Legenda guardada');assert(detail.querySelector('.archive-copies textarea').readOnly);detail.close();const restore=[...w.document.querySelectorAll('.archive-row button')].find(x=>x.textContent==='Restaurar');assert(restore);restore.click();await new Promise(r=>setTimeout(r,40));assert.equal(removals,1);assert.equal(b.state().tasks[0].title,'Pronta');assert.equal(b.state().tasks[0].copies[0].text,'Legenda guardada');assert(b.state().tasks[0].history.some(h=>h.action.includes('Restaurada do arquivo')));assert.equal(b.errors.length,0,b.errors.map(e=>e.message).join('\n'));}finally{w.close();}});
test('restoring a backup resends its local files before marking them synchronized',async()=>{const b=await board(),{w}=b;let uploads=0;try{b.read("db={transaction(){const tx={objectStore:()=>({put(){},clear(){},delete(){}})};queueMicrotask(()=>tx.oncomplete?.());return tx;}}");w.CFF_TASKS_CLOUD.uploadFile=async(id,name,blob)=>{uploads++;assert.equal(id,'backup-file');assert.equal(blob.size,4);return {ok:true};};const backup=structuredClone(b.state());backup.tasks=[task({attachments:[{id:'backup-file',name:'arte.png',type:'image/png',size:4,remote:true}]})];backup.files=[{id:'backup-file',data:'data:image/png;base64,dGVzdA=='}];await w.importBackup({size:1000,text:async()=>JSON.stringify(backup)});assert.equal(b.state().tasks[0].attachments[0].remote,false,'backup does not assume the remote file still exists');await new Promise(r=>setTimeout(r,1300));assert.equal(uploads,1);assert.equal(b.state().tasks[0].attachments[0].remote,true);assert.equal(b.errors.length,0,b.errors.map(e=>e.message).join('\n'));}finally{w.close();}});

test('calendar moves validate recurrence limits before mutating a task',async()=>{const b=await board(),{w}=b;try{b.read("state.tasks.push({..."+JSON.stringify(task({date:'2026-10-23',repeat:{frequency:'monthly',interval:1,until:'2026-11-01',anchorDay:23}}))+"})");assert.throws(()=>b.read("taskWorkspaceApi().update(state.tasks[0],{date:'2026-11-05'})"),/repetição/);assert.equal(b.state().tasks[0].date,'2026-10-23');b.read("taskWorkspaceApi().update(state.tasks[0],{date:'2026-10-25'})");assert.equal(b.state().tasks[0].repeat.anchorDay,25);assert.equal(b.state().tasks[0].date,'2026-10-25');}finally{w.close();}});
test('every notification type is independent and new types are opt-in on legacy preferences',()=>{
 const {P}=model(),prefs=P.settings({notifications:{enabled:true,leadMinutes:1440}}).notifications;assert.equal(prefs.overdue,false);assert.equal(prefs.approval,false);assert.equal(prefs.summary,false);assert.equal(prefs.leadTimes.length,1);assert.equal(prefs.leadTimes[0],1440);
 const t=task({startDate:'2026-10-16',date:'2026-10-23',publishDate:'2026-10-25',approval:{state:'pending',person:'Cliente',sentAt:'2026-10-16T12:00Z'}}),at=Date.parse('2026-10-15T00:00Z'),off={enabled:true,start:false,reminder:false,due:false,publication:false,overdue:false,approval:false,summary:false};
 for(const [key,kind] of [['start','start'],['reminder','reminder'],['due','due'],['publication','publication'],['overdue','overdue'],['approval','approval']]){const events=P.events({settings:{notifications:{...off,[key]:true,leadTimes:[60,1440]}},tasks:[t]},at);assert(events.length>0,key);assert(events.every(e=>e.kind===kind),key);}
 assert.equal(P.events({settings:{notifications:off},tasks:[t]},at).length,0);const two=P.events({settings:{notifications:{...off,reminder:true,leadTimes:[60,1440]}},tasks:[t]},at);assert.equal(two.length,2);assert.equal(two[1].at-two[0].at,23*3600000);
 const enabled={settings:{notifications:{...off,overdue:true,approval:true,summary:true}},tasks:[{...t,notify:false}]};assert.equal(P.events(enabled,at).length,0);
});
test('notification choices and independent times survive save, reopen and disabling all types',async()=>{
 const b=await board(),{w}=b,$=id=>w.document.getElementById(id);try{
  $('task-notifications').click();let d=w.document.querySelector('.planning-dialog'),f=d.querySelector('form');assert.equal(f.elements.summary.checked,false);assert.equal(f.elements.overdue.checked,false);assert.equal(f.elements.approval.checked,false);f.elements.enabled.checked=true;
  for(const k of ['start','reminder','due','publication','overdue','approval','summary'])f.elements[k].checked=true;
  f.querySelector('[name=leadTimes][value="1440"]').checked=true;f.elements.summaryTime.value='08:45';f.elements.time.value='10:00';f.elements.approvalDays.value='3';f.dispatchEvent(new w.Event('change',{bubbles:true}));f.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,30));
  let p=b.state().settings.notifications;assert(p.overdue&&p.summary&&p.approval);assert.equal(p.summaryTime,'08:45');assert.equal(p.defaultTime,'10:00');assert.equal(p.approvalDays,3);assert.equal(p.leadTimes.join(','),'60,1440');const call=b.calls.filter(c=>c.operation==='schedule').at(-1);assert.equal(call.digest.enabled,true);assert.equal(call.digest.time,'08:45');d.close();
  $('task-notifications').click();d=w.document.querySelector('.planning-dialog');f=d.querySelector('form');assert(f.elements.overdue.checked);assert.equal(f.elements.summaryTime.value,'08:45');for(const k of ['start','reminder','due','publication','overdue','approval','summary'])f.elements[k].checked=false;f.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,30));p=b.state().settings.notifications;assert(['start','reminder','due','publication','overdue','approval','summary'].every(k=>p[k]===false));const stopped=b.calls.filter(c=>c.operation==='schedule').at(-1);assert.equal(stopped.events.length,0);assert.equal(stopped.digest.enabled,false);assert.equal(b.errors.length,0,b.errors.map(e=>e.message).join('\n'));
 }finally{w.close();}
});
test('approval follows a recorded send; publishing and approval stop their respective notices',()=>{
 const {P}=model(),t=task({publishDate:'2026-10-25',publishedUrl:'https://example.test/post',approval:{state:'pending',sentAt:''}}),base={settings:{notifications:{enabled:true,start:false,reminder:false,due:false,publication:true,approval:true}},tasks:[t]},at=Date.parse('2026-10-16T12:00Z');assert.equal(P.events(base,at).length,0);t.approval.sentAt='2026-10-10T12:00Z';const first=P.events(base,at)[0],next=P.events(base,at+60000)[0];assert.equal(first.id,next.id);assert(first.at>=at);t.approval.state='approved';assert.equal(P.events(base,at).length,0);
});
test('real cloud adapter upgrades old server payloads and preserves optional notification settings',async()=>{
 const dom=new JSDOM('<div id="cff-tasks-auth"></div>',{url:'https://centralfreefire.com.br/admin-tarefas.html',runScripts:'outside-only'}),w=dom.window;
 try{w.CFF_CONFIG={firebase:{}};w.initializeApp=()=>({});w.getApps=()=>[];w.getAuth=()=>({currentUser:{uid:'admin',email:'admin@centralfreefire.com.br'}});w.getDatabase=()=>({});w.ref=(_,path)=>path;w.onAuthStateChanged=()=>{};w.serverTimestamp=()=>Date.now();
  const base={version:4,settings:{notifications:{enabled:false}},tasks:[],templates:[]},local=structuredClone(base);local.settings.notifications={enabled:true,overdue:false,approval:true,summary:false,leadTimes:[60,1440]};local.tasks=[task({copies:[{id:'caption',label:'Insta',text:'Legenda na nuvem\n💚'}]})];
  w.runTransaction=async(_,callback)=>{const old={schemaVersion:3,stateJson:JSON.stringify({...base,version:3})};const value=callback(old);return {committed:true,snapshot:{val:()=>value}};};
  vm.runInContext(read('js/admin-tarefas-sync.js'),dom.getInternalVMContext());vm.runInContext(read('js/admin-tarefas-auth.js').replace(/^import[^\n]*\n/gm,''),dom.getInternalVMContext());assert(w.CFF_TASKS_CLOUD);
  const result=await w.CFF_TASKS_CLOUD.save(local,base),saved=JSON.parse(result.stateJson);assert.equal(result.schemaVersion,5);assert.equal(saved.version,5);assert.equal(saved.settings.notifications.approval,true);assert.equal(saved.settings.notifications.summary,false);assert.equal(saved.settings.notifications.overdue,false);assert.equal(saved.settings.notifications.leadTimes.join(','),'60,1440');assert.equal(saved.tasks[0].copies[0].text,'Legenda na nuvem\n💚');
 }finally{w.close();}
});
function setInput(w,element,value){element.value=value;element.dispatchEvent(new w.Event('input',{bubbles:true}));}
test('multiple named copies save verbatim and copy directly from a collapsed card',async()=>{
 const b=await board(),{w}=b,$=id=>w.document.getElementById(id),copied=[];Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>copied.push(value)},configurable:true});
 try{$('new-card').click();input(w,'task-title','Post com duas legendas');$('add-task-copy').click();let row=w.document.querySelector('.copy-editor-row');assert.equal(row.querySelector('.copy-label').value,'Insta');const insta='  A final chegou! 🔥\n\n#CentralFF 💚  ';setInput(w,row.querySelector('.copy-text'),insta);assert(row.querySelector('.copy-editor-footer').textContent.includes(Array.from(insta).length+' caracteres'));
  $('add-task-copy').click();row=w.document.querySelectorAll('.copy-editor-row')[1];setInput(w,row.querySelector('.copy-label'),'Stories');const stories='Ao vivo agora!\nLink na bio. <script>teste</script>';setInput(w,row.querySelector('.copy-text'),stories);$('task-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  const t=b.state().tasks[0];assert.equal(t.copies.length,2);assert.equal(t.copies[0].text,insta);assert.equal(t.copies[1].label,'Stories');const card=w.document.querySelector('.card');assert(card.classList.contains('card-collapsed'));assert(card.querySelector('.card-body').hidden);assert(!card.querySelector('.card-copies').hidden);card.querySelector('.card-copy-button').click();await new Promise(r=>setTimeout(r,5));assert.equal(copied[0],insta);
  const select=card.querySelector('.card-copy-select');select.value=t.copies[1].id;select.dispatchEvent(new w.Event('change'));card.querySelector('.card-copy-button').click();await new Promise(r=>setTimeout(r,5));assert.equal(copied[1],stories);assert.equal(w.document.querySelectorAll('.card script').length,0);
  input(w,'search','Link na bio');assert.equal(w.document.querySelectorAll('.card').length,1);input(w,'search','inexistente');assert.equal(w.document.querySelectorAll('.card').length,0);input(w,'search','');
  w.document.querySelector('.card-title').click();assert.equal(w.document.querySelectorAll('.copy-editor-row').length,2);assert.equal(w.document.querySelector('.copy-text').value,insta);setInput(w,w.document.querySelector('.copy-text'),'Alteração descartada');$('discard-dialog').click();assert.equal(b.state().tasks[0].copies[0].text,insta);
  w.document.querySelector('.card-title').click();w.document.querySelector('.copy-editor-row .danger-small').click();$('task-form').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(b.state().tasks[0].copies.length,1);assert.equal(b.state().tasks[0].copies[0].text,stories);assert(b.state().tasks[0].history.some(h=>h.action.includes('copies')));assert.equal(b.errors.length,0,b.errors.map(e=>e.message).join('\n'));
 }finally{w.close();}
});
test('collapse controls work per task and per column, persist locally and never change task data',async()=>{
 const seed={version:1,tasks:[{id:'one',title:'Primeira',note:'Detalhes A',date:'2026-10-23',time:'',status:'todo'},{id:'two',title:'Segunda',note:'Detalhes B',date:'2026-10-23',time:'',status:'todo'},{id:'doing',title:'Em andamento',note:'Outros',date:'2026-10-23',time:'',status:'doing'}]},b=await board(seed),{w}=b;let b2;
 try{await b.read('taskWorkspaceApi().sync()');const before=JSON.stringify(b.state()),todo=()=>w.document.querySelector('.column[data-status="todo"]');assert([...w.document.querySelectorAll('.card-body')].every(body=>body.hidden));todo().querySelector('.column-collapse').click();assert([...todo().querySelectorAll('.card-body')].every(body=>!body.hidden));assert(w.document.querySelector('.column[data-status="doing"] .card-body').hidden);
  todo().querySelector('.card-disclosure').click();assert(todo().querySelector('.card-body').hidden);assert.equal(todo().querySelectorAll('.card-body[hidden]').length,1);todo().querySelector('.column-collapse').click();assert.equal(todo().querySelectorAll('.card-body[hidden]').length,2);todo().querySelector('.card-disclosure').click();const card=todo().querySelector('.card'),id=card.dataset.taskId;assert.equal(card.querySelector('.card-disclosure').getAttribute('aria-expanded'),'true');const target=w.document.getElementById(card.querySelector('.card-disclosure').getAttribute('aria-controls'));assert.equal(target,card.querySelector('.card-body'));
  b.read('renderBoard()');assert(![...w.document.querySelectorAll('.card')].find(c=>c.dataset.taskId===id).querySelector('.card-body').hidden);assert.equal(JSON.stringify(b.state()),before);assert.equal(b.read('syncDirty'),false);const layout=JSON.parse(w.localStorage.getItem('cff-tasks-card-layout-v1'));b2=await board(structuredClone(b.state()),{layout});assert(![...b2.w.document.querySelectorAll('.card')].find(c=>c.dataset.taskId===id).querySelector('.card-body').hidden);assert(b2.w.document.querySelector('.column[data-status="doing"] .card-body').hidden);
 }finally{b2?.w.close();w.close();}
});
test('full column collapse hides the whole content, keeps card preferences and survives reload',async()=>{
 const seed={version:1,tasks:[
  {id:'one',title:'Primeira',note:'Detalhes A',date:'2026-10-23',time:'',status:'todo'},
  {id:'two',title:'Segunda',note:'Detalhes B',date:'2026-10-23',time:'',status:'todo'},
  {id:'doing',title:'Em andamento',note:'Outros',date:'2026-10-23',time:'',status:'doing'}
 ]};
 const b=await board(seed),{w}=b;let restored;
 const column=(win,status)=>win.document.querySelector('.column[data-status="'+status+'"]');
 try{
  await b.read('taskWorkspaceApi().sync()');
  const original=JSON.stringify(b.state()),todo=()=>column(w,'todo'),doing=()=>column(w,'doing');
  // Keep a per-card exception while collapsing only the enclosing column.
  todo().querySelector('.column-collapse').click();
  todo().querySelector('.card-disclosure').click();
  const expandedCardId=todo().querySelectorAll('.card')[1].dataset.taskId;
  const initialCardState=[...todo().querySelectorAll('.card-body')].map(body=>body.hidden);
  assert.equal(todo().querySelector('.column-full-toggle').getAttribute('aria-expanded'),'true');
  todo().querySelector('.column-full-toggle').click();
  assert(todo().classList.contains('column-fully-collapsed'));
  assert(todo().querySelector('.cards').hidden);
  assert(todo().querySelector('.add-column').hidden);
  assert.equal(todo().querySelector('.column-full-toggle').getAttribute('aria-expanded'),'false');
  assert.match(todo().querySelector('.column-full-toggle').getAttribute('aria-label'),/Expandir coluna/);
  assert.equal(todo().querySelector('.count').textContent,'2');
  assert(!doing().classList.contains('column-fully-collapsed'));
  assert(!doing().querySelector('.cards').hidden);
  assert.match(w.document.getElementById('board').style.getPropertyValue('--task-column-tracks'),/180px/);
  const foldedLayout=JSON.parse(w.localStorage.getItem('cff-tasks-card-layout-v1'));
  assert.equal(foldedLayout.foldedColumns.todo,true);
  assert.equal(JSON.stringify(b.state()),original);
  assert.equal(b.read('syncDirty'),false);
  restored=await board(structuredClone(b.state()),{layout:foldedLayout});
  const todoRestored=column(restored.w,'todo');
  assert(todoRestored.classList.contains('column-fully-collapsed'));
  assert(todoRestored.querySelector('.cards').hidden);
  todoRestored.querySelector('.column-full-toggle').click();
  const open=column(restored.w,'todo');
  assert(!open.classList.contains('column-fully-collapsed'));
  assert(!open.querySelector('.cards').hidden);
  assert(!open.querySelector('.add-column').hidden);
  assert.deepEqual([...open.querySelectorAll('.card-body')].map(body=>body.hidden),initialCardState);
  assert.equal(restored.w.localStorage.getItem('cff-tasks-card-layout-v1').includes('"todo":false'),true);
  assert.equal([...open.querySelectorAll('.card')].filter(card=>card.dataset.taskId===expandedCardId).length,1);
  // Empty columns must be foldable too.
  const empty=column(restored.w,'cancelled');
  empty.querySelector('.column-full-toggle').click();
  assert(column(restored.w,'cancelled').classList.contains('column-fully-collapsed'));
  assert.equal(restored.errors.length,0,restored.errors.map(e=>e.message).join('\n'));
  assert.equal(b.errors.length,0,b.errors.map(e=>e.message).join('\n'));
 }finally{restored?.w.close();w.close();}
});
test('copy synchronization preserves edits to different captions and concurrent edits during removal',()=>{
 const {S}=model(),a={id:'a',label:'Insta',text:'Original A'},c={id:'b',label:'Stories',text:'Original B'},base={version:5,tasks:[task({copies:[a,c]})],settings:{}},local=structuredClone(base),remote=structuredClone(base);local.tasks[0].copies[0].text='Texto no PC';remote.tasks[0].copies[1].text='Texto no celular';let merged=S.merge(base,local,remote);assert.equal(merged.tasks[0].copies[0].text,'Texto no PC');assert.equal(merged.tasks[0].copies[1].text,'Texto no celular');local.tasks[0].copies=[c];remote.tasks[0].copies[0].text='Edição remota importante';merged=S.merge(base,local,remote);assert(merged.tasks[0].copies.some(c=>c.text==='Edição remota importante'));const unchanged=structuredClone(base);merged=S.merge(base,local,unchanged);assert.equal(merged.tasks[0].copies.length,1);
});
test('copies validate duplicate IDs and limits without dropping text from old boards or backups',async()=>{
 const b=await board();try{const C=b.w.CFF_TASKS_CONTENT;assert.equal(C.copies(undefined).length,0);assert.throws(()=>C.copies([{id:'a',label:'Insta',text:'x'},{id:'a',label:'X',text:'y'}]),/inválida/);assert.throws(()=>C.copies([{id:'a',label:'Insta',text:'a'.repeat(10001)}]),/10.000/);const seed=structuredClone(b.state());seed.version=4;seed.tasks=[task({copies:[{id:'a',label:'Insta',text:'Texto salvo\n💚'}]})];b.w.testCopyBackup=seed;const normalized=b.read('normalise(testCopyBackup)');assert.equal(normalized.version,5);assert.equal(normalized.tasks[0].copies[0].text,'Texto salvo\n💚');}finally{b.w.close();}
});
test('clipboard fallback stays inside an open editor and reports failures accurately',async()=>{
 const b=await board(),{w}=b,$=id=>w.document.getElementById(id);try{$('new-card').click();$('add-task-copy').click();setInput(w,w.document.querySelector('.copy-text'),'Legenda com\nquebra de linha');let copied='';w.document.execCommand=()=>{const field=[...w.document.querySelectorAll('#editor textarea')].find(e=>e.getAttribute('aria-label')==='Copy para copiar');assert(field);copied=field.value;return true;};w.document.querySelector('.copy-editor-footer button').click();await new Promise(r=>setTimeout(r,5));assert.equal(copied,'Legenda com\nquebra de linha');assert.equal(w.document.querySelectorAll('[aria-label="Copy para copiar"]').length,0);w.document.execCommand=()=>false;w.document.querySelector('.copy-editor-footer button').click();await new Promise(r=>setTimeout(r,5));assert($('toast').textContent.includes('não permitiu copiar'));}finally{w.close();}
});

test('manual card order: arrows persist through reload, automatic sorts and an editor opened before a move',async()=>{
 const b=await board({version:1,tasks:[task({id:'a',title:'A',date:'2026-10-20',time:''}),task({id:'b',title:'B',date:'2026-10-21',time:''}),task({id:'c',title:'C',date:'2026-10-22',time:''})]});let restored;
 const ids=()=>[...b.w.document.querySelectorAll('.column[data-status="todo"] .card')].map(c=>c.dataset.taskId);
 try{
  assert.deepEqual(ids(),['a','b','c']);b.w.document.querySelector('[data-task-id="c"] .card-move-up').click();assert.deepEqual(ids(),['a','c','b']);assert.equal(b.state().settings.sort,'manual');assert.equal(b.w.document.getElementById('sort').value,'manual');assert.equal(b.state().tasks.find(t=>t.id==='c').status,'todo');
  b.read("openEditor('todo',state.tasks.find(t=>t.id==='c'))");b.read("moveCard('c','todo','a',false)");b.w.document.getElementById('task-form').dispatchEvent(new b.w.Event('submit',{bubbles:true,cancelable:true}));assert.deepEqual(ids(),['c','a','b']);
  const sort=b.w.document.getElementById('sort');sort.value='deadline';sort.dispatchEvent(new b.w.Event('change'));assert.deepEqual(ids(),['a','b','c']);sort.value='manual';sort.dispatchEvent(new b.w.Event('change'));assert.deepEqual(ids(),['c','a','b']);
  restored=await board(structuredClone(b.state()));assert.deepEqual([...restored.w.document.querySelectorAll('.column[data-status="todo"] .card')].map(c=>c.dataset.taskId),['c','a','b']);assert.equal(restored.w.document.querySelector('[data-task-id="c"] .card-move-up').disabled,true);assert.equal(restored.w.document.querySelector('[data-task-id="b"] .card-move-down').disabled,true);
  assert.equal(b.errors.length,0);
 }finally{b.w.close();restored?.w.close();}
});
test('drag and drop chooses an insertion point, preserves filtered cards and changes status only across columns',async()=>{
 const b=await board({version:1,tasks:[task({id:'a',title:'Mostrar A',date:'2026-10-20',time:''}),task({id:'hidden',title:'Oculta',date:'2026-10-21',time:''}),task({id:'c',title:'Mostrar C',date:'2026-10-22',time:''}),task({id:'d',title:'Destino',date:'2026-10-23',time:'',status:'doing'})]});const {w}=b;
 const order=status=>[...w.document.querySelectorAll('.column[data-status="'+status+'"] .card')].map(c=>c.dataset.taskId);
 function drag(id,status,y){const source=w.document.querySelector('[data-task-id="'+id+'"]'),dataTransfer={setData(){},effectAllowed:'',dropEffect:''};const start=new w.Event('dragstart',{bubbles:true,cancelable:true});Object.defineProperty(start,'dataTransfer',{value:dataTransfer});source.querySelector('.card-drag-grip').dispatchEvent(start);const col=w.document.querySelector('.column[data-status="'+status+'"]');[...col.querySelectorAll('.card')].forEach((c,i)=>{c.getBoundingClientRect=()=>({top:i*100,height:80});});for(const type of ['dragover','drop']){const e=new w.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{dataTransfer:{value:dataTransfer},clientY:{value:y}});col.dispatchEvent(e);if(type==='dragover')assert(col.classList.contains('over'));}source.dispatchEvent(new w.Event('dragend',{bubbles:true}));}
 try{
  drag('c','todo',0);assert.deepEqual(order('todo'),['c','a','hidden']);assert.equal(b.state().tasks.find(t=>t.id==='c').status,'todo');assert(!w.document.querySelector('.drop-before,.drop-after,.column.over'));
  input(w,'search','Mostrar');assert.deepEqual(order('todo'),['c','a']);w.document.querySelector('[data-task-id="c"] .card-move-down').click();assert.deepEqual(order('todo'),['a','c']);input(w,'search','');assert.deepEqual(order('todo'),['a','c','hidden']);
  drag('c','doing',500);assert.deepEqual(order('doing'),['d','c']);assert.equal(b.state().tasks.find(t=>t.id==='c').previousStatus,'todo');drag('c','done',0);assert.deepEqual(order('done'),['c']);assert(b.state().tasks.find(t=>t.id==='c').completedAt);assert.equal(b.state().tasks.length,4);
  const before=JSON.stringify(b.state());assert.equal(b.read("moveCard('c','done','c')"),false);assert.equal(JSON.stringify(b.state()),before);assert.equal(b.errors.length,0);
 }finally{w.close();}
});
test('reordering sync preserves remote content edits and validates optional positions in old backups',async()=>{
 const {S}=model(),base={version:5,tasks:[task({id:'a',boardOrder:0}),task({id:'b',boardOrder:1})],settings:{sort:'deadline'}},local=structuredClone(base),remote=structuredClone(base);local.tasks[0].boardOrder=1;local.tasks[1].boardOrder=0;local.settings.sort='manual';remote.tasks[0].note='Editada em outro aparelho';remote.tasks.push(task({id:'remote'}));const merged=S.merge(base,local,remote);assert.equal(merged.tasks[0].note,'Editada em outro aparelho');assert.equal(merged.tasks[1].boardOrder,0);assert.equal(merged.tasks.length,3);assert.equal(merged.settings.sort,'manual');
 const b=await board({version:1,tasks:[task()]});try{assert.equal(b.state().tasks[0].boardOrder,null);for(const value of [-1,Infinity,'1',10000]){const seed=structuredClone(b.state());seed.tasks[0].boardOrder=value;assert.equal(b.read('normalise('+JSON.stringify(seed)+').tasks[0].boardOrder'),null);}assert.equal(b.errors.length,0);}finally{b.w.close();}
});

test('Brave push-service failure is actionable rather than a raw registration error',()=>{
 const {N}=model();
 const explanation=N.explainPushError({name:'AbortError',message:'Registration failed - push service error'},true);
 assert.match(explanation,/brave:\/\/settings\/privacy/i);
 assert.match(explanation,/mensagens push/i);
 assert.doesNotMatch(explanation,/Registration failed/i);
 assert.match(N.explainPushError('NotAllowedError: permission denied'),/bloqueadas/i);
 assert.match(N.explainPushError(new Error('Conexão temporariamente indisponível')),/Conexão/);
});

test('push test checks browser subscription before calling the server',async()=>{
 const b=await board();const {w}=b;
 try{
  w.document.querySelector('#task-notifications').click();
  const modal=w.document.querySelector('.planning-dialog'),testButton=modal.querySelector('.test-push'),result=modal.querySelector('.notification-result');
  testButton.click();await new Promise(resolve=>setTimeout(resolve,30));
  assert.match(result.textContent,/inscrição push ativa/i);
  assert.equal(b.calls.filter(x=>x.operation==='testNotification').length,0);
  assert.equal(testButton.disabled,false);
  assert.equal(b.errors.length,0);
 }finally{w.close();}
});

test('FFCP bulk parser identifies mission metadata and disambiguates November 6',()=>{
 const context=vm.createContext({window:{},Date,console});
 vm.runInContext(read('js/admin-tarefas-missions.js'),context);
 const M=context.window.CFF_TASKS_MISSIONS;
 const input=[
  '1 - Finais da WB','    ● Período da missão: 05/10 a 11/10','    ● Códiguin da semana: ???','    ● Hashtag: #FFWSBR #WBSplit2','Instruções: Divulgar as finais com link para a transmissão.',
  '','2 - Dino Fogo','    ● Itens: Conjunto Dino Fogo e Conjunto Dino Chama','    ● Período da missão: 10/10 a 23/10','    ● Códiguin da semana: ??','    ● Hashtag: #DinoFF','Instruções: Divulgar as skins no Vira-Carta.',
  '','3 - Gateiro FF','    ● Itens: Conjunto Gateiro, Conjunto Gateira','    ● Período da missão: 17/10 a 30/10','    ● Códiguin da semana: ???','    ● Hashtag: #GatoFF','Instruções: Divulgar os itens do Desconto Maluco.',
  '','4 -Terror Noturno','    ● Itens: Conjunto Terror Noturno, Conjunto Criatura Macabra, Conjunto Aparição Noturna.',
  '    ● Período da missão: 24/10 a 11/06','    ● Códiguin da semana: ??','    ● Hashtag: #TerrorFF',
  'Instruções: Evento de 24 de outubro até o dia 6 de novembro.'
 ].join('\n');
 const rows=M.parse(input);
 assert.equal(rows.length,4);
 assert.deepEqual(Array.from(rows,x=>x.title),['Finais da WB','Dino Fogo','Gateiro FF','Terror Noturno']);
 assert.deepEqual(Array.from(rows,x=>x.date),['2026-10-11','2026-10-23','2026-10-30','2026-11-06']);
 assert.deepEqual(Array.from(rows,x=>x.startDate),['2026-10-05','2026-10-10','2026-10-17','2026-10-24']);
 assert.equal(rows[0].hashtags,'#FFWSBR #WBSplit2');
 assert.equal(rows[1].code,'??');
 assert.match(rows[2].items,/Gateira/);
 assert.match(rows[3].warnings.join(' '),/interpretada/);
 assert.match(rows[3].instructions,/novembro/);
 assert.throws(()=>M.parse('sem títulos'),/Nenhuma missão/);
});

test('FFCP missions import once, appear in separate navigation, remain editable and schedule-compatible',async()=>{
 const b=await board(undefined,{ffcpSeed:true}),w=b.w,$=id=>w.document.getElementById(id);
 try{
  const initial=b.state().tasks.filter(t=>t.ffcp);
  assert.equal(initial.length,4);
  assert.equal(b.state().settings.ffcpSeedVersion,2);
  assert.deepEqual(Array.from(initial,t=>t.date),['2026-10-11','2026-10-23','2026-10-30','2026-11-06']);
  $('ffcp-side-shortcut').click();
  assert.equal($('tasks-view').hidden,true);
  assert.equal($('ffcp-missions-view').hidden,false);
  assert.equal(w.document.querySelectorAll('.ffcp-card').length,4);
  assert.equal(w.document.querySelectorAll('.ffcp-instructions:not([open])').length,4);
  let first=[...w.document.querySelectorAll('.ffcp-card')].find(el=>el.querySelector('h3').textContent==='Terror Noturno');
  first.querySelectorAll('button')[1].click();
  const form=w.document.querySelector('.ffcp-editor form');
  form.elements.code.value='COD2026';
  form.elements.hashtags.value='#TerrorFF #FFCP';
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(b.state().tasks.find(t=>t.title==='Terror Noturno').ffcp.code,'COD2026');
  first=[...w.document.querySelectorAll('.ffcp-card')].find(el=>el.querySelector('h3').textContent==='Terror Noturno');
  first.querySelectorAll('button')[0].click();
  assert.equal(b.state().tasks.find(t=>t.title==='Terror Noturno').status,'done');
  assert.equal(b.state().tasks.find(t=>t.title==='Terror Noturno').notify,true);
  const source=[
   '5 - Teste Novo','● Itens: Item novo','● Período da missão: 27/10 a 30/10','● Hashtag: #NovoFF','Instruções: Fazer um post.'
  ].join('\n');
  w.confirm=()=>true;
  $('ffcp-paste').value=source;
  w.document.querySelector('[data-ffcp-import]').click();
  assert.equal(b.state().tasks.filter(t=>t.ffcp).length,5);
  const newTask=b.state().tasks.find(t=>t.title==='Teste Novo');
  assert.equal(newTask.ffcp.hashtags,'#NovoFF');
  assert.equal(newTask.notify,true);
  const normalized=b.read('normalise(state)');
  assert.equal(normalized.tasks.find(t=>t.id===newTask.id).ffcp.items,'Item novo');
  assert.equal(b.errors.length,0);
 }finally{w.close();}
});
