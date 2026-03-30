const STATIC_CACHE = 'nexus-static-v9';
const PAGE_CACHE = 'nexus-pages-v9';
const API_CACHE = 'nexus-api-v9';
const OFFLINE_URL = '/nexus/offline.html';
const STATIC_ASSETS = [
  '/nexus/',
  '/nexus/index.html',
  '/nexus/nexus-auth.html',
  '/nexus/nexus-dashboard.html',
  '/nexus/nexus-profile.html',
  '/nexus/nexus-communities.html',
  '/nexus/manifest.json',
  '/nexus/nexus-logo.svg',
  '/nexus/icon-192.png',
  '/nexus/icon-512.png',
  OFFLINE_URL
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
      }

      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => ![STATIC_CACHE, PAGE_CACHE, API_CACHE].includes(key))
          .map(key => caches.delete(key))
      );
    })()
  );
  self.clients.claim();
});

function isApiRequest(request) {
  return request.url.includes('railway.app') || request.url.includes('/api/');
}

function isStaticAsset(request) {
  return ['style', 'script', 'image', 'font'].includes(request.destination);
}

async function networkFirst(request, cacheName, fallbackUrl = null) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (request.method === 'GET' && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (request.method === 'GET' && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(PAGE_CACHE);
      try {
        const preloadResponse = await event.preloadResponse;
        const response = preloadResponse || await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        const fallback = await caches.match(OFFLINE_URL);
        return fallback || Response.error();
      }
    })());
    return;
  }

  if (isApiRequest(request)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});

self.addEventListener('push', event => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (error) {
    data = { title: 'Nexus', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Nexus', {
      body: data.body || 'Ha algo a proteger hoje.',
      icon: '/nexus/icon-192.png',
      badge: '/nexus/icon-192.png',
      data: { url: data.url || '/nexus/nexus-dashboard.html' },
      vibrate: [180, 80, 180],
      requireInteraction: false
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/nexus/nexus-dashboard.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(client => client.url.includes('/nexus/'));
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return clients.openWindow(targetUrl);
    })
  );
});
