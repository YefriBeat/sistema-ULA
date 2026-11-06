// Service Worker oficial para SIPREF (PWA)
// Diseñado para cumplir con los estándares de instalación PWA en Windows / Chrome / Edge
// Sin interferir con peticiones de red, APIs ni assets

const CACHE_NAME = 'sipref-pwa-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpiar cualquier caché residual de versiones anteriores
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Listener de fetch nativo para cumplir el criterio de instalación PWA
// sin alterar ni interceptar peticiones de la aplicación
self.addEventListener('fetch', (event) => {
  // Deja que el navegador maneje las peticiones nativamente por la red
});
