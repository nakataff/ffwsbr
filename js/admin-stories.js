import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
const API='https://cff-instagram-community.nakataffb4.workers.dev',ADMIN='admin@centralfreefire.com.br',MAX_BATCH=20;
const config=window.CFF_CONFIG?.firebase;if(!config)throw new Error('Configuração indisponível');
const auth=getAuth(getApps().length?getApp():initializeApp(config)),list=document.getElementById('sr-list');
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const rows=new Map(),selected=new Set();
let status='approved',cursor='',generation=0,busy=false,saving=false,reviewKeys=[],decision='approve';
const time=v=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(v));
const weekLabel=v=>String(v).split('-').reverse().join('/');
const message=(text,ok=false)=>{$('#sr-message').textContent=text;$('#sr-message').className='admin-message sr-message '+(ok?'sr-success':'sr-error');};
const isAdmin=()=>auth.currentUser&&String(auth.currentUser.email||'').toLowerCase()===ADMIN;
async function request(path,body){
 if(!isAdmin())throw Error('Sua sessão administrativa terminou. Entre novamente.');
 const uid=auth.currentUser.uid,token=await auth.currentUser.getIdToken();if(!isAdmin()||auth.currentUser.uid!==uid)throw Error('Sua sessão mudou.');
 const r=await fetch(API+path,{method:body?'POST':'GET',cache:'no-store',signal:AbortSignal.timeout(body?90000:25000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 let data={};try{data=await r.json();}catch{}
 if(!isAdmin()||auth.currentUser.uid!==uid)throw Error('Sua sessão mudou.');
 if(!r.ok)throw Error(data.error||'Não foi possível concluir. Atualize e tente novamente.');return data;
}
function visibleItems(){const query=$('#sr-search').value.trim().replace(/^@/,'').toLowerCase(),week=$('#sr-week').value;return [...rows.values()].filter(item=>(!query||item.username.toLowerCase().includes(query))&&(!week||item.weekStart===week));}
function updateControls(){
 const visible=new Set(visibleItems().map(item=>item.key));
 for(const card of list.querySelectorAll('[data-key]')){card.hidden=!visible.has(card.dataset.key);card.classList.toggle('is-selected',selected.has(card.dataset.key));const checkbox=card.querySelector('[data-select-story]');if(checkbox){checkbox.checked=selected.has(card.dataset.key);checkbox.disabled=busy||saving;}}
 $('#sr-loaded').textContent=visible.size+' de '+rows.size+' carregados';$('#sr-selected-count').textContent=selected.size?selected.size+' selecionado'+(selected.size>1?'s':''):'Nenhum selecionado';
 $('#sr-bulk').hidden=status==='rejected';$('#sr-approve-selected').hidden=status!=='pending';$('#sr-select-visible').disabled=busy||saving||!visible.size;$('#sr-clear-selection').disabled=busy||saving||!selected.size;
 for(const id of ['sr-approve-selected','sr-reject-selected'])$('#'+id).disabled=busy||saving||!selected.size;
 $('#sr-refresh').disabled=busy||saving;$('#sr-more').disabled=busy||saving;$('#sr-more').hidden=!cursor;
 document.querySelectorAll('[data-status]').forEach(button=>button.disabled=busy||saving);
 list.querySelectorAll('[data-review-story]').forEach(button=>button.disabled=busy||saving);
}
function syncWeeks(){const value=$('#sr-week').value,weeks=[...new Set([...rows.values()].map(item=>item.weekStart))].sort().reverse();$('#sr-week').innerHTML='<option value="">Todas as semanas</option>'+weeks.map(week=>`<option value="${esc(week)}">Semana de ${esc(weekLabel(week))}</option>`).join('');if(weeks.includes(value))$('#sr-week').value=value;}
function card(item){
 const previewSrc=item.previewUrl?API+item.previewUrl:item.mediaUrl;
 const el=document.createElement('article');el.className='sr-card';el.dataset.key=item.key;
 el.innerHTML=`<div class="sr-card-head">${item.status!=='rejected'?`<label class="sr-select"><input type="checkbox" data-select-story aria-label="Selecionar story de @${esc(item.username)}"><span>@${esc(item.username)}</span></label>`:`<h2>@${esc(item.username)}</h2>`}<span class="sr-date">${esc(time(item.eventAt))}</span></div><button type="button" class="sr-preview" data-preview-story aria-label="Ampliar story de @${esc(item.username)}">${previewSrc?`<img src="${esc(previewSrc)}" alt="Story de @${esc(item.username)}" loading="lazy" referrerpolicy="no-referrer">`:'<span>Prévia indisponível. Confira nas conversas do Instagram.</span>'}<span class="sr-preview-hint">Ampliar ↗</span></button><div class="sr-content"><p>Semana de ${esc(weekLabel(item.weekStart))}${item.previewArchived?'<span class="sr-saved-preview"> · Miniatura temporária salva</span>':''}</p><p><a href="https://www.instagram.com/${encodeURIComponent(item.username)}/" target="_blank" rel="noopener noreferrer">Perfil ↗</a> · <a href="https://www.instagram.com/direct/inbox/" target="_blank" rel="noopener noreferrer">Conversas ↗</a></p><span class="sr-status">${item.status==='approved'?(item.verification==='auto'?'Aprovado automaticamente · +5 pontos':'Aprovado · +5 pontos'):item.status==='rejected'?'Rejeitado · sem pontos':'Pendente · sem pontos'}</span>${item.status!=='rejected'?`<div class="sr-actions">${item.status==='pending'?'<button class="admin-btn admin-btn-primary" data-review-story="approve">Aprovar</button>':''}<button class="admin-btn admin-btn-danger" data-review-story="reject">Rejeitar</button></div>`:''}${item.postUrl?`<p><a href="${esc(item.postUrl)}" target="_blank" rel="noopener noreferrer">Publicação original ↗</a></p>`:''}${item.reviewedAt?`<p>Revisão: ${esc(time(item.reviewedAt))}</p>`:''}${item.note?`<p>${esc(item.note)}</p>`:''}<p class="sr-card-message" role="status"></p></div>`;
 el.querySelector('img')?.addEventListener('error',e=>{e.target.replaceWith(Object.assign(document.createElement('span'),{textContent:'A prévia expirou. Confira nas conversas do Instagram.'}));});
 el.querySelector('[data-select-story]')?.addEventListener('change',e=>{if(e.target.checked){if(selected.size>=MAX_BATCH){e.target.checked=false;message('Revise até 20 stories por vez.');return;}selected.add(item.key);}else selected.delete(item.key);updateControls();});
 el.querySelectorAll('[data-review-story]').forEach(button=>button.addEventListener('click',()=>openReview(button.dataset.reviewStory,[item.key])));
 el.querySelector('[data-preview-story]').addEventListener('click',()=>{const box=$('#sr-preview-image');box.replaceChildren();$('#sr-preview-title').textContent='@'+item.username+' · '+time(item.eventAt);if(previewSrc){const image=document.createElement('img');image.src=previewSrc;image.alt='Story de @'+item.username;image.referrerPolicy='no-referrer';image.addEventListener('error',()=>{box.textContent='A prévia expirou. Confira a menção nas conversas do Instagram.';});box.append(image);}else box.textContent='Prévia indisponível. Confira nas conversas do Instagram.';$('#sr-preview-dialog').showModal();});
 return el;
}
async function load(append=false){
 if(saving||busy)return;const id=++generation,before=append?cursor:'';busy=true;updateControls();if(!append&&!rows.size)list.innerHTML='<p class="sr-empty">Carregando revisões...</p>';
 try{
  const data=await request(`/api/admin/stories?status=${status}${before?'&cursor='+encodeURIComponent(before):''}`);if(id!==generation)return;
  if(!append){rows.clear();selected.clear();list.replaceChildren();}else list.querySelector('.sr-empty')?.remove();
  for(const item of data.stories||[])if(!rows.has(item.key)){rows.set(item.key,item);list.append(card(item));}
  if(!rows.size)list.innerHTML='<p class="sr-empty">Nenhum story neste filtro.</p>';
  cursor=data.cursor||'';for(const state of ['pending','approved','rejected'])$('#sr-count-'+state).textContent=Number(data.counts?.[state]||0);syncWeeks();
 }catch(error){if(id===generation){message(error.message);if(!rows.size)list.innerHTML='<p class="sr-empty">Não foi possível carregar. Use Atualizar para tentar novamente.</p>';}}
 finally{if(id===generation){busy=false;updateControls();}}
}
const form=$('#sr-review-form'),review=$('#sr-review-dialog');
function openReview(next,keys){
 if(busy||saving||review.open)return;const items=keys.map(key=>rows.get(key)).filter(item=>item&&item.status!=='rejected'&&(next==='reject'||item.status==='pending'));if(!items.length)return;
 decision=next;reviewKeys=items.map(item=>item.key);const approving=next==='approve';
 form.reset();$('#sr-review-title').textContent=(approving?'Aprovar ':'Rejeitar ')+items.length+(items.length===1?' story':' stories');
 $('#sr-review-summary').textContent=approving?'Cada story aprovado vale 5 pontos, respeitando o limite de 3 por pessoa por dia.':'Os pontos dos stories já aprovados serão retirados. Os bônus que dependem deles também serão recalculados.';
 $('#sr-review-people').textContent=items.map(item=>'@'+item.username).join(' · ');$('#sr-reject-reason').hidden=approving;
 $('#sr-confirm-label').textContent=approving?'Conferi os stories selecionados e confirmo a aprovação.':'Confirmo a rejeição e a retirada dos pontos correspondentes.';
 $('#sr-review-submit').textContent=(approving?'Aprovar ':'Rejeitar ')+items.length+(items.length===1?' story':' stories');$('#sr-review-submit').className='admin-btn '+(approving?'admin-btn-primary':'admin-btn-danger');$('#sr-review-feedback').textContent='';review.showModal();
}
function closeReview(){if(!saving)review.close();}
form.elements.reason.addEventListener('change',()=>{if(form.elements.reason.value)form.elements.note.value=form.elements.reason.value;});
review.querySelectorAll('[data-close-review]').forEach(button=>button.addEventListener('click',closeReview));review.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
$('#sr-close-preview').addEventListener('click',()=>$('#sr-preview-dialog').close());
form.addEventListener('submit',async e=>{
 e.preventDefault();if(saving||!isAdmin())return;const approving=decision==='approve',feedback=$('#sr-review-feedback');
 if(!form.elements.confirmSamePost.checked){feedback.textContent=approving?'Confira as imagens e marque a confirmação do grupo.':'Marque a confirmação da rejeição.';return;}
 const keys=[...reviewKeys],seq=generation;if(!keys.length)return;
 const body={keys,decision,auto:approving,confirmSamePost:true,note:form.elements.note.value};
 saving=true;updateControls();for(const field of form.elements)field.disabled=true;feedback.textContent='Salvando '+keys.length+' revisão(ões)…';
 try{
  const data=await request('/api/admin/stories/review-batch',body);if(seq!==generation)return;
  const results=new Map((data.results||[]).map(result=>[result.key,result]));let done=0,awarded=0,reversed=0;
  for(const key of keys){const result=results.get(key),node=[...list.querySelectorAll('[data-key]')].find(el=>el.dataset.key===key);
   if(result?.ok&&result.story?.status!=='pending'){
    done++;const previous=rows.get(key)?.status;if(!result.alreadyReviewed){awarded+=Number(result.points)||0;if(result.reversed)reversed+=5;}selected.delete(key);rows.delete(key);node?.remove();
    for(const [state,delta]of previous!==result.story.status?[[previous,-1],[result.story.status,1]]:[]){const count=$('#sr-count-'+state);if(count)count.textContent=Math.max(0,Number(count.textContent)+delta);}
   }else{selected.add(key);if(node){const warning=node.querySelector('.sr-card-message');warning.textContent=result?.error||'Resposta incompleta. Tente novamente; não haverá pontuação duplicada.';warning.className='sr-card-message sr-error';}}
  }
  if(!rows.size)list.innerHTML='<p class="sr-empty">Nenhum story neste filtro. Use Carregar mais se houver outra página.</p>';
  syncWeeks();message(done+' revisão(ões) concluída(s)'+(awarded?' · +'+awarded+' pontos':'')+(reversed?' · '+reversed+' pontos de stories retirados':'')+'.'+(done<keys.length?' '+(keys.length-done)+' continuam selecionados; confira o motivo em cada card.':'')+(data.refreshPending?' A atualização do ranking está pendente; as aprovações foram salvas.':''),done===keys.length);
  review.close();
 }catch(error){if(seq===generation)feedback.textContent=error.message+' Você pode tentar novamente; as aprovações já salvas não serão duplicadas.';}
 finally{saving=false;for(const field of form.elements)field.disabled=false;updateControls();}
});
for(const id of ['sr-search','sr-week'])$('#'+id).addEventListener(id==='sr-search'?'input':'change',()=>{selected.clear();updateControls();});
$('#sr-select-visible').addEventListener('click',()=>{for(const item of visibleItems())if(selected.size<MAX_BATCH&&item.status!=='rejected')selected.add(item.key);updateControls();message(selected.size+' stories selecionados.',true);});
$('#sr-clear-selection').addEventListener('click',()=>{selected.clear();updateControls();});
$('#sr-approve-selected').addEventListener('click',()=>openReview('approve',[...selected]));$('#sr-reject-selected').addEventListener('click',()=>openReview('reject',[...selected]));
document.querySelectorAll('[data-status]').forEach(button=>button.addEventListener('click',()=>{if(busy||saving)return;status=button.dataset.status;selected.clear();rows.clear();list.replaceChildren();cursor='';$('#sr-search').value='';$('#sr-week').value='';document.querySelectorAll('[data-status]').forEach(b=>{b.setAttribute('aria-pressed',String(b===button));b.classList.toggle('admin-btn-primary',b===button);});load(false);}));
$('#sr-refresh').addEventListener('click',()=>load(false));$('#sr-more').addEventListener('click',()=>{if(!busy)load(true);});
onAuthStateChanged(auth,user=>{if(!user||String(user.email||'').toLowerCase()!==ADMIN){generation++;rows.clear();selected.clear();busy=false;list.replaceChildren();review.close();form.reset();$('#sr-review-people').textContent='';$('#sr-preview-dialog').close();$('#sr-preview-image').replaceChildren();$('#story-app').hidden=true;$('#story-auth').hidden=false;location.replace('admin.html');return;}$('#story-auth').hidden=true;$('#story-app').hidden=false;load(false);});
