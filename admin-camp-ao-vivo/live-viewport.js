(function(){
  'use strict';
  if(window.CFF_LIVE_VIEWPORT)return;
  const layout=document.querySelector('.main-layout');
  const launch=layout?.querySelector('.drop-section');
  const table=layout?.querySelector('.summary-section');
  if(!layout||!launch||!table)return;

  const toolbar=document.createElement('div');
  toolbar.className='cff-live-toolbar';
  toolbar.setAttribute('aria-label','Área de operação das quedas');
  toolbar.innerHTML='<div class="cff-live-toolbar-copy"><strong>Lançamento + tabela ao mesmo tempo</strong><small id="cff-live-status">Acompanhe a classificação enquanto registra as quedas. Cada lado tem sua própria rolagem.</small></div><div class="cff-live-toolbar-actions"><button type="button" data-cff-live-equal title="Dividir a tela em duas partes iguais">50% / 50%</button><button type="button" data-cff-live-expand aria-pressed="false">⛶ Ocupar tela inteira</button></div>';
  layout.before(toolbar);
  const status=toolbar.querySelector('#cff-live-status');
  const expand=toolbar.querySelector('[data-cff-live-expand]');

  const divider=document.createElement('div');
  divider.className='cff-live-divider';
  divider.setAttribute('role','separator');
  divider.setAttribute('aria-label','Ajustar espaço entre lançar quedas e tabela');
  divider.setAttribute('aria-orientation','vertical');
  divider.setAttribute('aria-valuemin','34');
  divider.setAttribute('aria-valuemax','66');
  divider.setAttribute('tabindex','0');
  launch.after(divider);
  const key='cff_camp_live_split_v1';
  function clamp(value){return Math.max(34,Math.min(66,Math.round(value)))}
  function setSplit(percent){
    const value=clamp(percent);
    layout.style.setProperty('--cff-live-left',value+'%');
    divider.setAttribute('aria-valuenow',String(value));
    divider.setAttribute('aria-valuetext',value+'% lançamento, '+(100-value)+'% classificação');
    try{localStorage.setItem(key,String(value))}catch(_){}
  }
  let saved=48;
  try{const raw=Number(localStorage.getItem(key));if(Number.isFinite(raw)&&raw>=34&&raw<=66)saved=raw}catch(_){}
  setSplit(saved);
  toolbar.querySelector('[data-cff-live-equal]').addEventListener('click',()=>setSplit(50));
  let dragging=false;
  function dragAt(x){const box=layout.getBoundingClientRect();if(box.width>0)setSplit((x-box.left)/box.width*100)}
  divider.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    dragging=true;
    divider.classList.add('is-dragging');
    divider.setPointerCapture(event.pointerId);
    dragAt(event.clientX);
    event.preventDefault();
  });
  divider.addEventListener('pointermove',event=>{if(dragging)dragAt(event.clientX)});
  function stopDrag(){dragging=false;divider.classList.remove('is-dragging')}
  divider.addEventListener('pointerup',stopDrag);
  divider.addEventListener('pointercancel',stopDrag);
  divider.addEventListener('lostpointercapture',stopDrag);
  divider.addEventListener('dblclick',()=>setSplit(50));
  divider.addEventListener('keydown',event=>{
    const now=Number(divider.getAttribute('aria-valuenow'))||48;
    const next=event.key==='ArrowLeft'?now-2:event.key==='ArrowRight'?now+2:event.key==='Home'?34:event.key==='End'?66:null;
    if(next===null)return;
    event.preventDefault();setSplit(next);
  });

  // Mantém as opções estéticas disponíveis, sem empurrar a tabela para fora da tela.
  const aesthetics=table.querySelector('.sub-summary-section');
  if(aesthetics)aesthetics.open=false;
  launch.open=true;table.open=true;
  const tableDetails=[...table.querySelectorAll('.sub-summary-section')].find(el=>el.querySelector('#table-print-area'));
  if(tableDetails)tableDetails.open=true;

  function toggleMax(force){
    const active=typeof force==='boolean'?force:!document.body.classList.contains('cff-live-maximized');
    document.body.classList.toggle('cff-live-maximized',active);
    expand.textContent=active?'↙ Sair da tela inteira':'⛶ Ocupar tela inteira';
    expand.setAttribute('aria-pressed',String(active));
    if(active){launch.open=true;table.open=true;}
  }
  expand.addEventListener('click',()=>toggleMax());
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.body.classList.contains('cff-live-maximized')&&document.getElementById('cff-global-review')?.hidden!==false)toggleMax(false);
  });
  window.matchMedia('(max-width: 1079px)').addEventListener('change',event=>{if(event.matches)toggleMax(false)});

  const nav=document.getElementById('cff-camp-nav');
  if(nav&&!document.getElementById('cff-camp-live-open')){
    const button=document.createElement('button');
    button.type='button';button.id='cff-camp-live-open';button.className='cff-camp-btn';
    button.textContent='Tabela + quedas';button.title='Abrir os dois painéis lado a lado';
    button.addEventListener('click',()=>{toggleMax(false);launch.open=true;table.open=true;layout.scrollIntoView({behavior:'smooth',block:'start'})});
    nav.append(button);
  }

  function refreshStatus(){
    const isFinal=window.CFF_GLOBAL_CAMP?.getRoundKey?.()==='final-1';
    status.textContent=isFinal
      ?'FFWS Global Finals 2026 · Champion Rush com 110 pontos. O Booyah decisivo deve ocorrer depois da ativação.'
      :'Acompanhe a classificação enquanto registra as quedas. Arraste a divisória para ajustar o espaço.';
  }
  refreshStatus();
  function watchModel(){
    const node=document.getElementById('cff-global-current');
    if(!node)return false;
    new MutationObserver(refreshStatus).observe(node,{childList:true,subtree:true,characterData:true});
    refreshStatus();return true;
  }
  if(!watchModel()){
    const watcher=new MutationObserver(()=>{if(watchModel())watcher.disconnect()});
    watcher.observe(document.body,{childList:true,subtree:true});
  }
  window.CFF_LIVE_VIEWPORT={setSplit,toggleMax};
})();