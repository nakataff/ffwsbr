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
  const EDITOR_TAB_KEY='cff-admin-edicao-active-tab-v1';
  const EDITOR_TAB_MAGNET_KEY='cff-admin-edicao-tab-magnet-v1';
  const editorState=()=>window.__CFF_ADMIN_EDICAO_STATE__||null;
  let activeEditorTab=localStorage.getItem(EDITOR_TAB_KEY)||'image',textDrag=null,textOverlayRaf=0,textMeasureCtx=null;

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
      .cff-edicao-quick-btn.is-active{border-color:#00c8ff;background:rgba(0,200,255,.12);color:#effcff;box-shadow:inset 0 0 0 1px rgba(0,200,255,.08)}
      .cff-editor-history-btn{min-width:104px}.cff-editor-history-btn:disabled{opacity:.35!important;cursor:not-allowed!important}
      .cff-preview-control-groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0 12px}
      .cff-preview-group{min-width:0;border:1px solid rgba(145,165,205,.16);border-radius:11px;background:rgba(255,255,255,.018);overflow:hidden}
      .cff-preview-group>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:38px;padding:9px 11px;cursor:pointer;list-style:none;color:#9ab0c9;font:950 10px/1 inherit;letter-spacing:.07em}
      .cff-preview-group>summary::-webkit-details-marker{display:none}.cff-preview-group[open]>summary{color:#dffaff;background:rgba(0,200,255,.055);border-bottom:1px solid rgba(255,255,255,.06)}.cff-preview-group[open]>summary span{transform:rotate(180deg)}
      .cff-preview-group-body{padding:9px}.cff-preview-group-body .cff-edicao-template-controls,.cff-preview-group-body .cff-edicao-grid-controls,.cff-preview-group-body .cff-studio-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;width:100%;margin:0;padding:0;border:0}
      .cff-preview-group-body .cff-edicao-grid-note{margin-top:4px;font-size:9px}
      .cff-preview-zoom{display:flex;align-items:center;gap:5px;margin-left:auto}.cff-preview-zoom button{border:1px solid rgba(145,165,205,.18);background:#0b1420;color:#bcd0e5;border-radius:7px;min-width:28px;height:28px;padding:0 7px;font:900 11px/1 inherit;cursor:pointer}.cff-preview-zoom output{min-width:42px;text-align:center;color:#79dff5;font-size:10px;font-weight:900}.cff-preview-zoom .cff-preview-fit{min-width:auto;padding:0 8px}
      .cff-edicao-tab-magnet{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:-10px 0 15px;padding:8px 2px 11px;border-bottom:1px solid rgba(255,255,255,.07);color:#8194ad;font-size:10px;font-weight:850}.cff-edicao-tab-magnet label{display:flex;align-items:center;gap:7px;cursor:pointer}.cff-edicao-tab-magnet input{width:16px;height:16px;accent-color:#00c8ff}.cff-edicao-tab-magnet small{color:#60758f;font-size:9px}
      .photo-editor-control-section.cff-tab-hidden{display:none!important}
      .cff-text-hit{position:absolute;z-index:92;box-sizing:border-box;transform:translate(-50%,-50%);border:1.5px solid transparent;cursor:move;touch-action:none;pointer-events:auto}
      .cff-text-hit:hover{border-color:rgba(0,200,255,.34)}.cff-text-hit.is-selected{border-color:#16d7ff;box-shadow:0 0 0 1px rgba(255,255,255,.42),0 0 0 3px rgba(0,200,255,.08)}
      .cff-text-hit-label{position:absolute;left:0;top:-20px;display:none;padding:3px 5px;border-radius:5px;background:rgba(3,9,15,.88);border:1px solid rgba(22,215,255,.35);color:#c9f8ff;font:900 8px/1 Arial,sans-serif;white-space:nowrap;pointer-events:none}.cff-text-hit.is-selected .cff-text-hit-label{display:block}
      .cff-text-live{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;white-space:pre;overflow:visible;font-weight:700;pointer-events:none;user-select:none}
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
        .cff-preview-control-groups{grid-template-columns:1fr 1fr 1fr;gap:5px}.cff-preview-group>summary{padding:8px 7px;font-size:9px}.cff-preview-group-body{padding:7px}.cff-preview-zoom{width:100%;justify-content:flex-end;margin-top:5px}.cff-editor-history-btn{min-width:0!important}
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

  function ensurePreviewGroups(){
    const workspace=$('.photo-editor-workspace'),head=$('.photo-editor-preview-head');if(!workspace||!head)return null;
    let root=$('#cff-preview-control-groups');if(root)return root;
    root=document.createElement('div');root.id='cff-preview-control-groups';root.className='cff-preview-control-groups';head.insertAdjacentElement('afterend',root);return root;
  }

  function previewGroup(key,label){
    const root=ensurePreviewGroups();if(!root)return null;
    let details=root.querySelector(`[data-preview-group="${key}"]`);if(details)return details.querySelector('.cff-preview-group-body');
    details=document.createElement('details');details.className='cff-preview-group';details.dataset.previewGroup=key;
    details.innerHTML=`<summary>${label}<span aria-hidden="true">⌄</span></summary><div class="cff-preview-group-body"></div>`;
    const saved=localStorage.getItem(`cff-preview-group-${key}`);details.open=saved==='1';
    details.addEventListener('toggle',()=>localStorage.setItem(`cff-preview-group-${key}`,details.open?'1':'0'));
    root.appendChild(details);return details.querySelector('.cff-preview-group-body');
  }

  function setupTemplatePicker(){
    const body=previewGroup('frame','MOLDURA');
    if(!body||body.querySelector('.cff-edicao-template-controls')) return;
    const controls=document.createElement('div');controls.className='cff-edicao-template-controls';
    controls.innerHTML=Object.entries(OVERLAYS).map(([key,item])=>`<button type="button" class="cff-edicao-template-btn" data-cff-overlay="${key}">${item.label}</button>`).join('');
    body.appendChild(controls);
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
    const stage=$('#photo-editor-stage'),body=previewGroup('grid','GRADES');
    if(!stage||!body||$('#photo-editor-visual-grid')) return;
    if(getComputedStyle(stage).position==='static') stage.style.position='relative';
    const overlay=document.createElement('div');overlay.id='photo-editor-visual-grid';overlay.className='cff-edicao-visual-grid';overlay.setAttribute('aria-hidden','true');stage.appendChild(overlay);
    const controls=document.createElement('div');controls.className='cff-edicao-grid-controls';
    const modes=[['none','Sem grade'],['profile','Perfil 3:4'],['safe','Área segura'],['thirds','Terços'],['center','Centro'],['square','1:1']];
    controls.innerHTML=`${modes.map(([key,label])=>`<button type="button" class="cff-edicao-grid-btn${key==='none'?' is-active':''}" data-grid="${key}">${label}</button>`).join('')}<div class="cff-edicao-grid-note">Só visualização; nunca entra na arte exportada.</div>`;
    body.appendChild(controls);
    controls.addEventListener('click',e=>{const btn=e.target.closest('[data-grid]');if(!btn)return;controls.querySelectorAll('[data-grid]').forEach(el=>el.classList.toggle('is-active',el===btn));const mode=btn.dataset.grid||'none';overlay.innerHTML=gridMarkup(mode);overlay.dataset.mode=mode;});
  }

  function setupPreviewZoom(){
    const head=$('.photo-editor-preview-head'),stage=$('#photo-editor-stage');if(!head||!stage||$('#cff-preview-zoom'))return;
    const box=document.createElement('div');box.id='cff-preview-zoom';box.className='cff-preview-zoom';
    box.innerHTML='<button type="button" data-z="-10" title="Diminuir preview">−</button><output>100%</output><button type="button" data-z="10" title="Aumentar preview">+</button><button type="button" data-fit="1" class="cff-preview-fit">Ajustar</button>';
    head.appendChild(box);
    let value=Math.min(120,Math.max(45,Number(localStorage.getItem('cff-preview-zoom-v1'))||100));
    const apply=v=>{value=Math.min(120,Math.max(45,v));stage.style.zoom=String(value/100);box.querySelector('output').textContent=`${value}%`;localStorage.setItem('cff-preview-zoom-v1',String(value));window.dispatchEvent(new Event('resize'));};
    box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.z)apply(value+Number(b.dataset.z));else if(b.dataset.fit){const workspace=$('.photo-editor-workspace'),available=Math.max(360,(workspace?.clientHeight||window.innerHeight)-220),base=stage.offsetHeight||1;apply(Math.min(100,Math.max(45,Math.floor((available/base)*100/5)*5)));}});
    apply(value);
    window.__CFF_ADMIN_EDICAO_SET_PREVIEW_ZOOM__=apply;
  }

  function reorderControls(){
    const controls=$('.photo-editor-controls');
    const textSection=$('#photo-editor-text')?.closest('.photo-editor-control-section');
    if(!controls||!textSection) return;
    textSection.classList.add('cff-primary-text');
    controls.insertBefore(textSection,controls.firstElementChild);
  }

  function classifyControlSections(){
    const controls=$('.photo-editor-controls');if(!controls)return;
    const map=[
      ['#photo-editor-zoom','image'],['#photo-editor-frame-enabled','image'],
      ['#photo-editor-brightness','adjust'],['#cff-studio-effects','adjust'],
      ['#photo-editor-pip-file','pip'],['#photo-editor-text','text']
    ];
    map.forEach(([selector,tab])=>{const target=$(selector),section=target?.closest('.photo-editor-control-section')||(target?.classList?.contains('photo-editor-control-section')?target:null);if(section)section.dataset.editorTab=tab;});
  }

  function tabMagnetEnabled(){
    const raw=localStorage.getItem(EDITOR_TAB_MAGNET_KEY);
    return raw===null?true:raw!=='0';
  }

  function applyEditorTab(tab,{store=true}={}){
    const allowed=['text','image','adjust','pip'];activeEditorTab=allowed.includes(tab)?tab:'image';
    classifyControlSections();
    document.querySelectorAll('.photo-editor-controls .photo-editor-control-section[data-editor-tab]').forEach(section=>section.classList.toggle('cff-tab-hidden',section.dataset.editorTab!==activeEditorTab));
    document.querySelectorAll('.cff-edicao-quick-btn[data-editor-tab]').forEach(btn=>{const on=btn.dataset.editorTab===activeEditorTab;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',String(on));});
    if(store)localStorage.setItem(EDITOR_TAB_KEY,activeEditorTab);
  }

  function setupQuickNav(){
    const controls=$('.photo-editor-controls');
    if(!controls||$('.cff-edicao-quick-nav')) return;
    const items=[['Texto','text'],['Imagem','image'],['Ajustes','adjust'],['P.I.P.','pip']];
    const nav=document.createElement('nav');nav.className='cff-edicao-quick-nav';nav.setAttribute('aria-label','Abas do editor');nav.setAttribute('role','tablist');
    nav.innerHTML=items.map(([label,tab])=>`<button type="button" role="tab" class="cff-edicao-quick-btn" data-editor-tab="${tab}">${label}</button>`).join('');
    const magnet=document.createElement('div');magnet.className='cff-edicao-tab-magnet';magnet.innerHTML=`<label><input id="cff-edicao-tab-magnet" type="checkbox"> Ímã de aba</label><small>seleção no preview abre a aba certa</small>`;
    controls.insertBefore(magnet,controls.firstElementChild);controls.insertBefore(nav,magnet);
    nav.addEventListener('click',e=>{const btn=e.target.closest('[data-editor-tab]');if(btn)applyEditorTab(btn.dataset.editorTab);});
    const toggle=$('#cff-edicao-tab-magnet');if(toggle){toggle.checked=tabMagnetEnabled();toggle.addEventListener('change',()=>localStorage.setItem(EDITOR_TAB_MAGNET_KEY,toggle.checked?'1':'0'));}
    const observer=new MutationObserver(()=>{classifyControlSections();applyEditorTab(activeEditorTab,{store:false});});observer.observe(controls,{childList:true,subtree:true});
    window.__CFF_ADMIN_EDICAO_OPEN_TAB__=tab=>applyEditorTab(tab);
    classifyControlSections();applyEditorTab(activeEditorTab,{store:false});
  }

  function textMeasure(){
    if(textMeasureCtx)return textMeasureCtx;
    const canvas=document.createElement('canvas');textMeasureCtx=canvas.getContext('2d');return textMeasureCtx;
  }

  function textGeometry(layer){
    const text=String(layer?.text||'');if(!text.trim())return null;
    const size=Math.min(500,Math.max(40,Number(layer.size)||190)),spacing=Math.min(180,Math.max(70,Number(layer.spacing)||106))/100,lineH=size*spacing,lines=text.toUpperCase().split(/\r?\n/),m=textMeasure();
    m.font=`700 ${size}px "${String(layer.font||'Avilock').replace(/"/g,'')}", sans-serif`;
    const width=Math.max(size*.8,...lines.map(line=>m.measureText(line||' ').width))+size*.18,height=Math.max(size,((lines.length-1)*lineH)+size*1.08);
    return{x:Math.min(95,Math.max(5,Number(layer.x)||50)),y:Math.min(94,Math.max(8,Number(layer.y)||86)),widthPct:Math.min(98,Math.max(3,(width/3000)*100)),heightPct:Math.min(98,Math.max(2,(height/3749)*100))};
  }

  function scheduleTextOverlaySync(){
    if(textOverlayRaf)return;textOverlayRaf=requestAnimationFrame(()=>{textOverlayRaf=0;syncTextOverlays();});
  }

  function syncTextOverlays(){
    const s=editorState(),stage=$('#photo-editor-stage');if(!s||!stage)return;
    const valid=new Set((s.texts||[]).map(t=>t.id));
    stage.querySelectorAll('.cff-text-hit').forEach(el=>{if(!valid.has(el.dataset.textId))el.remove();});
    (s.texts||[]).forEach((layer,index)=>{
      const g=textGeometry(layer);let el=stage.querySelector(`.cff-text-hit[data-text-id="${CSS.escape(layer.id)}"]`);
      if(!g){el?.remove();return;}
      if(!el){el=document.createElement('div');el.className='cff-text-hit';el.dataset.textId=layer.id;el.innerHTML='<div class="cff-text-live"></div><span class="cff-text-hit-label"></span>';stage.appendChild(el);}
      el.style.left=`${g.x}%`;el.style.top=`${g.y}%`;el.style.width=`${g.widthPct}%`;el.style.height=`${g.heightPct}%`;el.querySelector('.cff-text-hit-label').textContent=`Texto ${index+1}`;
      const live=el.querySelector('.cff-text-live'),stageW=stage.getBoundingClientRect().width||1,scale=stageW/3000,size=Math.min(500,Math.max(40,Number(layer.size)||190)),spacing=Math.min(180,Math.max(70,Number(layer.spacing)||106))/100;
      live.textContent=String(layer.text||'').toUpperCase();live.style.fontFamily=`"${String(layer.font||'Avilock').replace(/"/g,'')}", Impact, sans-serif`;live.style.fontSize=`${size*scale}px`;live.style.lineHeight=String(spacing);live.style.color=layer.color||'#fff';live.style.textShadow=layer.shadow?`0 ${Math.max(1,size*.035*scale)}px ${Math.max(2,size*.08*scale)}px rgba(0,0,0,.62)`:'none';
      el.classList.toggle('is-selected',s.cffSelection?.type==='text'&&s.cffSelection?.id===layer.id);
    });
  }

  function syncTextPositionUi(layer){
    if(!layer)return;const x=$('#photo-editor-text-x'),xo=$('#photo-editor-text-x-value'),y=$('#photo-editor-text-y'),yo=$('#photo-editor-text-y-value');
    if(x)x.value=String(layer.x);if(xo)xo.textContent=`${Number(layer.x).toFixed(1)}%`;if(y)y.value=String(layer.y);if(yo)yo.textContent=`${Number(layer.y).toFixed(1)}%`;
  }

  function setEditorSelection(type='none',id=null){
    const s=editorState();if(!s)return;
    const nextType=['photo','pip','text'].includes(type)?type:'none',nextId=nextType==='photo'||nextType==='none'?null:String(id||'');
    if(nextType==='pip'){const p=(s.pips||[]).find(x=>x.id===nextId);if(!p)return;s.activePipId=nextId;}
    if(nextType==='text'){const t=(s.texts||[]).find(x=>x.id===nextId);if(!t)return;s.activeTextId=nextId;window.__CFF_ADMIN_EDICAO_ACTIVATE_TEXT__?.(nextId);}
    s.cffSelection={type:nextType,id:nextId};
    window.__CFF_ADMIN_EDICAO_SYNC_PIPS__?.();scheduleTextOverlaySync();
    if(tabMagnetEnabled()){const tab={photo:'image',pip:'pip',text:'text'}[nextType];if(tab)applyEditorTab(tab);}
    window.dispatchEvent(new CustomEvent('cff-editor-selection-change',{detail:{type:nextType,id:nextId}}));
  }

  function clearEditorSelection(){setEditorSelection('none');}
  window.__CFF_ADMIN_EDICAO_SELECT__=setEditorSelection;
  window.__CFF_ADMIN_EDICAO_CLEAR_SELECTION__=clearEditorSelection;

  function pointHitsMainPhoto(e){
    const s=editorState(),stage=$('#photo-editor-stage');if(!s?.image||!stage)return false;
    const r=stage.getBoundingClientRect();if(!r.width||!r.height)return false;
    const px=(e.clientX-r.left)/r.width*3000,py=(e.clientY-r.top)/r.height*3749,dx=px-(Number(s.x)||1500),dy=py-(Number(s.y)||1874.5),rad=-(Number(s.rotation)||0)*Math.PI/180,rx=dx*Math.cos(rad)-dy*Math.sin(rad),ry=dx*Math.sin(rad)+dy*Math.cos(rad),scale=(Number(s.baseScale)||1)*(Number(s.zoom)||1),w=(s.image.naturalWidth||s.image.width||0)*scale,h=(s.image.naturalHeight||s.image.height||0)*scale;
    return Math.abs(rx)<=w/2&&Math.abs(ry)<=h/2;
  }

  function beginTextDrag(e,el){
    const s=editorState(),id=el.dataset.textId,layer=(s?.texts||[]).find(t=>t.id===id);if(!layer)return;
    e.preventDefault();e.stopPropagation();setEditorSelection('text',id);
    const r=$('#photo-editor-stage').getBoundingClientRect();textDrag={id,pointerId:e.pointerId,startClientX:e.clientX,startClientY:e.clientY,startX:Number(layer.x)||50,startY:Number(layer.y)||86,stageW:r.width,stageH:r.height};
    el.setPointerCapture?.(e.pointerId);window.__CFF_ADMIN_EDICAO_INTERACTING__=true;window.dispatchEvent(new CustomEvent('cff-editor-interaction-start'));
    window.addEventListener('pointermove',moveTextDrag,{capture:true});window.addEventListener('pointerup',endTextDrag,{capture:true,once:true});window.addEventListener('pointercancel',endTextDrag,{capture:true,once:true});
  }

  function moveTextDrag(e){
    const g=textDrag,s=editorState();if(!g||e.pointerId!==g.pointerId||!s)return;const layer=(s.texts||[]).find(t=>t.id===g.id);if(!layer)return;
    e.preventDefault();e.stopPropagation();layer.x=Math.min(95,Math.max(5,g.startX+((e.clientX-g.startClientX)/g.stageW)*100));layer.y=Math.min(94,Math.max(8,g.startY+((e.clientY-g.startClientY)/g.stageH)*100));syncTextPositionUi(layer);window.__CFF_ADMIN_EDICAO_QUEUE__?.();scheduleTextOverlaySync();
  }

  function endTextDrag(e){
    const g=textDrag;if(!g||e.pointerId!==g.pointerId)return;e.preventDefault();e.stopPropagation();textDrag=null;window.removeEventListener('pointermove',moveTextDrag,true);window.__CFF_ADMIN_EDICAO_INTERACTING__=false;window.dispatchEvent(new CustomEvent('cff-editor-interaction-end'));
    const input=$('#photo-editor-text-x');input?.dispatchEvent(new Event('input',{bubbles:true}));scheduleTextOverlaySync();
  }

  function setupPreviewSelection(){
    const stage=$('#photo-editor-stage'),workspace=$('.photo-editor-workspace');if(!stage||stage.dataset.cffSelectionBound==='1')return;stage.dataset.cffSelectionBound='1';
    stage.addEventListener('pointerdown',e=>{
      const textHit=e.target.closest('.cff-text-hit');if(textHit){beginTextDrag(e,textHit);return;}
      if(e.target.closest('.photo-editor-pip-hit'))return;
      if(e.target.closest('#cff-photo-transform')){setEditorSelection('photo');return;}
      if(pointHitsMainPhoto(e)){setEditorSelection('photo');return;}
      clearEditorSelection();e.preventDefault();e.stopImmediatePropagation();
    },true);
    workspace?.addEventListener('pointerdown',e=>{if(e.target.closest('#photo-editor-stage'))return;if(e.target.closest('button,input,select,textarea,label'))return;if(e.target.closest('.cff-studio-canvas-shell')||e.target===workspace)clearEditorSelection();},true);
    const app=$('#photo-editor-app');app?.addEventListener('input',scheduleTextOverlaySync,true);app?.addEventListener('change',scheduleTextOverlaySync,true);
    window.addEventListener('resize',scheduleTextOverlaySync);window.addEventListener('cff-editor-selection-change',scheduleTextOverlaySync);
    if('ResizeObserver'in window)new ResizeObserver(scheduleTextOverlaySync).observe(stage);
    setInterval(()=>{if(!window.__CFF_ADMIN_EDICAO_INTERACTING__)scheduleTextOverlaySync();},500);
    scheduleTextOverlaySync();
  }

  const editorHistory={entries:[],index:-1,applying:false,timer:0,max:60};

  function snapshotEditor(){
    const s=editorState();if(!s)return null;
    return{
      image:s.image||null,imageBlob:s.imageBlob||null,imageName:s.imageName||'',baseScale:Number(s.baseScale)||1,zoom:Number(s.zoom)||1,x:Number(s.x)||1500,y:Number(s.y)||1874.5,rotation:Number(s.rotation)||0,flipX:s.flipX===-1?-1:1,brightness:Number(s.brightness)||100,contrast:Number(s.contrast)||100,saturation:Number(s.saturation)||100,pinchLocked:!!s.pinchLocked,
      pips:(s.pips||[]).map(p=>({...p})),activePipId:s.activePipId||null,pipSeq:Number(s.pipSeq)||0,
      texts:(s.texts||[]).map(t=>({...t})),activeTextId:s.activeTextId||null,
      frameEnabled:s.frameEnabled!==false,frame:s.frame||null,frameUrl:s.frameUrl||'',
      selection:{type:s.cffSelection?.type||'none',id:s.cffSelection?.id||null},
      studio:window.__CFF_ADMIN_EDICAO_STUDIO_STATE__?.()||null
    };
  }

  function snapshotKey(v){
    if(!v)return'';
    return JSON.stringify({
      image:v.imageName||'',hasImage:!!v.image,baseScale:v.baseScale,zoom:v.zoom,x:v.x,y:v.y,rotation:v.rotation,flipX:v.flipX,brightness:v.brightness,contrast:v.contrast,saturation:v.saturation,pinchLocked:v.pinchLocked,
      pips:v.pips.map(p=>[p.id,p.name,p.enabled,p.size,p.x,p.y,p.opacity,p.rotation,p.flipX,p.strokeEnabled,p.strokeWidth,p.strokeColor,p.shadowEnabled,p.shadowSize,p.shadowBlur,p.shadowColor,p.shadowOpacity,p.shadowX,p.shadowY]),
      texts:v.texts.map(t=>[t.id,t.text,t.font,t.size,t.color,t.x,t.y,t.spacing,t.shadow]),frameEnabled:v.frameEnabled,frameUrl:v.frameUrl||'',studio:v.studio
    });
  }

  function updateHistoryButtons(){
    const undo=$('#cff-editor-undo'),redo=$('#cff-editor-redo');
    if(undo)undo.disabled=editorHistory.index<=0;
    if(redo)redo.disabled=editorHistory.index<0||editorHistory.index>=editorHistory.entries.length-1;
  }

  function recordHistory(){
    if(editorHistory.applying)return;
    const snap=snapshotEditor();if(!snap)return;const key=snapshotKey(snap),current=editorHistory.entries[editorHistory.index];
    if(current&&current.key===key){updateHistoryButtons();return;}
    if(editorHistory.index<editorHistory.entries.length-1)editorHistory.entries.splice(editorHistory.index+1);
    editorHistory.entries.push({key,snap});if(editorHistory.entries.length>editorHistory.max)editorHistory.entries.shift();
    editorHistory.index=editorHistory.entries.length-1;updateHistoryButtons();
  }

  function scheduleHistory(ms=280){clearTimeout(editorHistory.timer);editorHistory.timer=setTimeout(recordHistory,ms);}

  function freshObjectUrl(blob,fallback=''){try{return blob?URL.createObjectURL(blob):fallback||'';}catch{return fallback||'';}}

  function applyHistorySnapshot(snap){
    const s=editorState();if(!s||!snap)return;editorHistory.applying=true;
    try{
      s.image=snap.image||null;s.imageBlob=snap.imageBlob||null;s.imageName=snap.imageName||'';s.imageUrl=s.image?freshObjectUrl(s.imageBlob,''):'';s.baseScale=snap.baseScale;s.zoom=snap.zoom;s.x=snap.x;s.y=snap.y;s.rotation=snap.rotation;s.flipX=snap.flipX;s.brightness=snap.brightness;s.contrast=snap.contrast;s.saturation=snap.saturation;s.pinchLocked=snap.pinchLocked;
      s.pips=snap.pips.map(p=>({...p,url:freshObjectUrl(p.sourceBlob,p.url)}));s.activePipId=snap.activePipId;s.pipSeq=snap.pipSeq;
      s.texts=snap.texts.map(t=>({...t}));s.activeTextId=snap.activeTextId;
      s.frameEnabled=snap.frameEnabled;s.frame=snap.frame;s.frameUrl=snap.frameUrl||'';
      s.cffSelection={...(snap.selection||{type:'none',id:null})};
      if(snap.studio)window.__CFF_ADMIN_EDICAO_STUDIO_APPLY__?.(snap.studio);
      window.__CFF_ADMIN_EDICAO_SYNC_ALL__?.();
      if(s.cffSelection?.type==='photo'&&!s.image)s.cffSelection={type:'none',id:null};
      if(s.cffSelection?.type==='pip'&&!s.pips.some(p=>p.id===s.cffSelection.id))s.cffSelection={type:'none',id:null};
      if(s.cffSelection?.type==='text'&&!s.texts.some(t=>t.id===s.cffSelection.id))s.cffSelection={type:'none',id:null};
      window.dispatchEvent(new CustomEvent('cff-editor-selection-change',{detail:{...s.cffSelection}}));
    }finally{editorHistory.applying=false;updateHistoryButtons();}
  }

  function undoEditor(){if(editorHistory.index<=0)return;editorHistory.index--;applyHistorySnapshot(editorHistory.entries[editorHistory.index].snap);}
  function redoEditor(){if(editorHistory.index<0||editorHistory.index>=editorHistory.entries.length-1)return;editorHistory.index++;applyHistorySnapshot(editorHistory.entries[editorHistory.index].snap);}

  function deleteSelected(){
    const s=editorState(),sel=s?.cffSelection;if(!s||!sel||sel.type==='none')return;
    if(sel.type==='photo'&&s.image){window.__CFF_ADMIN_EDICAO_CONFIRM_DELETE_MAIN__?.();return;}
    if(sel.type==='pip'){s.activePipId=sel.id;window.__CFF_ADMIN_EDICAO_REMOVE_PIP__?.();scheduleHistory(40);return;}
    if(sel.type==='text'){s.activeTextId=sel.id;window.__CFF_ADMIN_EDICAO_REMOVE_TEXT__?.();scheduleHistory(40);}
  }

  function setupHistory(){
    const actions=$('.photo-editor-heading-actions'),app=$('#photo-editor-app');if(!actions||!app||$('#cff-editor-undo'))return;
    const undo=document.createElement('button'),redo=document.createElement('button');
    undo.id='cff-editor-undo';undo.type='button';undo.className='admin-btn admin-btn-ghost cff-editor-history-btn';undo.textContent='↶ Desfazer';undo.title='Desfazer (Ctrl+Z)';
    redo.id='cff-editor-redo';redo.type='button';redo.className='admin-btn admin-btn-ghost cff-editor-history-btn';redo.textContent='↷ Refazer';redo.title='Refazer (Ctrl+Shift+Z / Ctrl+Y)';
    const reset=$('#photo-editor-reset-all');actions.insertBefore(undo,reset||null);actions.insertBefore(redo,reset||null);
    undo.addEventListener('click',undoEditor);redo.addEventListener('click',redoEditor);
    app.addEventListener('input',()=>scheduleHistory(360),true);app.addEventListener('change',()=>scheduleHistory(90),true);app.addEventListener('click',e=>{if(e.target.closest('#cff-editor-undo,#cff-editor-redo'))return;setTimeout(()=>scheduleHistory(40),0);},true);
    window.addEventListener('cff-editor-interaction-end',()=>scheduleHistory(20));window.addEventListener('cff-pips-changed',()=>scheduleHistory(30));window.addEventListener('cff-photo-changed',()=>scheduleHistory(40));window.addEventListener('cff-photo-removed',()=>scheduleHistory(40));
    document.addEventListener('keydown',e=>{
      const tag=document.activeElement?.tagName||'',editing=/INPUT|TEXTAREA|SELECT/.test(tag)||document.activeElement?.isContentEditable;
      if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redoEditor();else undoEditor();return;}
      if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='y'){e.preventDefault();redoEditor();return;}
      if(e.key==='Delete'&&!editing&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();deleteSelected();}
    },true);
    setTimeout(recordHistory,180);updateHistoryButtons();
    window.__CFF_ADMIN_EDICAO_HISTORY__={undo:undoEditor,redo:redoEditor,record:recordHistory};
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
    const add=$('.photo-editor-file-button');if(add&&add.firstChild)add.firstChild.textContent='Foto principal ';
    const reset=$('#photo-editor-reset-all');if(reset)reset.textContent='↺ Resetar';
  }

  function loadAutosave(){
    if(window.__CFF_ADMIN_EDICAO_AUTOSAVE__||document.querySelector('script[data-cff-edicao-autosave]'))return;
    const script=document.createElement('script');
    script.src='js/admin-edicao-autosave.js?v=20260923-pip-effects-v6';
    script.dataset.cffEdicaoAutosave='1';
    document.head.appendChild(script);
  }

  function enhance(){
    addStyles();
    hideLegacyFrameControls();
    reorderControls();
    setupQuickNav();
    setupPreviewSelection();
    setupHistory();
    setupTopSave();
    improveLabels();
    setupEmptyClick();
    setupTemplatePicker();
    setupVisualGrids();
    setupPreviewZoom();
    loadAutosave();
    setTimeout(()=>applyOverlay(storedOverlay()),220);
  }

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{tries++;const app=$('#photo-editor-app');if(app&&!app.hidden&&$('#photo-editor-frame-file')){clearInterval(timer);setTimeout(enhance,80);}else if(tries>120){clearInterval(timer);}},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
