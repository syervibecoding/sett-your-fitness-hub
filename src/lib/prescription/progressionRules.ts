// Notas de progressão ao longo do ciclo (semana a semana), reaproveitando a periodização.
import { buildPeriodizationPlan } from "../periodization";
import type { Objective } from "./types";

function objToPeriodization(objective: Objective): string {
  if (objective === "forca" || objective === "performance") return "performance";
  return objective;
}

// Texto resumido de como progredir ao longo do ciclo.
export function weeklyProgressionNotes(
  objective: Objective,
  durationWeeks: number,
): string[] {
  const plan = buildPeriodizationPlan(objToPeriodization(objective), durationWeeks);
  return plan.weeks.map(
    (w) =>
      `Semana ${w.week} · ${w.microcycle} · RIR ${w.rir} · ${w.volumePct}% do volume — ${w.focus}`,
  );
}
