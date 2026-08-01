const CACHE = 'finesse-v10';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app/styles.css',
  './app/main.js',
  './app/cards.js',
  './app/games/sheepshead.js',
  './app/games/sheepshead.engine.js',
  './app/games/sheepshead.coach.js',
  './app/games/sheepshead.study.js',
  './app/games/euchre.js',
  './app/games/euchre.engine.js',
  './app/games/euchre.coach.js',
  './app/games/hearts.js',
  './app/games/hearts.engine.js',
  './app/games/hearts.coach.js',
  './app/games/ohhell.js',
  './app/games/ohhell.engine.js',
  './app/games/ohhell.coach.js',
  './app/games/rook.js',
  './app/games/rook.logic.js',
  './app/games/bridge.js',
  './app/games/bridge.engine.js',
  './app/games/bridge.bid.js',
  './app/games/bridge.study.js',
  './app/games/bridge.conventions.js',
  './app/games/bridge.learn.js',
  './vendor/preact/preact.module.js',
  './vendor/preact/hooks.module.js',
  './vendor/htm/htm.module.js',
  './vendor/htm/preact.module.js',
  './vendor/fonts/bricolage-var.woff2',
  './vendor/fonts/jetbrains-mono-var.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('finesse-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // cacheName scopes the lookup to OUR cache: the origin is shared with
    // sibling PWAs and a cross-app URL collision must never serve their files
    caches.match(e.request, { ignoreSearch: true, cacheName: CACHE }).then(hit => hit || fetch(e.request))
  );
});


