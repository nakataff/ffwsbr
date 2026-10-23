(function(){
 'use strict';
 const categories=['Live','Stories','Feed','Carrossel','Vídeo','Template','Outros'];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
 function mount(api){
  const root=document.getElementById('locator-view');if(!root)return;
  const pages=new Map(),details=new Map(),pending=new Map();let visible=false,sequence=0,items=[],next=null,loadedKey='',loadedAt=0,dialog=null,dirty=false,busy=false;
  const alive=()=>window.CFF_TASKS_AUTHORIZED===true&&root.isConnected;
  const button=(action,label,extra='')=>`<button type="button" class="${esc(extra.match(/class="([^"]*)"/)?.[1]||'small-btn')}" data-locator-action="${action}" ${extra.replace(/class="[^"]*"/g,'')}>${esc(label)}</button>`;
  const link=(url,label)=>`<a class="small-btn locator-open" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  const option=(v,selected)=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`;
  root.innerHTML=`<header class="locator-head"><div><p class="project-eyebrow">BIBLIOTECA DE LINKS</p><h2>Localizador</h2><p class="hint">Suas artes prontas, links e legendas em um só lugar.</p></div>${button('new','+ Cadastrar arte','class="primary"')}</header>
   <form class="locator-filters" data-locator-search><label class="field locator-search">Buscar arte<input name="query" type="search" maxlength="160" placeholder="Bak, live, cliente, palavra-chave…"></label><label class="field">Tipo<select name="category"><option value="">Todos os tipos</option>${categories.map(v=>option(v,'')).join('')}</select></label><button type="submit" class="primary">Buscar</button>${button('favorites','☆ Favoritos','aria-pressed="false"')}${button('clear','Limpar')}${button('refresh','↻ Atualizar')}</form>
   <p class="hint locator-status" role="status" aria-live="polite"></p><div class="locator-grid"></div><div class="locator-more">${button('more','Carregar mais','hidden')}</div>`;
  const $=s=>root.querySelector(s),form=$('[data-locator-search]'),status=$('.locator-status'),grid=$('.locator-grid'),more=$('[data-locator-action=more]');
  let favorites=false;
  const filters=()=>({query:form.elements.query.value.trim(),category:form.elements.category.value,favorites});
  const key=()=>JSON.stringify(filters());
  function cacheSet(map,k,value,max){map.delete(k);map.set(k,{value,at:Date.now()});while(map.size>max)map.delete(map.keys().next().value);}
  function cached(map,k){const c=map.get(k);if(c&&Date.now()-c.at<60000)return c.value;map.delete(k);return null;}
  function clearCache(){pages.clear();details.clear();loadedAt=0;}
  async function request(operation,body={}){if(!alive())throw Error('Sua sessão expirou. Entre novamente no painel.');const r=await window.CFF_TASKS_CLOUD.taskRequest({operation,...body});if(!alive())throw Error('Sessão encerrada.');return r;}
  async function dedup(k,run){if(pending.has(k))return pending.get(k);const p=run();pending.set(k,p);try{return await p;}finally{pending.delete(k);}}
  async function detail(id){if(!alive())throw Error('Sua sessão expirou.');const old=cached(details,id);if(old)return old;const r=await dedup('detail:'+id,()=>request('locatorGet',{id}));cacheSet(details,id,r.item,48);return r.item;}
  const date=v=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(v));
  function render(){
   grid.innerHTML=items.map(v=>`<article class="locator-card" data-id="${esc(v.id)}"><div class="locator-card-top"><span class="locator-type">${esc(v.category)}${v.format?' · '+esc(v.format):''}</span>${button('favorite',v.favorite?'★':'☆',`aria-label="${v.favorite?'Remover dos':'Adicionar aos'} favoritos: ${esc(v.name)}" aria-pressed="${v.favorite}"`)}</div><h3>${esc(v.name)}</h3>${v.project?`<p class="locator-project">${esc(v.project)}</p>`:''}<div class="locator-keywords">${v.keywords.map(k=>button('keyword',k,`data-keyword="${esc(k)}"`)).join('')}</div><p class="hint locator-meta">${v.linkCount} link${v.linkCount===1?'':'s'} · ${v.captionCount} legenda${v.captionCount===1?'':'s'} · ${date(v.updatedAt)}</p><div class="locator-card-actions">${link(v.primaryUrl,'Abrir arte')}${button('copy-link','Copiar link')}${v.captionCount?button('copy-caption','Copiar '+v.captionLabel):''}${button('detail','Ver detalhes')}</div></article>`).join('');
   more.hidden=!next;status.textContent=items.length?`${items.length} arte${items.length===1?'':'s'} exibida${items.length===1?'':'s'}${next?' · há mais resultados':''}.`:'Nenhuma arte encontrada. Cadastre a primeira ou ajuste os filtros.';
  }
  async function load(append=false,force=false){
   if(!alive()||!visible)return;const filter=filters(),k=JSON.stringify(filter);if(!append&&!force&&loadedKey===k&&Date.now()-loadedAt<60000){render();return;}
   const cursor=append?next:null;if(append&&!cursor)return;const cacheKey=JSON.stringify([filter,cursor]),token=++sequence;
   if(!append){items=[];next=null;grid.replaceChildren();}more.disabled=true;status.textContent='Buscando artes…';
   try{let r=!force&&cached(pages,cacheKey);if(!r){r=await dedup('list:'+cacheKey,()=>request('locatorList',{...filter,cursor}));cacheSet(pages,cacheKey,r,12);}if(!alive()||token!==sequence)return;
    items=append?[...items,...r.items.filter(v=>!items.some(i=>i.id===v.id))]:r.items;next=r.next;loadedKey=k;loadedAt=Date.now();render();
   }catch(e){if(alive()&&token===sequence){loadedAt=0;status.textContent=e.message+' Use Atualizar para tentar novamente.';}}finally{if(token===sequence){more.disabled=false;more.hidden=!next;}}
  }
  async function copy(value,b){await api.copyCaption(value);if(b?.isConnected){const old=b.textContent;b.textContent='Copiado ✓';setTimeout(()=>{if(b.isConnected)b.textContent=old;},1600);}api.toast('Copiado.');}
  function close(force=false){if(!dialog)return true;if(busy&&!force)return false;if(dirty&&!force&&!window.confirm('Descartar as alterações desta arte?'))return false;dialog.close();dialog.remove();dialog=null;dirty=false;return true;}
  function modal(title){if(!close())return null;dialog=document.createElement('dialog');dialog.className='locator-dialog';dialog.innerHTML=`<div class="dialog-top"><h2>${esc(title)}</h2>${button('close','×','aria-label="Fechar"')}</div><div class="locator-dialog-body"></div>`;document.body.append(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{const b=e.target.closest('[data-locator-action]');if(b?.dataset.locatorAction==='close')close();});dialog.showModal();return dialog.querySelector('.locator-dialog-body');}
  const newId=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():'art-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  function newItem(){return {id:newId(),revision:0,name:'',category:'Live',project:'',format:'',favorite:false,keywords:[],links:[{label:'Arte principal',url:''}],captions:[],notes:''};}
  async function showDetail(id){
   const body=modal('Detalhes da arte');if(!body)return;body.innerHTML='<p class="hint">Carregando…</p>';const current=dialog;
   try{const v=await detail(id);if(!alive()||dialog!==current)return;
    body.innerHTML=`<div class="locator-detail-head"><span class="locator-type">${esc(v.category)}${v.format?' · '+esc(v.format):''}</span><h3>${esc(v.name)}</h3><p class="hint">${esc(v.project)} · Atualizada em ${date(v.updatedAt)}</p></div><div class="locator-detail-links"><h3>Links</h3>${v.links.map((l,i)=>`<div class="locator-detail-row"><div><strong>${esc(l.label)}${i===0?' · Principal':''}</strong><p class="hint">${esc(l.url)}</p></div>${link(l.url,'Abrir')}${button('copy-detail-link','Copiar',`data-index="${i}"`)}</div>`).join('')}${button('copy-all','Copiar todos os links')}</div>${v.captions.length?`<section class="locator-detail-captions"><h3>Copy / Legendas</h3>${v.captions.map((c,i)=>`<div class="locator-caption"><div class="section-head"><strong>${esc(c.label)}</strong>${button('copy-detail-caption','Copiar legenda',`data-index="${i}"`)}</div><textarea rows="4" readonly aria-label="${esc(c.label)}">${esc(c.text)}</textarea></div>`).join('')}</section>`:''}${v.keywords.length?`<p class="hint">Palavras-chave: ${v.keywords.map(esc).join(', ')}</p>`:''}${v.notes?`<section><h3>Observações</h3><p class="locator-notes">${esc(v.notes)}</p></section>`:''}<div class="locator-dialog-footer">${button('edit','Editar')}${button('duplicate','Duplicar')}${button('delete','Excluir','class="small-btn locator-danger"')}</div><p class="hint locator-error" role="status"></p>`;
    body.addEventListener('click',async e=>{const b=e.target.closest('[data-locator-action]');if(!b||busy)return;const action=b.dataset.locatorAction,i=Number(b.dataset.index);try{
     if(action==='edit')edit(v);
     if(action==='duplicate')edit({...structuredClone(v),id:newId(),revision:0,name:(v.name+' (cópia)').slice(0,160)});
     if(action==='copy-detail-link')await copy(v.links[i].url,b);
     if(action==='copy-detail-caption')await copy(v.captions[i].text,b);
     if(action==='copy-all')await copy(v.links.map(l=>l.label+'\n'+l.url).join('\n\n'),b);
     if(action==='delete'&&window.confirm('Excluir “'+v.name+'” do Localizador? Os arquivos originais continuam no serviço onde estão hospedados.')){busy=true;b.disabled=true;try{await request('locatorDelete',{id:v.id,revision:v.revision});close(true);clearCache();await load(false,true);api.toast('Arte excluída.');}finally{busy=false;b.disabled=false;}}
    }catch(error){if(dialog===current)body.querySelector('.locator-error').textContent=error.message;}});
   }catch(e){if(dialog===current)body.textContent=e.message;}
  }
  function edit(value){
   if(!alive())return;
   const body=modal(value.revision?'Editar arte':'Cadastrar arte');if(!body)return;let draft=structuredClone(value);const current=dialog;
   const field=(label,name,value,max,placeholder='')=>`<label class="field">${esc(label)}<input name="${name}" value="${esc(value)}" maxlength="${max}" placeholder="${esc(placeholder)}" ${name==='name'?'required':''}></label>`;
   body.innerHTML=`<form class="locator-editor">${field('Nome da arte','name',draft.name,160,'Live do Bak')}<div class="locator-form-row"><label class="field">Tipo<select name="category">${categories.map(v=>option(v,draft.category)).join('')}</select></label>${field('Cliente / projeto (opcional)','project',draft.project,80,'Bak')}${field('Formato / tamanho (opcional)','format',draft.format,80,'Stories · 1080 × 1920')}</div>${field('Palavras-chave (separe por vírgulas)','keywords',draft.keywords.join(', '),850,'bak, live, youtube')}<p class="hint">Até 20 palavras-chave. Use nomes, temas ou campanhas para encontrar depois.</p><label class="important-option"><input type="checkbox" name="favorite" ${draft.favorite?'checked':''}> ★ Favoritar</label><section><div class="section-head"><h3>Links da arte</h3>${button('add-link','+ Link')}</div><p class="hint">Até 12 links. O primeiro abre direto no card. Canva, Drive, pasta, arquivo ou post publicado.</p><div data-locator-links></div></section><section><div class="section-head"><h3>Copy / Legendas</h3>${button('add-caption','+ Legenda')}</div><p class="hint">Até 8 versões: Instagram, WhatsApp, Stories…</p><div data-locator-captions></div></section><label class="field">Observações (opcional)<textarea name="notes" maxlength="3000" rows="3">${esc(draft.notes)}</textarea></label><p class="locator-error hint" role="status"></p><div class="locator-dialog-footer">${button('close','Cancelar')}<button type="submit" class="primary">Salvar arte</button></div></form>`;
   const f=body.querySelector('form'),links=body.querySelector('[data-locator-links]'),captions=body.querySelector('[data-locator-captions]');
   function sync(){for(const n of ['name','category','project','format','notes'])draft[n]=f.elements[n].value;draft.favorite=f.elements.favorite.checked;draft.keywords=f.elements.keywords.value.split(/[,;\n]/).map(v=>v.trim()).filter(Boolean);draft.links=[...links.children].map(row=>({label:row.querySelector('[data-label]').value,url:row.querySelector('[data-url]').value}));draft.captions=[...captions.children].map(row=>({label:row.querySelector('[data-label]').value,text:row.querySelector('textarea').value}));}
   function renderFields(){links.innerHTML=draft.links.map((l,i)=>`<div class="locator-link-field"><label class="field">${i===0?'Link principal':'Nome do link'}<input data-label value="${esc(l.label)}" maxlength="80" required></label><label class="field">URL<input data-url type="url" value="${esc(l.url)}" maxlength="2048" placeholder="https://…" required></label><div class="locator-field-actions">${i?button('primary-link','Tornar principal',`data-index="${i}"`):'<span class="hint">Principal</span>'}${button('remove-link','Remover',`data-index="${i}" ${draft.links.length===1?'disabled':''}`)}</div></div>`).join('');captions.innerHTML=draft.captions.map((c,i)=>`<div class="locator-caption"><div class="section-head"><label class="field">Nome da legenda<input data-label maxlength="60" value="${esc(c.label)}" required></label>${button('remove-caption','Remover',`data-index="${i}"`)}</div><label class="field">Legenda<textarea maxlength="10000" rows="4">${esc(c.text)}</textarea></label></div>`).join('');body.querySelector('[data-locator-action=add-link]').disabled=draft.links.length>=12;body.querySelector('[data-locator-action=add-caption]').disabled=draft.captions.length>=8;}
   renderFields();f.addEventListener('input',()=>{dirty=true;});f.addEventListener('change',()=>{dirty=true;});
   f.addEventListener('click',e=>{const b=e.target.closest('[data-locator-action]');if(!b||busy)return;const action=b.dataset.locatorAction,i=Number(b.dataset.index);if(!['add-link','remove-link','primary-link','add-caption','remove-caption'].includes(action))return;sync();
    if(action==='add-link'&&draft.links.length<12)draft.links.push({label:'',url:''});
    if(action==='remove-link'&&draft.links.length>1)draft.links.splice(i,1);
    if(action==='primary-link'&&i>0)draft.links.unshift(...draft.links.splice(i,1));
    if(action==='add-caption'&&draft.captions.length<8)draft.captions.push({label:'Instagram',text:''});
    if(action==='remove-caption')draft.captions.splice(i,1);
    dirty=true;renderFields();
   });
   f.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;sync();const error=f.querySelector('.locator-error');error.textContent='';const controls=[...f.querySelectorAll('input,textarea,select,button')].map(el=>[el,el.disabled]);busy=true;controls.forEach(([el])=>{el.disabled=true;});
    try{if(draft.keywords.length>20)throw Error('Use até 20 palavras-chave.');if(draft.links.some(l=>!safeUrl(l.url)))throw Error('Confira os links: use http ou https, sem credenciais.');const r=await request('locatorSave',{item:draft,revision:draft.revision||0});if(dialog!==current)return;cacheSet(details,r.item.id,r.item,48);dirty=false;close(true);clearCache();await load(false,true);api.toast('Arte salva no Localizador.');}
    catch(err){if(dialog===current)error.textContent=err.message;}
    finally{busy=false;controls.forEach(([el,disabled])=>{el.disabled=disabled;});}
   });
  }
  form.addEventListener('submit',e=>{e.preventDefault();load();});form.elements.category.addEventListener('change',()=>load());
  root.addEventListener('click',async e=>{const b=e.target.closest('[data-locator-action]');if(!b||b.disabled)return;const action=b.dataset.locatorAction;
   try{
    if(action==='new')edit(newItem());
    if(action==='more')await load(true);
    if(action==='refresh')await load(false,true);
    if(action==='clear'){form.reset();favorites=false;$('[data-locator-action=favorites]').setAttribute('aria-pressed','false');await load();}
    if(action==='favorites'){favorites=!favorites;b.setAttribute('aria-pressed',String(favorites));await load();}
    if(action==='keyword'){form.elements.query.value=b.dataset.keyword;await load();}
    const card=b.closest('[data-id]'),v=items.find(i=>i.id===card?.dataset.id);if(!v)return;
    if(action==='detail')await showDetail(v.id);
    if(action==='copy-link')await copy(v.primaryUrl,b);
    if(action==='copy-caption'){b.disabled=true;const item=await detail(v.id);await copy(item.captions[0].text,b);}
    if(action==='favorite'){b.disabled=true;const r=await request('locatorFavorite',{id:v.id,revision:v.revision,favorite:!v.favorite});clearCache();cacheSet(details,v.id,r.item,48);await load(false,true);}
   }catch(err){if(alive())api.toast(err.message);}finally{b.disabled=false;}
  });
  window.addEventListener('pagehide',()=>{clearCache();pending.clear();});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  return {setVisible(value){visible=value;if(value)load();},beforeLeave:()=>close()};
 }
 window.CFF_TASKS_LOCATOR={mount,categories};
})();
