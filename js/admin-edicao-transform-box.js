(()=>{
  'use strict';
  if(window.__CFF_ADMIN_EDICAO_TRANSFORM_BOX__) return;
  window.__CFF_ADMIN_EDICAO_TRANSFORM_BOX__=true;

  const W=3000,H=3749;
  const $=(s,r=document)=>r.querySelector(s);
  const state=()=>window.__CFF_ADMIN_EDICAO_STATE__||null;
  const rerender=()=>{try{window.__CFF_ADMIN_EDICAO_QUEUE__?.();}catch{}};
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
  let box=null,gesture=null,lastKey='';

  function addStyles(){
    if($('#cff-transform-box-styles')) return;
    const style=document.createElement('style');
    style.id='cff-transform-box-styles';
    style.textContent=`
      #cff-photo-transform{position:absolute;z-index:30;box-sizing:border-box;border:1.5px dashed rgba(255,255,255,.98);transform-origin:center center;pointer-events:auto;touch-action:none;cursor:move;filter:drop-shadow(0 1px 1px rgba(0,0,0,.65))}
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
      @media(max-width:820px){
        .cff-transform-handle{width:16px;height:16px}.cff-transform-rotate{width:20px;height:20px;top:-35px}.cff-transform-rotate-line{top:-33px;height:33px}.cff-transform-close{width:25px;height:25px;right:-31px;top:-15px}.cff-transform-tip{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function setup(){
    const stage=$('#photo-editor-stage');
    if(!stage) return false;
    if(box) return true;
    if(getComputedStyle(stage).position==='static') stage.style.position='relative';
    box=document.createElement('div');
    box.id='cff-photo-transform';
    box.hidden=true;
    box.setAttribute('aria-label','Controles da foto principal');
    box.innerHTML=`
      <button class="cff-transform-handle" data-corner="nw" type="button" aria-label="Redimensionar foto"></button>
      <button class="cff-transform-handle" data-corner="ne" type="button" aria-label="Redimensionar foto"></button>
      <button class="cff-transform-handle" data-corner="sw" type="button" aria-label="Redimensionar foto"></button>
      <button class="cff-transform-handle" data-corner="se" type="button" aria-label="Redimensionar foto"></button>
      <span class="cff-transform-rotate-line"></span>
      <button class="cff-transform-rotate" type="button" aria-label="Rotacionar foto" title="Rotacionar">↻</button>
      <button class="cff-transform-close" type="button" aria-label="Remover foto" title="Remover foto">×</button>
      <span class="cff-transform-tip">arraste para mover · cantos para redimensionar</span>`;
    stage.appendChild(box);

    box.addEventListener('pointerdown',onPointerDown,true);
    $('.cff-transform-close',box)?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();removePhoto();});
    return true;
  }

  function geometry(){
    const s=state(),stage=$('#photo-editor-stage'),canvas=$('#photo-editor-canvas');
    if(!s?.image||!stage||!canvas) return null;
    const sr=stage.getBoundingClientRect(),cr=canvas.getBoundingClientRect();
    if(!cr.width||!cr.height) return null;
    const sx=cr.width/W,sy=cr.height/H;
    const iw=Number(s.image.naturalWidth||s.image.width||0),ih=Number(s.image.naturalHeight||s.image.height||0);
    const sc=(Number(s.baseScale)||1)*(Number(s.zoom)||1);
    return {
      left:(cr.left-sr.left)+(Number(s.x)||W/2)*sx,
      top:(cr.top-sr.top)+(Number(s.y)||H/2)*sy,
      width:Math.max(2,iw*sc*sx),height:Math.max(2,ih*sc*sy),
      rotation:Number(s.rotation)||0,
      canvasRect:cr,stageRect:sr
    };
  }

  function syncBox(force=false){
    if(!box&&!setup())return;
    const s=state(),g=geometry();
    if(!s?.image||!g){box.hidden=true;return;}
    box.hidden=false;
    const key=[g.left,g.top,g.width,g.height,g.rotation,s.flipX].map(v=>Math.round(Number(v)*100)/100).join('|');
    if(!force&&key===lastKey)return;
    lastKey=key;
    box.style.left=`${g.left}px`;
    box.style.top=`${g.top}px`;
    box.style.width=`${g.width}px`;
    box.style.height=`${g.height}px`;
    box.style.transform=`translate(-50%,-50%) rotate(${g.rotation}deg)`;
  }

  function pointerCenter(){
    const g=geometry();
    if(!g)return null;
    return {x:g.stageRect.left+g.left,y:g.stageRect.top+g.top};
  }

  function onPointerDown(e){
    const s=state();if(!s?.image)return;
    const target=e.target;
    if(target.closest('.cff-transform-close'))return;
    e.preventDefault();e.stopPropagation();
    const center=pointerCenter(),g=geometry();if(!center||!g)return;
    const mode=target.closest('.cff-transform-rotate')?'rotate':target.closest('.cff-transform-handle')?'resize':'move';
    gesture={
      id:e.pointerId,mode,startX:e.clientX,startY:e.clientY,startStateX:Number(s.x)||W/2,startStateY:Number(s.y)||H/2,
      startZoom:Number(s.zoom)||1,startRotation:Number(s.rotation)||0,centerX:center.x,centerY:center.y,
      startAngle:Math.atan2(e.clientY-center.y,e.clientX-center.x),startDistance:Math.max(12,Math.hypot(e.clientX-center.x,e.clientY-center.y)),
      canvasW:g.canvasRect.width,canvasH:g.canvasRect.height
    };
    target.setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove',onPointerMove,{capture:true});
    window.addEventListener('pointerup',onPointerUp,{capture:true,once:true});
    window.addEventListener('pointercancel',onPointerUp,{capture:true,once:true});
  }

  function syncZoomUi(s){
    const z=$('#photo-editor-zoom'),out=$('#photo-editor-zoom-value');
    const pct=Math.round((Number(s.zoom)||1)*100);
    if(z)z.value=String(clamp(pct,25,300));if(out)out.textContent=`${pct}%`;
  }
  function syncRotationUi(s){
    const input=$('#photo-editor-rotation'),out=$('#photo-editor-rotation-value');
    const rounded=Math.round(Number(s.rotation)||0);
    if(input)input.value=String(clamp(rounded,-180,180));if(out)out.textContent=`${rounded}°`;
  }

  function onPointerMove(e){
    if(!gesture||e.pointerId!==gesture.id)return;
    const s=state();if(!s?.image)return;
    e.preventDefault();e.stopPropagation();
    if(gesture.mode==='move'){
      s.x=gesture.startStateX+(e.clientX-gesture.startX)*(W/gesture.canvasW);
      s.y=gesture.startStateY+(e.clientY-gesture.startY)*(H/gesture.canvasH);
    }else if(gesture.mode==='resize'){
      const d=Math.max(8,Math.hypot(e.clientX-gesture.centerX,e.clientY-gesture.centerY));
      s.zoom=clamp(gesture.startZoom*(d/gesture.startDistance),.25,3);
      syncZoomUi(s);
    }else if(gesture.mode==='rotate'){
      const angle=Math.atan2(e.clientY-gesture.centerY,e.clientX-gesture.centerX);
      let deg=gesture.startRotation+(angle-gesture.startAngle)*180/Math.PI;
      while(deg>180)deg-=360;while(deg<-180)deg+=360;
      s.rotation=deg;syncRotationUi(s);
    }
    rerender();syncBox(true);
  }

  function onPointerUp(e){
    if(!gesture||e.pointerId!==gesture.id)return;
    e.preventDefault();e.stopPropagation();gesture=null;
    window.removeEventListener('pointermove',onPointerMove,true);
    lastKey='';syncBox(true);
  }

  function removePhoto(){
    const s=state();if(!s?.image)return;
    try{if(s.imageUrl)URL.revokeObjectURL(s.imageUrl);}catch{}
    s.image=null;s.imageUrl='';s.zoom=1;s.baseScale=1;s.x=W/2;s.y=H/2;s.rotation=0;s.flipX=1;
    const file=$('#photo-editor-file'),name=$('#photo-editor-image-name'),empty=$('#photo-editor-empty'),download=$('#photo-editor-download'),rot=$('#photo-editor-rotation'),rotOut=$('#photo-editor-rotation-value'),zoom=$('#photo-editor-zoom'),zoomOut=$('#photo-editor-zoom-value');
    if(file)file.value='';if(name)name.textContent='Nenhuma foto';if(empty){empty.hidden=false;empty.classList.remove('is-hidden');}if(download)download.disabled=true;
    if(rot)rot.value='0';if(rotOut)rotOut.textContent='0°';if(zoom)zoom.value='100';if(zoomOut)zoomOut.textContent='100%';
    lastKey='';if(box)box.hidden=true;rerender();
  }

  function bind(){
    const app=$('#photo-editor-app');if(!app||app.dataset.transformBoxBound==='1')return;app.dataset.transformBoxBound='1';
    ['input','change','click','pointerup','wheel'].forEach(ev=>app.addEventListener(ev,()=>requestAnimationFrame(()=>syncBox(true)),true));
    window.addEventListener('resize',()=>{lastKey='';syncBox(true)});
  }

  function tick(){syncBox();requestAnimationFrame(tick);}
  function boot(){
    addStyles();let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(state()&&!$('#photo-editor-app')?.hidden&&setup()){
        clearInterval(timer);bind();syncBox(true);requestAnimationFrame(tick);
      }else if(tries>180)clearInterval(timer);
    },100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
