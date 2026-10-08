const paneMemory=new Map();
const button=(label,attrs='')=>`<button type="button" class="cff-account-button" ${attrs}>${label}</button>`;
export function organizeMemberPanel(host,uid=''){
 const identity=host.firstElementChild,owner=identity?.nextElementSibling;
 const images=host.querySelector('[data-member-pane="images"]'),rewards=host.querySelector('[data-member-pane="rewards"]'),administration=host.querySelector('[data-member-pane="admin"]');
 if(!identity||!images||!rewards||!administration)return host;
 const rewardNodes=[];for(let node=owner.nextSibling;node&&node!==images;node=node.nextSibling)rewardNodes.push(node);
 rewardNodes.forEach(node=>rewards.append(node));
 administration.append(owner);identity.classList.add('cff-admin-member-header');
 const code=identity.querySelector('code');if(code){const details=document.createElement('details');details.innerHTML='<summary>Identificador da conta</summary>';details.append(code);administration.append(details);}
 identity.insertAdjacentHTML('beforeend',button('Atualizar conta','data-refresh-member')+'<button type="button" class="cff-account-button cff-admin-mobile-back" data-member-back>← Voltar à lista</button>');
 const profile=document.createElement('section');profile.className='cff-profile-panel';profile.dataset.memberPane='profile';
 const editor=document.createElement('div');profile.append(editor);
 const nav=document.createElement('nav');nav.className='cff-admin-member-tabs';nav.setAttribute('aria-label','Ações da pessoa');nav.innerHTML=[['profile','Perfil'],['images','Imagens'],['rewards','Insígnias e presentes'],['admin','Administração']].map(([id,label])=>button(label,`data-member-tab="${id}"`)).join('');
 identity.after(nav,profile);
 const select=id=>{host.querySelectorAll('[data-member-pane]').forEach(p=>p.hidden=p.dataset.memberPane!==id);nav.querySelectorAll('button').forEach(b=>{const active=b.dataset.memberTab===id;b.classList.toggle('primary',active);b.setAttribute('aria-pressed',String(active));});paneMemory.set(uid,id);};
 nav.addEventListener('click',e=>{const b=e.target.closest('[data-member-tab]');if(b)select(b.dataset.memberTab);});select(paneMemory.get(uid)||'profile');
 const observer=new MutationObserver(()=>{const d=editor.querySelector('details');if(d){d.open=true;observer.disconnect();}});observer.observe(editor,{childList:true});
 const view=host.closest('[data-admin-profile-view]');view?.classList.add('is-member-open');
 host.querySelector('[data-member-back]')?.addEventListener('click',()=>view?.classList.remove('is-member-open'));
 return editor;
}
export function setupAdminLayout({onRefreshCatalog,onNewImage,onRefreshMember,onCopy}){
 const $=id=>document.getElementById(id),catalogView=document.querySelector('[data-admin-profile-view="catalog"]');
 const defaults=catalogView.querySelector('.cff-admin-profile-defaults');defaults.dataset.adminProfileView='defaults';defaults.hidden=true;catalogView.before(defaults);
 const tabs=document.querySelector('.cff-account-tabs');tabs.insertAdjacentHTML('beforeend',button('Padrões globais','data-admin-profile-tab="defaults"'));
 const members=document.querySelector('[data-admin-profile-view="members"]');members.classList.add('cff-admin-members-view');
 const columns=members.querySelector('.cff-admin-profile-columns'),sidebar=columns.firstElementChild;columns.classList.add('cff-admin-members-layout');sidebar.classList.add('cff-admin-members-sidebar');
 const tools=members.querySelector('.cff-gallery-tools');sidebar.prepend(tools);const count=$('profile-member-count');tools.after(count);
 const search=$('profile-member-search');search.setAttribute('aria-label','Buscar pessoa por nome, Instagram ou link');
 const direct=document.createElement('details');direct.className='cff-admin-direct-search';direct.innerHTML='<summary>Abrir por link ou código</summary>';const directFields=document.createElement('div');directFields.className='cff-account-actions';directFields.append($('profile-member-uid'),$('profile-member-find'));direct.append(directFields);tools.append(direct);
 const catColumns=catalogView.querySelector('.cff-admin-profile-columns');catColumns.classList.add('cff-admin-catalog-layout');
 const form=$('profile-catalog-form'),formPanel=form.parentElement;const details=document.createElement('details');details.className='cff-admin-catalog-editor';details.innerHTML='<summary>Formulário da imagem</summary>';form.before(details);details.append(form);
 const catalogue=$('profile-catalog-list');catalogue.classList.add('cff-admin-catalog-grid');const filters=document.createElement('div');filters.className='cff-admin-catalog-filters';filters.innerHTML='<input type="search" aria-label="Buscar imagem" placeholder="Buscar imagem…"><select aria-label="Filtrar tipo"><option value="">Todos os tipos</option><option>Avatar</option><option>Capa</option><option>Insígnia</option></select><select aria-label="Filtrar disponibilidade"><option value="">Toda disponibilidade</option><option>Liberação manual</option><option>Campeão semanal</option><option>Melhor do mês</option><option>Via código</option><option>Disponível para todos</option><option>Somente administradores</option></select>';
 catalogue.before(filters);const empty=document.createElement('p');empty.className='cff-profile-muted';empty.textContent='Nenhuma imagem corresponde aos filtros.';empty.hidden=true;catalogue.after(empty);
 const filter=()=>{const [input,type,access]=filters.querySelectorAll('input,select');let count=0;catalogue.querySelectorAll('article').forEach(row=>{const text=row.textContent.toLocaleLowerCase('pt-BR');row.hidden=![input.value,type.value,access.value].every(value=>!value||text.includes(value.toLocaleLowerCase('pt-BR')));if(!row.hidden)count++;});empty.hidden=count>0||!catalogue.querySelector('article');};filters.addEventListener('input',filter);filters.addEventListener('change',filter);new MutationObserver(filter).observe(catalogue,{childList:true});
 const catHead=catalogue.parentElement.querySelector('.cff-profile-panel-head');catHead.insertAdjacentHTML('beforeend',button('+ Cadastrar imagem','data-new-image'));
 for(const tab of ['codes','champions']){const view=document.querySelector(`[data-admin-profile-view="${tab}"]`),panel=view.querySelector('.cff-profile-panel'),f=panel.querySelector('form'),list=panel.querySelector(tab==='codes'?'#profile-code-list':'#profile-monthly-list');const layout=document.createElement('div');layout.className='cff-admin-settings-layout';f.before(layout);const left=document.createElement('section'),right=document.createElement('section');left.className=right.className='cff-admin-settings-card';layout.append(left,right);left.append(f);right.innerHTML=`<h3>${tab==='codes'?'Códigos cadastrados':'Histórico de campeões'}</h3>`;right.append(list);const status=panel.querySelector('[role=status]');if(status)left.append(status);}
 document.addEventListener('click',async e=>{try{if(e.target.closest('[data-edit-catalog]'))details.open=true;if(e.target.closest('[data-new-image]')){onNewImage();details.open=true;formPanel.scrollIntoView({behavior:'smooth',block:'start'});}if(e.target.closest('[data-refresh-member]'))await onRefreshMember();if(e.target.closest('[data-admin-profile-tab="members"]'))await onRefreshCatalog();const copy=e.target.closest('[data-copy-code]');if(copy){await navigator.clipboard.writeText(copy.dataset.copyCode);onCopy();}}catch(error){const status=$('profile-admin-toast');status.textContent=error.message||'Não foi possível concluir.';status.hidden=false;}});
}
