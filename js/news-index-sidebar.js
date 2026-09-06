(() => {
  'use strict';

  function openSidebar() {
    document.getElementById('sidebar-panel')?.classList.add('active');
    document.getElementById('sidebar-overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    document.getElementById('sidebar-panel')?.classList.remove('active');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
  }

  function toggleSidebarSection(key) {
    const el = document.getElementById('sidebar-section-' + key);
    if (!el) return;
    const open = !el.classList.contains('is-open');
    el.classList.toggle('is-open', open);
    el.querySelector('.sidebar-section-toggle')?.setAttribute('aria-expanded', String(open));
    try { localStorage.setItem('cff-sidebar-section-' + key, open ? 'open' : 'closed'); } catch (_) {}
  }

  function navigateAndClose(page) {
    closeSidebar();
    const target = String(page || 'home').trim();
    location.href = target === 'home' ? '/' : '/#' + target;
  }

  async function purgeSiteCache() {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      localStorage.removeItem('cff_news_cache_admin_v1');
    } catch (_) {}
    location.href = '/';
  }

  function restoreSections() {
    document.querySelectorAll('.sidebar-section[data-section-key]').forEach((el) => {
      try {
        const val = localStorage.getItem('cff-sidebar-section-' + el.dataset.sectionKey);
        if (val) {
          const open = val === 'open';
          el.classList.toggle('is-open', open);
          el.querySelector('.sidebar-section-toggle')?.setAttribute('aria-expanded', String(open));
        }
      } catch (_) {}
    });
  }

  function ensureTrigger() {
    const topbar = document.querySelector('.news-topbar');
    if (!topbar || document.getElementById('news-sidebar-trigger')) return;
    const left = document.createElement('div');
    left.className = 'news-topbar-left';
    const trigger = document.createElement('button');
    trigger.id = 'news-sidebar-trigger';
    trigger.className = 'news-sidebar-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Abrir menu');
    trigger.innerHTML = '<span aria-hidden="true">☰</span><b>MENU</b>';
    trigger.addEventListener('click', openSidebar);
    const back = topbar.querySelector('.news-back');
    if (back) left.append(trigger, back);
    else left.append(trigger);
    topbar.prepend(left);
  }

  async function mountIndexSidebar() {
    ensureTrigger();
    if (document.getElementById('sidebar-panel')) return;
    try {
      const response = await fetch('/?cff_sidebar_source=1', { cache: 'default' });
      if (!response.ok) throw new Error('Falha ao carregar menu');
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const overlay = doc.getElementById('sidebar-overlay');
      const panel = doc.getElementById('sidebar-panel');
      if (!overlay || !panel) throw new Error('Menu do index não encontrado');
      document.body.prepend(panel);
      document.body.prepend(overlay);
      restoreSections();
    } catch (error) {
      console.error('[CFF notícia] menu lateral', error);
    }
  }

  window.openSidebar = openSidebar;
  window.closeSidebar = closeSidebar;
  window.toggleSidebarSection = toggleSidebarSection;
  window.navigateAndClose = navigateAndClose;
  window.purgeSiteCache = purgeSiteCache;

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSidebar();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountIndexSidebar, { once: true });
  else mountIndexSidebar();
})();
