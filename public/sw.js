const CACHE_NAME = 'kunthy-watch-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/kunthy_logo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`Failed to precache PWA asset: ${asset}`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log(`Deleting obsolete cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Bypass service worker for API calls and non-GET requests (crucial for login on MS Edge/Safari)
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // Network-first strategy: try network first to get the latest app state, updates, and templates
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache the response if it is successful and is a standard app asset
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fall back to offline cache if net is down
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Optionally return index.html for offline client routing if needed
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: '🚨 ការជូនដំណឹងថ្មី (New Alert)', body: 'មានសារថ្មីពីហាងនាឡិកាដៃគន្ធី!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: '🚨 ការជូនដំណឹងផ្ញើពីម៉ាស៊ីនបម្រើ', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/kunthy_logo.jpg',
    badge: '/kunthy_logo.jpg',
    vibrate: [200, 100, 200],
    data: data.data || { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen || client.url.includes(urlToOpen)) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
