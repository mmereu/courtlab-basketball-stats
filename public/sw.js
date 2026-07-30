const CACHE_PREFIX = "courtlab-";
const BUILD_VERSION = "__COURTLAB_BUILD_VERSION__";
const currentCache = `${CACHE_PREFIX}${BUILD_VERSION}`;

async function assetManifest() {
  const response = await fetch("/pwa-assets.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Manifest PWA non disponibile");
  return response.json();
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const manifest = await assetManifest();
    const cache = await caches.open(currentCache);
    await cache.addAll(manifest.assets);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== currentCache)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Account and synchronization responses contain private, mutable data.
  // They must always go to the network and must never enter Cache Storage.
  if (url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(currentCache);
        cache.put("/index.html", response.clone());
        return response;
      } catch {
        return (await caches.match("/index.html"))
          || (await caches.match("/offline.html"))
          || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(currentCache);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
