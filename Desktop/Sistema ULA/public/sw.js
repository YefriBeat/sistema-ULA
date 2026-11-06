// Service Worker oficial para SIPREF (PWA)
// Diseñado para cumplir con los estándares de instalación PWA en Windows / Chrome / Edge
// Sin interferir con el enrutamiento SPA ni llamadas al backend

const CACHE_NAME = 'sipref-pwa-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 1. NO interceptar peticiones que no sean GET
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. NO interceptar llamadas de backend / API
  const url = event.request.url;
  if (url.includes('/api/') || url.includes('/upload-pdf')) {
    return;
  }

  // 3. Para navegación de rutas (SPA en React):
  // Si falla la red o es navegación, retornar index.html de la red o responder seguro sin romper la promesa
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cachedIndex = await caches.match('/index.html');
        return cachedIndex || fetch('/index.html').catch(() => new Response('Conexión perdida. Recarga la página.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        }));
      })
    );
    return;
  }

  // 4. Para recursos estáticos (CSS, JS, imágenes):
  // Intentar red primero; si falla, buscar en caché
  event.respondWith(
    fetch(event.request)
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response(null, { status: 404 });
      })
  );
});
