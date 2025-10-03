const CACHE_NAME = "offlineCache";
const URLS_TO_CACHE = [
  "./sw.js",
  "./manifest.json",
  "./package.json",
  "./index.html",
  "./msh3js.js",
  "./MSHLoader.js",
  "./ViewHelper.js",
  "https://cdn.jsdelivr.net/npm/three@0.151.0/build/three.module.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.151.0/examples/jsm/controls/OrbitControls.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.151.0/examples/jsm/loaders/TGALoader.min.js",
  "https://cdn.jsdelivr.net/npm/stats-gl/dist/main.min.js",
  "https://cdn.jsdelivr.net/npm/tweakpane/dist/tweakpane.min.js",
  "https://cdn.jsdelivr.net/npm/tweakpane-plugin-html-color-picker/dist/tweakpane-plugin-html-color-picker.min.js",
  "https://cdn.jsdelivr.net/npm/webgl-lint/webgl-lint.min.js",
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
      console.log("Adding resources to cache:", CACHE_NAME);

      const cachePromises = URLS_TO_CACHE.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
          }
          await cache.put(url, response);
          console.log(`Cached ${url}`);
        } catch (error) {
          console.error(`Failed to cache ${url}:`, error);
        }
      });

      await Promise.allSettled(cachePromises);  // Wait for all to settle, logging failures
      self.skipWaiting();
    })()
  );
});

// Activate, clean up old caches, and enable navigation preload
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)));

      // Enable navigation preload if supported
      if (self.registration.navigationPreload) {
        console.log("Enabling navigation preload...");
        await self.registration.navigationPreload.enable();
      }

      self.clients.claim();
    })()
  );
});

// Fetch resources with cache-first strategy and validation
self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      if (event.request.method !== "GET") return fetch(event.request);

      // Use preload response if available
      const preloadResponse = await event.preloadResponse;
      if (preloadResponse) return preloadResponse;

      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);

      // Fetch updated version from the network
      try {
        const fetchOptions = cachedResponse
          ? {
              headers: new Headers({
                //"If-Modified-Since": cachedResponse.headers.get("Last-Modified") || "",
                //"If-None-Match": cachedResponse.headers.get("ETag") || "",
              }),
            }
          : {};

        const networkResponse = await fetch(event.request, fetchOptions);
        if (networkResponse && networkResponse.status === 200 && networkResponse.url.startsWith("chrome-extension://") === false) {
          cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        console.warn("Fetch failed, serving from cache if available:", event.request.url, error);
        return cachedResponse || (event.request.mode === "navigate" ? caches.match("/index.html") : null);
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
        await Promise.all(keys.map((cache) => caches.delete(cache)));
        console.log("All caches deleted.");
        self.skipWaiting();
      })()
    );
  }
});
