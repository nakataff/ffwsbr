(()=>{
  'use strict';
  if(window.__CFF_ADMIN_EDICAO_STUDIO_V2__) return;
  window.__CFF_ADMIN_EDICAO_STUDIO_V2__=true;

  const W=3000,H=3749;
  const STORAGE='cff-admin-edicao-studio-v2';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const state=()=>window.__CFF_ADMIN_EDICAO_STATE__||null;
  const rerender=()=>{try{window.__CFF_ADMIN_EDICAO_QUEUE__?.();}catch{}};
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));

  const defaults={blur:false,blurAmount:100,blurDim:18,gradient:false,gradientHeight:38,gradientOpacity:72,gradientColor:'#05070b',safe:false};
  let settings={...defaults};
  try{settings={...defaults,...JSON.parse(localStorage.getItem(STORAGE)||'{}')};}catch{}

  function saveSettings(){
    try{localStorage.setItem(STORAGE,JSON.stringify(settings));}catch{}
    const s=state();
    if(s){
      s.cffBlurFill=!!settings.blur;
      s.cffBlurAmount=clamp(settings.blurAmount,20,220);
      s.cffBlurDim=clamp(settings.blurDim,0,70);
      s.cffGradientEnabled=!!settings.gradient;
      s.cffGradientHeight=clamp(settings.gradientHeight,10,80);
      s.cffGradientOpacity=clamp(settings.gradientOpacity,0,100);
      s.cffGradientColor=settings.gradientColor||'#05070b';
    }
    syncUi();
    rerender();
  }

  function hexRgb(hex){
    const v=String(hex||'#05070b').replace('#','').trim();
    const n=parseInt(v.length===3?v.split('').map(x=>x+x).join(''):v,16);
    if(!Number.isFinite(n)) return [5,7,11];
    return [(n>>16)&255,(n>>8)&255,n&255];
  }

  function installCanvasEffects(){
    if(window.__CFF_ADMIN_EDICAO_CANVAS_PATCH__) return;
    window.__CFF_ADMIN_EDICAO_CANVAS_PATCH__=true;
    const proto=CanvasRenderingContext2D.prototype;
    const nativeDraw=proto.drawImage;
    proto.drawImage=function(image,...args){
      const s=state();
      const isEditor=this?.canvas?.id==='photo-editor-canvas'||this?.__cffEditorScene===true;
      const isMain=isEditor&&s?.image&&image===s.image;
      if(!isMain||s.__cffEffectPass) return nativeDraw.call(this,image,...args);

      if(s.cffBlurFill){
        s.__cffEffectPass=true;
        try{
          const iw=Number(image.naturalWidth||image.width||1),ih=Number(image.naturalHeight||image.height||1);
          const scale=Math.max(W/iw,H/ih)*1.075;
          const dw=iw*scale,dh=ih*scale,dx=(W-dw)/2,dy=(H-dh)/2;
          this.save();
          const sceneScaleX=Number(this.__cffScaleX)||1,sceneScaleY=Number(this.__cffScaleY)||1;
          this.setTransform(sceneScaleX,0,0,sceneScaleY,0,0);
          this.globalCompositeOperation='source-over';
          this.globalAlpha=1;
          this.shadowColor='transparent';this.shadowBlur=0;this.shadowOffsetX=0;this.shadowOffsetY=0;
          this.filter=`brightness(${s.brightness||100}%) contrast(${s.contrast||100}%) saturate(${s.saturation||100}%) blur(${clamp(s.cffBlurAmount,20,220)}px)`;
          nativeDraw.call(this,image,dx,dy,dw,dh);
          this.filter='none';
          const dim=clamp(s.cffBlurDim,0,70)/100;
          if(dim>0){this.fillStyle=`rgba(0,0,0,${dim})`;this.fillRect(0,0,W,H);}
          this.restore();
        }finally{s.__cffEffectPass=false;}
      }

      const result=nativeDraw.call(this,image,...args);

      if(s.cffGradientEnabled){
        const height=H*(clamp(s.cffGradientHeight,10,80)/100);
        const y=H-height;
        const [r,g,b]=hexRgb(s.cffGradientColor);
        const opacity=clamp(s.cffGradientOpacity,0,100)/100;
        this.save();
        const sceneScaleX=Number(this.__cffScaleX)||1,sceneScaleY=Number(this.__cffScaleY)||1;
        this.setTransform(sceneScaleX,0,0,sceneScaleY,0,0);
        this.globalCompositeOperation='source-over';
        this.filter='none';
        this.shadowColor='transparent';this.shadowBlur=0;this.shadowOffsetX=0;this.shadowOffsetY=0;
        const grad=this.createLinearGradient(0,y,0,H);
        grad.addColorStop(0,`rgba(${r},${g},${b},0)`);
        grad.addColorStop(.35,`rgba(${r},${g},${b},${opacity*.22})`);
        grad.addColorStop(1,`rgba(${r},${g},${b},${opacity})`);
        this.fillStyle=grad;this.fillRect(0,y,W,height);
        this.restore();
      }
      return result;
    };
  }

  function addStyles(){
    if($('#cff-studio-v2-styles')) return;
    const style=document.createElement('style');
    style.id='cff-studio-v2-styles';
    style.textContent=`
      .photo-editor-app{max-width:1980px!important;width:min(1980px,calc(100% - 24px))!important}
      .photo-editor-layout{grid-template-columns:minmax(300px,360px) minmax(0,1fr) minmax(250px,300px)!important;gap:14px!important}
      .photo-editor-controls,.photo-editor-export,.photo-editor-workspace{border-color:rgba(125,151,183,.12)!important}
      .photo-editor-control-section{border:1px solid rgba(255,255,255,.065)!important;border-radius:14px;padding:14px!important;margin:0 0 10px!important;background:linear-gradient(180deg,rgba(255,255,255,.022),rgba(255,255,255,.009))}
      .photo-editor-control-section:last-child{margin-bottom:0!important}.photo-editor-section-title{margin-bottom:11px!important}.photo-editor-section-title h2{font-size:16px!important}
      .photo-editor-button-grid{gap:7px!important;margin-bottom:10px!important}.photo-editor-button-grid .admin-btn{min-height:39px!important}
      .cff-studio-toolbar{display:flex;gap:7px;align-items:center;overflow-x:auto;padding:0 0 10px;margin:-2px 0 10px;scrollbar-width:none}.cff-studio-toolbar::-webkit-scrollbar{display:none}
      .cff-studio-tool{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;min-height:38px;border:1px solid rgba(137,158,190,.22);border-radius:10px;background:#0d1622;color:#c9d5e8;padding:8px 10px;font:850 11px/1 inherit;cursor:pointer;white-space:nowrap}.cff-studio-tool:hover{border-color:rgba(0,200,255,.48);color:#fff}.cff-studio-tool.is-active{border-color:#00c8ff;background:rgba(0,200,255,.12);color:#e7fbff}.cff-studio-tool.is-accent{background:rgba(0,200,255,.09);border-color:rgba(0,200,255,.35);color:#aeefff}
      .cff-studio-canvas-shell{position:relative;display:flex;justify-content:center;align-items:center;padding:27px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background-color:#d7d7d7;background-image:linear-gradient(45deg,#181818 25%,transparent 25%),linear-gradient(-45deg,#181818 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#181818 75%),linear-gradient(-45deg,transparent 75%,#181818 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}
      .cff-studio-artboard-badge{position:absolute;z-index:12;left:9px;top:8px;padding:5px 7px;border-radius:7px;background:rgba(3,8,14,.88);border:1px solid rgba(255,255,255,.14);color:#eef8ff;font:900 10px/1 Arial,sans-serif;letter-spacing:.04em;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.28)}
      .cff-studio-canvas-shell .photo-editor-stage{margin:0!important;border:2px solid rgba(255,255,255,.92)!important;border-radius:4px!important;box-shadow:0 0 0 1px rgba(0,0,0,.85),0 20px 55px rgba(0,0,0,.5)!important}
      .cff-studio-safe{position:absolute;inset:0;z-index:10;pointer-events:none}.cff-studio-safe[hidden]{display:none!important}.cff-studio-safe::before{content:'';position:absolute;left:5%;right:5%;top:5%;bottom:15%;border:2px dashed rgba(255,220,80,.95);box-shadow:0 0 0 9999px rgba(0,0,0,.08)}.cff-studio-safe::after{content:'5% LATERAIS · 15% BASE';position:absolute;left:6%;bottom:16.5%;background:rgba(0,0,0,.72);color:#ffe56e;border-radius:5px;padding:4px 6px;font:900 9px/1 Arial,sans-serif;letter-spacing:.04em}
      .cff-studio-effects{border-color:rgba(0,200,255,.18)!important;background:linear-gradient(180deg,rgba(0,200,255,.04),rgba(255,255,255,.012))!important}.cff-studio-effects-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.cff-studio-effects-title h2{margin:2px 0 0;font-size:16px}.cff-studio-effects-title small{color:#6fdfff;font-size:10px;font-weight:900}
      .cff-studio-switch{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;margin:7px 0;border:1px solid rgba(255,255,255,.07);border-radius:10px;background:rgba(0,0,0,.13);font-size:12px;color:#dce5f2}.cff-studio-switch span{display:flex;align-items:center;gap:7px}.cff-studio-switch input{width:18px;height:18px;accent-color:#00c8ff}
      .cff-studio-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:8px 0}.cff-studio-mini-grid button{min-height:38px}
      .cff-studio-effect-control{display:grid;gap:5px;margin:9px 0}.cff-studio-effect-control>span{display:flex;justify-content:space-between;gap:8px;color:#aebbd0;font-size:11px}.cff-studio-effect-control output{color:#74e2ff}.cff-studio-effect-control input[type=range]{width:100%;accent-color:#00c8ff}.cff-studio-effect-control input[type=color]{width:100%;height:36px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:#09111b;padding:3px}
      .cff-studio-layers{display:grid;gap:6px;margin:0 0 15px;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.018)}.cff-studio-layers-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}.cff-studio-layers-head strong{font-size:13px}.cff-studio-layers-head small{font-size:10px;color:#7187a2}.cff-studio-layer{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:36px;border:1px solid rgba(255,255,255,.06);border-radius:8px;background:#0a121c;color:#c7d3e4;padding:7px 9px;font:800 11px/1 inherit;cursor:pointer;text-align:left}.cff-studio-layer:hover{border-color:rgba(0,200,255,.35)}.cff-studio-layer span:last-child{color:#6f88a3;font-size:9px;text-transform:uppercase}.cff-studio-layer.is-on span:last-child{color:#71e8b4}
      .cff-studio-section-jump{scroll-margin-top:18px}.cff-studio-badge{display:inline-flex;align-items:center;gap:5px;color:#7d91ab;font-size:10px;font-weight:800}.cff-studio-dot{width:7px;height:7px;border-radius:50%;background:#52677f}.cff-studio-dot.on{background:#31dca0;box-shadow:0 0 9px rgba(49,220,160,.4)}
      @media(max-width:1180px){.photo-editor-layout{grid-template-columns:minmax(310px,355px) minmax(0,1fr)!important}.photo-editor-export{grid-column:1/-1!important}.cff-studio-layers{grid-template-columns:repeat(5,minmax(0,1fr));align-items:stretch}.cff-studio-layers-head{grid-column:1/-1}.cff-studio-layer{height:100%;flex-direction:column;align-items:flex-start}}
      @media(max-width:820px){.photo-editor-layout{display:flex!important;flex-direction:column!important}.photo-editor-workspace{order:1!important}.photo-editor-controls{order:2!important}.photo-editor-export{order:3!important}.cff-studio-canvas-shell{padding:15px;border-radius:12px;background-size:18px 18px;background-position:0 0,0 9px,9px -9px,-9px 0}.cff-studio-toolbar{position:sticky;top:0;z-index:45;background:rgba(7,12,20,.96);padding:7px 0;margin:-4px 0 7px;backdrop-filter:blur(10px)}.cff-studio-tool{min-height:42px;font-size:10px;padding:9px}.cff-studio-effects{padding:13px!important}.cff-studio-mini-grid{grid-template-columns:1fr 1fr}.cff-studio-layers{grid-template-columns:1fr 1fr;padding:10px}.cff-studio-layers-head{grid-column:1/-1}.cff-studio-layer{min-height:42px;flex-direction:row}.photo-editor-control-section{padding:13px!important}.photo-editor-slider-row input[type=range],.cff-studio-effect-control input[type=range]{min-height:32px}.cff-studio-safe::after{font-size:7px}.cff-studio-artboard-badge{font-size:8px}}
      @media(max-width:520px){.cff-studio-canvas-shell{padding:11px}.cff-studio-toolbar{gap:5px}.cff-studio-tool{padding:8px 9px}.cff-studio-mini-grid{grid-template-columns:1fr}.cff-studio-layers{grid-template-columns:1fr 1fr}.photo-editor-heading .admin-muted{display:none}}
    `;
    document.head.appendChild(style);
  }

  function setupArtboard(){
    const stage=$('#photo-editor-stage');
    if(!stage||stage.closest('.cff-studio-canvas-shell')) return;
    const shell=document.createElement('div');shell.className='cff-studio-canvas-shell';
    stage.parentNode.insertBefore(shell,stage);shell.appendChild(stage);
    const badge=document.createElement('div');badge.className='cff-studio-artboard-badge';badge.textContent='ARTE · 3000 × 3749';shell.appendChild(badge);
    const safe=document.createElement('div');safe.id='cff-studio-safe';safe.className='cff-studio-safe';safe.hidden=!settings.safe;stage.appendChild(safe);
  }

  function jump(selector){
    const el=$(selector);const target=el?.closest('.photo-editor-control-section')||el;
    target?.classList.add('cff-studio-section-jump');target?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function setupToolbar(){
    const workspace=$('.photo-editor-workspace'),head=$('.photo-editor-preview-head');
    if(!workspace||!head||$('.cff-studio-toolbar')) return;
    const bar=document.createElement('div');bar.className='cff-studio-toolbar';
    bar.innerHTML=`
      <button class="cff-studio-tool is-accent" data-act="photo" type="button">🖼️ Foto</button>
      <button class="cff-studio-tool" data-act="cover" type="button">▣ Preencher</button>
      <button class="cff-studio-tool" data-act="containblur" type="button">🌫️ Encaixar + blur</button>
      <button class="cff-studio-tool" data-act="blur" type="button">✨ Fundo blur</button>
      <button class="cff-studio-tool" data-act="gradient" type="button">◒ Degradê</button>
      <button class="cff-studio-tool" data-act="readable" type="button">Aa Texto legível</button>
      <button class="cff-studio-tool" data-act="safe" type="button">▦ Margens</button>`;
    head.insertAdjacentElement('afterend',bar);
    bar.addEventListener('click',e=>{
      const btn=e.target.closest('[data-act]');if(!btn)return;
      const act=btn.dataset.act;
      if(act==='photo') $('#photo-editor-file')?.click();
      if(act==='cover') $('#photo-editor-fit-cover')?.click();
      if(act==='containblur'){settings.blur=true;saveSettings();$('#photo-editor-fit-contain')?.click();}
      if(act==='blur'){settings.blur=!settings.blur;saveSettings();}
      if(act==='gradient'){settings.gradient=!settings.gradient;saveSettings();}
      if(act==='readable'){
        settings.gradient=true;settings.gradientHeight=40;settings.gradientOpacity=76;settings.gradientColor='#05070b';
        const shadow=$('#photo-editor-text-shadow');if(shadow&&!shadow.checked){shadow.checked=true;shadow.dispatchEvent(new Event('change',{bubbles:true}));}
        saveSettings();jump('#photo-editor-text');
      }
      if(act==='safe'){settings.safe=!settings.safe;saveSettings();}
    });
  }

  function setupEffects(){
    if($('#cff-studio-effects')) return;
    const imageSection=$('#photo-editor-zoom')?.closest('.photo-editor-control-section');
    const controls=$('.photo-editor-controls');
    if(!imageSection||!controls) return;
    const panel=document.createElement('div');panel.id='cff-studio-effects';panel.className='photo-editor-control-section cff-studio-effects';
    panel.innerHTML=`
      <div class="cff-studio-effects-title"><div><p class="admin-eyebrow">Efeitos</p><h2>Fundo & legibilidade</h2></div><small>não destrutivo</small></div>
      <label class="cff-studio-switch"><span>🌫️ Duplicar foto com blur atrás</span><input id="cff-studio-blur" type="checkbox"></label>
      <div class="cff-studio-mini-grid"><button id="cff-studio-fit-blur" class="admin-btn admin-btn-ghost" type="button">Encaixar + preencher blur</button><button id="cff-studio-blur-off" class="admin-btn admin-btn-ghost" type="button">Limpar efeito</button></div>
      <label class="cff-studio-effect-control"><span>Intensidade do blur <output id="cff-studio-blur-value"></output></span><input id="cff-studio-blur-range" type="range" min="20" max="220" step="5"></label>
      <label class="cff-studio-effect-control"><span>Escurecer fundo <output id="cff-studio-dim-value"></output></span><input id="cff-studio-dim-range" type="range" min="0" max="70" step="1"></label>
      <label class="cff-studio-switch"><span>◒ Degradê inferior para texto</span><input id="cff-studio-gradient" type="checkbox"></label>
      <label class="cff-studio-effect-control"><span>Altura do degradê <output id="cff-studio-gradient-height-value"></output></span><input id="cff-studio-gradient-height" type="range" min="10" max="80" step="1"></label>
      <label class="cff-studio-effect-control"><span>Força do degradê <output id="cff-studio-gradient-opacity-value"></output></span><input id="cff-studio-gradient-opacity" type="range" min="0" max="100" step="1"></label>
      <label class="cff-studio-effect-control"><span>Cor do degradê</span><input id="cff-studio-gradient-color" type="color"></label>
      <label class="cff-studio-switch"><span>▦ Mostrar margem segura 5% / 15%</span><input id="cff-studio-safe-toggle" type="checkbox"></label>`;
    imageSection.insertAdjacentElement('afterend',panel);

    $('#cff-studio-blur',panel).onchange=e=>{settings.blur=e.target.checked;saveSettings();};
    $('#cff-studio-blur-range',panel).oninput=e=>{settings.blurAmount=+e.target.value;saveSettings();};
    $('#cff-studio-dim-range',panel).oninput=e=>{settings.blurDim=+e.target.value;saveSettings();};
    $('#cff-studio-gradient',panel).onchange=e=>{settings.gradient=e.target.checked;saveSettings();};
    $('#cff-studio-gradient-height',panel).oninput=e=>{settings.gradientHeight=+e.target.value;saveSettings();};
    $('#cff-studio-gradient-opacity',panel).oninput=e=>{settings.gradientOpacity=+e.target.value;saveSettings();};
    $('#cff-studio-gradient-color',panel).oninput=e=>{settings.gradientColor=e.target.value;saveSettings();};
    $('#cff-studio-safe-toggle',panel).onchange=e=>{settings.safe=e.target.checked;saveSettings();};
    $('#cff-studio-fit-blur',panel).onclick=()=>{settings.blur=true;saveSettings();$('#photo-editor-fit-contain')?.click();};
    $('#cff-studio-blur-off',panel).onclick=()=>{settings.blur=false;settings.gradient=false;saveSettings();};
  }

  function setupLayers(){
    const exportPanel=$('.photo-editor-export');
    if(!exportPanel||$('.cff-studio-layers')) return;
    const box=document.createElement('div');box.className='cff-studio-layers';
    box.innerHTML=`<div class="cff-studio-layers-head"><strong>Camadas</strong><small>toque para editar</small></div>
      <button class="cff-studio-layer" data-jump="#photo-editor-zoom"><span>🖼️ Foto principal</span><span id="cff-layer-photo">vazia</span></button>
      <button class="cff-studio-layer" data-effect="blur"><span>🌫️ Fundo blur</span><span id="cff-layer-blur">off</span></button>
      <button class="cff-studio-layer" data-jump="#photo-editor-text"><span>🔤 Textos</span><span id="cff-layer-text">1</span></button>
      <button class="cff-studio-layer" data-jump="#photo-editor-pip-file"><span>▣ P.I.P.</span><span id="cff-layer-pip">off</span></button>
      <button class="cff-studio-layer" data-jump="#photo-editor-frame-enabled"><span>▱ Moldura</span><span id="cff-layer-frame">on</span></button>`;
    exportPanel.insertBefore(box,exportPanel.firstElementChild?.nextSibling||exportPanel.firstElementChild);
    box.addEventListener('click',e=>{
      const btn=e.target.closest('.cff-studio-layer');if(!btn)return;
      if(btn.dataset.jump) jump(btn.dataset.jump);
      if(btn.dataset.effect==='blur'){settings.blur=!settings.blur;saveSettings();}
    });
  }

  function syncUi(){
    const s=state();
    const setChecked=(id,v)=>{const el=$(id);if(el&&el.checked!==!!v)el.checked=!!v;};
    const setValue=(id,v)=>{const el=$(id);if(el&&String(el.value)!==String(v))el.value=String(v);};
    const setText=(id,v)=>{const el=$(id);if(el&&el.textContent!==String(v))el.textContent=String(v);};
    setChecked('#cff-studio-blur',settings.blur);setValue('#cff-studio-blur-range',settings.blurAmount);setText('#cff-studio-blur-value',`${settings.blurAmount}px`);
    setValue('#cff-studio-dim-range',settings.blurDim);setText('#cff-studio-dim-value',`${settings.blurDim}%`);
    setChecked('#cff-studio-gradient',settings.gradient);setValue('#cff-studio-gradient-height',settings.gradientHeight);setText('#cff-studio-gradient-height-value',`${settings.gradientHeight}%`);
    setValue('#cff-studio-gradient-opacity',settings.gradientOpacity);setText('#cff-studio-gradient-opacity-value',`${settings.gradientOpacity}%`);setValue('#cff-studio-gradient-color',settings.gradientColor);
    setChecked('#cff-studio-safe-toggle',settings.safe);const safe=$('#cff-studio-safe');if(safe)safe.hidden=!settings.safe;
    $$('[data-act="blur"]').forEach(el=>el.classList.toggle('is-active',!!settings.blur));$$('[data-act="gradient"]').forEach(el=>el.classList.toggle('is-active',!!settings.gradient));$$('[data-act="safe"]').forEach(el=>el.classList.toggle('is-active',!!settings.safe));
    const photo=!!s?.image,pipCount=Array.isArray(s?.pips)?s.pips.length:(s?.pip?1:0),pip=pipCount>0,frame=s?.frameEnabled!==false,textCount=Array.isArray(s?.texts)?s.texts.length:1;
    setText('#cff-layer-photo',photo?'on':'vazia');setText('#cff-layer-blur',settings.blur?'on':'off');setText('#cff-layer-text',textCount);setText('#cff-layer-pip',pip?String(pipCount):'off');setText('#cff-layer-frame',frame?'on':'off');
    const layerMap=[['#cff-layer-photo',photo],['#cff-layer-blur',settings.blur],['#cff-layer-pip',pip],['#cff-layer-frame',frame]];
    layerMap.forEach(([id,on])=>$(id)?.closest('.cff-studio-layer')?.classList.toggle('is-on',!!on));
  }

  function bindSync(){
    const app=$('#photo-editor-app');if(!app||app.dataset.studioSync==='1')return;app.dataset.studioSync='1';
    app.addEventListener('input',()=>setTimeout(syncUi,0),true);app.addEventListener('change',()=>setTimeout(syncUi,0),true);app.addEventListener('click',()=>setTimeout(syncUi,40),true);
    setInterval(syncUi,1200);
  }

  function enhance(){
    const s=state();if(!s)return;
    s.cffBlurFill=!!settings.blur;s.cffBlurAmount=settings.blurAmount;s.cffBlurDim=settings.blurDim;s.cffGradientEnabled=!!settings.gradient;s.cffGradientHeight=settings.gradientHeight;s.cffGradientOpacity=settings.gradientOpacity;s.cffGradientColor=settings.gradientColor;
    addStyles();installCanvasEffects();setupArtboard();setupToolbar();setupEffects();setupLayers();bindSync();syncUi();rerender();
  }

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(state()&&!$('#photo-editor-app')?.hidden&&$('#photo-editor-stage')){clearInterval(timer);setTimeout(enhance,120);}
      else if(tries>180)clearInterval(timer);
    },100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();