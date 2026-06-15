// SETT service worker — DESATIVADO (kill switch).
// O cache agressivo causava bundle/dados velhos após deploy (treino/nutrição não apareciam).
// Esta versão se AUTO-DESTRÓI: limpa todos os caches, se desregistra e recarrega as abas abertas
// para pegarem a versão mais recente direto da rede. Não há fetch handler (nada é interceptado).
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (_e) { /* ignore */ }
      try {
        await self.registration.unregister();
      } catch (_e) { /* ignore */ }
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((c) => c.navigate(c.url));
      } catch (_e) { /* ignore */ }
    })(),
  );
});
