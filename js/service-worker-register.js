// Service Worker desativado temporariamente.
// Remove registros/cache antigos para evitar precisar de Ctrl+F5 a cada atualização.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }

      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      console.log('Service workers/caches antigos removidos.');
    } catch (error) {
      console.log('Falha ao limpar service worker/cache:', error);
    }
  });
}
