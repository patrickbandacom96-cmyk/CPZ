// Creative Plug Zambia - service worker (offline app shell only; it does NOT sync orders).
// Change CACHE_NAME whenever you update any file so phones fetch the new version.
const CACHE_NAME = "cpz-app-v2";
const APP_FILES = [
  "./", "./index.html", "./admin.html", "./style.css", "./db.js", "./customer.js", "./admin.js", "./manifest.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./icons/logo.png"
];
self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_FILES); }));
  self.skipWaiting();
});
self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(function (cached) {
    return cached || fetch(event.request).catch(function () {
      if (event.request.mode === "navigate") return caches.match("./index.html");
    });
  }));
});
