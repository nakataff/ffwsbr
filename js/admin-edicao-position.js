(()=>{
  'use strict';
  const W=3000,H=3749,KEY='cff-admin-edicao-position-options-v1',MAGNET='cff-admin-edicao-tab-magnet-v1';
  const $=id=>document.getElementById(id),state=()=>window.__CFF_ADMIN_EDICAO_STATE__;
  let keyboard=false,raf=0,lastOptions='',lastTarget='';
  try{keyboard=JSON.parse(localStorage.getItem(KEY)||'{}').keyboard===true}catch{}
  function selected(){
    const s=state(),sel=s?.cffSelection;if(!s||!sel)return null;
    if(sel.type==='photo'&&s.image)return{type:'photo',id:'',object:s,label:'Foto principal'};
    if(sel.type==='pip'){const object=s.pips.find(p=>p.id===sel.id);if(object)return{type:'pip',id:object.id,object,label:object.name||'P.I.P.'}}
    if(sel.type==='text'){const object=s.texts.find(t=>t.id===sel.id);if(object)return{type:'text',id:object.id,object,label:'Texto '+(s.texts.indexOf(object)+1)}}
    return null;
  }
  function pixels(target){return{x:target.type==='photo'?target.object.x:target.object.x*W/100,y:target.type==='photo'?target.object.y:target.object.y*H/100}}
  function sync(){
    raf=0;const s=state(),select=$('cff-position-element');if(!s||!select)return;
    const options=[...(s.image?[{value:'photo:',label:'Foto principal'}]:[]),...(s.pips||[]).map((p,i)=>({value:'pip:'+p.id,label:`P.I.P. ${i+1} — ${p.name||'Imagem'}`})),...(s.texts||[]).map((t,i)=>({value:'text:'+t.id,label:`Texto ${i+1}`}))],key=JSON.stringify(options);
    if(key!==lastOptions){select.replaceChildren(new Option('Selecione um elemento',''),...options.map(x=>new Option(x.label,x.value)));lastOptions=key}
    const target=selected(),targetKey=target?target.type+':'+target.id:'';if(select.value!==targetKey)select.value=targetKey;
    const pos=target?pixels(target):{x:'',y:''};
    for(const axis of ['x','y']){
      const input=$('cff-position-'+axis),lock=$('cff-position-lock-'+axis),locked=!!target?.object['cffLock'+axis.toUpperCase()];
      if(document.activeElement!==input||lastTarget!==targetKey)input.value=target?String(Math.round(pos[axis]*100)/100):'';
      input.disabled=!target||locked;lock.disabled=!target;lock.setAttribute('aria-pressed',String(locked));lock.innerHTML=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="${locked?'M8 10V6a4 4 0 0 1 8 0v4':'M8 10V6a4 4 0 0 1 8 0'}"/><path d="M12 14v3"/></svg>`;lock.setAttribute('aria-label',(locked?'Desbloquear ':'Bloquear ')+'eixo '+axis.toUpperCase());lock.title=(locked?'Desbloquear ':'Bloquear ')+axis.toUpperCase();lock.classList.toggle('is-locked',locked);
      for(const b of document.querySelectorAll(`[data-position-axis="${axis}"]`))b.disabled=!target||locked;
    }
    lastTarget=targetKey;
    const off=localStorage.getItem(MAGNET)==='0';$('cff-position-no-magnet').checked=off;
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(sync)}
  function announce(){window.__CFF_ADMIN_EDICAO_SYNC_ALL__?.();window.__CFF_ADMIN_EDICAO_SYNC_MAIN_LIVE__?.();window.dispatchEvent(new CustomEvent('cff-editor-position-change'));schedule()}
  function setPixels(axis,value){
    const target=selected();if(!target||!Number.isFinite(value))return;
    const pos=pixels(target);pos[axis]=value;
    window.__CFF_ADMIN_EDICAO_MOVE_POSITION__(target.object,target.type==='photo'?pos.x:pos.x/W*100,target.type==='photo'?pos.y:pos.y/H*100);
    announce();
  }
  function build(){
    const section=$('photo-editor-zoom')?.closest('.photo-editor-control-section');if(!section||!state()||!window.__CFF_ADMIN_EDICAO_SELECT__)return false;
    if($('cff-position-controls'))return true;
    const box=document.createElement('div');box.id='cff-position-controls';box.innerHTML=`<h3>Posição do elemento</h3><label for="cff-position-element">Imagem ou texto selecionado</label><select id="cff-position-element"></select><div class="cff-position-grid">${['x','y'].map(axis=>`<div><label for="cff-position-${axis}">${axis.toUpperCase()} <small>px</small></label><div class="cff-position-field"><input id="cff-position-${axis}" type="number" step="1" inputmode="decimal" autocomplete="off"><div class="cff-position-step"><button type="button" data-position-axis="${axis}" data-position-step="1" aria-label="Aumentar ${axis.toUpperCase()} em 1 pixel">▲</button><button type="button" data-position-axis="${axis}" data-position-step="-1" aria-label="Diminuir ${axis.toUpperCase()} em 1 pixel">▼</button></div><button type="button" id="cff-position-lock-${axis}" aria-label="Bloquear eixo ${axis.toUpperCase()}" aria-pressed="false">🔓</button></div></div>`).join('')}</div><label class="cff-position-toggle"><input id="cff-position-keyboard" type="checkbox">Mexer com a seta</label><label class="cff-position-toggle"><input id="cff-position-no-magnet" type="checkbox">Desativar ímã</label><p class="photo-editor-hint">Posição do centro na arte de 3000 × 3749 px. Setas: 1 px · Shift + seta: 10 px. Os cadeados travam cada eixo ao mover.</p>`;
    section.querySelector('.photo-editor-button-grid').after(box);
    $('cff-position-keyboard').checked=keyboard;
    $('cff-position-keyboard').addEventListener('change',e=>{keyboard=e.target.checked;try{localStorage.setItem(KEY,JSON.stringify({keyboard}))}catch{}});
    $('cff-position-no-magnet').addEventListener('change',e=>{const toggle=$('cff-edicao-tab-magnet');if(toggle){toggle.checked=!e.target.checked;toggle.dispatchEvent(new Event('change',{bubbles:true}))}else localStorage.setItem(MAGNET,e.target.checked?'0':'1')});
    $('cff-position-element').addEventListener('change',e=>{const [type,id]=e.target.value.split(':');window.__CFF_ADMIN_EDICAO_SELECT__(type,id||null);window.__CFF_ADMIN_EDICAO_OPEN_TAB__?.('image');schedule()});
    for(const axis of ['x','y']){
      $('cff-position-'+axis).addEventListener('input',e=>{if(e.target.value.trim()!=='')setPixels(axis,Number(e.target.value))});
      $('cff-position-'+axis).addEventListener('blur',schedule);
      $('cff-position-lock-'+axis).addEventListener('click',()=>{const t=selected();if(!t)return;const key='cffLock'+axis.toUpperCase();t.object[key]=!t.object[key];window.dispatchEvent(new CustomEvent('cff-editor-position-change'));schedule()});
    }
    box.addEventListener('click',e=>{const button=e.target.closest('[data-position-step]'),t=selected();if(button&&t)setPixels(button.dataset.positionAxis,pixels(t)[button.dataset.positionAxis]+Number(button.dataset.positionStep))});
    document.addEventListener('keydown',e=>{
      if(!keyboard||e.ctrlKey||e.metaKey||e.altKey||e.isComposing||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      const el=document.activeElement;if(el?.isContentEditable||el?.closest('[contenteditable="true"]')||/TEXTAREA|SELECT/.test(el?.tagName||'')||(el?.tagName==='INPUT'&&!['checkbox','button'].includes(el.type)))return;
      const t=selected();if(!t||$('photo-editor-app').hidden)return;
      e.preventDefault();e.stopPropagation();const axis=['ArrowLeft','ArrowRight'].includes(e.key)?'x':'y',sign=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;
      if(!t.object['cffLock'+axis.toUpperCase()])setPixels(axis,pixels(t)[axis]+sign*(e.shiftKey?10:1));
    },true);
    for(const event of ['cff-editor-selection-change','cff-editor-position-change','cff-photo-changed','cff-photo-removed','cff-pips-changed'])window.addEventListener(event,schedule);
    document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);document.addEventListener('click',schedule,true);window.addEventListener('pointermove',schedule,{capture:true,passive:true});window.addEventListener('pointerup',schedule,{capture:true,passive:true});
    // Also reflects restores and Undo/Redo, which update state without a pointer event.
    setInterval(()=>{if(!window.__CFF_ADMIN_EDICAO_INTERACTING__)schedule()},500);
    sync();window.__CFF_ADMIN_EDICAO_POSITION_READY__=true;return true;
  }
  const style=document.createElement('style');style.textContent=`
    #cff-position-controls{margin:14px 0;padding:12px;border:1px solid #29394c;border-radius:11px;background:#09121c}#cff-position-controls h3{margin:0 0 10px;color:#e7f1ff;font-size:13px}#cff-position-controls label{display:block;color:#9bacc3;font-size:11px;font-weight:800;margin-bottom:6px}#cff-position-controls select,#cff-position-controls input[type=number]{min-width:0;width:100%;height:38px;box-sizing:border-box;border:1px solid #304259;border-radius:7px;background:#060c14;color:#fff;font-size:14px;padding:6px 8px}#cff-position-controls input[type=number]{appearance:textfield;-moz-appearance:textfield}#cff-position-controls input::-webkit-inner-spin-button{appearance:none}#cff-position-controls input:focus{outline:2px solid #00c8ff}#cff-position-controls .cff-position-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}#cff-position-controls .cff-position-field{display:grid;grid-template-columns:minmax(0,1fr) 22px 30px;gap:4px}#cff-position-controls button{border:1px solid #304259;border-radius:6px;background:#152132;color:#e2eefe;cursor:pointer;padding:0;font-size:13px}#cff-position-controls .cff-position-step{display:grid;grid-template-rows:1fr 1fr;gap:2px}#cff-position-controls .cff-position-step button{font-size:9px}#cff-position-controls button.is-locked{border-color:#00c8ff;background:#07304a}#cff-position-controls input:disabled,#cff-position-controls button:disabled{opacity:.45;cursor:default}#cff-position-controls .cff-position-toggle{display:flex;align-items:center;gap:8px;font-size:12px;color:#d0deef;margin:10px 0}#cff-position-controls input[type=checkbox]{width:16px;height:16px;accent-color:#00c8ff}#cff-position-controls .photo-editor-hint{font-size:10px;line-height:1.6;margin:8px 0 0}`;
  document.head.append(style);
  if(!build()){const timer=setInterval(()=>{if(build())clearInterval(timer)},100);setTimeout(()=>clearInterval(timer),20000)}
})();
