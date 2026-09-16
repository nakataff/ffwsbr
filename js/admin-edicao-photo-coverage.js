(()=>{
  'use strict';
  if(window.__CFF_ADMIN_EDICAO_PHOTO_COVERAGE__) return;
  window.__CFF_ADMIN_EDICAO_PHOTO_COVERAGE__=true;

  const W=3000,H=3749,KEY='cff-admin-edicao-photo-coverage-v1';
  const $=(s,r=document)=>r.querySelector(s);
  const state=()=>window.__CFF_ADMIN_EDICAO_STATE__||null;
  let enabled=true,lastKey='',raf=0;
  try{const saved=localStorage.getItem(KEY);if(saved!==null)enabled=saved!=='0';}catch{}

  function addStyles(){
    if($('#cff-photo-coverage-styles')) return;
    const style=document.createElement('style');
    style.id='cff-photo-coverage-styles';
    style.textContent=`
      .cff-studio-canvas-shell{background:#08101a!important;background-image:none!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.045)!important}
      #cff-photo-coverage{position:absolute;inset:0;width:100%;height:100%;z-index:6;pointer-events:none;image-rendering:auto}
      .cff-photo-coverage-note{position:absolute;right:7px;bottom:7px;z-index:11;padding:4px 6px;border:1px solid rgba(255,255,255,.14);border-radius:6px;background:rgba(3,8,14,.82);color:#c5d2e2;font:800 8px/1.15 Arial,sans-serif;letter-spacing:.03em;pointer-events:none;backdrop-filter:blur(5px)}
      .cff-photo-coverage-note strong{color:#fff}.cff-photo-coverage-note.is-hidden{display:none}
      .cff-photo-coverage-tool.is-active{border-color:#00c8ff!important;background:rgba(0,200,255,.12)!important;color:#e7fbff!important}
      @media(max-width:820px){.cff-photo-coverage-note{font-size:7px;right:5px;bottom:5px;padding:3px 5px}}
    `;
    document.head.appendChild(style);
  }

  function setup(){
    const stage=$('#photo-editor-stage');
    if(!stage||$('#cff-photo-coverage')) return false;
    if(getComputedStyle(stage).position==='static') stage.style.position='relative';
    const canvas=document.createElement('canvas');
    canvas.id='cff-photo-coverage';canvas.width=W;canvas.height=H;canvas.setAttribute('aria-hidden','true');
    stage.appendChild(canvas);
    const note=document.createElement('div');note.className='cff-photo-coverage-note';note.innerHTML='<strong>Xadrez:</strong> área sem foto · não sai na exportação';stage.appendChild(note);

    const toolbar=$('.cff-studio-toolbar');
    if(toolbar&&!$('.cff-photo-coverage-tool',toolbar)){
      const button=document.createElement('button');button.type='button';button.className='cff-studio-tool cff-photo-coverage-tool';button.innerHTML='▧ Área sem foto';
      button.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(KEY,enabled?'1':'0');}catch{}lastKey='';syncButton();draw();});
      toolbar.appendChild(button);
    }
    syncButton();draw();return true;
  }

  function syncButton(){
    const button=$('.cff-photo-coverage-tool');if(button)button.classList.toggle('is-active',enabled);
    const note=$('.cff-photo-coverage-note');if(note)note.classList.toggle('is-hidden',!enabled);
  }

  function checker(ctx){
    const cell=92;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#e8e8e8';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#181818';
    for(let y=0,row=0;y<H;y+=cell,row++){
      for(let x=0,col=0;x<W;x+=cell,col++){
        if((row+col)%2===0)ctx.fillRect(x,y,cell,cell);
      }
    }
  }

  function draw(){
    const canvas=$('#cff-photo-coverage');if(!canvas)return;
    const ctx=canvas.getContext('2d');const s=state();
    ctx.clearRect(0,0,W,H);
    if(!enabled||!s) return;
    if(s.cffBlurFill&&s.image) return;
    checker(ctx);
    if(!s.image) return;

    const iw=Number(s.image.naturalWidth||s.image.width||0),ih=Number(s.image.naturalHeight||s.image.height||0);
    if(!iw||!ih)return;
    const scale=(Number(s.baseScale)||1)*(Number(s.zoom)||1),w=iw*scale,h=ih*scale;
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    ctx.translate(Number(s.x)||W/2,Number(s.y)||H/2);
    ctx.rotate((Number(s.rotation)||0)*Math.PI/180);
    ctx.fillStyle='#000';
    ctx.fillRect(-w/2,-h/2,w,h);
    ctx.restore();
  }

  function keyFor(){
    const s=state();if(!s)return 'nostate';
    const img=s.image;
    return [enabled?1:0,!!img,img?.naturalWidth||0,img?.naturalHeight||0,s.baseScale,s.zoom,s.x,s.y,s.rotation,s.cffBlurFill].join('|');
  }

  function tick(){
    if(!$('#cff-photo-coverage'))setup();
    const key=keyFor();if(key!==lastKey){lastKey=key;draw();}
    raf=requestAnimationFrame(tick);
  }

  function boot(){
    addStyles();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(state()&&!$('#photo-editor-app')?.hidden&&setup()){
        clearInterval(timer);cancelAnimationFrame(raf);tick();
      }else if(tries>180){clearInterval(timer);}
    },100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();