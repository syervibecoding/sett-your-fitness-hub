import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Service worker DESATIVADO: o cache agressivo causava bundle/dados velhos (treino/nutrição não
// apareciam após deploy). Em vez de registrar, removemos qualquer SW antigo e limpamos os caches —
// o app passa a buscar tudo da rede (sempre a versão mais recente).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister()))
    .catch(() => {});
}
if (typeof caches !== "undefined") {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
}
