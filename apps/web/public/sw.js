const CACHE_NAME = "moneypulse-shell-v2";
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.svg", "/icons/icon-512.svg"];

function isShellAsset(pathname) {
  return SHELL_URLS.includes(pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    ).then(async () => {
      if ("navigationPreload" in self.registration) {
        await self.registration.navigationPreload.enable();
      }
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloadResponse = await event.preloadResponse;
          const response = preloadResponse || (await fetch(request));

          if (response.ok) {
            const responseClone = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put("/", responseClone));
          }

          return response;
        } catch {
          return (await caches.match("/")) || Response.error();
        }
      })()
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }

          return response;
        });
      })
    );
    return;
  }

  if (isShellAsset(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }

          return response;
        })
        .catch(async () => (await caches.match(request)) || Response.error())
    );
    return;
  }

  event.respondWith(fetch(request));
});
