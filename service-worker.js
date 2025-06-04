// service-worker.js
const CACHE_NAME = 'sim-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/js/main.js',
  '/js/ui.js',
  '/js/codeEditor.js',
  '/js/config.js',
  '/js/lapTimer.js',
  '/js/monaco-setup.js',
  '/js/pidController.js',
  '/js/robot.js',
  '/js/robotEditor.js',
  '/js/robotParts.js',
  '/js/simulation.js',
  '/js/track.js',
  '/js/trackEditor.js',
  '/assets/Logo%20guaroduino.png',
  // Puedes agregar más archivos y assets aquí
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
