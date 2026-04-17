/**
 * Service Worker — exam-engine
 * Scope: /modules/exam-engine/fe/web/
 *
 * Strategy:
 *   Static pages/assets → cache-first (install-time)
 *   CDN JSON (catalogue, bundles) → cache-first + background update via manifest
 *   API sessions (start, sync, submit) → network-only
 */

const STATIC_CACHE  = "exam-static-v1";
const DATA_CACHE    = "exam-data-v1";
const ASSET_CACHE   = "exam-assets-v1";

const CDN_MANIFEST  = self.__CDN_MANIFEST || "";   // injected by register-sw.js

// Pages + shared JS bundled into the app
const STATIC_FILES = [
  "./home.html",
  "./exam.html",
  "./result.html",
  "./analysis.html",
  "/modules/auth/fe/web/login.html",
];

// Third-party assets cached once
const ASSET_URLS = [
  "https://unpkg.com/htmx.org@2.0.3/dist/htmx.min.js",
  "https://cdn.tailwindcss.com",
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(Promise.all([
    caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_FILES).catch(() => {})),
    caches.open(ASSET_CACHE).then(c  => c.addAll(ASSET_URLS).catch(() => {})),
  ]));
  self.skipWaiting();
});

// ── Activate — clean old caches ───────────────────────────────────────────────
self.addEventListener("activate", event => {
  const keep = [STATIC_CACHE, DATA_CACHE, ASSET_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API session calls — always network (never cache)
  const isApiSession = ["/exam/exam/start", "/exam/exam/sync", "/exam/exam/submit",
                        "/auth/login", "/auth/refresh"].some(p => url.pathname === p);
  if (isApiSession) {
    event.respondWith(fetch(request).catch(() =>
      new Response(JSON.stringify({ error: "offline" }), {
        status: 503, headers: { "Content-Type": "application/json" },
      })
    ));
    return;
  }

  // 2. CDN data JSON — cache-first, update in background
  const isCdnData = url.hostname !== self.location.hostname &&
                    request.method === "GET" &&
                    url.pathname.endsWith(".json");
  if (isCdnData) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async cache => {
        const cached = await cache.match(request);
        // Background update
        const netFetch = fetch(request).then(res => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => null);
        return cached || await netFetch ||
          new Response("{}", { headers: { "Content-Type": "application/json" } });
      })
    );
    return;
  }

  // 3. Third-party assets (HTMX, Tailwind) — cache-first
  const isCdnAsset = ASSET_URLS.some(u => request.url.startsWith(u.split("?")[0]));
  if (isCdnAsset) {
    event.respondWith(
      caches.match(request).then(c => c || fetch(request).then(res => {
        caches.open(ASSET_CACHE).then(cache => { if (res.ok) cache.put(request, res.clone()); });
        return res;
      }))
    );
    return;
  }

  // 4. Everything else — cache-first, network fallback
  event.respondWith(
    caches.match(request).then(c => c || fetch(request).then(res => {
      if (res.ok && request.method === "GET") {
        caches.open(STATIC_CACHE).then(cache => cache.put(request, res.clone()));
      }
      return res;
    }).catch(() => caches.match("./home.html")))
  );
});

// ── Message: CDN delta sync ───────────────────────────────────────────────────
self.addEventListener("message", async event => {
  if (event.data?.type !== "CDN_SYNC") return;
  const manifestUrl = event.data.manifestUrl || CDN_MANIFEST;
  if (!manifestUrl) return;

  try {
    const res      = await fetch(manifestUrl);
    const manifest = await res.json();
    const cache    = await caches.open(DATA_CACHE);
    let   updated  = 0;

    for (const { url, hash } of (manifest.files || [])) {
      const existing = await cache.match(url);
      if (existing?.headers.get("x-cdn-hash") === hash) continue;

      const fresh = await fetch(url).catch(() => null);
      if (!fresh?.ok) continue;

      // Store with hash header so we can diff next time
      const headers = new Headers(fresh.headers);
      headers.set("x-cdn-hash", hash);
      await cache.put(url, new Response(await fresh.blob(), { status: 200, headers }));
      updated++;
    }

    // Notify all clients
    const clients = await self.clients.matchAll();
    clients.forEach(c => c.postMessage({ type: "CDN_SYNC_DONE", updated }));
  } catch (e) {
    console.log("[sw] CDN sync failed:", e.message);
  }
});
