(() => {
  const headerActions = document.querySelector('.admin-header-actions');
  if (!headerActions || headerActions.querySelector('[data-admin-edicao-link]')) return;

  const link = document.createElement('a');
  link.className = 'admin-btn admin-btn-ghost';
  link.href = 'admin-edicao.html';
  link.textContent = '🎨 Edição';
  link.setAttribute('data-admin-edicao-link', '');

  const siteLink = headerActions.querySelector('a[href="index.html"]');
  if (siteLink) headerActions.insertBefore(link, siteLink);
  else headerActions.prepend(link);
})();
