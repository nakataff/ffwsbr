(()=>{
  'use strict';
  // A edição (WB, Mundial, etc.) é configurada no data-home-rankings-event da home.
  // Sem consultas novas: este controle só recolhe ou expande os rankings existentes.
  function init(){
    const rail=document.querySelector('#home .home-left-rail');
    const toggle=document.getElementById('home-rankings-mobile-toggle');
    if(!rail||!toggle)return;

    const name=String(rail.dataset.homeRankingsEvent||'Torneio').trim();
    const title=toggle.querySelector('[data-home-rankings-title]');
    const action=toggle.querySelector('[data-home-rankings-action]');
    if(title)title.textContent='RANKINGS • '+name;

    const update=expanded=>{
      rail.classList.toggle('is-rankings-expanded',expanded);
      toggle.setAttribute('aria-expanded',String(expanded));
      if(action)action.textContent=expanded?'OCULTAR RANKINGS':'VER RANKINGS';
    };

    update(false);
    toggle.addEventListener('click',()=>update(toggle.getAttribute('aria-expanded')!=='true'));
    rail.classList.add('home-rankings-ready');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
