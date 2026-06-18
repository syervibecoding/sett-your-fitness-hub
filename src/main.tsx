import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Service worker NETWORK-FIRST: HTML sempre da rede (sem bundle velho), assets hasheados do cache.
// Habilita PWA instalável (Android 1-toque) + offline, sem o bug de cache antigo.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
