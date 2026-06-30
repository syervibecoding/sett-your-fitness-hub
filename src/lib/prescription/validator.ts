// Validador: checagens de sanidade do plano gerado (retorna avisos).
import type { Experience, PrescriptionInput, PrescriptionPlan } from "./types";

// Estimativa grosseira de minutos por exercício (séries × (descanso + ~30s execução)).
function estimateMinutes(
  exercises: { sets: string; rest: string }[],
): number {
  let sec = 0;
  for (const ex of exercises) {
    const sets = parseInt(ex.sets, 10) || 0;
    const rest = parseInt(ex.rest, 10) || 60;
    sec += sets * (rest + 35);
  }
  return Math.round(sec / 60);
}

export function validatePlan(
  plan: PrescriptionPlan,
  input: PrescriptionInput,
): string[] {
  const warnings: string[] = [];

  // Sessão muito longa
  for (const w of plan.workouts) {
    const min = estimateMinutes(w.exercises);
    if (min > input.sessionDurationMin + 15) {
      warnings.push(
        `${w.title}: duração estimada (${min} min) acima do tempo disponível (${input.sessionDurationMin} min). Considere reduzir exercícios.`,
      );
    }
    if (w.exercises.length === 0) {
      warnings.push(`${w.title}: sem exercícios disponíveis na biblioteca para os grupos previstos.`);
    }
  }

  // Volume fora da faixa
  for (const v of plan.weeklyVolume) {
    if (v.status === "low") {
      warnings.push(
        `${v.label}: ${v.sets} séries/semana abaixo do mínimo recomendado (${v.target[0]}–${v.target[1]}).`,
      );
    } else if (v.status === "high") {
      warnings.push(
        `${v.label}: ${v.sets} séries/semana acima do máximo recomendado (${v.target[0]}–${v.target[1]}).`,
      );
    }
  }

  return warnings;
}

export function experienceLabel(e: Experience): string {
  return e === "iniciante" ? "Iniciante" : e === "avancado" ? "Avançado" : "Intermediário";
}
