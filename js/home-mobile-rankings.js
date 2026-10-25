(()=>{
  'use strict';
  // Mantém os mesmos quatro rankings e os mesmos IDs ao alternar mobile/desktop.
  // Quando trocar a WB pelo Mundial, atualize data-home-rankings-event e a fonte dos dados.
  function init(){
    const home=document.getElementById('home');
    const rail=home?.querySelector('.home-main-layout > .home-left-rail');
    const selection=home?.querySelector('#home-tournament-selection-panel');
    const selectionContent=document.getElementById('home-tournament-mobile-content');
    const rankingsSlot=document.getElementById('home-mobile-rankings-list');
    const toggle=document.getElementById('home-rankings-mobile-toggle');
    const center=home?.querySelector('.home-center-column');
    const scenario=document.getElementById('home-scenario-mobile-toggle');
    if(!rail||!selection||!selectionContent||!rankingsSlot||!toggle||!center||!scenario)return;
    const ids=['home-ranking-teams','home-ranking-kills','home-ranking-damage','home-ranking-assists'];
    const rankings=ids.map(id=>document.getElementById(id));
    if(rankings.some(el=>!el))return;

    const title=toggle.querySelector('[data-home-rankings-title]');
    const action=toggle.querySelector('[data-home-rankings-action]');
    const scenarioAction=scenario.querySelector('[data-home-scenario-action]');
    const media=window.matchMedia('(max-width: 620px)');
    const name=String(rail.dataset.homeRankingsEvent||'Torneio').trim();

    if(title)title.textContent=name+' • DESTAQUES';

    function updateTournament(expanded){
      selection.classList.toggle('is-rankings-expanded',expanded);
      toggle.setAttribute('aria-expanded',String(expanded));
      if(action)action.textContent=expanded?'OCULTAR DESTAQUES':'VER DESTAQUES';
    }
    function updateScenario(expanded){
      center.classList.toggle('is-scenario-expanded',expanded);
      scenario.setAttribute('aria-expanded',String(expanded));
      if(scenarioAction)scenarioAction.textContent=expanded?'OCULTAR CENÁRIO':'VER CENÁRIO';
    }
    function placeWidgets(){
      if(media.matches){
        if(toggle.parentNode!==selection)selection.insertBefore(toggle,selectionContent);
        rankings.forEach(el=>{if(el.parentNode!==rankingsSlot)rankingsSlot.appendChild(el);});
        rail.classList.remove('home-rankings-ready','is-rankings-expanded');
        selection.classList.add('home-rankings-ready');
      }else{
        if(toggle.parentNode!==rail)rail.insertBefore(toggle,rankings[0].parentNode===rail?rankings[0]:null);
        rankings.forEach(el=>{if(el.parentNode!==rail)rail.appendChild(el);});
        selection.classList.remove('home-rankings-ready','is-rankings-expanded');
      }
    }
    updateTournament(false);
    updateScenario(false);
    center.classList.add('home-scenario-ready');
    placeWidgets();
    toggle.addEventListener('click',()=>updateTournament(toggle.getAttribute('aria-expanded')!=='true'));
    scenario.addEventListener('click',()=>updateScenario(scenario.getAttribute('aria-expanded')!=='true'));
    const onViewportChange=()=>{placeWidgets();updateTournament(false);updateScenario(false);};
    if(media.addEventListener)media.addEventListener('change',onViewportChange);
    else if(media.addListener)media.addListener(onViewportChange);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
