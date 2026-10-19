import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
const API='https://cff-instagram-community.nakataffb4.workers.dev',ADMIN='admin@centralfreefire.com.br',MAX_BATCH=20;
const config=window.CFF_CONFIG?.firebase;if(!config)throw new Error('Configuração indisponível');
const auth=getAuth(getApps().length?getApp():initializeApp(config)),list=document.getElementById('sr-list');
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const rows=new Map(),selected=new Set(),catalogs=new Map(),drafts=new Map();
let status='pending',cursor='',generation=0,busy=false,saving=false,reviewKeys=[],decision='approve',dialogGeneration=0;
const time=v=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(v));
const weekLabel=v=>String(v).split('-').reverse().join('/'),group=item=>item.catalogKey||item.weekStart;
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
 $('#sr-bulk').hidden=status!=='pending';$('#sr-select-visible').disabled=busy||saving||!visible.size;$('#sr-clear-selection').disabled=busy||saving||!selected.size;
 for(const id of ['sr-approve-selected','sr-reject-selected'])$('#'+id).disabled=busy||saving||!selected.size;
 $('#sr-refresh').disabled=busy||saving;$('#sr-more').disabled=busy||saving;$('#sr-more').hidden=!cursor;
 document.querySelectorAll('[data-status]').forEach(button=>button.disabled=busy||saving);
 list.querySelectorAll('[data-review-story]').forEach(button=>button.disabled=busy||saving);
}
function syncWeeks(){const value=$('#sr-week').value,weeks=[...new Set([...rows.values()].map(item=>item.weekStart))].sort().reverse();$('#sr-week').innerHTML='<option value="">Todas as semanas</option>'+weeks.map(week=>`<option value="${esc(week)}">Semana de ${esc(weekLabel(week))}</option>`).join('');if(weeks.includes(value))$('#sr-week').value=value;}
function card(item){
 const el=document.createElement('article');el.className='sr-card';el.dataset.key=item.key;
 el.innerHTML=`<div class="sr-card-head">${item.status==='pending'?`<label class="sr-select"><input type="checkbox" data-select-story aria-label="Selecionar story de @${esc(item.username)}"><span>@${esc(item.username)}</span></label>`:`<h2>@${esc(item.username)}</h2>`}<span class="sr-date">${esc(time(item.eventAt))}</span></div><button type="button" class="sr-preview" data-preview-story aria-label="Ampliar story de @${esc(item.username)}">${item.mediaUrl?`<img src="${esc(item.mediaUrl)}" alt="Story de @${esc(item.username)}" loading="lazy" referrerpolicy="no-referrer">`:'<span>Prévia indisponível. Confira nas conversas do Instagram.</span>'}<span class="sr-preview-hint">Ampliar ↗</span></button><div class="sr-content"><p>Semana de ${esc(weekLabel(item.weekStart))}</p><p><a href="https://www.instagram.com/${encodeURIComponent(item.username)}/" target="_blank" rel="noopener noreferrer">Perfil ↗</a> · <a href="https://www.instagram.com/direct/inbox/" target="_blank" rel="noopener noreferrer">Conversas ↗</a></p>${item.status==='pending'?'<div class="sr-actions"><button class="admin-btn admin-btn-primary" data-review-story="approve">Revisar</button><button class="admin-btn admin-btn-ghost" data-review-story="reject">Rejeitar</button></div><p class="sr-card-message" role="status"></p>':`<span class="sr-status">${item.status==='approved'?'Aprovado · +5 pontos':'Rejeitado · sem pontos'}</span>${item.postUrl?`<p><a href="${esc(item.postUrl)}" target="_blank" rel="noopener noreferrer">Publicação original ↗</a></p><p>Publicação: ${esc(time(item.publishedAt))}</p>`:''}<p>Revisão: ${esc(time(item.reviewedAt))}</p>${item.note?`<p>${esc(item.note)}</p>`:''}`}</div>`;
 el.querySelector('img')?.addEventListener('error',e=>{e.target.replaceWith(Object.assign(document.createElement('span'),{textContent:'A prévia expirou. Confira nas conversas do Instagram.'}));});
 el.querySelector('[data-select-story]')?.addEventListener('change',e=>{if(e.target.checked){const first=rows.get([...selected][0]);if(selected.size>=MAX_BATCH||first&&group(first)!==group(item)){e.target.checked=false;message(selected.size>=MAX_BATCH?'Revise até 20 stories por vez.':'Selecione stories da mesma semana e conta para revisar juntos. Use o filtro de semana.');return;}selected.add(item.key);}else selected.delete(item.key);updateControls();});
 el.querySelectorAll('[data-review-story]').forEach(button=>button.addEventListener('click',()=>openReview(button.dataset.reviewStory,[item.key])));
 el.querySelector('[data-preview-story]').addEventListener('click',()=>{const box=$('#sr-preview-image');box.replaceChildren();$('#sr-preview-title').textContent='@'+item.username+' · '+time(item.eventAt);if(item.mediaUrl){const image=document.createElement('img');image.src=item.mediaUrl;image.alt='Story de @'+item.username;image.referrerPolicy='no-referrer';image.addEventListener('error',()=>{box.textContent='A prévia expirou. Confira a menção nas conversas do Instagram.';});box.append(image);}else box.textContent='Prévia indisponível. Confira nas conversas do Instagram.';$('#sr-preview-dialog').showModal();});
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
async function getCatalog(item){const key=group(item),cached=catalogs.get(key);if(cached&&cached.until>Date.now())return cached.promise;const entry={until:Date.now()+120000};entry.promise=request('/api/admin/story-posts?key='+encodeURIComponent(item.key)).then(data=>{if(!data.available)entry.until=Date.now()+10000;return data;}).catch(error=>{catalogs.delete(key);throw error;});catalogs.set(key,entry);return entry.promise;}
const form=$('#sr-review-form'),review=$('#sr-review-dialog');
function originalFields(){const choice=form.elements.postChoice.value;if(choice)form.elements.postUrl.value=choice;form.querySelector('.sr-manual').hidden=Boolean(choice);}
async function openReview(next,keys){
 if(busy||saving||review.open)return;const items=keys.map(key=>rows.get(key)).filter(item=>item?.status==='pending');if(!items.length)return;
 decision=next;reviewKeys=items.map(item=>item.key);const id=++dialogGeneration,approving=next==='approve',first=items[0];
 form.reset();$('#sr-review-title').textContent=(approving?'Aprovar ':'Rejeitar ')+items.length+' stor'+(items.length===1?'y':'ies');
 $('#sr-review-summary').textContent=approving?'Semana de '+weekLabel(first.weekStart)+' · até '+items.length*5+' pontos no total.':'Os stories selecionados serão rejeitados e não gerarão pontos.';
 $('#sr-review-people').textContent=items.map(item=>'@'+item.username).join(' · ');$('#sr-post-fields').hidden=!approving;$('#sr-reject-reason').hidden=approving;
 $('#sr-confirm-label').textContent=approving?'Conferi todos os stories deste grupo e todos mostram a publicação original escolhida.':'Confirmo a rejeição dos stories deste grupo.';
 $('#sr-review-submit').textContent=(approving?'Aprovar ':'Rejeitar ')+items.length+(items.length===1?' story':' stories');$('#sr-review-submit').className='admin-btn '+(approving?'admin-btn-primary':'admin-btn-danger');$('#sr-review-feedback').textContent='';
 form.elements.postChoice.innerHTML='<option value="">Informar o link manualmente</option>';form.querySelector('.sr-manual').hidden=false;
 const draft=drafts.get(group(first));if(approving&&draft){form.elements.postUrl.value=draft.postUrl;form.elements.publishedAt.value=draft.publishedAt;}
 $('#sr-catalog-message').textContent=approving?'Buscando publicações da semana…':'';review.showModal();
 if(!approving)return;
 try{
  const data=await getCatalog(first);if(id!==dialogGeneration||!review.open)return;
  const cutoff=Math.min(...items.map(item=>Number(item.eventAt)))+300000,posts=(data.weekPosts||data.posts||[]).filter(post=>post.publishedAt<=cutoff);
  form.elements.postChoice.innerHTML='<option value="">Informar o link manualmente</option>'+posts.map(post=>`<option value="${esc(post.url)}">${esc(time(post.publishedAt)+' · '+post.label)}</option>`).join('');
  if(posts.some(post=>post.url===form.elements.postUrl.value))form.elements.postChoice.value=form.elements.postUrl.value;
  originalFields();$('#sr-catalog-message').textContent=posts.length?'Publicações elegíveis para todos os stories selecionados.':'Nenhuma publicação encontrada. Informe o link e confira a data no Instagram.';
 }catch(error){if(id===dialogGeneration&&review.open)$('#sr-catalog-message').textContent=error.message+' Você pode preencher manualmente.';}
}
function closeReview(){if(saving)return;dialogGeneration++;review.close();}
form.elements.postChoice.addEventListener('change',()=>{originalFields();form.elements.confirmSamePost.checked=false;form.elements.confirmDate.checked=false;});
form.elements.postUrl.addEventListener('input',()=>{form.elements.confirmSamePost.checked=false;form.elements.confirmDate.checked=false;});form.elements.publishedAt.addEventListener('input',()=>{form.elements.confirmDate.checked=false;});
form.elements.reason.addEventListener('change',()=>{if(form.elements.reason.value)form.elements.note.value=form.elements.reason.value;});
review.querySelectorAll('[data-close-review]').forEach(button=>button.addEventListener('click',closeReview));review.addEventListener('cancel',e=>{if(saving)e.preventDefault();else dialogGeneration++;});
$('#sr-close-preview').addEventListener('click',()=>$('#sr-preview-dialog').close());
form.addEventListener('submit',async e=>{
 e.preventDefault();if(saving||!isAdmin())return;const approving=decision==='approve',postUrl=form.elements.postUrl.value.trim(),stamp=form.elements.publishedAt.value,feedback=$('#sr-review-feedback');
 if(!form.elements.confirmSamePost.checked){feedback.textContent=approving?'Confira as imagens e marque a confirmação do grupo.':'Marque a confirmação da rejeição.';return;}
 if(approving&&(!postUrl||!form.elements.postChoice.value&&(!stamp||!form.elements.confirmDate.checked))){feedback.textContent='Escolha o post original. No modo manual, informe e confirme a data e a hora.';return;}
 const keys=[...reviewKeys],seq=generation,first=rows.get(keys[0]);if(!keys.length||!first)return;
 if(approving)drafts.set(group(first),{postUrl,publishedAt:stamp});
 const body={keys,decision,postUrl,publishedAt:stamp?stamp+':00-03:00':'',confirmSamePost:true,confirmDate:form.elements.confirmDate.checked,note:form.elements.note.value};
 saving=true;updateControls();for(const field of form.elements)field.disabled=true;feedback.textContent='Salvando '+keys.length+' revisão(ões)…';
 try{
  const data=await request('/api/admin/stories/review-batch',body);if(seq!==generation)return;
  const results=new Map((data.results||[]).map(result=>[result.key,result]));let done=0,awarded=0;
  for(const key of keys){const result=results.get(key),node=[...list.querySelectorAll('[data-key]')].find(el=>el.dataset.key===key);
   if(result?.ok&&result.story?.status!=='pending'){
    done++;if(!result.alreadyReviewed)awarded+=Number(result.points)||0;selected.delete(key);rows.delete(key);node?.remove();
    for(const [state,delta]of [['pending',-1],[result.story.status,1]]){const count=$('#sr-count-'+state);if(count)count.textContent=Math.max(0,Number(count.textContent)+delta);}
   }else{selected.add(key);if(node){const warning=node.querySelector('.sr-card-message');warning.textContent=result?.error||'Resposta incompleta. Tente novamente; não haverá pontuação duplicada.';warning.className='sr-card-message sr-error';}}
  }
  if(!rows.size)list.innerHTML='<p class="sr-empty">Nenhum story neste filtro. Use Carregar mais se houver outra página.</p>';
  syncWeeks();message(done+' revisão(ões) concluída(s)'+(awarded?' · +'+awarded+' pontos':'')+'.'+(done<keys.length?' '+(keys.length-done)+' continuam selecionados; confira o motivo em cada card.':'')+(data.refreshPending?' A atualização do ranking está pendente; as aprovações foram salvas.':''),done===keys.length);
  dialogGeneration++;review.close();
 }catch(error){if(seq===generation)feedback.textContent=error.message+' Você pode tentar novamente; as aprovações já salvas não serão duplicadas.';}
 finally{saving=false;for(const field of form.elements)field.disabled=false;updateControls();}
});
for(const id of ['sr-search','sr-week'])$('#'+id).addEventListener(id==='sr-search'?'input':'change',()=>{selected.clear();updateControls();});
$('#sr-select-visible').addEventListener('click',()=>{const items=visibleItems(),first=rows.get([...selected][0])||items[0];if(!first)return;for(const item of items)if(selected.size<MAX_BATCH&&group(item)===group(first))selected.add(item.key);updateControls();message('Selecionados '+selected.size+' stories da semana de '+weekLabel(first.weekStart)+'. Confira as imagens antes de aprovar.',true);});
$('#sr-clear-selection').addEventListener('click',()=>{selected.clear();updateControls();});
$('#sr-approve-selected').addEventListener('click',()=>openReview('approve',[...selected]));$('#sr-reject-selected').addEventListener('click',()=>openReview('reject',[...selected]));
document.querySelectorAll('[data-status]').forEach(button=>button.addEventListener('click',()=>{if(busy||saving)return;status=button.dataset.status;selected.clear();rows.clear();list.replaceChildren();cursor='';$('#sr-search').value='';$('#sr-week').value='';document.querySelectorAll('[data-status]').forEach(b=>{b.setAttribute('aria-pressed',String(b===button));b.classList.toggle('admin-btn-primary',b===button);});load(false);}));
$('#sr-refresh').addEventListener('click',()=>load(false));$('#sr-more').addEventListener('click',()=>{if(!busy)load(true);});
onAuthStateChanged(auth,user=>{if(!user||String(user.email||'').toLowerCase()!==ADMIN){generation++;dialogGeneration++;rows.clear();selected.clear();drafts.clear();catalogs.clear();busy=false;list.replaceChildren();review.close();form.reset();$('#sr-review-people').textContent='';$('#sr-preview-dialog').close();$('#sr-preview-image').replaceChildren();$('#story-app').hidden=true;$('#story-auth').hidden=false;location.replace('admin.html');return;}$('#story-auth').hidden=true;$('#story-app').hidden=false;load(false);});
