(() => {
  'use strict';

  const PAGE = 'selecao-da-semana';
  let lastGood = '';
  let restoring = false;

  const isActive = root => Boolean(root) && (
    String(location.hash || '').replace(/^#/,'') === PAGE || root.classList.contains('active')
  );

  const style = document.createElement('style');
  style.id = 's1-selection-exclusive-guard-css';
  style.textContent = `
    #${PAGE} > :not([data-s1s2-selection-root]){visibility:hidden!important}
    #${PAGE} > [data-s1s2-selection-root]{visibility:visible!important}
  `;
  if (!document.getElementById(style.id)) document.head.appendChild(style);

  const protect = () => {
    const root = document.getElementById(PAGE);
    if (!isActive(root) || restoring) return;
    const current = root.querySelector(':scope > [data-s1s2-selection-root]');
    if (current) {
      lastGood = root.innerHTML;
      return;
    }
    if (!lastGood) return;
    restoring = true;
    root.innerHTML = lastGood;
    restoring = false;
  };

  const observer = new MutationObserver(protect);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('hashchange',() => setTimeout(protect,0));
  document.addEventListener('DOMContentLoaded',protect,{once:true});
  if (document.readyState !== 'loading') protect();
})();