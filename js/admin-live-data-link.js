(()=>{
  function addLink(){
    if(document.querySelector('[data-admin-live-data-link]')) return;
    const panels=[...document.querySelectorAll('.admin-panel')];
    const tools=panels.find(panel=>/Ferramentas privadas/i.test(panel.textContent||'')) || panels[0];
    if(!tools) return;
    const head=tools.querySelector('.admin-panel-head') || tools;
    const actions=head.querySelector('.admin-inline-actions') || head;
    const link=document.createElement('a');
    link.href='admin-dados.html';
    link.className='admin-btn admin-btn-primary';
    link.dataset.adminLiveDataLink='1';
    link.textContent='📊 Dados ao vivo';
    link.style.marginLeft='8px';
    actions.appendChild(link);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addLink,{once:true});
  else addLink();
})();
