// Service Worker oficial para SIPREF (PWA)
// Diseñado para cumplir con todos los estándares de instalación PWA en Windows / Chrome / Edge
// Sin intervenir ni alterar las llamadas a la base de datos o APIs en tiempo real.

const CACHE_NAME = 'sipref-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Petición directa a la red (network-only) para asegurar que la información y autenticación
  // siempre sean en tiempo real.
  event.respondWith(fetch(event.request));
});
