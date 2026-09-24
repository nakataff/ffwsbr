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
    head.style.alignItems='center';
    head.style.gap='14px';
    head.innerHTML=`
      <div>
        <p class="admin-eyebrow">Ferramentas privadas</p>
        <h2 style="margin:0">Ferramentas Central FF</h2>
        <p class="admin-muted" style="margin-top:5px">Acesso administrativo e correções internas do site</p>
      </div>
      <div class="admin-inline-actions" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <a class="admin-btn admin-btn-ghost" href="admin-edicao.html" data-admin-edicao-link>🎨 Edição</a>
        <a class="admin-btn admin-btn-primary" href="admin-codiguinhos.html">🎁 Abrir Codiguinhos</a>
        <a class="admin-btn admin-btn-primary" href="admin-dados.html" data-admin-live-data-link>📊 Dados ao vivo</a>
        <a class="admin-btn admin-btn-primary" href="admin-palpite.html">🎯 Palpites</a>
        <a class="admin-btn admin-btn-primary" href="admin-recompensas.html">🔥 Bônus</a>
        <a class="admin-btn admin-btn-primary" href="admin-sorteio-comunidade.html">🎁 Sorteio</a>
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
