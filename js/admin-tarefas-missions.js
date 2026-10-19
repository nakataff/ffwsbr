(function(){
'use strict';
const YEAR=2026;
const clean=value=>String(value||'').replace(/\r/g,'').trim();
const day=date=>date?date.slice(8,10)+'/'+date.slice(5,7)+'/'+date.slice(0,4):'';
const key=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,'');
const iso=(d,m,y)=>{const year=Number(y)||YEAR,dt=new Date(Date.UTC(year,Number(m)-1,Number(d)));return dt.getUTCFullYear()===year&&dt.getUTCMonth()+1===Number(m)&&dt.getUTCDate()===Number(d)?dt.toISOString().slice(0,10):'';};
const text=(v,n)=>{v=clean(v);if(v.length>n)throw Error('Campo da missão muito longo (máximo '+n+' caracteres).');return v;};
function meta(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Dados FFCP inválidos.');
 return {code:text(raw.code,160),hashtags:text(raw.hashtags,500),items:text(raw.items,2500),source:text(raw.source||'',40)};
}
function range(value){
 const match=clean(value).match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(?:a|até|ate|–|—|-)\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/i);
 if(!match)return {startDate:'',date:'',warning:'Não foi possível identificar o período.'};
 const firstYear=Number(match[3])||YEAR;
 const startDate=iso(match[1],match[2],firstYear);
 let date=iso(match[4],match[5],Number(match[6])||firstYear);
 let warning='';
 if(startDate&&date&&date<startDate&&!match[6]){
  const asUs=iso(match[5],match[4],firstYear);
  if(asUs>=startDate){date=asUs;warning='Data '+match[4]+'/'+match[5]+' interpretada como '+day(date).slice(0,5)+' (mês/dia na mensagem).';}
  else date=iso(match[4],match[5],firstYear+1);
 }
 if(!startDate||!date||date<startDate)return {startDate:'',date:'',warning:'Confira as datas: '+clean(value)};
 return {startDate,date,warning};
}
function parse(input){
 const raw=String(input||'').replace(/\r/g,'');
 const headings=[...raw.matchAll(/^\s*(\d{1,2})\s*[-–.)]\s*(.+?)\s*$/gm)];
 if(!headings.length)throw Error('Nenhuma missão encontrada. Cole títulos numerados como “1 - Nome da missão”.');
 if(headings.length>40)throw Error('Importe até 40 missões por vez.');
 return headings.map((heading,i)=>{
  const block=raw.slice(heading.index+heading[0].length,headings[i+1]?.index??raw.length).trim();
  const lines=block.split('\n').map(line=>line.trim().replace(/^[●•*-]\s*/,'')),field=(pattern)=>clean(lines.find(s=>pattern.test(s))?.replace(/^[^:]*:\s*/,'')||'');
  const items=field(/^Itens?\s*:/i),period=field(/^Per[ií]odo da miss[aã]o\s*:/i);
  const code=field(/^C[oó]diguin(?:\s+da\s+semana)?\s*:/i),hashtags=field(/^Hashtags?\s*:/i);
  const start=lines.findIndex(line=>/^Instru[cç][oõ]es?\s*:/i.test(line));
  const instructions=start<0?'':lines.slice(start).join('\n').replace(/^Instru[cç][oõ]es?\s*:\s*/i,'').trim();
  const dates=range(period);
  const warnings=[];
  if(!period||!dates.date)warnings.push('Conferir período');
  if(dates.warning)warnings.push(dates.warning);
  if(!instructions)warnings.push('Sem instruções no texto');
  return {title:text(heading[2],200),items:text(items,2500),code:text(code,160),hashtags:text(hashtags,500),instructions:text(instructions,4000),startDate:dates.startDate,date:dates.date,warnings,number:Number(heading[1])};
 });
}
const examples=[
 {title:'Finais da WB',startDate:'2026-10-05',date:'2026-10-11',code:'???',hashtags:'#FFWSBR #WBSplit2',items:'',instructions:'A final da FFWS BR está chegando! Divulgar o encerramento da temporada, reforçar os dias de transmissão, convidar o público a acompanhar a final ao vivo, destacar confrontos e times presentes. Sempre que possível, indicar o YouTube oficial do FF Esports Brasil: https://www.youtube.com/@ffesportsbr. Briefing de apoio e documento anexo disponíveis no comunicado do FFCP.'},
 {title:'Dino Fogo',startDate:'2026-10-10',date:'2026-10-23',code:'??',hashtags:'#DinoFF',items:'Conjunto Dino Fogo e Conjunto Dino Chama',instructions:'Divulgar a chegada do Conjunto Dino Fogo e Dino Chama no evento Vira-Carta, disponível de 10 a 23 de outubro.'},
 {title:'Gateiro FF',startDate:'2026-10-17',date:'2026-10-30',code:'???',hashtags:'#GatoFF',items:'Conjunto Gateiro, Conjunto Gateira, Pantufa de Gatinho, Machete - Olhar Felino, Conjunto Raposa do Ártico, Conjunto Raposa Nórdica, Conjunto Imponência de Campeão, Conjunto Assimetria Feroz',instructions:'Divulgar a chegada dos conjuntos Gateiro e Gateira e os itens complementares do evento Desconto Maluco, disponível de 17 a 30 de outubro.'},
 {title:'Terror Noturno',startDate:'2026-10-24',date:'2026-11-06',code:'??',hashtags:'#TerrorFF',items:'Conjunto Terror Noturno, Conjunto Criatura Macabra, Conjunto Aparição Noturna',instructions:'Divulgar a chegada dos três conjuntos no Vira-Carta, disponível de 24 de outubro a 6 de novembro. Período do comunicado: 24/10 a 11/06 (interpretado como 06/11, conforme as instruções).'}
];
function task(item,id,now){
 return {id,title:item.title,note:item.instructions||'',date:item.date||'',time:'',status:'todo',previousStatus:'todo',important:false,color:'lilac',service:'social',serviceIcon:'',platforms:[],tags:[],links:[],subtasks:[],attachments:[],history:[],createdAt:now,updatedAt:now,completedAt:null,cancelledAt:null,notify:true,startDate:item.startDate||'',ffcp:meta({code:item.code,hashtags:item.hashtags,items:item.items,source:item.source||'ffcp'})};
}
function seed(state){
 if(Number(state.settings?.ffcpSeedVersion)>=1)return false;
 const now=new Date().toISOString(),existing=new Set((state.tasks||[]).map(t=>key(t.title)+'|'+t.date));
 for(let i=0;i<examples.length;i++){const item=examples[i];if(!existing.has(key(item.title)+'|'+item.date))state.tasks.push(task(item,'ffcp-2026-oct-'+(i+1),now));}
 state.settings.ffcpSeedVersion=1;
 return true;
}
const e=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const field=(name,label,value='',tag='input')=>{const l=e('label','ffcp-field'),span=e('span','',label),input=e(tag);input.name=name;if(tag==='textarea')input.rows=name==='instructions'?7:2;else input.type=['date'].includes(name)?'date':'text';input.value=value;l.append(span,input);return l;};
function mount(api,projects){
 const root=document.getElementById('ffcp-missions-view');
 const list=root.querySelector('[data-ffcp-list]'),summary=root.querySelector('[data-ffcp-summary]'),paste=root.querySelector('[data-ffcp-paste]'),preview=root.querySelector('[data-ffcp-preview]');
 const state=api.getState,missions=()=>state().tasks.filter(t=>t.ffcp);
 const open=()=>{projects.switchView('missions');render();};
 document.getElementById('ffcp-side-shortcut')?.addEventListener('click',open);
 document.querySelector('[data-ffcp-alerts]')?.addEventListener('click',()=>document.getElementById('task-notifications')?.click());
 function editMission(original){
  const d=e('dialog','planning-dialog ffcp-editor'),heading=e('div','dialog-top'),title=e('h2','','Editar missão FFCP'),close=e('button','close','×');close.type='button';close.setAttribute('aria-label','Fechar');close.onclick=()=>d.close();heading.append(title,close);
  const form=e('form','ffcp-edit-form');const controls=[
   field('title','Nome da missão',original.title),
   field('startDate','Início da missão',original.startDate||''),
   field('date','Prazo final',original.date||''),
   field('code','Códiguin',original.ffcp?.code||''),
   field('hashtags','Hashtags',original.ffcp?.hashtags||''),
   field('items','Itens',original.ffcp?.items||'','textarea'),
   field('instructions','Instruções completas',original.note,'textarea')];
  for(const el of controls){if(el.querySelector('[name=title]'))el.querySelector('input').maxLength=200;form.append(el);}
  const notify=e('label','ffcp-notify'),toggle=e('input');toggle.type='checkbox';toggle.name='notify';toggle.checked=original.notify!==false;notify.append(toggle,e('span','','Receber lembretes desta missão quando notificações estiverem ativadas'));form.append(notify);
  const status=e('p','hint');status.setAttribute('role','status');const buttons=e('div','dialog-actions'),cancel=e('button','quiet','Cancelar'),save=e('button','primary','Salvar missão');cancel.type='button';cancel.onclick=()=>d.close();save.type='submit';buttons.append(cancel,save);form.append(status,buttons);
  form.onsubmit=event=>{
   event.preventDefault();
   const v=new FormData(form),start=clean(v.get('startDate')),due=clean(v.get('date'));
   if((start&&!due)||(start&&due&&start>due)){status.textContent='O início precisa ser anterior ou igual ao prazo final.';return;}
   try{
    const patch={title:text(v.get('title'),200),startDate:start,date:due,note:text(v.get('instructions'),4000),notify:toggle.checked,ffcp:meta({code:v.get('code'),hashtags:v.get('hashtags'),items:v.get('items'),source:'ffcp'})};
    if(!patch.title)throw Error('Informe o nome da missão.');
    api.update(original,patch,'Missão FFCP editada');d.close();render();
   }catch(error){status.textContent=error.message;}
  };
  d.append(heading,form);d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);d.showModal();
 }
 function pill(textName,tone){return e('span','ffcp-pill '+(tone||''),textName);}
 function render(){
  if(root.hidden)return;
  const today=window.CFF_TASKS_PLAN.today(),all=missions();
  const pending=all.filter(t=>!['done','cancelled'].includes(t.status)),expired=pending.filter(t=>t.date&&t.date<today),soon=pending.filter(t=>t.date&&t.date>=today&&t.date<=window.CFF_TASKS_PLAN.addDays(today,3));
  summary.textContent=all.length+' missões · '+pending.length+' pendentes · '+all.filter(t=>t.status==='done').length+' concluídas'+(expired.length?' · '+expired.length+' com prazo encerrado':'')+(soon.length?' · '+soon.length+' urgentes':'');
  const ordered=[...all].sort((a,b)=>Number(a.status==='done')-Number(b.status==='done')||(a.date||'9999').localeCompare(b.date||'9999')||a.title.localeCompare(b.title,'pt-BR'));
  list.replaceChildren();
  if(!ordered.length)list.append(e('p','hint','Nenhuma missão cadastrada. Cole um comunicado acima.'));
  for(const t of ordered){
   const finished=t.status==='done',expired=!finished&&t.date&&t.date<today,notStarted=!finished&&t.startDate&&t.startDate>today,urgent=!finished&&t.date&&t.date>=today&&t.date<=window.CFF_TASKS_PLAN.addDays(today,3);
   const card=e('article','ffcp-card'+(finished?' ffcp-finished':'')+(expired?' ffcp-expired':''));
   const head=e('div','ffcp-card-head'),caption=e('div','ffcp-card-caption'),h=e('h3','',t.title),badges=e('div','ffcp-badges');
   badges.append(pill(finished?'Concluída':expired?'Prazo encerrado':notStarted?'Em breve':urgent?'Prazo próximo':'Em andamento',finished?'done':expired?'expired':urgent?'urgent':''));
   if(t.startDate||t.date)badges.append(pill((t.startDate?day(t.startDate).slice(0,5):'—')+' até '+(t.date?day(t.date).slice(0,5):'—')));
   if(t.notify!==false)badges.append(pill('🔔 Lembrete'));
   caption.append(h,badges);const actions=e('div','ffcp-actions'),complete=e('button','small-btn',finished?'↶ Reabrir':'✓ Concluir'),edit=e('button','small-btn','Editar');complete.type=edit.type='button';
   complete.onclick=()=>{api.completeTask(t,finished?'todo':'done');render();};edit.onclick=()=>editMission(t);actions.append(complete,edit);head.append(caption,actions);card.append(head);
   const tags=e('div','ffcp-meta');if(t.ffcp?.hashtags)tags.append(pill(t.ffcp.hashtags));if(t.ffcp?.code)tags.append(pill('Códiguin: '+t.ffcp.code));if(t.ffcp?.items)tags.append(e('p','ffcp-items','Itens: '+t.ffcp.items));card.append(tags);
   if(t.note){const details=e('details','ffcp-instructions'),toggle=e('summary','','Ver instruções completas'),body=e('p','',t.note);details.append(toggle,body);card.append(details);}
   list.append(card);
  }
 }
 function importMissions(){
  let batch;
  try{batch=parse(paste.value);}catch(err){preview.textContent=err.message;return;}
  const seen=new Set(missions().map(t=>key(t.title)+'|'+t.date)),unique=[],duplicates=[];
  for(const m of batch){const k=key(m.title)+'|'+m.date;if(seen.has(k)){duplicates.push(m.title);continue;}seen.add(k);unique.push(m);}
  if(batch.some(m=>!m.date)){preview.textContent='Algumas missões estão sem prazo válido. Confira o período no texto antes de importar: '+batch.filter(m=>!m.date).map(m=>m.title).join(', ');return;}
  if(!unique.length){preview.textContent='Essas missões já estão cadastradas. Nada foi duplicado.';return;}
  const alerts=unique.flatMap(m=>m.warnings.map(w=>m.title+': '+w));
  const description=unique.map(m=>m.title+' ('+day(m.startDate).slice(0,5)+'–'+day(m.date).slice(0,5)+')').join(' · ');
  if(!confirm('Importar '+unique.length+' missão(ões)?\n'+description+(duplicates.length?'\nJá cadastradas: '+duplicates.join(', '):'')+(alerts.length?'\nAtenção: '+alerts.join('; '):'')))return;
  const now=api.now();const next=api.copy(state());next.tasks.push(...unique.map(item=>task(item,api.uid(),now)));
  api.replace(next).then(()=>{}).catch(err=>{preview.textContent='Falha ao salvar: '+err.message;});
  preview.textContent=unique.length+' missões adicionadas. '+(duplicates.length?duplicates.length+' duplicadas ignoradas. ':'')+alerts.join(' ');
  paste.value='';render();
 }
 root.querySelector('[data-ffcp-import]').addEventListener('click',importMissions);
 root.querySelector('[data-ffcp-clear]').addEventListener('click',()=>{paste.value='';preview.textContent='';});
 root.querySelector('[data-ffcp-parse]').addEventListener('click',()=>{try{const rows=parse(paste.value);preview.textContent=rows.map(r=>r.title+' · '+day(r.startDate)+' até '+day(r.date)+(r.warnings.length?' · Confira: '+r.warnings.join('; '):'')).join('\n');}catch(err){preview.textContent=err.message;}});
 return {render,open};
}
window.CFF_TASKS_MISSIONS={parse,range,meta,seed,mount,examples,task};
})();