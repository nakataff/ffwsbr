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
      ['global26','FFWS Global Finals 2026',routes('ffws-global-2026-',[['Formato','formato'],['Knockout • Fase 1','classificatoria'],['Knockout • Fase 2','segunda-fase'],['Repescagem','last-chance'],['Grande Final','final'],...season.slice(3)])],
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
  const featured = `<a class="cff-menu-link cff-menu-featured" data-cff-featured data-cff-route="ffws-global-2026-formato" href="${esc(href('ffws-global-2026-formato'))}"><img src="/ffws-global-2026/Free_Fire_World_Series_2021_icon_allmode.png" width="30" height="26" alt=""><span><small>EM DESTAQUE</small>FFWS GLOBAL FINALS 2026</span></a>`;
  const menu = '<div class="cff-menu-label">Principal</div>' + mainLinks.map(link).join('') + featured + groups.map(([key,title,events]) => details(key,title,events.map(([id,name,entries]) => details(id,name,entries.map(link).join(''),'cff-menu-tournament')).join(''))).join('') + details('historico','Histórico',historyLinks.map(link).join('')) + details('contato','Contato',link(['Sobre','sobre'])) + '<div class="cff-menu-label">Sistema</div><button class="cff-menu-refresh" type="button">Atualizar dados</button>';
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
  // Um único menu de acesso rápido, exclusivo das páginas públicas no celular.
  function bottomCategory(page) {
    const path=location.pathname.toLowerCase();
    if(path.includes('conta.html')||path.startsWith('/perfil/'))return 'profile';
    if(path.includes('interacoes.html')||path.includes('comunidade.html'))return 'community';
    if(String(page).startsWith('ffws-global-2026-')||path.includes('ffws-global-2026'))return 'worlds';
    if(/(?:stats|mvp|registro|notas|comparar|ranking)/i.test(String(page)))return 'stats';
    return 'home';
  }
  function updateBottomNav(page) {
    if(window.CFFMobileDock){window.CFFMobileDock.refresh(page);return;}
    const root=document.querySelector('.cff-bottom-navigation');if(!root)return;
    const key=bottomCategory(page);
    root.querySelectorAll('a[data-cff-bottom]').forEach(a=>{
      const selected=a.dataset.cffBottom===key;
      a.classList.toggle('is-current',selected);
      if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    });
  }
  function installBottomNav() {
    if(document.querySelector('.cff-bottom-navigation') || /(^|\/)admin(?:[-/.]|$)/i.test(location.pathname))return;
    const links=[
      ['home','Início','home','<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>'],
      ['worlds','Mundial','ffws-global-2026-formato','<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c4 5 4 13 0 18M12 3c-4 5-4 13 0 18"/>'],
      ['stats','Estatísticas','registro-detalhado','<path d="M4 20V11m6 9V5m6 15v-8m4 8H2"/>'],
      ['community','Comunidade','/interacoes.html','<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m12 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 3a4 4 0 0 1 0 8"/>'],
      ['profile','Perfil','/conta.html','<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>']
    ];
    const nav=document.createElement('nav');nav.className='cff-bottom-navigation';nav.setAttribute('aria-label','Navegação rápida');
    nav.innerHTML=links.map(([key,label,route,svg])=>'<a data-cff-bottom="'+key+'" data-cff-bottom-route="'+route+'" href="'+esc(href(route))+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+svg+'</svg><span>'+label+'</span></a>').join('');
    nav.addEventListener('click',event=>{
      const link=event.target.closest('a[data-cff-bottom-route]');
      if(link)go(event,link.dataset.cffBottomRoute);
    });
    document.body.append(nav);
    if(!document.querySelector('script[data-cff-mobile-dock]')){
      const script=document.createElement('script');
      script.src='/js/mobile-dock.js?v=20261020-mobile-custom-v3';
      script.dataset.cffMobileDock='1';
      document.head.append(script);
    }
    updateBottomNav(current());
  }
  function setActive(page) {
    document.querySelectorAll('.cff-unified-menu').forEach(root => {
      root.querySelectorAll('[data-cff-route]').forEach(a => {
        const route=a.dataset.cffRoute, active=route.startsWith('/') ? location.pathname===route : document.getElementById('main-content') && route===page;
        a.classList.toggle('active',Boolean(active)); if(active){a.setAttribute('aria-current','page'); for(let parent=a.parentElement; parent && parent!==root; parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;}else a.removeAttribute('aria-current');
        if(a.hasAttribute('data-cff-featured'))a.classList.toggle('active',Boolean(document.getElementById('main-content') && page.startsWith('ffws-global-2026-')));
      });
    });
    const row=document.querySelector('.cff-mobile-return'); if(row)row.hidden=Boolean(document.getElementById('main-content') && page==='home');
    updateBottomNav(page);
    const quick=document.getElementById('cff-mobile-shortcuts'); if(quick){const prefix=page.startsWith('ffws-global-2026-')?'ffws-global-2026-':page.startsWith('ffws-br-2025-s2-')?'ffws-br-2025-s2-':'ffws-br-s2-';quick.querySelectorAll('[data-cff-shortcut]').forEach(a=>{const route=prefix+a.dataset.cffShortcut;a.dataset.cffRoute=route;a.href=href(route);a.classList.toggle('active',route===page);});}
  }
  function setupMobile() {
    const homeBar=document.querySelector('.nav-mobile-bar'),publicBar=document.querySelector('.cff-public-topbar'),bar=homeBar||publicBar;
    if(!bar)return;
    bar.classList.add('cff-mobile-header');
    const logo=bar.querySelector('.nav-mobile-home-btn,.cff-public-brand');
    if(!logo)return;
    // Logo central fixa, sem seta e sem uma segunda navegação expansível.
    if(homeBar){
      homeBar.querySelector('.nav-mobile-tabs')?.remove();
      homeBar.insertBefore(logo,homeBar.querySelector('.nav-mobile-right'));
    }
    let actions=bar.querySelector('.nav-mobile-right,.cff-public-account-host');
    if(!actions){
      actions=document.createElement('div');actions.className='cff-public-account-host';
      const search=bar.querySelector('.cff-public-search');if(search)actions.append(search);
      bar.append(actions);
    }
    let searchButton=actions.querySelector('.nav-mobile-search-btn,.cff-mobile-search-button');
    if(!searchButton){
      searchButton=document.createElement('button');searchButton.type='button';searchButton.className='cff-mobile-search-button';
      searchButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 5 5"></path></svg>';
      actions.prepend(searchButton);
      searchButton.addEventListener('click',()=>{
        if(!publicBar)return;
        const opened=!publicBar.classList.contains('cff-mobile-search-open');
        publicBar.classList.toggle('cff-mobile-search-open',opened);
        searchButton.setAttribute('aria-expanded',String(opened));
        if(opened)publicBar.querySelector('#cff-public-search-input')?.focus();
      });
    }
    searchButton.classList.remove('cff-search-in-shortcuts');
    searchButton.setAttribute('aria-label','Buscar no site');
    const brand=document.createElement('div');brand.className='cff-mobile-brand';
    logo.before(brand);brand.append(logo);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&publicBar?.classList.contains('cff-mobile-search-open')){
        publicBar.classList.remove('cff-mobile-search-open');
        searchButton.setAttribute('aria-expanded','false');
        searchButton.focus();
      }
    });
    const main=document.querySelector('#main-content,main');
    if(main){
      const row=document.createElement('div');row.className='cff-mobile-return';
      const back=document.createElement('button');back.type='button';back.textContent='← Voltar';
      back.addEventListener('click',()=>{if(window.cffGoBack)window.cffGoBack();else location.href='/index.html';});
      row.append(back);if(homeBar)main.prepend(row);else main.before(row);
    }
  }
  window.CFFNavigation={mount,setActive};
  function boot(){mount(document.querySelector('#sidebar-panel .sidebar-nav'));mount(document.getElementById('cff-public-sidebar-nav'));setupMobile();installBottomNav();setActive(current());}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
  window.addEventListener('hashchange',()=>setActive(current()));
  window.addEventListener('cff:pretty-route',()=>setActive(current()));
})();


