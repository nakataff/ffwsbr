// Remove service workers e caches antigos para evitar GitHub Pages/mobile preso em versão velha.
// Este arquivo precisa estar carregado no index.html. Depois de uma atualização, pode manter ativo.
(function limparCachesAntigos() {
  if (!('serviceWorker' in navigator)) return;

  async function cleanup() {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));

      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      console.log('[CFF] Service workers/caches antigos removidos.');
    } catch (error) {
      console.warn('[CFF] Falha ao limpar service worker/cache:', error);
    }
  }

  cleanup();
  window.addEventListener('load', cleanup, { once: true });
})();
