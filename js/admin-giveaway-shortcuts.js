(() => {
  'use strict';
  if (!/admin-sorteio-comunidade\.html$/i.test(location.pathname)) return;
  if (window.__CFF_ADMIN_GIVEAWAY_SHORTCUTS_V1__) return;
  window.__CFF_ADMIN_GIVEAWAY_SHORTCUTS_V1__ = true;

  function mount() {
    const actions = document.querySelector('.admin-header-actions');
    if (!actions || document.getElementById('cff-open-sorter')) return false;
    const link = document.createElement('a');
    link.id = 'cff-open-sorter';
    link.className = 'admin-btn admin-btn-primary';
    link.href = 'sorteador/';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '🎡 Abrir sorteador';
    actions.appendChild(link);
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
