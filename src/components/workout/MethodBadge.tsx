import { useState } from "react";
import { Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WORKOUT_METHODS, methodNeedsSeconds, type MethodId } from "@/lib/workoutMethods";

type Tone = "amber" | "primary" | "muted";

const TONES: Record<Tone, string> = {
  amber: "border border-amber-500/30 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25",
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  muted: "border border-border bg-secondary text-foreground hover:bg-secondary/70",
};

/**
 * Badge da técnica/metodologia. Mostra o rótulo curto (+ tempo, quando houver) e,
 * ao clicar, abre um diálogo explicando EXATAMENTE o que o aluno deve fazer.
 * Usado no app do professor e no app do aluno.
 */
export function MethodBadge({
  method,
  seconds,
  tone = "amber",
  className = "",
}: {
  method?: string | null;
  seconds?: number | null;
  tone?: Tone;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!method) return null;
  const meta = WORKOUT_METHODS[method as MethodId];
  if (!meta) return null;
  const needsSec = methodNeedsSeconds(method);
  const secTxt = needsSec && seconds ? ` ${seconds}s` : "";

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${TONES[tone]} ${className}`}
        title="Toque para ver o que significa"
        aria-label={`O que é ${meta.label}`}
      >
        {meta.short}{secTxt}
        <Info className="h-3 w-3 opacity-70" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-primary">{meta.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">{meta.description}</p>
            {needsSec && seconds ? (
              <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                👉 Segure por {seconds} segundo{seconds === 1 ? "" : "s"}{meta.holdHint ? ` — ${meta.holdHint}` : ""}.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
