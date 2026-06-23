// service-worker.js - Resilient Production Edge Caching
const CACHE_NAME = 'geoguard-cache-v4';

// 🛑 FIXED: Removed the tailwind CDN from this array to bypass the CORS block
const ASSETS = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// Installation Lifecycle hook
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Force clean asset mapping
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activation Engine lifecycle state
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Network Fetch Management Channel
self.addEventListener('fetch', (e) => {
  // Safe validation check to handle external dynamic streams like tailwind safely
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(e.request);
      })
  );
});
