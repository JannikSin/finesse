const CACHE = 'sheepdog-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app/styles.css',
  './app/main.js',
  './app/engine.js',
  './app/coach.js',
  './app/study.js',
  './vendor/preact/preact.module.js',
  './vendor/preact/hooks.module.js',
  './vendor/htm/htm.module.js',
  './vendor/htm/preact.module.js',
  './vendor/fonts/bricolage-var.woff2',
  './vendor/fonts/jetbrains-mono-var.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))
  );
});
