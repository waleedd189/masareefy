const CACHE_NAME = "masareefy-shell-v1";
const DATA_CACHE = "masareefy-pages-v1";
const OFFLINE_URL = "/offline";
const DB_NAME = "masareefy-offline";
const DB_VERSION = 1;

async function cacheOfflineShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(OFFLINE_URL, { cache: "reload" });
  if (!response.ok) throw new Error("Offline shell unavailable");
  const html = await response.clone().text();
  await cache.put(OFFLINE_URL, response);

  const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith("/_next/static/") || url.startsWith("/icons/"));
  await Promise.allSettled([...new Set(assets)].map((url) => cache.add(url)));
  await Promise.allSettled([
    cache.add("/manifest.webmanifest"),
    cache.add("/icons/icon-192.png"),
    cache.add("/icons/icon-512.png"),
  ]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheOfflineShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => ![CACHE_NAME, DATA_CACHE].includes(key)).map((key) => caches.delete(key))),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(DATA_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match(OFFLINE_URL));
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then(async (response) => {
            if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
            return response;
          }),
      ),
    );
  }
});

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("outbox")) database.createObjectStore("outbox", { keyPath: "id" });
      if (!database.objectStoreNames.contains("snapshots")) database.createObjectStore("snapshots", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readOutbox() {
  const database = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const request = database.transaction("outbox", "readonly").objectStore("outbox").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removeOutbox(ids) {
  const database = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("outbox", "readwrite");
    const store = transaction.objectStore("outbox");
    ids.forEach((id) => store.delete(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function syncOutbox() {
  const operations = await readOutbox();
  if (!operations.length) return;
  const response = await fetch("/api/offline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ operations }),
  });
  if (!response.ok) throw new Error("Sync failed");
  const result = await response.json();
  const completed = result.results.filter((item) => item.ok).map((item) => item.id);
  await removeOutbox(completed);
  const clients = await self.clients.matchAll({ type: "window" });
  clients.forEach((client) => client.postMessage({ type: "OUTBOX_SYNCED" }));
}

self.addEventListener("sync", (event) => {
  if (event.tag === "masareefy-outbox") event.waitUntil(syncOutbox());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "SYNC_OUTBOX") event.waitUntil(syncOutbox());
});
