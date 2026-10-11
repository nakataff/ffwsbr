/* One navigation catalogue for the home and standalone public pages. */
(() => {
  'use strict';
  const routes = (prefix, entries) => entries.map(([label, suffix]) => [label, prefix + suffix]);
  const season = [['Classificatória','classificatoria'],['Segunda fase','segunda-fase'],['Final','final'],['Ranking MVP','mvp'],['Equipes','equipes'],['Datas','datas'],['Seleções da season','selecoes'],['Estatísticas gerais','stats'],['Notas CFF','notas'],['Comparar jogadores','comparar']];
  const groups = [
    ['brasil','Torneios Brasil',[
      ['s2','WB 2026 S2',routes('ffws-br-s2-',season)],
      ['s1','WB 2026 S1',[['Classificatória','tabela'],['Final','final'],['Ranking MVP','mvp'],['Equipes','equipes'],['Datas','datas'],['Seleções da season','selecao-da-semana'],['Estatísticas gerais','stats'],['Notas CFF','notas-cff'],['Comparar jogadores','comparar-1v1']]],
      ['laff','LAFF 2026 S1',routes('laff-',season.filter(([,key]) => !['segunda-fase','final','notas','comparar'].includes(key)))],
      ['s25','WB 2025 S2',routes('ffws-br-2025-s2-',season.filter(([,key]) => key !== 'segunda-fase').concat([['Contra Squad','contra-squad']]))]
    ]],
    ['internacional','Torneios internacionais',[
      ['ewc','EWC 2026',routes('ewc-',[['Fase de grupos','grupos'],['Repescagem','repescagem'],['Final','final'],['Ranking MVP','mvp'],['Equipes','equipes'],['Estatísticas gerais','stats']])],
      ['sea','FFWS SEA 2026 S1',[['Visão geral','ffws-sea-2026-s1']]],
      ['latam','FFWS LATAM S1',[['Visão geral','ffws-latam-s1']]]
    ]]
  ];
  const mainLinks = [['Minha conta / Entrar','/conta.html'],['Início','home'],['Mercado da bala','mercado'],['Tier Constructor','/tier-constructor.html'],['Camp ao vivo','/camp-ao-vivo.html'],['WB Manager Beta','/manager.html']];
  const historyLinks = [['Hall da Fama','hall-da-fama'],['Registro detalhado','registro-detalhado'],['Outros torneios','outros-torneios'],['Equipes históricas','/equipes-historicas.html'],['Outras equipes','outras-equipes']];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const href = route => route.startsWith('/') ? route : (window.CFF_SEASON_ROUTES?.pathForPage(route) || '/index.html#' + route);
  const link = ([label,route]) => `<a class="cff-menu-link" href="${esc(href(route))}" data-cff-route="${esc(route)}" ${route==='/conta.html'?'data-account-entry':''}>${esc(label)}</a>`;
  const details = (key,title,body,extra='') => `<details class="cff-menu-group ${extra}" data-cff-group="${key}"><summary>${esc(title)}<span aria-hidden="true">⌄</span></summary><div class="cff-menu-items">${body}</div></details>`;
  const menu = '<div class="cff-menu-label">Principal</div>' + mainLinks.map(link).join('') + groups.map(([key,title,events]) => details(key,title,events.map(([id,name,entries]) => details(id,name,entries.map(link).join(''),'cff-menu-tournament')).join(''))).join('') + details('historico','Histórico',historyLinks.map(link).join('')) + details('contato','Contato',link(['Sobre','sobre'])) + '<div class="cff-menu-label">Sistema</div><button class="cff-menu-refresh" type="button">Atualizar dados</button>';
  const close = () => { window.closeSidebar?.(); document.getElementById('cff-public-menu-close')?.click(); };
  function go(event, route) {
    if(event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || route.startsWith('/')) return;
    if(document.getElementById('main-content') && typeof window.navigate === 'function') {event.preventDefault(); close(); window.navigate(route);}
  }
  function mount(root) {
    if(!root || root.dataset.cffUnifiedMenu) return;
    root.dataset.cffUnifiedMenu='1'; root.classList.add('cff-unified-menu'); root.innerHTML=menu;
    root.addEventListener('click', event => {const a=event.target.closest('a[data-cff-route]'); if(a){go(event,a.dataset.cffRoute);close();} if(event.target.closest('.cff-menu-refresh')){if(typeof window.purgeSiteCache==='function')window.purgeSiteCache();else location.reload();}});
    root.querySelectorAll('.cff-menu-tournament').forEach(group => group.addEventListener('toggle', () => {if(group.open) group.parentElement.querySelectorAll(':scope > .cff-menu-tournament').forEach(other => {if(other!==group)other.open=false;});}));
    setActive(current());
  }
  const current = () => window.CFF_SEASON_ROUTES?.pageFromLocation() || document.querySelector('.page.active')?.id || location.hash.slice(1) || 'home';
  function setActive(page) {
    document.querySelectorAll('.cff-unified-menu').forEach(root => {
      root.querySelectorAll('[data-cff-route]').forEach(a => {
        const route=a.dataset.cffRoute, active=route.startsWith('/') ? location.pathname===route : document.getElementById('main-content') && route===page;
        a.classList.toggle('active',Boolean(active)); if(active){a.setAttribute('aria-current','page'); for(let parent=a.parentElement; parent && parent!==root; parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;}else a.removeAttribute('aria-current');
      });
    });
    const row=document.querySelector('.cff-mobile-return'); if(row)row.hidden=Boolean(document.getElementById('main-content') && page==='home');
    const quick=document.getElementById('cff-mobile-shortcuts'); if(quick){const prefix=page.startsWith('ffws-br-2025-s2-')?'ffws-br-2025-s2-':'ffws-br-s2-';quick.querySelectorAll('[data-cff-shortcut]').forEach(a=>{const route=prefix+a.dataset.cffShortcut;a.dataset.cffRoute=route;a.href=href(route);a.classList.toggle('active',route===page);});}
  }
  function setupMobile() {
    const homeBar=document.querySelector('.nav-mobile-bar'),publicBar=document.querySelector('.cff-public-topbar'),bar=homeBar||publicBar;
    if(!bar)return;
    bar.classList.add('cff-mobile-header');
    const logo=bar.querySelector('.nav-mobile-home-btn,.cff-public-brand');
    if(!logo)return;
    if(homeBar){homeBar.querySelector('.nav-mobile-tabs')?.remove();homeBar.querySelector('.nav-mobile-search-btn')?.classList.remove('cff-search-in-shortcuts');homeBar.insertBefore(logo,homeBar.querySelector('.nav-mobile-right'));}
    let actions=bar.querySelector('.nav-mobile-right,.cff-public-account-host');
    if(!actions){actions=document.createElement('div');actions.className='cff-public-account-host';const search=bar.querySelector('.cff-public-search');if(search)actions.append(search);bar.append(actions);}
    let searchButton=actions.querySelector('.nav-mobile-search-btn,.cff-mobile-search-button');
    if(!searchButton){searchButton=document.createElement('button');searchButton.type='button';searchButton.className='cff-mobile-search-button';searchButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 5 5"></path></svg>';actions.prepend(searchButton);searchButton.addEventListener('click',()=>{const open=!publicBar.classList.contains('cff-mobile-search-open');publicBar.classList.toggle('cff-mobile-search-open',open);searchButton.setAttribute('aria-expanded',String(open));if(open)publicBar.querySelector('#cff-public-search-input')?.focus();});}
    searchButton.classList.remove('cff-search-in-shortcuts');searchButton.setAttribute('aria-label','Buscar no site');
    const brand=document.createElement('div');brand.className='cff-mobile-brand';logo.before(brand);brand.append(logo);
    const toggle=document.createElement('button');toggle.type='button';toggle.className='cff-shortcuts-toggle';toggle.setAttribute('aria-label','Abrir atalhos');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','cff-mobile-shortcuts');toggle.innerHTML='<span aria-hidden="true">⌄</span>';brand.append(toggle);
    const panel=document.createElement('div');panel.id='cff-mobile-shortcuts';panel.className='cff-mobile-shortcuts';panel.hidden=true;
    panel.innerHTML=[['Final','final'],['Stats','stats'],['MVP','mvp'],['Equipes','equipes']].map(([title,route])=>`<a data-cff-shortcut="${route}" href="${href('ffws-br-s2-'+route)}">${title}</a>`).join('');
    (homeBar?.closest('nav[role="navigation"]')||publicBar).append(panel);
    const dismiss=()=>{panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir atalhos');};
    toggle.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fechar atalhos':'Abrir atalhos');});
    panel.addEventListener('click',event=>{const a=event.target.closest('a[data-cff-route]');if(a){go(event,a.dataset.cffRoute);dismiss();}if(event.target.closest('[data-cff-quick-search]')){dismiss();if(homeBar)window.toggleMobileSearch?.();else{publicBar.classList.toggle('cff-mobile-search-open');publicBar.querySelector('#cff-public-search-input')?.focus();}}});
    document.addEventListener('click',event=>{if(!brand.contains(event.target)&&!panel.contains(event.target))dismiss();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(!panel.hidden){dismiss();toggle.focus();}publicBar?.classList.remove('cff-mobile-search-open');if(publicBar)searchButton.setAttribute('aria-expanded','false');}});
    const main=document.querySelector('#main-content,main');if(main){const row=document.createElement('div');row.className='cff-mobile-return';const back=document.createElement('button');back.type='button';back.textContent='← Voltar';back.addEventListener('click',()=>{if(window.cffGoBack)window.cffGoBack();else location.href='/index.html';});row.append(back);if(homeBar)main.prepend(row);else main.before(row);}
  }
  window.CFFNavigation={mount,setActive};
  function boot(){mount(document.querySelector('#sidebar-panel .sidebar-nav'));mount(document.getElementById('cff-public-sidebar-nav'));setupMobile();setActive(current());}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
  window.addEventListener('hashchange',()=>setActive(current()));
  window.addEventListener('cff:pretty-route',()=>setActive(current()));
})();

