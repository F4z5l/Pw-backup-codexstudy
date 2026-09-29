const CACHE_NAME = "codex-studys-shell-v13";
const SHELL_FILES = ["./index.html", "./app.js", "./profile.js", "./manifest.json", "./assets/icon-192.png", "./assets/icon-512.png", "./assets/pw-icon-192.png", "./assets/pw-icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // The live batch catalog is served cross-origin; it is the only external request the worker handles.
  const isCatalog = url.hostname === "studystark.github.io" && url.pathname.endsWith("/batches/batches.json");
  if (event.request.method !== "GET" || (url.origin !== self.location.origin && !isCatalog)) return;

  // Network-first for page navigations so UI/logic updates (like the popups) land on the very next visit.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Network-first for the live course data so listings stay fresh when online.
  if (isCatalog || url.pathname.endsWith("batches.json")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first for the app's own scripts so a new deploy is picked up immediately (cache only as offline fallback).
  if (/\/(app|profile)\.js$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for the rest of the app shell.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});
