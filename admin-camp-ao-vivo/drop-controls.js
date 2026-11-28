/* Manual extension of Champion Rush. No score reset and no result publication. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),button=$('cff-new-drop'),select=$('drop-num'),count=$('num-quedas');
  if(!button||!select||!count||window.CFF_CAMP_DROPS)return;
  let busy=false;
  function unlimited(){
    return $('v68-champion-rush-unlimited')?.checked===true&&window.isChampionPointLogicEnabled?.()===true;
  }
  function winner(){
    try{return typeof tournamentWinner!=='undefined'&&!!tournamentWinner;}catch(_){return !!window.tournamentWinner;}
  }
  function runtime(){
    return typeof dropsData!=='undefined'&&Array.isArray(dropsData)?dropsData:window.dropsData;
  }
  function total(){
    return Math.max(Number(count.value)||0,runtime()?.length||0,...Array.from(select.options,o=>Number(o.value)||0));
  }
  function refresh(){
    const hidden=!unlimited(),disabled=busy||winner()||!runtime()||!window.__CFF_CAMP_READY__;
    if(button.hidden!==hidden)button.hidden=hidden;
    if(button.disabled!==!!disabled)button.disabled=!!disabled;
    const next=total()+1;
    const label='Criar Queda '+next,title=winner()?'Campeão definido. Corrija o resultado antes de acrescentar outra queda.':'Criar a Queda '+next+' sem apagar as anteriores.';
    if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
    if(button.title!==title)button.title=title;
  }
  function add(){
    if(busy||!unlimited()||winner()||!window.__CFF_CAMP_READY__)return false;
    const data=runtime();if(!Array.isArray(data))return false;
    busy=true;refresh();
    try{
      // Capture the current edit before rebuilding the selector and input fields.
      const index=Number(select.value)-1;
      if(Number.isInteger(index)&&index>=0&&index<total()){
        if(typeof captureCurrentDropFromScreen!=='function')throw Error('Lançamento ainda não disponível.');
        data[index]=captureCurrentDropFromScreen(data[index]);
      }else if(select.value==='starting'&&typeof saveStartingPointsFromScreen==='function')saveStartingPointsFromScreen();
      window.renderSummary?.();
      if(winner()){window.autoSave?.(true);return false;}
      const next=total()+1;
      while(data.length<next)data.push(null);
      count.value=String(next);
      window.applySetup(true);
      select.value=String(next);
      window.loadDropData();
      window.autoSave?.(true);
      select.focus();
      const status=$('cff-new-drop-status');if(status)status.textContent='Queda '+next+' criada.';
      return true;
    }catch(error){
      console.error('[Camp] Não foi possível criar a próxima queda.',error);
      const status=$('cff-new-drop-status');if(status)status.textContent='Não foi possível criar a queda. Seu lançamento foi preservado.';
      return false;
    }finally{busy=false;refresh();}
  }
  button.addEventListener('click',add);
  const observer=new MutationObserver(refresh);
  observer.observe(select,{childList:true});
  observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  const banner=$('champion-banner');if(banner)observer.observe(banner,{attributes:true,childList:true,subtree:true});
  document.addEventListener('change',event=>{
    if(['v68-champion-rush-unlimited','champion-enabled','final-mode','num-quedas','drop-num'].includes(event.target?.id))setTimeout(refresh,0);
  });
  window.CFF_CAMP_DROPS={add,refresh};
  refresh();
})();
