import {esc,ROLES,teamHref} from './career-client.mjs?v=20261018-career-chronology-v2';
export function mountCareerBulkArrivals({call,valid,canOpen,onApplied=()=>{}}){
 const day=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date()),x=k=>p.find(z=>z.type===k).value;return x('year')+'-'+x('month')+'-'+x('day');};
 const dialog=document.createElement('dialog');dialog.className='career-editor career-bulk-arrivals';dialog.id='career-bulk-arrivals';
 dialog.setAttribute('aria-labelledby','career-arrivals-title');
 dialog.innerHTML='<div class="career-dialog-head"><div><p class="admin-eyebrow">Mercado da Bala · Carreiras</p><h2 id="career-arrivals-title">Chegadas em massa</h2><p class="career-hint">Selecione vários reforços. O sistema atualiza a carreira e o elenco público em uma única operação, com um card coletivo no Mercado.</p></div><button type="button" data-arrival-close aria-label="Fechar">×</button></div>'+
 '<form id="career-arrivals-form"><div data-arrival-edit>'+
 '<div class="career-form-grid"><label>Equipe de destino<input name="team" required maxlength="100" autocomplete="off" list="career-arrival-teams" placeholder="Ex.: LOUD"><datalist id="career-arrival-teams"></datalist><small data-arrival-team-note>Use uma equipe já cadastrada.</small></label><label>Data da chegada<input type="date" name="date" required></label></div>'+
 '<label>Buscar jogadores ou comissão<input name="query" type="search" autocomplete="off" placeholder="Digite o nick ou nome para adicionar"><small>Pesquise e adicione os nomes. Até 30 pessoas por operação.</small></label>'+
 '<div class="career-arrival-results" data-arrival-results></div>'+
 '<div class="career-arrival-picked"><div class="career-arrival-picked-title"><strong data-arrival-count>0 selecionados</strong><button type="button" class="admin-btn admin-btn-ghost" data-arrival-clear>Limpar</button></div><div data-arrival-picked></div></div>'+
 '<div class="career-form-grid"><label>Fonte (opcional)<input name="source" maxlength="250" placeholder="Anúncio oficial da equipe"></label><label>Link da fonte (opcional)<input name="sourceUrl" type="url" maxlength="1500" placeholder="https://..."></label></div>'+
 '<label>Observação (opcional)<textarea name="notes" rows="2" maxlength="1000"></textarea></label>'+
 '<label class="career-check"><input type="checkbox" name="publishMarket" checked>Publicar as chegadas no Mercado da Bala</label>'+
 '<p class="career-hint">A atualização dos elencos é sempre feita. Sem publicar, o card coletivo do Mercado fica em rascunho.</p></div>'+
 '<section data-arrival-review hidden><h3>Conferir movimentações</h3><p class="career-hint">Todos os registros são salvos juntos. Qualquer conflito cancela a operação inteira.</p><div data-arrival-preview></div><label class="career-check"><input type="checkbox" name="confirm">Confirmei equipe, nomes, cargos e data.</label></section>'+
 '<p role="status" class="career-arrival-feedback" data-arrival-message></p><div class="career-dialog-actions"><button type="button" class="admin-btn admin-btn-ghost" data-arrival-back hidden>Voltar</button><button type="button" class="admin-btn admin-btn-ghost" data-arrival-cancel>Cancelar</button><button type="button" class="admin-btn admin-btn-primary" data-arrival-next>Revisar chegadas</button><button type="submit" class="admin-btn admin-btn-primary" data-arrival-submit hidden>Confirmar e registrar</button></div></form>';
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),form=$('#career-arrivals-form'),chosen=new Map();
 let team=null,matches=[],nonce='',busy=false,reviewing=false,searchSeq=0,teamSeq=0,searchTimer,teamTimer;
 const message=(text,error=false)=>{const el=$('[data-arrival-message]');el.textContent=text;el.classList.toggle('is-error',error);};
 const current=p=>(p.current||[]).length===1?p.current[0].name:(p.current||[]).length>1?'Vínculos múltiplos':'Sem equipe / F/A';
 const reason=p=>(p.current||[]).length>1?'Tem mais de um vínculo aberto. Corrija antes no cadastro.':team&&(p.current||[]).some(t=>t.id===team.id)?'Já é integrante desta equipe.':'';
 function edit(){
  reviewing=false;nonce=crypto.randomUUID();form.elements.confirm.checked=false;
  $('[data-arrival-edit]').hidden=false;$('[data-arrival-review]').hidden=true;
  $('[data-arrival-next]').hidden=false;$('[data-arrival-back]').hidden=true;$('[data-arrival-submit]').hidden=true;
 }
 function renderSelected(){
  $('[data-arrival-count]').textContent=chosen.size+' pessoa(s) selecionada(s)';
  const host=$('[data-arrival-picked]');host.replaceChildren();
  if(!chosen.size){host.textContent='Ninguém selecionado ainda.';return;}
  for(const p of chosen.values()){
   const row=document.createElement('div');row.className='career-arrival-person';
   const left=document.createElement('div');left.innerHTML='<strong>'+esc(p.name)+'</strong><small>Origem: '+esc(current(p))+'</small>';
   const select=document.createElement('select');select.setAttribute('aria-label','Cargo de '+p.name);
   for(const [id,label] of Object.entries(ROLES)){const opt=document.createElement('option');opt.value=id;opt.textContent=label;select.append(opt);}
   select.value=p.role;select.addEventListener('change',()=>{p.role=select.value;edit();});
   const remove=document.createElement('button');remove.type='button';remove.className='admin-btn admin-btn-ghost';remove.textContent='Remover';
   remove.addEventListener('click',()=>{chosen.delete(p.id);edit();renderSelected();renderResults();});
   row.append(left,select,remove);host.append(row);
  }
 }
 function renderResults(){
  const host=$('[data-arrival-results]');host.replaceChildren();
  if(!matches.length){host.textContent='Nenhuma pessoa encontrada. Digite o nome ou nick.';return;}
  for(const p of matches){
   const row=document.createElement('div');row.className='career-arrival-search-person';
   const left=document.createElement('div');left.innerHTML='<strong>'+esc(p.name)+'</strong><small>'+esc(current(p))+' · '+(p.kind==='staff'?'Comissão':'Jogador')+'</small>';
   const btn=document.createElement('button');btn.type='button';btn.className='admin-btn admin-btn-ghost';
   const issue=reason(p);btn.textContent=chosen.has(p.id)?'Adicionado':issue?'Indisponível':'Adicionar';
   btn.title=issue;btn.disabled=!!issue||chosen.has(p.id)||chosen.size>=30;
   btn.addEventListener('click',()=>{if(chosen.has(p.id)||chosen.size>=30)return;chosen.set(p.id,{...p,role:p.current?.[0]?.role||(p.kind==='staff'?'coach':'player')});edit();renderSelected();renderResults();});
   row.append(left,btn);host.append(row);
  }
 }
 async function findPeople(){
  const query=form.elements.query.value.trim(),id=++searchSeq;
  if(query.length<2){matches=[];$('[data-arrival-results]').textContent='Digite pelo menos 2 caracteres para pesquisar.';return;}
  $('[data-arrival-results]').textContent='Buscando no catálogo...';
  try{const result=await call('search',{query,limit:20});if(id!==searchSeq||!dialog.open)return;matches=result.entries||[];renderResults();}
  catch(e){if(id===searchSeq)message(e.message,true);}
 }
 async function findTeams(){
  const query=form.elements.team.value.trim(),id=++teamSeq;if(query.length<2)return;
  try{const result=await call('teams',{query,limit:20});if(id!==teamSeq||!dialog.open)return;$('#career-arrival-teams').innerHTML=(result.entries||[]).map(t=>'<option value="'+esc(t.name)+'"></option>').join('');}catch(e){if(id===teamSeq)message(e.message,true);}
 }
 async function validate(){
  if(!valid())throw Error('Sua sessão administrativa expirou.');
  if(!form.elements.date.value||form.elements.date.value>day())throw Error('Informe uma data válida de chegada, até hoje.');
  if(!chosen.size||chosen.size>30)throw Error('Selecione de 1 a 30 pessoas.');
  const entry=await call('resolveTeam',{name:form.elements.team.value.trim()});
  if(!entry.team)throw Error('Equipe não encontrada. Cadastre-a na aba Times antes de continuar.');
  team=entry.team;$('[data-arrival-team-note]').textContent='Equipe: '+team.name;
  for(const p of chosen.values()){const problem=reason(p);if(problem)throw Error(p.name+': '+problem);}
  const url=form.elements.sourceUrl.value.trim();if(url&&!/^https:\/\//i.test(url))throw Error('O link da fonte precisa começar com https://.');
 }
 async function preview(){
  if(busy)return;message('');try{
   await validate();edit();reviewing=true;
   $('[data-arrival-edit]').hidden=true;$('[data-arrival-review]').hidden=false;
   $('[data-arrival-next]').hidden=true;$('[data-arrival-back]').hidden=false;$('[data-arrival-submit]').hidden=false;
   const area=$('[data-arrival-preview]');area.replaceChildren();
   const title=document.createElement('strong');title.textContent=chosen.size+' chegada(s) · '+team.name+' · '+form.elements.date.value;
   const detail=document.createElement('p');detail.textContent=form.elements.publishMarket.checked?'Mercado da Bala: 1 card coletivo para todos os selecionados':'Mercado da Bala: 1 card coletivo em rascunho';
   const list=document.createElement('ul');for(const p of chosen.values()){const li=document.createElement('li');li.textContent=p.name+' ('+(ROLES[p.role]||p.role)+') · '+current(p)+' → '+team.name;list.append(li);}
   area.append(title,detail,list);
  }catch(e){message(e.message,true);}
 }
 function lock(value){busy=value;for(const c of form.querySelectorAll('input,select,textarea,button'))c.disabled=value;dialog.querySelector('[data-arrival-close]').disabled=value;}
 async function save(event){
  event.preventDefault();if(!reviewing||busy)return;
  if(!form.elements.confirm.checked){message('Marque a confirmação antes de registrar.',true);return;}
  const data={nonce,teamId:team.id,date:form.elements.date.value,publishMarket:form.elements.publishMarket.checked,source:form.elements.source.value.trim(),sourceUrl:form.elements.sourceUrl.value.trim(),notes:form.elements.notes.value.trim(),members:[...chosen.values()].map(p=>({personId:p.id,revision:p.revision,role:p.role}))};
  lock(true);message('Gravando as chegadas e atualizando o time...');
  try{
   const result=await call('bulkArrivals',data);await onApplied(result);
   const count=result.affected.length,summary=document.querySelector('#career-summary');
   if(summary){summary.replaceChildren(document.createTextNode(count+' chegada(s) em '+result.team.name+'. '));const link=document.createElement('a');link.href=teamHref(result.team.name);link.textContent='Ver time atualizado ↗';summary.append(link);}
   close(true);
  }catch(e){message(e.message+' O pedido não será duplicado ao tentar novamente sem alterar os dados.',true);}
  finally{lock(false);}
 }
 function open(){
  if(!valid()||!canOpen())return;form.reset();form.elements.date.value=day();form.elements.date.max=day();
  chosen.clear();matches=[];team=null;searchSeq++;teamSeq++;clearTimeout(searchTimer);clearTimeout(teamTimer);
  edit();renderSelected();$('[data-arrival-results]').textContent='Digite ao menos 2 caracteres para buscar.';
  $('[data-arrival-team-note]').textContent='Use uma equipe já cadastrada.';message('');
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
 }
 function close(force=false){if(busy&&!force)return;searchSeq++;teamSeq++;clearTimeout(searchTimer);clearTimeout(teamTimer);dialog.close?.();dialog.removeAttribute('open');}
 form.elements.query.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(findPeople,320);});
 form.elements.team.addEventListener('input',()=>{team=null;edit();renderResults();clearTimeout(teamTimer);teamTimer=setTimeout(findTeams,320);});
 for(const k of ['date','source','sourceUrl','notes','publishMarket'])form.elements[k].addEventListener('input',edit);
 $('[data-arrival-clear]').addEventListener('click',()=>{chosen.clear();edit();renderSelected();renderResults();});
 $('[data-arrival-next]').addEventListener('click',preview);
 $('[data-arrival-back]').addEventListener('click',edit);
 $('[data-arrival-close]').addEventListener('click',()=>close());
 $('[data-arrival-cancel]').addEventListener('click',()=>close());
 form.addEventListener('submit',save);
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 return {open,reset:close};
}
