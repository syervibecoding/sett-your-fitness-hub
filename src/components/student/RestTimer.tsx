import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Timer, Volume2, VolumeX } from "lucide-react";
import { restDoneFeedback, isSoundMuted, setSoundMuted } from "@/lib/feedback";

interface RestTimerProps {
  restSeconds: number;
  startedAt?: number;
  onComplete?: () => void;
}

// A7 — relógio de parede: o descanso é calculado por timestamp (não por contagem de ticks),
// então sobrevive a trocar de aba/rota e ao throttling de setInterval em segundo plano.
export function RestTimer({ restSeconds, startedAt, onComplete }: RestTimerProps) {
  const endAt = useMemo(() => (startedAt ?? Date.now()) + restSeconds * 1000, [startedAt, restSeconds]);
  const calc = () => Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(calc);
  const [muted, setMuted] = useState(isSoundMuted());
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const tick = () => {
      const r = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0 && !firedRef.current) {
        firedRef.current = true;
        restDoneFeedback();
        onComplete?.();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endAt, onComplete]);

  const progress = restSeconds > 0 ? ((restSeconds - remaining) / restSeconds) * 100 : 0;

  if (remaining <= 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-400 font-sans animate-pulse">
        <Timer className="h-3.5 w-3.5" />
        Descanso concluído! Próxima série.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs font-sans text-primary">
        <Timer className="h-3.5 w-3.5 animate-pulse" />
        <span className="font-mono-data">Descanso: {remaining}s</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); const next = !muted; setMuted(next); setSoundMuted(next); }}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          title={muted ? "Ativar som do descanso" : "Silenciar som do descanso"}
          aria-label={muted ? "Ativar som" : "Silenciar som"}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// O campo "rest" da prescrição é texto livre ("90s", "1min", "2'", "1:30", "60").
// parseInt cru tratava "1min" como 1 segundo. Este parser cobre os formatos reais.
export function parseRestSeconds(restStr: string | number | null | undefined): number {
  if (typeof restStr === "number" && isFinite(restStr)) return Math.max(1, Math.round(restStr));
  const s = String(restStr ?? "").trim().toLowerCase();
  if (!s) return 60;
  const mmss = s.match(/^(\d+):([0-5]?\d)$/);            // 1:30
  if (mmss) return Math.max(1, parseInt(mmss[1]) * 60 + parseInt(mmss[2]));
  const min = s.match(/(\d+(?:[.,]\d+)?)\s*(?:min|m|')/); // 1min, 2', 1.5 min
  if (min) return Math.max(1, Math.round(parseFloat(min[1].replace(",", ".")) * 60));
  const sec = s.match(/(\d+)/);                           // 90s, 60 seg, 90
  if (sec) return Math.max(1, parseInt(sec[1]));
  return 60;
}

const REST_KEY = "sett-active-rest";
type ActiveRest = { exerciseIdx: number; setNum: number; seconds: number; startedAt: number };

export function useRestTimer() {
  // Restaura um descanso em andamento ao remontar (trocar de aba/rota não perde o cronômetro).
  const [activeRest, setActiveRest] = useState<ActiveRest | null>(() => {
    try {
      const raw = sessionStorage.getItem(REST_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw) as ActiveRest;
      if (typeof v?.startedAt === "number" && typeof v?.seconds === "number"
        && Date.now() < v.startedAt + (v.seconds + 5) * 1000) return v;
      sessionStorage.removeItem(REST_KEY);
    } catch { /* noop */ }
    return null;
  });

  const startRest = useCallback((exerciseIdx: number, setNum: number, restStr: string) => {
    const seconds = parseRestSeconds(restStr);
    const next: ActiveRest = { exerciseIdx, setNum, seconds, startedAt: Date.now() };
    setActiveRest(next);
    try { sessionStorage.setItem(REST_KEY, JSON.stringify(next)); } catch { /* noop */ }
  }, []);

  const clearRest = useCallback(() => {
    setActiveRest(null);
    try { sessionStorage.removeItem(REST_KEY); } catch { /* noop */ }
  }, []);

  return { activeRest, startRest, clearRest };
}
