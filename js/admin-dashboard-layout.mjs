const STORAGE='cff_admin_section_v2';
const SECTIONS=[
 ['overview','Visão geral','Atalhos e números para começar o dia.','grid'],
 ['news','Notícias','Escreva, revise e organize as publicações do site.','edit'],
 ['lives','Transmissões','Gerencie a agenda, os canais e os vídeos oficiais.','live'],
 ['titles','Resultados','Cadastre pódios, títulos e destaques dos campeonatos.','trophy'],
 ['analytics','Audiência','Acompanhe os acessos e os dados do Google Analytics.','chart'],
 ['tools','Ferramentas','Encontre os controles da comunidade, conteúdo e campeonatos.','tools']
];
const ICONS={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',edit:'M16 3l5 5-12 12-6 1 1-6L16 3 M13 6l5 5',live:'M8 8a6 6 0 0 0 0 8 M16 8a6 6 0 0 1 0 8 M4 4a12 12 0 0 0 0 16 M20 4a12 12 0 0 1 0 16 M12 11v2',trophy:'M8 3h8v6a4 4 0 0 1-8 0V3 M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 13v6 M8 21h8',chart:'M3 3v18h18 M7 16V9 M12 16V5 M17 16v-4',tools:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',search:'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16 M17 17l4 4'};
const icon=key=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[key]||ICONS.tools}"/></svg>`;
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function fold(form,label,id){
 if(!form)return null;
 const details=document.createElement('details');details.className='admin-editor-disclosure';details.id=id;
 const summary=document.createElement('summary');summary.textContent=label;form.before(details);details.append(summary);
 const body=document.createElement('div');body.className='admin-editor-disclosure-body';details.append(body);body.append(form);
 form.addEventListener('invalid',()=>details.open=true,true);return details;
}
export function mountAdminDashboard(dashboard,{titlesPanel,onSelect=()=>{}}={}){
 if(!dashboard||dashboard.querySelector('.admin-workspace'))return null;
 const find=selector=>dashboard.querySelector(selector),welcome=find('.admin-welcome'),tools=find('.admin-central-tools-panel'),statGrid=find('.admin-stat-grid'),audience=find('.admin-dashboard-grid'),ga=find('.admin-ga-panel'),lives=find('.admin-live-panel'),editor=find('.admin-editor-panel'),management=find('.admin-management-panel');
 if(!welcome||!tools)return null;
 dashboard.classList.add('admin-dashboard-organized');
 welcome.querySelector('h1').textContent='Painel da Central';welcome.querySelector('.admin-muted').textContent='Conteúdo, comunidade e campeonatos em um só lugar.';welcome.querySelector('.admin-eyebrow').textContent='CENTRAL FREE FIRE · ADMIN';
 const workspace=document.createElement('div');workspace.className='admin-workspace';
 const sidebar=document.createElement('aside');sidebar.className='admin-workspace-sidebar';sidebar.innerHTML=`<span class="admin-sidebar-label">ÁREAS DO PAINEL</span><nav class="admin-workspace-nav" role="tablist" aria-label="Áreas do painel" aria-orientation="vertical">${SECTIONS.map(([key,label,,glyph])=>`<button type="button" role="tab" id="admin-area-tab-${key}" class="admin-area-tab" data-admin-tab="${key}" aria-controls="admin-area-${key}" aria-selected="false" tabindex="-1">${icon(glyph)}<span>${label}</span><span class="admin-area-chevron" aria-hidden="true">›</span></button>`).join('')}</nav><div class="admin-sidebar-note"><strong>Precisa de outro controle?</strong><p>Perfis, moedas, presentes e mais estão em Ferramentas.</p><button class="admin-sidebar-link" type="button" data-admin-open="tools">Ver ferramentas <span aria-hidden="true">↗</span></button></div>`;
 const content=document.createElement('div');content.className='admin-workspace-content';content.innerHTML='<div class="admin-area-heading"><div><p class="admin-eyebrow">CENTRAL DE TRABALHO</p><h2 data-admin-area-title></h2><p class="admin-muted" data-admin-area-description></p></div><span class="admin-area-indicator">ÁREA ADMINISTRATIVA</span></div>';
 workspace.append(sidebar,content);welcome.after(workspace);
 const views={};for(const [key,label]of SECTIONS){const view=document.createElement('section');view.id='admin-area-'+key;view.dataset.adminView=key;view.className='cff-admin-view';view.setAttribute('role','tabpanel');view.setAttribute('aria-labelledby','admin-area-tab-'+key);view.hidden=true;views[key]=view;content.append(view);}
 const quick=document.createElement('section');quick.className='admin-panel admin-home-shortcuts';quick.innerHTML='<div class="admin-panel-head"><div><p class="admin-eyebrow">SEUS ACESSOS PRINCIPAIS</p><h2>Comece por aqui</h2></div><button type="button" class="admin-text-link" data-admin-open="tools">Todas as ferramentas <span aria-hidden="true">↗</span></button></div><div class="admin-central-tools-grid" data-admin-quick-links></div>';
 const allTools=[...tools.querySelectorAll('.admin-central-tool')];
 for(const href of ['admin-pontos.html','admin-codiguinhos.html','admin-perfis.html?tab=send','admin-tarefas.html','admin-carreiras.html','admin-camp-ao-vivo.html']){const link=allTools.find(a=>a.getAttribute('href')===href);if(link)quick.querySelector('[data-admin-quick-links]').append(link.cloneNode(true));}
 const actions=document.createElement('section');actions.className='admin-home-actions';actions.innerHTML=`<div><span class="admin-eyebrow">PUBLICAR E PROGRAMAR</span><h3>O que vamos preparar hoje?</h3><p>Abra o editor certo e continue seu trabalho.</p></div><div><button type="button" class="admin-btn admin-btn-primary" data-admin-new="news">${icon('edit')} Nova notícia</button><button type="button" class="admin-btn admin-btn-ghost" data-admin-new="live">${icon('live')} Agendar live</button></div>`;
 views.overview.append(actions,quick);if(statGrid){const summary=document.createElement('section');summary.className='admin-overview-summary';summary.innerHTML='<div class="admin-panel-head"><div><p class="admin-eyebrow">NÚMEROS DO SITE</p><h2>Resumo de atividade</h2></div><button class="admin-text-link" type="button" data-admin-open="analytics">Ver audiência <span aria-hidden="true">↗</span></button></div>';summary.append(statGrid);views.overview.append(summary);}
 [audience,ga].filter(Boolean).forEach(node=>views.analytics.append(node));if(lives)views.lives.append(lives);if(editor)views.news.append(editor);if(management)views.news.append(management);if(titlesPanel)views.titles.append(titlesPanel);views.tools.append(tools);
 // Keep every original node so authentication, editors and save handlers remain attached.
 const newsTabs=document.createElement('div');newsTabs.className='admin-section-switch';newsTabs.setAttribute('role','tablist');newsTabs.setAttribute('aria-label','Área de notícias');newsTabs.innerHTML='<button type="button" role="tab" id="admin-news-list-tab" data-admin-news-mode="list" aria-controls="admin-news-list-panel">Notícias cadastradas</button><button type="button" role="tab" id="admin-news-editor-tab" data-admin-news-mode="editor" aria-controls="admin-news-editor-panel">Escrever notícia</button>';
 const newsAction=document.createElement('button');newsAction.type='button';newsAction.className='admin-btn admin-btn-primary admin-news-create';newsAction.dataset.adminNew='news';newsAction.textContent='+ Nova notícia';
 const newsBar=document.createElement('div');newsBar.className='admin-news-navigation';newsBar.append(newsTabs,newsAction);views.news.prepend(newsBar);
 if(editor){editor.id='admin-news-editor-panel';editor.setAttribute('role','tabpanel');editor.setAttribute('aria-labelledby','admin-news-editor-tab');}if(management){management.id='admin-news-list-panel';management.setAttribute('role','tabpanel');management.setAttribute('aria-labelledby','admin-news-list-tab');}
 function selectNews(mode){const edit=mode==='editor';if(editor)editor.hidden=!edit;if(management)management.hidden=edit;newsTabs.querySelectorAll('button').forEach(b=>{const selected=b.dataset.adminNewsMode===(edit?'editor':'list');b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});}
 selectNews('list');newsTabs.addEventListener('click',event=>{const button=event.target.closest('[data-admin-news-mode]');if(button)selectNews(button.dataset.adminNewsMode);});
 newsTabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const mode=event.key==='Home'?'list':event.key==='End'?'editor':editor?.hidden?'editor':'list';selectNews(mode);newsTabs.querySelector(`[data-admin-news-mode="${mode}"]`).focus();});
 const liveEditor=fold(find('#admin-live-form'),'Cadastrar ou editar uma live','admin-live-editor-disclosure');
 const titleEditor=fold(find('#cff-title-form'),'Adicionar ou editar um resultado','admin-title-editor-disclosure');
 if(lives){const title=find('#live-editor-title');if(title&&liveEditor){const heading=document.createElement('h2');heading.textContent='Agenda de transmissões';title.replaceWith(heading);liveEditor.querySelector('.admin-editor-disclosure-body').prepend(title);}}
 if(ga){const settings=ga.querySelector('.admin-ga-settings');fold(settings,'Configurar conexão com Google Analytics','admin-ga-connection-disclosure');}
 find('#admin-news-search')?.setAttribute('aria-label','Buscar notícias por título, slug ou autor');
 organizeTools(tools);
 function select(key,{focus=false}={}){
  const section=SECTIONS.find(row=>row[0]===key);if(!section)return false;
  for(const [name,view]of Object.entries(views))view.hidden=name!==key;
  sidebar.querySelectorAll('[data-admin-tab]').forEach(button=>{const selected=button.dataset.adminTab===key;button.classList.toggle('is-active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
  content.querySelector('[data-admin-area-title]').textContent=section[1];content.querySelector('[data-admin-area-description]').textContent=section[2];
  try{localStorage.setItem(STORAGE,key);}catch{}
  if(focus)sidebar.querySelector(`[data-admin-tab="${key}"]`).focus();onSelect(key);return true;
 }
 sidebar.addEventListener('keydown',event=>{if(!event.target.closest('[data-admin-tab]')||!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=SECTIONS.findIndex(row=>row[0]===event.target.closest('[data-admin-tab]').dataset.adminTab),next=event.key==='Home'?0:event.key==='End'?SECTIONS.length-1:(index+(['ArrowUp','ArrowLeft'].includes(event.key)?-1:1)+SECTIONS.length)%SECTIONS.length;select(SECTIONS[next][0],{focus:true});});
 dashboard.addEventListener('click',event=>{
  const button=event.target.closest('[data-admin-tab],[data-admin-open],[data-admin-new]');
  if(button?.dataset.adminTab)select(button.dataset.adminTab);else if(button?.dataset.adminOpen)select(button.dataset.adminOpen);
  if(button?.dataset.adminNew==='news'){select('news');selectNews('editor');find('#admin-new-news')?.click();find('#news-title')?.focus();}
  if(button?.dataset.adminNew==='live'){select('lives');if(liveEditor)liveEditor.open=true;find('#admin-new-live')?.click();find('#live-tournament')?.focus();}
 });
 dashboard.addEventListener('click',event=>{
  if(event.target.closest('[data-edit-news],#admin-new-news,#admin-import-local,#admin-import-sheet')){select('news');selectNews('editor');}
  if(event.target.closest('[data-edit-live],[data-duplicate-live],#admin-new-live')){select('lives');if(liveEditor)liveEditor.open=true;}
  if(event.target.closest('[data-title-edit],#cff-title-new')){select('titles');if(titleEditor)titleEditor.open=true;}
 },true);
 let saved;try{saved=localStorage.getItem(STORAGE);}catch{}select(SECTIONS.some(row=>row[0]===saved)?saved:'overview');
 return {select};
}
function organizeTools(panel){
 const links=[...panel.querySelectorAll('.admin-central-tool')],grid=panel.querySelector('.admin-central-tools-grid');if(!grid)return;
 const groups=[['community','Comunidade e recompensas','Perfis, participação, moedas e presentes.',['admin-apoiadores.html','admin-mensagens.html','admin-chat.html','admin-perfis.html?tab=send','admin-perfis.html','admin-pontos.html','admin-codiguinhos.html','admin-stories.html','admin-recompensas.html','admin-palpite.html','admin-sorteio-comunidade.html','admin-sorteador.html']],['content','Conteúdo e produção','Planejamento, publicações e criação de artes.',['admin-tarefas.html','admin-edicao.html']],['championships','Campeonatos e dados','Resultados, estatísticas e códigos de torneios.',['admin-carreiras.html','admin-carreiras.html?sec=teams','admin-camp-ao-vivo.html','admin-dados.html','admin-ranking-anual.html','admin-liquipedia.html']]];
 const search=document.createElement('div');search.className='admin-tool-search';search.innerHTML=`<label for="admin-tool-search">Buscar ferramenta</label><div>${icon('search')}<input id="admin-tool-search" type="search" placeholder="Ex.: presentes, moedas, perfis…" autocomplete="off"><button type="button" data-admin-clear-search aria-label="Limpar busca" hidden>×</button></div>`;
 const filters=document.createElement('div');filters.className='admin-tool-filters';filters.setAttribute('role','group');filters.setAttribute('aria-label','Categorias de ferramentas');
 for(const [key,label]of [['all','Todas'],...groups.map(g=>[g[0],g[1]])]){const button=document.createElement('button');button.type='button';button.dataset.adminToolFilter=key;button.textContent=label;button.setAttribute('aria-pressed',String(key==='all'));filters.append(button);}
 const count=document.createElement('p');count.className='admin-tool-result-count';count.setAttribute('role','status');count.setAttribute('aria-live','polite');
 grid.before(search,filters,count);const sections=[];
 for(const [key,label,description,hrefs]of groups){const section=document.createElement('section');section.className='admin-tool-group';section.dataset.adminToolGroup=key;section.innerHTML=`<div class="admin-tool-group-heading"><div><h3>${label}</h3><p>${description}</p></div><span data-admin-group-count></span></div><div class="admin-central-tools-grid"></div>`;const body=section.querySelector('.admin-central-tools-grid');
  for(const href of hrefs){const link=links.find(a=>a.getAttribute('href')===href);if(link){body.append(link);link.dataset.adminToolKeywords=normalize(link.textContent+' '+label+' '+(href==='admin-codiguinhos.html'?'presentes enviar códigos estoque recompensa':href==='admin-pontos.html'?'moedas carteira roleta loja pedidos presentes diamantes':href==='admin-stories.html'?'instagram aprovar revisão':' '));}}
  grid.before(section);sections.push(section);
 }
 // Keep future shortcuts discoverable even if a new page has not been categorized yet.
 const remaining=links.filter(link=>grid.contains(link));if(remaining.length){const extra=document.createElement('section');extra.className='admin-tool-group';extra.dataset.adminToolGroup='other';extra.innerHTML='<div class="admin-tool-group-heading"><h3>Outros acessos</h3><span data-admin-group-count></span></div>';grid.before(extra);extra.append(grid);sections.push(extra);remaining.forEach(link=>link.dataset.adminToolKeywords=normalize(link.textContent));}else grid.remove();
 const empty=document.createElement('div');empty.className='admin-tools-empty';empty.hidden=true;empty.innerHTML='<strong>Nenhuma ferramenta encontrada</strong><p>Tente outro nome ou veja todas as categorias.</p><button type="button" class="admin-btn admin-btn-ghost" data-admin-reset-tools>Limpar filtros</button>';panel.append(empty);
 let category='all';const input=search.querySelector('input');
 function filter(){const tokens=normalize(input.value).split(/\s+/).filter(Boolean);let total=0;for(const section of sections){let visible=0;for(const link of section.querySelectorAll('.admin-central-tool')){const show=(category==='all'||category===section.dataset.adminToolGroup)&&tokens.every(token=>link.dataset.adminToolKeywords.includes(token));link.hidden=!show;if(show)visible++;}section.hidden=!visible;section.querySelector('[data-admin-group-count]').textContent=visible+' '+(visible===1?'ferramenta':'ferramentas');total+=visible;}count.textContent=total+' '+(total===1?'ferramenta encontrada':'ferramentas encontradas');empty.hidden=total>0;search.querySelector('button').hidden=!input.value;filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.adminToolFilter===category)));}
 input.addEventListener('input',filter);input.addEventListener('keydown',event=>{if(event.key==='Escape'){input.value='';filter();}});filters.addEventListener('click',event=>{const button=event.target.closest('[data-admin-tool-filter]');if(button){category=button.dataset.adminToolFilter;filter();}});search.querySelector('button').addEventListener('click',()=>{input.value='';filter();input.focus();});empty.querySelector('button').addEventListener('click',()=>{category='all';input.value='';filter();input.focus();});filter();
}
