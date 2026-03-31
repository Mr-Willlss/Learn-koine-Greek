const CACHE_NAME = "learn-koine-greek-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./auth.js",
  "./firebase.js",
  "./game.js",
  "./lessons.js",
  "./map.js",
  "./spacedRepetition.js",
  "./speech.js",
  "./teacherCharacter.js",
  "./vocabDatabase.json",
  "./manifest.json",
  "./assets/audio/vocabularies.json",
  "./assets/images/icon-192.png",
  "./assets/images/icon-512.png",
  "./assets/images/mascot-logo.svg",
  "./assets/images/vocab-generic.svg",
  "./assets/sprites/teacher.svg"
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

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          const requestUrl = new URL(event.request.url);
          const sameOrigin = requestUrl.origin === self.location.origin;

          if (sameOrigin && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }

          return Response.error();
        });
    })
  );
});
