const CACHE_NAME = "learn-koine-greek-v2026-04-22-202604222";
const APP_SHELL = [
  "./index.html",
  "./home.html",
  "./dashboard.html",
  "./lesson.html",
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

  const fetchFresh = (request) => {
    try {
      // Bypass HTTP cache for app-critical assets so users get updates without hard refresh.
      return fetch(new Request(request, { cache: "no-store" }));
    } catch (_) {
      return fetch(request);
    }
  };

  event.respondWith(
    (freshFirst
      ? fetchFresh(event.request)
          .then((networkResponse) => {
            if (shouldCache && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
           .catch(() =>
             caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) =>
               cachedResponse || caches.match("./dashboard.html") || caches.match("./index.html")
             )
           )
      : caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetchFresh(event.request).then((networkResponse) => {
            if (shouldCache && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
            }
            return networkResponse;
          });
        }))
  );
});
