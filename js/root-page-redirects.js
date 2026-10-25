/* Compatibility for pages moved out of the old index shell. */
(() => {
  'use strict';
  const pages={mercado:'/mercado.html'};
  window.CFF_ROOT_PAGES=pages;
  window.cffRootPageUrl=page=>pages[String(page||'')]||'';
  function redirect(){
    if(!/^\/(?:index\.html)?$/.test(location.pathname))return;
    const page=location.hash.slice(1),url=pages[page];
    if(url)location.replace(url);
  }
  redirect();
  window.addEventListener('hashchange',redirect);
})();
