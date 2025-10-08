const CACHE_NAME = "offlineCache-v2"; // Increment version to trigger update
const URLS_TO_CACHE = [
  "./sw.js",
  "./manifest.json",
  "./package.json",
  "./index.html",
  "./msh3js.js",
  "./msh3js.umd.js",
  "./MSHLoader.js",
  "./ViewHelper.js",
  "./fonts/Aurebesh.ttf",
  "https://cdn.jsdelivr.net/npm/three@0.151.0/build/three.module.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.151.0/examples/jsm/controls/OrbitControls.js",
  "https://cdn.jsdelivr.net/npm/three@0.151.0/examples/jsm/loaders/TGALoader.js",
  "https://cdn.jsdelivr.net/npm/three@0.151.0/examples/jsm/loaders/EXRLoader.js",
  "https://cdn.jsdelivr.net/npm/three@0.151.0/examples/jsm/loaders/RGBELoader.js",
  "https://cdn.jsdelivr.net/npm/stats-gl/dist/main.min.js",
  "https://cdn.jsdelivr.net/npm/tweakpane/dist/tweakpane.min.js",
  "https://cdn.jsdelivr.net/npm/tweakpane-plugin-html-color-picker/dist/tweakpane-plugin-html-color-picker.min.js",
  "https://cdn.jsdelivr.net/npm/webgl-lint/webgl-lint.min.js",
  "https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.6.8/build/index.module.js",
  "./android-chrome-192x192.png",
  "./android-chrome-512x512.png",
  "./favicon-16x16.png",
  "./favicon-32x32.png",
  "./favicon.ico",
  "./apple-touch-icon.png",
];

// Install and cache resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log("Service Worker: Caching app shell...");
      // Use addAll for atomic caching. If one file fails, the whole install fails.
      // This prevents a partially cached, broken state.
      await cache.addAll(URLS_TO_CACHE);
      self.skipWaiting();
    })()
  );
});

// Activate, clean up old caches, and enable navigation preload
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)));

      // Enable navigation preload if supported
      if (self.registration.navigationPreload) {
        console.log("Enabling navigation preload...");
        await self.registration.navigationPreload.enable();
      }

      self.clients.claim();
    })()
  );
});

// Fetch resources with a cache-first strategy for pre-cached assets,
// and a network-first strategy for everything else.
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // For pre-cached assets, use a cache-first strategy for speed and offline reliability.
  if (URLS_TO_CACHE.includes(url.pathname) || URLS_TO_CACHE.includes(event.request.url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          return response || fetch(event.request);
        });
      })
    );
    return;
  }

  // For all other requests, use a network-falling-back-to-cache strategy.
  event.respondWith(
    (async () => {
      // Use preload response if available
      const preloadResponse = await event.preloadResponse;
      if (preloadResponse) return preloadResponse;

      const cache = await caches.open(CACHE_NAME);

      try {
        const networkResponse = await fetch(event.request);
        // Cache the new response, but don't cache chrome-extension:// files
        if (networkResponse.status === 200 && !url.protocol.startsWith('chrome-extension')) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        console.warn(`Service Worker: Network request for ${event.request.url} failed, trying cache.`, error);
        const cachedResponse = await cache.match(event.request);
        // For navigation requests, fall back to the main index.html page.
        return cachedResponse || (event.request.mode === 'navigate' ? caches.match('./index.html') : null);
      }
    })()
  );
});

// Handle messages from the main thread
self.addEventListener("message", (event) => {
  if (event.data?.action === "clearCache") {
    console.log("Service worker received clearCache message.");

    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
        console.log("All caches deleted.");

        // After clearing cache, notify all clients to reload
        const clients = await self.clients.matchAll({ type: 'window' });
        clients.forEach(client => {
          client.postMessage({ action: 'reload' });
        });
      })()
    );
  }
});
