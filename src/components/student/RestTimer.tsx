import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Volume2, VolumeX } from "lucide-react";
import { restDoneFeedback, isSoundMuted, setSoundMuted } from "@/lib/feedback";

interface RestTimerProps {
  restSeconds: number;
  onComplete?: () => void;
}

export function RestTimer({ restSeconds, onComplete }: RestTimerProps) {
  const [remaining, setRemaining] = useState(restSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const [muted, setMuted] = useState(isSoundMuted());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(restSeconds);
    setIsRunning(true);
  }, [restSeconds]);

  useEffect(() => {
    if (!isRunning || remaining <= 0) return;
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          setIsRunning(false);
          // Sound + vibration when rest is done.
          restDoneFeedback();
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, remaining, onComplete]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  const progress = ((restSeconds - remaining) / restSeconds) * 100;

  if (remaining <= 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-primary font-sans animate-pulse">
        <Timer className="h-3.5 w-3.5" />
        Descanso concluído! Próxima série.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs font-sans text-primary">
        <div className="flex items-center gap-2">
          <Timer className="h-3.5 w-3.5 animate-pulse" />
          <span>Descanso: {remaining}s</span>
        </div>
        <button
          type="button"
          onClick={toggleMute}
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label={muted ? "Ativar som" : "Silenciar"}
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

export function useRestTimer() {
  const [activeRest, setActiveRest] = useState<{ exerciseIdx: number; setNum: number; seconds: number } | null>(null);

  const startRest = useCallback((exerciseIdx: number, setNum: number, restStr: string) => {
    const seconds = parseInt(restStr) || 60;
    setActiveRest({ exerciseIdx, setNum, seconds });
  }, []);

  const clearRest = useCallback(() => setActiveRest(null), []);

  return { activeRest, startRest, clearRest };
}
