const CACHE_NAME = "censo-mascotas-v3";
const DATA_CACHE = "censo-mascotas-data-v3";
const CDN_CACHE = "censo-mascotas-cdn-v3";
const IMAGE_CACHE = "censo-mascotas-images-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/js/app.js",
  "/js/api.js",
  "/js/auth.js",
  "/js/db.js",
  "/js/sync.js",
  "/js/personas.js",
  "/js/mascotas.js",
  "/js/censo.js",
  "/js/mapa.js",
  "/js/notifications.js",
  "/js/cloudinary.js",
  "/js/image-utils.js",
  "/js/cache-manager.js",
  "/js/connection-manager.js",
  "/js/panel-utils.js",
  "/manifest.json",
  "/assets/icons/icon.svg",
  "/assets/icons/icon-192.png",
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => {
        return caches.open(CDN_CACHE).then((cache) => {
          const cdnAssets = [
            "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
          ];
          return Promise.allSettled(
            cdnAssets.map((url) =>
              fetch(url)
                .then((response) => {
                  if (response.ok) {
                    return cache.put(url, response.clone());
                  }
                })
                .catch(() => {}),
            ),
          );
        });
      }),
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) => k !== CACHE_NAME && k !== DATA_CACHE && k !== CDN_CACHE && k !== IMAGE_CACHE,
            )
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network-first, cache fallback, update cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            const cleanKey = url.origin + url.pathname;
            caches.open(DATA_CACHE).then((cache) => cache.put(cleanKey, clone));
          }
          return response;
        })
        .catch(() => {
          const cleanKey = url.origin + url.pathname;
          return caches.match(cleanKey).then(
            (cached) =>
              cached ||
              new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }),
          );
        }),
    );
    return;
  }

  // External resources (CDN, APIs): network-first, cache fallback, update cache
  if (url.hostname !== self.location.hostname) {
    const isImage = url.hostname.includes("res.cloudinary.com");
    const isTile = url.hostname.includes("tile.openstreetmap.org");

    if (isImage || isTile) {
      event.respondWith(
        caches.open(IMAGE_CACHE).then((cache) => {
          return cache.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            }).catch(() => undefined);
          });
        }),
      );
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            const cleanRequest = new Request(url.origin + url.pathname);
            caches.open(CDN_CACHE).then((cache) => cache.put(cleanRequest, clone));
          }
          return response;
        })
        .catch(() => {
          const cleanRequest = new Request(url.origin + url.pathname);
          return caches.match(cleanRequest);
        }),
    );
    return;
  }

  // Static assets: network-first, cache fallback, update cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      }),
  );
});

// ── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json()?.notification || {};
  } catch {
    /* ignore */
  }

  const title = data.title || "Censo de Mascotas";
  const options = {
    body: data.body || "Nuevo censo registrado",
    icon: data.icon || "/assets/icons/icon-192.png",
    badge: "/assets/icons/icon-72.png",
    data: { url: (data.data && data.data.url) || "/mapa" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.postMessage({ type: "navigate", url: targetUrl });
            return;
          }
        }
        return clients.openWindow(self.location.origin + "/#" + targetUrl);
      }),
  );
});

// ── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync-censos" || event.tag === "data-refresh") {
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((list) => {
        list.forEach((client) => client.postMessage({ type: "sync" }));
      }),
    );
  }
});
