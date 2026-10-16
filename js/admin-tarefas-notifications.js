(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CFF_TASKS_NOTIFICATIONS=factory();})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 const offsets=[15,30,60,180,1440],approvalDelays=[1,2,3,5,7];
 const isTime=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 const isDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00Z'))&&new Date(v+'T12:00Z').toISOString().slice(0,10)===v;
 const addDays=(d,n)=>new Date(Date.parse(d+'T12:00Z')+n*86400000).toISOString().slice(0,10);
 const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
 const dayAt=at=>dayFormatter.format(new Date(at));
 const instant=(d,t)=>Date.parse(d+'T'+t+':00-03:00');
 const active=t=>!['done','cancelled'].includes(t.status)&&t.notify!==false;
 const inWindow=(t,d)=>!!t.date&&(t.startDate?t.startDate<=d&&d<=t.date:t.date===d);
 const shortDate=d=>d.split('-').reverse().join('/');
 function preferences(raw={}){
  const n=raw.notifications||{},lead=offsets.includes(Number(n.leadMinutes))?Number(n.leadMinutes):60;
  const leadTimes=Array.isArray(n.leadTimes)?[...new Set(n.leadTimes.map(Number).filter(x=>offsets.includes(x)))].sort((a,b)=>a-b):[lead];
  return {enabled:n.enabled===true,start:n.start!==false,reminder:n.reminder!==false,leadMinutes:lead,leadTimes,due:n.due!==false,publication:n.publication!==false,overdue:n.overdue===true,summary:n.summary===true,summaryTime:isTime(n.summaryTime)?n.summaryTime:'09:00',approval:n.approval===true,approvalDays:approvalDelays.includes(Number(n.approvalDays))?Number(n.approvalDays):2,defaultTime:isTime(n.defaultTime)?n.defaultTime:'09:00'};
 }
 function events(state,at=Date.now()){
  const p=preferences(state.settings);if(!p.enabled)return [];
  const result=[];
  const add=(t,kind,stamp,body,catchUp=false,identity=stamp)=>{if(!Number.isFinite(stamp)||stamp>at+370*86400000||!catchUp&&stamp<at-60000)return;result.push({id:t.id+':'+kind+':'+identity,taskId:t.id,title:t.title,kind,at:stamp<at-60000?at+1000:stamp,...(body?{body}:{})});};
  for(const t of state.tasks){if(!active(t))continue;
   if(t.startDate&&p.start)add(t,'start',instant(t.startDate,p.defaultTime),t.title+' · Entrega de '+shortDate(t.startDate)+' até '+shortDate(t.date)+'.');
   if(t.date){const due=instant(t.date,t.time||p.defaultTime);if(p.reminder)for(const minutes of p.leadTimes)add(t,'reminder',due-minutes*60000);if(p.due)add(t,'due',due);if(p.overdue)add(t,'overdue',instant(addDays(t.date,1),p.defaultTime),t.title+' · Entrega vencida em '+shortDate(t.date)+(t.time?' às '+t.time:'')+'.',true,t.date+'T'+(t.time||'23:59'));}
   if(t.publishDate&&p.publication&&!t.publishedUrl)add(t,'publication',instant(t.publishDate,t.publishTime||p.defaultTime));
   if(p.approval&&t.approval?.state==='pending'&&t.approval.sentAt){const sent=Date.parse(t.approval.sentAt);if(Number.isFinite(sent)){const d=addDays(dayAt(sent),p.approvalDays),stamp=Math.max(instant(d,p.defaultTime),sent+p.approvalDays*86400000);add(t,'approval',stamp,t.title+(t.approval.person?' · Aprovação: '+t.approval.person:'')+' · Aguardando há pelo menos '+p.approvalDays+' dia(s).',true,sent);}}
  }
  return result.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
 }
 function digest(state){const p=preferences(state.settings);return {enabled:p.enabled&&p.summary,time:p.summaryTime,tasks:p.enabled&&p.summary?state.tasks.filter(active).map(t=>({id:t.id,title:t.title,date:t.date||'',startDate:t.startDate||'',time:t.time||'',publishDate:t.publishedUrl?'':t.publishDate||'',focusDate:t.focusDate||'',focusOrder:t.focusOrder||0})):[]};}
 function summary(tasks,day){
  const priorities=tasks.filter(t=>t.focusDate===day).sort((a,b)=>a.focusOrder-b.focusOrder).slice(0,3),deliveries=tasks.filter(t=>inWindow(t,day)),publications=tasks.filter(t=>t.publishDate===day),late=tasks.filter(t=>t.date&&t.date<day);
  if(!priorities.length&&!deliveries.length&&!publications.length&&!late.length)return null;
  const parts=[deliveries.length+' entrega(s)',publications.length+' publicação(ões)'];if(late.length)parts.push(late.length+' atrasada(s)');
  const names=(priorities.length?priorities:[...new Map([...deliveries,...publications,...late].map(t=>[t.id,t])).values()]).slice(0,3).map(t=>t.title.slice(0,65));
  return {title:'Seu dia na Central · '+shortDate(day),body:(parts.join(' · ')+'. '+(priorities.length?'Prioridades: ':'')+names.join('; ')).slice(0,300),taskId:''};
 }
 function validateDigest(value){
  if(value===undefined)return {enabled:false,time:'09:00',tasks:[]};
  if(!value||typeof value.enabled!=='boolean'||!isTime(value.time)||!Array.isArray(value.tasks)||value.tasks.length>2000)throw Error('Resumo diário inválido.');
  const ids=new Set(),tasks=value.tasks.map(t=>{if(!t||typeof t.id!=='string'||!/^[-\w]{1,150}$/.test(t.id)||ids.has(t.id)||typeof t.title!=='string'||!t.title.trim()||t.title.length>200)throw Error('Tarefa inválida no resumo.');ids.add(t.id);for(const k of ['date','startDate','publishDate','focusDate'])if(t[k]&&!isDate(t[k]))throw Error('Data inválida no resumo.');if(t.startDate&&(!t.date||t.startDate>t.date)||t.time&&!isTime(t.time))throw Error('Prazo inválido no resumo.');return {id:t.id,title:t.title,date:t.date||'',startDate:t.startDate||'',time:t.time||'',publishDate:t.publishDate||'',focusDate:t.focusDate||'',focusOrder:[0,1,2].includes(t.focusOrder)?t.focusOrder:0};});
  return {enabled:value.enabled,time:value.time,tasks:value.enabled?tasks:[]};
 }
 return {preferences,events,digest,summary,validateDigest,dayAt,instant,addDays,isDate,isTime,offsets};
});
