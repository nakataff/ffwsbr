(()=>{
  'use strict';
  const boot=()=>{
    const publish=document.getElementById('live-publish');
    const test=document.getElementById('live-test-mode');
    const stage=document.getElementById('live-stage');
    if(!publish||!test||document.getElementById('live-preview-site'))return;
    const btn=document.createElement('button');
    btn.id='live-preview-site';
    btn.type='button';
    btn.className='live-btn ghost';
    btn.textContent='PRÉVIA NO SITE';
    btn.title='Abre o site usando somente a área de teste do Firebase';
    btn.style.display=test.checked?'inline-flex':'none';
    publish.parentElement?.appendChild(btn);
    const sync=()=>{btn.style.display=test.checked?'inline-flex':'none'};
    test.addEventListener('change',sync);
    btn.addEventListener('click',()=>{
      const hash=stage?.value==='final'?'ffws-br-s2-final':'ffws-br-s2-segunda-fase';
      window.open(`index.html?cffLiveTest=1#${hash}`,'_blank','noopener');
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
