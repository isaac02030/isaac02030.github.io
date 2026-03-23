// ============================================
// NEXUS - Service Worker
// Cache + Push Notifications
// ============================================

const CACHE = 'nexus-v5';
const ASSETS = [
  '/nexus/',
  '/nexus/index.html',
  '/nexus/nexus-auth.html',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Bricolage+Grotesque:opsz,wght@12..60,300;12..60,400;12..60,500;12..60,600&display=swap'
];

self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/nexus/icon-192.png',
      badge: '/nexus/icon-192.png',
      data: { url: data.url || '/nexus/nexus-dashboard.html' },
      vibrate: [200, 100, 200],
      requireInteraction: false
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/nexus/nexus-dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('nexus') && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('railway.app')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // HTML always goes to the network first so deploys are reflected immediately.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() =>
        caches.match(event.request).then(cached => cached || caches.match('/nexus/index.html'))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/nexus/index.html');
        }
      });
    })
  );
});
