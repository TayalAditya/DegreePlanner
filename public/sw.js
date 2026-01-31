// Service Worker for PWA functionality

const CACHE_NAME = "degree-planner-v1";
const STATIC_CACHE = "static-v1";
const DYNAMIC_CACHE = "dynamic-v1";

// Assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/manifest.json",
  "/offline.html",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip Chrome extensions
  if (url.protocol === "chrome-extension:") return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update in background
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, response.clone());
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // Fetch from network and cache
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "error") {
            return response;
          }

          // Cache successful responses
          const responseToCache = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (request.mode === "navigate") {
            return caches.match("/offline.html");
          }
        });
    })
  );
});

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-enrollments") {
    event.waitUntil(syncEnrollments());
  }
});

async function syncEnrollments() {
  // Sync pending enrollments when back online
  // Implementation would retrieve from IndexedDB and POST to server
  console.log("Syncing enrollments...");
}

// Push notifications (for future feature)
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Degree Planner Notification";
  const options = {
    body: data.body || "You have a new notification",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    data: data.url,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || "/dashboard")
  );
});
