(()=>{
  'use strict';
  if(window.__CFF_ADMIN_EDICAO_ENHANCEMENTS__) return;
  window.__CFF_ADMIN_EDICAO_ENHANCEMENTS__=true;

  const STATIC_OVERLAY='edition/degrade.png?v=20260914-degrade-v1';
  const PROFILE_CROP_PERCENT=((3000-(3749*3/4))/2/3000)*100;
  let appliedOverlay=false;

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
      .cff-edicao-grid-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;flex-basis:100%;width:100%;margin-top:8px}
      .cff-edicao-grid-label{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted,#8fa0bd);margin-right:2px}
      .cff-edicao-grid-btn{border:1px solid rgba(145,165,205,.24);background:rgba(255,255,255,.035);color:#c8d3e8;border-radius:8px;padding:7px 9px;font:800 11px/1 inherit;cursor:pointer;transition:.15s ease}
      .cff-edicao-grid-btn:hover{border-color:rgba(0,200,255,.5);color:#fff}
      .cff-edicao-grid-btn.is-active{background:rgba(0,200,255,.13);border-color:#00c8ff;color:#fff}
      .cff-edicao-grid-note{width:100%;font-size:11px;color:var(--text-muted,#8fa0bd);line-height:1.35;margin-top:1px}
      .cff-edicao-visual-grid{position:absolute;inset:0;z-index:8;pointer-events:none;overflow:hidden;border-radius:inherit}
      .cff-grid-line{position:absolute;background:rgba(0,220,255,.92);box-shadow:0 0 0 1px rgba(0,0,0,.2)}
      .cff-grid-line.v{top:0;bottom:0;width:2px}
      .cff-grid-line.h{left:0;right:0;height:2px}
      .cff-grid-mask{position:absolute;background:rgba(0,0,0,.40);backdrop-filter:brightness(.82)}
      .cff-grid-mask.side{top:0;bottom:0}
      .cff-grid-mask.horizontal{left:0;right:0}
      .cff-grid-safe{position:absolute;border:3px dashed rgba(255,214,0,.95);inset:5%;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,.10)}
      .cff-grid-safe::after{content:'ÁREA SEGURA';position:absolute;top:8px;left:10px;color:#ffe052;background:rgba(0,0,0,.62);padding:4px 7px;border-radius:5px;font:900 11px/1.1 Arial,sans-serif;letter-spacing:.06em}
      .cff-grid-crop-label{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:2;background:rgba(0,0,0,.72);color:#fff;padding:5px 8px;border-radius:6px;font:900 11px/1.1 Arial,sans-serif;letter-spacing:.05em;white-space:nowrap}
      @media(max-width:760px){.cff-edicao-grid-controls{gap:5px}.cff-edicao-grid-btn{padding:7px 8px;font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function hideLegacyFrameControls(){
    const input=$('#photo-editor-frame-enabled');
    const section=input?.closest('.photo-editor-control-section');
    if(section) section.hidden=true;
  }

  async function forceOfficialOverlay(){
    if(appliedOverlay) return;
    const input=$('#photo-editor-frame-file');
    const enabled=$('#photo-editor-frame-enabled');
    const app=$('#photo-editor-app');
    if(!input||!enabled||!app||app.hidden) return;
    try{
      const response=await fetch(STATIC_OVERLAY,{cache:'no-store'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob=await response.blob();
      const file=new File([blob],'degrade.png',{type:'image/png'});
      const dt=new DataTransfer();
      dt.items.add(file);
      input.files=dt.files;
      enabled.checked=true;
      enabled.dispatchEvent(new Event('change',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      appliedOverlay=true;
    }catch(error){
      console.error('Não foi possível carregar edition/degrade.png no editor.',error);
    }
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
    stage.addEventListener('click',e=>{
      const visible=!empty.hidden&&!empty.classList.contains('is-hidden');
      if(visible){e.preventDefault();file.click();}
    });
    stage.addEventListener('keydown',e=>{
      const visible=!empty.hidden&&!empty.classList.contains('is-hidden');
      if(visible&&(e.key==='Enter'||e.key===' ')){e.preventDefault();file.click();}
    });
    const observer=new MutationObserver(sync);
    observer.observe(empty,{attributes:true,attributeFilter:['hidden','class']});
    sync();
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
    const overlay=document.createElement('div');
    overlay.id='photo-editor-visual-grid';
    overlay.className='cff-edicao-visual-grid';
    overlay.setAttribute('aria-hidden','true');
    stage.appendChild(overlay);

    const controls=document.createElement('div');
    controls.className='cff-edicao-grid-controls';
    const modes=[
      ['none','Sem grade'],
      ['profile','Perfil 3:4'],
      ['safe','Área segura'],
      ['thirds','Terços'],
      ['center','Centro'],
      ['square','1:1']
    ];
    controls.innerHTML=`<span class="cff-edicao-grid-label">Visualização</span>${modes.map(([key,label])=>`<button type="button" class="cff-edicao-grid-btn${key==='none'?' is-active':''}" data-grid="${key}">${label}</button>`).join('')}<div class="cff-edicao-grid-note">As grades servem apenas para visualização e nunca entram na arte exportada. “Perfil 3:4” sombreia o corte lateral da grade do perfil sobre a arte 4:5.</div>`;
    head.appendChild(controls);
    controls.addEventListener('click',e=>{
      const btn=e.target.closest('[data-grid]');if(!btn)return;
      controls.querySelectorAll('[data-grid]').forEach(el=>el.classList.toggle('is-active',el===btn));
      const mode=btn.dataset.grid||'none';
      overlay.innerHTML=gridMarkup(mode);
      overlay.dataset.mode=mode;
    });
  }

  function enhance(){
    addStyles();
    hideLegacyFrameControls();
    setupEmptyClick();
    setupVisualGrids();
    forceOfficialOverlay();
  }

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const app=$('#photo-editor-app');
      if(app&&!app.hidden&&$('#photo-editor-frame-file')){
        clearInterval(timer);
        setTimeout(enhance,80);
      }else if(tries>120){clearInterval(timer);}
    },100);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
