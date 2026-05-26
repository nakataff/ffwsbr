// Limpeza agressiva de cache para evitar site travado em versão antiga no mobile.
(function limparCachesAntigos() {
  const BUILD_VERSION = '20260520-auto-cache-v2';
  const CLEAN_KEY = 'cff_cache_clean_' + BUILD_VERSION;

  async function cleanup() {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }

      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      try {
        localStorage.removeItem('cff_cache_buster');
        sessionStorage.setItem(CLEAN_KEY, '1');
      } catch (_) {}

      // Se a página ainda estiver controlada por um service worker antigo, recarrega uma única vez sem cache.
      // A verificação de 'reloaded' evita loop infinito.
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller && sessionStorage.getItem(CLEAN_KEY) !== 'reloaded') {
        sessionStorage.setItem(CLEAN_KEY, 'reloaded');
        window.location.replace(window.location.pathname + '?v=' + encodeURIComponent(BUILD_VERSION + '-' + Date.now()) + window.location.hash);
        return;
      }

      console.log('[CFF] Cache antigo limpo:', BUILD_VERSION);
    } catch (error) {
      console.warn('[CFF] Falha ao limpar cache antigo:', error);
    }
  }

  // Executa UMA única vez, assim que o script carrega.
  // Remover a chamada duplicada em window.load que causava reload inesperado ao navegar.
  cleanup();
})();
