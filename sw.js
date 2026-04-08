const CACHE_NAME = "learn-koine-greek-v2026-04-08-autorefresh";
const APP_SHELL = [
  "./manifest.json",
  "./assets/media/mascot-coach.mp4",
  "./assets/images/icon-192.png",
  "./assets/images/icon-512.png",
  "./assets/images/mascot-logo.svg",
  "./assets/images/vocab-generic.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;
  const requestMode = event.request.mode === "navigate";
  const freshFirst = requestMode || ["script", "style", "document"].includes(event.request.destination);
  const shouldCache = sameOrigin && !requestMode && !["script", "style", "document"].includes(event.request.destination);

  event.respondWith(
    (freshFirst
      ? fetch(event.request)
          .then((networkResponse) => {
            if (shouldCache && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match("./home.html") || caches.match("./index.html")))
      : caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then((networkResponse) => {
            if (shouldCache && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
            }
            return networkResponse;
          });
        }))
  );
});
