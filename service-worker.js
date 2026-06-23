// service-worker.js - Resilient Production Edge Caching & Background Monitor
const CACHE_NAME = 'geoguard-cache-v6';
let dynamicIntervalId = null;

const ASSETS = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// 🔒 CRASH-PROOF BACKGROUND RADAR: Replaced EventSource with native fetch loops
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_SESSION') {
    const { groupId, userId, firebaseConfig } = event.data;
    initiateBackgroundMonitor(groupId, userId, firebaseConfig.databaseURL);
  }
});

function initiateBackgroundMonitor(groupId, activeUser, databaseURL) {
  if (dynamicIntervalId) clearInterval(dynamicIntervalId);

  const streamUrl = `${databaseURL}/groups/${groupId}/members.json`;
  
  // High-reliability background polling loop
  dynamicIntervalId = setInterval(async () => {
    try {
      const response = await fetch(streamUrl);
      if (!response.ok) return;
      
      const rosterData = await response.json();
      if (!rosterData) return;

      Object.keys(rosterData).forEach(memberId => {
        if (memberId !== activeUser && rosterData[memberId].isEmergency === true) {
          triggerSystemNotification(
            `CRITICAL SOS: ${rosterData[memberId].name}`,
            `Operator needs assistance! Check your GeoGuard terminal grid coordinates immediately.`
          );
        }
      });
    } catch (err) {
      console.error("Background trace failed:", err);
    }
  }, 10000); // Scans every 10 seconds in the background
}

function triggerSystemNotification(headline, summary) {
  self.registration.showNotification(headline, {
    body: summary,
    icon: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    badge: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    vibrate: [200, 100, 200, 100, 400],
    tag: 'geoguard-emergency-alert',
    renotify: true,
    requireInteraction: true
  });
}
