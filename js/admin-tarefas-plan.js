(function(){
 'use strict';
 const approvals={none:'Sem aprovação',pending:'Aguardando aprovação',changes:'Ajustes solicitados',approved:'Aprovado',rejected:'Recusado'};
 const text=(v,n)=>{if(typeof v!=='string'||v.length>n)throw Error('Texto inválido na organização da tarefa.');return v;};
 const date=v=>{v=v||'';if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v))throw Error('Data inválida.');return v;};
 const time=v=>{v=v||'';if(v&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Error('Horário inválido.');return v;};
 const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 const distance=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
 const today=()=>window.CFF_TASKS_DAILY.today();
 const instant=(d,t)=>window.CFF_TASKS_DAILY.instant(d,t);
 const active=t=>!['done','cancelled'].includes(t.status);
 function extra(t,data={}){
  const startDate=date(t.startDate),publishDate=date(t.publishDate),publishTime=time(t.publishTime),scheduledDate=date(t.scheduledDate),scheduledTime=time(t.scheduledTime),focusDate=date(t.focusDate);
  if(startDate&&(!t.date||startDate>t.date))throw Error('O início da entrega precisa ser igual ou anterior à data final.');
  if(publishTime&&!publishDate)throw Error('Defina a data de publicação antes do horário.');
  if(scheduledTime&&!scheduledDate)throw Error('Defina a data do agendamento antes do horário agendado.');
  const r=t.repeat||{},frequency=['weekly','monthly'].includes(r.frequency)?r.frequency:'none',interval=Number(r.interval||1),until=date(r.until);
  if(!Number.isInteger(interval)||interval<1||interval>12)throw Error('Repetição inválida.');if(frequency!=='none'&&!t.date)throw Error('Uma tarefa recorrente precisa de data de entrega.');if(until&&t.date&&until<t.date)throw Error('A repetição não pode terminar antes da primeira entrega.');
  const a=t.approval||{},state=Object.hasOwn(approvals,a.state)?a.state:'none',sentAt=a.sentAt||'';if(sentAt&&!Number.isFinite(Date.parse(sentAt)))throw Error('Data de aprovação inválida.');
  const projectId=(data.projects||[]).some(p=>p.id===t.projectId)?t.projectId:'',companyId=(data.projectCompanies||[]).some(c=>c.id===t.companyId&&c.projectId===projectId)?t.companyId:'';
  let publishedUrl=text(t.publishedUrl||'',3000);if(publishedUrl){const u=new URL(publishedUrl);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Use um link http ou https para a publicação.');publishedUrl=u.href;}
  return {startDate,publishDate,publishTime,scheduledDate,scheduledTime,publishedUrl,projectId,companyId,assignee:text(t.assignee||'',80),focusDate,focusOrder:Number.isInteger(t.focusOrder)&&t.focusOrder>=0&&t.focusOrder<3?t.focusOrder:0,notify:t.notify!==false,repeat:{frequency,interval,until,anchorDay:Number(r.anchorDay)||Number((t.date||'').slice(8))||1},seriesId:text(t.seriesId||t.id,150),approval:{state,person:text(a.person||'',80),sentAt,note:text(a.note||'',2000)}};
 }
 function settings(raw={}){return {notifications:window.CFF_TASKS_NOTIFICATIONS.preferences(raw)};}
 function inWindow(t,d=today()){return !!t.date&&(t.startDate?t.startDate<=d&&d<=t.date:t.date===d);}
 function nextRepeat(t,day=today()){
  if(t.status!=='done'||!t.date||!['weekly','monthly'].includes(t.repeat?.frequency))return null;
  const r=t.repeat,base=t.date;let next=base;
  for(let count=1;count<=1200;count++){
   if(r.frequency==='weekly')next=addDays(base,7*r.interval*count);
   else{const p=base.split('-').map(Number),d=new Date(Date.UTC(p[0],p[1]-1+r.interval*count,1)),last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(r.anchorDay||p[2],last));next=d.toISOString().slice(0,10);}
   if(next>=day)break;
  }
  if(r.until&&next>r.until)return null;
  const shift=distance(base,next),id='repeat-'+(t.seriesId||t.id).slice(0,110)+'-'+next,stamp=new Date().toISOString(),copy=JSON.parse(JSON.stringify(t));
  return {...copy,id,seriesId:t.seriesId||t.id,date:next,startDate:t.startDate?addDays(t.startDate,shift):'',publishDate:t.publishDate?addDays(t.publishDate,shift):'',scheduledDate:'',scheduledTime:'',publishedUrl:'',boardOrder:null,status:'todo',previousStatus:'todo',focusDate:'',focusOrder:0,completedAt:null,cancelledAt:null,createdAt:stamp,updatedAt:stamp,subtasks:t.subtasks.map((s,i)=>({...s,id:id+'-s'+i,done:false})),approval:{...copy.approval,state:copy.approval.state==='none'?'none':'pending',sentAt:'',note:''},history:[{id:id+'-created',at:stamp,action:'Criada pela repetição de '+t.title}]};
 }
 function shiftTask(t,target,source=t.date){const delta=distance(source,target);return {date:t.date?addDays(t.date,delta):target,startDate:t.startDate?addDays(t.startDate,delta):''};}
 function events(state,at=Date.now()){return window.CFF_TASKS_NOTIFICATIONS.events(state,at);}
 const templates=[
  {id:'cff-news',name:'Notícia da Central',title:'Nova notícia',note:'Informação principal:\nFonte e confirmação:\nTexto para a arte:\nLegenda:',service:'social',steps:['Confirmar informação e fonte','Separar fotos e logos','Criar arte','Revisar texto e dados','Publicar e salvar o link']},
  {id:'mmr-post',name:'Post do MMR',title:'Post do MMR',note:'Objetivo da publicação:\nMensagem principal:\nChamada para ação:\nReferências:',service:'social',steps:['Preparar briefing','Produzir arte ou vídeo','Escrever legenda','Enviar para aprovação','Agendar publicação']},
  {id:'coverage',name:'Cobertura de campeonato',title:'Cobertura de campeonato',note:'Campeonato e etapa:\nDias e horários:\nTransmissão:\nDados que precisam ser atualizados:',service:'live',steps:['Conferir horários e participantes','Preparar modelos de arte','Acompanhar resultados','Atualizar classificação','Publicar resumo']},
  {id:'stories',name:'Sequência de Stories',title:'Stories',note:'Tema:\nSequência de telas:\nLink ou chamada para ação:',service:'social',steps:['Separar conteúdo','Montar sequência','Revisar links e horários','Publicar']}
 ];
 function myDay(tasks,d=today()){const priorities=tasks.filter(t=>active(t)&&t.focusDate===d).sort((a,b)=>a.focusOrder-b.focusOrder||a.title.localeCompare(b.title));return {priorities,today:tasks.filter(t=>active(t)&&(inWindow(t,d)||t.publishDate===d)&&!priorities.some(p=>p.id===t.id)),late:tasks.filter(t=>active(t)&&t.date&&t.date<d&&!priorities.some(p=>p.id===t.id))};}
 window.CFF_TASKS_PLAN={extra,settings,date,time,addDays,distance,today,instant,active,inWindow,nextRepeat,shiftTask,events,templates,myDay,approvals};
})();
