import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

// Popup "baixar o app" no padrão Femme/IZone: aparece no mobile quando o app NÃO está
// instalado. Android/Chrome → botão de instalar nativo (beforeinstallprompt capturado cedo
// em window.__bip pelo index.html). iOS → instrução "Compartilhar → Adicionar à Tela de Início".
// Mantém zoom/acessibilidade; dispensa por 7 dias. Não exibe se já está em modo standalone.

const DISMISS_KEY = "sett_install_dismissed";
const DISMISS_DAYS = 7;

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = window.navigator.userAgent || "";
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ se apresenta como Macintosh com touch
  const iPadOS = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  return iOSDevice || iPadOS;
}

function dismissedRecently(): boolean {
  try {
    const v = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return v > 0 && Date.now() - v < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;

    const decide = () => {
      const w = window as unknown as { __bip?: unknown };
      if (w.__bip) setMode("android");
      else if (isIOS()) setMode("ios");
      else setMode(null);
    };
    decide();
    window.addEventListener("bip-ready", decide);

    // Aparece depois de alguns segundos para não atrapalhar o primeiro contato.
    const t = setTimeout(() => setShow(true), 2500);
    return () => {
      clearTimeout(t);
      window.removeEventListener("bip-ready", decide);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
  };

  const installAndroid = async () => {
    const w = window as unknown as { __bip?: { prompt: () => void; userChoice: Promise<{ outcome: string }> } };
    const bip = w.__bip;
    if (!bip) return;
    try {
      bip.prompt();
      await bip.userChoice;
    } catch { /* ignore */ }
    w.__bip = undefined;
    dismiss();
  };

  if (!show || !mode) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
      role="dialog"
      aria-label="Instalar o app"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-navy text-primary-foreground shadow-2xl">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base leading-tight">Instale o SETT no seu celular</p>
            {mode === "android" ? (
              <p className="mt-0.5 text-xs text-primary-foreground/80">
                Acesso rápido na tela inicial, em tela cheia. Toque em instalar.
              </p>
            ) : (
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-primary-foreground/80">
                Toque em <Share className="inline h-3.5 w-3.5" /> <span className="font-medium">Compartilhar</span> e depois em
                <span className="inline-flex items-center gap-0.5 font-medium"><Plus className="h-3.5 w-3.5" /> Adicionar à Tela de Início</span>.
              </p>
            )}
            {mode === "android" && (
              <button
                type="button"
                onClick={installAndroid}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy"
              >
                <Download className="h-3.5 w-3.5" /> Instalar app
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dispensar"
            className="shrink-0 rounded-full p-1 text-primary-foreground/70 transition hover:bg-white/10 hover:text-primary-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
