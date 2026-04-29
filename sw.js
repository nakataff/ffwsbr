// Nome e versão do cache do seu app
const CACHE_NAME = 'cff-cache-v1';

// Arquivos que o app vai salvar no celular para carregar mais rápido
const urlsToCache = [
  '/',
  '/index.html',
  '/central free fire.webp'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercepta as requisições para carregar do cache se estiver offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna o cache se encontrar, senão busca na internet
        return response || fetch(event.request);
      })
  );
});
