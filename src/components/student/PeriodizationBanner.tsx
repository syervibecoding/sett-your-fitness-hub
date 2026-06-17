import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildPeriodizationPlan,
  currentWeekIndex,
  weeksBetweenDates,
  MICROCYCLES,
  MESOCYCLES,
  type MicrocycleType,
} from "@/lib/periodization";

const DOT: Record<MicrocycleType, string> = {
  ordinario: "bg-primary",
  choque: "bg-amber-500",
  regenerativo: "bg-green-500",
};
const CHIP: Record<MicrocycleType, string> = {
  ordinario: "border-primary/30 bg-primary/15 text-primary",
  choque: "border-amber-500/30 bg-amber-500/15 text-amber-700",
  regenerativo: "border-green-500/30 bg-green-500/15 text-green-700",
};

/**
 * Mostra ao aluno a periodização do ciclo: mesociclo + microciclo da semana atual,
 * com uma linha do tempo navegável (toque numa semana para ver a fase dela).
 * Tudo derivado do objetivo + datas/duração do ciclo (sem depender do banco).
 */
export function PeriodizationBanner({
  objective,
  durationWeeks,
  startDate,
  endDate,
}: {
  objective?: string | null;
  durationWeeks?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const dur = durationWeeks || weeksBetweenDates(startDate, endDate) || 6;
  const plan = buildPeriodizationPlan(objective, dur);
  const curIdx = currentWeekIndex(startDate, plan.durationWeeks);
  const [sel, setSel] = useState<number>(curIdx);

  const wk = plan.weeks[Math.min(sel, plan.weeks.length - 1)] || plan.weeks[0];
  if (!wk) return null;
  const micro = MICROCYCLES[wk.microcycle];
  const meso = MESOCYCLES[wk.mesocycle];
  const isCurrent = sel === curIdx;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono-data text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <CalendarRange className="h-4 w-4" /> Periodização
          </span>
          <span className="font-sans text-xs text-muted-foreground">
            Semana {curIdx + 1} de {plan.durationWeeks}
          </span>
        </div>

        {/* Linha do tempo dos microciclos — toque para ver a fase de cada semana */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {plan.weeks.map((w, i) => {
            const t = MICROCYCLES[w.microcycle];
            const isCur = i === curIdx;
            const isSel = i === sel;
            return (
              <button
                key={w.week}
                type="button"
                onClick={() => setSel(i)}
                title={`Semana ${w.week} · ${t.short}`}
                className={`relative flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg border text-[11px] font-bold transition
                  ${isSel ? "border-primary ring-2 ring-primary/40" : "border-border"}
                  ${isCur ? "bg-primary/10" : "bg-card hover:bg-secondary"}`}
              >
                <span className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${DOT[w.microcycle]}`} />
                <span className="text-foreground">{w.week}</span>
              </button>
            );
          })}
        </div>

        {/* Detalhe da semana selecionada (padrão = atual) */}
        <div className="space-y-1.5 rounded-lg border border-border bg-card/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
              Mesociclo: {meso.label}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CHIP[wk.microcycle]}`}>
              {micro.short}
            </span>
            {!isCurrent && (
              <span className="text-[10px] text-muted-foreground">prévia · semana {wk.week}</span>
            )}
          </div>
          <p className="font-sans text-sm leading-relaxed text-foreground">{micro.description}</p>
          <p className="font-sans text-xs text-muted-foreground">{wk.focus}</p>
          <p className="font-mono-data text-[11px] text-muted-foreground">
            RIR alvo {wk.rir} · Volume ~{wk.volumePct}% da referência
          </p>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-3 px-0.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> Ordinário</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Choque</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Regenerativo</span>
        </div>
      </CardContent>
    </Card>
  );
}
