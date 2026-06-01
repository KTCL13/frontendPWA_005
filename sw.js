const CACHE_NAME = "censo-mascotas-v3";
const DATA_CACHE = "censo-mascotas-data-v3";
const CDN_CACHE = "censo-mascotas-cdn-v3";
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
        // Intentar cachear CDNs importantes (Font Awesome, Leaflet)
        // Pero permitir que fallen sin romper la instalación
        return caches.open(CDN_CACHE).then((cache) => {
          const cdnAssets = [
            "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
            "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
          ];
          // Usar Promise.allSettled para no fallar si alguno falla
          return Promise.allSettled(
            cdnAssets.map((url) =>
              fetch(url)
                .then((response) => {
                  if (response.ok) {
                    return cache.put(url, response.clone());
                  }
                })
                .catch(() => {
                  // Ignorar errores de red durante install
                }),
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
              (k) => k !== CACHE_NAME && k !== DATA_CACHE && k !== CDN_CACHE,
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

  // cache-first para llamadas API (cacheamos todo para funcionar sin conexión)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Si está en cache, lo usamos y actualizamos en background
        if (cached) {
          // Intentar actualizar en background
          fetch(request)
            .then((response) => {
              if (response.ok && response.type === "basic") {
                const clone = response.clone();
                caches.open(DATA_CACHE).then((cache) => {
                  cache.put(request, clone);
                  // Guardar timestamp
                  clone
                    .json()
                    .then((data) => {
                      saveTimestamp(request.url, new Date());
                      // Notificar al cliente que hay datos nuevos
                      self.clients.matchAll().then((clients) => {
                        clients.forEach((client) =>
                          client.postMessage({
                            type: "data-updated",
                            url: request.url,
                            timestamp: new Date().toISOString(),
                          }),
                        );
                      });
                    })
                    .catch(() => {
                      caches
                        .open(DATA_CACHE)
                        .then((cache) => cache.put(request, response.clone()));
                    });
                });
              }
            })
            .catch(() => {});

          return cached;
        }

        // Si no está en cache, hacer la petición
        return fetch(request)
          .then((response) => {
            if (
              response.ok &&
              (response.type === "basic" || response.type === "cors")
            ) {
              const clone = response.clone();
              caches.open(DATA_CACHE).then((cache) => {
                cache.put(request, clone);
                // Guardar timestamp
                clone
                  .json()
                  .then((data) => {
                    saveTimestamp(request.url, new Date());
                    self.clients
                      .matchAll()
                      .then((clients) => {
                        clients.forEach((client) =>
                          client.postMessage({
                            type: "data-updated",
                            url: request.url,
                            timestamp: new Date().toISOString(),
                          }),
                        );
                      })
                      .catch(() => {});
                  })
                  .catch(() => {});
              });
            }
            return response;
          })
          .catch(() => {
            // Sin conexión y no hay cache - retornar array vacío para mantener sesión
            // Esto permite que la app siga funcionando en modo offline sin perder sesión
            const emptyData =
              request.method === "GET" ? [] : { error: "offline" };
            return new Response(JSON.stringify(emptyData), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          });
      }),
    );
    return;
  }

  // Para otros dominios (recursos externos - Font Awesome, Leaflet, etc.)
  // Network-first with cache fallback
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (
            response.ok &&
            (response.type === "basic" || response.type === "cors")
          ) {
            const clone = response.clone();
            caches.open(CDN_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Fallback a cache si no hay conexión
          return caches.match(request).then(
            (cached) =>
              cached ||
              new Response(
                JSON.stringify({
                  message: "Sin conexión - recurso no disponible",
                }),
                {
                  status: 503,
                  headers: { "Content-Type": "application/json" },
                },
              ),
          );
        }),
    );
    return;
  }

  // cache-first para static assets
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }),
    ),
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

// ── Helper Functions ─────────────────────────────────────────────────────────
function saveTimestamp(url, date) {
  // Guardar en IndexedDB para recuperar timestamps
  const dbName = "censoDB";
  const storeName = "timestamps";
  const openRequest = indexedDB.open(dbName, 1);

  openRequest.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName);
    }
  };

  openRequest.onsuccess = (e) => {
    const db = e.target.result;
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(date.getTime(), url);
  };
}

// Limpiar cache antiguo periódicamente
async function cleanOldCache() {
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    if (name !== CACHE_NAME && name !== DATA_CACHE) {
      await caches.delete(name);
    }
  }
}
