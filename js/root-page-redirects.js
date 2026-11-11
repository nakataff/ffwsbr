/* Compatibility for pages moved out of the old index shell. */
(() => {
  'use strict';
  const season=['tabela','final','mvp','equipes','datas','selecao-da-semana','stats','notas-cff','comparar-1v1'];
  const world={'ffws-global-2026-stats':'/ffws-global-2026/stats/','ffws-global-2026-mvp':'/ffws-global-2026/mvp/'};
  const pages={mercado:'/mercado.html',...world,...Object.fromEntries(season.map(page=>[page,'/ffws-br-s1.html#'+page]))};
  window.CFF_ROOT_PAGES=pages;
  window.cffRootPageUrl=(page,search='')=>Object.hasOwn(pages,page) ? (Object.hasOwn(world,page)?pages[page]+search:pages[page].replace('#',search+'#')) : '';
  function redirect(){
    if(!/^\/(?:index\.html)?$/.test(location.pathname))return;
    const page=location.hash.slice(1),url=window.cffRootPageUrl(page,location.search);
    if(url)location.replace(url);
  }
  redirect();
  window.addEventListener('hashchange',redirect);
})();
