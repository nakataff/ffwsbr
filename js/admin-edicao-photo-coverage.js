(()=>{
  'use strict';
  if(window.__CFF_ADMIN_EDICAO_PHOTO_COVERAGE__) return;
  window.__CFF_ADMIN_EDICAO_PHOTO_COVERAGE__=true;

  const W=3000,H=3749,CW=750,CH=Math.round(H*CW/W),KEY='cff-admin-edicao-photo-coverage-v1';
  const $=(s,r=document)=>r.querySelector(s);
  const state=()=>window.__CFF_ADMIN_EDICAO_STATE__||null;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
  let enabled=true,lastKey='',drawTimer=0,checkTimer=0,interacting=false;
  try{const saved=localStorage.getItem(KEY);if(saved!==null)enabled=saved!=='0';}catch{}

  function loadTransformBox(){
    if(window.__CFF_ADMIN_EDICAO_TRANSFORM_BOX__||document.querySelector('script[data-cff-transform-box]'))return;
    const script=document.createElement('script');script.src='js/admin-edicao-transform-box.js?v=20260916-transform-v3';script.defer=true;script.dataset.cffTransformBox='1';document.head.appendChild(script);
  }

  function addStyles(){
    if($('#cff-photo-coverage-styles'))return;
    const style=document.createElement('style');style.id='cff-photo-coverage-styles';
    style.textContent=`
      .cff-studio-canvas-shell{background:#08101a!important;background-image:none!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.045)!important}
      #cff-photo-coverage{position:absolute;inset:0;width:100%;height:100%;z-index:6;pointer-events:none;image-rendering:auto;background:transparent!important;transition:opacity .08s linear}
      #cff-photo-coverage.is-paused{opacity:.72}
      .photo-editor-empty{z-index:9}
      .cff-photo-coverage-note{position:absolute;right:7px;bottom:7px;z-index:11;padding:4px 6px;border:1px solid rgba(255,255,255,.14);border-radius:6px;background:rgba(3,8,14,.82);color:#c5d2e2;font:800 8px/1.15 Arial,sans-serif;letter-spacing:.03em;pointer-events:none;backdrop-filter:blur(5px)}
      .cff-photo-coverage-note strong{color:#fff}.cff-photo-coverage-note.is-hidden{display:none}
      .cff-photo-coverage-tool.is-active{border-color:#00c8ff!important;background:rgba(0,200,255,.12)!important;color:#e7fbff!important}
      @media(max-width:820px){.cff-photo-coverage-note{font-size:7px;right:5px;bottom:5px;padding:3px 5px}}
    `;
    document.head.appendChild(style);
  }

  function setup(){
    const stage=$('#photo-editor-stage');
    if(!stage||$('#cff-photo-coverage'))return false;
    if(getComputedStyle(stage).position==='static')stage.style.position='relative';
    const canvas=document.createElement('canvas');canvas.id='cff-photo-coverage';canvas.width=CW;canvas.height=CH;canvas.setAttribute('aria-hidden','true');stage.appendChild(canvas);
    const note=document.createElement('div');note.className='cff-photo-coverage-note';note.innerHTML='<strong>Xadrez:</strong> área realmente vazia · não sai na exportação';stage.appendChild(note);
    const toolbar=$('.cff-studio-toolbar');
    if(toolbar&&!$('.cff-photo-coverage-tool',toolbar)){
      const button=document.createElement('button');button.type='button';button.className='cff-studio-tool cff-photo-coverage-tool';button.innerHTML='▧ Área vazia';
      button.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(KEY,enabled?'1':'0');}catch{}lastKey='';syncButton();scheduleDraw(0,true);});toolbar.appendChild(button);
    }
    syncButton();draw();return true;
  }

  function syncButton(){const button=$('.cff-photo-coverage-tool');if(button)button.classList.toggle('is-active',enabled);const note=$('.cff-photo-coverage-note');if(note)note.classList.toggle('is-hidden',!enabled);}

  function checker(ctx){
    const cell=23;ctx.clearRect(0,0,CW,CH);ctx.fillStyle='#e8e8e8';ctx.fillRect(0,0,CW,CH);ctx.fillStyle='#181818';
    for(let y=0,row=0;y<CH;y+=cell,row++)for(let x=0,col=0;x<CW;x+=cell,col++)if((row+col)%2===0)ctx.fillRect(x,y,cell,cell);
  }

  function rounded(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}

  function eraseMainPhoto(ctx,s){
    if(!s?.image)return;const iw=Number(s.image.naturalWidth||s.image.width||0),ih=Number(s.image.naturalHeight||s.image.height||0);if(!iw||!ih)return;
    const scale=(Number(s.baseScale)||1)*(Number(s.zoom)||1),w=iw*scale,h=ih*scale;ctx.save();ctx.globalCompositeOperation='destination-out';ctx.translate(Number(s.x)||W/2,Number(s.y)||H/2);ctx.rotate((Number(s.rotation)||0)*Math.PI/180);ctx.fillStyle='#000';ctx.fillRect(-w/2,-h/2,w,h);ctx.restore();
  }

  function eraseFrame(ctx,s){
    if(!s?.frameEnabled)return;ctx.save();ctx.globalCompositeOperation='destination-out';
    if(s.frame?.complete&&Number(s.frame.naturalWidth||s.frame.width))ctx.drawImage(s.frame,0,0,W,H);
    else{ctx.fillStyle='#000';ctx.beginPath();ctx.moveTo(0,H*.655);ctx.bezierCurveTo(W*.08,H*.69,W*.24,H*.78,W*.39,H*.79);ctx.bezierCurveTo(W*.56,H*.80,W*.66,H*.75,W*.79,H*.78);ctx.bezierCurveTo(W*.88,H*.80,W*.94,H*.83,W,H*.85);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();ctx.lineWidth=86;ctx.strokeStyle='#000';rounded(ctx,72,72,W-144,H-144,390);ctx.stroke();ctx.lineWidth=56;rounded(ctx,72,72,W-144,H-144,390);ctx.stroke();ctx.lineWidth=15;rounded(ctx,72,72,W-144,H-144,390);ctx.stroke();}
    ctx.restore();
  }

  function erasePip(ctx,s){
    if(!s?.pip||s.pipEnabled===false)return;const ratio=(s.pip.naturalWidth||s.pip.width)/(s.pip.naturalHeight||s.pip.height||1),w=W*(clamp(s.pipSize,5,100)/100),h=w/ratio,x=W*(clamp(s.pipX,0,100)/100),y=H*(clamp(s.pipY,0,100)/100);ctx.save();ctx.globalCompositeOperation='destination-out';ctx.globalAlpha=clamp(s.pipOpacity,10,100)/100;ctx.drawImage(s.pip,x-w/2,y-h/2,w,h);ctx.restore();
  }

  function fontCss(name,size){const weight=name==='Montserrat'?'900':'700';if(name==='Impact')return `${size}px Impact, "Arial Black", sans-serif`;return `${weight} ${size}px "${name||'Avilock'}", Impact, "Arial Black", sans-serif`;}

  function eraseTexts(ctx,s){
    const texts=Array.isArray(s?.texts)?s.texts:[];
    texts.forEach(layer=>{const text=String(layer?.text||'');if(!text.trim())return;const size=clamp(layer.size||190,40,500),x=W*(clamp(layer.x||50,5,95)/100),y=H*(clamp(layer.y||86,8,94)/100),lineH=size*(clamp(layer.spacing||106,70,180)/100),lines=text.replace(/\r/g,'').split('\n').slice(0,10).map(v=>v.toUpperCase()),start=y-((lines.length-1)*lineH)/2;ctx.save();ctx.globalCompositeOperation='destination-out';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=fontCss(layer.font,size);ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.lineWidth=Math.max(4,size*.045);lines.forEach((line,i)=>{ctx.strokeText(line,x,start+i*lineH);ctx.fillText(line,x,start+i*lineH);});ctx.restore();});
  }

  function draw(){
    const canvas=$('#cff-photo-coverage');if(!canvas)return;const ctx=canvas.getContext('2d',{alpha:true}),s=state();ctx.clearRect(0,0,CW,CH);if(!enabled||!s)return;
    if(s.cffBlurFill&&s.image){syncNote(false);return;}
    checker(ctx);ctx.save();ctx.scale(CW/W,CH/H);eraseMainPhoto(ctx,s);eraseFrame(ctx,s);erasePip(ctx,s);eraseTexts(ctx,s);ctx.restore();syncNote(true);lastKey=keyFor();
  }

  function syncNote(show){const note=$('.cff-photo-coverage-note');if(note)note.classList.toggle('is-hidden',!enabled||!show);}

  function keyFor(){
    const s=state();if(!s)return'nostate';const img=s.image,frame=s.frame,pip=s.pip,textSig=(Array.isArray(s.texts)?s.texts:[]).map(t=>[t.text,t.font,t.size,t.x,t.y,t.spacing].join('~')).join('||');
    return[enabled?1:0,!!img,img?.naturalWidth||0,img?.naturalHeight||0,s.baseScale,s.zoom,s.x,s.y,s.rotation,s.cffBlurFill,!!s.frameEnabled,frame?.src||'',!!pip,s.pipEnabled,s.pipSize,s.pipX,s.pipY,s.pipOpacity,textSig].join('|');
  }

  function scheduleDraw(delay=24,force=false){
    clearTimeout(drawTimer);drawTimer=setTimeout(()=>requestAnimationFrame(()=>{if(interacting&&!force)return;const key=keyFor();if(force||key!==lastKey)draw();}),delay);
  }

  function bind(){
    const app=$('#photo-editor-app'),stage=$('#photo-editor-stage');if(!app||app.dataset.coveragePerfBound==='1')return;app.dataset.coveragePerfBound='1';
    ['input','change','click'].forEach(ev=>app.addEventListener(ev,()=>scheduleDraw(34),true));
    stage?.addEventListener('pointermove',()=>{if(!interacting)scheduleDraw(90);},{passive:true});
    ['pointerup','pointercancel'].forEach(ev=>stage?.addEventListener(ev,()=>scheduleDraw(0,true),{passive:true}));
    window.addEventListener('cff-editor-interaction-start',()=>{interacting=true;$('#cff-photo-coverage')?.classList.add('is-paused');});
    window.addEventListener('cff-editor-interaction-end',()=>{interacting=false;$('#cff-photo-coverage')?.classList.remove('is-paused');scheduleDraw(0,true);});
    checkTimer=setInterval(()=>{if(!interacting&&keyFor()!==lastKey)scheduleDraw(0);},450);
  }

  function boot(){
    loadTransformBox();addStyles();let tries=0;
    const timer=setInterval(()=>{tries++;if(state()&&!$('#photo-editor-app')?.hidden&&setup()){clearInterval(timer);bind();scheduleDraw(0,true);}else if(tries>180)clearInterval(timer);},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
