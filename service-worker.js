// service-worker.js - High-Availability Push & Tracking Matrix
const CACHE_NAME = 'geoguard-cache-v7';
let dynamicIntervalId = null;

const ASSETS = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ⚡ THE LIFE-SAVER: Wakes up the service worker even if Chrome is completely closed!
self.addEventListener('push', (event) => {
  let pushData = { title: "GeoGuard Alert", body: "Emergency broadcast received." };
  
  if (event.data) {
    try {
      pushData = event.data.json();
    } catch (e) {
      pushData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(pushData.title, {
      body: pushData.body,
      icon: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      badge: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      vibrate: [300, 100, 300, 100, 500],
      tag: 'geoguard-emergency-alert',
      renotify: true,
      requireInteraction: true
    })
  );
});

// Front-end context connector loop (Active when tab/browser is open)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_SESSION') {
    const { groupId, userId, firebaseConfig } = event.data;
    initiateBackgroundMonitor(groupId, userId, firebaseConfig.databaseURL);
  }
});

function initiateBackgroundMonitor(groupId, activeUser, databaseURL) {
  if (dynamicIntervalId) clearInterval(dynamicIntervalId);
  const streamUrl = `${databaseURL}/groups/${groupId}/members.json`;
  
  dynamicIntervalId = setInterval(async () => {
    try {
      const response = await fetch(streamUrl);
      if (!response.ok) return;
      const rosterData = await response.json();
      if (!rosterData) return;

      Object.keys(rosterData).forEach(memberId => {
        if (memberId !== activeUser && rosterData[memberId].isEmergency === true) {
          self.registration.showNotification(`CRITICAL SOS: ${rosterData[memberId].name}`, {
            body: `Emergency state active! Check your operational map terminal immediately.`,
            icon: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            tag: 'geoguard-local-poll'
          });
        }
      });
    } catch (err) {
      console.error("Tracing failed:", err);
    }
  }, 8000);
}
