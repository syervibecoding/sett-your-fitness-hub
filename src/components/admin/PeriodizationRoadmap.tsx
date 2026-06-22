import { useMemo } from "react";
import { buildPeriodizationPlan, MICROCYCLES, MESOCYCLES, currentWeekIndex } from "@/lib/periodization";
import { CalendarRange } from "lucide-react";

// P4 — roadmap visual da periodização: 3 blocos × N semanas (micro/meso + RIR + volume%),
// derivado do objetivo + duração. Mostra ANTES de publicar como o estímulo vai evoluir.
const TONE: Record<string, string> = {
  primary: "bg-primary/10 text-primary border-primary/30",
  amber: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  green: "bg-green-500/10 text-green-600 border-green-500/30",
};

export function PeriodizationRoadmap({ objective, durationWeeks, startDate, className }: {
  objective?: string | null;
  durationWeeks?: number | null;
  startDate?: string | null;
  className?: string;
}) {
  const plan = useMemo(() => buildPeriodizationPlan(objective, durationWeeks), [objective, durationWeeks]);
  const curIdx = useMemo(
    () => (startDate ? currentWeekIndex(startDate, plan.durationWeeks) : -1),
    [startDate, plan.durationWeeks],
  );
  if (!plan.weeks.length) return null;

  return (
    <div className={`rounded-lg border border-border bg-card p-3 ${className ?? ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <CalendarRange className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Periodização — {plan.durationWeeks} semanas</h4>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
        {plan.weeks.map((w) => {
          const micro = MICROCYCLES[w.microcycle];
          return (
            <div
              key={w.week}
              className={`rounded-md border p-1.5 text-center ${TONE[micro.tone] || TONE.primary} ${curIdx === w.week - 1 ? "ring-2 ring-offset-1 ring-primary" : ""}`}
              title={`${micro.label} · ${MESOCYCLES[w.mesocycle].label}\n${w.focus}`}
            >
              <p className="text-[10px] uppercase tracking-wide opacity-70">Sem {w.week}</p>
              <p className="text-[11px] font-semibold leading-tight">{micro.short}</p>
              <p className="text-[10px] font-mono-data">RIR {w.rir}</p>
              <p className="text-[10px] opacity-70">{w.volumePct}% vol</p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Blocos: {MESOCYCLES.base.label} → {MESOCYCLES.acumulacao.label} → {MESOCYCLES.intensificacao.label}
        {plan.weeks.some((w) => w.mesocycle === "polimento") ? ` → ${MESOCYCLES.polimento.label}` : ""}.{" "}
        <span className="text-primary">ordinário</span> · <span className="text-amber-600">choque</span> · <span className="text-green-600">regenerativo (deload)</span>.
      </p>
    </div>
  );
}
