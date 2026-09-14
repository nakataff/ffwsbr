(()=>{
  'use strict';
  if(window.__CFF_ADMIN_EDICAO_AUTOSAVE__) return;
  window.__CFF_ADMIN_EDICAO_AUTOSAVE__=true;
  if(!/admin-edicao\.html$/i.test(location.pathname)) return;

  const META_KEY='cff-admin-photo-editor-draft-v1';
  const DRAFT_DB='cff-admin-photo-editor-drafts-v1';
  const STORE='draft';
  const PHOTO_KEY='photo';
  const PIP_KEY='pip';
  const SAVE_DELAY=550;
  let restoring=true;
  let timer=0;
  let statusTimer=0;

  const $=s=>document.querySelector(s);
  const state=()=>window.__CFF_ADMIN_EDICAO_STATE__||null;
  const rerender=()=>{try{window.__CFF_ADMIN_EDICAO_QUEUE__?.();}catch{}};

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DRAFT_DB,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }

  async function dbPut(value,key){
    const db=await openDb();
    try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
    finally{db.close();}
  }

  async function dbGet(key){
    const db=await openDb();
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
    finally{db.close();}
  }

  async function dbDelete(key){
    const db=await openDb();
    try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
    finally{db.close();}
  }

  function injectUi(){
    if($('#cff-edicao-autosave')) return;
    const heading=$('.photo-editor-heading>div:first-child');
    if(!heading) return;
    const row=document.createElement('div');
    row.id='cff-edicao-autosave';
    row.className='cff-edicao-autosave';
    row.innerHTML='<span class="cff-edicao-autosave-dot"></span><span id="cff-edicao-autosave-text">Salvamento automático ativo</span><button id="cff-edicao-autosave-clear" type="button">Limpar rascunho</button>';
    heading.appendChild(row);
    const style=document.createElement('style');
    style.textContent=`
      .cff-edicao-autosave{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px;color:#7f91ad;font-size:11px;font-weight:800}
      .cff-edicao-autosave-dot{width:7px;height:7px;border-radius:50%;background:#42d99a;box-shadow:0 0 10px rgba(66,217,154,.45)}
      .cff-edicao-autosave.is-saving .cff-edicao-autosave-dot{background:#ffd36a;box-shadow:0 0 10px rgba(255,211,106,.4)}
      .cff-edicao-autosave.is-error .cff-edicao-autosave-dot{background:#ff6f83;box-shadow:none}
      #cff-edicao-autosave-clear{border:0;background:none;color:#6fdfff;padding:0;font:inherit;font-size:10px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
      @media(max-width:820px){.cff-edicao-autosave{margin-top:7px;font-size:10px}#cff-edicao-autosave-clear{font-size:10px}}
    `;
    document.head.appendChild(style);
    $('#cff-edicao-autosave-clear')?.addEventListener('click',async()=>{
      if(!confirm('Apagar o rascunho automático deste navegador? A arte aberta continua na tela até você sair ou recarregar.'))return;
      try{localStorage.removeItem(META_KEY);}catch{}
      await Promise.allSettled([dbDelete(PHOTO_KEY),dbDelete(PIP_KEY)]);
      setStatus('Rascunho apagado','');
    });
  }

  function setStatus(text,mode=''){
    const root=$('#cff-edicao-autosave'),label=$('#cff-edicao-autosave-text');
    if(!root||!label)return;
    root.classList.toggle('is-saving',mode==='saving');
    root.classList.toggle('is-error',mode==='error');
    label.textContent=text;
    clearTimeout(statusTimer);
    if(mode==='saved')statusTimer=setTimeout(()=>{if(!restoring)setStatus('Rascunho salvo automaticamente','');},2200);
  }

  function safeNum(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function capture(){
    const s=state();
    if(!s)return null;
    const imageFile=$('#photo-editor-file')?.files?.[0];
    const pipFile=$('#photo-editor-pip-file')?.files?.[0];
    return {
      version:1,
      updatedAt:Date.now(),
      hasImage:!!s.image,
      imageName:imageFile?.name||$('#photo-editor-image-name')?.textContent||'foto.png',
      hasPip:!!s.pip,
      pipName:pipFile?.name||'pip.png',
      baseScale:safeNum(s.baseScale,1),zoom:safeNum(s.zoom,1),x:safeNum(s.x,1500),y:safeNum(s.y,1874.5),rotation:safeNum(s.rotation,0),flipX:s.flipX===-1?-1:1,
      brightness:safeNum(s.brightness,100),contrast:safeNum(s.contrast,100),saturation:safeNum(s.saturation,100),pinchLocked:!!s.pinchLocked,
      pipEnabled:s.pipEnabled!==false,pipSize:safeNum(s.pipSize,28),pipX:safeNum(s.pipX,75),pipY:safeNum(s.pipY,25),pipOpacity:safeNum(s.pipOpacity,100),
      texts:(Array.isArray(s.texts)?s.texts:[]).slice(0,5).map(t=>({text:String(t?.text||''),font:String(t?.font||'Avilock'),size:safeNum(t?.size,190),color:String(t?.color||'#ffffff'),x:safeNum(t?.x,50),y:safeNum(t?.y,86),spacing:safeNum(t?.spacing,106),shadow:t?.shadow!==false})),
      activeTextIndex:Math.max(0,(Array.isArray(s.texts)?s.texts:[]).findIndex(t=>t.id===s.activeTextId)),
      output:{size:$('#photo-editor-size')?.value||'3000x3749',format:$('#photo-editor-format')?.value||'png',quality:$('#photo-editor-quality')?.value||'92',fileName:$('#photo-editor-file-name')?.value||'central-free-fire-edit'}
    };
  }

  function saveMeta(show=true){
    if(restoring)return;
    const data=capture();if(!data)return;
    try{
      if(show)setStatus('Salvando rascunho…','saving');
      localStorage.setItem(META_KEY,JSON.stringify(data));
      if(show)setStatus('Rascunho salvo','saved');
    }catch(error){
      console.warn('[Editor autosave] metadata',error);
      setStatus('Não foi possível salvar o rascunho','error');
    }
  }

  function scheduleSave(){
    if(restoring)return;
    clearTimeout(timer);
    timer=setTimeout(()=>saveMeta(true),SAVE_DELAY);
  }

  function readMeta(){
    try{const raw=localStorage.getItem(META_KEY);return raw?JSON.parse(raw):null;}catch{return null;}
  }

  function setInput(id,value,event='input'){
    const el=$(id);if(!el||value==null)return;
    if(el.type==='checkbox')el.checked=!!value;else el.value=String(value);
    el.dispatchEvent(new Event(event,{bubbles:true}));
  }

  function waitFor(test,timeout=5000){
    return new Promise(resolve=>{
      const start=performance.now();
      const tick=()=>{if(test())return resolve(true);if(performance.now()-start>timeout)return resolve(false);requestAnimationFrame(tick);};tick();
    });
  }

  async function restoreFile(input,blob,name){
    if(!input||!blob)return false;
    const file=blob instanceof File?blob:new File([blob],name||'rascunho.png',{type:blob.type||'image/png'});
    const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;
  }

  function restoreTexts(meta){
    const texts=Array.isArray(meta?.texts)&&meta.texts.length?meta.texts.slice(0,5):[];
    if(!texts.length)return;
    const remove=$('#photo-editor-remove-text');
    while(document.querySelectorAll('.photo-editor-text-layer').length>1&&!remove.disabled)remove.click();
    texts.forEach((t,index)=>{
      if(index>0)$('#photo-editor-add-text')?.click();
      setInput('#photo-editor-text',t.text,'input');
      setInput('#photo-editor-font-family',t.font,'change');
      setInput('#photo-editor-font-size',t.size,'input');
      setInput('#photo-editor-text-color',t.color,'input');
      setInput('#photo-editor-text-x',t.x,'input');
      setInput('#photo-editor-text-y',t.y,'input');
      setInput('#photo-editor-text-spacing',t.spacing,'input');
      setInput('#photo-editor-text-shadow',t.shadow,'change');
    });
    const tabs=[...document.querySelectorAll('.photo-editor-text-layer')];
    tabs[Math.min(Math.max(0,meta.activeTextIndex||0),tabs.length-1)]?.click();
  }

  function syncDirectState(meta){
    const s=state();if(!s)return;
    const copy=['baseScale','zoom','x','y','rotation','brightness','contrast','saturation','pipSize','pipX','pipY','pipOpacity'];
    copy.forEach(k=>{if(Number.isFinite(Number(meta[k])))s[k]=Number(meta[k]);});
    s.flipX=meta.flipX===-1?-1:1;
    s.pinchLocked=!!meta.pinchLocked;
    s.pipEnabled=meta.pipEnabled!==false;
    const pairs=[
      ['#photo-editor-zoom',Math.round(s.zoom*100),'#photo-editor-zoom-value',`${Math.round(s.zoom*100)}%`],
      ['#photo-editor-rotation',s.rotation,'#photo-editor-rotation-value',`${s.rotation}°`],
      ['#photo-editor-brightness',s.brightness,'#photo-editor-brightness-value',`${s.brightness}%`],
      ['#photo-editor-contrast',s.contrast,'#photo-editor-contrast-value',`${s.contrast}%`],
      ['#photo-editor-saturation',s.saturation,'#photo-editor-saturation-value',`${s.saturation}%`],
      ['#photo-editor-pip-size',s.pipSize,'#photo-editor-pip-size-value',`${s.pipSize}%`],
      ['#photo-editor-pip-x',s.pipX,'#photo-editor-pip-x-value',`${s.pipX}%`],
      ['#photo-editor-pip-y',s.pipY,'#photo-editor-pip-y-value',`${s.pipY}%`],
      ['#photo-editor-pip-opacity',s.pipOpacity,'#photo-editor-pip-opacity-value',`${s.pipOpacity}%`]
    ];
    pairs.forEach(([input,value,out,label])=>{const el=$(input),o=$(out);if(el)el.value=String(value);if(o)o.textContent=label;});
    const lock=$('#photo-editor-pinch-lock');if(lock){lock.textContent=s.pinchLocked?'🔒 Pinça':'🔓 Pinça';lock.setAttribute('aria-pressed',String(s.pinchLocked));lock.classList.toggle('is-locked',s.pinchLocked);}
    const pipEnabled=$('#photo-editor-pip-enabled');if(pipEnabled)pipEnabled.checked=s.pipEnabled;
    rerender();
  }

  function restoreOutput(meta){
    const o=meta?.output||{};
    if($('#photo-editor-size')&&o.size)$('#photo-editor-size').value=o.size;
    if($('#photo-editor-format')&&o.format){$('#photo-editor-format').value=o.format;$('#photo-editor-format').dispatchEvent(new Event('change',{bubbles:true}));}
    if($('#photo-editor-quality')&&o.quality){$('#photo-editor-quality').value=o.quality;const out=$('#photo-editor-quality-value');if(out)out.textContent=`${o.quality}%`;}
    if($('#photo-editor-file-name')&&o.fileName)$('#photo-editor-file-name').value=o.fileName;
  }

  async function restore(){
    injectUi();
    const meta=readMeta();
    if(!meta){restoring=false;setStatus('Salvamento automático ativo','');bind();return;}
    setStatus('Restaurando último rascunho…','saving');
    try{
      const [photoBlob,pipBlob]=await Promise.all([meta.hasImage?dbGet(PHOTO_KEY):null,meta.hasPip?dbGet(PIP_KEY):null]);
      if(photoBlob){await restoreFile($('#photo-editor-file'),photoBlob,meta.imageName);await waitFor(()=>!!state()?.image,7000);}
      if(pipBlob){await restoreFile($('#photo-editor-pip-file'),pipBlob,meta.pipName);await waitFor(()=>!!state()?.pip,5000);}
      restoreTexts(meta);
      syncDirectState(meta);
      restoreOutput(meta);
      restoring=false;
      bind();
      saveMeta(false);
      setStatus(meta.hasImage&&!photoBlob?'Rascunho parcial: foto original não encontrada':'Rascunho restaurado','saved');
    }catch(error){
      console.warn('[Editor autosave] restore',error);
      restoring=false;bind();setStatus('Não consegui restaurar todo o rascunho','error');
    }
  }

  function bind(){
    const app=$('#photo-editor-app');if(!app||app.dataset.autosaveBound==='1')return;app.dataset.autosaveBound='1';
    app.addEventListener('input',scheduleSave,true);
    app.addEventListener('change',scheduleSave,true);
    app.addEventListener('click',e=>{if(e.target.closest('#photo-editor-download,#photo-editor-save-top,#photo-editor-save-preview,[data-grid]'))return;setTimeout(scheduleSave,60);},true);
    const stage=$('#photo-editor-stage');
    ['pointerup','pointercancel','wheel'].forEach(ev=>stage?.addEventListener(ev,scheduleSave,{passive:true}));
    const photo=$('#photo-editor-file');
    photo?.addEventListener('change',async()=>{if(restoring)return;const file=photo.files?.[0];if(!file)return;try{setStatus('Salvando foto do rascunho…','saving');await dbPut(file,PHOTO_KEY);scheduleSave();}catch(error){console.warn(error);setStatus('Ajustes salvos, mas a foto não coube no armazenamento','error');}},true);
    const pip=$('#photo-editor-pip-file');
    pip?.addEventListener('change',async()=>{if(restoring)return;const file=pip.files?.[0];if(!file)return;try{await dbPut(file,PIP_KEY);scheduleSave();}catch(error){console.warn(error);setStatus('P.I.P. não pôde ser salvo no rascunho','error');}},true);
    $('#photo-editor-clear-pip')?.addEventListener('click',()=>setTimeout(async()=>{if(!state()?.pip){await dbDelete(PIP_KEY);scheduleSave();}},100),true);
    window.addEventListener('pagehide',()=>saveMeta(false));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)saveMeta(false);});
  }

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(state()&&!$('#photo-editor-app')?.hidden){clearInterval(timer);restore();}
      else if(tries>160){clearInterval(timer);}
    },100);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
