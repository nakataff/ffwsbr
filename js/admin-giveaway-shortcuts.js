(() => {
  'use strict';
  if (!/admin-sorteio-comunidade\.html$/i.test(location.pathname)) return;
  if (window.__CFF_ADMIN_GIVEAWAY_SHORTCUTS_V2__) return;
  window.__CFF_ADMIN_GIVEAWAY_SHORTCUTS_V2__ = true;

  function link(id, href, text, primary=false, external=false) {
    const a=document.createElement('a');
    a.id=id;
    a.className='admin-btn '+(primary?'admin-btn-primary':'admin-btn-ghost');
    a.href=href;
    a.textContent=text;
    if(external){a.target='_blank';a.rel='noopener';}
    return a;
  }

  function mount() {
    const actions = document.querySelector('.admin-header-actions');
    if (!actions || document.getElementById('cff-open-admin-sorter')) return false;
    actions.appendChild(link('cff-open-admin-sorter','admin-sorteador.html','🎡 Sorteador admin',true,false));
    actions.appendChild(link('cff-open-public-sorter','sorteador/','🌐 Sorteador público',false,true));
    return true;
  }

  if (!mount()) {
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (mount() || tries > 80) clearInterval(timer);
    }, 100);
  }
})();