(()=>{
  'use strict';
  if(window.__CFF_ADMIN_EDICAO_PERFORMANCE__)return;
  window.__CFF_ADMIN_EDICAO_PERFORMANCE__=true;

  const $=(s,r=document)=>r.querySelector(s);
  const state=()=>window.__CFF_ADMIN_EDICAO_STATE__||null;
  const rerender=()=>{try{window.__CFF_ADMIN_EDICAO_QUEUE__?.();}catch{}};
  let wantedBlur=null,restoreTimer=0,pointerActive=false;

  function suspendHeavyEffects(){
    const s=state();if(!s)return;
    if(wantedBlur===null)wantedBlur=!!s.cffBlurFill;
    if(s.cffBlurFill)s.cffBlurFill=false;
    document.documentElement.classList.add('cff-fast-editing');
  }

  function restoreHeavyEffects(forceRender=true){
    clearTimeout(restoreTimer);restoreTimer=0;
    const s=state();if(!s)return;
    if(wantedBlur!==null){s.cffBlurFill=wantedBlur;wantedBlur=null;}
    document.documentElement.classList.remove('cff-fast-editing');
    if(forceRender)rerender();
  }

  function scheduleRestore(delay=180){
    clearTimeout(restoreTimer);
    restoreTimer=setTimeout(()=>{if(!pointerActive&&!window.__CFF_ADMIN_EDICAO_INTERACTING__)restoreHeavyEffects(true);},delay);
  }

  function isContinuousControl(target){
    if(!target)return false;
    if(target.closest?.('#cff-studio-effects'))return false;
    return !!target.closest?.('#photo-editor-text,#photo-editor-font-size,#photo-editor-text-x,#photo-editor-text-y,#photo-editor-text-spacing,#photo-editor-zoom,#photo-editor-rotation,#photo-editor-brightness,#photo-editor-contrast,#photo-editor-saturation,#photo-editor-pip-size,#photo-editor-pip-x,#photo-editor-pip-y,#photo-editor-pip-opacity');
  }

  function bind(){
    const app=$('#photo-editor-app'),stage=$('#photo-editor-stage');if(!app||app.dataset.cffPerfBound==='1')return;app.dataset.cffPerfBound='1';

    window.addEventListener('cff-editor-interaction-start',()=>{pointerActive=true;clearTimeout(restoreTimer);suspendHeavyEffects();});
    window.addEventListener('cff-editor-interaction-end',()=>{pointerActive=false;restoreHeavyEffects(true);});

    stage?.addEventListener('pointerdown',()=>{pointerActive=true;clearTimeout(restoreTimer);suspendHeavyEffects();},{capture:true,passive:true});
    window.addEventListener('pointerup',()=>{if(!pointerActive)return;pointerActive=false;if(!window.__CFF_ADMIN_EDICAO_INTERACTING__)scheduleRestore(40);},{capture:true,passive:true});
    window.addEventListener('pointercancel',()=>{pointerActive=false;scheduleRestore(40);},{capture:true,passive:true});

    app.addEventListener('input',e=>{
      if(!isContinuousControl(e.target))return;
      suspendHeavyEffects();scheduleRestore(e.target?.id==='photo-editor-text'?140:90);
    },true);

    document.addEventListener('visibilitychange',()=>{if(document.hidden)restoreHeavyEffects(false);});
  }

  function boot(){
    let tries=0;const timer=setInterval(()=>{tries++;if(state()&&!$('#photo-editor-app')?.hidden){clearInterval(timer);bind();}else if(tries>180)clearInterval(timer);},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
