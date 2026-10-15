import {esc,ROLES,STATUSES,periodLabel} from './career-client.mjs?v=20261015-career-directory-v1';

// This editor keeps only the requested team page and explicit selections in memory.
export function initCareerDepartures({call,getSelected,canOpen,onBusy,onSaved}){
 const $=s=>document.querySelector(s),dialog=$('#career-release'),form=$('#career-release-form'),choices=new Map();
 let mode='team',person=null,team=null,page=null,offset=0,request=0,suggestion=0,timer,busy=false,nonce;
 const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['day','month','year'].map(k=>parts.find(p=>p.type===k).value).join('/');};
 const message=text=>$('#career-release-message').textContent=text;
 const ongoing=t=>['active','loan','substitute'].includes(t.status)&&(!t.end?.date||t.end.date>=today().split('/').reverse().join('-').slice(0,t.end.date.length));
 function review(){
  const people=[...choices.values()].filter(p=>p.tenureIds.length),count=people.reduce((n,p)=>n+p.tenureIds.length,0);
  const alone=mode==='person';$('#career-release-count').textContent=alone?`${person.name} ficará Sem equipe / F/A · ${count} vínculo(s) para encerrar`:`${people.length} pessoa(s) · ${count} vínculo(s) selecionado(s)`;
  $('#career-release-names').textContent=people.map(p=>p.name).join(', ');
  $('#career-release-submit').disabled=busy||(!alone&&!people.length)||mode==='team'&&!team;
  $('#career-release-submit').textContent=alone?'Confirmar: deixar F/A':`Confirmar saída de ${people.length} pessoa(s)`;
 }
 function availableEntries(){return mode==='person'?[{personId:person.id,name:person.name,revision:person.revision,kind:person.kind,otherTeams:[],tenures:person.tenures.filter(t=>t.status==='unverified'||ongoing(t))}]:page?.entries||[];}
 function renderPage(){
  const entries=availableEntries();
  $('#career-release-candidates').innerHTML=entries.map(p=>`<article class="career-release-person"><div class="career-release-person-head"><strong>${esc(p.name)}</strong><small>${p.kind==='staff'?'Comissão técnica':'Jogador'}</small></div>${p.otherTeams.length?`<p class="career-import-note">Outro vínculo aberto: ${p.otherTeams.map(esc).join(', ')}. Confira o cadastro individual antes de deixar F/A.</p>`:''}${p.tenures.map(t=>`<label class="career-check career-release-choice"><input type="checkbox" data-release-person="${esc(p.personId)}" data-release-tenure="${esc(t.id)}"${choices.get(p.personId)?.tenureIds.includes(t.id)?' checked':''}${p.otherTeams.length?' disabled':''}><span><strong>${esc(t.teamName)} · ${ROLES[t.role]||esc(t.role)}</strong><small>${STATUSES[t.status]||esc(t.status)} · entrada: ${esc(periodLabel(t.start))}</small>${t.status==='unverified'?'<small class="career-review-warning">A revisar: selecione somente se esta era a passagem vigente.</small>':''}</span></label>`).join('')||'<p class="career-hint">Nenhum vínculo aberto. Você pode marcar a pessoa como F/A sem alterar passagens antigas.</p>'}</article>`).join('')||'<p class="career-hint">Nenhum integrante neste filtro. Se a equipe ainda não foi revisada, inclua as passagens importadas e confira os nomes.</p>';
  $('#career-release-selection-tools').hidden=!entries.length;
  $('#career-release-pagination').hidden=mode==='person'||!page;
  if(page){$('#career-release-page').textContent=`${page.total?page.offset+1:0}–${page.offset+page.entries.length} de ${page.total}`;$('#career-release-previous').disabled=!offset;$('#career-release-next').disabled=!page.hasMore;}
  review();
 }
 function invalidate(){request++;team=null;page=null;offset=0;choices.clear();nonce=crypto.randomUUID();$('#career-release-candidates').innerHTML='<p class="career-hint">Busque os integrantes para conferir a seleção.</p>';$('#career-release-selection-tools').hidden=true;$('#career-release-pagination').hidden=true;message('');review();}
 function open(single){
  if(!canOpen())return;request++;mode=single?'person':'team';person=single?getSelected():null;if(single&&!person?.id)return;
  team=null;page=null;offset=0;choices.clear();form.reset();nonce=crypto.randomUUID();form.elements.date.value=today();message('');$('#career-release-team').hidden=single;
  $('#career-release-title').textContent=single?'Deixar sem equipe / F/A':'Saída em massa por equipe';
  $('#career-release-list-title').textContent=single?'Confira os vínculos que serão encerrados':'Quem vai sair?';
  if(single){choices.set(person.id,{personId:person.id,name:person.name,revision:person.revision,tenureIds:person.tenures.filter(ongoing).map(t=>t.id)});renderPage();}
  else{invalidate();$('#career-release-team-options').innerHTML='';}
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
 }
 async function load(){
  if(busy||mode!=='team')return;const seq=++request,input=$('#career-release-team-input').value.trim(),include=$('#career-release-unverified').checked;
  if(!input){message('Informe a equipe.');return;}
  const uidTeam=team?.id;$('#career-release-submit').disabled=true;message('Buscando somente os integrantes desta equipe…');
  try{const data=await call('departureCandidates',{teamName:input,includeUnverified:include,offset});if(seq!==request||!dialog.open)return;if(uidTeam&&uidTeam!==data.team.id)choices.clear();team=data.team;page=data;renderPage();message('');}
  catch(error){if(seq===request){message(error.message);review();}}
 }
 function changeSelection(input){const p=availableEntries().find(p=>p.personId===input.dataset.releasePerson);if(!p||p.otherTeams.length)return;const old=choices.get(p.personId)||{personId:p.personId,name:p.name,revision:p.revision,tenureIds:[]};if(old.revision!==p.revision){message('O cadastro mudou entre páginas. Limpe a seleção e busque novamente.');return;}const ids=new Set(old.tenureIds);if(input.checked)ids.add(input.dataset.releaseTenure);else ids.delete(input.dataset.releaseTenure);choices.set(p.personId,{...old,tenureIds:[...ids]});nonce=crypto.randomUUID();review();}
 $('#career-release-candidates').addEventListener('change',event=>{const input=event.target.closest('[data-release-tenure]');if(input&&!busy)changeSelection(input);});
 $('#career-release-select-page').addEventListener('click',()=>{if(busy)return;document.querySelectorAll('#career-release-candidates [data-release-tenure]:not(:disabled)').forEach(input=>{input.checked=true;changeSelection(input);});});
 $('#career-release-clear').addEventListener('click',()=>{if(busy)return;choices.clear();nonce=crypto.randomUUID();renderPage();});
 $('#career-release-load').addEventListener('click',()=>{offset=0;load();});
 $('#career-release-previous').addEventListener('click',()=>{offset=Math.max(0,offset-20);load();});
 $('#career-release-next').addEventListener('click',()=>{if(page?.hasMore){offset+=20;load();}});
 $('#career-release-unverified').addEventListener('change',()=>{if(busy)return;invalidate();load();});
 $('#career-release-team-input').addEventListener('input',()=>{
  if(busy)return;invalidate();clearTimeout(timer);const seq=++suggestion,query=$('#career-release-team-input').value;
  timer=setTimeout(async()=>{try{const r=await call('teams',{query});if(seq===suggestion&&dialog.open)$('#career-release-team-options').innerHTML=r.entries.map(t=>`<option value="${esc(t.name)}"></option>`).join('');}catch{}},300);
 });
 form.addEventListener('input',event=>{if(!event.target.matches('[data-release-tenure],#career-release-team-input'))nonce=crypto.randomUUID();});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;const members=[...choices.values()].filter(p=>p.tenureIds.length).map(({personId,revision,tenureIds})=>({personId,revision,tenureIds}));
  if(mode==='team'&&(!team||!members.length)){message('Busque a equipe e selecione as passagens.');return;}
  if(mode==='person'&&(getSelected()?.id!==person.id||getSelected()?.revision!==person.revision)){message('O cadastro mudou. Reabra esta janela.');return;}
  const values=new FormData(form),body={nonce,departure:{date:values.get('date'),edition:values.get('edition'),certainty:values.get('certainty')},reason:values.get('reason'),source:values.get('source'),sourceUrl:values.get('sourceUrl'),...(mode==='person'?{personId:person.id,revision:person.revision,tenureIds:choices.get(person.id)?.tenureIds||[]}:{teamId:team.id,members})};
  busy=true;onBusy(true);const controls=[...form.elements],disabled=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);message('Registrando as saídas em conjunto…');
  try{const result=await call(mode==='person'?'releasePerson':'bulkDeparture',body);dialog.close?.();dialog.removeAttribute('open');request++;await onSaved(result,mode);}
  catch(error){message(error.message+' Se houve falha de conexão, tente novamente sem mudar os dados: o mesmo pedido não é aplicado duas vezes.');}
  finally{busy=false;onBusy(false);controls.forEach((el,i)=>el.disabled=disabled[i]);review();}
 });
 document.querySelectorAll('[data-release-close]').forEach(button=>button.addEventListener('click',()=>{if(!busy){request++;dialog.close?.();dialog.removeAttribute('open');}}));
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else request++;});
 return {openPerson:()=>open(true),openTeam:name=>{open(false);if(typeof name==='string'&&dialog.open){$('#career-release-team-input').value=name;load();}},reset(){request++;suggestion++;clearTimeout(timer);choices.clear();dialog.close?.();dialog.removeAttribute('open');}};
}
