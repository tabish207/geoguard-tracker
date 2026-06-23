// service-worker.js - Resilient Production Edge Caching & Background Monitor
const CACHE_NAME = 'geoguard-cache-v5';
let eventStreamSource = null;

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

// 🔒 BACKGROUND RADAR CORE: Communicates with front-end variables to track events offline
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_SESSION') {
    const { groupId, userId, firebaseConfig } = event.data;
    initiateBackgroundMonitor(groupId, userId, firebaseConfig.databaseURL);
  }
});

function initiateBackgroundMonitor(groupId, activeUser, databaseURL) {
  if (eventStreamSource) eventStreamSource.close();

  // Create an explicit background event channel using Firebase REST streaming protocol
  const streamUrl = `${databaseURL}/groups/${groupId}/members.json`;
  
  eventStreamSource = new EventSource(streamUrl);
  
  eventStreamSource.addEventListener('put', (e) => {
    const streamPayload = JSON.parse(e.data);
    if (!streamPayload || !streamPayload.data) return;

    const rosterData = streamPayload.data;

    // Check for incoming SOS events from other members
    Object.keys(rosterData).forEach(memberId => {
      if (memberId !== activeUser && rosterData[memberId].isEmergency === true) {
        triggerSystemNotification(
          `CRITICAL SOS: ${rosterData[memberId].name}`,
          `Operator is reporting an emergency emergency situation! Check your GeoGuard terminal grid coordinates immediately.`
        );
      }
    });
  });
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
