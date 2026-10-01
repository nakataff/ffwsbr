(()=>{
  function mountTools(){
    const panels=[...document.querySelectorAll('.admin-panel')];
    const tools=panels.find(panel=>/Ferramentas privadas|Controle de premiações|Ferramentas Central FF/i.test(panel.textContent||''));
    if(!tools)return;

    document.querySelectorAll('.admin-header-actions [data-admin-edicao-link]').forEach(el=>el.remove());

    tools.dataset.centralTools='1';
    tools.style.marginBottom='16px';

    let head=tools.querySelector('.admin-panel-head');
    if(!head){
      head=document.createElement('div');
      head.className='admin-panel-head admin-panel-head-wrap';
      tools.prepend(head);
    }
    head.style.alignItems='stretch';
    head.style.gap='12px';
    head.style.flexDirection='column';
    head.innerHTML=`
      <div>
        <p class="admin-eyebrow">Ferramentas privadas</p>
        <h2 style="margin:0">Ferramentas Central FF</h2>
        <p class="admin-muted" style="margin-top:5px">Acesso administrativo e correções internas do site</p>
      </div>
      <div class="admin-inline-actions" style="display:flex;gap:8px;flex-wrap:nowrap;align-items:center;width:100%;overflow-x:auto;padding-bottom:4px">
        <a class="admin-btn admin-btn-ghost" href="admin-edicao.html" data-admin-edicao-link style="flex:0 0 auto">🎨 Edição</a>
        <a class="admin-btn admin-btn-primary" href="admin-codiguinhos.html" style="flex:0 0 auto">🎁 Abrir Codiguinhos</a>
        <a class="admin-btn admin-btn-primary" href="admin-dados.html" data-admin-live-data-link style="flex:0 0 auto">📊 Dados ao vivo</a>
        <a class="admin-btn admin-btn-primary" href="admin-camp-ao-vivo.html" style="flex:0 0 auto">🏆 Camp ao vivo</a>
        <a class="admin-btn admin-btn-primary" href="admin-palpite.html" style="flex:0 0 auto">🎯 Palpites</a>
        <a class="admin-btn admin-btn-primary" href="admin-recompensas.html" style="flex:0 0 auto">🔥 Bônus</a>
        <a class="admin-btn admin-btn-primary" href="admin-sorteio-comunidade.html" style="flex:0 0 auto">🎁 Sorteio</a>
        <a class="admin-btn admin-btn-primary" href="admin-sorteador.html" style="flex:0 0 auto">🎡 Sorteador</a>
      </div>`;

    const recalc=tools.querySelector('.admin-community-recalc');
    if(recalc){
      recalc.hidden=false;
      recalc.style.display='';
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountTools,{once:true});
  else mountTools();
})();
