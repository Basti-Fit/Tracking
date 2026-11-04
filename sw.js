/* Formbuch offline cache: serves the app from the phone, refreshes it in the background when online. */
const CACHE = "formbuch-v7";
const CORE = ["./", "index.html", "coach.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || (url.hostname === "cdn.jsdelivr.net" && url.pathname.indexOf("/npm/html5-qrcode@") === 0);
  if (!sameOrigin && !isFont) return;

  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: sameOrigin });
    const network = fetch(req).then((res) => {
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(network); return hit; }
    const res = await network;
    if (res) return res;
    if (req.mode === "navigate") {
      const page = url.pathname.endsWith("coach.html") ? "coach.html" : "index.html";
      const fallback = await cache.match(page);
      if (fallback) return fallback;
    }
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }));
});
