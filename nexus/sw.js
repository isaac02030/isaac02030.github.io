// ============================================
// NEXUS — Service Worker
// Cache + Push Notifications
// ============================================

// Receber push notification
self.addEventListener('push', e => {
  if (!e.data) return;

  const data = e.data.json();

  e.waitUntil(
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

// Clique na notificação — abrir o dashboard
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/nexus/nexus-dashboard.html';
  e.waitUntil(
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

const CACHE = 'nexus-v4';
const ASSETS = [
  '/nexus/',
  '/nexus/index.html',
  '/nexus/nexus-auth.html',
  '/nexus/nexus-dashboard.html',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Bricolage+Grotesque:opsz,wght@12..60,300;12..60,400;12..60,500;12..60,600&display=swap'
];

// Instalar — guardar ficheiros em cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Ativar — limpar caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — servir do cache quando offline
self.addEventListener('fetch', e => {
  // Não fazer cache de chamadas à API
  if (e.request.url.includes('railway.app')) {
    return fetch(e.request);
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Guardar novos recursos em cache
        const resClone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, resClone));
        return res;
      }).catch(() => {
        // Offline e não está em cache — mostrar página principal
        if (e.request.destination === 'document') {
          return caches.match('/nexus/index.html');
        }
      });
    })
  );
});
