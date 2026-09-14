(()=>{
  'use strict';
  if(window.__CFF_ADMIN_EDICAO_ENHANCEMENTS__) return;
  window.__CFF_ADMIN_EDICAO_ENHANCEMENTS__=true;

  const OVERLAYS={
    classic:{label:'Clássica',url:'edition/degrade.png?v=20260914-degrade-v2',file:'degrade.png'},
    format2:{label:'Formato 2',url:'edition/novo%20formato%202.png?v=20260914-formato2-v1',file:'novo-formato-2.png'}
  };
  const OVERLAY_STORAGE='cff-admin-photo-editor-overlay-v1';
  const PROFILE_CROP_PERCENT=((3000-(3749*3/4))/2/3000)*100;
  let activeOverlay='';

  const $=s=>document.querySelector(s);

  function addStyles(){
    if($('#cff-edicao-enhancement-styles')) return;
    const style=document.createElement('style');
    style.id='cff-edicao-enhancement-styles';
    style.textContent=`
      .photo-editor-stage.is-empty-clickable{cursor:pointer;outline:none}
      .photo-editor-stage.is-empty-clickable:hover .photo-editor-empty{border-color:rgba(0,200,255,.62);background:rgba(0,200,255,.065)}
      .photo-editor-empty{transition:border-color .16s ease,background .16s ease,transform .16s ease}
      .photo-editor-stage.is-empty-clickable:hover .photo-editor-empty{transform:scale(.995)}
      .photo-editor-preview-head{flex-wrap:wrap}
      .cff-edicao-grid-controls,.cff-edicao-template-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;flex-basis:100%;width:100%;margin-top:8px}
      .cff-edicao-grid-label,.cff-edicao-template-label{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted,#8fa0bd);margin-right:2px}
      .cff-edicao-grid-btn,.cff-edicao-template-btn{border:1px solid rgba(145,165,205,.24);background:rgba(255,255,255,.035);color:#c8d3e8;border-radius:9px;padding:8px 10px;font:800 11px/1 inherit;cursor:pointer;transition:.15s ease;min-height:34px}
      .cff-edicao-grid-btn:hover,.cff-edicao-template-btn:hover{border-color:rgba(0,200,255,.5);color:#fff}
      .cff-edicao-grid-btn.is-active,.cff-edicao-template-btn.is-active{background:rgba(0,200,255,.13);border-color:#00c8ff;color:#fff;box-shadow:inset 0 0 0 1px rgba(0,200,255,.08)}
      .cff-edicao-grid-note{width:100%;font-size:11px;color:var(--text-muted,#8fa0bd);line-height:1.35;margin-top:1px}
      .cff-edicao-visual-grid{position:absolute;inset:0;z-index:8;pointer-events:none;overflow:hidden;border-radius:inherit}
      .cff-grid-line{position:absolute;background:rgba(0,220,255,.92);box-shadow:0 0 0 1px rgba(0,0,0,.2)}
      .cff-grid-line.v{top:0;bottom:0;width:2px}.cff-grid-line.h{left:0;right:0;height:2px}
      .cff-grid-mask{position:absolute;background:rgba(0,0,0,.40);backdrop-filter:brightness(.82)}
      .cff-grid-mask.side{top:0;bottom:0}.cff-grid-mask.horizontal{left:0;right:0}
      .cff-grid-safe{position:absolute;border:3px dashed rgba(255,214,0,.95);inset:5%;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.10)}
      .cff-grid-safe::after{content:'ÁREA SEGURA';position:absolute;top:8px;left:10px;color:#ffe052;background:rgba(0,0,0,.62);padding:4px 7px;border-radius:5px;font:900 11px/1.1 Arial,sans-serif;letter-spacing:.06em}
      .cff-grid-crop-label{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:2;background:rgba(0,0,0,.72);color:#fff;padding:5px 8px;border-radius:6px;font:900 11px/1.1 Arial,sans-serif;letter-spacing:.05em;white-space:nowrap}
      .cff-edicao-top-save{font-weight:950!important;box-shadow:0 8px 24px rgba(0,200,255,.13)}
      .cff-edicao-preview-save{display:none;border:1px solid #00c8ff;background:#00c8ff;color:#03111a;border-radius:9px;padding:7px 10px;font:950 11px/1 inherit;cursor:pointer;white-space:nowrap}
      .cff-edicao-preview-save:disabled,.cff-edicao-top-save:disabled{opacity:.45;cursor:not-allowed}
      .cff-edicao-quick-nav{display:flex;gap:7px;overflow-x:auto;padding:0 0 13px;margin:0 0 18px;border-bottom:1px solid rgba(255,255,255,.09);scrollbar-width:none}
      .cff-edicao-quick-nav::-webkit-scrollbar{display:none}
      .cff-edicao-quick-btn{flex:0 0 auto;border:1px solid rgba(145,165,205,.2);background:rgba(255,255,255,.035);color:#aebbd0;border-radius:999px;padding:8px 11px;font:850 11px/1 inherit;cursor:pointer;white-space:nowrap}
      .cff-edicao-quick-btn:first-child{border-color:rgba(0,200,255,.4);background:rgba(0,200,255,.08);color:#dff9ff}
      .photo-editor-control-section.cff-primary-text{padding:16px;border:1px solid rgba(0,200,255,.16);border-radius:14px;background:linear-gradient(180deg,rgba(0,200,255,.035),rgba(255,255,255,.012));margin-bottom:18px}
      .photo-editor-control-section.cff-primary-text .photo-editor-section-title{margin-bottom:12px}
      @media(max-width:1180px) and (min-width:821px){
        .photo-editor-layout{grid-template-columns:minmax(300px,340px) minmax(0,1fr)}
        .photo-editor-stage{width:min(100%,61vh)}
        .photo-editor-controls{padding:14px}
        .photo-editor-control-section{margin-bottom:16px;padding-bottom:16px}
      }
      @media(max-width:820px){
        .photo-editor-heading{gap:12px}.photo-editor-heading>div:first-child{width:100%}
        .photo-editor-heading h1{font-size:28px}.photo-editor-heading .admin-muted{font-size:12px;line-height:1.45}
        .photo-editor-heading-actions{display:grid!important;grid-template-columns:1.1fr 1fr 1fr;gap:7px;position:relative;z-index:35}
        .photo-editor-heading-actions .admin-btn,.photo-editor-heading-actions label{width:100%;min-width:0;min-height:42px;padding:9px 8px!important;font-size:11px!important;text-align:center}
        .cff-edicao-preview-save{display:inline-flex;align-items:center;justify-content:center;margin-left:auto}
        .photo-editor-preview-head>div:first-child{min-width:0}.photo-editor-preview-head #photo-editor-canvas-status{display:none}
        .cff-edicao-template-controls{order:3;margin-top:5px}.cff-edicao-grid-controls{order:4;margin-top:2px}
        .cff-edicao-template-label,.cff-edicao-grid-label{width:100%;margin:2px 0 0}
        .cff-edicao-grid-note{display:none}
        .cff-edicao-grid-btn,.cff-edicao-template-btn{min-height:38px;padding:9px 11px;font-size:10px}
        .photo-editor-controls{padding:12px!important;background:rgba(10,15,25,.88)}
        .cff-edicao-quick-nav{position:relative;margin-bottom:12px;padding-bottom:11px}
        .cff-edicao-quick-btn{min-height:38px;padding:9px 12px}
        .photo-editor-control-section:not(.cff-primary-text){padding:14px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.018);margin-bottom:10px}
        .photo-editor-control-section.cff-primary-text{padding:14px;margin-bottom:10px}
        .photo-editor-button-grid .admin-btn,.photo-editor-control-section .admin-btn{min-height:42px}
        .photo-editor-slider-row input[type="range"]{min-height:30px}
        #photo-editor-text{min-height:100px;font-size:16px;line-height:1.35}
        .admin-field input,.admin-field select,.admin-field textarea{font-size:16px}
        .photo-editor-export{padding:14px}
      }
      @media(max-width:560px){
        .photo-editor-heading-actions{grid-template-columns:1fr 1fr}.cff-edicao-top-save{grid-column:1/-1}
        .photo-editor-stage{width:min(100%,34vh)}
        .photo-editor-workspace{padding:8px!important}
        .photo-editor-preview-head h2{font-size:12px!important}
        .cff-edicao-grid-controls,.cff-edicao-template-controls{gap:5px}
        .cff-edicao-grid-btn,.cff-edicao-template-btn{flex:1 1 auto;padding:8px 7px}
        .photo-editor-button-grid{gap:6px}.photo-editor-two-cols{gap:7px}
      }
    `;
    document.head.appendChild(style);
  }

  function hideLegacyFrameControls(){
    const input=$('#photo-editor-frame-enabled');
    const section=input?.closest('.photo-editor-control-section');
    if(section) section.hidden=true;
  }

  function storedOverlay(){
    try{return OVERLAYS[localStorage.getItem(OVERLAY_STORAGE)]?localStorage.getItem(OVERLAY_STORAGE):'classic';}catch{return 'classic';}
  }

  function syncTemplateButtons(key){
    document.querySelectorAll('[data-cff-overlay]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.cffOverlay===key));
  }

  async function applyOverlay(key='classic'){
    const overlay=OVERLAYS[key]||OVERLAYS.classic;
    const normalized=OVERLAYS[key]?key:'classic';
    if(activeOverlay===normalized){syncTemplateButtons(normalized);return;}
    const input=$('#photo-editor-frame-file');
    const enabled=$('#photo-editor-frame-enabled');
    const app=$('#photo-editor-app');
    if(!input||!enabled||!app||app.hidden) return;
    try{
      document.querySelectorAll('[data-cff-overlay]').forEach(btn=>btn.disabled=true);
      const response=await fetch(overlay.url,{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob=await response.blob();
      const file=new File([blob],overlay.file,{type:blob.type||'image/png'});
      const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;
      enabled.checked=true;enabled.dispatchEvent(new Event('change',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
      activeOverlay=normalized;
      try{localStorage.setItem(OVERLAY_STORAGE,normalized);}catch{}
      syncTemplateButtons(normalized);
    }catch(error){
      console.error('Não foi possível carregar a moldura oficial do editor.',error);
    }finally{
      document.querySelectorAll('[data-cff-overlay]').forEach(btn=>btn.disabled=false);
    }
  }

  function setupTemplatePicker(){
    const head=$('.photo-editor-preview-head');
    if(!head||$('.cff-edicao-template-controls')) return;
    const controls=document.createElement('div');
    controls.className='cff-edicao-template-controls';
    controls.innerHTML=`<span class="cff-edicao-template-label">Moldura</span>${Object.entries(OVERLAYS).map(([key,item])=>`<button type="button" class="cff-edicao-template-btn" data-cff-overlay="${key}">${item.label}</button>`).join('')}`;
    head.appendChild(controls);
    controls.addEventListener('click',e=>{const btn=e.target.closest('[data-cff-overlay]');if(btn)applyOverlay(btn.dataset.cffOverlay);});
    syncTemplateButtons(storedOverlay());
  }

  function setupEmptyClick(){
    const stage=$('#photo-editor-stage'),empty=$('#photo-editor-empty'),file=$('#photo-editor-file');
    if(!stage||!empty||!file||stage.dataset.emptyPickerReady==='1') return;
    stage.dataset.emptyPickerReady='1';
    empty.innerHTML='<strong>Clique para adicionar a foto que vai entrar na arte</strong><span>PNG, JPG ou WEBP</span>';
    const sync=()=>{
      const visible=!empty.hidden&&!empty.classList.contains('is-hidden');
      stage.classList.toggle('is-empty-clickable',visible);
      if(visible){stage.setAttribute('role','button');stage.setAttribute('aria-label','Adicionar foto à arte');}
      else{stage.removeAttribute('role');stage.setAttribute('aria-label','Área de edição. Arraste a foto para reposicionar.');}
    };
    stage.addEventListener('click',e=>{const visible=!empty.hidden&&!empty.classList.contains('is-hidden');if(visible){e.preventDefault();file.click();}});
    stage.addEventListener('keydown',e=>{const visible=!empty.hidden&&!empty.classList.contains('is-hidden');if(visible&&(e.key==='Enter'||e.key===' ')){e.preventDefault();file.click();}});
    const observer=new MutationObserver(sync);observer.observe(empty,{attributes:true,attributeFilter:['hidden','class']});sync();
  }

  function gridMarkup(mode){
    if(mode==='profile'){
      const p=PROFILE_CROP_PERCENT;
      return `<div class="cff-grid-mask side" style="left:0;width:${p}%"></div><div class="cff-grid-mask side" style="right:0;width:${p}%"></div><div class="cff-grid-line v" style="left:${p}%"></div><div class="cff-grid-line v" style="right:${p}%"></div><div class="cff-grid-crop-label">PERFIL 3:4 · LATERAIS PODEM CORTAR</div>`;
    }
    if(mode==='safe') return '<div class="cff-grid-safe"></div>';
    if(mode==='thirds') return '<div class="cff-grid-line v" style="left:33.333%"></div><div class="cff-grid-line v" style="left:66.666%"></div><div class="cff-grid-line h" style="top:33.333%"></div><div class="cff-grid-line h" style="top:66.666%"></div>';
    if(mode==='square'){
      const p=((3749-3000)/2/3749)*100;
      return `<div class="cff-grid-mask horizontal" style="top:0;height:${p}%"></div><div class="cff-grid-mask horizontal" style="bottom:0;height:${p}%"></div><div class="cff-grid-line h" style="top:${p}%"></div><div class="cff-grid-line h" style="bottom:${p}%"></div><div class="cff-grid-crop-label">RECORTE 1:1</div>`;
    }
    if(mode==='center') return '<div class="cff-grid-line v" style="left:50%"></div><div class="cff-grid-line h" style="top:50%"></div>';
    return '';
  }

  function setupVisualGrids(){
    const stage=$('#photo-editor-stage'),head=$('.photo-editor-preview-head');
    if(!stage||!head||$('#photo-editor-visual-grid')) return;
    if(getComputedStyle(stage).position==='static') stage.style.position='relative';
    const overlay=document.createElement('div');overlay.id='photo-editor-visual-grid';overlay.className='cff-edicao-visual-grid';overlay.setAttribute('aria-hidden','true');stage.appendChild(overlay);
    const controls=document.createElement('div');controls.className='cff-edicao-grid-controls';
    const modes=[['none','Sem grade'],['profile','Perfil 3:4'],['safe','Área segura'],['thirds','Terços'],['center','Centro'],['square','1:1']];
    controls.innerHTML=`<span class="cff-edicao-grid-label">Visualização</span>${modes.map(([key,label])=>`<button type="button" class="cff-edicao-grid-btn${key==='none'?' is-active':''}" data-grid="${key}">${label}</button>`).join('')}<div class="cff-edicao-grid-note">As grades servem apenas para visualização e nunca entram na arte exportada. “Perfil 3:4” sombreia o corte lateral da grade do perfil sobre a arte 4:5.</div>`;
    head.appendChild(controls);
    controls.addEventListener('click',e=>{const btn=e.target.closest('[data-grid]');if(!btn)return;controls.querySelectorAll('[data-grid]').forEach(el=>el.classList.toggle('is-active',el===btn));const mode=btn.dataset.grid||'none';overlay.innerHTML=gridMarkup(mode);overlay.dataset.mode=mode;});
  }

  function reorderControls(){
    const controls=$('.photo-editor-controls');
    const textSection=$('#photo-editor-text')?.closest('.photo-editor-control-section');
    if(!controls||!textSection) return;
    textSection.classList.add('cff-primary-text');
    controls.insertBefore(textSection,controls.firstElementChild);
  }

  function setupQuickNav(){
    const controls=$('.photo-editor-controls');
    if(!controls||$('.cff-edicao-quick-nav')) return;
    const items=[['Texto','#photo-editor-text'],['Imagem','#photo-editor-zoom'],['Ajustes','#photo-editor-brightness'],['P.I.P.','#photo-editor-pip-file'],['Exportar','.photo-editor-export']];
    const nav=document.createElement('nav');nav.className='cff-edicao-quick-nav';nav.setAttribute('aria-label','Atalhos do editor');
    nav.innerHTML=items.map(([label,target])=>`<button type="button" class="cff-edicao-quick-btn" data-target="${target}">${label}</button>`).join('');
    controls.insertBefore(nav,controls.firstElementChild);
    nav.addEventListener('click',e=>{const btn=e.target.closest('[data-target]');if(!btn)return;const target=$(btn.dataset.target);const section=target?.closest('.photo-editor-control-section')||target;section?.scrollIntoView({behavior:'smooth',block:'start'});if(target&&['TEXTAREA','INPUT','SELECT'].includes(target.tagName))setTimeout(()=>target.focus({preventScroll:true}),350);});
  }

  function setupTopSave(){
    const actions=$('.photo-editor-heading-actions'),download=$('#photo-editor-download'),head=$('.photo-editor-preview-head');
    if(!actions||!download||!head||$('#photo-editor-save-top')) return;
    const top=document.createElement('button');top.id='photo-editor-save-top';top.type='button';top.className='admin-btn admin-btn-primary cff-edicao-top-save';top.textContent='💾 Salvar imagem';actions.insertBefore(top,actions.firstChild);
    const preview=document.createElement('button');preview.id='photo-editor-save-preview';preview.type='button';preview.className='cff-edicao-preview-save';preview.textContent='💾 Salvar';head.appendChild(preview);
    const save=()=>{if(!download.disabled)download.click();};top.addEventListener('click',save);preview.addEventListener('click',save);
    const sync=()=>{top.disabled=download.disabled;preview.disabled=download.disabled;};new MutationObserver(sync).observe(download,{attributes:true,attributeFilter:['disabled']});sync();
  }

  function improveLabels(){
    const add=$('.photo-editor-file-button');if(add&&add.firstChild)add.firstChild.textContent='+ Foto ';
    const reset=$('#photo-editor-reset-all');if(reset)reset.textContent='↺ Resetar';
  }

  function loadAutosave(){
    if(document.querySelector('script[data-cff-edicao-autosave]'))return;
    const script=document.createElement('script');
    script.src='js/admin-edicao-autosave.js?v=20260914-autosave-v1';
    script.dataset.cffEdicaoAutosave='1';
    document.head.appendChild(script);
  }

  function enhance(){
    addStyles();
    hideLegacyFrameControls();
    reorderControls();
    setupQuickNav();
    setupTopSave();
    improveLabels();
    setupEmptyClick();
    setupTemplatePicker();
    setupVisualGrids();
    loadAutosave();
    setTimeout(()=>applyOverlay(storedOverlay()),220);
  }

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{tries++;const app=$('#photo-editor-app');if(app&&!app.hidden&&$('#photo-editor-frame-file')){clearInterval(timer);setTimeout(enhance,80);}else if(tries>120){clearInterval(timer);}},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
