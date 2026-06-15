// SETT service worker — offline app shell + asset caching.
// Registered only in production (see main.tsx). Never caches cross-origin
// requests (Supabase API, Google Fonts) so live data and auth always hit network.
const CACHE = "sett-cache-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// respondWith NUNCA pode receber undefined — isso gera "Failed to convert value to 'Response'".
const offlineResponse = () =>
  new Response("Offline", { status: 503, statusText: "Offline", headers: { "Content-Type": "text/plain" } });

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/fonts vão direto pra rede

  // Navegações: network-first; offline → shell cacheado (sempre uma Response válida).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/index.html")) || offlineResponse()),
    );
    return;
  }

  // Assets estáticos (arquivos com hash): cache-first → rede; nunca retorna undefined.
  event.respondWith(
    caches.match(req).then(async (cached) => {
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok && (url.pathname.startsWith("/assets/") || APP_SHELL.includes(url.pathname))) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      } catch {
        return (await caches.match(req)) || offlineResponse();
      }
    }),
  );
});
