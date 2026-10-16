(function(){
 'use strict';
 const LAYOUT_KEY='cff-tasks-card-layout-v1',MAX_COPIES=20;
 function icon(kind){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  if(kind==='grip'){for(const x of [9,15])for(const y of [6,12,18]){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','1');svg.append(dot);}}
  else{const path=document.createElementNS(ns,'path');path.setAttribute('d',kind==='up'?'M12 19V5m-5 5 5-5 5 5':kind==='down'?'M12 5v14m-5-5 5 5 5-5':'m7 10 5 5 5-5');svg.append(path);}
  return svg;
 }
 function copies(value){
  if(value===undefined||value===null)return [];
  if(!Array.isArray(value)||value.length>MAX_COPIES)throw Error('Use até 20 copies por tarefa.');
  const ids=new Set();
  return value.map((c,i)=>{
   if(!c||typeof c.id!=='string'||!c.id||c.id.length>150||ids.has(c.id))throw Error('Identificação de copy inválida.');
   if(typeof c.label!=='string'||c.label.length>60||typeof c.text!=='string'||c.text.length>10000)throw Error('Cada copy pode ter um nome de até 60 caracteres e uma legenda de até 10.000.');
   ids.add(c.id);return {id:c.id,label:c.label.trim()||'Copy '+(i+1),text:c.text};
  });
 }
 function mount(api){
  const $=id=>document.getElementById(id),node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  let layout=readLayout();const controllers=new WeakMap();
  function readLayout(){try{const value=JSON.parse(localStorage.getItem(LAYOUT_KEY)||'{}');return {columns:value?.columns&&typeof value.columns==='object'&&!Array.isArray(value.columns)?value.columns:{},cards:value?.cards&&typeof value.cards==='object'&&!Array.isArray(value.cards)?value.cards:{}};}catch{return {columns:{},cards:{}};}}
  function persistLayout(){try{const ids=new Set(api.getState().tasks.map(t=>t.id));const cards=Object.fromEntries(Object.entries(layout.cards).filter(([id,v])=>ids.has(id)&&typeof v==='boolean'));localStorage.setItem(LAYOUT_KEY,JSON.stringify({columns:layout.columns,cards}));}catch{api.toast('Visualização alterada. Não foi possível lembrar esta preferência neste navegador.');}}
  function collapsed(t){if(Object.hasOwn(layout.cards,t.id)&&typeof layout.cards[t.id]==='boolean')return layout.cards[t.id];return typeof layout.columns[t.status]==='boolean'?layout.columns[t.status]:true;}
  function allCollapsed(status){const tasks=api.getState().tasks.filter(t=>t.status===status);return !tasks.length||tasks.every(collapsed);}
  function refreshColumnButtons(){for(const b of document.querySelectorAll('.column-collapse')){const folded=allCollapsed(b.dataset.status);b.textContent=folded?'Expandir cards':'Recolher cards';b.setAttribute('aria-label',(folded?'Expandir':'Recolher')+' todos os cards de '+b.dataset.name);b.title=b.getAttribute('aria-label');}}
  function setCollapsed(t,value){Object.defineProperty(layout.cards,t.id,{value,writable:true,enumerable:true,configurable:true});persistLayout();for(const card of document.querySelectorAll('.card'))if(card.dataset.taskId===t.id)controllers.get(card)?.();refreshColumnButtons();}
  function decorateColumn(head,column){
   const b=node('button','column-collapse');b.type='button';b.dataset.status=column.id;b.dataset.name=column.name;b.disabled=!api.getState().tasks.some(t=>t.status===column.id);
   b.textContent=allCollapsed(column.id)?'Expandir cards':'Recolher cards';b.setAttribute('aria-label',(allCollapsed(column.id)?'Expandir':'Recolher')+' todos os cards de '+column.name);b.title=b.getAttribute('aria-label');
   b.onclick=()=>{const value=!allCollapsed(column.id);Object.defineProperty(layout.columns,column.id,{value,writable:true,enumerable:true,configurable:true});for(const t of api.getState().tasks)if(t.status===column.id)delete layout.cards[t.id];persistLayout();api.render();Array.from(document.querySelectorAll('.column-collapse')).find(e=>e.dataset.status===column.id)?.focus({preventScroll:true});};
   head.insertBefore(b,head.querySelector('.column-hide'));
  }
  async function copyText(text){
   try{if(!navigator.clipboard?.writeText)throw Error('Clipboard indisponível');await navigator.clipboard.writeText(text);return;}
   catch{
    const active=document.activeElement,selection=active&&'selectionStart'in active?{start:active.selectionStart,end:active.selectionEnd}:null;
    const field=node('textarea');field.value=text;field.setAttribute('aria-label','Copy para copiar');field.style.cssText='position:fixed;left:-10000px;top:0';(active?.closest('dialog[open]')||document.body).append(field);field.select();let ok=false;
    try{ok=!!document.execCommand?.('copy');}catch{ok=false;}finally{field.remove();active?.focus({preventScroll:true});if(selection&&active.setSelectionRange)try{active.setSelectionRange(selection.start,selection.end);}catch{}}
    if(!ok)throw Error('O navegador não permitiu copiar. Abra a tarefa e copie a legenda manualmente.');
   }
  }
  function quickCopies(card,t,body){
   const items=(t.copies||[]).filter(c=>c.text.trim());if(!items.length)return;
   const bar=node('div','card-copies'),label=node('span','card-copies-label','Copy');bar.append(label);let selected=items[0].id;
   if(items.length===1)bar.append(node('span','card-copy-name',items[0].label));
   else{const select=node('select','card-copy-select');select.setAttribute('aria-label','Escolher copy de '+t.title);for(const item of items){const option=node('option','',item.label);option.value=item.id;select.append(option);}select.onchange=()=>{selected=select.value;};bar.append(select);}
   const b=node('button','small-btn card-copy-button','Copiar');b.type='button';b.setAttribute('aria-label','Copiar legenda de '+t.title);b.onclick=async()=>{const latest=api.getState().tasks.find(task=>task.id===t.id)||t,item=(latest.copies||[]).find(c=>c.id===selected);if(!item?.text.trim()){api.toast('Esta copy mudou. Atualize o card antes de copiar.');return;}b.disabled=true;try{await copyText(item.text);api.toast('Copy / '+item.label+' copiada');}catch(e){api.toast(e.message);}finally{b.disabled=false;}};bar.append(b);card.insertBefore(bar,body);
  }
  function decorate(card,t){
   const body=card.querySelector('.card-body'),head=card.querySelector('.card-head');if(!body||!head)return;
   // Extra details follow the same disclosure as the card body.
   const chips=card.querySelector('.planning-chips');if(chips)body.append(chips);
   const detailsId='task-details-'+api.uid();body.id=detailsId;
   const toggle=node('button','card-disclosure');toggle.type='button';toggle.setAttribute('aria-controls',detailsId);toggle.append(icon('chevron'));card.querySelector('.card-top').append(toggle);
   const summary=node('div','card-compact-summary');
   const badge=node('span','compact-deadline',t.date?(t.startDate&&t.startDate!==t.date?t.startDate.slice(8)+'/'+t.startDate.slice(5,7)+' até ':'')+t.date.slice(8)+'/'+t.date.slice(5,7)+(t.time?' · '+t.time:''):'Sem data');summary.append(badge);
   if(t.subtasks.length)summary.append(node('span','compact-progress',t.subtasks.filter(s=>s.done).length+'/'+t.subtasks.length+' etapas'));
   if(t.attachments.length)summary.append(node('span','compact-progress',t.attachments.length+' anexo(s)'));
   if(t.focusDate===window.CFF_TASKS_PLAN.today())summary.append(node('span','compact-priority','★ Meu dia'));
   const countdown=body.querySelector('[data-countdown]');if(countdown){const c=countdown.cloneNode(true);c.classList.add('compact-countdown');summary.append(c);}
   card.insertBefore(summary,body);quickCopies(card,t,body);
   const apply=()=>{const fold=collapsed(t);card.classList.toggle('card-collapsed',fold);body.hidden=fold;summary.hidden=!fold;toggle.setAttribute('aria-expanded',String(!fold));toggle.setAttribute('aria-label',(fold?'Expandir detalhes de ':'Recolher detalhes de ')+t.title);toggle.title=toggle.getAttribute('aria-label');};
   toggle.onclick=()=>setCollapsed(t,!collapsed(t));controllers.set(card,apply);apply();
  }
  const section=node('section','form-section task-copy-section');section.id='task-copy-section';
  const head=node('div','section-head');head.append(node('h3','','Copy'));const add=node('button','small-btn','+ Adicionar copy');add.id='add-task-copy';add.type='button';head.append(add);section.append(head,node('p','hint','Salve uma legenda por plataforma ou versão. Os botões de copiar ficam disponíveis no card, mesmo recolhido.'));
  const list=node('div','task-copy-list');list.id='task-copy-list';section.append(list);$('task-note').closest('label').after(section);
  function renderCopies(){
   const draft=api.getDraft();list.replaceChildren();add.disabled=(draft?.copies?.length||0)>=MAX_COPIES;
   if(!draft?.copies?.length){list.append(node('p','hint copy-empty','Nenhuma copy nesta tarefa. Adicione “Insta”, “Stories”, “X” ou outro nome.'));return;}
   draft.copies.forEach((c,i)=>{
    const row=node('article','copy-editor-row');row.dataset.copyId=c.id;
    const top=node('div','copy-editor-top'),label=node('label','field','Copy / '),name=node('input','copy-label');name.value=c.label;name.maxLength=60;name.placeholder='Insta, Stories, X…';name.setAttribute('aria-label','Nome da copy '+(i+1));name.addEventListener('input',()=>{c.label=name.value;});label.append(name);top.append(label);
    const remove=node('button','small-btn danger-small','Remover');remove.type='button';remove.setAttribute('aria-label','Remover copy '+(c.label||String(i+1)));remove.onclick=()=>{if(c.text.trim()&&!confirm('Remover esta copy da edição? O texto só será removido ao salvar a tarefa.'))return;draft.copies=draft.copies.filter(x=>x.id!==c.id);renderCopies();};top.append(remove);row.append(top);
    const textLabel=node('label','field','Legenda'),area=node('textarea','copy-text');area.value=c.text;area.rows=5;area.maxLength=10000;area.placeholder='Escreva a legenda, com emojis, hashtags e quebras de linha…';area.setAttribute('aria-label','Legenda da copy '+(i+1));textLabel.append(area);row.append(textLabel);
    const footer=node('div','copy-editor-footer'),counter=node('span','hint',Array.from(c.text).length+' caracteres');counter.setAttribute('aria-live','off');area.addEventListener('input',()=>{c.text=area.value;counter.textContent=Array.from(c.text).length+' caracteres';});
    const b=node('button','small-btn','Copiar legenda');b.type='button';b.onclick=async()=>{if(!c.text.trim()){api.toast('Escreva a legenda antes de copiar.');return;}try{await copyText(c.text);api.toast('Legenda copiada');}catch(e){api.toast(e.message);}};footer.append(counter,b);row.append(footer);list.append(row);
   });
  }
  add.onclick=()=>{const draft=api.getDraft();if(!draft)return;draft.copies??=[];if(draft.copies.length>=MAX_COPIES){api.toast('Use até 20 copies por tarefa.');return;}draft.copies.push({id:api.uid(),label:draft.copies.length?'':'Insta',text:''});renderCopies();list.lastElementChild.querySelector('.copy-label').focus();};
  return {edit(draft){draft.copies=copies(draft.copies);renderCopies();},readDraft(){const draft=api.getDraft();if(draft)draft.copies=copies(draft.copies);},decorate,decorateColumn,copyText};
 }
 window.CFF_TASKS_CONTENT={copies,mount,icon};
})();
