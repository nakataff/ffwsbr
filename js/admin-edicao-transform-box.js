(()=>{
  'use strict';
  if(window.__CFF_ADMIN_EDICAO_TRANSFORM_BOX__) return;
  window.__CFF_ADMIN_EDICAO_TRANSFORM_BOX__=true;

  const W=3000,H=3749;
  const SNAP_PX=12,RELEASE_PX=28;
  const $=(s,r=document)=>r.querySelector(s);
  const state=()=>window.__CFF_ADMIN_EDICAO_STATE__||null;
  const rerender=()=>{try{window.__CFF_ADMIN_EDICAO_QUEUE__?.();}catch{}};
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
  let box=null,guides=null,guideX=null,guideY=null,gesture=null,lastKey='',syncRaf=0,idleTimer=0,resizeObserver=null;

  function addStyles(){
    if($('#cff-transform-box-styles')) return;
    const style=document.createElement('style');
    style.id='cff-transform-box-styles';
    style.textContent=`
      #cff-photo-transform{position:absolute;z-index:30;box-sizing:border-box;border:1.5px dashed rgba(255,255,255,.98);transform-origin:center center;pointer-events:auto;touch-action:none;cursor:move;filter:drop-shadow(0 1px 1px rgba(0,0,0,.65));will-change:left,top,width,height,transform}
      #cff-photo-transform[hidden]{display:none!important}
      #cff-photo-transform::after{content:'';position:absolute;inset:-1px;border:1px solid rgba(0,200,255,.34);pointer-events:none}
      .cff-transform-handle{position:absolute;width:12px;height:12px;border-radius:50%;border:1.5px solid #07111a;background:#16c7f3;box-shadow:0 0 0 1px rgba(255,255,255,.6),0 2px 7px rgba(0,0,0,.45);padding:0;touch-action:none}
      .cff-transform-handle[data-corner="nw"]{left:0;top:0;transform:translate(-50%,-50%);cursor:nwse-resize}
      .cff-transform-handle[data-corner="ne"]{right:0;top:0;transform:translate(50%,-50%);cursor:nesw-resize}
      .cff-transform-handle[data-corner="sw"]{left:0;bottom:0;transform:translate(-50%,50%);cursor:nesw-resize}
      .cff-transform-handle[data-corner="se"]{right:0;bottom:0;transform:translate(50%,50%);cursor:nwse-resize}
      .cff-transform-rotate-line{position:absolute;left:50%;top:-29px;width:1px;height:29px;background:#18d6ff;transform:translateX(-50%);pointer-events:none;box-shadow:0 0 3px rgba(0,0,0,.5)}
      .cff-transform-rotate{position:absolute;left:50%;top:-31px;width:17px;height:17px;transform:translate(-50%,-50%);border-radius:50%;border:1.5px solid #07111a;background:#16c7f3;color:#031019;box-shadow:0 0 0 1px rgba(255,255,255,.65),0 2px 8px rgba(0,0,0,.5);cursor:grab;padding:0;touch-action:none}
      .cff-transform-rotate:active{cursor:grabbing}
      .cff-transform-close{position:absolute;right:-28px;top:-13px;width:22px;height:22px;border:0;border-radius:7px;background:rgba(5,10,16,.9);color:#fff;font:900 17px/1 Arial,sans-serif;display:grid;place-items:center;cursor:pointer;padding:0;box-shadow:0 2px 8px rgba(0,0,0,.45);touch-action:none}
      .cff-transform-close:hover{background:#d7364e}
      .cff-transform-tip{position:absolute;left:50%;bottom:-31px;transform:translateX(-50%);padding:4px 7px;border-radius:6px;background:rgba(3,8,14,.82);border:1px solid rgba(255,255,255,.13);color:#d8e6f5;font:800 8px/1 Arial,sans-serif;white-space:nowrap;pointer-events:none;opacity:.76}
      #cff-transform-guides{position:absolute;inset:0;z-index:29;pointer-events:none;overflow:hidden}
      .cff-snap-guide{position:absolute;display:none;background:#16d7ff;box-shadow:0 0 0 1px rgba(0,0,0,.28),0 0 8px rgba(0,211,255,.5);will-change:left,top,width,height}
      .cff-snap-guide.is-on{display:block}
      .cff-snap-guide.is-v{width:1.5px}.cff-snap-guide.is-h{height:1.5px}
      .cff-snap-guide::after{content:attr(data-label);position:absolute;padding:3px 5px;border-radius:5px;background:rgba(3,12,20,.88);border:1px solid rgba(22,215,255,.4);color:#b9f5ff;font:900 8px/1 Arial,sans-serif;letter-spacing:.04em;white-space:nowrap}
      .cff-snap-guide.is-v::after{top:7px;left:6px}.cff-snap-guide.is-h::after{left:7px;top:6px}
      @media(max-width:820px){.cff-transform-handle{width:16px;height:16px}.cff-transform-rotate{width:20px;height:20px;top:-35px}.cff-transform-rotate-line{top:-33px;height:33px}.cff-transform-close{width:25px;height:25px;right:-31px;top:-15px}.cff-transform-tip{display:none}.cff-snap-guide::after{display:none}}
    `;
    document.head.appendChild(style);
  }

  function setupGuides(stage){
    if(guides)return;
    guides=document.createElement('div');guides.id='cff-transform-guides';guides.setAttribute('aria-hidden','true');
    guideX=document.createElement('div');guideX.className='cff-snap-guide is-v';
    guideY=document.createElement('div');guideY.className='cff-snap-guide is-h';
    guides.append(guideX,guideY);stage.appendChild(guides);
  }

  function setup(){
    const stage=$('#photo-editor-stage');
    if(!stage)return false;
    if(box)return true;
    if(getComputedStyle(stage).position==='static')stage.style.position='relative';
    setupGuides(stage);
    box=document.createElement('div');box.id='cff-photo-transform';box.hidden=true;box.setAttribute('aria-label','Controles da foto principal');
    box.innerHTML=`
      <button class="cff-transform-handle" data-corner="nw" type="button" aria-label="Redimensionar foto"></button>
      <button class="cff-transform-handle" data-corner="ne" type="button" aria-label="Redimensionar foto"></button>
      <button class="cff-transform-handle" data-corner="sw" type="button" aria-label="Redimensionar foto"></button>
      <button class="cff-transform-handle" data-corner="se" type="button" aria-label="Redimensionar foto"></button>
      <span class="cff-transform-rotate-line"></span>
      <button class="cff-transform-rotate" type="button" aria-label="Rotacionar foto" title="Rotacionar">↻</button>
      <button class="cff-transform-close" type="button" aria-label="Remover foto" title="Remover foto">×</button>
      <span class="cff-transform-tip">arraste para mover · cantos para redimensionar · Alt ignora o ímã</span>`;
    stage.appendChild(box);
    box.addEventListener('pointerdown',onPointerDown,true);
    $('.cff-transform-close',box)?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(typeof window.__CFF_ADMIN_EDICAO_CONFIRM_DELETE_MAIN__==='function')window.__CFF_ADMIN_EDICAO_CONFIRM_DELETE_MAIN__();else removePhoto();});
    disableWheelZoom(stage);
    const help=$('.photo-editor-stage-help');
    if(help)help.textContent='No computador, arraste a foto e use os pontos do quadro para redimensionar. As guias magnéticas ajudam no centro e nas bordas. O scroll do mouse rola a página e não altera mais o zoom.';
    return true;
  }

  function disableWheelZoom(stage){
    if(!stage||stage.dataset.cffWheelZoomDisabled==='1')return;
    stage.dataset.cffWheelZoomDisabled='1';
    stage.addEventListener('wheel',e=>{if(state()?.image)e.stopImmediatePropagation();},{capture:true,passive:true});
  }

  function geometry(){
    const s=state(),stage=$('#photo-editor-stage'),canvas=$('#photo-editor-canvas');
    if(!s?.image||!stage||!canvas)return null;
    const sr=stage.getBoundingClientRect(),cr=canvas.getBoundingClientRect(),localW=canvas.clientWidth||stage.clientWidth,localH=canvas.clientHeight||stage.clientHeight;
    if(!cr.width||!cr.height||!localW||!localH)return null;
    const iw=Number(s.image.naturalWidth||s.image.width||0),ih=Number(s.image.naturalHeight||s.image.height||0),sc=(Number(s.baseScale)||1)*(Number(s.zoom)||1);
    const localLeft=(canvas.offsetLeft||0)+(Number(s.x)||W/2)/W*localW,localTop=(canvas.offsetTop||0)+(Number(s.y)||H/2)/H*localH;
    const width=Math.max(2,(iw*sc/W)*localW),height=Math.max(2,(ih*sc/H)*localH);
    const centerClientX=cr.left+(Number(s.x)||W/2)/W*cr.width,centerClientY=cr.top+(Number(s.y)||H/2)/H*cr.height;
    return {left:localLeft,top:localTop,width,height,rotation:Number(s.rotation)||0,canvasRect:cr,stageRect:sr,localW,localH,canvasOffsetX:canvas.offsetLeft||0,canvasOffsetY:canvas.offsetTop||0,centerClientX,centerClientY};
  }

  function syncBox(force=false){
    if(!box&&!setup())return;
    const s=state(),g=geometry();
    if(!s?.image||!g||s.cffSelection?.type!=='photo'){box.hidden=true;clearGuides();return;}
    box.hidden=false;
    const key=[g.left,g.top,g.width,g.height,g.rotation,s.flipX].map(v=>Math.round(Number(v)*100)/100).join('|');
    if(!force&&key===lastKey)return;
    lastKey=key;
    box.style.left=`${g.left}px`;box.style.top=`${g.top}px`;box.style.width=`${g.width}px`;box.style.height=`${g.height}px`;box.style.transform=`translate(-50%,-50%) rotate(${g.rotation}deg)`;
  }

  function scheduleBoxSync(force=false){
    if(syncRaf)return;
    syncRaf=requestAnimationFrame(()=>{syncRaf=0;syncBox(force);});
  }

  function halfExtents(s){
    if(!s?.image)return{x:0,y:0};
    const iw=Number(s.image.naturalWidth||s.image.width||0),ih=Number(s.image.naturalHeight||s.image.height||0),sc=(Number(s.baseScale)||1)*(Number(s.zoom)||1),w=iw*sc,h=ih*sc,rad=(Number(s.rotation)||0)*Math.PI/180;
    return{x:(Math.abs(w*Math.cos(rad))+Math.abs(h*Math.sin(rad)))/2,y:(Math.abs(w*Math.sin(rad))+Math.abs(h*Math.cos(rad)))/2};
  }

  function candidates(axis,s){
    const half=halfExtents(s);
    return axis==='x'?[{id:'center-x',value:W/2,guide:W/2,label:'CENTRO'},{id:'left',value:half.x,guide:0,label:'BORDA ESQ.'},{id:'right',value:W-half.x,guide:W,label:'BORDA DIR.'}]:[{id:'center-y',value:H/2,guide:H/2,label:'CENTRO'},{id:'top',value:half.y,guide:0,label:'TOPO'},{id:'bottom',value:H-half.y,guide:H,label:'BASE'}];
  }

  function clearGuide(axis){const el=axis==='x'?guideX:guideY;if(!el)return;el.classList.remove('is-on');el.dataset.label='';}
  function clearGuides(){clearGuide('x');clearGuide('y');}

  function showGuide(axis,pos,label){
    const el=axis==='x'?guideX:guideY,g=gesture;if(!el||!g)return;
    el.dataset.label=label||'';
    if(axis==='x'){el.style.left=`${g.canvasOffsetLocalX+(pos/W)*g.localW}px`;el.style.top=`${g.canvasOffsetLocalY}px`;el.style.height=`${g.localH}px`;el.style.width='1.5px';}
    else{el.style.left=`${g.canvasOffsetLocalX}px`;el.style.top=`${g.canvasOffsetLocalY+(pos/H)*g.localH}px`;el.style.width=`${g.localW}px`;el.style.height='1.5px';}
    el.classList.add('is-on');
  }

  function resolveSnap(axis,raw,e,s){
    const scale=axis==='x'?(W/gesture.renderW):(H/gesture.renderH),threshold=SNAP_PX*scale,release=RELEASE_PX*scale,list=candidates(axis,s),key=axis==='x'?'snapX':'snapY';
    if(e.altKey){gesture[key]=null;clearGuide(axis);return raw;}
    if(gesture[key]){
      const current=list.find(c=>c.id===gesture[key]);
      if(current&&Math.abs(raw-current.value)<=release){showGuide(axis,current.guide,current.label);return current.value;}
      gesture[key]=null;clearGuide(axis);
    }
    let best=null,bestDist=Infinity;
    for(const c of list){const d=Math.abs(raw-c.value);if(d<bestDist){best=c;bestDist=d;}}
    if(best&&bestDist<=threshold){gesture[key]=best.id;showGuide(axis,best.guide,best.label);return best.value;}
    clearGuide(axis);return raw;
  }

  function beginInteraction(){
    const s=state();if(s)s.cffLivePhotoActive=true;
    window.__CFF_ADMIN_EDICAO_INTERACTING__=true;
    window.__CFF_ADMIN_EDICAO_SYNC_MAIN_LIVE__?.();
    rerender();
    window.dispatchEvent(new CustomEvent('cff-editor-interaction-start'));
  }
  function endInteraction(){
    const s=state();if(s)s.cffLivePhotoActive=false;
    window.__CFF_ADMIN_EDICAO_INTERACTING__=false;
    rerender();
    requestAnimationFrame(()=>requestAnimationFrame(()=>window.__CFF_ADMIN_EDICAO_SYNC_MAIN_LIVE__?.()));
    window.dispatchEvent(new CustomEvent('cff-editor-interaction-end'));
  }

  function onPointerDown(e){
    const s=state();if(!s?.image)return;
    window.__CFF_ADMIN_EDICAO_SELECT__?.('photo');
    const target=e.target;if(target.closest('.cff-transform-close'))return;
    e.preventDefault();e.stopPropagation();
    const g=geometry();if(!g)return;
    const centerX=g.centerClientX,centerY=g.centerClientY,mode=target.closest('.cff-transform-rotate')?'rotate':target.closest('.cff-transform-handle')?'resize':'move';
    clearGuides();beginInteraction();
    gesture={id:e.pointerId,mode,startX:e.clientX,startY:e.clientY,startStateX:Number(s.x)||W/2,startStateY:Number(s.y)||H/2,startZoom:Number(s.zoom)||1,startRotation:Number(s.rotation)||0,centerX,centerY,startAngle:Math.atan2(e.clientY-centerY,e.clientX-centerX),startDistance:Math.max(12,Math.hypot(e.clientX-centerX,e.clientY-centerY)),renderW:g.canvasRect.width,renderH:g.canvasRect.height,localW:g.localW,localH:g.localH,canvasOffsetLocalX:g.canvasOffsetX,canvasOffsetLocalY:g.canvasOffsetY,snapX:null,snapY:null};
    target.setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove',onPointerMove,{capture:true});
    window.addEventListener('pointerup',onPointerUp,{capture:true,once:true});
    window.addEventListener('pointercancel',onPointerUp,{capture:true,once:true});
  }

  function syncZoomUi(s){const z=$('#photo-editor-zoom'),out=$('#photo-editor-zoom-value'),pct=Math.round((Number(s.zoom)||1)*100);if(z)z.value=String(clamp(pct,25,300));if(out)out.textContent=`${pct}%`;}
  function syncRotationUi(s){const input=$('#photo-editor-rotation'),out=$('#photo-editor-rotation-value'),rounded=Math.round(Number(s.rotation)||0);if(input)input.value=String(clamp(rounded,-180,180));if(out)out.textContent=`${rounded}°`;}

  function onPointerMove(e){
    if(!gesture||e.pointerId!==gesture.id)return;
    const s=state();if(!s?.image)return;
    e.preventDefault();e.stopPropagation();
    if(gesture.mode==='move'){
      const rawX=gesture.startStateX+(e.clientX-gesture.startX)*(W/gesture.renderW),rawY=gesture.startStateY+(e.clientY-gesture.startY)*(H/gesture.renderH);
      s.x=resolveSnap('x',rawX,e,s);s.y=resolveSnap('y',rawY,e,s);
    }else if(gesture.mode==='resize'){
      clearGuides();const d=Math.max(8,Math.hypot(e.clientX-gesture.centerX,e.clientY-gesture.centerY));s.zoom=clamp(gesture.startZoom*(d/gesture.startDistance),.25,3);syncZoomUi(s);
    }else if(gesture.mode==='rotate'){
      clearGuides();const angle=Math.atan2(e.clientY-gesture.centerY,e.clientX-gesture.centerX);let deg=gesture.startRotation+(angle-gesture.startAngle)*180/Math.PI;while(deg>180)deg-=360;while(deg<-180)deg+=360;s.rotation=deg;syncRotationUi(s);
    }
    window.__CFF_ADMIN_EDICAO_SYNC_MAIN_LIVE__?.();scheduleBoxSync(true);
  }

  function onPointerUp(e){
    if(!gesture||e.pointerId!==gesture.id)return;
    e.preventDefault();e.stopPropagation();gesture=null;clearGuides();endInteraction();
    window.removeEventListener('pointermove',onPointerMove,true);
    lastKey='';rerender();scheduleBoxSync(true);
  }

  function removePhoto(){
    const s=state();if(!s?.image)return;
    try{if(s.imageUrl)URL.revokeObjectURL(s.imageUrl);}catch{}
    s.image=null;s.imageUrl='';s.zoom=1;s.baseScale=1;s.x=W/2;s.y=H/2;s.rotation=0;s.flipX=1;
    const file=$('#photo-editor-file'),name=$('#photo-editor-image-name'),empty=$('#photo-editor-empty'),download=$('#photo-editor-download'),rot=$('#photo-editor-rotation'),rotOut=$('#photo-editor-rotation-value'),zoom=$('#photo-editor-zoom'),zoomOut=$('#photo-editor-zoom-value');
    if(file)file.value='';if(name)name.textContent='Nenhuma foto';if(empty){empty.hidden=false;empty.classList.remove('is-hidden');}if(download)download.disabled=true;if(rot)rot.value='0';if(rotOut)rotOut.textContent='0°';if(zoom)zoom.value='100';if(zoomOut)zoomOut.textContent='100%';
    clearGuides();lastKey='';if(box)box.hidden=true;window.__CFF_ADMIN_EDICAO_CLEAR_SELECTION__?.();rerender();
  }

  function bind(){
    const app=$('#photo-editor-app'),stage=$('#photo-editor-stage'),canvas=$('#photo-editor-canvas');if(!app||app.dataset.transformBoxBound==='1')return;app.dataset.transformBoxBound='1';
    ['input','change','click','pointerup'].forEach(ev=>app.addEventListener(ev,()=>scheduleBoxSync(true),true));
    window.addEventListener('resize',()=>{lastKey='';clearGuides();scheduleBoxSync(true)});
    window.addEventListener('cff-editor-selection-change',()=>{lastKey='';clearGuides();scheduleBoxSync(true)});
    if('ResizeObserver'in window){resizeObserver=new ResizeObserver(()=>{lastKey='';scheduleBoxSync(true)});if(stage)resizeObserver.observe(stage);if(canvas)resizeObserver.observe(canvas);}
    idleTimer=setInterval(()=>{if(!window.__CFF_ADMIN_EDICAO_INTERACTING__)syncBox();},600);
  }

  function boot(){
    addStyles();let tries=0;
    const timer=setInterval(()=>{tries++;if(state()&&!$('#photo-editor-app')?.hidden&&setup()){clearInterval(timer);bind();syncBox(true);}else if(tries>180)clearInterval(timer);},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
