const CACHE_NAME = 'censo-mascotas-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/db.js',
  '/js/sync.js',
  '/js/personas.js',
  '/js/mascotas.js',
  '/js/censo.js',
  '/js/mapa.js',
  '/js/notifications.js',
  '/js/cloudinary.js',
  '/manifest.json',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // network-first for API calls (local or remote)
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ message: 'Sin conexión' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
    );
    return;
  }

  // cache-first for static assets
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return response;
    }))
  );
});

// ── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json()?.notification || {}; } catch { /* ignore */ }

  const title = data.title || 'Censo de Mascotas';
  const options = {
    body:  data.body  || 'Nuevo censo registrado',
    icon:  data.icon  || '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-72.png',
    data:  { url: (data.data && data.data.url) || '/mapa' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({ type: 'navigate', url: targetUrl });
          return;
        }
      }
      return clients.openWindow(self.location.origin + '/#' + targetUrl);
    })
  );
});

// ── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-censos') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(list => {
        list.forEach(client => client.postMessage({ type: 'sync' }));
      })
    );
  }
});
