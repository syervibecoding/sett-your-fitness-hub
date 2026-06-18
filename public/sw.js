// SETT service worker — NETWORK-FIRST (instalável + offline, sem bundle velho).
// Estratégia:
//   - Navegação / HTML  → network-first: sempre tenta a rede (versão mais nova); cache só como
//     fallback offline. Isso evita o bug de "bundle/dados velhos" que motivou o kill-switch antigo.
//   - Assets do Vite (JS/CSS com hash no nome) → cache-first: o nome muda a cada build, então o
//     cache NUNCA serve algo desatualizado; ganhamos velocidade e offline.
// Bump CACHE a cada mudança estrutural deste arquivo para forçar limpeza dos caches antigos.
const CACHE = "sett-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return; // só same-origin

  const isHTML =
    req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  if (isHTML) {
    // Network-first: versão nova sempre que houver rede; cache offline como rede de segurança.
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put("/", fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match("/")) || (await cache.match(req)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Assets hasheados → cache-first (seguros porque o nome muda por build).
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
