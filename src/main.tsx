import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Service worker NETWORK-FIRST: HTML sempre da rede (sem bundle velho), assets hasheados do cache.
// Habilita PWA instalável (Android 1-toque) + offline, sem o bug de cache antigo.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// No preview/dev do Vite, módulos vêm de /src e /node_modules/.vite/deps. Um service worker
// antigo pode misturar chunks otimizados e causar React duplicado/null em hooks como useState.
if ("serviceWorker" in navigator && import.meta.env.DEV) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  });
}
