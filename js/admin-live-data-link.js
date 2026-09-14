(()=>{
  function mountTools(){
    const panels=[...document.querySelectorAll('.admin-panel')];
    const tools=panels.find(panel=>/Ferramentas privadas|Controle de premiações|Ferramentas Central FF/i.test(panel.textContent||''));
    if(!tools)return;

    document.querySelectorAll('.admin-header-actions [data-admin-edicao-link]').forEach(el=>el.remove());

    tools.dataset.centralTools='1';
    tools.style.marginBottom='16px';
    tools.innerHTML=`
      <div class="admin-panel-head admin-panel-head-wrap" style="align-items:center;gap:14px">
        <div><h2 style="margin:0">Ferramentas Central FF</h2></div>
        <div class="admin-inline-actions" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <a class="admin-btn admin-btn-ghost" href="admin-edicao.html" data-admin-edicao-link>🎨 Edição</a>
          <a class="admin-btn admin-btn-primary" href="admin-codiguinhos.html">🎁 Abrir Codiguinhos</a>
          <a class="admin-btn admin-btn-primary" href="admin-dados.html" data-admin-live-data-link>📊 Dados ao vivo</a>
          <a class="admin-btn admin-btn-primary" href="admin-palpite.html">🎯 Palpites</a>
        </div>
      </div>`;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountTools,{once:true});
  else mountTools();
})();
